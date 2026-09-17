import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  PageHeader, Card, Button, Input, Badge, Spinner, EmptyState,
  Modal, formatDateTime,
} from '../components/ui';

const ROLE_COLORS = {
  admin:        'red',
  receptionist: 'blue',
  accounts:     'purple',
  clinician:    'green',
};

const ROLE_OPTIONS = [
  { value: 'admin',        label: 'Admin — full access' },
  { value: 'receptionist', label: 'Receptionist — patients, beds, admissions' },
  { value: 'accounts',     label: 'Accounts — invoices, payments' },
  { value: 'clinician',    label: 'Clinician — read-only clinical data' },
];


export default function Users() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/auth/users');
      return data;
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['users'] });
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Users"
        subtitle="Staff accounts and permissions"
        action={<Button onClick={() => setShowCreate(true)}>+ Add User</Button>}
      />

      <Card className="mb-4 bg-blue-50 border-blue-200">
        <div className="p-4 text-sm text-blue-800">
          <strong>Roles explained</strong>
          <ul className="mt-2 space-y-1 text-xs">
            <li>🔴 <strong>Admin</strong> — full access to everything, including user management</li>
            <li>🔵 <strong>Receptionist</strong> — patients, beds, admissions (no billing changes)</li>
            <li>🟣 <strong>Accounts</strong> — invoices, payments, reconciliation</li>
            <li>🟢 <strong>Clinician</strong> — read-only access to patient and admission data</li>
          </ul>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <EmptyState icon="⚠️" title="Could not load users" message={error.response?.data?.detail || error.message} />
        ) : !users || users.length === 0 ? (
          <EmptyState icon="🔐" title="No users" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Username</th>
                  <th className="text-left px-5 py-3 font-medium">Full Name</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Last Login</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUser={currentUser}
                    onUpdate={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          refresh();
        }}
      />
    </div>
  );
}


// ---------- Row ----------
function UserRow({ user, currentUser, onUpdate }) {
  const [showEdit, setShowEdit] = useState(false);
  const isSelf = user.id === currentUser?.id;

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">
          {user.username}
          {isSelf && (
            <span className="ml-2 text-[10px] uppercase bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
              you
            </span>
          )}
        </td>
        <td className="px-5 py-3 text-gray-900">{user.full_name}</td>
        <td className="px-5 py-3 text-gray-600 text-xs">{user.email || '—'}</td>
        <td className="px-5 py-3">
          <Badge color={ROLE_COLORS[user.role] || 'gray'}>{user.role}</Badge>
        </td>
        <td className="px-5 py-3">
          {user.is_active ? (
            <Badge color="green">active</Badge>
          ) : (
            <Badge color="gray">disabled</Badge>
          )}
        </td>
        <td className="px-5 py-3 text-gray-500 text-xs">
          {user.last_login ? formatDateTime(user.last_login) : '—'}
        </td>
        <td className="px-5 py-3 text-right">
          <button
            onClick={() => setShowEdit(true)}
            className="text-brand-600 hover:text-brand-700 text-sm font-medium"
          >
            Edit →
          </button>
        </td>
      </tr>

      <EditUserModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        user={user}
        currentUser={currentUser}
        onSuccess={() => {
          setShowEdit(false);
          onUpdate();
        }}
      />
    </>
  );
}


// ---------- Create User Modal ----------
function CreateUserModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'receptionist',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/api/auth/users', payload),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to create user.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = { ...form };
    if (!payload.email) delete payload.email;
    mutation.mutate(payload);
  }

  function handleClose() {
    setForm({ username: '', password: '', full_name: '', email: '', role: 'receptionist' });
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Staff User">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <Input
          label="Username *"
          required
          minLength={3}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder="e.g. reception2"
        />

        <Input
          label="Full Name *"
          required
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          placeholder="e.g. Grace Wanjiku"
        />

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="optional"
        />

        <Input
          label="Initial Password *"
          type="text"
          required
          minLength={6}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="at least 6 characters"
        />
        <p className="text-xs text-gray-500 -mt-2">
          Share this with the user. They can change it after first login.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


// ---------- Edit User Modal ----------
function EditUserModal({ open, onClose, user, currentUser, onSuccess }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email || '',
    role: user.role,
    is_active: user.is_active,
  });
  const [error, setError] = useState('');

  const isSelf = user.id === currentUser?.id;

  const mutation = useMutation({
    mutationFn: (payload) => api.put(`/api/auth/users/${user.id}`, payload),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to update user.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = { ...form };
    if (!payload.email) delete payload.email;
    mutation.mutate(payload);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${user.username}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <Input
          label="Full Name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            disabled={isSelf}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-100"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {isSelf && (
            <p className="text-xs text-gray-500 mt-1">You cannot change your own role.</p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              disabled={isSelf}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Account active</span>
          </label>
          {isSelf && (
            <p className="text-xs text-gray-500 mt-1">You cannot disable your own account.</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}