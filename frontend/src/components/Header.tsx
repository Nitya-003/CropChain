"use client";
import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Leaf, LogOut, Shield, Compass, Sparkles, User, LogIn, Menu, Home, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { CurrencyToggle } from "../components/CurrencyToggle";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import Sidebar from "./Sidebar";
import toast from 'react-hot-toast';

const Header: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const navItems = [
    { path: '/', label: t('nav.home'), icon: Home },
    { path: '/track-batch', label: t('nav.trackBatch'), icon: Compass },
    { path: '/crop-recommendation', label: t('nav.smartPlanting'), icon: Sparkles },
    ...(isAuthenticated && user?.role === 'farmer' ? [{ path: '/farmer', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(isAuthenticated && user?.role === 'mandi' ? [{ path: '/mandi', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(isAuthenticated && user?.role === 'transporter' ? [{ path: '/transporter', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(isAuthenticated && user?.role === 'retailer' ? [{ path: '/retailer', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(isAuthenticated && user?.role === 'admin' ? [
      { path: '/admin', label: 'Admin', icon: Shield },
      { path: '/verification', label: 'Verification', icon: Shield }
    ] : []),
  ];

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      router.push('/login');
    } catch {
      toast.error('Logout failed');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/30';
      case 'farmer':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-300/30';
      case 'mandi':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/30';
      case 'transporter':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30';
      case 'retailer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-700/30';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-colors duration-200">
      <div className="container mx-auto px-4">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3 md:grid md:h-16 md:grid-cols-3 md:flex-nowrap md:gap-0 md:py-0">
          
          {/* Logo Column (Left-aligned) */}
          <div className="flex min-w-0 flex-1 items-center justify-start md:flex-none">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="mr-2 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="group flex min-w-0 items-center space-x-2">
              <div className="shrink-0 bg-primary/10 p-2 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Leaf className="h-5 w-5 text-primary" />
              </div>
              <span className="truncate text-lg font-bold tracking-tight text-foreground bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
                CropChain
              </span>
            </Link>
          </div>

          {/* Navigation Links Column (Perfectly Centered) */}
          <div className="hidden md:flex justify-center">
            <nav className="flex items-center gap-1 bg-muted/65 dark:bg-muted/20 p-1 rounded-full border border-border/40 shadow-sm">
              <Link
                href="/"
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                  pathname === '/'
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('nav.home')}
              </Link>

              <Link
                href="/track-batch"
                className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                  pathname === '/track-batch'
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                {t('nav.trackBatch')}
              </Link>

              <Link
                href="/crop-recommendation"
                className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                  pathname === '/crop-recommendation'
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t('nav.smartPlanting')}
              </Link>

              {isAuthenticated && user?.role === 'farmer' && (
                <Link
                  href="/farmer"
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                    pathname === '/farmer'
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
              )}

              {isAuthenticated && user?.role === 'mandi' && (
                <Link
                  href="/mandi"
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                    pathname === '/mandi'
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
              )}

              {isAuthenticated && user?.role === 'transporter' && (
                <Link
                  href="/transporter"
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                    pathname === '/transporter'
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
              )}

              {isAuthenticated && user?.role === 'retailer' && (
                <Link
                  href="/retailer"
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                    pathname === '/retailer'
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
              )}

              {isAuthenticated && user?.role === 'admin' && (
                <>
                  <Link
                    href="/admin"
                    className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                      pathname === '/admin'
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Admin
                  </Link>
                  <Link
                    href="/verification"
                    className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                      pathname === '/verification'
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    Verification
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Action Area Column (Right-aligned) */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 md:flex-none md:flex-nowrap">
            <CurrencyToggle />
            <LanguageSwitcher />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 shrink-0 rounded-lg text-foreground hover:bg-muted border border-border bg-background dark:bg-card transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              )}
            </Button>

            {/* Auth Section */}
            {isAuthenticated && user ? (
              <div className="relative flex shrink-0 items-center gap-2 sm:pl-2">
                <Badge variant="outline" className={`hidden capitalize font-semibold border sm:inline-flex ${getRoleBadgeColor(user.role)}`}>
                  {user.role}
                </Badge>
                
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border/60 hover:bg-muted/50 text-foreground transition-all duration-200"
                    title="User Account"
                  >
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <span className="hidden lg:inline text-xs font-semibold max-w-[120px] truncate">{user.name}</span>
                  </button>

                  {isDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-30" 
                        onClick={() => setIsDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card text-foreground shadow-lg p-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                        <Link
                          href="/profile"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-foreground hover:bg-muted transition-colors"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          Profile Settings
                        </Link>
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            handleLogout();
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Log Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <Link href="/login" className="shrink-0 sm:pl-1">
                <Button variant="default" size="sm" className="h-9 rounded-lg gap-1.5 px-3 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/95 sm:px-4">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
            )}
          </div>

        </div>
      </div>
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} navItems={navItems} />
    </header>
  );
};

export default Header;
