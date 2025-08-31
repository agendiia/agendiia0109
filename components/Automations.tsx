
import React, { useEffect, useState } from 'react';
import { BrevoSettings } from '../types';
import { Bell, Edit } from './Icons';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface Template {
    id: string;
    event: string;
    subject: string;
    body: string;
}

const initialTemplates: Template[] = [
    { 
        id: 't_sched', 
        event: 'Agendamento Realizado', 
        subject: 'Seu agendamento foi confirmado!', 
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
    <p style="font-size: 16px; margin-bottom: 20px;">Olá {clientName}, 👋</p>
    
    <p style="font-size: 16px; color: #16a34a; font-weight: bold; margin-bottom: 20px;">✅ Seu agendamento foi confirmado com sucesso!</p>
    
    <p style="font-size: 16px; font-weight: bold; margin-bottom: 15px;">📅 Detalhes da consulta:</p>
    
    <p style="margin-bottom: 8px;"><strong>Profissional:</strong> {professionalName}</p>
    <p style="margin-bottom: 8px;"><strong>Serviço:</strong> {serviceName}</p>
    <p style="margin-bottom: 8px;"><strong>Data:</strong> {appointmentDate}</p>
    <p style="margin-bottom: 20px;"><strong>Horário:</strong> {appointmentTime}</p>
    
    <p style="margin-bottom: 30px;">Se precisar reagendar ou cancelar, é só entrar em contato conosco.</p>
    
    <p style="margin-bottom: 0;">Atenciosamente,<br/>{professionalName}</p>
</div>` 
    },
    { 
        id: 't_remind', 
        event: 'Lembrete de Agendamento (24h)', 
        subject: 'Lembrete do seu agendamento', 
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">Olá {clientName}! 👋</h2>
    
    <p style="font-size: 16px; color: #f59e0b; font-weight: bold;">⏰ Lembrete do seu agendamento</p>
    
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p>Passando para lembrar do seu horário de <strong>{serviceName}</strong> amanhã às <strong>{appointmentTime}</strong>.</p>
        <p style="margin-bottom: 0;"><strong>Por favor, responda SIM para confirmar.</strong></p>
    </div>
    
    <p style="margin-top: 30px;">
        Atenciosamente,<br/>
        <strong>{professionalName}</strong>
    </p>
</div>` 
    },
    { 
        id: 't_cancel', 
        event: 'Agendamento Cancelado', 
        subject: 'Agendamento cancelado', 
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">Olá {clientName},</h2>
    
    <p style="font-size: 16px; color: #dc2626; font-weight: bold;">❌ Agendamento cancelado</p>
    
    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
        <p>Seu agendamento para <strong>{serviceName}</strong> no dia <strong>{appointmentDate}</strong> às <strong>{appointmentTime}</strong> foi cancelado.</p>
    </div>
    
    <p>Se desejar reagendar, é só entrar em contato conosco.</p>
    
    <p style="margin-top: 30px;">
        Atenciosamente,<br/>
        <strong>{professionalName}</strong>
    </p>
</div>` 
    },
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
    const { user } = useAuth();
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
                    if (Array.isArray(data.templates)) {
                        const savedTemplates = data.templates as Template[];
                        const savedTemplatesMap = new Map(savedTemplates.map(t => [t.id, t]));
                        const mergedTemplates = initialTemplates.map(initialT =>
                            savedTemplatesMap.get(initialT.id) || initialT
                        );
                        setTemplates(mergedTemplates);
                    }
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

    const handleResetTemplates = async () => {
        if (confirm('Tem certeza que deseja resetar todos os templates para os valores padrão? Esta ação não pode ser desfeita.')) {
            setTemplates([...initialTemplates]);
            setStatusMsg('Templates resetados para os valores padrão. Clique em "Salvar Modelos" para aplicar.');
            setTimeout(() => setStatusMsg(''), 5000);
        }
    };

    const handleSaveTemplates = async () => {
        try {
            setSaving(true);
            console.log('Salvando templates:', templates);
            console.log('Usuário atual:', user);
            
            // Verificar se usuário está autenticado
            if (!user) {
                throw new Error('Usuário não autenticado');
            }
            
            // Verificar se email está verificado
            if (!user.emailVerified) {
                throw new Error('Email não verificado');
            }
            
            const docRef = doc(db, 'platform', 'automations');
            console.log('Referência do documento:', docRef);
            
            const dataToSave = {
                templates,
                updatedAt: serverTimestamp(),
                lastUpdatedBy: user.email,
                version: Date.now() // Para tracking de versão
            };
            console.log('Dados a salvar:', dataToSave);
            
            await setDoc(docRef, dataToSave, { merge: true });
            
            console.log('Templates salvos com sucesso');
            setStatusMsg('Modelos de e-mail salvos com sucesso.');
            setTimeout(() => setStatusMsg(''), 3000);
        } catch (e) {
            console.error('Erro detalhado ao salvar templates:', e);
            console.error('Stack trace:', (e as Error).stack);
            
            // Melhor tratamento de erros específicos
            let errorMessage = 'Erro desconhecido';
            if (e instanceof Error) {
                if (e.message.includes('permission-denied')) {
                    errorMessage = 'Sem permissão para salvar. Verifique se você é administrador.';
                } else if (e.message.includes('network')) {
                    errorMessage = 'Erro de conexão. Verifique sua internet.';
                } else if (e.message.includes('auth')) {
                    errorMessage = 'Erro de autenticação. Faça login novamente.';
                } else {
                    errorMessage = e.message;
                }
            }
            
            setStatusMsg(`Erro ao salvar os modelos de e-mail: ${errorMessage}`);
            setTimeout(() => setStatusMsg(''), 8000);
        } finally {
            setSaving(false);
        }
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
                            <p className="text-xs text-gray-400 mt-2">
                                <strong>Variáveis disponíveis:</strong><br/>
                                <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded mr-1">{'{nome do cliente}'}</code>
                                <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded mr-1">{'{nome do profissional}'}</code>
                                <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded mr-1">{'{nome do serviço}'}</code>
                                <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded mr-1">{'{data}'}</code>
                                <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded">{'{horário}'}</code>
                                <br/>
                                <span className="text-blue-600 dark:text-blue-400 text-xs">💡 Dica: Você pode usar HTML para formatação (negrito, cores, etc.)</span>
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex justify-between items-center">
                    <button type="button" onClick={handleResetTemplates} className="bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-gray-600 text-sm">
                        🔄 Resetar Templates
                    </button>
                    <button type="button" onClick={handleSaveTemplates} disabled={saving} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar Modelos'}</button>
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
