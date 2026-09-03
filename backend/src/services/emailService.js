/**
 * Sends udhaar reminder emails via the Gmail API directly (not SMTP).
 *
 * We deliberately avoid SMTP/nodemailer here: Saarthi.ai deploys on
 * platforms that block outbound SMTP ports (25/465/587), while the
 * Gmail API is a plain HTTPS call and works everywhere. We authenticate
 * as GMAIL_SENDER_EMAIL using a long-lived OAuth refresh token (minted
 * once via the Gmail send scope) and exchange it for a short-lived
 * access token on every send via google-auth-library's OAuth2Client.
 *
 * GOLDEN RULE: like smsService, this module never throws into the
 * caller for delivery failures (bad token, Gmail API error, network
 * issue) - it always resolves to { success, error }.
 */

const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

function getOAuth2Client() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return null;
  }

  const oAuth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oAuth2Client;
}

/** Base64url-encodes a Buffer/string the way the Gmail API expects for `raw`. */
function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wraps a plain-text reminder body in a small branded HTML shell.
 * Kept intentionally simple - inline styles only, no external assets,
 * single column, so it renders consistently across Gmail/Outlook/mobile
 * mail clients instead of relying on a stylesheet many clients strip.
 */
function renderReminderEmailHtml({ shopName, customerName, balance, message }) {
  const safeShop = escapeHtml(shopName || 'Saarthi.ai');
  const safeCustomer = escapeHtml(customerName || '');
  const safeMessage = escapeHtml(message || '').replace(/\n/g, '<br/>');
  const balanceText =
    typeof balance === 'number'
      ? `₹${Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
      : null;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef6ff;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef6ff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 6px 20px rgba(37,99,235,0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb,#0891b2);padding:24px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:34px;height:34px;background:rgba(255,255,255,0.18);border-radius:9px;text-align:center;vertical-align:middle;font-size:16px;">🏪</td>
                    <td style="padding-left:10px;color:#ffffff;font-size:16px;font-weight:800;letter-spacing:-0.2px;">Saarthi.ai</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:#0891b2;">Udhaar Reminder</p>
                <h1 style="margin:8px 0 0;font-size:20px;line-height:1.35;color:#0f172a;font-weight:800;">
                  ${safeCustomer ? `Hi ${safeCustomer},` : 'Payment reminder'}
                </h1>
              </td>
            </tr>
            ${
              balanceText
                ? `<tr>
              <td style="padding:16px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fbff;border:1px solid #dbe6f7;border-radius:14px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0;font-size:11px;font-weight:700;color:#5c6c86;text-transform:uppercase;letter-spacing:0.3px;">Outstanding balance</p>
                      <p style="margin:4px 0 0;font-size:26px;font-weight:800;color:#0f172a;">${balanceText}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding:20px 28px 0;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">${safeMessage}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#8a97ac;">
                  This is an automated reminder sent by ${safeShop} via Saarthi.ai. If you've already paid, please ignore this message.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f7fbff;border-top:1px solid #eaf2ff;">
                <p style="margin:0;font-size:11px;color:#8a97ac;">Sent with Saarthi.ai &middot; Shop management, simplified</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Shared branded shell (header + footer) so the OTP and password-reset
 * emails look like they come from the same product as the reminder
 * email, instead of falling back to a bare plain-text message.
 */
function renderEmailShell({ eyebrow, heading, bodyHtml, highlightHtml, shopName }) {
  const safeShop = escapeHtml(shopName || 'Saarthi.ai');
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef6ff;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef6ff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 6px 20px rgba(37,99,235,0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb,#0891b2);padding:24px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:34px;height:34px;background:rgba(255,255,255,0.18);border-radius:9px;text-align:center;vertical-align:middle;font-size:16px;">🏪</td>
                    <td style="padding-left:10px;color:#ffffff;font-size:16px;font-weight:800;letter-spacing:-0.2px;">${safeShop}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:#0891b2;">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:8px 0 0;font-size:20px;line-height:1.35;color:#0f172a;font-weight:800;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            ${highlightHtml || ''}
            <tr>
              <td style="padding:20px 28px 0;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">${bodyHtml}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#8a97ac;">
                  If you didn't request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f7fbff;border-top:1px solid #eaf2ff;">
                <p style="margin:0;font-size:11px;color:#8a97ac;">Sent with Saarthi.ai &middot; Shop management, simplified</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Branded HTML for the signup verification OTP email - the code is
 * shown as a large, letter-spaced pill so it's easy to read and copy. */
function renderOtpEmailHtml({ shopName, otp }) {
  const highlightHtml = `<tr>
    <td style="padding:16px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fbff;border:1px solid #dbe6f7;border-radius:14px;">
        <tr>
          <td style="padding:18px 20px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#5c6c86;text-transform:uppercase;letter-spacing:0.3px;">Your verification code</p>
            <p style="margin:6px 0 0;font-size:32px;font-weight:800;letter-spacing:8px;color:#0f172a;">${escapeHtml(otp)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
  return renderEmailShell({
    eyebrow: 'Verify your email',
    heading: 'One step to activate your shop',
    bodyHtml: 'Enter this code in Saarthi.ai to finish setting up your shop. It expires in 10 minutes.',
    highlightHtml,
    shopName,
  });
}

/** Branded HTML for the "reset your password" email - the link is a
 * real button instead of a bare URL string. */
function renderPasswordResetEmailHtml({ shopName, resetUrl }) {
  const highlightHtml = `<tr>
    <td style="padding:20px 28px 0;text-align:center;">
      <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Reset password</a>
    </td>
  </tr>`;
  return renderEmailShell({
    eyebrow: 'Password reset',
    heading: 'Reset your Saarthi.ai password',
    bodyHtml: 'We received a request to reset your password. This link is valid for 1 hour. If the button above doesn\'t work, ' +
      `copy this link into your browser: <br/><span style="word-break:break-all;color:#2563eb;">${escapeHtml(resetUrl)}</span>`,
    highlightHtml,
    shopName,
  });
}

/**
 * Builds a multipart/alternative RFC 2822 MIME message (plain text +
 * HTML), so clients that render HTML show the branded template while
 * anything that can't (or that strips HTML) still gets the readable
 * plain-text body.
 */
function buildMimeMessage({ from, to, subject, body, html }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
    'MIME-Version: 1.0',
  ];

  if (!html) {
    headers.push('Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 7bit');
    return `${headers.join('\r\n')}\r\n\r\n${body}`;
  }

  const boundary = `saarthi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return `${headers.join('\r\n')}\r\n\r\n${parts}`;
}

/**
 * Sends an udhaar reminder email. `body` is the plain-text message
 * (also used for SMS by the caller); when `templateData` is passed, a
 * matching branded HTML alternative is generated and attached too.
 * @param {string} to - recipient email address
 * @param {string} subject
 * @param {string} body - plain text message
 * @param {{shopName?: string, customerName?: string, balance?: number}} [templateData]
 * @returns {Promise<{success: boolean, error?: string, messageId?: string}>}
 */
async function sendEmail(to, subject, body, templateData) {
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;

  if (!senderEmail) {
    return { success: false, error: 'Email is not configured (missing GMAIL_SENDER_EMAIL)' };
  }
  if (!to || !String(to).trim()) {
    return { success: false, error: 'No email address on file' };
  }

  const oAuth2Client = getOAuth2Client();
  if (!oAuth2Client) {
    return { success: false, error: 'Email is not configured (missing Google OAuth credentials)' };
  }

  try {
    // Exchanges the refresh token for a fresh short-lived access token.
    const { token } = await oAuth2Client.getAccessToken();
    if (!token) {
      return { success: false, error: 'Could not obtain a Gmail access token' };
    }
    oAuth2Client.setCredentials({ access_token: token });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    let html = null;
    if (templateData) {
      if (templateData.type === 'otp') html = renderOtpEmailHtml(templateData);
      else if (templateData.type === 'reset') html = renderPasswordResetEmailHtml(templateData);
      else html = renderReminderEmailHtml({ ...templateData, message: body });
    }

    const raw = toBase64Url(
      buildMimeMessage({ from: senderEmail, to: String(to).trim(), subject, body, html })
    );

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { success: true, messageId: result.data?.id || null };
  } catch (err) {
    const detail = err?.response?.data?.error?.message || err.message || 'Unknown Gmail API error';
    console.error('sendEmail error:', detail);
    return { success: false, error: `Could not send email: ${detail}` };
  }
}

module.exports = { sendEmail, renderReminderEmailHtml, renderOtpEmailHtml, renderPasswordResetEmailHtml };
