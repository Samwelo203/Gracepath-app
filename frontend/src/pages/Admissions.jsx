import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  PageHeader, Card, Button, Input, Badge, Spinner, EmptyState,
  Modal, formatDateTime,
} from '../components/ui';

const STATUS_COLORS = {
  active: 'green',
  discharged: 'gray',
  cancelled: 'red',
};


export default function Admissions() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('active');  // active | discharged | '' (all)
  const [showAdmit, setShowAdmit] = useState(false);

  const { data: admissions, isLoading, error } = useQuery({
    queryKey: ['admissions', filter],
    queryFn: async () => {
      const params = filter ? { status: filter } : {};
      const { data } = await api.get('/api/admissions', { params });
      return data;
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['admissions'] });
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Admissions"
        subtitle="Manage patient stays and bed assignments"
        action={
          <Button onClick={() => setShowAdmit(true)}>+ Admit Patient</Button>
        }
      />

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip label="Active"     active={filter === 'active'}     onClick={() => setFilter('active')} />
        <FilterChip label="Discharged" active={filter === 'discharged'} onClick={() => setFilter('discharged')} />
        <FilterChip label="All"        active={filter === ''}           onClick={() => setFilter('')} />
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <EmptyState
            icon="⚠️"
            title="Could not load admissions"
            message={error.response?.data?.detail || error.message}
          />
        ) : !admissions || admissions.length === 0 ? (
          <EmptyState
            icon="🏥"
            title={filter === 'active' ? 'No active admissions' : 'No admissions found'}
            message="Admit a patient to get started."
            action={
              filter === 'active' && (
                <Button onClick={() => setShowAdmit(true)}>+ Admit Patient</Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Admission #</th>
                  <th className="text-left px-5 py-3 font-medium">Patient</th>
                  <th className="text-left px-5 py-3 font-medium">Bed</th>
                  <th className="text-left px-5 py-3 font-medium">Admitted</th>
                  <th className="text-left px-5 py-3 font-medium">Discharged</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admissions.map((adm) => (
                  <AdmissionRow key={adm.id} admission={adm} onAction={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdmitPatientModal
        open={showAdmit}
        onClose={() => setShowAdmit(false)}
        onSuccess={() => {
          setShowAdmit(false);
          refresh();
        }}
      />
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


// ---------- Admission row ----------
function AdmissionRow({ admission, onAction }) {
  const [showAssign, setShowAssign] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDischarge, setShowDischarge] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Fetch full detail (with current_bed) only when needed
  const { data: detail } = useQuery({
    queryKey: ['admission', admission.id],
    queryFn: async () => {
      const { data } = await api.get(`/api/admissions/${admission.id}`);
      return data;
    },
  });

  const currentBed = detail?.current_bed;
  const isActive = admission.status === 'active';

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-5 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="font-mono text-xs text-brand-600 font-semibold hover:underline"
          >
            {admission.admission_number} {expanded ? '▾' : '▸'}
          </button>
        </td>
        <td className="px-5 py-3">
          <div className="font-medium text-gray-900">
            {detail?.patient_name || '—'}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {detail?.patient_number || ''}
          </div>
        </td>
        <td className="px-5 py-3">
          {currentBed ? (
            <span className="font-mono font-semibold text-gray-900">{currentBed}</span>
          ) : isActive ? (
            <span className="text-xs text-red-600 font-medium">Unassigned</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
        <td className="px-5 py-3 text-gray-600 text-xs">
          {formatDateTime(admission.admitted_at)}
        </td>
        <td className="px-5 py-3 text-gray-600 text-xs">
          {admission.discharged_at ? formatDateTime(admission.discharged_at) : '—'}
        </td>
        <td className="px-5 py-3">
          <Badge color={STATUS_COLORS[admission.status] || 'gray'}>
            {admission.status}
          </Badge>
        </td>
        <td className="px-5 py-3 text-right">
          {isActive && (
            <div className="flex gap-1 justify-end">
              {!currentBed && (
                <Button variant="primary" onClick={() => setShowAssign(true)}>
                  Assign Bed
                </Button>
              )}
              {currentBed && (
                <Button variant="secondary" onClick={() => setShowTransfer(true)}>
                  Transfer
                </Button>
              )}
              <Button variant="danger" onClick={() => setShowDischarge(true)}>
                Discharge
              </Button>
            </div>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-5 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs uppercase text-gray-500 mb-1">Reason</div>
                <div className="text-gray-800">{admission.reason || '—'}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500 mb-1">Notes</div>
                <div className="text-gray-800 whitespace-pre-wrap">
                  {admission.notes || '—'}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

      <AssignBedModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        admission={admission}
        onSuccess={() => {
          setShowAssign(false);
          onAction();
        }}
      />

      <TransferBedModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        admission={admission}
        currentBed={currentBed}
        onSuccess={() => {
          setShowTransfer(false);
          onAction();
        }}
      />

      <DischargeModal
        open={showDischarge}
        onClose={() => setShowDischarge(false)}
        admission={admission}
        onSuccess={() => {
          setShowDischarge(false);
          onAction();
        }}
      />
    </>
  );
}


// ---------- Admit Patient Modal ----------
function AdmitPatientModal({ open, onClose, onSuccess }) {
  const [patientId, setPatientId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Load patients (filtered by search)
  const { data: patients } = useQuery({
    queryKey: ['patients-lookup', search],
    queryFn: async () => {
      const params = search ? { q: search } : {};
      const { data } = await api.get('/api/patients', { params });
      return data;
    },
    enabled: open,
  });

  const selected = patients?.find((p) => p.id === Number(patientId));

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/api/admissions', payload),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to admit patient.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!patientId) {
      setError('Please select a patient.');
      return;
    }
    mutation.mutate({
      patient_id: Number(patientId),
      reason: reason || null,
    });
  }

  function handleClose() {
    setPatientId('');
    setReason('');
    setError('');
    setSearch('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Admit Patient" width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search Patient *
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, patient number, or phone…"
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {patients && patients.length > 0 && (
          <div className="border border-gray-200 rounded-lg max-h-56 overflow-auto">
            {patients.slice(0, 20).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPatientId(p.id)}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                  Number(patientId) === p.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''
                }`}
              >
                <div className="font-medium text-sm text-gray-900">{p.full_name}</div>
                <div className="text-xs text-gray-500 font-mono">
                  {p.patient_number} {p.phone ? `· ${p.phone}` : ''}
                </div>
              </button>
            ))}
            {patients.length > 20 && (
              <div className="px-3 py-2 text-xs text-gray-500 text-center bg-gray-50">
                Showing first 20 — refine your search to see more
              </div>
            )}
          </div>
        )}

        {selected && (
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm">
            <div className="font-semibold text-brand-900">{selected.full_name}</div>
            <div className="text-xs text-brand-700 font-mono">
              {selected.patient_number} {selected.phone ? `· ${selected.phone}` : ''}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Admission
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="e.g. Palliative care admission for pain management"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || !patientId}>
            {mutation.isPending ? 'Admitting…' : 'Admit Patient'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


// ---------- Assign Bed Modal ----------
function AssignBedModal({ open, onClose, admission, onSuccess }) {
  const [bedId, setBedId] = useState('');
  const [error, setError] = useState('');

  const { data: beds } = useQuery({
    queryKey: ['beds-available'],
    queryFn: async () => {
      const { data } = await api.get('/api/beds', { params: { status: 'available' } });
      return data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => api.post(
      `/api/admissions/${admission.id}/assign-bed`,
      null,
      { params: { bed_id: bedId } }
    ),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to assign bed.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!bedId) {
      setError('Please select a bed.');
      return;
    }
    mutation.mutate();
  }

  function handleClose() {
    setBedId('');
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Assign Bed — ${admission.admission_number}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        {!beds || beds.length === 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 text-sm p-3 rounded">
            No beds are currently available. Free up a bed or add a new one.
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Available Beds *
            </label>
            <div className="border border-gray-200 rounded-lg max-h-72 overflow-auto">
              {beds.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBedId(b.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                    Number(bedId) === b.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold text-gray-900">
                        {b.bed_number}
                      </span>
                      <span className="ml-2 text-sm text-gray-600">
                        {b.category}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {b.location || '—'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !bedId || !beds || beds.length === 0}
          >
            {mutation.isPending ? 'Assigning…' : 'Assign Bed'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


// ---------- Transfer Bed Modal ----------
function TransferBedModal({ open, onClose, admission, currentBed, onSuccess }) {
  const [bedId, setBedId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: beds } = useQuery({
    queryKey: ['beds-available'],
    queryFn: async () => {
      const { data } = await api.get('/api/beds', { params: { status: 'available' } });
      return data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => api.post(
      `/api/admissions/${admission.id}/transfer-bed`,
      { new_bed_id: Number(bedId), notes: notes || null }
    ),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to transfer.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!bedId) {
      setError('Please select a bed.');
      return;
    }
    mutation.mutate();
  }

  function handleClose() {
    setBedId('');
    setNotes('');
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Transfer — ${admission.admission_number}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <div className="text-xs uppercase text-blue-600 font-medium mb-1">Current Bed</div>
          <div className="font-mono font-semibold text-blue-900">{currentBed || '—'}</div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        {!beds || beds.length === 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 text-sm p-3 rounded">
            No other beds are currently available.
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Bed *
            </label>
            <div className="border border-gray-200 rounded-lg max-h-72 overflow-auto">
              {beds.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBedId(b.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                    Number(bedId) === b.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold text-gray-900">
                        {b.bed_number}
                      </span>
                      <span className="ml-2 text-sm text-gray-600">{b.category}</span>
                    </div>
                    <div className="text-xs text-gray-500">{b.location || '—'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transfer Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Reason for transfer (optional)"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || !bedId}>
            {mutation.isPending ? 'Transferring…' : 'Transfer Bed'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


// ---------- Discharge Modal ----------
function DischargeModal({ open, onClose, admission, onSuccess }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(
      `/api/admissions/${admission.id}/discharge`,
      { discharge_notes: notes || null }
    ),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to discharge.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    mutation.mutate();
  }

  function handleClose() {
    setNotes('');
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Discharge — ${admission.admission_number}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 text-sm p-3 rounded">
          This will close the active bed assignment, free the bed, and generate the final invoice.
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discharge Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="e.g. Stable, discharged home with pain management plan"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={mutation.isPending}>
            {mutation.isPending ? 'Discharging…' : 'Confirm Discharge'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}