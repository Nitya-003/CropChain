import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';

// Pages
import Home from './pages/Home';
import AddBatch from './pages/AddBatch';
import UpdateBatch from './pages/UpdateBatch';
import TrackBatch from './pages/TrackBatch';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import AccessDenied from './pages/AccessDenied';
import AIChatbot from './components/AIChatbot';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
          <Header />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/access-denied" element={<AccessDenied />} />

              {/* Protected Routes */}
              <Route
                path="/add-batch"
                element={
                  <ProtectedRoute allowedRoles={['farmer']}>
                    <AddBatch />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/update-batch"
                element={
                  <ProtectedRoute allowedRoles={['transporter']}>
                    <UpdateBatch />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/track-batch"
                element={
                  <ProtectedRoute>
                    <TrackBatch />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>

          {/* AI Chatbot - Available on all pages */}
          <AIChatbot />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
