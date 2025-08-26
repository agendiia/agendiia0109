import React from 'react';
import { Service } from '../types';
import servicePalette, { getPaletteForService } from './ServicePalette';

const PaletteLegend: React.FC<{ services: Service[] }> = ({ services }) => {
    if (!services || services.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Legenda de Serviços</h4>
            <div className="flex flex-wrap gap-2">
                {services.map(s => {
                    const pal = getPaletteForService(s.id, services);
                    return (
                        <div key={s.id} className={`flex items-center gap-2 p-2 rounded-md ${pal.bg} ${pal.text} border ${pal.border}`} title={s.name}>
                            <div className={`w-3 h-3 rounded-full ${pal.selectedBg}`} />
                            <span className="text-xs font-medium truncate max-w-[10rem]">{s.name}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default PaletteLegend;
