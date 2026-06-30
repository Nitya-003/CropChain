import api from './api';

export interface NotificationData {
    batchId?: string;
    stage?: string;
    temperature?: number;
    humidity?: number;
    [key: string]: any;
}

export interface Notification {
    _id: string;
    user: string;
    title: string;
    message: string;
    type: 'update' | 'alert' | 'recall' | 'sync' | 'approval';
    read: boolean;
    data?: NotificationData;
    createdAt: string;
    updatedAt: string;
}

export const NotificationService = {
    getNotifications: async (limit: number = 50): Promise<Notification[]> => {
        try {
            const response = await api.get(`/notifications?limit=${limit}`);
            return response.data.data.notifications;
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            throw error;
        }
    },

    getUnreadCount: async (): Promise<number> => {
        try {
            const response = await api.get('/notifications/unread-count');
            return response.data.data.count;
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
            throw error;
        }
    },

    markAsRead: async (id: string): Promise<Notification> => {
        try {
            const response = await api.put(`/notifications/${id}/read`);
            return response.data.data.notification;
        } catch (error) {
            console.error('Failed to mark as read:', error);
            throw error;
        }
    },

    markAllAsRead: async (): Promise<void> => {
        try {
            await api.put('/notifications/read-all');
        } catch (error) {
            console.error('Failed to mark all as read:', error);
            throw error;
        }
    }
};
