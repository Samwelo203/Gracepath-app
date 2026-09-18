import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Beds from './pages/Beds';
import Admissions from './pages/Admissions';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Users from './pages/Users';
import Payments from './pages/Payments';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Placeholder({ title }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">{title}</h1>
      <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
        <p className="text-sm">Coming soon.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="beds" element={<Beds />} />
              <Route path="admissions" element={<Admissions />} />
              <Route path="invoices" element={<ProtectedRoute roles={['admin', 'accounts']}><Invoices /></ProtectedRoute>} />
              <Route path="invoices/:id" element={<ProtectedRoute roles={['admin', 'accounts']}><InvoiceDetail /></ProtectedRoute>} />
              <Route
  path="payments"
  element={
    <ProtectedRoute roles={['admin', 'accounts']}>
      <Payments />
    </ProtectedRoute>
  }
/>
              <Route
  path="users"
  element={
    <ProtectedRoute roles={['admin']}>
      <Users />
    </ProtectedRoute>
  }
/>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}