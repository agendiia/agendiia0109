import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';

const SettingsPage: React.FC = () => {
    // Local UI state wired to Firestore
    const { user, logout, resetPassword } = useAuth();
    const [notifications, setNotifications] = useState({ email: true });
    const [recoveryContact, setRecoveryContact] = useState('');
    const [profileName, setProfileName] = useState('');
    const [profilePhone, setProfilePhone] = useState('');
    const [loading, setLoading] = useState(true);
    // removed sessions/activities UI per request

    useEffect(() => {
    // no longer subscribing to sessions or activity collections
        const load = async () => {
            setLoading(true);
            if (!user) { setLoading(false); return; }

            try {
                // Load existing settings from users/{uid}/settings
                const settingsRef = doc(db, 'users', user.uid);
                const snap = await getDoc(settingsRef);
                const data: any = snap.exists() ? snap.data() : {};
                const s = data?.settings || {};
                setNotifications({ email: Boolean(s.notifications?.email ?? true) });
                setRecoveryContact(s.recoveryContact || '');

                // Load professional profile fields (users/{uid}/profile/main)
                try {
                    const profRef = doc(db, 'users', user.uid, 'profile', 'main');
                    const pSnap = await getDoc(profRef);
                    const p: any = pSnap.exists() ? pSnap.data() : {};
                    setProfileName(p.name || '');
                    setProfilePhone(p.phone || '');
                } catch (pf) {
                    // ignore profile load errors
                }
            } catch (e) {
                console.warn('Failed to load user settings', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    return () => { /* noop */ };
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return alert('Usuário não autenticado.');
        try {
            const ref = doc(db, 'users', user.uid);
            await setDoc(ref, { settings: { notifications: { ...notifications }, recoveryContact } }, { merge: true });
            alert('Configurações salvas.');
        } catch (err) {
            console.error('Failed to save settings', err);
            alert('Falha ao salvar configurações.');
        }
    };

    // Export controls
    const [exportAppointments, setExportAppointments] = useState(true);
    const [exportClients, setExportClients] = useState(true);

    const toCSV = (rows: any[], headers?: string[]) => {
        if (!rows || rows.length === 0) return '';
        const keys = headers && headers.length ? headers : Array.from(new Set(rows.flatMap(r => Object.keys(r))));
        const esc = (v: any) => {
            if (v === null || v === undefined) return '';
            const s = typeof v === 'string' ? v : JSON.stringify(v);
            return '"' + s.replace(/"/g, '""') + '"';
        };
        const lines = [keys.join(',')].concat(rows.map(r => keys.map(k => esc(r[k])).join(',')));
        return lines.join('\n');
    };

    const handleExport = async () => {
        if (!user) return alert('Usuário não autenticado.');
        try {
            const payload: { [k: string]: any[] } = {};
            if (exportAppointments) {
                const col = collection(db, 'users', user.uid, 'appointments');
                const q = query(col, orderBy('dateTime', 'asc'));
                const snap = await getDocs(q);
                payload.appointments = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            }
            if (exportClients) {
                const col = collection(db, 'users', user.uid, 'clients');
                const snap = await getDocs(col);
                payload.clients = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            }

            // Create separate CSV files per selected topic and trigger individual downloads (por tópico, sem zip)
            const downloads: { name: string; csv: string }[] = [];
            if (payload.appointments && payload.appointments.length) {
                downloads.push({ name: `agendamentos_${user.uid}_${Date.now()}.csv`, csv: toCSV(payload.appointments) });
            }
            if (payload.clients && payload.clients.length) {
                downloads.push({ name: `clientes_${user.uid}_${Date.now()}.csv`, csv: toCSV(payload.clients) });
            }

            if (downloads.length === 0) {
                return alert('Nenhum dado selecionado para exportação.');
            }

            // Trigger download for each CSV separately
            for (const d of downloads) {
                const blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = d.name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error('Export failed', e);
            alert('Falha ao exportar dados.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Configurações gerais */}
            <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold mb-3">Configurações gerais</h2>

                <form onSubmit={(e) => { e.preventDefault(); alert('Configurações salvas (exemplo).'); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Alterar seu nome</label>
                        <input value={profileName} onChange={(e) => setProfileName(e.target.value)} type="text" placeholder="Seu nome" className="w-full p-2 rounded border" />

                        <label className="block text-sm font-medium mt-3">Alterar seu telefone</label>
                        <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} type="tel" placeholder="(11) 9xxxx-xxxx" className="w-full p-2 rounded border" />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Alterar email principal</label>
                        <input type="email" placeholder="novo@email.com" className="w-full p-2 rounded border" />
                        <div className="flex gap-2 mt-2">
                            <button type="button" onClick={() => alert('Reenviar confirmação (exemplo).')} className="px-3 py-1 bg-emerald-600 text-white rounded">Reenviar verificação</button>
                        </div>
                    </div>
                </form>
            </section>

            {/* Preferências do Sistema */}

            <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold mb-3">Preferências do Sistema</h2>
                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="mt-2">
                            <label className="block text-sm font-medium">Notificações</label>
                            <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.email} onChange={(e) => setNotifications(n => ({ ...n, email: e.target.checked }))} /> Receber notificações por email</label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-medium">Segurança Rápida</h4>
                        <div className="flex gap-2">
                            <button type="button" onClick={async () => {
                                if (!user || !user.email) return alert('Email não disponível.');
                                try { await resetPassword(user.email); alert('Email de redefinição enviado. Verifique a sua caixa de entrada.'); } catch (e) { console.error(e); alert('Falha ao enviar email de redefinição.'); }
                            }} className="px-3 py-1 bg-blue-600 text-white rounded">Enviar email para alterar senha</button>
                            {/* Solicitação de exclusão de dados (LGPD) removida */}
                        </div>

                        <div className="mt-3">
                            <button type="button" onClick={async () => {
                                if (!user) return alert('Usuário não autenticado.');
                                if (!confirm('Deseja cancelar sua conta? Isto marcará a conta como cancelada e fará logout.')) return;
                                try {
                                    await updateDoc(doc(db, 'users', user.uid), { status: 'cancelled', cancelledAt: new Date().toISOString() });
                                    await logout();
                                } catch (e) { console.error(e); alert('Falha ao cancelar conta.'); }
                            }} className="px-3 py-1 bg-amber-500 text-white rounded">Cancelar Conta</button>
                        </div>
                    </div>
                </form>
            </section>
            {/* Admin sections removed as requested (sessions, activity, export) */}
            <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold mb-2">Exportar Dados</h2>
                <p className="text-sm text-gray-500 mb-4">Faça backup dos seus dados exportando-os em formato CSV</p>

                <div className="space-y-3">
                    <div>
                        <div className="font-medium">Selecione os dados para exportar:</div>
                        <div className="mt-2 space-y-2">
                            <label className="flex items-start gap-3">
                                <input type="checkbox" checked={exportAppointments} onChange={(e) => setExportAppointments(e.target.checked)} />
                                <div>
                                    <div className="font-medium">Agendamentos</div>
                                    <div className="text-sm text-gray-500">Todos os seus agendamentos e consultas</div>
                                </div>
                            </label>

                            <label className="flex items-start gap-3">
                                <input type="checkbox" checked={exportClients} onChange={(e) => setExportClients(e.target.checked)} />
                                <div>
                                    <div className="font-medium">Clientes</div>
                                    <div className="text-sm text-gray-500">Cadastro completo dos seus clientes</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div>
                        <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white rounded">Exportar selecionados (CSV)</button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default SettingsPage;
