import React, { useEffect, useState } from 'react';
// avoid adding new deps; use window.location directly
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Simple payment page: reads appointmentId and professionalId from query, calls createMercadoPagoPreference and redirects
const PublicPaymentPage: React.FC = () => {
    const location = window.location;
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState<number>(3);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const appointmentId = params.get('appointmentId');
        const professionalId = params.get('professionalId');
        if (!appointmentId || !professionalId) {
            setError('Parâmetros inválidos para pagamento.');
            setLoading(false);
            return;
        }

        const run = async () => {
            try {
                // Read appointment to get real price and payer
                const apptRef = doc(db, 'users', professionalId, 'appointments', appointmentId);
                const apptSnap = await getDoc(apptRef);
                if (!apptSnap.exists()) throw new Error('Agendamento não encontrado.');
                const appt: any = apptSnap.data();
                const price = Number(appt.price) || 0;
                const serviceName = appt.service || `Agendamento ${appointmentId}`;
                const payerName = appt.clientName || '';
                const payerEmail = appt.clientEmail || '';
                // First check if the booking page precomputed a checkout URL and stored it
                try {
                    const pre = localStorage.getItem(`lastCheckoutUrl:${appointmentId}`);
                    if (pre) {
                        window.location.href = pre;
                        return;
                    }
                } catch (e) {}

                const functions = getFunctions(firebaseApp, 'us-central1');
                const createPref = httpsCallable(functions, 'createMercadoPagoPreference');
                const backBase = `${window.location.origin}/booking`;
                const resp: any = await createPref({
                    professionalId,
                    item: { title: serviceName, unit_price: Number(price), currency_id: 'BRL', quantity: 1 },
                    payer: { name: payerName, email: payerEmail },
                    back_urls: {
                        success: `${backBase}?mp=success&appointmentId=${appointmentId}`,
                        failure: `${backBase}?mp=failure&appointmentId=${appointmentId}`,
                        pending: `${backBase}?mp=pending&appointmentId=${appointmentId}`,
                    },
                    statement_descriptor: (serviceName || 'Agendiia').substring(0, 22),
                    metadata: { serviceId: appt.serviceId || null, clientEmail: payerEmail || '', appointmentId },
                });

                const url = resp?.data?.init_point || resp?.data?.sandbox_init_point || resp?.data?.init_point;
                if (!url) throw new Error('URL de checkout não retornada pelo servidor.');
                // Persist for possible future quick redirects
                try { localStorage.setItem(`lastCheckoutUrl:${appointmentId}`, url); } catch (e) {}

                // Show user a short redirection message with an alternative link before navigating
                setCheckoutUrl(url);
                setLoading(false);
                // Start countdown then redirect
                let secs = 3;
                setSecondsLeft(secs);
                const interval = setInterval(() => {
                    secs -= 1;
                    setSecondsLeft(secs);
                    if (secs <= 0) {
                        clearInterval(interval);
                        window.location.href = url;
                    }
                }, 1000);
            } catch (e: any) {
                console.error('Erro ao criar preferência MercadoPago:', e);
                setError(e?.message || 'Erro ao iniciar pagamento.');
                setLoading(false);
            }
        };

        run();
    }, [location.search]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <svg className="animate-spin h-8 w-8 text-[var(--theme-color)] mx-auto mb-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <p className="font-semibold mb-1">Redirecionando para a página de pagamento...</p>
                <p className="text-sm text-gray-500 mb-2">Você será automaticamente levado ao checkout do Mercado Pago em <strong>{secondsLeft}</strong> segundo{secondsLeft !== 1 ? 's' : ''}.</p>
                {checkoutUrl && (
                    <div className="text-sm">
                        <p className="mb-2">Se o redirecionamento não ocorrer automaticamente, clique no link abaixo para ir ao checkout agora:</p>
                        <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="underline text-[var(--theme-color)]">Abrir checkout do Mercado Pago</a>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <p className="text-red-500">{error}</p>
            </div>
        </div>
    );
};

export default PublicPaymentPage;
