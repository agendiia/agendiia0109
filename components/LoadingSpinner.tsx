import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  overlay?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  overlay = false,
  className = ''
}) => {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const spinner = (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      <Loader2 className={`animate-spin text-indigo-600 ${sizeStyles[size]}`} />
      {text && (
        <span className={`text-gray-600 dark:text-gray-300 ${textSizeStyles[size]}`}>
          {text}
        </span>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
