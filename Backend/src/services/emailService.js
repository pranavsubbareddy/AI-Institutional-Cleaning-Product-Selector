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

// ── Shared email HTML wrapper for professional branded emails ──────────
function emailLayout(bodyContent) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f6f9;-webkit-font-smoothing:antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;min-height:100%;">
        <tr><td align="center" style="padding:32px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#0891b2,#059669);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
                <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:14px;line-height:56px;margin-bottom:12px;">
                  <span style="font-size:26px;color:#fff;">🧼</span>
                </div>
                <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${APP_NAME}</h1>
                <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">AI-Powered Cleaning Solutions</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="background:#ffffff;padding:36px 32px;border-radius:0 0 16px 16px;box-shadow:0 4px 16px rgba(0,0,0,0.06),0 1px 3px rgba(0,0,0,0.04);">
                ${bodyContent}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 0 0;text-align:center;">
                <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="padding:0 8px;">
                      <a href="${APP_URL}" style="color:#94a3b8;font-size:12px;text-decoration:none;">Website</a>
                    </td>
                    <td style="padding:0 8px;">
                      <span style="color:#cbd5e1;font-size:12px;">|</span>
                    </td>
                    <td style="padding:0 8px;">
                      <a href="${APP_URL}/contact" style="color:#94a3b8;font-size:12px;text-decoration:none;">Contact</a>
                    </td>
                    <td style="padding:0 8px;">
                      <span style="color:#cbd5e1;font-size:12px;">|</span>
                    </td>
                    <td style="padding:0 8px;">
                      <a href="${APP_URL}/privacy" style="color:#94a3b8;font-size:12px;text-decoration:none;">Privacy</a>
                    </td>
                  </tr>
                </table>
                <p style="color:#94a3b8;font-size:12px;margin:12px 0 0;">&copy; ${new Date().getFullYear()} Ganga Maxx Marketplace. All rights reserved.</p>
                <p style="color:#cbd5e1;font-size:11px;margin:8px 0 0;">Ganga Maxx AI Cleaning Selector — Smart cleaning, simplified.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

// ── Reusable button component ──────────────────────────────────────────
function emailButton(text, url) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
      <tr>
        <td style="background:linear-gradient(135deg,#0891b2,#059669);border-radius:10px;text-align:center;">
          <a href="${url}" style="display:inline-block;padding:14px 36px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:10px;letter-spacing:0.2px;">${text}</a>
        </td>
      </tr>
    </table>
  `;
}

// ── Reusable fallback link box ─────────────────────────────────────────
function emailFallbackLink(url) {
  return `
    <p style="color:#64748b;font-size:13px;line-height:1.5;margin:8px 0 16px;">Or copy and paste this link in your browser:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f1f5f9;border-radius:8px;margin:0 0 20px;">
      <tr><td style="padding:12px 16px;word-break:break-all;color:#0891b2;font-size:12px;line-height:1.5;">${url}</td></tr>
    </table>
  `;
}

// ── Reusable greeting ──────────────────────────────────────────────────
function emailGreeting(displayName) {
  return `<h2 style="color:#1e293b;font-size:20px;margin:0 0 6px;font-weight:700;">Hi ${displayName || 'there'},</h2>`;
}

// ── Reusable expiry note ───────────────────────────────────────────────
function emailExpiryNote(text) {
  return `<p style="color:#94a3b8;font-size:13px;margin:0 0 4px;">${text}</p>`;
}

// ── Reusable ignore warning ────────────────────────────────────────────
const EMAIL_IGNORE_WARNING = `<p style="color:#94a3b8;font-size:13px;margin:0;">If you didn't request this email, you can safely ignore it.</p>`;

// ── Reusable divider ───────────────────────────────────────────────────
const EMAIL_DIVIDER = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;

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
      html: emailLayout(`
        ${emailGreeting(displayName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Thanks for creating an account! Please verify your email address by clicking the button below to activate your account and start using our AI-powered cleaning recommendations.</p>
        ${emailButton('Verify Email Address', verifyUrl)}
        ${EMAIL_DIVIDER}
        <p style="color:#64748b;font-size:14px;margin:0 0 4px;font-weight:600;">Link didn't work?</p>
        ${emailFallbackLink(verifyUrl)}
        ${emailExpiryNote('This verification link expires in 24 hours.')}
        ${EMAIL_IGNORE_WARNING}
      `),
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
      html: emailLayout(`
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;width:64px;height:64px;background:linear-gradient(135deg,#dbeafe,#bbf7d0);border-radius:50%;line-height:64px;font-size:30px;">🎉</div>
        </div>
        ${emailGreeting(displayName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Your email has been verified successfully! You now have full access to our platform. Here's what you can do:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;">
          <tr>
            <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:8px;display:block;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:18px;padding-right:12px;vertical-align:top;">🤖</td>
                  <td><p style="color:#475569;font-size:14px;line-height:1.5;margin:0;"><strong>AI Recommendations</strong> — Get smart product suggestions tailored to your facility</p></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:8px;display:block;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:18px;padding-right:12px;vertical-align:top;">📊</td>
                  <td><p style="color:#475569;font-size:14px;line-height:1.5;margin:0;"><strong>B2B Dashboard</strong> — Manage multiple facilities from one place</p></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:8px;display:block;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:18px;padding-right:12px;vertical-align:top;">📄</td>
                  <td><p style="color:#475569;font-size:14px;line-height:1.5;margin:0;"><strong>Quotations & Reports</strong> — View detailed cost breakdowns and download PDFs</p></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${emailButton('Go to Dashboard', `${APP_URL}/dashboard`)}
      `),
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

// ── Send Password Reset OTP Email ───────────────────────────────────────
async function sendPasswordResetOTPEmail(email, displayName, otp) {
  const client = ensureClient();
  if (!client) return { success: false, skipped: true };

  // Resend template ID - uses env var if set, otherwise uses the configured template
  const templateId = process.env.OTP_TEMPLATE_ID || '369b3529-5fed-4b2b-a014-a425ccfdfa74';

  try {
    let sendParams = {
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Your password reset OTP - ${APP_NAME}`,
    };

    if (templateId) {
      // Use the template from Resend dashboard
      sendParams.template = {
        id: templateId,
        variables: {
          app_name: APP_NAME,
          display_name: displayName || 'there',
          otp_code: otp,
          expiry_minutes: '10',
        },
      };
    } else {
      // Fallback: inline HTML
      const otpDigits = otp.split('').map(d =>
        `<td style="width:48px;height:56px;background:linear-gradient(135deg,#1e293b,#334155);border-radius:10px;text-align:center;font-size:28px;font-weight:800;color:#ffffff;font-family:monospace;letter-spacing:0;padding:0;">${d}</td>`
      ).join('<td style="width:8px;padding:0;"></td>');

      sendParams.html = emailLayout(`
        ${emailGreeting(displayName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">We received a request to reset your password. Use the following one-time code to proceed:</p>
        <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
          <tr>${otpDigits}</tr>
        </table>
        <p style="color:#475569;font-size:14px;line-height:1.6;text-align:center;margin:0 0 16px;">Enter this code on the password reset page to set a new password.</p>
        ${EMAIL_DIVIDER}
        ${emailExpiryNote('This OTP expires in 10 minutes.')}
        <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">If you didn't request a password reset, you can safely ignore this email.</p>
      `);
    }

    const { data, error } = await client.emails.send(sendParams);

    if (error) {
      console.error('[Email] Password reset OTP email failed:', error);
      return { success: false, error: error.message };
    }
    console.log('[Email] Password reset OTP email sent to', email, templateId ? '(via template)' : '(inline)');
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Password reset OTP email error:', err);
    return { success: false, error: err.message };
  }
}

// ── Send Password Reset Email (legacy link-based) ─────────────────────────
async function sendPasswordResetEmail(email, displayName, token) {
  const client = ensureClient();
  if (!client) return { success: false, skipped: true };

  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  try {
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Reset your password - ${APP_NAME}`,
      html: emailLayout(`
        ${emailGreeting(displayName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">We received a request to reset your password. Click the button below to set a new password:</p>
        ${emailButton('Reset Password', resetUrl)}
        ${EMAIL_DIVIDER}
        <p style="color:#64748b;font-size:14px;margin:0 0 4px;font-weight:600;">Button not working?</p>
        ${emailFallbackLink(resetUrl)}
        ${emailExpiryNote('This reset link expires in 1 hour.')}
        ${EMAIL_IGNORE_WARNING}
      `),
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
      html: emailLayout(`
        ${emailGreeting(displayName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">A new sign-in was detected on your account. Here are the details:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px;background:#f8fafc;border-radius:8px;">
          <tr>
            <td style="padding:12px 16px;color:#64748b;border-bottom:1px solid #e2e8f0;width:100px;">Time</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:600;border-bottom:1px solid #e2e8f0;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#64748b;border-bottom:1px solid #e2e8f0;">IP Address</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:600;border-bottom:1px solid #e2e8f0;">${ip || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#64748b;">Device</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:600;">${userAgent || 'Unknown'}</td>
          </tr>
        </table>
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 4px;">If this was you, no action is needed.</p>
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">If you don't recognize this activity, please <a href="${APP_URL}/forgot-password" style="color:#0891b2;font-weight:600;text-decoration:underline;">reset your password</a> immediately.</p>
      `),
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
      html: emailLayout(`
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;width:64px;height:64px;background:linear-gradient(135deg,#dbeafe,#bbf7d0);border-radius:50%;line-height:64px;font-size:30px;">✅</div>
        </div>
        ${emailGreeting(displayName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 6px;">Your account has been created successfully on <strong>${APP_NAME}</strong>.</p>
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">Please check your inbox for a <strong>verification email</strong> to activate your account. Once verified, you can enjoy:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;">
          <tr>
            <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:8px;display:block;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:16px;padding-right:10px;vertical-align:top;">🤖</td>
                  <td><p style="color:#475569;font-size:14px;line-height:1.5;margin:0;"><strong>AI-powered product recommendations</strong> tailored to your facility</p></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:8px;display:block;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:16px;padding-right:10px;vertical-align:top;">📊</td>
                  <td><p style="color:#475569;font-size:14px;line-height:1.5;margin:0;"><strong>B2B Dashboard</strong> to manage multiple facilities</p></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:8px;display:block;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:16px;padding-right:10px;vertical-align:top;">📄</td>
                  <td><p style="color:#475569;font-size:14px;line-height:1.5;margin:0;"><strong>Detailed quotations & reports</strong> with cost breakdowns</p></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${emailButton('Go to Login', `${APP_URL}/login`)}
      `),
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
      html: emailLayout(`
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;width:64px;height:64px;background:linear-gradient(135deg,#fef3c7,#fed7aa);border-radius:50%;line-height:64px;font-size:30px;">🔑</div>
        </div>
        ${emailGreeting(displayName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 6px;">You've successfully signed in with <strong>Google</strong>! Your account is ready to use with no additional verification needed.</p>
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Get started by creating your first facility profile and receiving AI-powered cleaning product recommendations.</p>
        ${emailButton('Create Your First Facility', `${APP_URL}/form`)}
      `),
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
  sendPasswordResetOTPEmail,
  sendPasswordResetEmail,
  sendLoginNotificationEmail,
  sendGoogleWelcomeEmail,
};
