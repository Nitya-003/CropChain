import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wheat, Plus, RefreshCw, Search, Shield, Sun, Moon, LogIn, LogOut, User, Sidebar as SidebarIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import Sidebar from './Sidebar';

const Header: React.FC = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();

  const allNavItems = [
    { path: '/', label: t('nav.home'), icon: Wheat, roles: ['*'] },
    { path: '/add-batch', label: t('nav.addBatch'), icon: Plus, roles: ['farmer'] },
    { path: '/update-batch', label: t('nav.updateLogistics'), icon: RefreshCw, roles: ['transporter'] },
    { path: '/track-batch', label: t('nav.trackBatch'), icon: Search, roles: ['farmer', 'transporter', 'admin'] },
    { path: '/admin', label: t('nav.admin'), icon: Shield, roles: ['admin'] },

  ];

  const navItems = allNavItems.filter((item) => {
    if (!isAuthenticated) return item.path === "/"; // Only Home for guests
    if (item.roles.includes("*")) return true;
    return user && item.roles.includes(user.role);
  });

  return (
    <header className="bg-white dark:bg-gray-800 shadow-lg border-b-4 border-green-500">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3 text-2xl font-bold text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors">
            <Wheat className="h-8 w-8" />
            <span>{t('app.title')}</span>
          </Link>

          <nav className='hidden md:flex items-center space-x-6'>
            <div className='flex space-x-4'>
              {navItems.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${location.pathname === path
                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 shadow-md"
                    : "text-gray-600 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-gray-700"
                    }`}
                >
                  <Icon className='h-4 w-4' />
                  <span className='font-medium'>{label}</span>
                </Link>
              ))}
            </div>

            <div className='h-6 w-px bg-gray-300 dark:bg-gray-600'></div>

            <div className="flex items-center space-x-3">
              {/* Language Switcher */}
              <LanguageSwitcher />

              <button
                onClick={toggleTheme}
                className='p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors'
                aria-label='Toggle dark mode'
              >
                {theme === "light" ? (
                  <Moon className='h-5 w-5' />
                ) : (
                  <Sun className='h-5 w-5' />
                )}
              </button>

              {isAuthenticated && user ? (
                <div className='flex items-center space-x-3'>
                  <div className='flex items-center space-x-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full'>
                    <User className='h-4 w-4 text-green-600 dark:text-green-400' />
                    <span className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                      {user.name}{" "}
                      <span className='text-xs text-gray-500'>
                        ({user.role})
                      </span>
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className='flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors'
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              ) : (
                <div className='flex items-center space-x-2'>
                  <Link
                    to='/login'
                    className='flex items-center space-x-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-green-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors'
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t('nav.login')}</span>
                  </Link>
                  <Link
                    to='/register'
                    className='px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm hover:shadow transition-all'
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}
            </div>
          </nav>
          <div className='md:hidden'>
            <button
              onClick={() => setIsSidebarOpen(true)} // This triggers the sidebar
              className='text-gray-600 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-400'
            >
              <SidebarIcon className='h-6 w-6' />
            </button>
          </div>
        </div>
      </div>
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        navItems={navItems}
      />
    </header>
  );
};

export default Header;
