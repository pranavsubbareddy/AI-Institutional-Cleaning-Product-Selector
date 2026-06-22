// ─────────────────────────────────────────────────────────────────────────
// Server-side transactional email service using Resend
// ─────────────────────────────────────────────────────────────────────────
// Set RESEND_API_KEY environment variable in Vercel dashboard or .env
// Get a free API key at https://resend.com/api-keys (3,000 emails/month free)

const { Resend } = require('resend');

let resendClient = null;

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set. Emails will not be sent.');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// The "from" email — must be a verified domain in your Resend account
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'auth@ganga-maxx.com';
const APP_NAME = 'Ganga Maxx AI Cleaning Selector';
const APP_URL = process.env.FRONTEND_URL || 'https://pranavsubbareddy.github.io/AI-Institutional-Cleaning-Product-Selector';

// ── Ensure the client is available ────────────────────────────────────
function ensureClient() {
  const client = getClient();
  if (!client) return null;
  return client;
}

// ── Send Email Verification ───────────────────────────────────────────
async function sendVerificationEmail(email, displayName, token) {
  const client = ensureClient();
  if (!client) return { success: false, skipped: true };

  const verifyUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  try {
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Verify your email address - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
          <div style="max-width:560px;margin:0 auto;padding:24px;">
            <div style="background:linear-gradient(135deg,#06b6d4,#10b981);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
            </div>
            <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Hi ${displayName},</h2>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">Thanks for creating an account! Please verify your email address by clicking the button below:</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#10b981);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Verify Email Address</a>
              </div>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin:0 0 12px;">Or copy and paste this link in your browser:</p>
              <p style="color:#06b6d4;font-size:13px;word-break:break-all;margin:0 0 20px;background:#f1f5f9;padding:12px;border-radius:6px;">${verifyUrl}</p>
              <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;">This link expires in 24 hours.</p>
              <p style="color:#94a3b8;font-size:13px;margin:0;">If you didn't create this account, you can safely ignore this email.</p>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">&copy; ${new Date().getFullYear()} Ganga Maxx Marketplace. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Verification email failed:', error);
      return { success: false, error: error.message };
    }
    console.log('[Email] Verification email sent to', email);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Verification email error:', err);
    return { success: false, error: err.message };
  }
}

// ── Send Welcome Email (after verification) ───────────────────────────
async function sendWelcomeEmail(email, displayName) {
  const client = ensureClient();
  if (!client) return { success: false, skipped: true };

  try {
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Welcome to ${APP_NAME}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
          <div style="max-width:560px;margin:0 auto;padding:24px;">
            <div style="background:linear-gradient(135deg,#06b6d4,#10b981);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
            </div>
            <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Welcome ${displayName}!</h2>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">Your email has been verified successfully. You now have full access to:</p>
              <ul style="color:#475569;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
                <li><strong>AI-powered product recommendations</strong> tailored to your facility</li>
                <li><strong>B2B Dashboard</strong> to manage multiple facilities</li>
                <li><strong>Detailed quotations & reports</strong> with cost breakdowns</li>
                <li><strong>PDF downloads & email sharing</strong> of recommendations</li>
              </ul>
              <div style="text-align:center;margin:24px 0;">
                <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#10b981);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Go to Dashboard</a>
              </div>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">&copy; ${new Date().getFullYear()} Ganga Maxx Marketplace.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Welcome email failed:', error);
      return { success: false, error: error.message };
    }
    console.log('[Email] Welcome email sent to', email);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Welcome email error:', err);
    return { success: false, error: err.message };
  }
}

// ── Send Password Reset Email ─────────────────────────────────────────
async function sendPasswordResetEmail(email, displayName, token) {
  const client = ensureClient();
  if (!client) return { success: false, skipped: true };

  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  try {
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Reset your password - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
          <div style="max-width:560px;margin:0 auto;padding:24px;">
            <div style="background:linear-gradient(135deg,#06b6d4,#10b981);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
            </div>
            <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Hi ${displayName},</h2>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">We received a request to reset your password. Click the button below to set a new password:</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#10b981);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Reset Password</a>
              </div>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin:0 0 12px;">Or copy and paste this link:</p>
              <p style="color:#06b6d4;font-size:13px;word-break:break-all;margin:0 0 20px;background:#f1f5f9;padding:12px;border-radius:6px;">${resetUrl}</p>
              <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;">This link expires in 1 hour.</p>
              <p style="color:#94a3b8;font-size:13px;margin:0;">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">&copy; ${new Date().getFullYear()} Ganga Maxx Marketplace.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Password reset email failed:', error);
      return { success: false, error: error.message };
    }
    console.log('[Email] Password reset email sent to', email);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Password reset email error:', err);
    return { success: false, error: err.message };
  }
}

// ── Send Login Notification Email ─────────────────────────────────────
async function sendLoginNotificationEmail(email, displayName, ip, userAgent, timestamp) {
  const client = ensureClient();
  if (!client) return { success: false, skipped: true };

  try {
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `New sign-in to your account - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
          <div style="max-width:560px;margin:0 auto;padding:24px;">
            <div style="background:linear-gradient(135deg,#06b6d4,#10b981);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
            </div>
            <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Hi ${displayName},</h2>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">A new sign-in was detected on your account:</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
                <tr><td style="padding:8px 12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Time</td><td style="padding:8px 12px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${timestamp}</td></tr>
                <tr><td style="padding:8px 12px;color:#64748b;border-bottom:1px solid #e2e8f0;">IP Address</td><td style="padding:8px 12px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${ip || 'Unknown'}</td></tr>
                <tr><td style="padding:8px 12px;color:#64748b;">Browser</td><td style="padding:8px 12px;color:#1e293b;font-weight:500;">${userAgent || 'Unknown'}</td></tr>
              </table>
              <p style="color:#475569;font-size:14px;line-height:1.5;margin:16px 0 0;">If this was you, no action is needed. If you don't recognize this activity, please <a href="${APP_URL}/reset-password" style="color:#06b6d4;">reset your password</a> immediately.</p>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">&copy; ${new Date().getFullYear()} Ganga Maxx Marketplace.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Login notification failed:', error);
      return { success: false, error: error.message };
    }
    console.log('[Email] Login notification sent to', email);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Login notification error:', err);
    return { success: false, error: err.message };
  }
}

// ── Send Signup Confirmation Email (immediately after account creation) ─
async function sendSignupConfirmationEmail(email, displayName) {
  const client = ensureClient();
  if (!client) return { success: false, skipped: true };

  try {
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Account created successfully - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
          <div style="max-width:560px;margin:0 auto;padding:24px;">
            <div style="background:linear-gradient(135deg,#06b6d4,#10b981);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
            </div>
            <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Welcome ${displayName}!</h2>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">Your account has been created successfully on <strong>${APP_NAME}</strong>.</p>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">Please check your inbox for a verification email to verify your email address. Once verified, you can:</p>
              <ul style="color:#475569;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
                <li>Get <strong>AI-powered cleaning product recommendations</strong> tailored to your facility</li>
                <li>Access the <strong>B2B Dashboard</strong> to manage multiple facilities</li>
                <li>View <strong>detailed quotations & reports</strong> with cost breakdowns</li>
                <li>Download <strong>PDF reports & share via email</strong></li>
              </ul>
              <div style="text-align:center;margin:24px 0;">
                <a href="${APP_URL}/login" style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#10b981);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Go to Login</a>
              </div>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">&copy; ${new Date().getFullYear()} Ganga Maxx Marketplace.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Signup confirmation email failed:', error);
      return { success: false, error: error.message };
    }
    console.log('[Email] Signup confirmation email sent to', email);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Signup confirmation email error:', err);
    return { success: false, error: err.message };
  }
}

// ── Send Google Welcome Email (after first Google Sign-In) ────────────
async function sendGoogleWelcomeEmail(email, displayName) {
  const client = ensureClient();
  if (!client) return { success: false, skipped: true };

  try {
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Welcome to ${APP_NAME} (Google Account)`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
          <div style="max-width:560px;margin:0 auto;padding:24px;">
            <div style="background:linear-gradient(135deg,#06b6d4,#10b981);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
            </div>
            <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Welcome ${displayName}!</h2>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">You've successfully signed in with Google. Your account is ready to use with no additional verification needed.</p>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">Get started by creating your first facility profile and receiving AI-powered cleaning product recommendations.</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${APP_URL}/form" style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#10b981);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Create Your First Facility</a>
              </div>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">&copy; ${new Date().getFullYear()} Ganga Maxx Marketplace.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Google welcome email failed:', error);
      return { success: false, error: error.message };
    }
    console.log('[Email] Google welcome email sent to', email);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Google welcome email error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendSignupConfirmationEmail,
  sendPasswordResetEmail,
  sendLoginNotificationEmail,
  sendGoogleWelcomeEmail,
};
