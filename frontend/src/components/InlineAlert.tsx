import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type AlertVariant = "error" | "warning" | "success" | "info";

interface InlineAlertProps {
  variant?: AlertVariant;
  title?: string;
  message?: string;
  details?: string[];
  onDismiss?: () => void;
  className?: string;
}

const variantStyles: Record<
  AlertVariant,
  {
    container: string;
    iconColor: string;
    titleColor: string;
    bodyColor: string;
    icon: any;
  }
> = {
  error: {
    container: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-200",
    iconColor: "text-red-600 dark:text-red-400",
    titleColor: "text-red-900 dark:text-red-100 font-semibold",
    bodyColor: "text-red-800 dark:text-red-300",
    icon: AlertCircle,
  },
  warning: {
    container: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200",
    iconColor: "text-amber-600 dark:text-amber-400",
    titleColor: "text-amber-900 dark:text-amber-100 font-semibold",
    bodyColor: "text-amber-800 dark:text-amber-300",
    icon: AlertTriangle,
  },
  success: {
    container: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    titleColor: "text-emerald-900 dark:text-emerald-100 font-semibold",
    bodyColor: "text-emerald-800 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  info: {
    container: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200",
    iconColor: "text-blue-600 dark:text-blue-400",
    titleColor: "text-blue-900 dark:text-blue-100 font-semibold",
    bodyColor: "text-blue-800 dark:text-blue-300",
    icon: Info,
  },
};

export const InlineAlert = ({
  variant = "error",
  title,
  message,
  details,
  onDismiss,
  className = "",
}: InlineAlertProps): React.ReactElement | null => {
  const styles = variantStyles[variant];
  const IconComponent = styles.icon;

  if (!title && !message && (!details || details.length === 0)) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        role="alert"
        aria-live="polite"
        className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${styles.container} ${className}`}
      >
        <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${styles.iconColor}`} />
        <div className="flex-1 text-sm">
          {title && <h5 className={`${styles.titleColor} mb-1`}>{title}</h5>}
          {message && <p className={styles.bodyColor}>{message}</p>}
          {details && details.length > 0 && (
            <ul className={`mt-1.5 space-y-1 list-disc list-inside ${styles.bodyColor}`}>
              {details.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
