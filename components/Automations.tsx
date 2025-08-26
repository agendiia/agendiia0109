
import React, { useEffect, useState } from 'react';
import { BrevoSettings } from '../types';
import { Bell, Edit } from './Icons';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface Template {
    id: string;
    event: string;
    subject: string;
    body: string;
}

const initialTemplates: Template[] = [
    { id: 't_sched', event: 'Agendamento Realizado', subject: 'Seu agendamento foi confirmado!', body: 'Olá {clientName}, seu agendamento para {serviceName} no dia {dateTime} foi realizado com sucesso!' },
    { id: 't_remind', event: 'Lembrete de Agendamento (24h)', subject: 'Lembrete do seu agendamento', body: 'Olá, {clientName}! Passando para lembrar do seu horário de {serviceName} amanhã às {time}. Por favor, responda SIM para confirmar.' },
    { id: 't_cancel', event: 'Agendamento Cancelado', subject: 'Agendamento cancelado', body: 'Olá {clientName}, seu agendamento para {serviceName} no dia {dateTime} foi cancelado.' },
];

interface FeatureAccess {
    [key: string]: {
        profissional: boolean;
        avancado: boolean;
    }
}

const initialFeatureAccess: FeatureAccess = {
    'sms': { profissional: false, avancado: true },
    'workflows': { profissional: false, avancado: true },
    'followups': { profissional: true, avancado: true },
}

const Automations: React.FC = () => {
    const [settings, setSettings] = useState<BrevoSettings>({ apiKey: '', isConnected: false, senderEmail: '', senderName: '' });
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string>('');

    // Load Brevo settings and automations from Firestore (platform-level)
    useEffect(() => {
        const load = async () => {
            try {
                const ref = doc(db, 'platform', 'brevo');
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as any;
                    setSettings({ apiKey: data.apiKey || '', isConnected: !!data.isConnected, senderEmail: data.senderEmail || '', senderName: data.senderName || '' });
                }
            } catch (e) {
                // ignore load errors in UI
            }
            try {
                const autoRef = doc(db, 'platform', 'automations');
                const autoSnap = await getDoc(autoRef);
                if (autoSnap.exists()) {
                    const data = autoSnap.data() as any;
                    if (Array.isArray(data.templates)) setTemplates(data.templates as Template[]);
                    if (data.featureAccess) setFeatureAccess(data.featureAccess as FeatureAccess);
                }
            } catch (e) {
                // ignore load errors
            }
        };
        load();
    }, []);
    const [templates, setTemplates] = useState<Template[]>(initialTemplates);
    const [featureAccess, setFeatureAccess] = useState<FeatureAccess>(initialFeatureAccess);

    const handleConnect = async () => {
        if (!settings.apiKey?.trim()) {
            setStatusMsg('Por favor, insira uma chave de API.');
            return;
        }
        // Persist to Firestore (platform/brevo)
        try {
            setSaving(true);
            const ref = doc(db, 'platform', 'brevo');
            await setDoc(ref, { apiKey: settings.apiKey.trim(), isConnected: true, updatedAt: serverTimestamp() }, { merge: true });
            await setDoc(ref, { apiKey: settings.apiKey.trim(), isConnected: true, senderEmail: settings.senderEmail || '', senderName: settings.senderName || '', updatedAt: serverTimestamp() }, { merge: true });
            setSettings(s => ({ ...s, isConnected: true }));
            setStatusMsg('Chave Brevo salva e conexão ativada.');
            setTimeout(() => setStatusMsg(''), 3000);
        } catch (e) {
            setStatusMsg('Erro ao salvar a chave Brevo.');
        } finally {
            setSaving(false);
        }
    }
    
    const handleTemplateChange = (id: string, field: 'subject' | 'body', value: string) => {
        setTemplates(templates.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleFeatureToggle = (feature: string, plan: 'profissional' | 'avancado') => {
        setFeatureAccess(prev => ({
            ...prev,
            [feature]: {
                ...prev[feature],
                [plan]: !prev[feature][plan]
            }
        }));
    };

    const handleSaveAll = async () => {
        try {
            setSaving(true);
            await setDoc(doc(db, 'platform', 'automations'), {
                templates,
                featureAccess,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            setStatusMsg('Configurações de automação salvas.');
            setTimeout(() => setStatusMsg(''), 3000);
        } catch (e) {
            setStatusMsg('Erro ao salvar as automações.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* API Configuration */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Configuração da API Brevo</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">Insira sua chave de API v3 da Brevo para habilitar o envio de e-mails.</p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Nome do Remetente (ex: Agendiia)"
                            value={settings.senderName || ''}
                            onChange={(e) => setSettings(s => ({...s, senderName: e.target.value }))}
                            className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                        />
                        <input
                            type="email"
                            placeholder="E-mail do Remetente (verificado na Brevo)"
                            value={settings.senderEmail || ''}
                            onChange={(e) => setSettings(s => ({...s, senderEmail: e.target.value }))}
                            className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                    <input
                        type="password"
                        placeholder="sua-api-key-da-brevo"
                        value={settings.apiKey}
                        onChange={(e) => setSettings(s => ({...s, apiKey: e.target.value, isConnected: false}))}
                        className="flex-grow w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
                    />
                    <div className="flex items-center gap-3">
                    <button onClick={handleConnect} disabled={saving} className="bg-indigo-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-60">
                        {saving ? 'Salvando...' : 'Salvar e Conectar'}
                    </button>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${settings.isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {settings.isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                    {statusMsg && <span className="text-sm text-gray-600 dark:text-gray-300">{statusMsg}</span>}
                    </div>
                </div>
            </div>
            </div>

            {/* Transactional Email Templates */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Modelos de E-mail Transacional</h3>
                <div className="space-y-4">
                    {templates.map(template => (
                        <div key={template.id} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="font-semibold text-gray-700 dark:text-gray-300 flex items-center"><Bell className="h-4 w-4 mr-2"/>{template.event}</p>
                            <div className="mt-3 space-y-2">
                                <input type="text" value={template.subject} onChange={(e) => handleTemplateChange(template.id, 'subject', e.target.value)} className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600" placeholder="Assunto do E-mail"/>
                                <textarea value={template.body} onChange={(e) => handleTemplateChange(template.id, 'body', e.target.value)} rows={3} className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 resize-y" placeholder="Corpo do E-mail"/>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Variáveis disponíveis: <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded">{'{clientName}'}</code> <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded">{'{serviceName}'}</code> <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded">{'{dateTime}'}</code></p>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex justify-end">
                    <button type="button" onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar Modelos'}</button>
                </div>
            </div>
            
            {/* Feature Control by Plan */}
            <div>
                 <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Controle de Recursos por Plano</h3>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Recurso</th>
                                <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">Plano Profissional</th>
                                <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">Plano Avançado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <td className="p-3 font-medium text-gray-700 dark:text-gray-300">Notificações por SMS</td>
                                <td className="p-3 text-center"><Checkbox isChecked={featureAccess['sms'].profissional} onToggle={() => handleFeatureToggle('sms', 'profissional')} /></td>
                                <td className="p-3 text-center"><Checkbox isChecked={featureAccess['sms'].avancado} onToggle={() => handleFeatureToggle('sms', 'avancado')} /></td>
                            </tr>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <td className="p-3 font-medium text-gray-700 dark:text-gray-300">Workflows Personalizados</td>
                                <td className="p-3 text-center"><Checkbox isChecked={featureAccess['workflows'].profissional} onToggle={() => handleFeatureToggle('workflows', 'profissional')} /></td>
                                <td className="p-3 text-center"><Checkbox isChecked={featureAccess['workflows'].avancado} onToggle={() => handleFeatureToggle('workflows', 'avancado')} /></td>
                            </tr>
                             <tr>
                                <td className="p-3 font-medium text-gray-700 dark:text-gray-300">Follow-ups de Retorno</td>
                                <td className="p-3 text-center"><Checkbox isChecked={featureAccess['followups'].profissional} onToggle={() => handleFeatureToggle('followups', 'profissional')} /></td>
                                <td className="p-3 text-center"><Checkbox isChecked={featureAccess['followups'].avancado} onToggle={() => handleFeatureToggle('followups', 'avancado')} /></td>
                            </tr>
                        </tbody>
                    </table>
                 </div>
            </div>
             <div className="pt-4 flex justify-end">
                <button type="button" onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar Todas as Configurações'}</button>
            </div>
        </div>
    );
};

const Checkbox: React.FC<{ isChecked: boolean, onToggle: () => void }> = ({ isChecked, onToggle }) => (
    <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
    />
);

export default Automations;
