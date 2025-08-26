import React from 'react';
import { IconProps } from './Icons';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    name: string;
    Icon?: React.ComponentType<IconProps>;
    icon?: React.ReactNode;
    error?: string;
    isError?: boolean;
}

export const FormInput: React.FC<Props> = ({ label, name, Icon, icon, error, isError, required, ...rest }) => {
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                {(Icon || icon) && (
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        {Icon ? <Icon className="h-5 w-5 text-gray-400" /> : icon}
                    </div>
                )}
                <input
                    id={name}
                    name={name}
                    className={`block w-full rounded-md border shadow-sm py-2.5 sm:text-sm ${
                        Icon || icon ? 'pl-10' : 'pl-4'
                    } ${
                        error || isError 
                            ? 'border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    {...rest}
                />
            </div>
            {error && (
                <p className="text-red-500 text-xs mt-1">{error}</p>
            )}
        </div>
    );
};
