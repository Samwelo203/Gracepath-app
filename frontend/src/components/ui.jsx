// Small shared UI primitives used across pages.
import {
  AlertTriangle, BedDouble, Check, CircleUserRound, CreditCard,
  FileText, KeyRound, LayoutDashboard, Link, LogOut, MapPin,
  Receipt, Search, ShieldAlert, Stethoscope, UsersRound, Wallet, X,
} from 'lucide-react';

const ICONS = {
  alert: AlertTriangle,
  bed: BedDouble,
  check: Check,
  dashboard: LayoutDashboard,
  empty: FileText,
  invoice: Receipt,
  link: Link,
  key: KeyRound,
  logout: LogOut,
  mapPin: MapPin,
  patients: UsersRound,
  payment: CreditCard,
  receipt: Receipt,
  search: Search,
  security: ShieldAlert,
  stethoscope: Stethoscope,
  user: CircleUserRound,
  wallet: Wallet,
  close: X,
};

export function Icon({ name, size = 18, strokeWidth = 2, className = '' }) {
  const Component = ICONS[name] || FileText;
  return <Component aria-hidden="true" size={size} strokeWidth={strokeWidth} className={className} />;
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

export function Button({ children, variant = 'primary', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };
  return (
    <button className={`${base} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, error, ...props }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        className={`w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
          error
            ? 'border-red-300 focus:border-red-500'
            : 'border-gray-200 focus:border-brand-500'
        }`}
        {...props}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
    </div>
  );
}

export function EmptyState({ icon = 'empty', title, message, action }) {
  return (
    <div className="text-center p-12">
      <div className="flex justify-center text-brand-500 mb-3"><Icon name={icon} size={42} strokeWidth={1.6} /></div>
      <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
      {message && <p className="text-sm text-gray-500 mb-4">{message}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${width} max-h-[90vh] overflow-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function formatKsh(value) {
  const num = Number(value || 0);
  return 'KSh ' + num.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}