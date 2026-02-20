import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, User, LayoutDashboard, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import LanguageSwitcher from './LanguageSwitcher';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: t('nav.home'), icon: LayoutDashboard },
    { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/add-batch', label: t('nav.addBatch'), icon: LayoutDashboard }, // Using LayoutDashboard as placeholder if specific icon not available
  ];

  return (
    <>
      <header className="bg-white dark:bg-gray-800 shadow-lg sticky top-0 z-50 transition-colors duration-200">
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
              <Link to="/" className={`text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors ${location.pathname === '/' ? 'text-green-600 dark:text-green-400 font-medium' : ''}`}>
                {t('nav.home')}
              </Link>

              {user ? (
                <>
                  <Link to="/dashboard" className={`text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors ${location.pathname === '/dashboard' ? 'text-green-600 dark:text-green-400 font-medium' : ''}`}>
                    {t('nav.dashboard')}
                  </Link>
                  <Link to="/add-batch" className={`text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors ${location.pathname === '/add-batch' ? 'text-green-600 dark:text-green-400 font-medium' : ''}`}>
                    {t('nav.addBatch')}
                  </Link>

                  <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700">
                    <button
                      onClick={toggleTheme}
                      className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      aria-label="Toggle theme"
                    >
                      {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    </button>

                    <LanguageSwitcher />

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
                  <button
                    onClick={toggleTheme}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    aria-label="Toggle theme"
                  >
                    {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  </button>

                  <LanguageSwitcher />

                  <Link to="/login" className="text-gray-600 dark:text-gray-300 hover:text-green-600 font-medium">
                    {t('nav.login')}
                  </Link>
                  <Link to="/register" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg">
                    {t('nav.register')}
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>
              <LanguageSwitcher />
              <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600 dark:text-gray-300">
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar Component */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} navItems={navItems} />
    </>
  );
};

export default Header;
