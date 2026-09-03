import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';

// Lightweight scroll-reveal wrapper (IntersectionObserver, fires once).
// Keeps the animation CSS-driven (see .reveal / .reveal-visible in
// index.css) so there's no animation library dependency to add.
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function BrandMark({ size = 38 }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-xl bg-brand-mark shadow-lifted"
      style={{ width: size, height: size, transform: 'perspective(300px) rotateX(6deg) rotateY(-6deg)' }}
    >
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
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
  );
}

export default function Landing() {
  const { t } = useTranslation();

  const FEATURES = [
    { titleKey: 'landing.feature1Title', bodyKey: 'landing.feature1Body', bg: 'linear-gradient(150deg,#93c5fd,#2563eb)', icon: (
      <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" stroke="#fff" strokeWidth="2" fill="none" />
    ) },
    { titleKey: 'landing.feature2Title', bodyKey: 'landing.feature2Body', bg: 'linear-gradient(150deg,#67e8f9,#0891b2)', icon: (
      <>
        <path d="M3 3v18h18" stroke="#fff" strokeWidth="2" fill="none" />
        <path d="M7 15l4-5 3 3 5-7" stroke="#fff" strokeWidth="2" fill="none" />
      </>
    ) },
    { titleKey: 'landing.feature3Title', bodyKey: 'landing.feature3Body', bg: 'linear-gradient(150deg,#fbbf24,#d97706)', icon: (
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="#fff" strokeWidth="2" fill="none" />
    ) },
    { titleKey: 'landing.feature4Title', bodyKey: 'landing.feature4Body', bg: 'linear-gradient(150deg,#c4b5fd,#7c3aed)', icon: (
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="#fff" strokeWidth="2" fill="none" />
    ) },
  ];

  const STEPS = [
    { num: 1, titleKey: 'landing.step1Title', bodyKey: 'landing.step1Body' },
    { num: 2, titleKey: 'landing.step2Title', bodyKey: 'landing.step2Body' },
    { num: 3, titleKey: 'landing.step3Title', bodyKey: 'landing.step3Body' },
  ];

  return (
    <div className="bg-ambient min-h-screen overflow-hidden">
      {/* decorative blurred blobs + real 3D-animated shapes (see index.css) */}
      <div className="blob blob-blue h-[520px] w-[520px] -right-36 -top-44 animate-drift" />
      <div className="blob blob-cyan h-[420px] w-[420px] -left-32 -bottom-40 animate-drift" style={{ animationDirection: 'reverse' }} />
      <div className="deco-coin absolute right-10 top-24 hidden lg:flex">₹</div>
      <div className="deco-cube absolute right-24 top-56 hidden lg:block" />
      <div className="deco-pill absolute left-16 top-40 hidden h-4 w-14 bg-gradient-to-r from-accent to-primary opacity-70 lg:block" />

      <div className="relative z-10">
        {/* Nav */}
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-lg font-extrabold tracking-tight text-slate-900">Saarthi.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="hidden rounded-lg border border-primary/15 bg-white/80 px-4 py-2 text-sm font-bold text-slate-800 shadow-soft sm:block"
            >
              {t('landing.navLogin')}
            </Link>
            <Link
              to="/auth"
              className="rounded-lg bg-cta-gradient px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5"
            >
              {t('landing.navStart')}
            </Link>
          </div>
        </div>

        {/* Hero */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div className="rise-in">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-surface-300 px-3.5 py-1.5 text-xs font-bold text-primary">
              {t('landing.heroEyebrow')}
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
              <span className="text-gradient">{t('landing.heroTitleA')}</span> {t('landing.heroTitleB')}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">{t('landing.heroSubtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="rounded-xl bg-cta-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5"
              >
                {t('landing.ctaPrimary')}
              </Link>
              <Link
                to="/auth"
                className="rounded-xl border border-primary/15 bg-white/80 px-6 py-3.5 text-sm font-bold text-slate-800 shadow-soft"
              >
                {t('landing.ctaSecondary')}
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-7 text-xs font-semibold text-muted-light">
              <div>
                <b className="block text-lg font-extrabold text-slate-900">12,000+</b>
                {t('landing.trustShops')}
              </div>
              <div>
                <b className="block text-lg font-extrabold text-slate-900">₹85Cr+</b>
                {t('landing.trustSales')}
              </div>
              <div>
                <b className="block text-lg font-extrabold text-slate-900">4.8★</b>
                {t('landing.trustRating')}
              </div>
            </div>
          </div>

          <div className="relative h-[440px]">
            <div className="tilt-card absolute left-[8%] top-6 w-[84%] rounded-3xl border border-primary/10 bg-white p-5 shadow-lifted">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger-light/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning-light/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-green/50" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-light">{t('landing.mockToday')}</span>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-surface-100 to-surface-600 p-2.5">
                  <p className="text-[10px] font-bold text-muted">{t('landing.mockSales')}</p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">₹4,250</p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-surface-100 to-surface-600 p-2.5">
                  <p className="text-[10px] font-bold text-muted">{t('landing.mockStock')}</p>
                  <p className="mt-1 text-sm font-extrabold text-warning">3 {t('landing.mockLow')}</p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-surface-100 to-surface-600 p-2.5">
                  <p className="text-[10px] font-bold text-muted">{t('landing.mockUdhaar')}</p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">₹1,800</p>
                </div>
              </div>
              <div className="h-28 rounded-xl border border-primary/10 bg-gradient-to-b from-surface-300 to-surface-50 p-2">
                <svg viewBox="0 0 300 110" preserveAspectRatio="none" className="h-full w-full">
                  <path
                    d="M0,90 L40,70 L80,78 L120,50 L160,58 L200,30 L240,38 L300,10"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0,90 L40,70 L80,78 L120,50 L160,58 L200,30 L240,38 L300,10 L300,110 L0,110 Z"
                    fill="#2563eb"
                    opacity="0.12"
                  />
                </svg>
              </div>
            </div>

            {/* AI-logging bubble: quietly proves "type your sale in plain
                English" from the hero copy, instead of leaving it just a
                claim. Animates in once (rise-in) rather than looping, so
                it stays a nice touch instead of a distraction. */}
            <div
              className="rise-in absolute -bottom-2 left-0 w-[78%] rounded-2xl border border-primary/10 bg-white p-4 shadow-lifted sm:w-64"
              style={{ animationDelay: '0.5s' }}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cta-gradient text-[10px] font-extrabold text-white">
                  AI
                </span>
                <span className="text-xs font-bold text-slate-800">{t('landing.mockBubbleTitle')}</span>
              </div>
              <p className="mt-2 rounded-lg bg-surface-200 px-3 py-2 text-xs font-medium text-slate-700">
                {t('landing.mockBubbleBody')}
              </p>
              <div className="mt-2 flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
              </div>
            </div>

            <div className="deco-cube absolute right-2 top-2" />
            <div className="deco-coin absolute -right-2 bottom-32">₹</div>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="mx-auto max-w-6xl px-6 py-16">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-surface-300 px-3.5 py-1.5 text-xs font-bold text-primary">
              {t('landing.featuresEyebrow')}
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t('landing.featuresTitle')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t('landing.featuresSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.titleKey} delay={i * 90}>
                <div className="group h-full rounded-2xl border border-primary/10 bg-white/80 p-6 shadow-soft transition hover:-translate-y-1.5 hover:shadow-lifted">
                  <div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-md transition group-hover:-rotate-6 group-hover:scale-110"
                    style={{ background: f.bg }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                      {f.icon}
                    </svg>
                  </div>
                  <h3 className="mb-1.5 text-sm font-bold text-slate-900">{t(f.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-muted">{t(f.bodyKey)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div id="how" className="mx-auto max-w-6xl px-6 py-16">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-surface-300 px-3.5 py-1.5 text-xs font-bold text-primary">
              {t('landing.howEyebrow')}
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t('landing.howTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.num} delay={i * 120} className="text-center">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-step-num text-sm font-extrabold text-white shadow-lg shadow-primary/40 animate-pulse-slow">
                  {s.num}
                </div>
                <h4 className="mb-1.5 text-sm font-bold text-slate-900">{t(s.titleKey)}</h4>
                <p className="mx-auto max-w-[230px] text-sm leading-relaxed text-muted">{t(s.bodyKey)}</p>
              </Reveal>
            ))}
          </div>
        </div>

        {/* CTA strip */}
        <div className="mx-auto max-w-6xl px-6 pb-16">
          <Reveal>
            <div className="flex flex-col items-center justify-between gap-5 rounded-3xl bg-cta-gradient-deep px-8 py-11 text-white shadow-lifted sm:flex-row">
              <div>
                <h2 className="font-display text-2xl font-bold">{t('landing.ctaTitle')}</h2>
                <p className="mt-1.5 max-w-md text-sm text-blue-100">{t('landing.ctaBody')}</p>
              </div>
              <Link
                to="/auth"
                className="whitespace-nowrap rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-primary-hover shadow-lg transition hover:-translate-y-0.5 hover:scale-105"
              >
                {t('landing.ctaButton')}
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Footer */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 pb-10 text-xs font-semibold text-muted-light">
          <span>© 2026 Saarthi.ai</span>
          <span>{t('landing.footerTag')}</span>
        </div>
      </div>
    </div>
  );
}