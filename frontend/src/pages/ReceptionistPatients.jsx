import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../lib/api';
import { Button, Card, EmptyState, Input, PageHeader, Spinner } from '../components/ui';

export default function ReceptionistPatients() {
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const { data: patients, isLoading, isError } = useQuery({
    queryKey: ['patients-lookup'],
    queryFn: async () => (await api.get('/api/patients/options')).data,
  });
  const mutation = useMutation({
    mutationFn: () => api.post('/api/patients', { full_name: fullName.trim() }),
    onSuccess: () => {
      setFullName(''); setError(''); setShowRegister(false);
      queryClient.invalidateQueries({ queryKey: ['patients-lookup'] });
    },
    onError: (err) => setError(err.response?.data?.detail || 'Could not register patient.'),
  });

  return (
    <div className="p-8">
      <PageHeader title="Patients" subtitle="Register patients and manage admissions" action={<Button onClick={() => setShowRegister(true)}>+ Register Patient</Button>} />
      {showRegister && <Card className="mb-4"><form className="p-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setError(''); if (fullName.trim()) mutation.mutate(); }}>
        <div className="min-w-64 flex-1"><Input label="Patient full name *" required value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus /></div>
        <Button type="submit" disabled={mutation.isPending || !fullName.trim()}>{mutation.isPending ? 'Registering…' : 'Register'}</Button>
        <Button type="button" variant="ghost" onClick={() => { setShowRegister(false); setError(''); }}>Cancel</Button>
        {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
      </form></Card>}
      <Card>{isLoading ? <Spinner /> : isError ? <EmptyState icon="alert" title="Could not load patients" message="Please try again." /> : !patients?.length ? <EmptyState icon="patients" title="No patients yet" message="Register a patient to get started." /> : <div className="divide-y divide-gray-100">{patients.map((patient) => <div key={patient.id} className="flex justify-between px-5 py-3"><span className="font-medium">{patient.full_name}</span><span className="font-mono text-sm text-gray-500">{patient.patient_number}</span></div>)}</div>}</Card>
    </div>
  );
}
