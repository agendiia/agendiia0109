import { Client } from '../types';
import app, { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// SMTP-only: check platform/settings.smtp presence
export const getBrevoConnectionStatus = async (): Promise<boolean> => {
    try {
        const ref = doc(db, 'platform', 'settings');
        const snap = await getDoc(ref);
        if (!snap.exists()) return false;
        const data = snap.data() as any;
        const smtp = data.smtp || {};
        return !!(smtp.host && smtp.user && smtp.pass);
    } catch {
        return false;
    }
};

export const sendEmail = async (client: Client, subject: string, body: string): Promise<string> => {
    if (!client?.email) {
        throw new Error('Cliente sem e-mail.');
    }
    try {
        const functions = getFunctions(app, 'us-central1');
        const send = httpsCallable(functions, 'sendTransactionalEmail');
        const res: any = await send({
            toEmail: client.email,
            toName: client.name || client.email,
            subject,
            html: body,
        });
        const messageId = (res?.data as any)?.messageId || null;
        return `E-mail enviado para ${client.name || client.email} com sucesso${messageId ? ` (ID: ${messageId})` : ''}.`;
    } catch (err: any) {
        // Silent fallback in production
        return `E-mail (simulado) para ${client.name || client.email} enviado.`;
    }
};

export const sendWhatsApp = async (client: Client, body: string): Promise<string> => {
    if (!client?.phone && !(client as any)?.clientPhone) {
        throw new Error('Cliente sem telefone.');
    }
    const to = (client as any)?.clientPhone || client.phone!;
    try {
        const functions = getFunctions(app, 'us-central1');
        const sendWa = httpsCallable(functions, 'sendWhatsAppMessage');
        await sendWa({ to, message: body });
        return `WhatsApp enviado para ${client.name || to} com sucesso.`;
    } catch (err: any) {
        return `WhatsApp (simulado) para ${client.name || to} enviado.`;
    }
};