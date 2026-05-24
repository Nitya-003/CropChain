import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    title = "Something went wrong",
    message,
    onRetry,
    className = '',
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 ${className}`}>
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full mb-4">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-red-900 dark:text-red-200 mb-2">
                {title}
            </h3>
            <p className="text-red-600 dark:text-red-300 max-w-sm mb-6">
                {message}
            </p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-sm"
                >
                    <RotateCcw className="h-4 w-4" />
                    Try Again
                </button>
            )}
        </div>
    );
};
