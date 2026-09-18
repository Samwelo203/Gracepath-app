import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/auth';
import { Icon } from './ui';

const NAV = [
  { to: '/',           label: 'Dashboard',  icon: 'dashboard', roles: null },
  { to: '/patients',   label: 'Patients',   icon: 'patients', roles: null },
  { to: '/beds',       label: 'Beds',       icon: 'bed', roles: null },
  { to: '/admissions', label: 'Admissions', icon: 'stethoscope', roles: null },
  { to: '/invoices',   label: 'Invoices',   icon: 'invoice', roles: [ROLES.ADMIN, ROLES.ACCOUNTS] },
  { to: '/payments',   label: 'Payments',   icon: 'payment', roles: [ROLES.ADMIN, ROLES.ACCOUNTS] },
  { to: '/users',      label: 'Users',      icon: 'security', roles: [ROLES.ADMIN] },
];

// External links open in a new tab
const EXTERNAL_NAV = [
  { href: '/pay/payment.html', label: 'Payer Portal', icon: 'wallet', roles: [ROLES.ADMIN, ROLES.ACCOUNTS, ROLES.RECEPTIONIST], hint: 'opens in new tab' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const visibleNav = NAV.filter(item => !item.roles || item.roles.includes(user?.role));
  const visibleExternalNav = EXTERNAL_NAV.filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-brand-900 text-white flex flex-col">
        <div className="p-5 border-b border-brand-700">
          <div className="flex items-center gap-3">
            <img src="/app/favicon.svg" alt="" className="w-8 h-8 rounded-lg bg-white p-1" />
            <div className="text-lg font-semibold">Grace Path Centre</div>
          </div>
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
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="pt-2 mt-2 border-t border-brand-700">
            {visibleExternalNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-brand-100 hover:bg-brand-700 transition-colors"
                title={item.hint}
              >
                <span className="flex items-center gap-3">
                  <Icon name={item.icon} size={18} />
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
            <span className="flex items-center gap-3"><Icon name="logout" size={18} /> Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}