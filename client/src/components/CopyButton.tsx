import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  variant?: 'default' | 'light' | 'dark';
}

const CopyButton: React.FC<CopyButtonProps> = ({ 
  value, 
  label = 'value', 
  className = '',
  variant = 'default'
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const baseStyles = "p-1.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2";
  
  const variantStyles = {
    default: "hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400",
    light: "hover:bg-white/20 text-white/80 hover:text-white",
    dark: "hover:bg-black/20 text-gray-400 hover:text-gray-200"
  };

  const iconSizes = {
    default: "h-4 w-4",
    light: "h-5 w-5",
    dark: "h-4 w-4"
  };

  return (
    <button
      onClick={handleCopy}
      disabled={!value}
      className={`${baseStyles} ${variantStyles[variant]} ${className} ${!value ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={copied ? 'Copied!' : `Copy ${label}`}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
    >
      {copied ? (
        <Check className={`${iconSizes[variant]} text-green-500`} />
      ) : (
        <Copy className={iconSizes[variant]} />
      )}
    </button>
  );
};

export default CopyButton;