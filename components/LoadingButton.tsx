import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
    success: "bg-green-600 hover:bg-green-700 text-white focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {loading && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
};

export default LoadingButton;
