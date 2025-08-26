import React, { useState, useCallback, useId } from 'react';
import { IconProps } from './Icons';

export interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'aria-describedby'> {
    label: string;
    name: string;
    Icon?: React.ComponentType<IconProps>;
    icon?: React.ReactNode;
    error?: string;
    helpText?: string;
    required?: boolean;
    validate?: (value: string) => string | undefined;
    onValidationChange?: (isValid: boolean) => void;
}

export const FormField: React.FC<FormFieldProps> = ({ 
    label, 
    name, 
    Icon, 
    icon, 
    error, 
    helpText,
    required, 
    validate,
    onValidationChange,
    onBlur,
    onChange,
    ...rest 
}) => {
    const [touched, setTouched] = useState(false);
    const [internalError, setInternalError] = useState<string>();
    
    // Generate unique IDs for accessibility
    const fieldId = useId();
    const errorId = useId();
    const helpId = useId();
    
    const displayError = error || internalError;
    const hasError = touched && displayError;
    
    const handleValidation = useCallback((value: string) => {
        if (!validate) return;
        
        const validationError = validate(value);
        setInternalError(validationError);
        onValidationChange?.(!validationError);
    }, [validate, onValidationChange]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        setTouched(true);
        handleValidation(e.target.value);
        onBlur?.(e);
    }, [onBlur, handleValidation]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (touched) {
            handleValidation(e.target.value);
        }
        onChange?.(e);
    }, [onChange, touched, handleValidation]);

    return (
        <div className="space-y-1">
            <label 
                htmlFor={fieldId}
                className={`block text-sm font-medium transition-colors ${
                    hasError 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-700 dark:text-gray-300'
                }`}
            >
                {label}
                {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
            </label>
            
            <div className="relative">
                {(Icon || icon) && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {Icon ? (
                            <Icon className={`h-5 w-5 ${hasError ? 'text-red-400' : 'text-gray-400'}`} />
                        ) : (
                            icon
                        )}
                    </div>
                )}
                
                <input
                    id={fieldId}
                    name={name}
                    aria-invalid={hasError}
                    aria-describedby={`${hasError ? errorId : ''} ${helpText ? helpId : ''}`.trim()}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    className={`block w-full rounded-md border shadow-sm py-2.5 px-3 sm:text-sm transition-colors ${
                        Icon || icon ? 'pl-10' : ''
                    } ${
                        hasError
                            ? 'border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20' 
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 focus:border-indigo-500 focus:ring-indigo-500'
                    } focus:ring-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
                    {...rest}
                />
            </div>
            
            {hasError && (
                <p id={errorId} className="text-red-600 dark:text-red-400 text-xs flex items-center gap-1" role="alert">
                    <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {displayError}
                </p>
            )}
            
            {helpText && !hasError && (
                <p id={helpId} className="text-gray-500 dark:text-gray-400 text-xs">
                    {helpText}
                </p>
            )}
        </div>
    );
};

// Validation helpers
export const validators = {
    required: (message = 'Este campo é obrigatório') => (value: string) => 
        !value.trim() ? message : undefined,
    
    email: (message = 'Email inválido') => (value: string) => 
        value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? message : undefined,
    
    phone: (message = 'Telefone inválido') => (value: string) => 
        value && !/^[\d\s\-\(\)\+]+$/.test(value) ? message : undefined,
    
    minLength: (min: number, message?: string) => (value: string) => 
        value && value.length < min ? (message || `Deve ter pelo menos ${min} caracteres`) : undefined,
    
    maxLength: (max: number, message?: string) => (value: string) => 
        value && value.length > max ? (message || `Não pode exceder ${max} caracteres`) : undefined,
    
    combine: (...validators: Array<(value: string) => string | undefined>) => (value: string) => {
        for (const validator of validators) {
            const error = validator(value);
            if (error) return error;
        }
        return undefined;
    }
};
