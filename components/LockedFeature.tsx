
import React from 'react';
import { Sparkles, Lock } from './Icons';

interface LockedFeatureProps {
    featureName: string;
}

const LockedFeature: React.FC<LockedFeatureProps> = ({ featureName }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="p-4 bg-indigo-100 dark:bg-indigo-900/50 rounded-full mb-4">
                <Lock className="h-10 w-10 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Acesso Exclusivo para o Plano Avançado</h2>
            <p className="mt-2 max-w-lg text-gray-600 dark:text-gray-300">
                A funcionalidade <span className="font-semibold text-indigo-600 dark:text-indigo-400">{featureName}</span> é um recurso premium. Faça o upgrade para o Plano Avançado e desbloqueie todo o potencial da nossa plataforma.
            </p>
            <button
                // In a real app, this would trigger a navigation to the subscription page
                onClick={() => alert('Navegando para a página de planos...')}
                className="mt-6 bg-indigo-600 text-white font-semibold py-2.5 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
                <Sparkles className="h-5 w-5" />
                <span>Ver Planos e Fazer Upgrade</span>
            </button>
        </div>
    );
};

export default LockedFeature;
