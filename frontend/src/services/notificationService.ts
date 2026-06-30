import { apiClient } from './apiClient';
import { Notification, PaginatedNotifications, UnreadCountResponse } from '../types/notification';

export const notificationService = {
    getNotifications: async (limit: number = 50): Promise<Notification[]> => {
        const response = await apiClient.get<PaginatedNotifications>(`/notifications?limit=${limit}`);
        return response.data.data.notifications; // Because apiResponse uses { data: { notifications } }
    },

    getUnreadCount: async (): Promise<number> => {
        const response = await apiClient.get<UnreadCountResponse>('/notifications/unread-count');
        return response.data.data.count;
    },

    markAsRead: async (id: string): Promise<Notification> => {
        const response = await apiClient.put(`/notifications/${id}/read`);
        return response.data.data.notification;
    },

    markAllAsRead: async (): Promise<void> => {
        await apiClient.put('/notifications/read-all');
    }
};
