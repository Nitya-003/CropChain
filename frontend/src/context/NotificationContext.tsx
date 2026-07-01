"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Notification } from '../types/notification';
import { notificationService } from '../services/notificationService';
import { onNewNotification } from '../services/socketService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const { isAuthenticated, user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchNotifications = async () => {
        if (!isAuthenticated) return;
        try {
            setLoading(true);
            const [fetchedNotifications, count] = await Promise.all([
                notificationService.getNotifications(),
                notificationService.getUnreadCount()
            ]);
            setNotifications(fetchedNotifications);
            setUnreadCount(count);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev => 
                prev.map(n => n._id === id ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            toast.error('Failed to mark notification as read');
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            toast.error('Failed to mark all as read');
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();
            // Polling every 60 seconds
            const interval = setInterval(fetchNotifications, 60000);
            
            // Listen for real-time notifications via WebSocket
            const cleanupSocket = onNewNotification((newNotification: Notification) => {
                setNotifications(prev => [newNotification, ...prev]);
                setUnreadCount(prev => prev + 1);
                toast.success(newNotification.title || 'New Notification');
            });

            return () => {
                clearInterval(interval);
                cleanupSocket();
            };
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [isAuthenticated, user]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            fetchNotifications,
            markAsRead,
            markAllAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
