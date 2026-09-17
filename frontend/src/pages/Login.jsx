import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-900 p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-brand-500 text-white p-6 text-center">
          <h1 className="text-xl font-semibold">Grace Path Centre</h1>
          <p className="text-sm opacity-90 mt-1">Staff Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:border-brand-500 focus:outline-none"
              placeholder="your username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 focus:border-brand-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="pt-4 border-t border-gray-100 space-y-2">
  <a
    href="/pay/payment.html"
    target="_blank"
    rel="noopener noreferrer"
    className="block text-center text-sm text-brand-600 hover:text-brand-700 font-medium"
  >
    💳 Pay an Invoice (Payer Portal) →
  </a>
  <p className="text-xs text-gray-500 text-center">
    Default admin: <code className="bg-gray-100 px-1 rounded">admin / GracePath2026!</code>
  </p>
</div>
        </form>
      </div>
    </div>
  );
}