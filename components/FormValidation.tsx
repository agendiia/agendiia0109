// Componente melhorado para validação consistente de formulários
import React from 'react';
import { z } from 'zod';

interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  schema?: z.ZodString;
  type?: 'text' | 'email' | 'password' | 'tel' | 'date';
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  value,
  onChange,
  schema,
  type = 'text',
  placeholder,
  icon,
  required = false,
  className = ''
}) => {
  const [error, setError] = React.useState<string>('');
  const [touched, setTouched] = React.useState(false);

  const validate = (val: string) => {
    if (!schema) return;
    try {
      schema.parse(val);
      setError('');
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0]?.message || 'Campo inválido');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    if (touched) {
      validate(e.target.value);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    validate(value);
  };

  const hasError = touched && error;
  const fieldId = `field-${name}`;

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={fieldId}
        className={`block text-sm font-medium ${hasError ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        
        <input
          id={fieldId}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${fieldId}-error` : undefined}
          className={`
            w-full p-3 rounded-lg border transition-colors
            ${icon ? 'pl-10' : ''}
            ${hasError 
              ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500'
            }
            focus:ring-2 focus:outline-none
            dark:text-white
          `}
        />
      </div>
      
      {hasError && (
        <p id={`${fieldId}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

// Schemas de validação com Zod
export const formSchemas = {
  email: z.string().email('E-mail inválido').min(1, 'E-mail é obrigatório'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone inválido (XX) XXXXX-XXXX'),
  required: z.string().min(1, 'Campo obrigatório'),
};

// Hook para gerenciar formulários com validação
export const useFormValidation = <T extends Record<string, string>>(
  initialData: T,
  schemas: Partial<Record<keyof T, z.ZodString>>
) => {
  const [data, setData] = React.useState<T>(initialData);
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = React.useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = (field: keyof T, value: string) => {
    const schema = schemas[field];
    if (!schema) return;

    try {
      schema.parse(value);
      setErrors(prev => ({ ...prev, [field]: undefined }));
    } catch (e) {
      if (e instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, [field]: e.errors[0]?.message }));
      }
    }
  };

  const validateAll = (): boolean => {
    let isValid = true;
    Object.keys(schemas).forEach(field => {
      const key = field as keyof T;
      const schema = schemas[key];
      if (schema) {
        try {
          schema.parse(data[key]);
        } catch (e) {
          isValid = false;
          if (e instanceof z.ZodError) {
            setErrors(prev => ({ ...prev, [key]: e.errors[0]?.message }));
          }
        }
      }
    });
    
    // Mark all fields as touched for error display
    setTouched(Object.keys(data).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    return isValid;
  };

  const handleChange = (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setData(prev => ({ ...prev, [field]: value }));
    
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field: keyof T) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, data[field]);
  };

  return {
    data,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    setData,
  };
};
