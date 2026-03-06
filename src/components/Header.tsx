import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, User, LayoutDashboard, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { CurrencyToggle } from "../components/CurrencyToggle";


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
            ))}
          </nav>

         <div className="flex items-center space-x-3">
          {/* Currency Toggle */}
           <CurrencyToggle />

          {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
          aria-label="Toggle dark mode"
    >
          {theme === "light" ? (
           <Moon className="h-5 w-5" />
          ) : (
           <Sun className="h-5 w-5" />
     )}
  </button>
</div>


          <div className="md:hidden">
            <button className="text-gray-600 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar Component */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} navItems={navItems} />
    </>
  );
};

export default Header;
