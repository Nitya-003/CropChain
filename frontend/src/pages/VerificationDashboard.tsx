import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, UserX, AlertCircle, RefreshCw } from 'lucide-react';
import { verificationService, UnverifiedUser, VerifiedUser } from '../services/verificationService';
import VerificationBadge from '../components/VerificationBadge';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import toast from 'react-hot-toast';

const VerificationDashboard: React.FC = () => {
    const { user } = useAuth();
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
            <div className="min-h-[60vh] flex items-center justify-center py-12">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        Only authenticated administrators are authorized to access the KYC Verification system.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 py-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-3 rounded-2xl">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Verification Dashboard</h1>
                        <p className="text-sm text-muted-foreground">Manage user KYC statuses, credentials, and decentralised identities</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-1.5 bg-background/50">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync Directory
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border border-border bg-card">
                    <CardContent className="flex items-center justify-between p-6">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Pending Verifications</span>
                            <div className="text-3xl font-bold tracking-tight text-amber-500">{unverifiedUsers.length}</div>
                        </div>
                        <div className="bg-amber-500/10 p-3 rounded-2xl">
                            <UserX className="w-8 h-8 text-amber-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border bg-card">
                    <CardContent className="flex items-center justify-between p-6">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Verified Network Users</span>
                            <div className="text-3xl font-bold tracking-tight text-emerald-500">{verifiedUsers.length}</div>
                        </div>
                        <div className="bg-emerald-500/10 p-3 rounded-2xl">
                            <UserCheck className="w-8 h-8 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs & Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div className="flex gap-2">
                    <Button
                        variant={activeTab === 'unverified' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('unverified')}
                        className="font-medium"
                    >
                        Pending Directory ({unverifiedUsers.length})
                    </Button>
                    <Button
                        variant={activeTab === 'verified' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('verified')}
                        className="font-medium"
                    >
                        Verified Directory ({verifiedUsers.length})
                    </Button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Network Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Loading Indicator */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                </div>
            ) : (
                <Card className="border border-border bg-card">
                    <CardContent className="p-0">
                        {activeTab === 'unverified' ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">User Name</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">Role</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">Wallet Address</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">KYC Status</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {unverifiedUsers.map((item) => (
                                            <TableRow key={item._id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                                                <TableCell className="py-4 px-6">
                                                    <div>
                                                        <div className="font-medium text-foreground text-sm">{item.name}</div>
                                                        <div className="text-xs text-muted-foreground">{item.email}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    <Badge variant="secondary" className="capitalize font-semibold">
                                                        {item.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-4 px-6 font-mono text-xs text-muted-foreground">
                                                    {item.walletAddress ? (
                                                        <code>
                                                            {item.walletAddress.slice(0, 6)}...{item.walletAddress.slice(-4)}
                                                        </code>
                                                    ) : (
                                                        <span className="text-rose-500 italic">Not Linked</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    <VerificationBadge isVerified={false} size="sm" />
                                                </TableCell>
                                                <TableCell className="py-4 px-6 text-right">
                                                    <Button
                                                        onClick={() => handleVerify(item._id, item.walletAddress || '')}
                                                        disabled={!item.walletAddress || processingUserId === item._id}
                                                        size="sm"
                                                        className="font-medium"
                                                    >
                                                        {processingUserId === item._id ? 'Verifying...' : 'Verify User'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {unverifiedUsers.length === 0 && (
                                    <div className="text-center py-12 text-sm text-muted-foreground">
                                        No pending verifications found
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">User Name</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">Role</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">Verified By</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">KYC Status</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {verifiedUsers.map((item) => (
                                            <TableRow key={item._id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                                                <TableCell className="py-4 px-6">
                                                    <div>
                                                        <div className="font-medium text-foreground text-sm">{item.name}</div>
                                                        <div className="text-xs text-muted-foreground">{item.email}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    <Badge variant="secondary" className="capitalize font-semibold">
                                                        {item.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-4 px-6 text-sm text-muted-foreground">
                                                    {item.verification.verifiedBy.name}
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    <VerificationBadge isVerified={true} size="sm" />
                                                </TableCell>
                                                <TableCell className="py-4 px-6 text-right">
                                                    <Button
                                                        onClick={() => handleRevoke(item._id)}
                                                        disabled={processingUserId === item._id}
                                                        variant="destructive"
                                                        size="sm"
                                                        className="font-medium"
                                                    >
                                                        {processingUserId === item._id ? 'Revoking...' : 'Revoke'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {verifiedUsers.length === 0 && (
                                    <div className="text-center py-12 text-sm text-muted-foreground">
                                        No verified users in directory
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default VerificationDashboard;
