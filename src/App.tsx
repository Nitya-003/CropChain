import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast'; // <--- 1. IMPORT THIS

import { AuthProvider } from './context/AuthContext';
// import { ToastProvider } from './context/ToastContext'; // Removed old context to avoid conflicts
import Header from './components/Header';
// import ToastContainer from './components/ToastContainer'; // Removed old container

import Home from './pages/Home';
import AddBatch from './pages/AddBatch';
import UpdateBatch from './pages/UpdateBatch';
import TrackBatch from './pages/TrackBatch';
import AdminDashboard from './pages/AdminDashboard';
import VerificationDashboard from './pages/VerificationDashboard';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

// Components
import AIChatbot from './components/AIChatbot';
import { CurrencyProvider } from "./context/CurrencyContext";


function App() {
  return (

    <CurrencyProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
          <Header />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/add-batch" element={<AddBatch />} />
              <Route path="/update-batch" element={<UpdateBatch />} />
              <Route path="/track-batch" element={<TrackBatch />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>

          {/* AI Chatbot - Available on all pages */}
          <AIChatbot />

        </div>
      </Router>
    </CurrencyProvider>

  );
}

export default App;