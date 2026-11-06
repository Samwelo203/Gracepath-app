import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../lib/api';
import { Button, Card, EmptyState, Input, PageHeader, Spinner } from '../components/ui';

const EMPTY_FORM = {
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
};

export default function ReceptionistPatients() {
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const { data: patients, isLoading, isError } = useQuery({
    queryKey: ['patients-lookup'],
    queryFn: async () => (await api.get('/api/patients/options')).data,
  });

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/api/patients', payload),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setError('');
      setShowRegister(false);
      queryClient.invalidateQueries({ queryKey: ['patients-lookup'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Could not register patient.'),
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setError('');
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value.trim() !== ''),
    );
    mutation.mutate(payload);
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Patients"
        subtitle="Register patients and manage admissions"
        action={<Button onClick={() => setShowRegister((visible) => !visible)}>{showRegister ? 'Cancel' : '+ Register Patient'}</Button>}
      />

      {showRegister && (
        <Card className="mb-4">
          <form className="p-4 space-y-4" onSubmit={submit}>
            <h2 className="font-semibold text-gray-900">Register New Patient</h2>
            {error && <p role="alert" className="text-sm text-red-700">{Array.isArray(error) ? error.map((item) => item.msg).join(', ') : error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full name *" required minLength={2} value={form.full_name} onChange={(event) => update('full_name', event.target.value)} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select value={form.gender} onChange={(event) => update('gender', event.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </div>
              <Input label="Date of birth" type="date" value={form.date_of_birth} onChange={(event) => update('date_of_birth', event.target.value)} />
              <Input label="National ID" value={form.national_id} onChange={(event) => update('national_id', event.target.value)} />
              <Input label="Phone" type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
              <Input label="Email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
              <Input label="Address" value={form.address} onChange={(event) => update('address', event.target.value)} />
              <Input label="Next of kin" value={form.next_of_kin_name} onChange={(event) => update('next_of_kin_name', event.target.value)} />
              <Input label="Next of kin phone" type="tel" value={form.next_of_kin_phone} onChange={(event) => update('next_of_kin_phone', event.target.value)} />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={2} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending || !form.full_name.trim()}>{mutation.isPending ? 'Registering…' : 'Register Patient'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {isLoading ? <Spinner /> : isError ? (
          <EmptyState icon="alert" title="Could not load patients" message="Please try again." />
        ) : !patients?.length ? (
          <EmptyState icon="patients" title="No patients yet" message="Register a patient to get started." />
        ) : (
          <div className="divide-y divide-gray-100">
            {patients.map((patient) => (
              <div key={patient.id} className="flex justify-between px-5 py-3">
                <span className="font-medium">{patient.full_name}</span>
                <span className="font-mono text-sm text-gray-500">{patient.patient_number}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
