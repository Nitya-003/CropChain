"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, Check, CheckCircle2, AlertTriangle, RefreshCcw, Info, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Notification } from '../../types/notification';

export default function NotificationsPage() {
    const { t } = useTranslation();
    const { notifications, loading, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
    const [filter, setFilter] = useState<'all' | 'unread' | 'alerts'>('all');

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.read;
        if (filter === 'alerts') return n.type === 'alert' || n.type === 'recall';
        return true;
    });

    const getIconForType = (type: string) => {
        switch (type) {
            case 'alert':
                return <AlertTriangle className="h-5 w-5 text-amber-500" />;
            case 'recall':
                return <ShieldAlert className="h-5 w-5 text-rose-500" />;
            case 'sync':
                return <RefreshCcw className="h-5 w-5 text-blue-500" />;
            case 'approval':
                return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            default:
                return <Info className="h-5 w-5 text-indigo-500" />;
        }
    };

    const getBgColorForType = (type: string, read: boolean) => {
        if (read) return 'bg-card border-border/40';
        switch (type) {
            case 'alert': return 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/5';
            case 'recall': return 'bg-rose-500/10 border-rose-500/30 dark:bg-rose-500/5';
            default: return 'bg-primary/5 border-primary/20 dark:bg-primary/10';
        }
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">{t('notifications.loadingNotifications')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Bell className="h-8 w-8 text-primary" />
                        {t('notifications.title')}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t('notifications.subtitle')}</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={markAllAsRead}
                        className="font-semibold"
                        disabled={!notifications.some(n => !n.read)}
                    >
                        <Check className="mr-2 h-4 w-4" />
                        {t('notifications.markAllAsRead')}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => fetchNotifications()}
                    >
                        <RefreshCcw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 mb-6 border-b border-border/40 pb-4 overflow-x-auto">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                        filter === 'all' 
                        ? 'bg-foreground text-background shadow-sm' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                >
                    {t('notifications.allNotifications')}
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                        filter === 'unread' 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                >
                    {t('notifications.unread')}
                </button>
                <button
                    onClick={() => setFilter('alerts')}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                        filter === 'alerts' 
                        ? 'bg-rose-500 text-white shadow-sm' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                >
                    {t('notifications.criticalAlerts')}
                </button>
            </div>

            <div className="space-y-4">
                {filteredNotifications.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-muted/20 rounded-2xl border border-dashed border-border">
                        <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-foreground">{t('notifications.noNotificationsFound')}</h3>
                        <p className="text-muted-foreground">{t('notifications.allCaughtUp')}</p>
                    </div>
                ) : (
                    filteredNotifications.map((notification) => (
                        <div 
                            key={notification._id}
                            className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-md flex gap-4 ${getBgColorForType(notification.type, notification.read)}`}
                        >
                            <div className="shrink-0 mt-1">
                                {getIconForType(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                                    <h4 className={`font-bold text-base truncate ${notification.read ? 'text-foreground' : 'text-foreground'}`}>
                                        {notification.title}
                                    </h4>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                                        {new Date(notification.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <p className={`mt-1 text-sm ${notification.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                                    {notification.message}
                                </p>
                                
                                {!notification.read && (
                                    <div className="mt-3">
                                        <button
                                            onClick={() => markAsRead(notification._id)}
                                            className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                            {t('notifications.markAsRead')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
