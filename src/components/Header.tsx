import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wheat, Plus, RefreshCw, Search, Shield } from 'lucide-react';

const Header: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Wheat },
    { path: '/add-batch', label: 'Add Batch', icon: Plus },
    { path: '/update-batch', label: 'Update Batch', icon: RefreshCw },
    { path: '/track-batch', label: 'Track Batch', icon: Search },
    { path: '/admin', label: 'Admin', icon: Shield },
  ];

  return (
    <header className="bg-white shadow-lg border-b-4 border-green-500">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3 text-2xl font-bold text-green-700 hover:text-green-800 transition-colors">
            <Wheat className="h-8 w-8" />
            <span>CropChain</span>
          </Link>
          
          <nav className="hidden md:flex space-x-8">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                  location.pathname === path
                    ? 'bg-green-100 text-green-700 shadow-md'
                    : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="md:hidden">
            <button className="text-gray-600 hover:text-green-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
