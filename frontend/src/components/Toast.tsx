import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Toast as ToastType, ToastType as ToastTypeEnum } from '../context/ToastContext';

interface ToastProps {
  toast: ToastType;
  onClose: (id: string) => void;
}

/**
 * Individual Toast component
 * Displays a notification with icon, title, message, and close button
 * Supports dark mode and smooth animations
 */
const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  /**
   * Get the appropriate icon based on toast type
   */
  const getIcon = (type: ToastTypeEnum) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      case 'error':
        return <AlertCircle className="h-5 w-5" />;
      case 'info':
        return <Info className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  /**
   * Get the appropriate colors based on toast type
   */
  const getColors = (type: ToastTypeEnum) => {
    const baseClasses =
      'border-l-4 backdrop-blur-md rounded-lg shadow-2xl p-4 mb-3 flex items-start gap-4 transform transition-all duration-300 ease-out';

    switch (type) {
      case 'success':
        return `${baseClasses} border-l-green-500 bg-green-50/90 dark:bg-green-950/90 text-green-900 dark:text-green-100`;
      case 'error':
        return `${baseClasses} border-l-red-500 bg-red-50/90 dark:bg-red-950/90 text-red-900 dark:text-red-100`;
      case 'info':
        return `${baseClasses} border-l-blue-500 bg-blue-50/90 dark:bg-blue-950/90 text-blue-900 dark:text-blue-100`;
      case 'warning':
        return `${baseClasses} border-l-amber-500 bg-amber-50/90 dark:bg-amber-950/90 text-amber-900 dark:text-amber-100`;
      default:
        return `${baseClasses} border-l-gray-500 bg-gray-50/90 dark:bg-gray-950/90 text-gray-900 dark:text-gray-100`;
    }
  };

  /**
   * Get icon color based on toast type
   */
  const getIconColor = (type: ToastTypeEnum) => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      case 'warning':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  /**
   * Get close button color based on toast type
   */
  const getCloseButtonColor = (type: ToastTypeEnum) => {
    switch (type) {
      case 'success':
        return 'hover:bg-green-200/50 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300';
      case 'error':
        return 'hover:bg-red-200/50 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300';
      case 'info':
        return 'hover:bg-blue-200/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'warning':
        return 'hover:bg-amber-200/50 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300';
      default:
        return 'hover:bg-gray-200/50 dark:hover:bg-gray-900/50 text-gray-700 dark:text-gray-300';
    }
  };

  /**
   * Handle close button click
   */
  const handleClose = () => {
    setIsExiting(true);
    // Wait for animation to complete before removing
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  };

  // Animation classes
  const animationClasses = isExiting
    ? 'translate-x-full opacity-0'
    : 'translate-x-0 opacity-100';

  return (
    <div
      className={`${getColors(toast.type)} ${animationClasses}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 pt-0.5 ${getIconColor(toast.type)}`}>
        {getIcon(toast.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm leading-tight">{toast.title}</h3>
        <p className="text-sm mt-1 opacity-90 break-words">{toast.message}</p>
      </div>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className={`flex-shrink-0 rounded-md p-1 transition-colors duration-200 ${getCloseButtonColor(
          toast.type
        )}`}
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;
