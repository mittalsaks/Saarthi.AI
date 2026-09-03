import { useTranslation } from 'react-i18next';

// Loads /api/entries/greeting on its own timeline - never blocks the
// rest of the dashboard, which renders from the fast /stats endpoint.
export default function GreetingBanner({ shopName, ownerName, message, loading, error }) {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-hidden rounded-3xl bg-cta-gradient-deep p-7 text-white shadow-lifted">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

      <p className="relative text-xs font-bold uppercase tracking-wide text-blue-100">
        {shopName || t('nav.yourShop')}
      </p>
      {loading ? (
        <div className="relative mt-3 space-y-2.5">
          <span className="block h-6 w-3/4 animate-pulse rounded bg-white/20" />
          <span className="block h-4 w-1/2 animate-pulse rounded bg-white/15" />
        </div>
      ) : error ? (
        <p className="relative mt-2 text-xl font-extrabold leading-snug">
          {t('dashboard.greetingFallback').replace('{name}', ownerName || t('dashboard.friend'))}
        </p>
      ) : (
        <p className="relative mt-2 max-w-2xl text-xl font-extrabold leading-snug">{message}</p>
      )}
    </div>
  );
}