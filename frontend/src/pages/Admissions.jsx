import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, Modal, formatDateTime } from '../components/ui';

const STATUS_COLORS = { active: 'green', discharged: 'gray', cancelled: 'red' };
function localToday() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

export default function Admissions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = ['admin', 'receptionist'].includes(user?.role);
  const canDischarge = user?.role === 'admin';
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [showAdmit, setShowAdmit] = useState(false);
  const { data: admissions, isLoading, error } = useQuery({
    queryKey: ['admissions', filter],
    queryFn: async () => (await api.get('/api/admissions', { params: filter ? { status: filter } : {} })).data,
  });
  function refresh() {
    qc.invalidateQueries({ queryKey: ['admissions'] });
    qc.invalidateQueries({ queryKey: ['beds-available'] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
  }
  const term = search.trim().toLowerCase();
  const rows = (admissions || []).filter((item) => !term || [item.patient_name, item.patient_number, item.admission_number].some((value) => value?.toLowerCase().includes(term)));

  return <div className="p-8">
    <PageHeader title="Admissions" subtitle="Manage patient stays and bed assignments" action={canManage && <div className="flex gap-2"><Link to="/patients"><Button variant="secondary">+ Register Patient</Button></Link><Button onClick={() => setShowAdmit(true)}>+ Admit Patient</Button></div>} />
    <div className="flex flex-wrap gap-2 mb-4">
      {[['Active', 'active'], ['Discharged', 'discharged'], ['All', '']].map(([label, value]) => <button key={label} onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === value ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{label}</button>)}
    </div>
    <Card className="mb-4"><div className="p-4"><label htmlFor="admission-search" className="sr-only">Search admissions</label><input id="admission-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by patient or admission number..." className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm" /></div></Card>
    <Card>{isLoading ? <Spinner /> : error ? <EmptyState icon="alert" title="Could not load admissions" message={error.response?.data?.detail || error.message} /> : !rows.length ? <EmptyState icon="stethoscope" title="No admissions found" message="Admit a patient to get started." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="text-left px-5 py-3">Admission #</th><th className="text-left px-5 py-3">Patient</th><th className="text-left px-5 py-3">Bed</th><th className="text-left px-5 py-3">Admitted</th><th className="text-left px-5 py-3">Discharged</th><th className="text-left px-5 py-3">Status</th>{canManage && <th className="text-right px-5 py-3">Actions</th>}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((admission) => <AdmissionRow key={admission.id} admission={admission} onAction={refresh} canManage={canManage} canDischarge={canDischarge} />)}</tbody></table></div>}</Card>
    <AdmitModal open={showAdmit} onClose={() => setShowAdmit(false)} onSuccess={() => { setShowAdmit(false); refresh(); }} />
  </div>;
}

function AdmissionRow({ admission, onAction, canManage, canDischarge }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const { data: detail } = useQuery({ queryKey: ['admission', admission.id], queryFn: async () => (await api.get(`/api/admissions/${admission.id}`)).data });
  const bed = detail?.current_bed;
  const active = admission.status === 'active';
  return <>
    <tr>
      <td className="px-5 py-3 font-mono text-xs">{admission.admission_number}</td>
      <td className="px-5 py-3">{detail?.patient_name || '—'}<div className="text-xs text-gray-500">{detail?.patient_number || ''}</div></td>
      <td className="px-5 py-3">{bed || (active ? 'Unassigned' : '—')}</td>
      <td className="px-5 py-3 text-xs">{formatDateTime(admission.admitted_at)}</td>
      <td className="px-5 py-3 text-xs">{admission.discharged_at ? formatDateTime(admission.discharged_at) : '—'}</td>
      <td className="px-5 py-3"><Badge color={STATUS_COLORS[admission.status] || 'gray'}>{admission.status}</Badge></td>
      {canManage && <td className="px-5 py-3 text-right"><div className="flex gap-1 justify-end">{active && !bed && <Button onClick={() => setAssignOpen(true)}>Assign Bed</Button>}{active && bed && <Button variant="secondary" onClick={() => setTransferOpen(true)}>Transfer</Button>}{canDischarge && active && <Button variant="danger" onClick={() => setDischargeOpen(true)}>Discharge</Button>}</div></td>}
    </tr>
    <BedModal open={assignOpen} onClose={() => setAssignOpen(false)} admission={admission} onSuccess={() => { setAssignOpen(false); onAction(); }} />
    <BedModal open={transferOpen} onClose={() => setTransferOpen(false)} admission={admission} transfer onSuccess={() => { setTransferOpen(false); onAction(); }} />
    {canDischarge && <DischargeModal open={dischargeOpen} onClose={() => setDischargeOpen(false)} admission={admission} onSuccess={() => { setDischargeOpen(false); onAction(); }} />}
  </>;
}

function AdmitModal({ open, onClose, onSuccess }) {
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(localToday);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const { data: patients } = useQuery({ queryKey: ['patients-lookup', search], queryFn: async () => (await api.get('/api/patients/options', { params: search ? { q: search } : {} })).data, enabled: open });
  const mutation = useMutation({ mutationFn: (payload) => api.post('/api/admissions', payload), onSuccess, onError: (err) => setError(err.response?.data?.detail || 'Could not admit patient.') });
  function submit(event) { event.preventDefault(); setError(''); if (!patientId) return setError('Select a patient.'); if (!date || date > localToday()) return setError('Admission date must be today or earlier.'); mutation.mutate({ patient_id: Number(patientId), admission_date: date, reason: reason || null }); }
  function close() { setPatientId(''); setDate(localToday()); setReason(''); setSearch(''); setError(''); onClose(); }
  return <Modal open={open} onClose={close} title="Admit Patient"><form onSubmit={submit} className="space-y-4">{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<label className="block text-sm">Search patients<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full border rounded px-3 py-2" /></label><label className="block text-sm">Patient *<select required value={patientId} onChange={(event) => setPatientId(event.target.value)} className="mt-1 w-full border rounded px-3 py-2"><option value="">Select a patient</option>{(patients || []).map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name} ({patient.patient_number})</option>)}</select></label><label className="block text-sm">Admission date *<input type="date" required max={localToday()} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full border rounded px-3 py-2" /></label><label className="block text-sm">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full border rounded px-3 py-2" rows={3} /></label><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending || !patientId}>{mutation.isPending ? 'Admitting…' : 'Admit Patient'}</Button></div></form></Modal>;
}

function BedModal({ open, onClose, admission, transfer = false, onSuccess }) {
  const [bedId, setBedId] = useState('');
  const [error, setError] = useState('');
  const { data: beds } = useQuery({ queryKey: ['beds-available'], queryFn: async () => (await api.get('/api/beds', { params: { status: 'available' } })).data, enabled: open });
  const mutation = useMutation({ mutationFn: () => transfer ? api.post(`/api/admissions/${admission.id}/transfer-bed`, { new_bed_id: Number(bedId) }) : api.post(`/api/admissions/${admission.id}/assign-bed`, null, { params: { bed_id: bedId } }), onSuccess, onError: (err) => setError(err.response?.data?.detail || 'Could not assign bed.') });
  function submit(event) { event.preventDefault(); setError(''); if (!bedId) return setError('Select a bed.'); mutation.mutate(); }
  function close() { setBedId(''); setError(''); onClose(); }
  return <Modal open={open} onClose={close} title={`${transfer ? 'Transfer' : 'Assign'} Bed — ${admission.admission_number}`}><form onSubmit={submit} className="space-y-4">{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<label className="block text-sm">Available bed *<select required value={bedId} onChange={(event) => setBedId(event.target.value)} className="mt-1 w-full border rounded px-3 py-2"><option value="">Select a bed</option>{(beds || []).map((bed) => <option key={bed.id} value={bed.id}>{bed.bed_number} · {bed.category} · KSh {bed.daily_rate}/day</option>)}</select></label><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending || !bedId}>{transfer ? 'Transfer Bed' : 'Assign Bed'}</Button></div></form></Modal>;
}

function DischargeModal({ open, onClose, admission, onSuccess }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: () => api.post(`/api/admissions/${admission.id}/discharge`, { discharge_notes: notes || null }), onSuccess, onError: (err) => setError(err.response?.data?.detail || 'Could not discharge patient.') });
  function close() { setNotes(''); setError(''); onClose(); }
  return <Modal open={open} onClose={close} title={`Discharge — ${admission.admission_number}`}><form onSubmit={(event) => { event.preventDefault(); setError(''); mutation.mutate(); }} className="space-y-4">{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<p className="text-sm text-gray-700">This closes the bed assignment and generates the final invoice.</p><label className="block text-sm">Discharge notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full border rounded px-3 py-2" /></label><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" variant="danger" disabled={mutation.isPending}>Confirm Discharge</Button></div></form></Modal>;
}
