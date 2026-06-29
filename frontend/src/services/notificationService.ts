import axiosInstance from './axiosInstance';
import { Notification, PaginatedNotifications, UnreadCountResponse } from '../types/notification';

export const notificationService = {
    getNotifications: async (limit: number = 50): Promise<Notification[]> => {
        const response = await axiosInstance.get<PaginatedNotifications>(`/api/notifications?limit=${limit}`);
        return response.data.data.notifications; // Because apiResponse uses { data: { notifications } }
    },

    getUnreadCount: async (): Promise<number> => {
        const response = await axiosInstance.get<UnreadCountResponse>('/api/notifications/unread-count');
        return response.data.data.count;
    },

    markAsRead: async (id: string): Promise<Notification> => {
        const response = await axiosInstance.put(`/api/notifications/${id}/read`);
        return response.data.data.notification;
    },

    markAllAsRead: async (): Promise<void> => {
        await axiosInstance.put('/api/notifications/read-all');
    }
};
