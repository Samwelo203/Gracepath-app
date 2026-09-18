import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  PageHeader, Card, Button, Input, Spinner, EmptyState,
  Modal, Icon, formatKsh,
} from '../components/ui';

// ---------- Status styling ----------
const STATUS_STYLES = {
  available:   { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Available' },
  occupied:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Occupied' },
  maintenance: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', dot: 'bg-yellow-500', label: 'Maintenance' },
  reserved:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'Reserved' },
};


export default function Beds() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManageBeds = user?.role === 'admin';
  const [filter, setFilter] = useState('');  // '' = all
  const [showAdd, setShowAdd] = useState(false);

  // Beds list
  const { data: beds, isLoading, error } = useQuery({
    queryKey: ['beds', filter],
    queryFn: async () => {
      const params = filter ? { status: filter } : {};
      const { data } = await api.get('/api/beds', { params });
      return data;
    },
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['beds-stats'],
    queryFn: async () => {
      const { data } = await api.get('/api/beds/stats');
      return data;
    },
    refetchInterval: 15000,  // refresh every 15s
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['beds'] });
    qc.invalidateQueries({ queryKey: ['beds-stats'] });
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Beds"
        subtitle="Live bed occupancy and status"
        action={canManageBeds && (
          <Button onClick={() => setShowAdd(true)}>+ Add Bed</Button>
        )}
      />

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatPill label="Total"       value={stats.total}        color="gray" />
          <StatPill label="Available"   value={stats.available}    color="green" />
          <StatPill label="Occupied"    value={stats.occupied}     color="red" />
          <StatPill label="Maintenance" value={stats.maintenance}  color="yellow" />
          <StatPill label="Reserved"    value={stats.reserved}     color="blue" />
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip label="All"         active={filter === ''}            onClick={() => setFilter('')} />
        <FilterChip label="Available"   active={filter === 'available'}   onClick={() => setFilter('available')} />
        <FilterChip label="Occupied"    active={filter === 'occupied'}    onClick={() => setFilter('occupied')} />
        <FilterChip label="Maintenance" active={filter === 'maintenance'} onClick={() => setFilter('maintenance')} />
        <FilterChip label="Reserved"    active={filter === 'reserved'}    onClick={() => setFilter('reserved')} />
      </div>

      {/* Grid */}
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <Card><EmptyState icon="alert" title="Could not load beds" message={error.response?.data?.detail || error.message} /></Card>
      ) : !beds || beds.length === 0 ? (
        <Card>
          <EmptyState
            icon="bed"
            title={filter ? 'No beds match this filter' : 'No beds yet'}
            message={filter ? 'Try a different status.' : 'Add your first bed to get started.'}
            action={!filter && canManageBeds && <Button onClick={() => setShowAdd(true)}>+ Add Bed</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {beds.map((bed) => (
            <BedCard key={bed.id} bed={bed} onChange={refresh} canManage={canManageBeds} />
          ))}
        </div>
      )}

      <AddBedModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => {
          setShowAdd(false);
          refresh();
        }}
      />
    </div>
  );
}


// ---------- Stat pill ----------
function StatPill({ label, value, color }) {
  const colors = {
    gray:   'bg-white border-gray-200',
    green:  'bg-green-50 border-green-200',
    red:    'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    blue:   'bg-blue-50 border-blue-200',
  };
  return (
    <div className={`rounded-xl border ${colors[color]} p-4 text-center`}>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// ---------- Filter chip ----------
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


// ---------- Bed card ----------
function BedCard({ bed, onChange, canManage }) {
  const [showEdit, setShowEdit] = useState(false);
  const style = STATUS_STYLES[bed.status] || STATUS_STYLES.available;

  return (
    <>
      <div
        className={`rounded-xl border-2 ${style.border} ${style.bg} p-4 flex flex-col`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-mono text-lg font-bold text-gray-900">
              {bed.bed_number}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              {bed.category}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-white ${style.text} border ${style.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
            {style.label}
          </span>
        </div>

        <div className="text-xs space-y-1 text-gray-600 flex-1">
          {bed.location && (
            <div className="flex items-center gap-1"><Icon name="mapPin" size={14} />{bed.location}</div>
          )}
          <div className="font-medium text-gray-900">
            {formatKsh(bed.daily_rate)}<span className="text-gray-500 font-normal">/day</span>
          </div>
        </div>

        {canManage && <button
          onClick={() => setShowEdit(true)}
          className="mt-3 text-xs text-brand-600 hover:text-brand-700 font-medium text-left"
        >
          Edit →
        </button>}
      </div>

      <EditBedModal
        open={showEdit && canManage}
        onClose={() => setShowEdit(false)}
        bed={bed}
        onSuccess={() => {
          setShowEdit(false);
          onChange();
        }}
      />
    </>
  );
}


// ---------- Add Bed Modal ----------
function AddBedModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState({
    category: 'Standard',
    daily_rate: '',
    location: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/api/beds', payload),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to create bed.'),
  });

  function reset() {
    setForm({ category: 'Standard', daily_rate: '', location: '', notes: '' });
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    mutation.mutate({
      category: form.category,
      daily_rate: Number(form.daily_rate),
      location: form.location || null,
      notes: form.notes || null,
    });
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add New Bed">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option>Standard</option>
            <option>Private</option>
            <option>Deluxe</option>
            <option>ICU</option>
            <option>HDU</option>
          </select>
        </div>

        <Input
          label="Daily Rate (KSh) *"
          type="number"
          required
          min="0"
          step="50"
          value={form.daily_rate}
          onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
          placeholder="e.g. 1500"
        />

        <Input
          label="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="e.g. Ward A, Room 3"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="optional"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Bed'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


// ---------- Edit Bed Modal ----------
function EditBedModal({ open, onClose, bed, onSuccess }) {
  const [form, setForm] = useState({
    category: bed.category,
    daily_rate: bed.daily_rate,
    status: bed.status,
    location: bed.location || '',
    notes: bed.notes || '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => api.put(`/api/beds/${bed.id}`, payload),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to update bed.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/beds/${bed.id}`),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to delete bed.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    mutation.mutate({
      category: form.category,
      daily_rate: Number(form.daily_rate),
      status: form.status,
      location: form.location || null,
      notes: form.notes || null,
    });
  }

  function handleDelete() {
    if (!confirm(`Delete bed ${bed.bed_number}? This cannot be undone.`)) return;
    deleteMutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${bed.bed_number}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option>Standard</option>
            <option>Private</option>
            <option>Deluxe</option>
            <option>ICU</option>
            <option>HDU</option>
          </select>
        </div>

        <Input
          label="Daily Rate (KSh)"
          type="number"
          required
          min="0"
          step="50"
          value={form.daily_rate}
          onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            disabled={bed.status === 'occupied'}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-100"
          >
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
            <option value="reserved">Reserved</option>
          </select>
          {bed.status === 'occupied' && (
            <p className="text-xs text-gray-500 mt-1">
              Occupied beds are set automatically by discharge/assignment.
            </p>
          )}
        </div>

        <Input
          label="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex justify-between gap-3 pt-2">
          <Button type="button" variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending || bed.status === 'occupied'}>
            Delete
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}