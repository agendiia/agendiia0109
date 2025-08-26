import React from 'react';
import { Loader } from './Icons';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    fullScreen?: boolean;
    className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
    size = 'md', 
    text, 
    fullScreen = false,
    className = '' 
}) => {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6', 
        lg: 'h-8 w-8'
    };

    const textSizeClasses = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg'
    };

    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col items-center space-y-3">
                    <Loader className={`${sizeClasses.lg} animate-spin text-blue-500`} />
                    {text && <p className={`${textSizeClasses.lg} text-gray-700 dark:text-gray-300`}>{text}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-center space-x-2 ${className}`}>
            <Loader className={`${sizeClasses[size]} animate-spin text-blue-500`} />
            {text && <span className={`${textSizeClasses[size]} text-gray-700 dark:text-gray-300`}>{text}</span>}
        </div>
    );
};

interface LoadingStateProps {
    loading: boolean;
    error?: string | null;
    success?: boolean;
    children: React.ReactNode;
    loadingComponent?: React.ReactNode;
    errorComponent?: React.ReactNode;
    emptyComponent?: React.ReactNode;
    isEmpty?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
    loading,
    error,
    success,
    children,
    loadingComponent,
    errorComponent,
    emptyComponent,
    isEmpty = false
}) => {
    if (loading) {
        return (
            <div>
                {loadingComponent || (
                    <div className="flex items-center justify-center py-8">
                        <LoadingSpinner text="Carregando..." />
                    </div>
                )}
            </div>
        );
    }

    if (error) {
        return (
            <div>
                {errorComponent || (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-red-500 text-center">
                            <p className="font-medium">Erro</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (isEmpty) {
        return (
            <div>
                {emptyComponent || (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-gray-500 text-center">
                            <p>Nenhum item encontrado</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return <>{children}</>;
};
