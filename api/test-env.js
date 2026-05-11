// Test endpoint to check environment variables status
// Access at: /api/test-env
// This helps verify that environment variables are set correctly in Vercel

function flagSet(v) {
  return v ? '✅ Set' : '❌ Not set';
}

function urlPreview(url) {
  if (!url) return '(empty)';
  if (url.length <= 42) return url;
  return url.substring(0, 34) + '...' + url.substring(url.length - 8);
}

function idPreview(id) {
  if (!id) return '(empty)';
  if (id.length <= 24) return id.substring(0, 6) + '…';
  return id.substring(0, 10) + '…' + id.substring(id.length - 6);
}

export default async function handler(req, res) {
  const voucherUrl = process.env.TLCG_CASH_BACKEND_URL || process.env.VOUCHER_BACKEND_URL;
  const tlgroupUrl = process.env.TLCG_CORE_BACKEND_URL || process.env.TLCGROUP_BACKEND_URL;
  const paymentBackendUrl = process.env.TLCG_P2P_BACKEND_URL || process.env.PAYMENT_REQUEST_BACKEND_URL;

  const envStatus = {
    cashBackend: {
      TLCG_CASH_BACKEND_URL: flagSet(process.env.TLCG_CASH_BACKEND_URL),
      VOUCHER_BACKEND_URL: process.env.VOUCHER_BACKEND_URL ? '⚠️ Set (legacy fallback)' : '— not set',
      urlPreview: urlPreview(voucherUrl || '')
    },
    coreBackend: {
      TLCG_CORE_BACKEND_URL: flagSet(process.env.TLCG_CORE_BACKEND_URL),
      TLCGROUP_BACKEND_URL: process.env.TLCGROUP_BACKEND_URL ? '⚠️ Set (legacy fallback)' : '— not set',
      urlPreview: urlPreview(tlgroupUrl || '')
    },
    p2pBackend: {
      TLCG_P2P_BACKEND_URL: flagSet(process.env.TLCG_P2P_BACKEND_URL),
      PAYMENT_REQUEST_BACKEND_URL: process.env.PAYMENT_REQUEST_BACKEND_URL ? '⚠️ Set (legacy fallback)' : '— not set',
      urlPreview: urlPreview(paymentBackendUrl || '')
    },
    frontendConfigWhitelist: {
      GOOGLE_CLIENT_ID: flagSet(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_API_KEY: flagSet(process.env.GOOGLE_API_KEY),
      DRIVE_VOUCHER_FOLDER_ID: flagSet(process.env.DRIVE_VOUCHER_FOLDER_ID),
      MASTER_SPREADSHEET_ID: flagSet(process.env.MASTER_SPREADSHEET_ID),
      PURCHASE_REQUEST_FOLDER_ID: flagSet(process.env.PURCHASE_REQUEST_FOLDER_ID),
      ACCEPTANCE_MINUTES_FOLDER_ID: flagSet(process.env.ACCEPTANCE_MINUTES_FOLDER_ID),
      PAYMENT_REQUEST_FOLDER_ID: flagSet(process.env.PAYMENT_REQUEST_FOLDER_ID)
    },
    idPreviews: {
      DRIVE_VOUCHER_FOLDER_ID: idPreview(process.env.DRIVE_VOUCHER_FOLDER_ID),
      MASTER_SPREADSHEET_ID: idPreview(process.env.MASTER_SPREADSHEET_ID),
      PURCHASE_REQUEST_FOLDER_ID: idPreview(process.env.PURCHASE_REQUEST_FOLDER_ID),
      ACCEPTANCE_MINUTES_FOLDER_ID: idPreview(process.env.ACCEPTANCE_MINUTES_FOLDER_ID),
      PAYMENT_REQUEST_FOLDER_ID: idPreview(process.env.PAYMENT_REQUEST_FOLDER_ID)
    }
  };

  return res.status(200).json({
    success: true,
    message: 'Environment Variables Status',
    environment: envStatus,
    note:
      'Proxy routes use built-in fallback /exec URLs when backend env vars are unset. GET /api/config exposes only keys listed under frontendConfigWhitelist.',
    instructions: {
      setVariables: 'Go to Vercel Dashboard → Settings → Environment Variables',
      verify: 'Redeploy after setting environment variables for changes to take effect',
      template: 'Copy .env.example to .env locally (see repo root)'
    }
  });
}
