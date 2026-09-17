import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  PageHeader, Card, Button, Input, Badge, Spinner, EmptyState,
  Modal, formatDate,
} from '../components/ui';

export default function Patients() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  const { data: patients, isLoading, error } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      const params = search ? { q: search } : {};
      const { data } = await api.get('/api/patients', { params });
      return data;
    },
  });

  return (
    <div className="p-8">
      <PageHeader
        title="Patients"
        subtitle="Register and manage patient records"
        action={
          <Button onClick={() => setShowRegister(true)}>
            + Register Patient
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="p-4">
          <input
            type="text"
            placeholder="🔍 Search by name, patient number, phone, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <EmptyState
            icon="⚠️"
            title="Could not load patients"
            message={error.response?.data?.detail || error.message}
          />
        ) : !patients || patients.length === 0 ? (
          <EmptyState
            icon="👤"
            title={search ? 'No matches found' : 'No patients yet'}
            message={search ? `No patients match "${search}"` : 'Register the first patient to get started.'}
            action={
              !search && (
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
                  <th className="text-left px-5 py-3 font-medium">Registered</th>
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
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RegisterPatientModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onSuccess={() => {
          setShowRegister(false);
          qc.invalidateQueries({ queryKey: ['patients'] });
        }}
      />
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