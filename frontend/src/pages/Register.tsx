import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mail, Lock, User, Briefcase, Loader, AlertCircle } from 'lucide-react';

const Register: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'farmer' | 'transporter'>('farmer');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { t } = useTranslation();
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const isMinLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        if (!isMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
            setError('Password must meet all complexity requirements listed below.');
            return;
        }

        setIsSubmitting(true);

        try {
            await register({ name, email, password, role });
            // Navigation handled by AuthContext storing user/token, but we can double check
            navigate('/dashboard');
        } catch (err: any) {
            // Error display handled by toast in context, but also setting local error state for inline display
            setError(err.response?.data?.message || 'Failed to register. Please check your details.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-8 px-4 mb-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-green-800 p-6 text-center">
                    <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                        <UserPlus className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">{t('auth.registerTitle')}</h2>
                    <p className="text-green-100 mt-2">Join the CropChain network</p>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2 text-red-600 dark:text-red-300 text-sm">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('auth.name')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('auth.email')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('auth.password')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                                    placeholder="Enter secure password"
                                />
                            </div>
                            
                            {/* Password complexity helper */}
                            <div className="mt-2.5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-150 dark:border-gray-650 space-y-1.5 text-xs">
                                <p className="text-gray-500 dark:text-gray-400 font-medium">Password must contain:</p>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono">
                                    <span className={(password.length >= 8) ? "text-green-600 dark:text-green-400 flex items-center font-medium" : "text-gray-400 flex items-center"}>
                                        <span className="mr-1">{(password.length >= 8) ? "✓" : "○"}</span> Min 8 chars
                                    </span>
                                    <span className={/[A-Z]/.test(password) ? "text-green-600 dark:text-green-400 flex items-center font-medium" : "text-gray-400 flex items-center"}>
                                        <span className="mr-1">{/[A-Z]/.test(password) ? "✓" : "○"}</span> 1 Uppercase
                                    </span>
                                    <span className={/[a-z]/.test(password) ? "text-green-600 dark:text-green-400 flex items-center font-medium" : "text-gray-400 flex items-center"}>
                                        <span className="mr-1">{/[a-z]/.test(password) ? "✓" : "○"}</span> 1 Lowercase
                                    </span>
                                    <span className={/[0-9]/.test(password) ? "text-green-600 dark:text-green-400 flex items-center font-medium" : "text-gray-400 flex items-center"}>
                                        <span className="mr-1">{/[0-9]/.test(password) ? "✓" : "○"}</span> 1 Number
                                    </span>
                                    <span className={/[^A-Za-z0-9]/.test(password) ? "text-green-600 dark:text-green-400 flex items-center font-medium col-span-2" : "text-gray-400 flex items-center col-span-2"}>
                                        <span className="mr-1">{/[^A-Za-z0-9]/.test(password) ? "✓" : "○"}</span> 1 Special character
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('auth.role')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Briefcase className="h-5 w-5 text-gray-400" />
                                </div>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as any)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                                >
                                    <option value="farmer">{t('auth.farmer')}</option>
                                    <option value="transporter">{t('auth.transporter')}</option>
                                </select>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Determines your permissions and dashboard view.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    {t('common.loading')}
                                </>
                            ) : (
                                t('auth.registerButton')
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{t('auth.haveAccount')}</span>{' '}
                        <Link to="/login" className="font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300">
                            {t('nav.login')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
