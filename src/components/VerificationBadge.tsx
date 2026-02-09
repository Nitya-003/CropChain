import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';

interface VerificationBadgeProps {
    isVerified: boolean;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

const VerificationBadge: React.FC<VerificationBadgeProps> = ({
    isVerified,
    size = 'md',
    showLabel = true,
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5"
        >
            {isVerified ? (
                <>
                    <CheckCircle
                        className={`${sizeClasses[size]} text-green-500`}
                        aria-label="Verified"
                    />
                    {showLabel && (
                        <span className={`${textSizeClasses[size]} font-medium text-green-600 dark:text-green-400`}>
                            Verified
                        </span>
                    )}
                </>
            ) : (
                <>
                    <XCircle
                        className={`${sizeClasses[size]} text-gray-400`}
                        aria-label="Not Verified"
                    />
                    {showLabel && (
                        <span className={`${textSizeClasses[size]} font-medium text-gray-500 dark:text-gray-400`}>
                            Not Verified
                        </span>
                    )}
                </>
            )}
        </motion.div>
    );
};

export default VerificationBadge;
