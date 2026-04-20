---
name: audit-slow-flow
description: Audit slow browser→Vercel-proxy→Apps-Script→Google-Sheets flows in the TLCG Workflow repo. Produces measurements (latency, payload, row counts), identifies N+1 fan-outs / full-sheet reads / missing caches, and proposes prioritized fixes. Use when the user reports a dashboard or form feels slow, a request times out, a /api/voucher call returns HTTP 500/504, a "Recent Vouchers" / "Recent Payment Requests" card hangs, or when asked to profile / audit / benchmark any flow that uses api/voucher/[action].js or api/voucher.js.
---

# Audit slow flow (TLCG Workflow)

This repo has a three-tier architecture:

```
Browser (index.html / phieu_thu_chi.html / de_nghi_thanh_toan.html)
    ↓ fetch('/api/voucher', …)
Vercel proxy (api/voucher/[action].js — simple pass-through, no cache)
    ↓ fetch(GOOGLE_APPS_SCRIPT_URL, …)
Google Apps Script (VOUCHER_WORKFLOW_BACKEND.gs / PAYMENT_REQUEST_BACKEND.gs)
    ↓ SpreadsheetApp.openById(…).getDataRange().getValues()
Google Sheets (Voucher_History, Master Employee, Master Company, …)
```

Slowness is almost always in one of three places: a client-side N+1 loop,
a full-sheet read on the GAS side, or missing caching on the proxy. Run
through the workflow below; stop as soon as measurements explain the
symptom.

## Workflow

Copy this checklist and tick as you go:

```
- [ ] Step 1: Reproduce + scope the symptom
- [ ] Step 2: Find the client call site(s)
- [ ] Step 3: Find the proxy route + cache headers
- [ ] Step 4: Find the GAS handler + sheet reads
- [ ] Step 5: Measure live (curl with --write-out timing)
- [ ] Step 6: Count the fan-out (does the browser fire N parallel calls?)
- [ ] Step 7: Compile findings + prioritized fixes
- [ ] Step 8: Propose fixes (don't apply without approval)
```

### Step 1 — Reproduce + scope

Pin down exactly what's slow. Ask:

- Which page? (`index.html` dashboard, `phieu_thu_chi.html` form, `de_nghi_thanh_toan.html` form, a specific card?)
- Which action label feels slow? ("Loading vouchers…", "Đang tải thông tin…", a step that hangs on submit?)
- Is it *always* slow (structural) or *sometimes* slow (cold start / quota / network)?
- Approximate dataset size (rows in the relevant sheet — 500 vouchers feels different from 50 000).

### Step 2 — Find the client call site

Search the HTML file for `fetch('/api/voucher'` and the string that appears
in the slow UI state. N+1 fan-outs almost always live in a `.forEach(`
that iterates over an array returned by a summary call:

```bash
# Example greps that have found the bug before:
rg "fetch\('/api/voucher'" index.html
rg "data\.recent\.forEach|vouchers\.forEach|items\.forEach" index.html
rg "Đang tải|Loading|action: 'getApprovalStatus'" index.html
```

Red flags:

- `forEach(v => fetch('/api/voucher', ...))` — textbook N+1.
- A "Loading…" placeholder rendered immediately, then resolved per-item.
- A per-item call that only uses fields already present on the parent
  summary payload.

### Step 3 — Find the proxy route + cache headers

The proxy is [api/voucher/[action].js](../../api/voucher/[action].js). It
pass-throughs POST bodies as FormData to the GAS URL stored in
`process.env.GOOGLE_APPS_SCRIPT_URL`. Check it for:

- `res.setHeader('Cache-Control', …)` — if absent on read-only actions
  (`getVoucherSummary`, `getEmployees`, `getCompanyApprovers`), that's a
  free win.
- Vercel plan timeout (Hobby = 10 s). Any upstream call slower than 10 s
  becomes a 500 from the proxy's perspective, which reaches the browser
  as a generic HTTP 500. This is the #1 source of flaky 500s in this
  codebase.

Also check [api/config.js](../../api/config.js) — pure config endpoint, safe
to cache aggressively.

### Step 4 — Find the GAS handler + sheet reads

In the matching `.gs` file, search for the `handleXxx` function that
matches the action name (e.g. `action === 'getApprovalStatus'` →
`handleGetApprovalStatus`). Look for:

- `sheet.getDataRange().getValues()` — reads **every row × every column**,
  including column R (MetaJSON) on `Voucher_History`, which contains
  large base64 signatures. On this sheet, `getDataRange()` is always
  the wrong call.
- `sheet.getRange(1, 1, lastRow, N).getValues()` with an explicit column
  count — the right pattern. `handleGetVoucherSummary` uses `, 17)` to
  skip column R for this exact reason.
- Nested calls: if the handler calls another `handleXxx(…)` internally,
  factor that work into the cost.
- Missing `CacheService.getScriptCache()` around expensive aggregations.

A concrete example of the wrong pattern (from an earlier audit):

```javascript
// VOUCHER_WORKFLOW_BACKEND.gs — getVoucherFromHistory
const data = sheet.getDataRange().getValues(); // ← reads base64 signatures too
for (let i = 1; i < data.length; i++) {        // ← linear scan per call
  if (data[i][0] === voucherNumber) { … }
}
```

When this function is called from an N+1 loop, each of N calls re-reads
the entire sheet. 421 vouchers × a 7.75 s sheet read ≈ a dashboard that
never finishes loading.

### Step 5 — Measure live

Always produce numbers. Don't guess; curl the production endpoint with
`--write-out` to get timing + payload size in one shot:

```bash
# 1. Time + size the summary call
curl -s -o /tmp/summary.json \
  -w "TIME: %{time_total}s | HTTP: %{http_code} | SIZE: %{size_download} bytes\n" \
  -X POST "https://tlcg-workflow.vercel.app/api/voucher" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "action=getVoucherSummary"

# 2. Parse the response: how many items does the summary already return?
python3 -c "
import json
r = json.load(open('/tmp/summary.json'))
d = r.get('data', {})
recent = d.get('recent', [])
print(f'Count: {len(recent)}')
print(f'Sample keys: {list(recent[0].keys()) if recent else None}')
print(f'Sample bytes: {len(json.dumps(recent[0])) if recent else 0}')
"

# 3. Time ONE of the per-item calls the N+1 loop fires
VNUM=$(python3 -c "import json;print(json.load(open('/tmp/summary.json'))['data']['recent'][0]['voucherNumber'])")
curl -s -o /dev/null \
  -w "TIME: %{time_total}s | HTTP: %{http_code}\n" \
  -X POST "https://tlcg-workflow.vercel.app/api/voucher" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "action=getApprovalStatus&voucherNumber=$VNUM"
```

Document three numbers: **summary time**, **per-item time**, **N (item
count)**. The N+1 wall-clock is approximately
`summary + (N / browser_parallel_limit) × per_item`, where
`browser_parallel_limit ≈ 6`. Compare to the Vercel 10 s function timeout
to predict how many of the N calls will return HTTP 500.

### Step 6 — Count the fan-out

If Step 5 revealed an N+1 pattern, verify that the per-item call is
actually *needed*. Most N+1 bugs in this repo turn out to call an
endpoint whose payload is a strict subset of what the summary already
returned. Check by diffing:

1. What fields does the UI render after the per-item call resolves?
   (Look at the code that runs inside `loadXxx(...)` after `await fetch`.)
2. What fields are already present in `data.recent[i]` from the summary?
   (Print `Object.keys(recent[0])` from Step 5.)

If (1) ⊆ (2), the per-item call is redundant and can simply be deleted.
If (1) contains fields not in (2), propose enriching the summary payload
instead of keeping the loop.

### Step 7 — Compile findings

Produce a short report with this shape:

```markdown
# Audit: <component name>

## Measurements
| Metric | Value |
| --- | --- |
| <summary call> time / size / N | … |
| <per-item call> time / size | … |
| Predicted total wall-clock | … |
| Vercel timeout | 10 s |

## Root cause
<1-2 paragraphs pointing at the exact lines, with file:line citations>

## Prioritized fixes
🟢 Fix #1 — <quick win>        — <time to implement> / <latency impact>
🟢 Fix #2 — …
🟡 Fix #3 — …
🟠 Fix #4 — …
```

### Step 8 — Propose fixes; do not apply without approval

Fixes that have paid off in this repo:

1. **Delete N+1 loops.** If the per-item call is redundant, remove the
   `forEach` entirely and render from the summary payload.
2. **Enrich summary payloads** with the small amount of extra data the
   UI needs (e.g. a `currentApproverName` field) to avoid per-item
   round-trips.
3. **Add edge caching at the proxy** for read-only actions:
   `res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')`.
4. **Fix the sheet read pattern** — replace `getDataRange().getValues()`
   with an explicit `getRange(1, 1, lastRow, neededCols).getValues()`
   that stops before column R on `Voucher_History`.
5. **Add `CacheService.getScriptCache()`** around expensive aggregations
   in GAS as a fallback for when edge caching isn't enough.

Always present fixes as options; let the user pick the scope before
touching code. Cite existing file:line references so the diff is
obvious.

## Repo-specific references

- Frontend call sites:
  [index.html](../../index.html),
  [phieu_thu_chi.html](../../phieu_thu_chi.html),
  [de_nghi_thanh_toan.html](../../de_nghi_thanh_toan.html)
- Proxy:
  [api/voucher/[action].js](../../api/voucher/[action].js)
- GAS backends:
  [VOUCHER_WORKFLOW_BACKEND.gs](../../VOUCHER_WORKFLOW_BACKEND.gs),
  [PAYMENT_REQUEST_BACKEND.gs](../../PAYMENT_REQUEST_BACKEND.gs)
- Deployment hostname used for curl measurements: `https://tlcg-workflow.vercel.app`
  (project ID lives in `.vercel/project.json`).

## Anti-patterns seen in past audits

- **Full-sheet read inside a per-item handler** — the handler is innocent
  in isolation but becomes lethal when the frontend fires N copies of it.
  Always audit the call site fan-out before blaming the handler.
- **"It's transient"** — a call timing out at exactly the Vercel function
  limit (10 s on Hobby, 60 s on Pro) isn't transient. Check measured
  upstream latency against the plan's limit before concluding anything is
  a cold-start issue.
- **Fixing the symptom in the GAS handler** — optimizing a per-item
  handler from 7 s to 4 s still collapses under N+1 load. Always fix the
  fan-out first; optimize the handler second.
