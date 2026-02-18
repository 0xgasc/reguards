import { Routes, Route, Navigate } from 'react-router-dom'
import PhoneAuth from './components/PhoneAuth'
import Dashboard from './components/Dashboard'
import AdminPanel from './components/AdminPanel'
import Events from './components/Events'
import MerchantPortal from './components/MerchantPortal'
import Explore from './components/Explore'
import RestaurantProfile from './components/RestaurantProfile'
import CheckIn from './components/CheckIn'
import useAuthStore from './store/auth-store'

// Protected route wrapper
function ProtectedRoute({ children, adminOnly = false, merchantOnly = false }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (merchantOnly && user?.role !== 'merchant' && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<PhoneAuth />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <Events />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        {/* Merchant portal */}
        <Route
          path="/merchant"
          element={
            <ProtectedRoute merchantOnly>
              <MerchantPortal />
            </ProtectedRoute>
          }
        />
        {/* Referral signup link */}
        <Route path="/signup" element={<PhoneAuth />} />
        {/* Public explore page — no auth required */}
        <Route path="/explore" element={<Explore />} />
        {/* Public restaurant profile pages — no auth required */}
        <Route path="/r/:slug" element={<RestaurantProfile />} />
        {/* Customer self-check-in QR pages — auth redirects to login */}
        <Route path="/checkin/:slug" element={<CheckIn />} />
      </Routes>
    </div>
  )
}

export default App
