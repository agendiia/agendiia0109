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
                window.location.href = url;
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
                <p className="font-semibold">Redirecionando para o pagamento...</p>
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
