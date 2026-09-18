import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from './ui';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <div className="flex justify-center text-red-500 mb-4"><Icon name="security" size={48} strokeWidth={1.6} /></div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600 text-sm">
            Your role ({user.role}) does not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return children;
}