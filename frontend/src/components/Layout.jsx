import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/auth';

const NAV = [
  { to: '/',           label: 'Dashboard',  icon: '📊', roles: null },
  { to: '/patients',   label: 'Patients',   icon: '👤', roles: null },
  { to: '/beds',       label: 'Beds',       icon: '🛏️', roles: null },
  { to: '/admissions', label: 'Admissions', icon: '🏥', roles: null },
  { to: '/invoices',   label: 'Invoices',   icon: '💰', roles: [ROLES.ADMIN, ROLES.ACCOUNTS, ROLES.RECEPTIONIST] },
  { to: '/payments',   label: 'Payments',   icon: '📱', roles: [ROLES.ADMIN, ROLES.ACCOUNTS] },
  { to: '/users',      label: 'Users',      icon: '🔐', roles: [ROLES.ADMIN] },
];

// External links open in a new tab
const EXTERNAL_NAV = [
  { href: '/pay/payment.html', label: 'Payer Portal', icon: '💳', roles: null, hint: 'opens in new tab' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const visibleNav = NAV.filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-brand-900 text-white flex flex-col">
        <div className="p-5 border-b border-brand-700">
          <div className="text-lg font-semibold">Grace Path Centre</div>
          <div className="text-xs text-brand-100 opacity-80 mt-1">
            Management System
          </div>
        </div>

                <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'text-brand-100 hover:bg-brand-700'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="pt-2 mt-2 border-t border-brand-700">
            {EXTERNAL_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-brand-100 hover:bg-brand-700 transition-colors"
                title={item.hint}
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                <span className="text-xs opacity-60">↗</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-brand-700">
          <div className="px-3 py-2 text-xs text-brand-100">
            <div className="font-semibold text-white truncate">{user?.full_name}</div>
            <div className="capitalize opacity-80">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 text-left px-3 py-2 rounded-lg text-sm text-brand-100 hover:bg-brand-700"
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}