// Vercel Serverless Function - Frontend-safe config endpoint
// GET /api/config
//
// Returns a small whitelist of runtime config values sourced from process.env.
// These values are NOT secret (same identifiers already appear in committed
// HTML today) but centralizing them here means we can rotate in one place and
// keep Vercel env as the single source of truth.
//
// SECURITY: Only values listed in the whitelist below are exposed. Backend
// /exec URLs, tokens, and webhooks stay server-only.

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const paymentParentFolder =
    process.env.PAYMENT_REQUEST_FOLDER_ID ||
    '';

  // PAY_DRAFT_PARENT_FOLDER_ID: legacy alias for payment_request.html.
  return res.status(200).json({
    DRIVE_VOUCHER_FOLDER_ID: process.env.DRIVE_VOUCHER_FOLDER_ID || '',
    MASTER_SPREADSHEET_ID: process.env.MASTER_SPREADSHEET_ID || '',
    PURCHASE_REQUEST_FOLDER_ID: process.env.PURCHASE_REQUEST_FOLDER_ID || '',
    ACCEPTANCE_MINUTES_FOLDER_ID: process.env.ACCEPTANCE_MINUTES_FOLDER_ID || '',
    PAYMENT_REQUEST_FOLDER_ID: paymentParentFolder,
    PAY_DRAFT_PARENT_FOLDER_ID: paymentParentFolder
  });
}
