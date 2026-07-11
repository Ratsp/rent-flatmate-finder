import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { homeFor } from './routes';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { PageLoader } from './components/ui';

import Login from './pages/Login';
import Register from './pages/Register';
import Browse from './pages/tenant/Browse';
import Profile from './pages/tenant/Profile';
import MyInterests from './pages/tenant/MyInterests';
import MyListings from './pages/owner/MyListings';
import AdminDashboard from './pages/admin/AdminDashboard';
import Chat from './pages/Chat';

// Sends an authenticated user to their role's home; unauthenticated users to login.
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<Layout />}>
          {/* Tenant */}
          <Route path="/browse" element={<ProtectedRoute roles={['tenant']}><Browse /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute roles={['tenant']}><Profile /></ProtectedRoute>} />
          <Route path="/interests" element={<ProtectedRoute roles={['tenant']}><MyInterests /></ProtectedRoute>} />

          {/* Owner */}
          <Route path="/listings" element={<ProtectedRoute roles={['owner']}><MyListings /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />

          {/* Shared chat (tenant + owner) */}
          <Route path="/chat" element={<ProtectedRoute roles={['tenant', 'owner']}><Chat /></ProtectedRoute>} />
          <Route path="/chat/:interestRequestId" element={<ProtectedRoute roles={['tenant', 'owner']}><Chat /></ProtectedRoute>} />
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
