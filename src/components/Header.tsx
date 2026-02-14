import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast'; // <--- Using the new library

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully'); // <--- Updated line
    navigate('/login');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-green-600 p-2 rounded-lg">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800 dark:text-white">CropChain</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              {t('nav.home')}
            </Link>
            
            {user ? (
              <>
                <Link to="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                  {t('nav.dashboard')}
                </Link>
                <Link to="/add-batch" className="text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                  {t('nav.addBatch')}
                </Link>
                
                <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700">
                  <button onClick={toggleLanguage} className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-medium">
                    {i18n.language.toUpperCase()}
                  </button>
                  
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-200">
                    <User className="h-5 w-5" />
                    <span className="font-medium">{user.name}</span>
                  </div>
                  
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                    title={t('auth.logout')}
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <button onClick={toggleLanguage} className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-medium">
                  {i18n.language.toUpperCase()}
                </button>
                <Link to="/login" className="text-gray-600 dark:text-gray-300 hover:text-green-600 font-medium">
                  {t('auth.login')}
                </Link>
                <Link to="/register" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg">
                  {t('auth.register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-4">
            <button onClick={toggleLanguage} className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium">
              {i18n.language.toUpperCase()}
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 dark:text-gray-300">
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-t dark:border-gray-700 px-4 py-2 shadow-lg">
          <div className="flex flex-col space-y-4 py-4">
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="text-gray-600 dark:text-gray-300">
              {t('nav.home')}
            </Link>
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="text-gray-600 dark:text-gray-300">
                  {t('nav.dashboard')}
                </Link>
                <Link to="/add-batch" onClick={() => setIsMenuOpen(false)} className="text-gray-600 dark:text-gray-300">
                  {t('nav.addBatch')}
                </Link>
                <button onClick={handleLogout} className="text-red-500 flex items-center space-x-2">
                  <LogOut className="h-5 w-5" />
                  <span>{t('auth.logout')}</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMenuOpen(false)} className="text-gray-600 dark:text-gray-300">
                  {t('auth.login')}
                </Link>
                <Link to="/register" onClick={() => setIsMenuOpen(false)} className="text-green-600 font-bold">
                  {t('auth.register')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;