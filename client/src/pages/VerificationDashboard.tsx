import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, UserCheck, UserX, AlertCircle } from 'lucide-react';
import { verificationService, UnverifiedUser, VerifiedUser } from '../services/verificationService';
import VerificationBadge from '../components/VerificationBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const VerificationDashboard: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [unverifiedUsers, setUnverifiedUsers] = useState<UnverifiedUser[]>([]);
    const [verifiedUsers, setVerifiedUsers] = useState<VerifiedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'unverified' | 'verified'>('unverified');
    const [processingUserId, setProcessingUserId] = useState<string | null>(null);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchUsers();
        }
    }, [user]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const [unverified, verified] = await Promise.all([
                verificationService.getUnverifiedUsers(),
                verificationService.getVerifiedUsers(),
            ]);
            setUnverifiedUsers(unverified);
            setVerifiedUsers(verified);
        } catch (err) {
            setError('Failed to fetch users');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (userId: string, walletAddress: string) => {
        try {
            setProcessingUserId(userId);
            await verificationService.issueCredential(userId, walletAddress);
            await fetchUsers();
            toast.success('User verified successfully!');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to verify user';
            toast.error(errorMessage);
        } finally {
            setProcessingUserId(null);
        }
    };

    const handleRevoke = async (userId: string) => {
        const reason = prompt('Enter revocation reason:');
        if (!reason) return;

        try {
            setProcessingUserId(userId);
            await verificationService.revokeCredential(userId, reason);
            await fetchUsers();
            toast.success('Credential revoked successfully!');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to revoke credential';
            toast.error(errorMessage);
        } finally {
            setProcessingUserId(null);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                        Access Denied
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Only admins can access the verification dashboard
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto"
            >
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="w-8 h-8 text-green-600" />
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                            Verification Dashboard
                        </h1>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage user verifications and credentials
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    Unverified Users
                                </p>
                                <p className="text-3xl font-bold text-orange-600">
                                    {unverifiedUsers.length}
                                </p>
                            </div>
                            <UserX className="w-12 h-12 text-orange-500 opacity-50" />
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    Verified Users
                                </p>
                                <p className="text-3xl font-bold text-green-600">
                                    {verifiedUsers.length}
                                </p>
                            </div>
                            <UserCheck className="w-12 h-12 text-green-500 opacity-50" />
                        </div>
                    </motion.div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('unverified')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${
                            activeTab === 'unverified'
                                ? 'bg-orange-500 text-white shadow-lg'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        Unverified ({unverifiedUsers.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('verified')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${
                            activeTab === 'verified'
                                ? 'bg-green-500 text-white shadow-lg'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        Verified ({verifiedUsers.length})
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                        {error}
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    </div>
                ) : (
                    <>
                        {/* Unverified Users */}
                        {activeTab === 'unverified' && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    User
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Role
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Wallet
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {unverifiedUsers.map((user) => (
                                                <tr key={user._id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {user.name}
                                                            </div>
                                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                {user.email}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {user.walletAddress ? (
                                                            <code className="text-xs">
                                                                {user.walletAddress.slice(0, 6)}...
                                                                {user.walletAddress.slice(-4)}
                                                            </code>
                                                        ) : (
                                                            'Not linked'
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <VerificationBadge isVerified={false} size="sm" />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <button
                                                            onClick={() =>
                                                                handleVerify(user._id, user.walletAddress || '')
                                                            }
                                                            disabled={
                                                                !user.walletAddress ||
                                                                processingUserId === user._id
                                                            }
                                                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            {processingUserId === user._id
                                                                ? 'Processing...'
                                                                : 'Verify'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {unverifiedUsers.length === 0 && (
                                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                            No unverified users
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Verified Users */}
                        {activeTab === 'verified' && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    User
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Role
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Verified By
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {verifiedUsers.map((user) => (
                                                <tr key={user._id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {user.name}
                                                            </div>
                                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                {user.email}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {user.verification.verifiedBy.name}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <VerificationBadge isVerified={true} size="sm" />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <button
                                                            onClick={() => handleRevoke(user._id)}
                                                            disabled={processingUserId === user._id}
                                                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            {processingUserId === user._id
                                                                ? 'Processing...'
                                                                : 'Revoke'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {verifiedUsers.length === 0 && (
                                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                            No verified users
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </div>
    );
};

export default VerificationDashboard;
