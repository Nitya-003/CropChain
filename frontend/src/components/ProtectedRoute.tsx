"use client";
import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: ('farmer' | 'mandi' | 'transporter' | 'retailer' | 'admin' | 'quality_inspector')[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps): React.ReactNode => {
    const { user, isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                router.replace(`/login?from=${encodeURIComponent(pathname)}`);
            } else if (allowedRoles && user && !allowedRoles.includes(user.role.toLowerCase() as any)) {
                router.replace('/access-denied');
            }
        }
    }, [isLoading, isAuthenticated, user, allowedRoles, router, pathname]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role.toLowerCase() as any)) {
        return null;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
