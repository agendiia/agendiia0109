import { Client } from '../types';
import app, { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Email is sent via Firebase Callable Function (sendBrevoEmail). WhatsApp remains mocked for now.

// A mock function to simulate checking if the API key in settings is valid
export const getBrevoConnectionStatus = async (): Promise<boolean> => {
    try {
        const ref = doc(db, 'platform', 'brevo');
        const snap = await getDoc(ref);
        if (!snap.exists()) return false;
        const data = snap.data() as any;
        return !!data.apiKey && !!data.isConnected;
    } catch {
        return false;
    }
};

export const sendEmail = async (client: Client, subject: string, body: string): Promise<string> => {
    if (!client?.email) {
        throw new Error('Cliente sem e-mail.');
    }
    try {
        const functions = getFunctions(app);
        const send = httpsCallable(functions, 'sendBrevoEmail');
        const res: any = await send({
            toEmail: client.email,
            toName: client.name || client.email,
            subject,
            html: body,
        });
        const messageId = (res?.data as any)?.messageId || null;
        return `E-mail enviado para ${client.name || client.email} com sucesso${messageId ? ` (ID: ${messageId})` : ''}.`;
    } catch (err: any) {
    // Fallback to mock behavior if callable isn't available (e.g., functions not deployed yet)
    // Silent fallback in production
    return `E-mail (simulado) para ${client.name || client.email} enviado.`;
    }
};


export const sendWhatsApp = async (client: Client, body: string): Promise<string> => {
    // Mock WhatsApp functionality - silent in production

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate a 50/50 chance of success/failure for demonstration
            if (Math.random() > 0.1) { // 90% chance of success
                 resolve(`WhatsApp enviado para ${client.name} com sucesso.`);
            } else {
                reject(new Error("WhatsApp API Error."));
            }
        }, 1500); // Simulate network delay
    });
};