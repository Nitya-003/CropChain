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
import NotFound from './pages/NotFound';

// Components
import AIChatbot from './components/AIChatbot';
import SyncStatusIndicator from './components/SyncStatusIndicator';

function App() {
  return (
    <AuthProvider>
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
              
              {/* MUST BE LAST - catch-all for 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          
          {/* Sync Status Indicator - Shows offline/online and pending sync status */}
          <SyncStatusIndicator />
          
          {/* AI Chatbot - Available on all pages */}
          <AIChatbot />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
