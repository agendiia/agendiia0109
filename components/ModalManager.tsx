import React, { useState, useCallback, useContext, createContext, useEffect } from 'react';
import { X } from './Icons';

// Modal context to prevent state leakage
interface ModalContextType {
    openModals: Set<string>;
    registerModal: (id: string) => void;
    unregisterModal: (id: string) => void;
    closeAll: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [openModals, setOpenModals] = useState<Set<string>>(new Set());

    const registerModal = useCallback((id: string) => {
        setOpenModals(prev => new Set([...prev, id]));
    }, []);

    const unregisterModal = useCallback((id: string) => {
        setOpenModals(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const closeAll = useCallback(() => {
        setOpenModals(new Set());
    }, []);

    // Close modals on ESC key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && openModals.size > 0) {
                closeAll();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [openModals.size, closeAll]);

    const value = { openModals, registerModal, unregisterModal, closeAll };

    return (
        <ModalContext.Provider value={value}>
            {children}
        </ModalContext.Provider>
    );
};

export const useModalContext = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModalContext must be used within a ModalProvider');
    }
    return context;
};

// Hook for managed modal state
export const useModal = (modalId?: string) => {
    const [isOpen, setIsOpen] = useState(false);
    const [internalId] = useState(() => modalId || `modal-${Math.random().toString(36).substr(2, 9)}`);
    const modalContext = useModalContext();

    const open = useCallback(() => {
        setIsOpen(true);
        modalContext.registerModal(internalId);
    }, [modalContext, internalId]);

    const close = useCallback(() => {
        setIsOpen(false);
        modalContext.unregisterModal(internalId);
    }, [modalContext, internalId]);

    // Auto cleanup on unmount
    useEffect(() => {
        return () => {
            if (isOpen) {
                modalContext.unregisterModal(internalId);
            }
        };
    }, [isOpen, modalContext, internalId]);

    return {
        isOpen,
        open,
        close,
        modalId: internalId
    };
};

// Base modal component with proper accessibility
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    preventClose?: boolean;
    className?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    preventClose = false,
    className = ''
}) => {
    const modalContext = useModalContext();

    // Handle background click
    const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !preventClose) {
            onClose();
        }
    }, [onClose, preventClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'unset';
            };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl'
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
            onClick={handleBackgroundClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div 
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${sizeClasses[size]} ${className}`}
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 id="modal-title" className="text-xl font-bold text-gray-800 dark:text-white">
                        {title}
                    </h2>
                    {!preventClose && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            aria-label="Fechar modal"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    )}
                </header>
                
                <main className="p-6">
                    {children}
                </main>
                
                {footer && (
                    <footer className="flex justify-end space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
};

// Confirmation modal
interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'info'
}) => {
    const variantStyles = {
        danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
        info: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`py-2 px-4 rounded-lg text-white font-semibold transition-colors focus:ring-2 focus:outline-none ${variantStyles[variant]}`}
                    >
                        {confirmText}
                    </button>
                </>
            }
        >
            <p className="text-gray-600 dark:text-gray-300">{message}</p>
        </Modal>
    );
};
