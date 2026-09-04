import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../lib/api';
import { isLoggedIn, saveSession } from '../lib/auth';
import { syncLanguageFromUser } from '../lib/i18next.js';

const BUSINESS_TYPES = [
  { value: 'general', labelKey: 'auth.businessTypes.general' },
  { value: 'kirana', labelKey: 'auth.businessTypes.kirana' },
  { value: 'tailor', labelKey: 'auth.businessTypes.tailor' },
  { value: 'freelancer', labelKey: 'auth.businessTypes.freelancer' },
];

function FieldLabel({ children }) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-700">{children}</label>;
}

const inputClass =
  'w-full rounded-lg border border-surface-500 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-muted-light focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function GoogleAuthButton({ onSuccess, onError }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleGoogleSuccess(credentialResponse) {
    setLoading(true);
    try {
      const data = await api.post(
        '/api/auth/google',
        { idToken: credentialResponse.credential },
        { auth: false }
      );
      onSuccess(data);
    } catch (err) {
      onError(err.message || t('auth.googleErrorDefault'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <div className="flex justify-center [&>div]:w-full">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => onError(t('auth.googleErrorDefault'))}
          width="100%"
          text="continue_with"
          shape="rectangular"
        />
      </div>
    </div>
  );
}

function OrDivider() {
  const { t } = useTranslation();
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-surface-500" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-light">{t('auth.orDivider')}</span>
      <span className="h-px flex-1 bg-surface-500" />
    </div>
  );
}

function ForgotPasswordForm({ onBackToLogin }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(''); // '' | 'sending' | 'sent'
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('sending');
    try {
      await api.post('/api/auth/forgot-password', { email }, { auth: false });
      setStatus('sent');
    } catch (err) {
      setError(err.message || t('auth.forgotErrorDefault'));
      setStatus('');
    }
  }

  if (status === 'sent') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-green">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm text-muted">{t('auth.forgotSentMessage', { email })}</p>
        <button type="button" onClick={onBackToLogin} className="text-sm font-bold text-primary hover:underline">
          {t('auth.backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger-light/50 bg-danger-light/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}
      <p className="text-sm text-muted">{t('auth.forgotSubtitle')}</p>
      <div>
        <FieldLabel>{t('auth.email')}</FieldLabel>
        <input
          type="email"
          required
          className={inputClass}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-lg bg-cta-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {status === 'sending' ? t('auth.forgotButtonLoading') : t('auth.forgotButton')}
      </button>
      <button
        type="button"
        onClick={onBackToLogin}
        className="w-full text-center text-sm font-semibold text-muted hover:text-primary"
      >
        {t('auth.backToLogin')}
      </button>
    </form>
  );
}

function ResetPasswordForm({ token, onDone }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password }, { auth: false });
      setSuccess(true);
    } catch (err) {
      setError(err.message || t('auth.resetErrorDefault'));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-green">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm text-muted">{t('auth.resetSuccessMessage')}</p>
        <button type="button" onClick={onDone} className="w-full rounded-lg bg-cta-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
          {t('auth.backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger-light/50 bg-danger-light/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}
      <p className="text-sm text-muted">{t('auth.resetSubtitle')}</p>
      <div>
        <FieldLabel>{t('auth.newPassword')}</FieldLabel>
        <input
          type="password"
          required
          className={inputClass}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <FieldLabel>{t('auth.confirmPassword')}</FieldLabel>
        <input
          type="password"
          required
          className={inputClass}
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-cta-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? t('auth.resetButtonLoading') : t('auth.resetButton')}
      </button>
    </form>
  );
}

function LoginForm({ onSuccess, onForgotPassword }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/api/auth/login', { email, password }, { auth: false });
      onSuccess(data);
    } catch (err) {
      setError(err.message || t('auth.loginErrorDefault'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger-light/50 bg-danger-light/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}
      <div>
        <FieldLabel>{t('auth.email')}</FieldLabel>
        <input
          type="email"
          required
          className={inputClass}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <FieldLabel>{t('auth.password')}</FieldLabel>
          <button
            type="button"
            onClick={onForgotPassword}
            className="mb-1.5 text-xs font-bold text-primary hover:underline"
          >
            {t('auth.forgotPasswordLink')}
          </button>
        </div>
        <input
          type="password"
          required
          className={inputClass}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-cta-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? t('auth.loginButtonLoading') : t('auth.loginButton')}
      </button>
    </form>
  );
}

// Step 2 of signup: the owner has already submitted their shop/owner
// details and we've emailed them a 6-digit code. Nothing is created in
// the database until that code is verified here.
function RegisterOtpStep({ email, onVerified, onBack }) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/api/auth/register/verify-otp', { email, otp: otp.trim() }, { auth: false });
      onVerified(data);
    } catch (err) {
      setError(err.message || t('auth.otpVerifyErrorDefault'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setResendMessage('');
    setResending(true);
    try {
      await onBack(true); // re-sends the OTP using the details already filled in
      setResendMessage(t('auth.otpResendSuccess'));
    } catch (err) {
      setError(err.message || t('auth.otpSendErrorDefault'));
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger-light/50 bg-danger-light/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}
      {resendMessage && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-sm text-accent-green">
          {resendMessage}
        </div>
      )}
      <p className="text-sm text-muted">{t('auth.otpSubtitle', { email })}</p>
      <div>
        <FieldLabel>{t('auth.otpLabel')}</FieldLabel>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className={`${inputClass} text-center text-lg tracking-[0.4em]`}
          placeholder={t('auth.otpPlaceholder')}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>
      <button
        type="submit"
        disabled={loading || otp.trim().length !== 6}
        className="w-full rounded-lg bg-cta-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? t('auth.otpButtonLoading') : t('auth.otpButton')}
      </button>
      <div className="flex items-center justify-between text-xs font-semibold">
        <button type="button" onClick={() => onBack(false)} className="text-muted hover:text-primary">
          {t('auth.otpChangeDetails')}
        </button>
        <button type="button" onClick={handleResend} disabled={resending} className="text-primary hover:underline disabled:opacity-60">
          {resending ? t('auth.otpResending') : t('auth.otpResend')}
        </button>
      </div>
    </form>
  );
}

function RegisterForm({ onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    businessType: 'general',
    languagePref: 'English',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStage, setOtpStage] = useState(false); // false = details form, true = enter-code step

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function sendOtp() {
    const { confirmPassword, ...payload } = form;
    await api.post('/api/auth/register/request-otp', payload, { auth: false });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (form.password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await sendOtp();
      setOtpStage(true);
    } catch (err) {
      setError(err.message || t('auth.otpSendErrorDefault'));
    } finally {
      setLoading(false);
    }
  }

  // Called by the OTP step for both "resend" (keepStage=true, errors
  // bubble back up to be shown there) and "change details" (keepStage
  // = false, just goes back to the form).
  async function handleBackOrResend(keepStage) {
    if (!keepStage) {
      setOtpStage(false);
      return;
    }
    await sendOtp();
  }

  if (otpStage) {
    return (
      <RegisterOtpStep
        email={form.email}
        onVerified={onSuccess}
        onBack={handleBackOrResend}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger-light/50 bg-danger-light/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>{t('auth.shopName')}</FieldLabel>
          <input
            required
            className={inputClass}
            placeholder={t('auth.shopNamePlaceholder')}
            value={form.shopName}
            onChange={(e) => update('shopName', e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>{t('auth.ownerName')}</FieldLabel>
          <input
            required
            className={inputClass}
            placeholder={t('auth.ownerNamePlaceholder')}
            value={form.ownerName}
            onChange={(e) => update('ownerName', e.target.value)}
          />
        </div>
      </div>

      <div>
        <FieldLabel>{t('auth.email')}</FieldLabel>
        <input
          type="email"
          required
          className={inputClass}
          placeholder={t('auth.emailPlaceholder')}
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>{t('auth.password')}</FieldLabel>
          <input
            type="password"
            required
            className={inputClass}
            placeholder={t('auth.passwordPlaceholder')}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>{t('auth.confirmPassword')}</FieldLabel>
          <input
            type="password"
            required
            className={inputClass}
            placeholder="••••••••"
            value={form.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
          />
        </div>
      </div>

      <div>
        <FieldLabel>{t('auth.businessTypeLabel')}</FieldLabel>
        <select
          className={inputClass}
          value={form.businessType}
          onChange={(e) => update('businessType', e.target.value)}
        >
          {BUSINESS_TYPES.map((bt) => (
            <option key={bt.value} value={bt.value}>
              {t(bt.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-cta-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? t('auth.otpSendButtonLoading') : t('auth.otpSendButton')}
      </button>
    </form>
  );
}

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [resetToken, setResetToken] = useState('');
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    // A password-reset email link lands here as /auth?resetToken=...
    // Check this BEFORE the isLoggedIn redirect, so a stale session in
    // this browser doesn't skip the reset form.
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('resetToken');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setTab('reset');
      return;
    }
    if (isLoggedIn()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  function handleSuccess(data) {
    saveSession(data);
    syncLanguageFromUser(data.user);
    navigate('/dashboard', { replace: true });
  }

  function goToLogin() {
    setTab('login');
    setResetToken('');
    // Drop the resetToken query param so refreshing doesn't re-open the reset form.
    window.history.replaceState({}, '', '/auth');
  }

  const isAuthTab = tab === 'login' || tab === 'register';

  return (
    <div className="bg-ambient min-h-screen overflow-hidden lg:flex">
      <div className="blob blob-blue h-[420px] w-[420px] -right-32 -top-32 animate-drift" />
      <div className="blob blob-cyan h-[360px] w-[360px] -left-28 bottom-0 animate-drift" style={{ animationDirection: 'reverse' }} />

      {/* Left: branding / feature recap */}
      <div className="relative z-10 hidden overflow-hidden px-10 py-12 lg:flex lg:w-[42%] lg:flex-col lg:justify-between">
        <a href="/" className="relative flex w-fit items-center gap-2 text-sm font-bold text-muted hover:text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t('auth.back')}
        </a>

        <div className="relative">
          <div className="mb-8 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mark shadow-lifted"
              style={{ transform: 'perspective(300px) rotateX(6deg) rotateY(-6deg)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 10l1-6h14l1 6M4 10v9a1 1 0 001 1h14a1 1 0 001-1v-9M4 10h16"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 20v-5a1 1 0 011-1h4a1 1 0 011 1v5"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-lg font-extrabold text-slate-900">Saarthi.ai</span>
          </div>

          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
            {t('auth.heroTitleA')} <span className="text-gradient">{t('auth.heroTitleB')}</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            {t('auth.subtitle')}
          </p>

          {/* Floating profit-card + drifting decoration, so the left rail
              feels like a live product instead of a plain bullet list. */}
          <div className="relative mt-9 h-40">
            <div className="deco-pill absolute left-2 top-3 h-32 w-32 rounded-full bg-gradient-to-br from-primary/15 to-accent/10 blur-xl" />
            <div className="deco-coin absolute left-8 top-1 hidden xl:flex">₹</div>
            <div className="tilt-card absolute left-16 top-4 w-56 rounded-2xl border border-primary/10 bg-white p-4 shadow-lifted">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted">{t('auth.recapCardLabel')}</p>
                <span className="h-2 w-2 rounded-full bg-accent-green" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-900">₹6,005</p>
              <div className="mt-3 flex items-end gap-1">
                {[40, 65, 50, 80, 60, 95, 72].map((h, i) => (
                  <span
                    key={i}
                    className="w-full rounded-sm bg-gradient-to-t from-primary/25 to-primary"
                    style={{ height: `${h * 0.28}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Single, quiet trust line instead of a bullet list + testimonial
            card - the floating stat card above already does the "proof"
            job visually, so we don't need to repeat it in text. */}
        <div className="relative mt-8 flex items-center gap-2">
          <div className="flex -space-x-2">
            {['bg-primary', 'bg-accent', 'bg-brand-mark'].map((c, i) => (
              <span key={i} className={`h-6 w-6 rounded-full border-2 border-white ${c}`} />
            ))}
          </div>
          <p className="text-xs font-semibold text-muted-light">{t('auth.recapJoin')}</p>
        </div>
      </div>

      {/* Right: auth form */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <a href="/" className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-mark font-bold text-white shadow-lifted">
                S
              </span>
              <span className="text-lg font-extrabold text-slate-900">Saarthi.ai</span>
            </a>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-white/90 p-8 shadow-lifted backdrop-blur">
            {isAuthTab && (
              <div className="mb-6 flex rounded-xl bg-surface-200 p-1">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                    tab === 'login' ? 'bg-white text-primary shadow-soft' : 'text-muted hover:text-slate-700'
                  }`}
                >
                  {t('auth.loginTab')}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                    tab === 'register' ? 'bg-white text-primary shadow-soft' : 'text-muted hover:text-slate-700'
                  }`}
                >
                  {t('auth.registerTab')}
                </button>
              </div>
            )}

            <h2 className="text-xl font-extrabold text-slate-900">
              {tab === 'login' && t('auth.loginTitle')}
              {tab === 'register' && t('auth.registerTitle')}
              {tab === 'forgot' && t('auth.forgotTitle')}
              {tab === 'reset' && t('auth.resetTitle')}
            </h2>
            <p className="mt-1 mb-6 text-sm text-muted">
              {tab === 'login' && t('auth.loginSubtitle')}
              {tab === 'register' && t('auth.registerSubtitle')}
              {(tab === 'forgot' || tab === 'reset') && '\u00A0'}
            </p>

            {tab === 'login' && (
              <>
                <GoogleAuthButton onSuccess={handleSuccess} onError={setGoogleError} />
                {googleError && <p className="mt-3 text-center text-xs font-medium text-danger">{googleError}</p>}
                <OrDivider />
                <LoginForm onSuccess={handleSuccess} onForgotPassword={() => setTab('forgot')} />
              </>
            )}
            {tab === 'register' && <RegisterForm onSuccess={handleSuccess} />}
            {tab === 'forgot' && <ForgotPasswordForm onBackToLogin={goToLogin} />}
            {tab === 'reset' && <ResetPasswordForm token={resetToken} onDone={goToLogin} />}
          </div>

          {isAuthTab && (
            <p className="mt-6 text-center text-sm text-muted">
              {tab === 'login' ? (
                <>
                  {t('auth.noAccount')}{' '}
                  <button onClick={() => setTab('register')} className="font-bold text-primary hover:underline">
                    {t('auth.makeAccount')}
                  </button>
                </>
              ) : (
                <>
                  {t('auth.haveAccount')}{' '}
                  <button onClick={() => setTab('login')} className="font-bold text-primary hover:underline">
                    {t('auth.loginHere')}
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}