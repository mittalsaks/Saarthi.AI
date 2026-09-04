import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clearSession, isLoggedIn } from '../../lib/auth';
import { api } from '../../lib/api';

const NAV_LINKS = [
  {
    to: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="12" width="8" height="9" rx="2" />
        <rect x="3" y="14" width="8" height="7" rx="2" />
      </>
    ),
  },
  {
    to: '/analytics',
    labelKey: 'nav.analytics',
    icon: <path d="M3 20V10M10 20V4M17 20v-7" />,
  },
  {
    to: '/stock',
    labelKey: 'nav.stock',
    badgeKey: 'stock',
    icon: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  },
  {
    to: '/udhaar',
    labelKey: 'nav.udhaar',
    badgeKey: 'udhaar',
    icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  },
  {
    to: '/alerts',
    labelKey: 'nav.alerts',
    badgeKey: 'alerts',
    icon: <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />,
  },
  {
    to: '/reports',
    labelKey: 'nav.reports',
    icon: (
      <>
        <path d="M14 3v4a1 1 0 001 1h4" />
        <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
        <path d="M9 13h6M9 17h6M9 9h1" />
      </>
    ),
  },
];

// Small fixed decorative shapes drifting behind the whole app shell —
// purely cosmetic (pointer-events none, negative z-index), rendered once
// here since AppHeader mounts on every logged-in page. Hidden below `lg`
// alongside the sidebar so they never crowd the mobile layout.
function FloatingDecor() {
  return (
    <div aria-hidden="true" className="hidden lg:block">
      <div className="floating-shape shape-cube" />
      <div className="floating-shape shape-coin">₹</div>
      <div className="floating-shape shape-diamond" />
      <div className="floating-shape shape-ring" />
    </div>
  );
}

// Shared app shell for every logged-in page: a fixed left sidebar (brand,
// nav with live badge counts, free-plan card) plus a slim topbar (search,
// notifications, quick "new entry" link, avatar/logout). Kept as one
// component ("AppHeader") so every page gets the same shop identity + nav
// automatically. Layout note: the sidebar is `fixed`, so each page's own
// top-level wrapper adds `lg:pl-64` to sit next to it instead of under it.
export default function AppHeader({ shopName, userName }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [badges, setBadges] = useState({ stock: 0, udhaar: 0, alerts: 0 });
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return undefined;
    function handleClickOutside(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  useEffect(() => {
    if (!isLoggedIn()) return;

    api
      .get('/api/stock/alerts/low-stock')
      .then((data) => setBadges((b) => ({ ...b, stock: data.badgeCount || 0 })))
      .catch((err) => console.error('stock badge load failed:', err));

    api
      .get('/api/udhaar/summary')
      .then((data) => setBadges((b) => ({ ...b, udhaar: data.badgeCount || 0 })))
      .catch((err) => console.error('udhaar badge load failed:', err));

    api
      .get('/api/alerts/unread-count')
      .then((data) => setBadges((b) => ({ ...b, alerts: data.badgeCount || 0 })))
      .catch((err) => console.error('alerts badge load failed:', err));
  }, []);

  function handleLogout() {
    clearSession();
    navigate('/auth', { replace: true });
  }

  const initials = (userName || 'DA')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const totalBadgeCount = badges.stock + badges.udhaar + badges.alerts;

  return (
    <>
      <FloatingDecor />

      {/* ---- Sidebar (fixed, full height, hidden on small screens) ----
          Scrolling lives on the INNER `.sidebar-scroll` wrapper, not on
          `.sidebar-glass` itself - the glass panel needs `overflow:
          visible` so its glow blobs (positioned partly outside the box)
          don't get clipped away. */}
      <aside className="sidebar-glass inset-y-0 left-0 z-20 hidden w-64 border-r border-white/50 lg:flex">
        <div className="sidebar-scroll flex w-full flex-col gap-1 overflow-y-auto px-4 py-6 scroll-thin">
        <div className="relative z-10 mb-6 flex items-center gap-3 px-1">
          <div
            className="brand-mark-3d flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-mark shadow-lifted"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-900">Saarthi.ai</p>
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-light">
              {shopName || 'Aapki dukaan'}
            </p>
          </div>
        </div>

        <nav className="relative z-10 flex flex-col gap-1">
          {NAV_LINKS.map((link) => {
            const count = link.badgeKey ? badges[link.badgeKey] : 0;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? 'nav-item-active text-white'
                      : 'text-muted hover:translate-x-0.5 hover:border-primary/10 hover:bg-primary/[0.07] hover:text-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className={`relative h-[18px] w-[18px] flex-shrink-0 transition-transform duration-300 ${
                        isActive ? 'opacity-100' : 'opacity-80 group-hover:scale-110'
                      }`}
                    >
                      {link.icon}
                    </svg>
                    <span className="relative flex-1">{t(link.labelKey)}</span>
                    {count > 0 && (
                      <span
                        className={`relative inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                          isActive ? 'bg-white/25 text-white' : 'bg-danger/10 text-danger animate-pulse-slow'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="relative z-10 mt-auto flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold text-muted-light transition hover:bg-danger/5 hover:text-danger"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('nav.logout')}
        </button>
        </div>
      </aside>

      {/* ---- Topbar (sits to the right of the sidebar on large screens) ---- */}
      <div className="sticky top-0 z-10 border-b border-white/50 bg-white/70 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 lg:pl-[280px] lg:pr-6">
        <div className="flex items-center gap-3">
          {/* Mobile-only compact nav since the fixed sidebar is hidden below lg */}
          <nav className="flex items-center gap-1 overflow-x-auto lg:hidden">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    isActive ? 'bg-nav-active text-white shadow-nav-active' : 'text-muted'
                  }`
                }
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="hidden flex-1 items-center gap-2 rounded-xl border border-primary/10 bg-white/80 px-3.5 py-2 shadow-soft transition-shadow duration-300 hover:border-primary/25 hover:shadow-card sm:flex lg:max-w-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-muted-light">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder={t('nav.searchPlaceholder')}
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-muted-light focus:outline-none"
            />
          </div>

          <div className="flex-1" />

          <NavLink
            to="/alerts"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 bg-white/80 text-muted shadow-soft transition hover:text-primary"
            title="Alerts"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {totalBadgeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse-slow rounded-full bg-danger" />
            )}
          </NavLink>

          <button
            type="button"
            onClick={() => {
              if (window.location.pathname !== '/dashboard') {
                navigate('/dashboard');
                // wait one tick for Dashboard to mount its listener before firing
                setTimeout(() => window.dispatchEvent(new Event('saarthi:open-quick-add')), 60);
              } else {
                window.dispatchEvent(new Event('saarthi:open-quick-add'));
              }
            }}
            className="hidden animate-pulse-glow items-center gap-1.5 rounded-xl bg-cta-gradient px-3.5 py-2 text-xs font-bold text-white shadow-soft transition-transform duration-200 hover:-translate-y-0.5 sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('nav.newEntry')}
          </button>

          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              title="Profile"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-nav-active text-xs font-bold text-white shadow-nav-active transition-transform duration-300 hover:scale-105"
            >
              {initials}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-white/60 bg-white/90 p-3.5 shadow-lifted backdrop-blur-xl">
                <button
                  onClick={handleLogout}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-danger/5 hover:text-danger"
                >
                  {t('nav.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}