/**
 * Thin wrapper around the TextBee REST API (turns an Android phone into
 * an SMS gateway - see https://textbee.dev/docs). Used to deliver udhaar
 * reminders over SMS.
 *
 * GOLDEN RULE: this module never throws into the caller for anything
 * that isn't a programmer error (missing config). Any failure to
 * actually deliver the SMS - device offline, unreachable, bad number,
 * TextBee API error, network timeout - is caught and returned as a
 * { success: false, error } result so a flaky phone/gateway can never
 * crash the request that triggered it.
 */

const TEXTBEE_BASE_URL = 'https://api.textbee.dev/api/v1/gateway';
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Sends a single SMS via the configured TextBee device.
 * @param {string} phone - recipient phone number
 * @param {string} message - message body
 * @returns {Promise<{success: boolean, error?: string, smsId?: string}>}
 */
async function sendSms(phone, message) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  if (!apiKey || !deviceId) {
    return { success: false, error: 'SMS is not configured (missing TextBee credentials)' };
  }

  if (!phone || !String(phone).trim()) {
    return { success: false, error: 'No phone number on file' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${TEXTBEE_BASE_URL}/devices/${deviceId}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        recipients: [String(phone).trim()],
        message,
      }),
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // TextBee usually returns JSON, but don't crash if it doesn't.
    }

    if (!res.ok) {
      // Device offline/unreachable typically comes back as a 4xx/5xx here.
      const detail = data?.message || data?.error || `TextBee responded with ${res.status}`;
      return { success: false, error: detail };
    }

    return { success: true, smsId: data?.data?.smsBatchId || data?.smsBatchId || null };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'SMS gateway timed out - device may be offline' };
    }
    console.error('sendSms error:', err.message);
    return { success: false, error: 'Could not reach the SMS gateway' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { sendSms };
