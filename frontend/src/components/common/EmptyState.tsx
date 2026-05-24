import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: LucideIcon;
    actionLabel?: string;
    onAction?: () => void;
    className?: string; // Allow custom styling augmentation
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon: Icon,
    actionLabel,
    onAction,
    className = '',
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 ${className}`}>
            {Icon && (
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                    <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
            )}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {title}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
