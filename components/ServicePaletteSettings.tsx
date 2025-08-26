import React, { useState } from 'react';
import { Service } from '../types';
import servicePalette, { getPaletteForService } from './ServicePalette';
import useServicePaletteOverride from './useServicePaletteOverride';
import { X } from './Icons';

const ServicePaletteSettings: React.FC<{ services: Service[]; onClose: () => void }> = ({ services, onClose }) => {
    const { overrides, setOverride, clearOverride, isLoading } = useServicePaletteOverride();
    const [local, setLocal] = useState<Record<string, number>>(() => ({ ...(overrides || {}) }));

    const handleChange = (serviceId: string, idx: number) => {
        setLocal(prev => ({ ...prev, [serviceId]: idx }));
    };

    const handleSave = async () => {
        // save all local entries
        try {
            for (const [serviceId, idx] of Object.entries(local)) {
                await setOverride(serviceId, idx);
            }
            onClose();
        } catch (e) {
            console.error(e);
            onClose();
        }
    };

    const handleClear = async (serviceId: string) => {
        await clearOverride(serviceId);
        setLocal(prev => { const c = { ...prev }; delete c[serviceId]; return c; });
    };

    if (!services) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-3xl rounded-lg p-6 overflow-auto max-h-[80vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Configurar Paleta de Serviços</h3>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><X className="h-5 w-5"/></button>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Atribua uma cor a cada serviço. Alterações são salvas no seu perfil.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map(s => {
                        const currentIdx = (local && local[s.id] !== undefined) ? local[s.id] : (overrides && overrides[s.id] !== undefined ? overrides[s.id] : null as any);
                        const inferred = currentIdx === null ? getPaletteForService(s.id, services, overrides) : servicePalette[currentIdx];
                        return (
                            <div key={s.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${inferred.selectedBg}`}></div>
                                        <div className="text-sm font-medium text-gray-800 dark:text-white">{s.name}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select value={currentIdx ?? ''} onChange={(e) => handleChange(s.id, Number(e.target.value))} className="p-1 rounded-md bg-white dark:bg-gray-700 border">
                                            <option value="">(Padrão)</option>
                                            {servicePalette.map((p, i) => (
                                                <option key={i} value={i}>{`Paleta ${i + 1}`}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => handleClear(s.id)} className="text-sm text-red-600">Limpar</button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {servicePalette.map((p, i) => (
                                        <button key={i} onClick={() => handleChange(s.id, i)} className={`p-2 rounded-md border ${p.bg} ${p.text} ${local[s.id] === i ? 'ring-2 ring-indigo-500' : ''}`}>{i + 1}</button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="py-2 px-4 rounded-md bg-gray-200 dark:bg-gray-700">Cancelar</button>
                    <button onClick={handleSave} className="py-2 px-4 rounded-md bg-indigo-600 text-white">Salvar</button>
                </div>
            </div>
        </div>
    )
}

export default ServicePaletteSettings;
