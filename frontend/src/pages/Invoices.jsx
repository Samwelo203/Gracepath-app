import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import {
  PageHeader, Card, Button, Badge, Spinner, EmptyState, Modal, Input, formatKsh, formatDateTime,
} from '../components/ui';

const STATUS_COLORS = {
  unpaid: 'red',
  partially_paid: 'yellow',
  paid: 'green',
  overpaid: 'blue',
  cancelled: 'gray',
};

export default function Invoices() {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showServiceInvoice, setShowServiceInvoice] = useState(false);

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['invoices', filter],
    queryFn: async () => {
      const params = filter ? { status: filter } : {};
      const { data } = await api.get('/api/invoices', { params });
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['invoices-stats'],
    queryFn: async () => {
      const { data } = await api.get('/api/invoices/stats');
      return data;
    },
    refetchInterval: 30000,
  });

  // Client-side search filter (invoice number, patient name)
  const filtered = (invoices || []).filter((inv) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(s) ||
      (inv.patient_name || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-8">
      <PageHeader
        title="Invoices"
        subtitle="Billing, payments, and outstanding balances"
        action={<Button onClick={() => setShowServiceInvoice(true)}>+ Service Invoice</Button>}
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Billed" value={formatKsh(stats.total_billed)} color="blue" />
          <StatCard label="Total Received" value={formatKsh(stats.total_paid)} color="green" />
          <StatCard label="Outstanding" value={formatKsh(stats.total_outstanding)} color="red" />
        </div>
      )}

      {/* Search */}
      <Card className="mb-4">
        <div className="p-4">
          <input
            type="text"
            placeholder="Search by invoice number or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </Card>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip label="All"            active={filter === ''}                onClick={() => setFilter('')} />
        <FilterChip label="Unpaid"         active={filter === 'unpaid'}          onClick={() => setFilter('unpaid')} />
        <FilterChip label="Partially Paid" active={filter === 'partially_paid'}  onClick={() => setFilter('partially_paid')} />
        <FilterChip label="Paid"           active={filter === 'paid'}            onClick={() => setFilter('paid')} />
        <FilterChip label="Overpaid"       active={filter === 'overpaid'}        onClick={() => setFilter('overpaid')} />
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <EmptyState icon="alert" title="Could not load invoices" message={error.response?.data?.detail || error.message} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="invoice"
            title={search ? 'No matches' : 'No invoices yet'}
            message={search ? `No invoices match "${search}"` : 'Invoices are auto-created when patients are admitted.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Invoice #</th>
                  <th className="text-left px-5 py-3 font-medium">Admission</th>
                  <th className="text-right px-5 py-3 font-medium">Total</th>
                  <th className="text-right px-5 py-3 font-medium">Paid</th>
                  <th className="text-right px-5 py-3 font-medium">Balance</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Issued</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-brand-600 font-semibold">
                      {inv.invoice_number}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs font-mono">
                      {inv.admission_id ? `#${inv.admission_id}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatKsh(inv.total_amount)}
                    </td>
                    <td className="px-5 py-3 text-right text-green-700">
                      {formatKsh(inv.amount_paid)}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${
                      Number(inv.balance) > 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {formatKsh(inv.balance)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge color={STATUS_COLORS[inv.status] || 'gray'}>
                        {inv.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {formatDateTime(inv.issued_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-brand-600 hover:text-brand-700 font-medium text-sm"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ServiceInvoiceModal
        open={showServiceInvoice}
        onClose={() => setShowServiceInvoice(false)}
      />
    </div>
  );
}

function ServiceInvoiceModal({ open, onClose }) {
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  const [includeAccommodation, setIncludeAccommodation] = useState(false);
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: '' }]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-for-invoice'],
    queryFn: async () => (await api.get('/api/patients/options', { params: { limit: 500 } })).data,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/api/invoices/services', payload),
    onSuccess: (response) => navigate(`/invoices/${response.data.id}`),
    onError: (err) => setError(err.response?.data?.detail || 'Could not create invoice.'),
  });

  function updateItem(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!patientId || items.some((item) => !item.description.trim() || Number(item.quantity) <= 0 || Number(item.unit_price) < 0)) {
      setError('Select a patient and complete every service line.');
      return;
    }
    mutation.mutate({
      patient_id: Number(patientId),
      notes: notes || null,
      include_accommodation: includeAccommodation,
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    });
  }

  function handleClose() {
    setPatientId('');
    setNotes('');
    setIncludeAccommodation(false);
    setItems([{ description: '', quantity: 1, unit_price: '' }]);
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Generate Service Invoice">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Registered patient *</label>
          <select value={patientId} onChange={(event) => setPatientId(event.target.value)} required className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
            <option value="">{patientsLoading ? 'Loading patients...' : 'Select a patient'}</option>
            {(patients || []).map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name} ({patient.patient_number})</option>)}
          </select>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-500"
            checked={includeAccommodation}
            onChange={(event) => setIncludeAccommodation(event.target.checked)}
          />
          <span>
            <span className="block font-medium">Add accommodation</span>
            <span className="block text-xs text-gray-500 mt-0.5">Include the current bed charge and number of days in this invoice.</span>
          </span>
        </label>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Services performed</div>
          <div className="p-3 space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_5rem_7rem_auto] gap-2 items-end">
                <Input label={index === 0 ? 'Description *' : ''} value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} placeholder="e.g. Consultation" required />
                <Input label={index === 0 ? 'Qty *' : ''} type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} required />
                <Input label={index === 0 ? 'Unit price *' : ''} type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, 'unit_price', event.target.value)} required />
                <button type="button" className="h-10 px-2 text-red-500 hover:text-red-700" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1} title="Remove service">×</button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, { description: '', quantity: 1, unit_price: '' }])}>+ Add service</Button>
          </div>
        </div>
        <Input label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional invoice notes" />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Generating...' : 'Generate Invoice'}</Button>
        </div>
      </form>
    </Modal>
  );
}


function StatCard({ label, value, color }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    red: 'border-red-200 bg-red-50',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="text-xs uppercase text-gray-500 font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-500 text-white'
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}