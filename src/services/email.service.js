import {
  clientUrl,
  emailFrom,
  brevoApiKey,
  emailFromName
} from "../config/env.js";

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: emailFromName, email: emailFrom },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log("Email sent:", data.messageId, "to", to);
  } catch (error) {
    console.log("Email send failed:", error.message);
    throw error;
  }
};

export const sendVerificationEmail = async (user, rawToken) => {
  try {
    const link = `${clientUrl}/verify-email/${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Verify your email",
      html: `
        <h1>Verify your email</h1>
        <p>Click the link below to verify your email address:</p>
        <a href="${link}">${link}</a>
        <p>This link expires soon. If it's expired, you can request a new one from the app.</p>
      `,
    });
  } catch (error) {
    console.log("sendVerificationEmail failed for", user.email, "-", error.message);
  }
};

export const sendPasswordResetEmail = async (user, rawToken) => {
  try {
    const link = `${clientUrl}/reset-password/${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      html: `
        <h1>Reset your password</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${link}">${link}</a>
        <p>This link expires in 10 minutes. If it's expired, you can request a new one from the app.</p>
      `,
    });
  } catch (error) {
    console.log("sendPasswordResetEmail failed for", user.email, "-", error.message);
  }
};