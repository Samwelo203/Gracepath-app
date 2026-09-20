import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Card, Badge, Spinner, EmptyState, Icon, formatKsh, formatDateTime,
} from '../components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const canViewFinance = ['admin', 'accounts'].includes(user?.role);
  const greetingName = user?.username || user?.full_name?.split(' ')[0] || 'User';

  const { data: bedStats } = useQuery({
    queryKey: ['beds-stats'],
    queryFn: async () => (await api.get('/api/beds/stats')).data,
    refetchInterval: 20000,
  });

  const { data: invStats } = useQuery({
    queryKey: ['invoices-stats'],
    queryFn: async () => (await api.get('/api/invoices/stats')).data,
    refetchInterval: 30000,
    enabled: canViewFinance,
  });

  const { data: activeAdmissions } = useQuery({
    queryKey: ['admissions', 'active'],
    queryFn: async () => (await api.get('/api/admissions', { params: { status: 'active' } })).data,
    refetchInterval: 30000,
  });

  const { data: recentPayments } = useQuery({
    queryKey: ['recent-payments'],
    queryFn: async () => (await api.get('/api/payments/mpesa/transactions', { params: { limit: 5 } })).data,
    refetchInterval: 30000,
    enabled: ['admin', 'accounts'].includes(user?.role),
  });

  const { data: unmatched } = useQuery({
    queryKey: ['unmatched'],
    queryFn: async () => (await api.get('/api/payments/mpesa/unmatched')).data,
    refetchInterval: 30000,
    enabled: ['admin', 'accounts'].includes(user?.role),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <img src="/logo.png" alt="Grace Path Centre logo" className="h-14 w-14 rounded-2xl object-cover shadow-sm ring-1 ring-brand-200 bg-brand-50" />
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome, {greetingName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-KE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {unmatched && unmatched.length > 0 && (
        <Link to="/payments" className="block mb-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 hover:bg-yellow-100 transition-colors">
            <div className="flex items-center gap-3">
              <Icon name="alert" size={24} />
              <div>
                <div className="font-semibold text-yellow-900">
                  {unmatched.length} unmatched M-Pesa payment{unmatched.length > 1 ? 's' : ''} need attention
                </div>
                <div className="text-sm text-yellow-700">
                  Click to review and link them to invoices →
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="bed"
          label="Bed Occupancy"
          value={bedStats ? `${bedStats.occupied}/${bedStats.total}` : '—'}
          sub={
            bedStats
              ? `${bedStats.total > 0 ? ((bedStats.occupied / bedStats.total) * 100).toFixed(0) : 0}% occupied`
              : ''
          }
          accent={bedStats && bedStats.available === 0 ? 'red' : 'blue'}
        />
        <StatCard
          icon="stethoscope"
          label="Active Admissions"
          value={activeAdmissions?.length ?? '—'}
          sub="patients currently admitted"
          accent="purple"
        />
        {canViewFinance && <>
          <StatCard
            icon="wallet"
            label="Outstanding"
            value={invStats ? formatKsh(invStats.total_outstanding) : '—'}
            sub="unpaid balance across all invoices"
            accent="red"
          />
          <StatCard
            icon="check"
            label="Collected"
            value={invStats ? formatKsh(invStats.total_paid) : '—'}
            sub="total M-Pesa payments received"
            accent="green"
          />
        </>}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Bed status detail */}
        <Card>
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">Bed Status</h2>
            <Link to="/beds" className="text-sm text-brand-600 hover:text-brand-700">
              View all →
            </Link>
          </div>
          <div className="p-5 space-y-3">
            {!bedStats ? (
              <Spinner />
            ) : (
              <>
                <StatusBar label="Available"   value={bedStats.available}    total={bedStats.total} color="bg-green-500" />
                <StatusBar label="Occupied"    value={bedStats.occupied}     total={bedStats.total} color="bg-red-500" />
                <StatusBar label="Maintenance" value={bedStats.maintenance}  total={bedStats.total} color="bg-yellow-500" />
                <StatusBar label="Reserved"    value={bedStats.reserved}     total={bedStats.total} color="bg-blue-500" />
              </>
            )}
          </div>
        </Card>

        {/* Active admissions */}
        <Card>
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">Active Admissions</h2>
            <Link to="/admissions" className="text-sm text-brand-600 hover:text-brand-700">
              View all →
            </Link>
          </div>
          {!activeAdmissions ? (
            <Spinner />
          ) : activeAdmissions.length === 0 ? (
            <EmptyState icon="stethoscope" title="No active admissions" message="Admit a patient to see them here." />
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-auto">
              {activeAdmissions.slice(0, 6).map((adm) => (
                <div key={adm.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="font-mono text-xs text-brand-600 font-semibold">
                      {adm.admission_number}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatDateTime(adm.admitted_at)}
                    </div>
                  </div>
                  <Badge color="green">active</Badge>
                </div>
              ))}
              {activeAdmissions.length > 6 && (
                <div className="px-5 py-3 text-xs text-gray-500 text-center bg-gray-50">
                  +{activeAdmissions.length - 6} more
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Recent payments (admin/accounts only) */}
        {['admin', 'accounts'].includes(user?.role) && (
          <Card className="lg:col-span-2">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold">Recent M-Pesa Payments</h2>
              <Link to="/payments" className="text-sm text-brand-600 hover:text-brand-700">
                View all →
              </Link>
            </div>
            {!recentPayments ? (
              <Spinner />
            ) : recentPayments.length === 0 ? (
              <EmptyState icon="payment" title="No payments yet" />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-5 py-2 font-medium">Receipt</th>
                    <th className="text-left px-5 py-2 font-medium">Invoice</th>
                    <th className="text-left px-5 py-2 font-medium">Payer</th>
                    <th className="text-right px-5 py-2 font-medium">Amount</th>
                    <th className="text-left px-5 py-2 font-medium">Status</th>
                    <th className="text-left px-5 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentPayments.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2 font-mono text-xs font-semibold">
                        {tx.transaction_id}
                      </td>
                      <td className="px-5 py-2 font-mono text-xs text-gray-600">
                        {tx.invoice_number || '—'}
                      </td>
                      <td className="px-5 py-2 text-gray-700">{tx.payer_name || '—'}</td>
                      <td className="px-5 py-2 text-right font-medium text-green-700">
                        {formatKsh(tx.amount)}
                      </td>
                      <td className="px-5 py-2">
                        <Badge color={
                          tx.status === 'success' ? 'green'
                          : tx.status === 'unmatched' ? 'yellow'
                          : 'red'
                        }>
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-2 text-gray-500 text-xs">
                        {formatDateTime(tx.received_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}


function StatCard({ icon, label, value, sub, accent = 'gray' }) {
  const accents = {
    gray: 'border-gray-200',
    blue: 'border-blue-200',
    green: 'border-green-200',
    red: 'border-red-200',
    purple: 'border-purple-200',
  };
  return (
    <Card className={`border-2 ${accents[accent]}`}>
      <div className="p-5">
        <div className="text-brand-500 mb-2">
          <Icon name={icon} size={28} strokeWidth={1.8} />
        </div>
        <div className="text-xs uppercase text-gray-500 font-medium tracking-wide">
          {label}
        </div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
    </Card>
  );
}


function StatusBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">
          {value} <span className="text-gray-400 font-normal">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        ></div>
      </div>
    </div>
  );
}