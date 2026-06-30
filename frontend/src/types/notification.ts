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

export interface PaginatedNotifications {
    notifications: Notification[];
}

export interface UnreadCountResponse {
    count: number;
}
