import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

// Only rendered by the parent when balance > 0 - fetches the
// Gemini-drafted WhatsApp-style message on demand (not preloaded with
// the customer, since it's a deliberate action, not part of page load).
export default function AiReminderPanel({ customerId, phone, email }) {
  const { t } = useTranslation();
  const CHANNEL_LABELS = { sms: t('udhaar.reminder.channelSms'), email: t('udhaar.reminder.channelEmail') };

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [channelResults, setChannelResults] = useState(null);

  const hasContactInfo = Boolean((phone && phone.trim()) || (email && email.trim()));

  async function handleFetch() {
    setLoading(true);
    setError('');
    setCopied(false);
    setChannelResults(null);
    setSendError('');
    try {
      const data = await api.get(`/api/udhaar/customers/${customerId}/reminder`);
      setMessage(data.message);
    } catch (err) {
      setError(err.message || t('udhaar.reminder.draftError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('udhaar.reminder.copyError'));
    }
  }

  async function handleSend() {
    setSending(true);
    setSendError('');
    setChannelResults(null);
    try {
      const data = await api.post(`/api/udhaar/customers/${customerId}/send-reminder`, {});
      setMessage(data.message || message);
      setChannelResults(data.channels || {});
    } catch (err) {
      setChannelResults((err.data && err.data.channels) || null);
      setSendError(err.message || t('udhaar.reminder.sendError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-surface-500/60 bg-surface-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-700">{t('udhaar.reminder.title')}</p>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t('udhaar.reminder.drafting') : message ? t('udhaar.reminder.refresh') : t('udhaar.reminder.generate')}
        </button>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          <span className="block h-4 w-full animate-pulse rounded bg-surface-300" />
          <span className="block h-4 w-2/3 animate-pulse rounded bg-surface-300" />
        </div>
      ) : error ? (
        <p className="mt-3 text-xs font-medium text-danger">{error}</p>
      ) : message ? (
        <div className="mt-3">
          <p className="whitespace-pre-line rounded-lg bg-white p-3 text-sm text-slate-700 shadow-sm">{message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopy}
              className="rounded-lg border border-surface-500 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary"
            >
              {copied ? t('udhaar.reminder.copied') : t('udhaar.reminder.copy')}
            </button>

            {hasContactInfo ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="rounded-lg bg-accent-green px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? t('udhaar.reminder.sending') : t('udhaar.reminder.send')}
              </button>
            ) : (
              <p className="text-xs font-medium text-danger">
                {t('udhaar.reminder.noContactInfo')}
              </p>
            )}
          </div>

          {sendError && <p className="mt-2 text-xs font-medium text-danger">{sendError}</p>}

          {channelResults && Object.keys(channelResults).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(channelResults).map(([channel, result]) => (
                <p
                  key={channel}
                  className={`text-xs font-medium ${result.success ? 'text-accent-green' : 'text-danger'}`}
                >
                  {CHANNEL_LABELS[channel] || channel}:{' '}
                  {result.success ? t('udhaar.reminder.sent') : t('udhaar.reminder.failed', { error: result.error })}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : !hasContactInfo ? (
        <p className="mt-2 text-xs text-muted">
          {t('udhaar.reminder.hintNoContact')}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">{t('udhaar.reminder.hint')}</p>
      )}
    </div>
  );
}