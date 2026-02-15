import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Toast types for different notification levels
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Toast object structure
 */
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  createdAt: number;
}

/**
 * Toast context interface
 */
interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message: string) => void;
  removeToast: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

/**
 * Default auto-dismiss duration in milliseconds
 */
const AUTO_DISMISS_DURATION = 5000;

/**
 * Create the Toast Context with a default undefined value
 */
const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * ToastProvider component that wraps the app and manages toast state
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * Generate a unique ID for each toast
   */
  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Remove a toast by ID
   */
  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Add a toast with auto-dismiss logic
   */
  const addToast = useCallback(
    (type: ToastType, title: string, message: string) => {
      const id = generateId();
      const newToast: Toast = {
        id,
        type,
        title,
        message,
        createdAt: Date.now(),
      };

      setToasts((prevToasts) => [...prevToasts, newToast]);

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        removeToast(id);
      }, AUTO_DISMISS_DURATION);

      // Return cleanup function in case manual removal is needed before auto-dismiss
      return () => clearTimeout(timer);
    },
    [generateId, removeToast]
  );

  /**
   * Convenience method for success toasts
   */
  const success = useCallback(
    (message: string) => {
      addToast('success', 'Success', message);
    },
    [addToast]
  );

  /**
   * Convenience method for error toasts
   */
  const error = useCallback(
    (message: string) => {
      addToast('error', 'Error', message);
    },
    [addToast]
  );

  /**
   * Convenience method for info toasts
   */
  const info = useCallback(
    (message: string) => {
      addToast('info', 'Info', message);
    },
    [addToast]
  );

  /**
   * Convenience method for warning toasts
   */
  const warning = useCallback(
    (message: string) => {
      addToast('warning', 'Warning', message);
    },
    [addToast]
  );

  const value: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

/**
 * Hook to use toast notifications from anywhere in the app
 * Usage: const { toast } = useToast() or const toast = useToast();
 * Then: toast.success('Message'), toast.error('Error'), etc.
 */
export const useToast = (): {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
} => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return {
    success: context.success,
    error: context.error,
    info: context.info,
    warning: context.warning,
  };
};

/**
 * Internal hook to get the full toast context (used by ToastContainer)
 */
export const useToastContext = (): ToastContextType => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }

  return context;
};
