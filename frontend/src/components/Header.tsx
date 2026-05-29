import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Leaf, LogOut, Shield, Compass, Sparkles, User, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { CurrencyToggle } from "../components/CurrencyToggle";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import toast from 'react-hot-toast';

const Header: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (err) {
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
        <div className="flex md:grid md:grid-cols-3 h-16 items-center justify-between">
          
          {/* Logo Column (Left-aligned) */}
          <div className="flex justify-start">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="bg-primary/10 p-2 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Leaf className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
                CropChain
              </span>
            </Link>
          </div>

          {/* Navigation Links Column (Perfectly Centered) */}
          <div className="hidden md:flex justify-center">
            <nav className="flex items-center gap-1 bg-muted/65 dark:bg-muted/20 p-1 rounded-full border border-border/40 shadow-sm">
              <Link
                to="/"
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                  location.pathname === '/'
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('nav.home')}
              </Link>

              <Link
                to="/track-batch"
                className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                  location.pathname === '/track-batch'
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                {t('nav.trackBatch')}
              </Link>

              <Link
                to="/crop-recommendation"
                className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                  location.pathname === '/crop-recommendation'
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t('nav.smartPlanting')}
              </Link>

              {isAuthenticated && user?.role === 'admin' && (
                <>
                  <Link
                    to="/admin"
                    className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                      location.pathname === '/admin'
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Admin
                  </Link>
                  <Link
                    to="/verification"
                    className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                      location.pathname === '/verification'
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
          <div className="flex justify-end items-center gap-2">
            <CurrencyToggle />
            <LanguageSwitcher />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg text-foreground hover:bg-muted border border-border bg-background dark:bg-card transition-colors"
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
              <div className="flex items-center gap-2 pl-2">
                <Badge variant="outline" className={`capitalize font-semibold border ${getRoleBadgeColor(user.role)}`}>
                  {user.role}
                </Badge>
                <div className="hidden lg:flex flex-col items-start leading-none">
                  <span className="text-xs font-semibold text-foreground">{user.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent"
                  title="Log Out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link to="/login" className="pl-1">
                <Button variant="default" size="sm" className="h-9 rounded-lg gap-1.5 px-4 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/95">
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;
