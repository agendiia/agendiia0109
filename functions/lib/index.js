"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContentAnalytics = exports.dismissAnnouncement = exports.getActiveAnnouncements = exports.createAnnouncement = exports.getAnnouncements = exports.createWikiPage = exports.getWikiPages = exports.publishLandingPage = exports.createLandingPage = exports.getLandingPages = exports.updateEmailTemplate = exports.createEmailTemplate = exports.getEmailTemplates = exports.getRateLimitStats = exports.monitorResources = exports.createCostAlert = exports.getCostAlerts = exports.getExternalServiceUsage = exports.getResourceViolations = exports.updateUserQuotas = exports.getResourceUsage = exports.notifyTrialsEndingToday = exports.expireTrialsDaily = exports.getPlatformAnalytics = exports.cancelStripeSubscription = exports.createStripeCustomerPortalSession = exports.createStripeCheckoutSession = exports.stripeWebhook = exports.grantOrExtendTrial = exports.setUserPlan = exports.exportAuditLogsCsv = exports.recordAdminAction = exports.updatePlatformSettings = exports.impersonateUser = exports.forcePasswordReset = exports.toggleUserStatus = exports.listPlatformUsers = exports.mercadoPagoWebhook = exports.finalizeReservation = exports.createReservation = exports.applyStorageCors = exports.sendDailyReminders = exports.onAppointmentCreated = exports.sendBrevoEmail = exports.createMercadoPagoPreference = void 0;
exports.finalizeReservationInternal = finalizeReservationInternal;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_2 = require("firebase-functions/v2/https");
const stripe_1 = __importDefault(require("stripe"));
const admin = __importStar(require("firebase-admin"));
const rateLimiter_1 = require("./rateLimiter");
admin.initializeApp();
// Small server-side email sender using Brevo settings in Firestore
async function sendEmailViaBrevo(toEmail, toName, subject, html) {
    if (!toEmail)
        throw new https_1.HttpsError('invalid-argument', 'Destino sem e-mail');
    const cfgSnap = await admin.firestore().doc('platform/brevo').get();
    const cfg = cfgSnap.exists ? cfgSnap.data() : null;
    const apiKey = cfg?.apiKey;
    const senderEmail = cfg?.senderEmail || 'no-reply@agendiia.app';
    const senderName = cfg?.senderName || 'Agendiia';
    if (!apiKey)
        throw new https_1.HttpsError('failed-precondition', 'Brevo não configurado.');
    const body = {
        sender: { email: senderEmail, name: senderName },
        to: [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent: html,
    };
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const t = await resp.text();
        throw new https_1.HttpsError('internal', `Erro Brevo: ${resp.status} - ${t}`);
    }
    const json = await resp.json();
    return json?.messageId || (Array.isArray(json?.messageIds) ? json.messageIds[0] : null);
}
function formatDateTimePtBR(d) {
    try {
        return d.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
    }
    catch {
        return d.toISOString();
    }
}
function applyTemplate(template, vars) {
    let out = template;
    for (const k of Object.keys(vars)) {
        const token = `{${k}}`;
        out = out.split(token).join(vars[k] ?? '');
    }
    return out;
}
// Callable to create a Mercado Pago preference securely on the server
exports.createMercadoPagoPreference = (0, https_1.onCall)({
    region: 'us-central1',
    cors: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'https://timevee-53a3c.web.app',
        'https://timevee-53a3c.firebaseapp.com',
        'https://agendiia.com.br',
        'https://www.agendiia.com.br'
    ]
}, async (request) => {
    const { professionalId, item, payer, back_urls, statement_descriptor, metadata } = (request?.data || {});
    if (!professionalId) {
        throw new https_1.HttpsError('invalid-argument', 'professionalId é obrigatório');
    }
    try {
        // Load professional's Mercado Pago access token from Firestore
        const gwDoc = await admin.firestore().doc(`users/${professionalId}/gateways/mercadopago`).get();
        const gw = gwDoc.data();
        const accessToken = gw?.config?.accessToken;
        if (!accessToken) {
            throw new https_1.HttpsError('failed-precondition', 'Mercado Pago não configurado.');
        }
        const body = {
            items: [item],
            payer,
            back_urls,
            statement_descriptor,
            metadata,
        };
        const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const t = await resp.text();
            throw new https_1.HttpsError('internal', `Erro MP: ${resp.status} - ${t}`);
        }
        const json = await resp.json();
        // Persist Mercado Pago preference id to the reservation when metadata.reservationId is present
        try {
            const prefId = json.id;
            const reservationId = metadata?.reservationId;
            const appointmentId = metadata?.appointmentId;
            if (prefId && reservationId) {
                try {
                    await admin.firestore().doc(`users/${professionalId}/reservations/${reservationId}`).update({ mpPreferenceId: prefId });
                }
                catch (e) {
                    // Non-fatal: log and continue
                    console.warn('Failed to persist mpPreferenceId on reservation', reservationId, e);
                }
            }
            // Persist preference id to appointment when appointmentId provided (two-step flow)
            if (prefId && appointmentId) {
                try {
                    await admin.firestore().doc(`users/${professionalId}/appointments/${appointmentId}`).update({ mpPreferenceId: prefId });
                }
                catch (e) {
                    console.warn('Failed to persist mpPreferenceId on appointment', appointmentId, e);
                }
            }
        }
        catch (e) {
            console.warn('Error while attempting to persist MercadoPago preference id', e);
        }
        return { init_point: json.init_point, sandbox_init_point: json.sandbox_init_point, id: json.id };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('internal', err?.message || 'Falha ao criar preferência');
    }
});
// Callable to send transactional email via Brevo (Sendinblue)
exports.sendBrevoEmail = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    const { toEmail, toName, subject, html } = (request?.data || {});
    if (!toEmail || !subject || !html) {
        throw new https_1.HttpsError('invalid-argument', 'Parâmetros obrigatórios ausentes.');
    }
    try {
        // Load platform-level Brevo settings
        const cfgSnap = await admin.firestore().doc('platform/brevo').get();
        const cfg = cfgSnap.exists ? cfgSnap.data() : null;
        const apiKey = cfg?.apiKey;
        const senderEmail = cfg?.senderEmail || 'no-reply@agendiia.app';
        const senderName = cfg?.senderName || 'Agendiia';
        if (!apiKey) {
            throw new https_1.HttpsError('failed-precondition', 'Brevo não configurado.');
        }
        const body = {
            sender: { email: senderEmail, name: senderName },
            to: [{ email: toEmail, name: toName || toEmail }],
            subject,
            htmlContent: html,
        };
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'content-type': 'application/json',
                'accept': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const t = await resp.text();
            throw new https_1.HttpsError('internal', `Erro Brevo: ${resp.status} - ${t}`);
        }
        const json = await resp.json();
        return { messageId: json?.messageId || (Array.isArray(json?.messageIds) ? json.messageIds[0] : null) };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('internal', err?.message || 'Falha ao enviar e-mail');
    }
});
// Firestore trigger: send confirmation email when a new appointment is created
exports.onAppointmentCreated = (0, firestore_1.onDocumentCreated)('users/{userId}/appointments/{appointmentId}', async (event) => {
    try {
        const snap = event.data;
        if (!snap)
            return;
        const data = snap.data();
        const clientEmail = data.clientEmail || data.email;
        const clientName = data.clientName || 'Cliente';
        if (!clientEmail)
            return; // nothing to send
        const serviceName = data.service || 'Atendimento';
        const dt = data.dateTime?.toDate ? data.dateTime.toDate() : new Date(data.dateTime);
        // Load template
        const autoSnap = await admin.firestore().doc('platform/automations').get();
        const defaults = {
            subject: 'Seu agendamento foi confirmado!',
            body: 'Olá {clientName}, seu agendamento para {serviceName} em {dateTime} foi realizado com sucesso!',
        };
        let subject = defaults.subject;
        let body = defaults.body;
        if (autoSnap.exists) {
            const au = autoSnap.data();
            const tmpl = Array.isArray(au.templates) ? au.templates.find((t) => t.id === 't_sched') : null;
            if (tmpl?.subject)
                subject = tmpl.subject;
            if (tmpl?.body)
                body = tmpl.body;
        }
        const vars = {
            clientName,
            serviceName,
            dateTime: formatDateTimePtBR(dt),
            time: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        };
        const html = applyTemplate(body, vars);
        const subj = applyTemplate(subject, vars);
        const msgId = await sendEmailViaBrevo(clientEmail, clientName, subj, html);
        await snap.ref.update({ confirmationEmailStatus: 'sent', confirmationEmailId: msgId || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    catch (e) {
        console.warn('onAppointmentCreated email error', e);
    }
});
// Scheduled reminder ~24h before: runs hourly, sends for items within 23.5h-24.5h from now and not yet reminded
exports.sendDailyReminders = (0, scheduler_1.onSchedule)({ schedule: 'every 60 minutes', timeZone: 'America/Sao_Paulo', region: 'us-central1' }, async () => {
    const now = new Date();
    const in23_5h = new Date(now.getTime() + 23.5 * 3600 * 1000);
    const in24_5h = new Date(now.getTime() + 24.5 * 3600 * 1000);
    try {
        const db = admin.firestore();
        const qs = await db.collectionGroup('appointments')
            .where('dateTime', '>=', in23_5h)
            .where('dateTime', '<=', in24_5h)
            .get();
        const batch = db.batch();
        for (const docSnap of qs.docs) {
            const ap = docSnap.data();
            if (ap.reminder24hSent || (ap.status && ap.status !== 'Agendado'))
                continue;
            const email = ap.clientEmail || ap.email;
            if (!email)
                continue;
            const name = ap.clientName || 'Cliente';
            const serviceName = ap.service || 'Atendimento';
            const dt = ap.dateTime?.toDate ? ap.dateTime.toDate() : new Date(ap.dateTime);
            // Load template (once would be better, but keep simple)
            const autoSnap = await db.doc('platform/automations').get();
            let subject = 'Lembrete do seu agendamento';
            let body = 'Olá, {clientName}! Passando para lembrar do seu horário de {serviceName} em {dateTime}. Por favor, responda SIM para confirmar.';
            if (autoSnap.exists) {
                const au = autoSnap.data();
                const tmpl = Array.isArray(au.templates) ? au.templates.find((t) => t.id === 't_remind') : null;
                if (tmpl?.subject)
                    subject = tmpl.subject;
                if (tmpl?.body)
                    body = tmpl.body;
            }
            const vars = {
                clientName: name,
                serviceName,
                dateTime: formatDateTimePtBR(dt),
                time: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
            };
            try {
                await sendEmailViaBrevo(email, name, applyTemplate(subject, vars), applyTemplate(body, vars));
                batch.update(docSnap.ref, { reminder24hSent: true, reminderSentAt: admin.firestore.FieldValue.serverTimestamp() });
            }
            catch (e) {
                console.warn('Reminder email failed for', docSnap.ref.path, e);
            }
        }
        await batch.commit();
    }
    catch (e) {
        console.warn('sendDailyReminders error', e);
    }
});
// One-off callable to apply CORS configuration to the default Storage bucket
exports.applyStorageCors = (0, https_1.onCall)({ region: 'us-central1' }, async () => {
    try {
        const bucket = admin.storage().bucket();
        // Allow localhost for dev, Firebase Hosting domains, and new custom domain
        const origins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174',
            'https://timevee-53a3c.web.app',
            'https://timevee-53a3c.firebaseapp.com',
            'https://agendiia.com.br',
            'https://www.agendiia.com.br',
        ];
        await bucket.setCors([
            { origin: origins, method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'], responseHeader: ['Content-Type', 'Authorization'], maxAgeSeconds: 3600 },
        ]);
        return { ok: true, origins };
    }
    catch (e) {
        throw new https_1.HttpsError('internal', e?.message || 'Failed to set CORS');
    }
});
// Create a temporary reservation atomically: writes a doc under users/{professionalId}/reservations
exports.createReservation = (0, https_1.onCall)({
    region: 'us-central1',
    cors: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'https://timevee-53a3c.web.app',
        'https://timevee-53a3c.firebaseapp.com',
        'https://agendiia.com.br',
        'https://www.agendiia.com.br'
    ]
}, async (req) => {
    const { professionalId, serviceId, dateTime, duration, clientName, clientEmail, gateway } = (req.data || {});
    if (!professionalId || !serviceId || !dateTime || !duration || !clientName) {
        throw new https_1.HttpsError('invalid-argument', 'Parâmetros obrigatórios faltando');
    }
    try {
        const db = admin.firestore();
        const start = new Date(dateTime);
        const end = new Date(start.getTime() + Number(duration) * 60000);
        // Load advanced settings for buffer validation (support legacy top-level fields and nested advancedSettings)
        const advancedSettingsDoc = await db.doc(`users/${professionalId}/availability/default`).get();
        const advDocData = advancedSettingsDoc.exists ? advancedSettingsDoc.data() : {};
        const advNested = advDocData?.advancedSettings || {};
        const bufferBefore = Number(advNested?.bufferBefore) || Number(advDocData?.bufferBefore) || 0;
        const bufferAfter = Number(advNested?.bufferAfter) || Number(advDocData?.bufferAfter) || 0;
        const maxAppointmentsPerDay = Number(advNested?.maxAppointmentsPerDay) || Number(advDocData?.maxAppointmentsPerDay) || 100;
        const minNoticeHours = Number(advNested?.minNoticeHours) || Number(advDocData?.minNoticeHours) || 0;
        const reservationHoldMinutes = Number(advNested?.reservationHoldMinutes) || Number(advDocData?.reservationHoldMinutes) || 15;
        const expiresAt = new Date(Date.now() + reservationHoldMinutes * 60 * 1000); // hold configured by professional (minutes)
        // Validate minimum notice
        const minTime = new Date(Date.now() + minNoticeHours * 60 * 60 * 1000);
        if (start < minTime) {
            throw new https_1.HttpsError('failed-precondition', `Agendamento requer pelo menos ${minNoticeHours} hora(s) de antecedência`);
        }
        // Run a transaction: ensure no overlapping appointment or active reservation exists
        const reservationRef = db.collection(`users/${professionalId}/reservations`).doc();
        await db.runTransaction(async (tx) => {
            // Query appointments on that day that may overlap (with buffers)
            const apptQ = await db.collection(`users/${professionalId}/appointments`).get();
            const dayAppointments = apptQ.docs.filter(a => {
                const ad = a.data();
                const aDate = ad.dateTime?.toDate ? ad.dateTime.toDate() : new Date(ad.dateTime);
                return aDate.toDateString() === start.toDateString() && ad.status !== 'Canceled';
            });
            // Check max appointments per day
            if (dayAppointments.length >= maxAppointmentsPerDay) {
                throw new https_1.HttpsError('resource-exhausted', 'Limite máximo de agendamentos por dia atingido');
            }
            // Check overlaps with appointments (including buffers)
            for (const a of apptQ.docs) {
                const ad = a.data();
                if (ad.status === 'Canceled')
                    continue;
                const aStart = ad.dateTime?.toDate ? ad.dateTime.toDate() : new Date(ad.dateTime);
                const aEnd = new Date(aStart.getTime() + (Number(ad.duration) || 0) * 60000);
                // Apply buffers to both appointments and new reservation
                const aStartWithBuffer = new Date(aStart.getTime() - bufferBefore * 60000);
                const aEndWithBuffer = new Date(aEnd.getTime() + bufferAfter * 60000);
                const startWithBuffer = new Date(start.getTime() - bufferBefore * 60000);
                const endWithBuffer = new Date(end.getTime() + bufferAfter * 60000);
                if (startWithBuffer < aEndWithBuffer && endWithBuffer > aStartWithBuffer) {
                    throw new https_1.HttpsError('already-exists', 'Horário já agendado (considerando intervalos de segurança)');
                }
            }
            // Check existing active reservations (including buffers)
            const resSnap = await db.collection(`users/${professionalId}/reservations`).get();
            for (const r of resSnap.docs) {
                const rd = r.data();
                if (rd.used)
                    continue;
                const rStart = rd.dateTime?.toDate ? rd.dateTime.toDate() : new Date(rd.dateTime);
                const rEnd = new Date(rStart.getTime() + (Number(rd.duration) || 0) * 60000);
                const rExpires = rd.expiresAt?.toDate ? rd.expiresAt.toDate() : new Date(rd.expiresAt || 0);
                if (rExpires > new Date()) {
                    // Apply buffers to both reservations
                    const rStartWithBuffer = new Date(rStart.getTime() - bufferBefore * 60000);
                    const rEndWithBuffer = new Date(rEnd.getTime() + bufferAfter * 60000);
                    const startWithBuffer = new Date(start.getTime() - bufferBefore * 60000);
                    const endWithBuffer = new Date(end.getTime() + bufferAfter * 60000);
                    if (startWithBuffer < rEndWithBuffer && endWithBuffer > rStartWithBuffer) {
                        throw new https_1.HttpsError('already-exists', 'Horário temporariamente reservado por outro cliente');
                    }
                }
            }
            tx.set(reservationRef, {
                serviceId,
                clientName,
                clientEmail: clientEmail || null,
                dateTime: admin.firestore.Timestamp.fromDate(start),
                duration: Number(duration),
                gateway: gateway || null,
                paymentStatus: 'pending',
                used: false,
                expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        return { ok: true, reservationId: reservationRef.id, expiresAt: expiresAt.toISOString() };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('internal', err?.message || 'Falha ao criar reserva');
    }
});
// Finalize reservation: mark used and create appointment atomically
// Helper: finalize reservation internal (used by callable and webhook)
async function finalizeReservationInternal(db, professionalId, reservationId, paymentStatusParam) {
    const resRef = db.doc(`users/${professionalId}/reservations/${reservationId}`);
    const apptRef = db.collection(`users/${professionalId}/appointments`).doc();
    // Load advanced settings for buffer validation
    const advancedSettingsDoc = await db.doc(`users/${professionalId}/availability/default`).get();
    const advancedSettings = advancedSettingsDoc.exists ? advancedSettingsDoc.data()?.advancedSettings : {};
    const bufferBefore = Number(advancedSettings?.bufferBefore) || 0;
    const bufferAfter = Number(advancedSettings?.bufferAfter) || 0;
    await db.runTransaction(async (tx) => {
        const resSnap = await tx.get(resRef);
        if (!resSnap.exists)
            throw new Error('Reserva nao encontrada');
        const rd = resSnap.data();
        const expiresAt = rd.expiresAt?.toDate ? rd.expiresAt.toDate() : new Date(rd.expiresAt || 0);
        if (rd.used)
            throw new Error('Reserva ja utilizada');
        if (expiresAt < new Date())
            throw new Error('Reserva expirou');
        const start = rd.dateTime?.toDate ? rd.dateTime.toDate() : new Date(rd.dateTime);
        const end = new Date(start.getTime() + (Number(rd.duration) || 0) * 60000);
        // Double-check no overlapping appointments were created meanwhile (with buffers)
        const apptQ = await db.collection(`users/${professionalId}/appointments`).get();
        for (const a of apptQ.docs) {
            const ad = a.data();
            if (ad.status === 'Canceled')
                continue;
            const aStart = ad.dateTime?.toDate ? ad.dateTime.toDate() : new Date(ad.dateTime);
            const aEnd = new Date(aStart.getTime() + (Number(ad.duration) || 0) * 60000);
            const aStartWithBuffer = new Date(aStart.getTime() - bufferBefore * 60000);
            const aEndWithBuffer = new Date(aEnd.getTime() + bufferAfter * 60000);
            const startWithBuffer = new Date(start.getTime() - bufferBefore * 60000);
            const endWithBuffer = new Date(end.getTime() + bufferAfter * 60000);
            if (startWithBuffer < aEndWithBuffer && endWithBuffer > aStartWithBuffer) {
                throw new Error('Horario ja agendado por outro cliente');
            }
        }
        const paramPayment = paymentStatusParam;
        const rdPayment = rd.paymentStatus;
        const isPaid = (paramPayment && (paramPayment === 'paid' || paramPayment === 'Pago' || paramPayment === 'Paid'))
            || (rdPayment && (rdPayment === 'paid' || rdPayment === 'Pago' || rdPayment === 'Paid'));
        const apptData = {
            clientName: rd.clientName || 'Cliente',
            clientEmail: rd.clientEmail || null,
            service: rd.serviceId,
            dateTime: admin.firestore.Timestamp.fromDate(start),
            duration: Number(rd.duration) || 0,
            status: isPaid ? 'Confirmado' : 'Agendado',
            paymentStatus: paymentStatusParam || rd.paymentStatus || (isPaid ? 'Pago' : 'pending'),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        // Create the appointment and write appointmentId back to the reservation
        // Removed console.log for production performance
        tx.set(apptRef, apptData);
        const newResPaymentStatus = paymentStatusParam || (isPaid ? 'paid' : rd.paymentStatus || 'pending');
        tx.update(resRef, { used: true, finalizedAt: admin.firestore.FieldValue.serverTimestamp(), paymentStatus: newResPaymentStatus, appointmentId: apptRef.id });
        // Appointment created successfully
    });
    return { ok: true, appointmentId: apptRef.id };
}
// Finalize reservation callable (wraps the internal helper)
exports.finalizeReservation = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    const db = admin.firestore();
    const { professionalId, reservationId, paymentStatus } = (req.data || {});
    if (!professionalId || !reservationId)
        throw new https_1.HttpsError('invalid-argument', 'professionalId e reservationId são obrigatórios');
    try {
        return await finalizeReservationInternal(db, professionalId, reservationId, paymentStatus);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('internal', err?.message || 'Falha ao finalizar reserva');
    }
});
// MercadoPago webhook endpoint: receives notifications and finalizes reservation when payment is approved.
exports.mercadoPagoWebhook = (0, https_2.onRequest)({ region: 'us-central1', cors: false }, async (req, res) => {
    try {
        // Basic handling: MercadoPago will POST notifications with 'type' and 'data' that include an id (payment id or merchant_order id)
        const body = req.body || {};
        const topic = body.type || req.query.type || req.headers['x-mp-type'];
        const id = body.data?.id || req.query.id || req.headers['x-mp-id'];
        if (!id) {
            res.status(400).send({ error: 'Missing id' });
            return;
        }
        // We'll try to fetch payment or merchant_order detail to find preference id/metadata
        // Need professional's access token to call MercadoPago API; we'll attempt to look up any reservation that has mpPreferenceId equal to id first.
        const db = admin.firestore();
        // Search reservations with mpPreferenceId === id (fast path)
        const prefQuery = await db.collectionGroup('reservations').where('mpPreferenceId', '==', String(id)).limit(1).get();
        let targetReservation = null;
        if (!prefQuery.empty)
            targetReservation = prefQuery.docs[0];
        // If not found as reservation, try to find an appointment directly using mpPreferenceId (two-stage flow)
        let targetAppointment = null;
        if (!targetReservation) {
            const apptQuery = await db.collectionGroup('appointments').where('mpPreferenceId', '==', String(id)).limit(1).get();
            if (!apptQuery.empty)
                targetAppointment = apptQuery.docs[0];
        }
        // If not found, try to query by metadata in merchant_order/payment via MercadoPago public API using stored access tokens per professional.
        if (!targetReservation) {
            // Try to inspect merchants orders: we'll fetch merchant_order or payment to extract preference id from metadata
            // This requires iterating professionals' gateway configs which may be large; attempt a best-effort: if env MP_SERVICE_TOKEN present, use it as a global token.
            const globalToken = process.env.MP_SERVICE_TOKEN;
            if (!globalToken) {
                // cannot continue reliably
                res.status(202).send({ ok: true, note: 'No global MP token; prefer to configure MP_SERVICE_TOKEN to enable webhook lookup' });
                return;
            }
            const apiUrl = `https://api.mercadopago.com/v1/payments/${id}`;
            const resp = await fetch(apiUrl, { headers: { Authorization: `Bearer ${globalToken}` } });
            if (!resp.ok) {
                // Try merchant_orders
                const resp2 = await fetch(`https://api.mercadopago.com/merchant_orders/${id}`, { headers: { Authorization: `Bearer ${globalToken}` } });
                if (!resp2.ok) {
                    res.status(202).send({ ok: true, note: 'No reservation matched and external lookup failed' });
                    return;
                }
                const mo = await resp2.json();
                // merchant_order may contain 'payments' array; inspect payments' metadata or order items' metadata
                const payments = mo.payments || [];
                for (const p of payments) {
                    const pref = p.preference_id || p.order?.preference_id || p.order?.preferenceId || p.preferenceId;
                    if (pref) {
                        const q = await db.collectionGroup('reservations').where('mpPreferenceId', '==', String(pref)).limit(1).get();
                        if (!q.empty) {
                            targetReservation = q.docs[0];
                            break;
                        }
                    }
                    const resMeta = p.metadata || p.additional_info || {};
                    const reservationId = resMeta.reservationId || resMeta.reservation_id || resMeta.reservation || null;
                    if (reservationId) {
                        // try to find any reservation with that id
                        const rr = await db.collectionGroup('reservations').where('id', '==', String(reservationId)).limit(1).get();
                        if (!rr.empty) {
                            targetReservation = rr.docs[0];
                            break;
                        }
                    }
                }
            }
            else {
                // If global token present but payments endpoint succeeded, inspect returned JSON
                const json = await resp.json();
                const pref = json.preference_id || json.order?.preference_id;
                if (pref) {
                    const q = await db.collectionGroup('reservations').where('mpPreferenceId', '==', String(pref)).limit(1).get();
                    if (!q.empty)
                        targetReservation = q.docs[0];
                }
            }
        }
        if (!targetReservation && !targetAppointment) {
            res.status(202).send({ ok: true, note: 'No matching reservation found' });
            return;
        }
        let professionalId = null;
        let resData = null;
        if (targetReservation) {
            resData = targetReservation.data();
            professionalId = targetReservation.ref.path.split('/')[1];
        }
        else if (targetAppointment) {
            resData = targetAppointment.data();
            professionalId = targetAppointment.ref.path.split('/')[1];
        }
        // Verify payment status: if we have a global token we can query payment status; otherwise we can trust notification topic if it's payment
        let finalized = false;
        try {
            // If topic indicates payment and status is approved, finalize
            // Best-effort: attempt to use global token to check payment status
            const globalToken = process.env.MP_SERVICE_TOKEN;
            let isApproved = false;
            if (globalToken) {
                const pResp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${globalToken}` } });
                if (pResp.ok) {
                    const pJson = await pResp.json();
                    if (pJson.status === 'approved' || pJson.status === 'paid')
                        isApproved = true;
                }
            }
            else {
                // If no token, treat notification type 'payment' as approval for now
                if (String(topic).toLowerCase().includes('payment') || String(topic).toLowerCase().includes('approved'))
                    isApproved = true;
            }
            if (isApproved) {
                if (targetReservation) {
                    // finalize using internal helper for reservations
                    await finalizeReservationInternal(db, professionalId, targetReservation.id, 'paid');
                    finalized = true;
                }
                else if (targetAppointment) {
                    // Directly update appointment payment status for two-stage flow
                    try {
                        const apptRef = targetAppointment.ref;
                        await apptRef.update({ paymentStatus: 'Pago', status: 'Confirmado', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                        // also ensure mpPreferenceId already present; write appointment id into any matching reservation if exists
                        // Try to find any reservation that references this appointmentId and mark used
                        const resQ = await db.collectionGroup('reservations').where('appointmentId', '==', targetAppointment.id).limit(1).get();
                        if (!resQ.empty) {
                            const rRef = resQ.docs[0].ref;
                            await rRef.update({ used: true, appointmentId: targetAppointment.id, paymentStatus: 'Pago', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                        }
                        finalized = true;
                    }
                    catch (e) {
                        console.warn('Failed to update appointment from webhook', e);
                    }
                }
            }
        }
        catch (e) {
            console.warn('Failed to finalize from webhook', e);
        }
        if (finalized)
            res.status(200).send({ ok: true });
        else
            res.status(202).send({ ok: true, note: 'Not finalized (not approved yet)' });
    }
    catch (e) {
        console.error('mercadoPagoWebhook error', e);
        res.status(500).send({ error: e?.message || 'internal' });
    }
});
// --- Admin Panel Helper Callables ---
// Very lightweight role check: admin emails stored in platform_settings.adminEmails
async function assertIsPlatformAdmin(ctx) {
    const uid = ctx.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Login necessário');
    const userRec = await admin.auth().getUser(uid).catch(() => null);
    const email = userRec?.email?.toLowerCase();
    if (!email)
        throw new https_1.HttpsError('permission-denied', 'Sem e-mail');
    const settingsSnap = await admin.firestore().doc('platform_settings').get();
    const admins = (settingsSnap.exists ? settingsSnap.data().adminEmails : []) || [];
    const fallback = ['admin@agendiia.com.br', 'contato@agendiia.com.br'];
    const allowed = new Set([...admins.map(e => e.toLowerCase()), ...fallback]);
    if (!allowed.has(email))
        throw new https_1.HttpsError('permission-denied', 'Acesso restrito');
    return { uid, email };
}
// List users with basic auth metadata
exports.listPlatformUsers = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    await assertIsPlatformAdmin(req);
    const { limit = 500 } = (req.data || {});
    const list = await admin.auth().listUsers(limit);
    // Merge with Firestore doc (plan/status/createdAt)
    const db = admin.firestore();
    const out = [];
    for (const u of list.users) {
        const fsDoc = await db.doc(`users/${u.uid}`).get().catch(() => null);
        const data = fsDoc?.exists ? fsDoc.data() : {};
        out.push({
            id: u.uid,
            name: data.name || u.displayName || 'Sem nome',
            email: (data.email || u.email || '').toLowerCase(),
            plan: data.plan || 'Profissional',
            status: data.status || 'Ativo',
            joinDate: data.createdAt || u.metadata.creationTime,
            totalRevenue: data.totalRevenue || 0,
            emailVerified: u.emailVerified,
            lastLoginAt: u.metadata.lastSignInTime || null,
        });
    }
    return { users: out };
});
// Toggle suspension (status field only)
exports.toggleUserStatus = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    await assertIsPlatformAdmin(req);
    const { userId, suspend } = (req.data || {});
    if (!userId)
        throw new https_1.HttpsError('invalid-argument', 'userId faltando');
    await admin.firestore().doc(`users/${userId}`).set({ status: suspend ? 'Suspenso' : 'Ativo', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
});
// Force password reset: revoke tokens so next login requires reauth (UI will send reset email)
exports.forcePasswordReset = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    await assertIsPlatformAdmin(req);
    const { userId } = (req.data || {});
    if (!userId)
        throw new https_1.HttpsError('invalid-argument', 'userId faltando');
    await admin.auth().revokeRefreshTokens(userId);
    await admin.firestore().doc(`users/${userId}`).set({ forcePasswordReset: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
});
// Impersonate: create a custom token for target user
exports.impersonateUser = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    await assertIsPlatformAdmin(req);
    const { targetUserId } = (req.data || {});
    if (!targetUserId)
        throw new https_1.HttpsError('invalid-argument', 'targetUserId faltando');
    const token = await admin.auth().createCustomToken(targetUserId, { impersonated: true });
    return { token };
});
// Update platform settings + admin emails + feature flags
exports.updatePlatformSettings = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    const adminInfo = await assertIsPlatformAdmin(req);
    const { settings, adminEmails, featureFlags } = (req.data || {});
    const ref = admin.firestore().doc('platform_settings');
    const data = {};
    if (settings)
        Object.assign(data, settings);
    if (Array.isArray(adminEmails))
        data.adminEmails = adminEmails.map((e) => e.toLowerCase());
    if (featureFlags && typeof featureFlags === 'object')
        data.featureFlags = featureFlags;
    if (!Object.keys(data).length)
        throw new https_1.HttpsError('invalid-argument', 'Nada para atualizar');
    data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await ref.set(data, { merge: true });
    await admin.firestore().collection('platform_auditLogs').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        user: adminInfo.email,
        action: 'UPDATE_SETTINGS',
        details: Object.keys(data).join(','),
    });
    return { ok: true };
});
// Record a generic admin action (client side convenience)
exports.recordAdminAction = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    const adminInfo = await assertIsPlatformAdmin(req);
    const { action, details } = (req.data || {});
    if (!action)
        throw new https_1.HttpsError('invalid-argument', 'action obrigatório');
    await admin.firestore().collection('platform_auditLogs').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        user: adminInfo.email,
        action,
        details: details || '',
    });
    return { ok: true };
});
// Export audit logs as CSV (simple string return)
exports.exportAuditLogsCsv = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    await assertIsPlatformAdmin(req);
    const { limit = 1000 } = (req.data || {});
    const qs = await admin.firestore().collection('platform_auditLogs').orderBy('timestamp', 'desc').limit(limit).get();
    const rows = ['timestamp,user,action,details'];
    for (const d of qs.docs) {
        const x = d.data();
        const ts = x.timestamp?.toDate ? x.timestamp.toDate().toISOString() : '';
        const esc = (v) => '"' + (v || '').replace(/"/g, '""') + '"';
        rows.push([ts, x.user, x.action, x.details].map(esc).join(','));
    }
    return { csv: rows.join('\n') };
});
// Manually set user plan
exports.setUserPlan = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    await assertIsPlatformAdmin(req);
    const { userId, plan } = (req.data || {});
    if (!userId || !plan)
        throw new https_1.HttpsError('invalid-argument', 'userId e plan são obrigatórios');
    await admin.firestore().doc(`users/${userId}`).set({ plan, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
});
// Grant or extend trial
exports.grantOrExtendTrial = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    await assertIsPlatformAdmin(req);
    const { userId, extraDays } = (req.data || {});
    if (!userId || !extraDays)
        throw new https_1.HttpsError('invalid-argument', 'userId e extraDays são obrigatórios');
    const ref = admin.firestore().doc(`users/${userId}`);
    const snap = await ref.get();
    const now = new Date();
    let current = now;
    const data = snap.exists ? snap.data() : {};
    if (data.trialEndsAt) {
        const cur = data.trialEndsAt.toDate ? data.trialEndsAt.toDate() : new Date(data.trialEndsAt);
        current = cur > now ? cur : now;
    }
    const newEnd = new Date(current.getTime() + extraDays * 86400000);
    await ref.set({ plan: 'Trial', trialEndsAt: newEnd.toISOString(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { trialEndsAt: newEnd.toISOString() };
});
// Stripe webhook skeleton (extend with real secret validation later)
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
exports.stripeWebhook = (0, https_2.onRequest)({ region: 'us-central1', cors: false }, async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        res.status(500).send({ error: 'Webhook secret ausente' });
        return;
    }
    let event;
    try {
        // functions v2 may parse body; ensure raw body via req.rawBody
        const payload = req.rawBody || JSON.stringify(req.body);
        event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    }
    catch (err) {
        res.status(400).send({ error: `Assinatura inválida: ${err.message}` });
        return;
    }
    try {
        const db = admin.firestore();
        switch (event.type) {
            case 'invoice.payment_succeeded': {
                const inv = event.data.object;
                const customerEmail = inv.customer_email;
                if (customerEmail) {
                    const qs = await db.collection('users').where('email', '==', customerEmail.toLowerCase()).limit(1).get();
                    if (!qs.empty) {
                        const periodEnd = inv.lines.data[0]?.period?.end ? new Date(inv.lines.data[0].period.end * 1000).toISOString() : null;
                        await qs.docs[0].ref.set({ subscriptionStatus: 'Ativo', currentPeriodEnd: periodEnd, plan: 'Profissional' }, { merge: true });
                    }
                }
                break;
            }
            case 'invoice.payment_failed': {
                const inv = event.data.object;
                const customerEmail = inv.customer_email;
                if (customerEmail) {
                    const qs = await db.collection('users').where('email', '==', customerEmail.toLowerCase()).limit(1).get();
                    if (!qs.empty) {
                        await qs.docs[0].ref.set({ subscriptionStatus: 'Inativo' }, { merge: true });
                    }
                }
                break;
            }
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const customerId = sub.customer;
                // Optionally fetch customer for email
                try {
                    const cust = await stripe.customers.retrieve(customerId);
                    const email = cust?.email;
                    if (email) {
                        const qs = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
                        if (!qs.empty) {
                            const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
                            const statusMap = { active: 'Ativo', trialing: 'Trial', past_due: 'Inativo', canceled: 'Inativo', incomplete: 'Inativo' };
                            await qs.docs[0].ref.set({ subscriptionStatus: statusMap[sub.status] || 'Inativo', currentPeriodEnd: periodEnd }, { merge: true });
                        }
                    }
                }
                catch { }
                break;
            }
        }
        res.status(200).send({ received: true });
    }
    catch (e) {
        res.status(500).send({ error: e?.message || 'Falha processamento' });
    }
});
// Callable to create a Stripe Checkout Session for a user
exports.createStripeCheckoutSession = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    const data = (request.data || {});
    const priceId = data.priceId;
    const mode = data.mode || 'subscription';
    const successUrl = data.successUrl || data.success_url || data.success || null;
    const cancelUrl = data.cancelUrl || data.cancel_url || data.cancel || null;
    const uid = request.auth?.uid || data.userId;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Usuário precisa estar autenticado');
    if (!priceId)
        throw new https_1.HttpsError('invalid-argument', 'priceId é obrigatório');
    try {
        const db = admin.firestore();
        const userRef = db.doc(`users/${uid}`);
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? userSnap.data() : {};
        // Ensure Stripe Customer exists for this user
        let stripeCustomerId = userData.stripeCustomerId;
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({ metadata: { firebaseUid: uid }, email: userData.email || undefined });
            stripeCustomerId = customer.id;
            await userRef.set({ stripeCustomerId }, { merge: true });
        }
        const session = await stripe.checkout.sessions.create({
            mode: mode,
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            customer: stripeCustomerId,
            success_url: successUrl || 'https://agendiia.com.br/?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: cancelUrl || 'https://agendiia.com.br/?canceled=true',
        });
        return { url: session.url };
    }
    catch (err) {
        console.error('createStripeCheckoutSession error', err);
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('internal', err?.message || 'Falha ao criar sessão de checkout');
    }
});
// Callable to create a Stripe Customer Portal session
exports.createStripeCustomerPortalSession = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    const data = (request.data || {});
    const returnUrl = data.returnUrl || data.return_url || data.return || null;
    const uid = request.auth?.uid || data.userId;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Usuário precisa estar autenticado');
    try {
        const db = admin.firestore();
        const userRef = db.doc(`users/${uid}`);
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? userSnap.data() : {};
        const stripeCustomerId = userData.stripeCustomerId;
        if (!stripeCustomerId)
            throw new https_1.HttpsError('failed-precondition', 'Stripe customer não encontrado para este usuário');
        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl || 'https://agendiia.com.br/account',
        });
        return { url: session.url };
    }
    catch (err) {
        console.error('createStripeCustomerPortalSession error', err);
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('internal', err?.message || 'Falha ao criar sessão do portal do cliente');
    }
});
// Callable: request cancellation of the customer's active Stripe subscription(s)
exports.cancelStripeSubscription = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Usuário precisa estar autenticado');
    try {
        const db = admin.firestore();
        const userRef = db.doc(`users/${uid}`);
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? userSnap.data() : {};
        const stripeCustomerId = userData.stripeCustomerId;
        if (!stripeCustomerId)
            throw new https_1.HttpsError('failed-precondition', 'Stripe customer não encontrado para este usuário');
        // List active subscriptions for this customer
        const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 50 });
        if (!subs.data || subs.data.length === 0) {
            return { ok: false, message: 'Nenhuma assinatura ativa encontrada' };
        }
        const canceled = [];
        for (const s of subs.data) {
            try {
                const updated = await stripe.subscriptions.update(s.id, { cancel_at_period_end: true });
                const periodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null;
                canceled.push({ id: s.id, cancelAtPeriodEnd: true, periodEnd });
                // Update Firestore user doc with cancellation request info
                await userRef.set({ subscriptionStatus: 'CancelRequested', cancelRequestedAt: admin.firestore.FieldValue.serverTimestamp(), endsAt: periodEnd }, { merge: true });
            }
            catch (e) {
                console.warn('cancelStripeSubscription: failed to cancel', s.id, e);
            }
        }
        return { ok: true, canceled };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('internal', err?.message || 'Falha ao cancelar assinatura');
    }
});
// Analytics and Metrics Functions
exports.getPlatformAnalytics = (0, https_1.onCall)({ region: 'us-central1' }, async (req) => {
    // Apply admin rate limiting
    if (req.auth?.uid) {
        await (0, rateLimiter_1.applyRateLimit)(req.auth.uid, 'getPlatformAnalytics', rateLimiter_1.adminRateLimiter);
    }
    await assertIsPlatformAdmin(req);
    // Check admin plan limits for analytics access
    if (req.auth?.uid) {
        await (0, rateLimiter_1.checkPlanLimits)(req.auth.uid, 'apiCalls');
    }
    const { period = '30d', startDate, endDate } = (req.data || {});
    try {
        const db = admin.firestore();
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        // Calculate date range
        const start = startDate ? new Date(startDate) : thirtyDaysAgo;
        const end = endDate ? new Date(endDate) : now;
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Get all transactions
        const transactionsSnapshot = await db.collection('platform_transactions').get();
        const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Get all appointments (collection group query)
        const appointmentsSnapshot = await db.collectionGroup('appointments').get();
        const appointments = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Calculate metrics
        const metrics = await calculatePlatformMetrics(users, transactions, appointments, start, end);
        const revenueMetrics = await calculateRevenueMetrics(users, transactions, start, end);
        const userGrowthMetrics = await calculateUserGrowthMetrics(users, start, end);
        const usageMetrics = await calculateUsageMetrics(users, start, end);
        const conversionMetrics = await calculateConversionMetrics(users, start, end);
        const appointmentMetrics = await calculateAppointmentMetrics(appointments, start, end);
        return {
            platformMetrics: metrics,
            revenueMetrics,
            userGrowthMetrics,
            usageMetrics,
            conversionMetrics,
            appointmentMetrics,
            period: { start: start.toISOString(), end: end.toISOString() }
        };
    }
    catch (error) {
        throw new https_1.HttpsError('internal', `Erro ao calcular analytics: ${error.message}`);
    }
});
// Helper function to calculate platform metrics
async function calculatePlatformMetrics(users, transactions, appointments, start, end) {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => {
        const lastLogin = u.lastLoginAt ? (u.lastLoginAt.toDate ? u.lastLoginAt.toDate() : new Date(u.lastLoginAt)) : null;
        return lastLogin && lastLogin >= start;
    }).length;
    const totalRevenue = transactions
        .filter(t => t.status === 'Paid')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    const monthlyRevenue = transactions
        .filter(t => {
        const date = t.createdAt ? (t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt)) : null;
        return date && date >= start && date <= end && t.status === 'Paid';
    })
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalAppointments = appointments.length;
    // Calculate conversion rate (trial to subscription)
    const trialUsers = users.filter(u => u.plan === 'Trial').length;
    const subscribedUsers = users.filter(u => u.plan !== 'Trial' && u.subscriptionStatus === 'Ativo').length;
    const conversionRate = trialUsers > 0 ? (subscribedUsers / (trialUsers + subscribedUsers)) * 100 : 0;
    // Calculate churn rate (simplified)
    const canceledUsers = users.filter(u => u.subscriptionStatus === 'Inativo').length;
    const churnRate = totalUsers > 0 ? (canceledUsers / totalUsers) * 100 : 0;
    // Calculate LTV (simplified)
    const averageLifetimeValue = subscribedUsers > 0 ? totalRevenue / subscribedUsers : 0;
    // Calculate CAC (simplified - would need marketing spend data)
    const customerAcquisitionCost = 0; // Placeholder
    return {
        totalUsers,
        activeUsers,
        totalRevenue,
        monthlyRevenue,
        totalAppointments,
        conversionRate: Math.round(conversionRate * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
        averageLifetimeValue: Math.round(averageLifetimeValue * 100) / 100,
        customerAcquisitionCost
    };
}
// Helper function to calculate revenue metrics
async function calculateRevenueMetrics(users, transactions, start, end) {
    const paidTransactions = transactions.filter(t => t.status === 'Paid');
    // Revenue by plan
    const byPlan = {};
    users.forEach(user => {
        const userTransactions = paidTransactions.filter(t => t.userId === user.id);
        const revenue = userTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        byPlan[user.plan || 'Unknown'] = (byPlan[user.plan || 'Unknown'] || 0) + revenue;
    });
    // Revenue by month (last 12 months)
    const byMonth = [];
    for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const monthEnd = new Date(end.getFullYear(), end.getMonth() - i + 1, 0);
        const monthRevenue = paidTransactions
            .filter(t => {
            const date = t.createdAt ? (t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt)) : null;
            return date && date >= monthStart && date <= monthEnd;
        })
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const monthUsers = users.filter(u => {
            const created = u.createdAt ? (u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)) : null;
            return created && created >= monthStart && created <= monthEnd;
        }).length;
        byMonth.push({
            month: monthStart.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
            revenue: Math.round(monthRevenue * 100) / 100,
            users: monthUsers
        });
    }
    const totalRevenue = paidTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const recurring = totalRevenue * 0.8; // Simplified assumption
    const oneTime = totalRevenue * 0.2;
    // Calculate growth (current month vs previous month)
    const currentMonth = byMonth[byMonth.length - 1]?.revenue || 0;
    const previousMonth = byMonth[byMonth.length - 2]?.revenue || 0;
    const growth = previousMonth > 0 ? ((currentMonth - previousMonth) / previousMonth) * 100 : 0;
    return {
        byPlan,
        byMonth,
        recurring: Math.round(recurring * 100) / 100,
        oneTime: Math.round(oneTime * 100) / 100,
        growth: Math.round(growth * 100) / 100
    };
}
// Helper function to calculate user growth metrics
async function calculateUserGrowthMetrics(users, start, end) {
    const newUsers = [];
    const activeUsers = [];
    const churnedUsers = [];
    // Generate daily data for the period
    const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    for (let i = 0; i < days; i++) {
        const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
        const newCount = users.filter(u => {
            const created = u.createdAt ? (u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)) : null;
            return created && created >= dayStart && created < dayEnd;
        }).length;
        const activeCount = users.filter(u => {
            const lastLogin = u.lastLoginAt ? (u.lastLoginAt.toDate ? u.lastLoginAt.toDate() : new Date(u.lastLoginAt)) : null;
            return lastLogin && lastLogin >= dayStart && lastLogin < dayEnd;
        }).length;
        const churnedCount = users.filter(u => {
            const updated = u.updatedAt ? (u.updatedAt.toDate ? u.updatedAt.toDate() : new Date(u.updatedAt)) : null;
            return updated && updated >= dayStart && updated < dayEnd && u.subscriptionStatus === 'Inativo';
        }).length;
        newUsers.push({ date: day.toISOString().split('T')[0], count: newCount });
        activeUsers.push({ date: day.toISOString().split('T')[0], count: activeCount });
        churnedUsers.push({ date: day.toISOString().split('T')[0], count: churnedCount });
    }
    // Calculate trial to subscription conversion
    const trialUsers = users.filter(u => u.plan === 'Trial').length;
    const subscribedUsers = users.filter(u => u.plan !== 'Trial' && u.subscriptionStatus === 'Ativo').length;
    const trialToSubscription = trialUsers > 0 ? (subscribedUsers / (trialUsers + subscribedUsers)) * 100 : 0;
    // Calculate retention rate (simplified)
    const retentionRate = users.length > 0 ? (users.filter(u => u.subscriptionStatus === 'Ativo').length / users.length) * 100 : 0;
    return {
        newUsers,
        activeUsers,
        churnedUsers,
        trialToSubscription: Math.round(trialToSubscription * 100) / 100,
        retentionRate: Math.round(retentionRate * 100) / 100
    };
}
// Helper function to calculate usage metrics
async function calculateUsageMetrics(users, start, end) {
    // This would require actual usage tracking data
    // For now, we'll return placeholder data
    const featuresUsage = {
        appointments: users.length * 0.8,
        clients: users.length * 0.6,
        services: users.length * 0.9,
        finance: users.length * 0.4,
        marketing: users.length * 0.2,
        reports: users.length * 0.3
    };
    const popularFeatures = Object.entries(featuresUsage)
        .map(([feature, usage]) => ({ feature, usage }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 5);
    return {
        featuresUsage,
        sessionDuration: 25.5, // Average minutes
        engagementScore: 7.2, // Out of 10
        popularFeatures,
        timeDistribution: {
            morning: 25,
            afternoon: 45,
            evening: 30
        }
    };
}
// Helper function to calculate conversion metrics
async function calculateConversionMetrics(users, start, end) {
    const trialUsers = users.filter(u => u.plan === 'Trial');
    const subscribedUsers = users.filter(u => u.plan !== 'Trial' && u.subscriptionStatus === 'Ativo');
    const canceledUsers = users.filter(u => u.subscriptionStatus === 'Inativo');
    const trialToSubscription = trialUsers.length > 0 ?
        (subscribedUsers.length / (trialUsers.length + subscribedUsers.length)) * 100 : 0;
    const freeToPaid = trialToSubscription; // Simplified
    // Plan upgrades (would need upgrade tracking)
    const planUpgrades = 0;
    const cancellationRate = users.length > 0 ? (canceledUsers.length / users.length) * 100 : 0;
    // Reactivation rate (would need reactivation tracking)
    const reactivationRate = 0;
    return {
        trialToSubscription: Math.round(trialToSubscription * 100) / 100,
        freeToPaid: Math.round(freeToPaid * 100) / 100,
        planUpgrades,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        reactivationRate
    };
}
// Helper function to calculate appointment metrics
async function calculateAppointmentMetrics(appointments, start, end) {
    const periodAppointments = appointments.filter(a => {
        const date = a.dateTime ? (a.dateTime.toDate ? a.dateTime.toDate() : new Date(a.dateTime)) : null;
        return date && date >= start && date <= end;
    });
    const totalBookings = periodAppointments.length;
    // Get unique users from appointments
    const uniqueUsers = new Set(periodAppointments.map(a => a.userId || 'unknown')).size;
    const averageBookingsPerUser = uniqueUsers > 0 ? totalBookings / uniqueUsers : 0;
    // Booking trends (daily)
    const bookingTrends = [];
    const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    for (let i = 0; i < days; i++) {
        const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
        const dayBookings = periodAppointments.filter(a => {
            const date = a.dateTime ? (a.dateTime.toDate ? a.dateTime.toDate() : new Date(a.dateTime)) : null;
            return date && date >= dayStart && date < dayEnd;
        }).length;
        bookingTrends.push({ date: day.toISOString().split('T')[0], count: dayBookings });
    }
    // Popular services
    const serviceCounts = {};
    periodAppointments.forEach(a => {
        const service = a.service || 'Unknown';
        serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    });
    const popularServices = Object.entries(serviceCounts)
        .map(([service, count]) => ({ service, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    // Time slot distribution
    const timeSlotDistribution = {
        '06-09': 0,
        '09-12': 0,
        '12-15': 0,
        '15-18': 0,
        '18-21': 0,
        '21-24': 0
    };
    periodAppointments.forEach(a => {
        const date = a.dateTime ? (a.dateTime.toDate ? a.dateTime.toDate() : new Date(a.dateTime)) : null;
        if (date) {
            const hour = date.getHours();
            if (hour >= 6 && hour < 9)
                timeSlotDistribution['06-09']++;
            else if (hour >= 9 && hour < 12)
                timeSlotDistribution['09-12']++;
            else if (hour >= 12 && hour < 15)
                timeSlotDistribution['12-15']++;
            else if (hour >= 15 && hour < 18)
                timeSlotDistribution['15-18']++;
            else if (hour >= 18 && hour < 21)
                timeSlotDistribution['18-21']++;
            else
                timeSlotDistribution['21-24']++;
        }
    });
    // No-show rate (simplified)
    const noShowAppointments = periodAppointments.filter(a => a.status === 'Problema').length;
    const noShowRate = totalBookings > 0 ? (noShowAppointments / totalBookings) * 100 : 0;
    return {
        totalBookings,
        averageBookingsPerUser: Math.round(averageBookingsPerUser * 100) / 100,
        bookingTrends,
        popularServices,
        timeSlotDistribution,
        noShowRate: Math.round(noShowRate * 100) / 100
    };
}
// Daily job to expire trials
exports.expireTrialsDaily = (0, scheduler_1.onSchedule)({ schedule: 'every 24 hours', timeZone: 'America/Sao_Paulo', region: 'us-central1' }, async () => {
    const db = admin.firestore();
    const now = new Date();
    // naive scan (optimize with collection group / index if large scale)
    const snap = await db.collection('users').get();
    const batch = db.batch();
    let writes = 0;
    for (const d of snap.docs) {
        const data = d.data();
        if (data.trialEndsAt) {
            const end = data.trialEndsAt.toDate ? data.trialEndsAt.toDate() : new Date(data.trialEndsAt);
            if (end < now && (data.plan === 'Trial')) {
                batch.update(d.ref, { plan: 'Profissional', subscriptionStatus: 'Inativo', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                writes++;
            }
        }
    }
    if (writes > 0)
        await batch.commit().catch(() => { });
});
// Scheduled job: notify users on the last day of their free trial
exports.notifyTrialsEndingToday = (0, scheduler_1.onSchedule)({ schedule: 'every 24 hours', timeZone: 'America/Sao_Paulo', region: 'us-central1' }, async () => {
    const db = admin.firestore();
    try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const usersSnap = await db.collection('users').get();
        for (const u of usersSnap.docs) {
            try {
                const data = u.data();
                if (!data?.trialEndsAt)
                    continue;
                const trialEnd = data.trialEndsAt.toDate ? data.trialEndsAt.toDate() : new Date(data.trialEndsAt);
                const trialEndStr = trialEnd.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                if (trialEndStr !== todayStr)
                    continue;
                // Avoid duplicate notifications for the same day
                if (data.trialLastDayNotified === todayStr)
                    continue;
                const email = data.email || null;
                const name = data.name || '';
                const subject = 'Seu período gratuito está terminando';
                const html = `<p>Olá ${name || ''},</p><p>Seu período gratuito está terminando hoje. Escolha um plano para continuar usando o app e não perder seus agendamentos.</p><p><a href="https://agendiia.com.br/account/subscription">Escolher um plano</a></p>`;
                // Send email if available (best-effort)
                if (email) {
                    try {
                        await sendEmailViaBrevo(email, name || email, subject, html);
                    }
                    catch (e) {
                        console.warn('notifyTrialsEndingToday: email send failed for', u.id, e);
                    }
                }
                // Record a notification entry under the user for UI consumption and tracking
                try {
                    await db.collection(`users/${u.id}/notifications`).add({
                        type: 'trial_ending',
                        message: `Seu teste gratuito termina hoje. Escolha seu plano para continuar usando o app.`,
                        channels: { email: !!email, whatsapp: false },
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        meta: { trialEndsAt: data.trialEndsAt }
                    });
                }
                catch (e) {
                    console.warn('notifyTrialsEndingToday: failed to write notification doc for', u.id, e);
                }
                // Mark user as notified today
                try {
                    await u.ref.set({ trialLastDayNotified: todayStr, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                }
                catch (e) {
                    console.warn('notifyTrialsEndingToday: failed to mark user notified', u.id, e);
                }
            }
            catch (inner) {
                console.warn('notifyTrialsEndingToday: processing user failed', u.id, inner);
            }
        }
    }
    catch (e) {
        console.error('notifyTrialsEndingToday error', e);
    }
});
// ============= RESOURCE MANAGEMENT FUNCTIONS =============
// Plan limits configuration
const PLAN_LIMITS = {
    'Trial': {
        planName: 'Trial',
        quotas: {
            storage: { limit: 100, used: 0, unlimited: false }, // 100MB
            bandwidth: { limit: 1, used: 0, unlimited: false }, // 1GB
            apiCalls: { limit: 1000, used: 0, unlimited: false },
            users: { limit: 50, used: 0, unlimited: false },
            appointments: { limit: 100, used: 0, unlimited: false }
        },
        features: ['basic_booking', 'email_notifications'],
        rateLimit: {
            requestsPerMinute: 30,
            requestsPerHour: 1000,
            requestsPerDay: 5000
        }
    },
    'Profissional': {
        planName: 'Profissional',
        quotas: {
            storage: { limit: 1000, used: 0, unlimited: false }, // 1GB
            bandwidth: { limit: 10, used: 0, unlimited: false }, // 10GB
            apiCalls: { limit: 10000, used: 0, unlimited: false },
            users: { limit: 500, used: 0, unlimited: false },
            appointments: { limit: 2000, used: 0, unlimited: false }
        },
        features: ['advanced_booking', 'analytics', 'automation', 'custom_branding'],
        rateLimit: {
            requestsPerMinute: 100,
            requestsPerHour: 5000,
            requestsPerDay: 50000
        }
    },
    'Enterprise': {
        planName: 'Enterprise',
        quotas: {
            storage: { limit: 0, used: 0, unlimited: true },
            bandwidth: { limit: 0, used: 0, unlimited: true },
            apiCalls: { limit: 0, used: 0, unlimited: true },
            users: { limit: 0, used: 0, unlimited: true },
            appointments: { limit: 0, used: 0, unlimited: true }
        },
        features: ['everything', 'priority_support', 'white_label', 'api_access'],
        rateLimit: {
            requestsPerMinute: 1000,
            requestsPerHour: 50000,
            requestsPerDay: 1000000
        }
    }
};
// Get resource usage for all users
exports.getResourceUsage = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    // Apply admin rate limiting
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'getResourceUsage', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    try {
        const usersSnapshot = await admin.firestore().collection('users').get();
        const resourceUsage = [];
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            // Calculate current usage
            const usage = await calculateUserResourceUsage(userId, userData);
            resourceUsage.push(usage);
        }
        return resourceUsage;
    }
    catch (error) {
        console.error('Error getting resource usage:', error);
        throw new https_1.HttpsError('internal', 'Failed to get resource usage');
    }
});
// Update user resource quotas
exports.updateUserQuotas = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    // Apply admin rate limiting
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'updateUserQuotas', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    const { userId, quotas } = data;
    if (!userId || !quotas) {
        throw new https_1.HttpsError('invalid-argument', 'Missing userId or quotas');
    }
    try {
        await admin.firestore().collection('users').doc(userId).update({
            customQuotas: quotas,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    }
    catch (error) {
        console.error('Error updating user quotas:', error);
        throw new https_1.HttpsError('internal', 'Failed to update quotas');
    }
});
// Get resource violations
exports.getResourceViolations = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await assertIsPlatformAdmin(auth.uid);
    try {
        const violationsSnapshot = await admin.firestore()
            .collection('resourceViolations')
            .where('resolved', '==', false)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        const violations = violationsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return violations;
    }
    catch (error) {
        console.error('Error getting resource violations:', error);
        throw new https_1.HttpsError('internal', 'Failed to get violations');
    }
});
// Monitor external service usage
exports.getExternalServiceUsage = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await assertIsPlatformAdmin(auth.uid);
    try {
        // Get Firebase usage (simplified - in production use Firebase billing APIs)
        const usersCount = (await admin.firestore().collection('users').count().get()).data().count;
        const appointmentsCount = (await admin.firestore().collectionGroup('appointments').count().get()).data().count;
        // Estimate costs based on usage
        const firebaseUsage = {
            reads: usersCount * 10, // Estimated reads per user
            writes: appointmentsCount * 2, // Estimated writes per appointment
            storage: usersCount * 0.5, // MB per user
            functions: appointmentsCount * 3, // Function calls per appointment
            cost: (usersCount * 0.01) + (appointmentsCount * 0.005) // Estimated cost
        };
        // Get Stripe usage (if configured)
        let stripeUsage = { transactions: 0, webhooks: 0, cost: 0 };
        try {
            const stripeConfig = await admin.firestore().doc('platform/stripe').get();
            if (stripeConfig.exists) {
                const transactionsCount = (await admin.firestore().collectionGroup('transactions').count().get()).data().count;
                stripeUsage = {
                    transactions: transactionsCount,
                    webhooks: transactionsCount * 2, // Estimated webhooks
                    cost: transactionsCount * 0.3 // Stripe fee estimate
                };
            }
        }
        catch (e) {
            console.log('Stripe config not found');
        }
        // Get email usage
        let brevoUsage = { emails: 0, cost: 0 };
        try {
            const emailsCount = usersCount * 5; // Estimated emails per user
            brevoUsage = {
                emails: emailsCount,
                cost: emailsCount * 0.001 // Estimated cost per email
            };
        }
        catch (e) {
            console.log('Email usage calculation failed');
        }
        const externalUsage = {
            firebase: firebaseUsage,
            stripe: stripeUsage,
            brevo: brevoUsage,
            mercadoPago: { transactions: 0, cost: 0 } // Placeholder
        };
        return externalUsage;
    }
    catch (error) {
        console.error('Error getting external service usage:', error);
        throw new https_1.HttpsError('internal', 'Failed to get external service usage');
    }
});
// Get cost alerts
exports.getCostAlerts = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await assertIsPlatformAdmin(auth.uid);
    try {
        const alertsSnapshot = await admin.firestore()
            .collection('costAlerts')
            .where('acknowledged', '==', false)
            .orderBy('createdAt', 'desc')
            .get();
        const alerts = alertsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return alerts;
    }
    catch (error) {
        console.error('Error getting cost alerts:', error);
        throw new https_1.HttpsError('internal', 'Failed to get cost alerts');
    }
});
// Create cost alert
exports.createCostAlert = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await assertIsPlatformAdmin(auth.uid);
    const { service, threshold, alertType } = data;
    if (!service || !threshold || !alertType) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    try {
        const alert = {
            service,
            threshold,
            currentAmount: 0,
            alertType,
            severity: 'Info',
            message: `Cost alert for ${service} with threshold $${threshold}`,
            createdAt: new Date(),
            acknowledged: false
        };
        const docRef = await admin.firestore().collection('costAlerts').add(alert);
        return { id: docRef.id, ...alert };
    }
    catch (error) {
        console.error('Error creating cost alert:', error);
        throw new https_1.HttpsError('internal', 'Failed to create cost alert');
    }
});
// Resource monitoring scheduled function
exports.monitorResources = (0, scheduler_1.onSchedule)('every 1 hours', async (event) => {
    try {
        console.log('Starting resource monitoring...');
        const usersSnapshot = await admin.firestore().collection('users').get();
        const violations = [];
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            // Check resource usage
            const usage = await calculateUserResourceUsage(userId, userData);
            // Check for violations
            const userViolations = checkResourceViolations(usage);
            violations.push(...userViolations);
            // Update user resource status
            await admin.firestore().collection('users').doc(userId).update({
                resourceStatus: usage.status,
                lastResourceCheck: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        // Save violations to Firestore
        const batch = admin.firestore().batch();
        violations.forEach(violation => {
            const docRef = admin.firestore().collection('resourceViolations').doc();
            batch.set(docRef, violation);
        });
        if (violations.length > 0) {
            await batch.commit();
            console.log(`Created ${violations.length} resource violations`);
        }
        // Generate resource monitoring report
        const monitoring = await generateResourceMonitoring();
        await admin.firestore().collection('resourceMonitoring').add(monitoring);
        console.log('Resource monitoring completed');
    }
    catch (error) {
        console.error('Error in resource monitoring:', error);
    }
});
// Helper function to calculate user resource usage
async function calculateUserResourceUsage(userId, userData) {
    const plan = userData.plan || 'Trial';
    const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS['Trial'];
    const customQuotas = userData.customQuotas;
    // Use custom quotas if available, otherwise use plan defaults
    const quotas = customQuotas || planLimits.quotas;
    // Calculate actual usage
    const storage = await calculateUserStorage(userId);
    const bandwidth = await calculateUserBandwidth(userId);
    const apiCalls = await calculateUserApiCalls(userId);
    const appointments = await calculateUserAppointments(userId);
    const currentUsage = {
        userId,
        userEmail: userData.email || 'unknown',
        plan,
        quotas: {
            storage: { ...quotas.storage, used: storage },
            bandwidth: { ...quotas.bandwidth, used: bandwidth },
            apiCalls: { ...quotas.apiCalls, used: apiCalls },
            users: { ...quotas.users, used: 1 }, // User themselves
            appointments: { ...quotas.appointments, used: appointments }
        },
        lastUpdated: new Date(),
        status: 'Normal',
        violations: []
    };
    // Determine status based on usage
    const overLimits = Object.entries(currentUsage.quotas).filter(([key, quota]) => {
        if (quota.unlimited)
            return false;
        return quota.used > quota.limit;
    });
    const nearLimits = Object.entries(currentUsage.quotas).filter(([key, quota]) => {
        if (quota.unlimited)
            return false;
        return quota.used > quota.limit * 0.8 && quota.used <= quota.limit;
    });
    if (overLimits.length > 0) {
        currentUsage.status = 'OverLimit';
    }
    else if (nearLimits.length > 0) {
        currentUsage.status = 'Warning';
    }
    return currentUsage;
}
// Helper functions for usage calculation
async function calculateUserStorage(userId) {
    // Simplified storage calculation
    try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        const appointmentsSnapshot = await admin.firestore()
            .collection('users').doc(userId)
            .collection('appointments').get();
        // Estimate storage based on document count and average size
        const docCount = 1 + appointmentsSnapshot.size;
        return docCount * 0.01; // 0.01MB per document estimate
    }
    catch (error) {
        return 0;
    }
}
async function calculateUserBandwidth(userId) {
    // Simplified bandwidth calculation
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Estimate based on recent activity (would need actual request logs)
        const appointmentsSnapshot = await admin.firestore()
            .collection('users').doc(userId)
            .collection('appointments')
            .where('createdAt', '>=', monthStart)
            .get();
        return appointmentsSnapshot.size * 0.001; // 1KB per request estimate
    }
    catch (error) {
        return 0;
    }
}
async function calculateUserApiCalls(userId) {
    // Simplified API calls calculation
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Estimate based on appointments and user activity
        const appointmentsSnapshot = await admin.firestore()
            .collection('users').doc(userId)
            .collection('appointments')
            .where('createdAt', '>=', monthStart)
            .get();
        return appointmentsSnapshot.size * 5; // 5 API calls per appointment estimate
    }
    catch (error) {
        return 0;
    }
}
async function calculateUserAppointments(userId) {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const appointmentsSnapshot = await admin.firestore()
            .collection('users').doc(userId)
            .collection('appointments')
            .where('createdAt', '>=', monthStart)
            .get();
        return appointmentsSnapshot.size;
    }
    catch (error) {
        return 0;
    }
}
// Check for resource violations
function checkResourceViolations(usage) {
    const violations = [];
    Object.entries(usage.quotas).forEach(([resourceType, quota]) => {
        if (quota.unlimited)
            return;
        if (quota.used > quota.limit) {
            violations.push({
                userId: usage.userId,
                type: resourceType,
                severity: 'High',
                message: `${resourceType} usage (${quota.used}) exceeds limit (${quota.limit})`,
                timestamp: new Date(),
                resolved: false,
                action: 'throttle'
            });
        }
        else if (quota.used > quota.limit * 0.9) {
            violations.push({
                userId: usage.userId,
                type: resourceType,
                severity: 'Medium',
                message: `${resourceType} usage (${quota.used}) is near limit (${quota.limit})`,
                timestamp: new Date(),
                resolved: false,
                action: 'notify'
            });
        }
    });
    return violations;
}
// Generate resource monitoring report
async function generateResourceMonitoring() {
    const usersSnapshot = await admin.firestore().collection('users').get();
    const activeUsers = usersSnapshot.docs.filter(doc => {
        const data = doc.data();
        const lastLogin = data.lastLogin ? (data.lastLogin.toDate ? data.lastLogin.toDate() : new Date(data.lastLogin)) : null;
        if (!lastLogin)
            return false;
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return lastLogin > dayAgo;
    }).length;
    // Calculate totals
    let totalStorage = 0;
    let totalBandwidth = 0;
    let totalApiCalls = 0;
    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        totalStorage += await calculateUserStorage(userId);
        totalBandwidth += await calculateUserBandwidth(userId);
        totalApiCalls += await calculateUserApiCalls(userId);
    }
    // Get external service usage
    const externalUsage = {
        firebase: {
            reads: totalApiCalls * 2,
            writes: totalApiCalls,
            storage: totalStorage,
            functions: totalApiCalls * 0.5,
            cost: totalStorage * 0.026 + totalApiCalls * 0.0006
        },
        stripe: { transactions: 0, webhooks: 0, cost: 0 },
        brevo: { emails: usersSnapshot.size * 5, cost: usersSnapshot.size * 0.005 },
        mercadoPago: { transactions: 0, cost: 0 }
    };
    const costBreakdown = {
        firebase: externalUsage.firebase.cost,
        stripe: externalUsage.stripe.cost,
        brevo: externalUsage.brevo.cost,
        mercadoPago: externalUsage.mercadoPago.cost
    };
    const totalCost = Object.values(costBreakdown).reduce((sum, cost) => sum + cost, 0);
    return {
        timestamp: new Date(),
        totalUsers: usersSnapshot.size,
        activeUsers,
        totalStorage,
        totalBandwidth,
        totalApiCalls,
        externalServices: externalUsage,
        costBreakdown,
        projectedMonthlyCost: totalCost * 30 // Daily cost * 30
    };
}
// Get rate limiting statistics
exports.getRateLimitStats = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'getRateLimitStats', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    try {
        const stats = {
            userRateLimiter: rateLimiter_1.userRateLimiter.getStats(),
            adminRateLimiter: rateLimiter_1.adminRateLimiter.getStats(),
            globalRateLimiter: require('./rateLimiter').globalRateLimiter.getStats()
        };
        return stats;
    }
    catch (error) {
        console.error('Error getting rate limit stats:', error);
        throw new https_1.HttpsError('internal', 'Failed to get rate limit statistics');
    }
});
// ============= CONTENT MANAGEMENT FUNCTIONS =============
// Email Templates Management
exports.getEmailTemplates = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'getEmailTemplates', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    try {
        const templatesSnapshot = await admin.firestore()
            .collection('emailTemplates')
            .orderBy('createdAt', 'desc')
            .get();
        const templates = templatesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return templates;
    }
    catch (error) {
        console.error('Error getting email templates:', error);
        throw new https_1.HttpsError('internal', 'Failed to get email templates');
    }
});
exports.createEmailTemplate = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'createEmailTemplate', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    const { name, subject, content, type, category, variables } = data;
    if (!name || !subject || !content || !type) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    try {
        // Generate HTML content from markdown or rich text
        const htmlContent = content; // In production, you'd use a markdown parser
        const template = {
            name,
            subject,
            content,
            htmlContent,
            type,
            variables: variables || [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: auth.uid,
            category: category || 'general'
        };
        const docRef = await admin.firestore().collection('emailTemplates').add(template);
        return { id: docRef.id, ...template };
    }
    catch (error) {
        console.error('Error creating email template:', error);
        throw new https_1.HttpsError('internal', 'Failed to create email template');
    }
});
exports.updateEmailTemplate = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'updateEmailTemplate', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    const { templateId, updates } = data;
    if (!templateId || !updates) {
        throw new https_1.HttpsError('invalid-argument', 'Missing templateId or updates');
    }
    try {
        const updateData = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await admin.firestore()
            .collection('emailTemplates')
            .doc(templateId)
            .update(updateData);
        return { success: true };
    }
    catch (error) {
        console.error('Error updating email template:', error);
        throw new https_1.HttpsError('internal', 'Failed to update email template');
    }
});
// Landing Pages Management
exports.getLandingPages = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'getLandingPages', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    try {
        const pagesSnapshot = await admin.firestore()
            .collection('landingPages')
            .orderBy('createdAt', 'desc')
            .get();
        const pages = pagesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return pages;
    }
    catch (error) {
        console.error('Error getting landing pages:', error);
        throw new https_1.HttpsError('internal', 'Failed to get landing pages');
    }
});
exports.createLandingPage = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'createLandingPage', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    const { title, slug, content, metaTitle, metaDescription, keywords, sections } = data;
    if (!title || !slug || !content) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    try {
        // Check if slug already exists
        const existingPage = await admin.firestore()
            .collection('landingPages')
            .where('slug', '==', slug)
            .get();
        if (!existingPage.empty) {
            throw new https_1.HttpsError('already-exists', 'Slug already exists');
        }
        const htmlContent = content; // In production, you'd use a markdown parser
        const page = {
            title,
            slug,
            content,
            htmlContent,
            metaTitle: metaTitle || title,
            metaDescription: metaDescription || '',
            keywords: keywords || [],
            isPublished: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: auth.uid,
            sections: sections || [],
            seoScore: 0, // Would be calculated based on content analysis
            analytics: {
                views: 0,
                conversions: 0,
                bounceRate: 0
            }
        };
        const docRef = await admin.firestore().collection('landingPages').add(page);
        return { id: docRef.id, ...page };
    }
    catch (error) {
        console.error('Error creating landing page:', error);
        throw new https_1.HttpsError('internal', 'Failed to create landing page');
    }
});
exports.publishLandingPage = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'publishLandingPage', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    const { pageId, isPublished } = data;
    if (!pageId || typeof isPublished !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'Missing pageId or isPublished');
    }
    try {
        const updateData = {
            isPublished,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (isPublished) {
            updateData.publishedAt = admin.firestore.FieldValue.serverTimestamp();
        }
        await admin.firestore()
            .collection('landingPages')
            .doc(pageId)
            .update(updateData);
        return { success: true };
    }
    catch (error) {
        console.error('Error publishing landing page:', error);
        throw new https_1.HttpsError('internal', 'Failed to publish landing page');
    }
});
// Wiki Management
exports.getWikiPages = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'getWikiPages', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    try {
        const pagesSnapshot = await admin.firestore()
            .collection('wikiPages')
            .orderBy('createdAt', 'desc')
            .get();
        const pages = pagesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return pages;
    }
    catch (error) {
        console.error('Error getting wiki pages:', error);
        throw new https_1.HttpsError('internal', 'Failed to get wiki pages');
    }
});
exports.createWikiPage = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'createWikiPage', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    const { title, content, category, tags, parentId } = data;
    if (!title || !content || !category) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    try {
        const htmlContent = content; // In production, you'd use a markdown parser
        const page = {
            title,
            content,
            htmlContent,
            category,
            tags: tags || [],
            isPublished: false,
            version: 1,
            parentId: parentId || undefined,
            children: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: auth.uid,
            lastEditedBy: auth.uid,
            viewCount: 0,
            searchTerms: title.toLowerCase().split(' ').concat(tags || [])
        };
        const docRef = await admin.firestore().collection('wikiPages').add(page);
        // Update parent page's children array if parentId exists
        if (parentId) {
            await admin.firestore()
                .collection('wikiPages')
                .doc(parentId)
                .update({
                children: admin.firestore.FieldValue.arrayUnion(docRef.id)
            });
        }
        return { id: docRef.id, ...page };
    }
    catch (error) {
        console.error('Error creating wiki page:', error);
        throw new https_1.HttpsError('internal', 'Failed to create wiki page');
    }
});
// Announcements Management
exports.getAnnouncements = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'getAnnouncements', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    try {
        const announcementsSnapshot = await admin.firestore()
            .collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();
        const announcements = announcementsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return announcements;
    }
    catch (error) {
        console.error('Error getting announcements:', error);
        throw new https_1.HttpsError('internal', 'Failed to get announcements');
    }
});
exports.createAnnouncement = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'createAnnouncement', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    const { title, content, type, priority, targetAudience, targetUserIds, targetPlans, startDate, endDate, isDismissible, showOnDashboard, showAsPopup } = data;
    if (!title || !content || !type || !priority || !targetAudience || !startDate) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    try {
        const htmlContent = content; // In production, you'd use a markdown parser
        const announcement = {
            title,
            content,
            htmlContent,
            type,
            priority,
            targetAudience,
            targetUserIds: targetUserIds || undefined,
            targetPlans: targetPlans || undefined,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
            isActive: true,
            isDismissible: isDismissible !== false,
            showOnDashboard: showOnDashboard !== false,
            showAsPopup: showAsPopup === true,
            createdAt: new Date(),
            createdBy: auth.uid,
            viewCount: 0,
            dismissedBy: []
        };
        const docRef = await admin.firestore().collection('announcements').add(announcement);
        return { id: docRef.id, ...announcement };
    }
    catch (error) {
        console.error('Error creating announcement:', error);
        throw new https_1.HttpsError('internal', 'Failed to create announcement');
    }
});
// Get active announcements for users
exports.getActiveAnnouncements = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'getActiveAnnouncements', rateLimiter_1.userRateLimiter);
    try {
        const now = new Date();
        // Get user data to check plan
        const userDoc = await admin.firestore().collection('users').doc(auth.uid).get();
        const userData = userDoc.data();
        const userPlan = userData?.plan || 'Trial';
        const isAdmin = userData?.role === 'admin';
        const announcementsSnapshot = await admin.firestore()
            .collection('announcements')
            .where('isActive', '==', true)
            .where('startDate', '<=', now)
            .get();
        const announcements = announcementsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(announcement => {
            // Check if announcement has expired
            if (announcement.endDate && announcement.endDate < now) {
                return false;
            }
            // Check target audience
            if (announcement.targetAudience === 'all') {
                return true;
            }
            else if (announcement.targetAudience === 'admins' && isAdmin) {
                return true;
            }
            else if (announcement.targetAudience === 'users' && !isAdmin) {
                return true;
            }
            else if (announcement.targetAudience === 'specific') {
                // Check if user is in target list or has target plan
                const inTargetUsers = announcement.targetUserIds?.includes(auth.uid);
                const hasTargetPlan = announcement.targetPlans?.includes(userPlan);
                return inTargetUsers || hasTargetPlan;
            }
            return false;
        })
            .filter(announcement => {
            // Filter out dismissed announcements if they are dismissible
            if (announcement.isDismissible && announcement.dismissedBy.includes(auth.uid)) {
                return false;
            }
            return true;
        });
        return announcements;
    }
    catch (error) {
        console.error('Error getting active announcements:', error);
        throw new https_1.HttpsError('internal', 'Failed to get active announcements');
    }
});
// Dismiss announcement
exports.dismissAnnouncement = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'dismissAnnouncement', rateLimiter_1.userRateLimiter);
    const { announcementId } = data;
    if (!announcementId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing announcementId');
    }
    try {
        await admin.firestore()
            .collection('announcements')
            .doc(announcementId)
            .update({
            dismissedBy: admin.firestore.FieldValue.arrayUnion(auth.uid)
        });
        return { success: true };
    }
    catch (error) {
        console.error('Error dismissing announcement:', error);
        throw new https_1.HttpsError('internal', 'Failed to dismiss announcement');
    }
});
// Content Analytics
exports.getContentAnalytics = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    await (0, rateLimiter_1.applyRateLimit)(auth.uid, 'getContentAnalytics', rateLimiter_1.adminRateLimiter);
    await assertIsPlatformAdmin(auth.uid);
    try {
        // Get email templates stats
        const templatesSnapshot = await admin.firestore().collection('emailTemplates').get();
        const templates = templatesSnapshot.docs.map(doc => doc.data());
        // Get landing pages stats
        const pagesSnapshot = await admin.firestore().collection('landingPages').get();
        const pages = pagesSnapshot.docs.map(doc => doc.data());
        // Get wiki pages stats
        const wikiSnapshot = await admin.firestore().collection('wikiPages').get();
        const wikiPages = wikiSnapshot.docs.map(doc => doc.data());
        // Get announcements stats
        const announcementsSnapshot = await admin.firestore().collection('announcements').get();
        const announcements = announcementsSnapshot.docs.map(doc => doc.data());
        const analytics = {
            emailTemplates: {
                totalTemplates: templates.length,
                activeTemplates: templates.filter((t) => t.isActive).length,
                topPerforming: [], // Would be populated with actual email performance data
                categoryStats: templates.reduce((acc, t) => {
                    acc[t.category] = (acc[t.category] || 0) + 1;
                    return acc;
                }, {})
            },
            landingPages: {
                totalPages: pages.length,
                publishedPages: pages.filter(p => p.isPublished).length,
                totalViews: pages.reduce((sum, p) => sum + (p.analytics?.views || 0), 0),
                totalConversions: pages.reduce((sum, p) => sum + (p.analytics?.conversions || 0), 0),
                averageBounceRate: pages.length > 0
                    ? pages.reduce((sum, p) => sum + (p.analytics?.bounceRate || 0), 0) / pages.length
                    : 0,
                topPerforming: pages
                    .filter(p => p.analytics)
                    .sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0))
                    .slice(0, 5)
                    .map(p => ({
                    id: p.id,
                    title: p.title,
                    views: p.analytics?.views || 0,
                    conversions: p.analytics?.conversions || 0
                }))
            },
            wiki: {
                totalPages: wikiPages.length,
                publishedPages: wikiPages.filter(p => p.isPublished).length,
                totalViews: wikiPages.reduce((sum, p) => sum + p.viewCount, 0),
                topViewed: wikiPages
                    .sort((a, b) => b.viewCount - a.viewCount)
                    .slice(0, 5)
                    .map(p => ({
                    id: p.id,
                    title: p.title,
                    views: p.viewCount
                })),
                categoryStats: wikiPages.reduce((acc, p) => {
                    acc[p.category] = (acc[p.category] || 0) + 1;
                    return acc;
                }, {})
            },
            announcements: {
                totalAnnouncements: announcements.length,
                activeAnnouncements: announcements.filter(a => a.isActive).length,
                totalViews: announcements.reduce((sum, a) => sum + a.viewCount, 0),
                averageDismissalRate: announcements.length > 0
                    ? announcements.reduce((sum, a) => sum + (a.dismissedBy?.length || 0), 0) / announcements.length
                    : 0,
                typeStats: announcements.reduce((acc, a) => {
                    acc[a.type] = (acc[a.type] || 0) + 1;
                    return acc;
                }, {})
            }
        };
        return analytics;
    }
    catch (error) {
        console.error('Error getting content analytics:', error);
        throw new https_1.HttpsError('internal', 'Failed to get content analytics');
    }
});
