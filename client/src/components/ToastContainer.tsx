import React from 'react';
import Toast from './Toast';
import { useToastContext } from '../context/ToastContext';

/**
 * ToastContainer component
 * Renders all active toasts in a fixed position (top-right)
 * Should be placed at the root level of the app
 */
const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastContext();

  return (
    <div
      className="fixed top-4 right-4 z-50 pointer-events-none space-y-3 max-w-sm"
      aria-label="Notifications"
    >
      {/* Pointer events auto for interactive elements */}
      <div className="pointer-events-auto space-y-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;
