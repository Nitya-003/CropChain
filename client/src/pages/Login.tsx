import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const { login, user, isLoading } = useAuth(); // <--- This will work now
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-green-100 dark:bg-green-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {t('auth.welcomeBack')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {t('auth.loginSubtitle')}
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={login}
            disabled={isLoading}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed opacity-70' 
                : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105 shadow-md'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Wallet className="h-5 w-5" />
                <span>{t('auth.connectWallet')}</span>
              </>
            )}
          </button>
          
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            <p>Make sure you have MetaMask installed</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;