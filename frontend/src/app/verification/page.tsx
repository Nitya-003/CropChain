"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, UserCheck, UserX, AlertCircle, RefreshCw, Download, Upload } from 'lucide-react';
import StatsCardSkeleton from '../../components/skeletons/StatsCardSkeleton';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { apiClient } from '../../services/apiClient';
import { verificationService, UnverifiedUser, VerifiedUser } from '../../services/verificationService';
import VerificationBadge from '../../components/VerificationBadge';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import toast from 'react-hot-toast';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useVerificationSocket } from '../../hooks/useVerificationSocket';
import { RevocationModal } from '../../components/RevocationModal';

const VerificationDashboardComponent: React.FC = () => {
    const { user } = useAuth();
    const [unverifiedUsers, setUnverifiedUsers] = useState<UnverifiedUser[]>([]);
    const [verifiedUsers, setVerifiedUsers] = useState<VerifiedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'unverified' | 'verified'>('unverified');
    const [processingUserId, setProcessingUserId] = useState<string | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

    // Bulk CSV upload state
    const [uploadErrors, setUploadErrors] = useState<Array<{ row: number; data: Record<string, string>; errors: string[] }>>([]);
    const [uploading, setUploading] = useState(false);

    const downloadTemplate = async () => {
        try {
            const response = await apiClient.get('/verification/bulk/template', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'bulk-verification-template.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Template downloaded');
        } catch {
            toast.error('Failed to download template');
        }
    };

    const handleBulkUpload = async (file: File) => {
        try {
            setUploading(true);
            setUploadErrors([]);
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await apiClient.post('/verification/bulk/issue-credential', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (data.structuredErrors?.length > 0) {
                setUploadErrors(data.structuredErrors);
                toast.error(`${data.structuredErrors.length} row(s) have validation errors`);
            } else {
                toast.success(`Bulk job initiated! Job ID: ${data.data?.jobId}`);
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { structuredErrors?: Array<{ row: number; data: Record<string, string>; errors: string[] }> } } };
            if (axiosErr.response?.data?.structuredErrors) {
                setUploadErrors(axiosErr.response.data.structuredErrors);
            }
            const message = err instanceof Error ? err.message : 'Upload failed';
            toast.error(message);
        } finally {
            setUploading(false);
        }
    };

    const downloadErrorCsv = () => {
        const headers = ['Row', ...Object.keys(uploadErrors[0]?.data || {}), 'Errors'];
        const rows = uploadErrors.map(e => [
            String(e.row),
            ...Object.values(e.data).map(v => `"${String(v).replace(/"/g, '""')}"`),
            `"${e.errors.join('; ').replace(/"/g, '""')}"`,
        ].join(','));
        const csv = [headers.join(','), ...rows, ''].join('\n');
        const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'bulk-verification-errors.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    // Dynamic row statuses driven by websocket updates
    const [rowStatuses, setRowStatuses] = useState<Record<string, 'in_progress' | 'verified' | 'failed' | 'linked' | 'unverified' | null>>({});

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

    // Memoize all active user IDs to join room subscriptions for
    const allUserIds = useMemo(() => {
        return [
            ...unverifiedUsers.map(u => u._id),
            ...verifiedUsers.map(u => u._id)
        ];
    }, [unverifiedUsers, verifiedUsers]);

    // Handle incoming socket status updates
    const handleVerificationSocketUpdate = useCallback((data: any) => {
        console.log('[SOCKET EVENT] Verification update:', data);
        if (data?.userId && data?.newState) {
            setRowStatuses(prev => ({
                ...prev,
                [data.userId]: data.newState
            }));
            
            // On completion states, sync directory database view
            if (['verified', 'linked', 'unverified'].includes(data.newState)) {
                fetchUsers();
                // Retain success badge momentarily, then clear
                setTimeout(() => {
                    setRowStatuses(prev => {
                        const copy = { ...prev };
                        delete copy[data.userId];
                        return copy;
                    });
                }, 3000);
            }
        }
    }, [unverifiedUsers, verifiedUsers]);

    const { isConnected: socketConnected } = useVerificationSocket({
        userIds: allUserIds,
        onVerificationUpdate: handleVerificationSocketUpdate
    });

    const handleVerify = async (userId: string, walletAddress: string) => {
        try {
            setProcessingUserId(userId);
            setRowStatuses(prev => ({ ...prev, [userId]: 'in_progress' }));
            await verificationService.issueCredential(userId, walletAddress);
            await fetchUsers();
            toast.success('User verified successfully!');
        } catch (err: unknown) {
            setRowStatuses(prev => ({ ...prev, [userId]: 'failed' }));
            const errorMessage = err instanceof Error ? err.message : 'Failed to verify user';
            toast.error(errorMessage);
        } finally {
            setProcessingUserId(null);
        }
    };

    const handleRevoke = (userId: string, userName: string) => {
        setRevokeTarget({ id: userId, name: userName });
    };

    const handleRevokeConfirm = async (reason: string) => {
        if (!revokeTarget) return;
        const { id: userId } = revokeTarget;

        setRevokeTarget(null);

        try {
            setProcessingUserId(userId);
            setRowStatuses(prev => ({ ...prev, [userId]: 'in_progress' }));
            await verificationService.revokeCredential(userId, reason);
            await fetchUsers();
            toast.success('Credential revoked successfully!');
        } catch (err: unknown) {
            setRowStatuses(prev => ({ ...prev, [userId]: 'failed' }));
            const errorMessage = err instanceof Error ? err.message : 'Failed to revoke credential';
            toast.error(errorMessage);
        } finally {
            setProcessingUserId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 py-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-3 rounded-2xl">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-left">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Verification Dashboard</h1>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                            {socketConnected ? 'Live Connection Active' : 'Connecting to Live Updates...'}
                        </div>
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
                        <div className="space-y-1 text-left">
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
                        <div className="space-y-1 text-left">
                            <span className="text-sm font-medium text-muted-foreground">Verified Network Users</span>
                            <div className="text-3xl font-bold tracking-tight text-emerald-500">{verifiedUsers.length}</div>
                        </div>
                        <div className="bg-emerald-500/10 p-3 rounded-2xl">
                            <UserCheck className="w-8 h-8 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bulk CSV Verification */}
            <Card className="border border-border bg-card">
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">Bulk CSV Verification</h3>
                            <p className="text-sm text-muted-foreground mt-1">Upload a CSV file to issue credentials in bulk</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
                                <Download className="h-3.5 w-3.5" />
                                Download Template
                            </Button>
                            <label className="cursor-pointer">
                                <Button variant="default" size="sm" className="gap-1.5" asChild disabled={uploading}>
                                    <span>
                                        <Upload className="h-3.5 w-3.5" />
                                        {uploading ? 'Uploading...' : 'Upload CSV'}
                                    </span>
                                </Button>
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    disabled={uploading}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleBulkUpload(file);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    {uploadErrors.length > 0 && (
                        <div className="mt-6 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-rose-500">
                                    Validation Errors ({uploadErrors.length} row{uploadErrors.length > 1 ? 's' : ''})
                                </h4>
                                <Button variant="outline" size="sm" onClick={downloadErrorCsv} className="gap-1.5">
                                    <Download className="h-3 w-3" />
                                    Download Error CSV
                                </Button>
                            </div>
                            <div className="overflow-x-auto border border-border/40 rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 text-left">
                                            <TableHead className="py-3 px-4 font-semibold text-foreground">Row</TableHead>
                                            <TableHead className="py-3 px-4 font-semibold text-foreground">Data</TableHead>
                                            <TableHead className="py-3 px-4 font-semibold text-foreground">Errors</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {uploadErrors.map((err, i) => (
                                            <TableRow key={i} className="border-b border-border/40 text-left">
                                                <TableCell className="py-3 px-4 font-mono text-sm">{err.row}</TableCell>
                                                <TableCell className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                                                    {JSON.stringify(err.data)}
                                                </TableCell>
                                                <TableCell className="py-3 px-4 text-sm text-rose-600">
                                                    {err.errors.join('; ')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

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
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <StatsCardSkeleton />
                        <StatsCardSkeleton />
                    </div>
                    <div className="border border-border bg-card rounded-xl p-6">
                        <div className="h-6 bg-muted rounded w-48 mb-4 animate-pulse"></div>
                        <TableSkeleton />
                    </div>
                </div>
            ) : (
                <Card className="border border-border bg-card">
                    <CardContent className="p-0">
                        {activeTab === 'unverified' ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40 text-left">
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">User Name</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">Role</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">Wallet Address</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">KYC Status</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {unverifiedUsers.map((item) => (
                                            <TableRow key={item._id} className="border-b border-border/40 hover:bg-muted/30 transition-colors text-left">
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
                                                    {rowStatuses[item._id] === 'in_progress' ? (
                                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold animate-pulse">
                                                            In Progress
                                                        </Badge>
                                                    ) : rowStatuses[item._id] === 'failed' ? (
                                                        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-semibold">
                                                            Failed
                                                        </Badge>
                                                    ) : (
                                                        <VerificationBadge isVerified={false} size="sm" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-4 px-6 text-right">
                                                    <Button
                                                        onClick={() => handleVerify(item._id, item.walletAddress || '')}
                                                        disabled={!item.walletAddress || processingUserId === item._id || rowStatuses[item._id] === 'in_progress'}
                                                        size="sm"
                                                        className="font-medium"
                                                    >
                                                        {rowStatuses[item._id] === 'in_progress' ? 'Verifying...' : 'Verify User'}
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
                                        <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40 text-left">
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">User Name</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">Role</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">Verified By</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground">KYC Status</TableHead>
                                            <TableHead className="py-4 px-6 font-semibold text-foreground text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {verifiedUsers.map((item) => (
                                            <TableRow key={item._id} className="border-b border-border/40 hover:bg-muted/30 transition-colors text-left">
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
                                                    {item.verification?.verifiedBy?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    {rowStatuses[item._id] === 'in_progress' ? (
                                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold animate-pulse">
                                                            Revoking...
                                                        </Badge>
                                                    ) : rowStatuses[item._id] === 'failed' ? (
                                                        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-semibold">
                                                            Failed Revoke
                                                        </Badge>
                                                    ) : (
                                                        <VerificationBadge isVerified={true} size="sm" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-4 px-6 text-right">
                                                    <Button
                                                        onClick={() => handleRevoke(item._id, item.name)}
                                                        disabled={processingUserId === item._id || rowStatuses[item._id] === 'in_progress'}
                                                        variant="destructive"
                                                        size="sm"
                                                        className="font-medium"
                                                    >
                                                        {rowStatuses[item._id] === 'in_progress' ? 'Revoking...' : 'Revoke'}
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

            <RevocationModal
                open={revokeTarget !== null}
                onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
                onClose={() => setRevokeTarget(null)}
                userName={revokeTarget?.name || ''}
                onConfirm={handleRevokeConfirm}
                isProcessing={processingUserId === revokeTarget?.id}
            />
        </div>
    );
};

export default function VerificationDashboardPage() {
    return (
        <ProtectedRoute allowedRoles={['admin']}>
            <VerificationDashboardComponent />
        </ProtectedRoute>
    );
}
