
import React from 'react';
import { Sparkles, Lock } from './Icons';

interface LockedWidgetProps {
    featureName: string;
}

const LockedWidget: React.FC<LockedWidgetProps> = ({ featureName }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md h-full flex flex-col items-center justify-center text-center">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full mb-3">
                <Lock className="h-6 w-6 text-indigo-500" />
            </div>
            <h3 className="font-semibold text-gray-800 dark:text-white">{featureName}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Recurso exclusivo do Plano Avançado.
            </p>
            <button
                onClick={() => alert('Navegando para a página de planos...')}
                className="mt-4 text-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-semibold py-1.5 px-4 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
            >
                Fazer Upgrade
            </button>
        </div>
    );
};

export default LockedWidget;
