import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  PageHeader, Card, Button, Input, Badge, Spinner, EmptyState,
  Modal, formatDateTime,
} from '../components/ui';

const STATUS_COLORS = {
  active: 'green',
  discharged: 'gray',
  cancelled: 'red',
};

function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function Admissions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManageAdmissions = ['admin', 'receptionist'].includes(user?.role);
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
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
    qc.invalidateQueries({ queryKey: ['beds-available'] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
  }

  const searchTerm = search.trim().toLowerCase();
  const filteredAdmissions = (admissions || []).filter((admission) => {
    if (!searchTerm) return true;
    return [admission.patient_name, admission.patient_number, admission.admission_number]
      .some((value) => value?.toLowerCase().includes(searchTerm));
  });

  return (
    <div className="p-8">
      <PageHeader
        title="Admissions"
        subtitle="Manage patient stays and bed assignments"
        action={canManageAdmissions && <Button onClick={() => setShowAdmit(true)}>+ Admit Patient</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip label="Active" active={filter === 'active'} onClick={() => setFilter('active')} />
        <FilterChip label="Discharged" active={filter === 'discharged'} onClick={() => setFilter('discharged')} />
        <FilterChip label="All" active={filter === ''} onClick={() => setFilter('')} />
      </div>

      <Card className="mb-4">
        <div className="p-4">
          <label htmlFor="admission-search" className="sr-only">Search admitted persons</label>
          <input
            id="admission-search"
            type="search"
            placeholder="Search by patient name or admission number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </Card>

      <Card>
        {isLoading ? <Spinner /> : error ? (
          <EmptyState icon="alert" title="Could not load admissions" message={error.response?.data?.detail || error.message} />
        ) : filteredAdmissions.length === 0 ? (
          <EmptyState
            icon="stethoscope"
            title={searchTerm ? 'No matching admissions' : filter === 'active' ? 'No active admissions' : 'No admissions found'}
            message={searchTerm ? `No admitted person matches "${search}".` : 'Admit a patient to get started.'}
            action={!searchTerm && filter === 'active' && canManageAdmissions && <Button onClick={() => setShowAdmit(true)}>+ Admit Patient</Button>}
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
                  {canManageAdmissions && <th className="text-right px-5 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAdmissions.map((adm) => (
                  <AdmissionRow key={adm.id} admission={adm} onAction={refresh} canManage={canManageAdmissions} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdmitPatientModal
        open={showAdmit && canManageAdmissions}
        onClose={() => setShowAdmit(false)}
        onSuccess={() => { setShowAdmit(false); refresh(); }}
      />
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
      {label}
    </button>
  );
}

function AdmissionRow({ admission, onAction, canManage }) {
  const [showAssign, setShowAssign] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDischarge, setShowDischarge] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: detail } = useQuery({
    queryKey: ['admission', admission.id],
    queryFn: async () => (await api.get(`/api/admissions/${admission.id}`)).data,
  });
  const currentBed = detail?.current_bed;
  const isActive = admission.status === 'active';

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-5 py-3"><button onClick={() => setExpanded(!expanded)} className="font-mono text-xs text-brand-600 font-semibold hover:underline">{admission.admission_number} {expanded ? '▾' : '▸'}</button></td>
        <td className="px-5 py-3"><div className="font-medium text-gray-900">{detail?.patient_name || '—'}</div><div className="text-xs text-gray-500 font-mono">{detail?.patient_number || ''}</div></td>
        <td className="px-5 py-3">{currentBed ? <span className="font-mono font-semibold text-gray-900">{currentBed}</span> : isActive ? <span className="text-xs text-red-600 font-medium">Unassigned</span> : <span className="text-gray-400">—</span>}</td>
        <td className="px-5 py-3 text-gray-600 text-xs">{formatDateTime(admission.admitted_at)}</td>
        <td className="px-5 py-3 text-gray-600 text-xs">{admission.discharged_at ? formatDateTime(admission.discharged_at) : '—'}</td>
        <td className="px-5 py-3"><Badge color={STATUS_COLORS[admission.status] || 'gray'}>{admission.status}</Badge></td>
        {canManage && <td className="px-5 py-3 text-right">{isActive && <div className="flex gap-1 justify-end">{!currentBed && <Button variant="primary" onClick={() => setShowAssign(true)}>Assign Bed</Button>}{currentBed && <Button variant="secondary" onClick={() => setShowTransfer(true)}>Transfer</Button>}<Button variant="danger" onClick={() => setShowDischarge(true)}>Discharge</Button></div>}</td>}
      </tr>
      {expanded && <tr className="bg-gray-50"><td colSpan={canManage ? 7 : 6} className="px-5 py-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div><div className="text-xs uppercase text-gray-500 mb-1">Reason</div><div className="text-gray-800">{admission.reason || '—'}</div></div><div><div className="text-xs uppercase text-gray-500 mb-1">Notes</div><div className="text-gray-800 whitespace-pre-wrap">{admission.notes || '—'}</div></div></div></td></tr>}
      <AssignBedModal open={showAssign} onClose={() => setShowAssign(false)} admission={admission} onSuccess={() => { setShowAssign(false); onAction(); }} />
      <TransferBedModal open={showTransfer} onClose={() => setShowTransfer(false)} admission={admission} currentBed={currentBed} onSuccess={() => { setShowTransfer(false); onAction(); }} />
      <DischargeModal open={showDischarge} onClose={() => setShowDischarge(false)} admission={admission} onSuccess={() => { setShowDischarge(false); onAction(); }} />
    </>
  );
}

function AdmitPatientModal({ open, onClose, onSuccess }) {
  const [patientId, setPatientId] = useState('');
  const [reason, setReason] = useState('');
  const [admissionDate, setAdmissionDate] = useState(localToday);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const { data: patients } = useQuery({
    queryKey: ['patients-lookup', search],
    queryFn: async () => (await api.get('/api/patients/options', { params: search ? { q: search } : {} })).data,
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
    if (!patientId) return setError('Please select a patient.');
    if (!admissionDate || admissionDate > localToday()) return setError('Admission date must be today or earlier.');
    mutation.mutate({ patient_id: Number(patientId), admission_date: admissionDate, reason: reason || null });
  }

  function handleClose() {
    setPatientId(''); setReason(''); setAdmissionDate(localToday()); setError(''); setSearch(''); onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Admit Patient" width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">{error}</div>}
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Search Patient *</label><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, patient number, or phone…" className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" /></div>
        {patients && patients.length > 0 && <div className="border border-gray-200 rounded-lg max-h-56 overflow-auto">{patients.slice(0, 20).map((p) => <button key={p.id} type="button" onClick={() => setPatientId(p.id)} className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${Number(patientId) === p.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''}`}><div className="font-medium text-sm text-gray-900">{p.full_name}</div><div className="text-xs text-gray-500 font-mono">{p.patient_number}</div></button>)}</div>}
        {selected && <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm"><div className="font-semibold text-brand-900">{selected.full_name}</div><div className="text-xs text-brand-700 font-mono">{selected.patient_number}</div></div>}
        <Input label="Admission date *" type="date" required max={localToday()} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason for Admission</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" placeholder="e.g. Palliative care admission for pain management" /></div>
        <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending || !patientId}>{mutation.isPending ? 'Admitting…' : 'Admit Patient'}</Button></div>
      </form>
    </Modal>
  );
}

function AssignBedModal({ open, onClose, admission, onSuccess }) {
  const [bedId, setBedId] = useState(''); const [error, setError] = useState('');
  const { data: beds } = useQuery({ queryKey: ['beds-available'], queryFn: async () => (await api.get('/api/beds', { params: { status: 'available' } })).data, enabled: open });
  const mutation = useMutation({ mutationFn: () => api.post(`/api/admissions/${admission.id}/assign-bed`, null, { params: { bed_id: bedId } }), onSuccess, onError: (err) => setError(err.response?.data?.detail || 'Failed to assign bed.') });
  function handleSubmit(e) { e.preventDefault(); setError(''); if (!bedId) return setError('Please select a bed.'); mutation.mutate(); }
  function handleClose() { setBedId(''); setError(''); onClose(); }
  return <Modal open={open} onClose={handleClose} title={`Assign Bed — ${admission.admission_number}`}><form onSubmit={handleSubmit} className="space-y-4">{error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">{error}</div>}{!beds || beds.length === 0 ? <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 text-sm p-3 rounded">No beds are currently available. Free up a bed or add a new one.</div> : <div><label className="block text-sm font-medium text-gray-700 mb-1">Available Beds *</label><div className="border border-gray-200 rounded-lg max-h-72 overflow-auto">{beds.map((b) => <button key={b.id} type="button" onClick={() => setBedId(b.id)} className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${Number(bedId) === b.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''}`}><span className="font-mono font-semibold text-gray-900">{b.bed_number}</span><span className="ml-2 text-sm text-gray-600">{b.category}</span><span className="float-right text-xs text-gray-500">{b.location || '—'} · KSh {b.daily_rate}/day</span></button>)}</div></div>}<div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending || !bedId || !beds?.length}>{mutation.isPending ? 'Assigning…' : 'Assign Bed'}</Button></div></form></Modal>;
}

function TransferBedModal({ open, onClose, admission, currentBed, onSuccess }) {
  const [bedId, setBedId] = useState(''); const [notes, setNotes] = useState(''); const [error, setError] = useState('');
  const { data: beds } = useQuery({ queryKey: ['beds-available'], queryFn: async () => (await api.get('/api/beds', { params: { status: 'available' } })).data, enabled: open });
  const mutation = useMutation({ mutationFn: () => api.post(`/api/admissions/${admission.id}/transfer-bed`, { new_bed_id: Number(bedId), notes: notes || null }), onSuccess, onError: (err) => setError(err.response?.data?.detail || 'Failed to transfer.') });
  function handleSubmit(e) { e.preventDefault(); setError(''); if (!bedId) return setError('Please select a bed.'); mutation.mutate(); }
  function handleClose() { setBedId(''); setNotes(''); setError(''); onClose(); }
  return <Modal open={open} onClose={handleClose} title={`Transfer — ${admission.admission_number}`}><form onSubmit={handleSubmit} className="space-y-4"><div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm"><div className="text-xs uppercase text-blue-600 font-medium mb-1">Current Bed</div><div className="font-mono font-semibold text-blue-900">{currentBed || '—'}</div></div>{error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">{error}</div>}<div><label className="block text-sm font-medium text-gray-700 mb-1">New Bed *</label><div className="border border-gray-200 rounded-lg max-h-72 overflow-auto">{(beds || []).map((b) => <button key={b.id} type="button" onClick={() => setBedId(b.id)} className={`w-full text-left px-3 py-2 border-b ${Number(bedId) === b.id ? 'bg-brand-50' : ''}`}>{b.bed_number} · {b.category} · KSh {b.daily_rate}/day</button>)}</div></div><label className="block text-sm font-medium text-gray-700">Transfer Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm" /></label><div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending || !bedId}>Transfer Bed</Button></div></form></Modal>;
}

function DischargeModal({ open, onClose, admission, onSuccess }) {
  const [notes, setNotes] = useState(''); const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: () => api.post(`/api/admissions/${admission.id}/discharge`, { discharge_notes: notes || null }), onSuccess, onError: (err) => setError(err.response?.data?.detail || 'Failed to discharge.') });
  function handleClose() { setNotes(''); setError(''); onClose(); }
  return <Modal open={open} onClose={handleClose} title={`Discharge — ${admission.admission_number}`}><form onSubmit={(e) => { e.preventDefault(); setError(''); mutation.mutate(); }} className="space-y-4">{error && <div className="text-sm text-red-700">{error}</div>}<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">This will close the active bed assignment, free the bed, and generate the final invoice.</div><label className="block text-sm font-medium text-gray-700">Discharge Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm" /></label><div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button><Button type="submit" variant="danger" disabled={mutation.isPending}>{mutation.isPending ? 'Discharging…' : 'Confirm Discharge'}</Button></div></form></Modal>;
}
