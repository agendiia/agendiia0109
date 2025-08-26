import { useState, useCallback } from 'react';

export interface LoadingState {
    isLoading: boolean;
    error: string | null;
    success: boolean;
}

export const useAsyncOperation = (initialState: Partial<LoadingState> = {}) => {
    const [state, setState] = useState<LoadingState>({
        isLoading: false,
        error: null,
        success: false,
        ...initialState
    });

    const execute = useCallback(async <T>(
        operation: () => Promise<T>,
        options?: {
            onSuccess?: (result: T) => void;
            onError?: (error: Error) => void;
            successMessage?: string;
        }
    ): Promise<T | null> => {
        setState(prev => ({ ...prev, isLoading: true, error: null, success: false }));
        
        try {
            const result = await operation();
            setState(prev => ({ ...prev, isLoading: false, success: true }));
            options?.onSuccess?.(result);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            setState(prev => ({ ...prev, isLoading: false, error: errorMessage, success: false }));
            options?.onError?.(error as Error);
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        setState({ isLoading: false, error: null, success: false });
    }, []);

    const setError = useCallback((error: string) => {
        setState(prev => ({ ...prev, error, isLoading: false, success: false }));
    }, []);

    return {
        ...state,
        execute,
        reset,
        setError
    };
};

// Hook específico para múltiplos estados de loading
export const useMultipleLoadingStates = () => {
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    const setLoading = useCallback((key: string, isLoading: boolean) => {
        setLoadingStates(prev => ({
            ...prev,
            [key]: isLoading
        }));
    }, []);

    const isLoading = useCallback((key: string): boolean => {
        return Boolean(loadingStates[key]);
    }, [loadingStates]);

    const hasAnyLoading = useCallback((): boolean => {
        return Object.values(loadingStates).some(loading => loading);
    }, [loadingStates]);

    return {
        setLoading,
        isLoading,
        hasAnyLoading,
        loadingStates
    };
};
