import React, { useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle, AlertTriangle, X, Info } from './Icons';

// Error context for global error management
interface ErrorContextType {
    showError: (message: string, details?: string) => void;
    showSuccess: (message: string) => void;
    showWarning: (message: string) => void;
    showInfo: (message: string) => void;
    clearAll: () => void;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export interface ErrorMessage {
    id: string;
    type: 'error' | 'success' | 'warning' | 'info';
    message: string;
    details?: string;
    timestamp: number;
}

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<ErrorMessage[]>([]);

    const addMessage = useCallback((type: ErrorMessage['type'], message: string, details?: string) => {
        const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newMessage: ErrorMessage = {
            id,
            type,
            message,
            details,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, newMessage]);

        // Auto remove after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg.id !== id));
            }, 5000);
        }
    }, []);

    const removeMessage = useCallback((id: string) => {
        setMessages(prev => prev.filter(msg => msg.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setMessages([]);
    }, []);

    const showError = useCallback((message: string, details?: string) => {
        addMessage('error', message, details);
    }, [addMessage]);

    const showSuccess = useCallback((message: string) => {
        addMessage('success', message);
    }, [addMessage]);

    const showWarning = useCallback((message: string) => {
        addMessage('warning', message);
    }, [addMessage]);

    const showInfo = useCallback((message: string) => {
        addMessage('info', message);
    }, [addMessage]);

    const value = { showError, showSuccess, showWarning, showInfo, clearAll };

    return (
        <ErrorContext.Provider value={value}>
            {children}
            <ErrorToastContainer messages={messages} onRemove={removeMessage} />
        </ErrorContext.Provider>
    );
};

export const useErrorHandler = () => {
    const context = useContext(ErrorContext);
    if (!context) {
        throw new Error('useErrorHandler must be used within an ErrorProvider');
    }
    return context;
};

// Toast container for global messages
interface ErrorToastContainerProps {
    messages: ErrorMessage[];
    onRemove: (id: string) => void;
}

const ErrorToastContainer: React.FC<ErrorToastContainerProps> = ({ messages, onRemove }) => {
    if (messages.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            {messages.map(message => (
                <ErrorToast key={message.id} message={message} onRemove={onRemove} />
            ))}
        </div>
    );
};

// Individual toast component
interface ErrorToastProps {
    message: ErrorMessage;
    onRemove: (id: string) => void;
}

const ErrorToast: React.FC<ErrorToastProps> = ({ message, onRemove }) => {
    const [isVisible, setIsVisible] = useState(true);

    const handleRemove = useCallback(() => {
        setIsVisible(false);
        setTimeout(() => onRemove(message.id), 300);
    }, [message.id, onRemove]);

    const typeConfig = {
        error: {
            icon: <AlertTriangle className="h-5 w-5" />,
            className: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        },
        success: {
            icon: <CheckCircle className="h-5 w-5" />,
            className: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
        },
        warning: {
            icon: <AlertTriangle className="h-5 w-5" />,
            className: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
        },
        info: {
            icon: <Info className="h-5 w-5" />,
            className: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
        }
    };

    const config = typeConfig[message.type];

    return (
        <div 
            className={`
                border rounded-lg p-4 shadow-lg transition-all duration-300 transform
                ${config.className}
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
            role="alert"
            aria-live="polite"
        >
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    {config.icon}
                </div>
                <div className="ml-3 flex-1">
                    <p className="font-medium text-sm">
                        {message.message}
                    </p>
                    {message.details && (
                        <p className="mt-1 text-xs opacity-75">
                            {message.details}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleRemove}
                    className="ml-4 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                    aria-label="Fechar notificação"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

// Inline error component for forms
interface InlineErrorProps {
    error?: string;
    className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({ error, className = '' }) => {
    if (!error) return null;

    return (
        <div className={`flex items-center gap-2 text-red-600 dark:text-red-400 text-sm ${className}`} role="alert">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
        </div>
    );
};

// Banner error component for page-level errors
interface ErrorBannerProps {
    error?: string;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ 
    error, 
    onRetry, 
    onDismiss, 
    className = '' 
}) => {
    if (!error) return null;

    return (
        <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`} role="alert">
            <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3 flex-1">
                    <p className="text-red-800 dark:text-red-200 font-medium">
                        Erro
                    </p>
                    <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                        {error}
                    </p>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="mt-2 text-red-800 dark:text-red-200 text-sm font-medium hover:underline"
                        >
                            Tentar novamente
                        </button>
                    )}
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="ml-4 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                        aria-label="Fechar erro"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

// Success banner component
interface SuccessBannerProps {
    message?: string;
    onDismiss?: () => void;
    className?: string;
}

export const SuccessBanner: React.FC<SuccessBannerProps> = ({ 
    message, 
    onDismiss, 
    className = '' 
}) => {
    if (!message) return null;

    return (
        <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 ${className}`} role="alert">
            <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3 flex-1">
                    <p className="text-green-800 dark:text-green-200 font-medium">
                        Sucesso
                    </p>
                    <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                        {message}
                    </p>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="ml-4 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                        aria-label="Fechar mensagem"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

// Hook for form-level error handling
export const useFormErrors = () => {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const setFieldError = useCallback((field: string, error: string) => {
        setErrors(prev => ({ ...prev, [field]: error }));
    }, []);

    const clearFieldError = useCallback((field: string) => {
        setErrors(prev => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }, []);

    const setFieldTouched = useCallback((field: string, isTouched: boolean = true) => {
        setTouched(prev => ({ ...prev, [field]: isTouched }));
    }, []);

    const clearAll = useCallback(() => {
        setErrors({});
        setTouched({});
    }, []);

    const hasErrors = Object.keys(errors).length > 0;
    const hasFieldError = useCallback((field: string) => 
        touched[field] && errors[field], [touched, errors]);

    return {
        errors,
        touched,
        setFieldError,
        clearFieldError,
        setFieldTouched,
        clearAll,
        hasErrors,
        hasFieldError
    };
};
