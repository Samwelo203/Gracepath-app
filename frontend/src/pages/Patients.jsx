import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  PageHeader, Card, Button, Input, Spinner, EmptyState,
  Modal, formatDate, formatDateTime,
} from '../components/ui';

export default function Patients() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManagePatients = user?.role === 'admin';
  const canAddNotes = ['admin', 'clinician'].includes(user?.role);
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [assignmentError, setAssignmentError] = useState('');

  const { data: clinicians, isLoading: cliniciansLoading } = useQuery({
    queryKey: ['clinicians'],
    queryFn: async () => {
      const { data } = await api.get('/api/auth/users');
      return data.filter((item) => item.role === 'clinician' && item.is_active);
    },
    enabled: canManagePatients,
  });

  const { data: patients, isLoading, error } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      const params = search ? { q: search } : {};
      const { data } = await api.get('/api/patients', { params });
      return data;
    },
  });

  const assignmentMutation = useMutation({
    mutationFn: ({ patientId, clinicianId }) => api.put(
      `/api/patients/${patientId}/assignment`,
      { clinician_id: clinicianId },
    ),
    onSuccess: () => {
      setAssignmentError('');
      qc.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (err) => setAssignmentError(
      err.response?.data?.detail || 'Could not update patient assignment.',
    ),
  });

  return (
    <div className="p-8">
      <PageHeader
        title="Patients"
        subtitle={canManagePatients ? 'Manage patient records and clinician assignments' : 'Patients assigned to you'}
        action={canManagePatients && (
          <Button onClick={() => setShowRegister(true)}>
            + Register Patient
          </Button>
        )}
      />

      <Card className="mb-4">
        <div className="p-4">
          <input
            type="text"
            placeholder="Search by name, patient number, phone, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </Card>

      {assignmentError && (
        <p role="alert" className="mb-3 text-sm text-red-700">{assignmentError}</p>
      )}

      <Card>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <EmptyState
            icon="alert"
            title="Could not load patients"
            message={error.response?.data?.detail || error.message}
          />
        ) : !patients || patients.length === 0 ? (
          <EmptyState
            icon="patients"
            title={search ? 'No matches found' : 'No patients yet'}
            message={search ? `No patients match "${search}"` : 'Register the first patient to get started.'}
            action={
              !search && canManagePatients && (
                <Button onClick={() => setShowRegister(true)}>
                  + Register Patient
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Patient No.</th>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Gender</th>
                  <th className="text-left px-5 py-3 font-medium">Phone</th>
                  <th className="text-left px-5 py-3 font-medium">National ID</th>
                  {canManagePatients && <th className="text-left px-5 py-3 font-medium">Assigned Clinician</th>}
                  <th className="text-left px-5 py-3 font-medium">Registered</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-brand-600 font-semibold">
                      {p.patient_number}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {p.full_name}
                    </td>
                    <td className="px-5 py-3 capitalize text-gray-600">
                      {p.gender || '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.phone || '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.national_id || '—'}
                    </td>
                    {canManagePatients && (
                      <td className="px-5 py-3">
                        <select
                          aria-label={`Assign ${p.full_name} to a clinician`}
                          value={p.assigned_clinician_id || ''}
                          disabled={cliniciansLoading || (assignmentMutation.isPending && assignmentMutation.variables?.patientId === p.id)}
                          onChange={(event) => assignmentMutation.mutate({
                            patientId: p.id,
                            clinicianId: event.target.value ? Number(event.target.value) : null,
                          })}
                          className="max-w-52 border border-gray-200 rounded px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {(clinicians || []).map((clinician) => (
                            <option key={clinician.id} value={clinician.id}>{clinician.full_name}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" onClick={() => setSelectedPatient(p)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RegisterPatientModal
        open={showRegister && canManagePatients}
        onClose={() => setShowRegister(false)}
        onSuccess={() => {
          setShowRegister(false);
          qc.invalidateQueries({ queryKey: ['patients'] });
        }}
      />

      <PatientDetailModal
        key={selectedPatient?.id ?? 'closed'}
        patient={selectedPatient}
        open={!!selectedPatient}
        canAddNotes={canAddNotes}
        canDelete={canManagePatients}
        onClose={() => setSelectedPatient(null)}
        onDelete={() => {
          setSelectedPatient(null);
          qc.invalidateQueries();
        }}
      />
    </div>
  );
}


function PatientDetailModal({ patient, open, canAddNotes, canDelete, onClose, onDelete }) {
  const [note, setNote] = useState('');
  const [review, setReview] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['patient', patient?.id],
    queryFn: async () => (await api.get(`/api/patients/${patient.id}`)).data,
    enabled: open && !!patient,
  });

  const { data: notes } = useQuery({
    queryKey: ['patient-notes', patient?.id],
    queryFn: async () => (await api.get(`/api/patients/${patient.id}/notes`)).data,
    enabled: open && !!patient,
  });

  const noteMutation = useMutation({
    mutationFn: () => api.post(`/api/patients/${patient.id}/notes`, {
      note: note.trim(),
      review: review.trim() || null,
      follow_up_date: followUpDate || null,
    }),
    onSuccess: () => {
      setNote('');
      setReview('');
      setFollowUpDate('');
      setError('');
      qc.invalidateQueries({ queryKey: ['patient-notes', patient.id] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to add treatment note.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/patients/${patient.id}`),
    onSuccess: onDelete,
    onError: (err) => setError(err.response?.data?.detail || 'Could not delete patient.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!note.trim()) {
      setError('Enter a treatment note first.');
      return;
    }
    noteMutation.mutate();
  }

  function handleDelete() {
    const message = `Permanently delete ${patient.full_name} (${patient.patient_number}) and their clinical notes, admissions, invoices, and payment history? This cannot be undone.`;
    if (window.confirm(message)) {
      setError('');
      deleteMutation.mutate();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={patient ? `${patient.full_name} — ${patient.patient_number}` : 'Patient'} width="max-w-2xl">
      {isLoading ? <Spinner /> : detail && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Gender" value={detail.gender} />
            <Detail label="Date of birth" value={detail.date_of_birth} />
            <Detail label="Phone" value={detail.phone} />
            <Detail label="National ID" value={detail.national_id} />
            <div className="col-span-2"><Detail label="Patient notes" value={detail.notes} /></div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Medical history and treatment notes</h3>
            {!notes || notes.length === 0 ? (
              <p className="text-sm text-gray-500">No treatment notes recorded.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-auto">
                {notes.map((item) => (
                  <div key={item.id} className="border-l-4 border-brand-300 bg-gray-50 p-3">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.note}</p>
                    {item.review && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap"><strong>Review:</strong> {item.review}</p>}
                    {item.follow_up_date && <p className="mt-2 text-xs font-medium text-brand-700">Follow-up: {formatDate(item.follow_up_date)}</p>}
                    <p className="text-xs text-gray-500 mt-2">{item.author_name} · {formatDateTime(item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canAddNotes && (
            <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 pt-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <label className="block text-sm font-medium text-gray-700">Clinical note *</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="Record the treatment or encounter..."
              />
              <label className="block text-sm font-medium text-gray-700" htmlFor="patient-review">Review / assessment</label>
              <textarea
                id="patient-review"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={2}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="Clinical review or assessment..."
              />
              <Input
                label="Follow-up date"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={noteMutation.isPending}>
                  {noteMutation.isPending ? 'Saving…' : 'Save Clinical Note'}
                </Button>
              </div>
            </form>
          )}

          {canDelete && (
            <div className="flex justify-end border-t border-gray-100 pt-4">
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete Patient and Records'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-gray-800 whitespace-pre-wrap">{value || '—'}</div>
    </div>
  );
}


// ---------- Register Patient Modal ----------
function RegisterPatientModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState({
    full_name: '',
    gender: '',
    date_of_birth: '',
    national_id: '',
    phone: '',
    email: '',
    address: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/api/patients', payload),
    onSuccess,
    onError: (err) => {
      setError(err.response?.data?.detail || 'Failed to register patient.');
    },
  });

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Clean payload — send null for empty strings
    const payload = {};
    for (const [key, value] of Object.entries(form)) {
      if (value === '') continue;
      payload[key] = value;
    }

    mutation.mutate(payload);
  }

  function handleClose() {
    setForm({
      full_name: '', gender: '', date_of_birth: '', national_id: '',
      phone: '', email: '', address: '',
      next_of_kin_name: '', next_of_kin_phone: '', notes: '',
    });
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Register New Patient" width="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              label="Full Name *"
              required
              value={form.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="e.g. John Otieno"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={form.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input
            label="Date of Birth"
            type="date"
            value={form.date_of_birth}
            onChange={(e) => handleChange('date_of_birth', e.target.value)}
          />

          <Input
            label="National ID"
            value={form.national_id}
            onChange={(e) => handleChange('national_id', e.target.value)}
            placeholder="e.g. 12345678"
          />

          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="e.g. 0712345678"
          />

          <div className="col-span-2">
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="optional"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={2}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="optional"
            />
          </div>

          <Input
            label="Next of Kin"
            value={form.next_of_kin_name}
            onChange={(e) => handleChange('next_of_kin_name', e.target.value)}
            placeholder="Full name"
          />

          <Input
            label="Next of Kin Phone"
            value={form.next_of_kin_phone}
            onChange={(e) => handleChange('next_of_kin_phone', e.target.value)}
            placeholder="e.g. 0712345678"
          />

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="optional — medical notes, allergies, etc."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Registering…' : 'Register Patient'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}