// This controller does NOT verify tokens or talk to the database at all.
// Its only job is to bridge a plain, universally-clickable HTTPS email link
// into the app via a custom URL scheme (forestapp://...). The actual
// verification / password-reset API call is made by the app itself once it
// receives the deep link — this page never touches the API or the DB.
//
// Why this exists: iOS/Android don't let a bare custom-scheme link
// (forestapp://verify-email/TOKEN) be safely embedded in an email — many
// mail clients strip or flag non-https links. An https:// link always
// works, so email links point here, and this page immediately redirects
// into the app.
//
// Upgrade path: once you have your Android signing SHA-256 fingerprint and
// Apple Team ID (only available after your first signed build), add
// /.well-known/assetlinks.json and /.well-known/apple-app-site-association
// and these same https:// links become verified Universal/App Links that
// open the app with NO landing page or tap required. Nothing here needs to
// change for that upgrade.

const APP_SCHEME = "forestapp";

function bridgePage({ deepLink, title, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, Roboto, Arial, sans-serif; background:#F7F8F6; color:#1E2620; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; text-align:center; }
    .card { background:#fff; border:1px solid #D8DED9; border-radius:14px; padding:32px 24px; max-width:420px; }
    h1 { font-size:20px; margin:0 0 12px; color:#2E5339; }
    p { font-size:15px; line-height:1.5; color:#5B6660; margin:0 0 24px; }
    a.btn { display:inline-block; background:#2E5339; color:#fff; text-decoration:none; font-weight:700; padding:14px 28px; border-radius:10px; }
  </style>
  <script>
    // Best-effort auto-redirect. If the app isn't installed this silently
    // fails and the visible button below is the fallback.
    window.location.href = ${JSON.stringify(deepLink)};
  </script>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    <a class="btn" href="${deepLink}">Open Forest App</a>
  </div>
</body>
</html>`;
}

export const verifyEmailBridge = (req, res) => {
  const { token } = req.params;
  const deepLink = `${APP_SCHEME}://verify-email/${encodeURIComponent(token)}`;
  res
    .status(200)
    .type("html")
    .send(
      bridgePage({
        deepLink,
        title: "Verify your email",
        body: "Tap the button below to finish verifying your email in the Forest App.",
      }),
    );
};

export const resetPasswordBridge = (req, res) => {
  const { rawPassResetToken } = req.params;
  const deepLink = `${APP_SCHEME}://reset-password/${encodeURIComponent(rawPassResetToken)}`;
  res
    .status(200)
    .type("html")
    .send(
      bridgePage({
        deepLink,
        title: "Reset your password",
        body: "Tap the button below to set a new password in the Forest App.",
      }),
    );
};
