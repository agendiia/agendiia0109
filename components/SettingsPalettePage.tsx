import React, { useEffect, useState, useCallback } from 'react';
import { Service } from '../types';
import servicePalette, { getPaletteForService } from './ServicePalette';
import useServicePaletteOverride from './useServicePaletteOverride';
import { db } from '@/services/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

const SettingsPalettePage: React.FC = () => {
    const { user } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const { overrides: persistedOverrides, isLoading } = useServicePaletteOverride();

    // Local staging with undo/redo stacks
    const [staged, setStaged] = useState<Record<string, number>>({});
    const [past, setPast] = useState<Record<string, number>[]>([]);
    const [future, setFuture] = useState<Record<string, number>[]>([]);

    useEffect(() => {
        // initialize staged from persisted overrides
        setStaged(persistedOverrides || {});
        setPast([]);
        setFuture([]);
    }, [JSON.stringify(persistedOverrides)]);

    useEffect(() => {
        if (!user) return;
        const col = collection(db, 'users', user.uid, 'services');
        const unsub = onSnapshot(col, (snap) => {
            const items: Service[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Service));
            setServices(items);
        }, () => {});
        return () => unsub();
    }, [user?.uid]);

    const pushState = useCallback((newState: Record<string, number>) => {
        setPast(p => [...p, staged]);
        setFuture([]);
        setStaged(newState);
    }, [staged]);

    const handleSet = (serviceId: string, idx: number | null) => {
        const next = { ...(staged || {}) };
        if (idx === null) delete next[serviceId]; else next[serviceId] = idx;
        pushState(next);
    };

    const undo = () => {
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        setPast(p => p.slice(0, -1));
        setFuture(f => [staged, ...f]);
        setStaged(prev);
    };

    const redo = () => {
        if (future.length === 0) return;
        const next = future[0];
        setFuture(f => f.slice(1));
        setPast(p => [...p, staged]);
        setStaged(next);
    };

    const discard = () => {
        setStaged(persistedOverrides || {});
        setPast([]);
        setFuture([]);
    };

    const saveAll = async () => {
        if (!user) return;
        try {
            const docRef = doc(db, 'users', user.uid, 'ui', 'servicePalette');
            await setDoc(docRef, staged || {}, { merge: true });
            // persistedOverrides hook will reflect changes
        } catch (e) {
            console.error('Failed to save palette mapping', e);
            alert('Falha ao salvar as configurações.');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Configurações — Paleta de Serviços</h1>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={undo} disabled={past.length === 0} className="px-3 py-1 rounded-md bg-gray-100">Desfazer</button>
                        <button onClick={redo} disabled={future.length === 0} className="px-3 py-1 rounded-md bg-gray-100">Refazer</button>
                        <button onClick={discard} className="px-3 py-1 rounded-md bg-gray-100">Descartar</button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={saveAll} className="px-4 py-2 rounded-md bg-indigo-600 text-white">Salvar Tudo</button>
                    </div>
                </div>

                <p className="text-sm text-gray-500 mb-4">Visualize e edite as cores atribuídas aos seus serviços antes de salvar. Use Desfazer/Refazer conforme necessário.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map(s => {
                        const stagedIdx = staged && staged[s.id] !== undefined ? staged[s.id] : null;
                        const pal = stagedIdx !== null ? servicePalette[stagedIdx] : getPaletteForService(s.id, services, staged || persistedOverrides);
                        return (
                            <div key={s.id} className="p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${pal.selectedBg}`}></div>
                                        <div className="font-medium">{s.name}</div>
                                    </div>
                                    <div>
                                        <select value={stagedIdx ?? ''} onChange={(e) => handleSet(s.id, e.target.value === '' ? null : Number(e.target.value))} className="p-1 rounded-md">
                                            <option value="">(Padrão)</option>
                                            {servicePalette.map((p, i) => (
                                                <option key={i} value={i}>{`Paleta ${i + 1}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {servicePalette.map((p, i) => (
                                        <button key={i} onClick={() => handleSet(s.id, i)} className={`p-2 rounded-md ${p.bg} ${p.text} ${stagedIdx === i ? 'ring-2 ring-indigo-500' : ''}`}>{i + 1}</button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold mb-3">Pré-visualização</h2>
                <p className="text-sm text-gray-500 mb-4">Como seus agendamentos aparecerão com as cores selecionadas.</p>
                <div className="flex flex-wrap gap-3">
                    {services.map(s => {
                        const idx = staged && staged[s.id] !== undefined ? staged[s.id] : null;
                        const pal = idx !== null ? servicePalette[idx] : getPaletteForService(s.id, services, staged || persistedOverrides);
                        return (
                            <div key={s.id} className={`p-3 rounded-md ${pal.bg} ${pal.text} border ${pal.border} flex items-center gap-3`}>{/* small card preview */}
                                <div className={`w-3 h-3 rounded-full ${pal.selectedBg}`} />
                                <div className="font-medium">{s.name}</div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default SettingsPalettePage;
