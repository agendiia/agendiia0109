import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { 
  PlatformMetrics, 
  ResourceUsage, 
  ResourceViolation, 
  ExternalServiceUsage, 
  CostAlert, 
  ResourceMonitoring,
  PlanLimits,
  EmailTemplate,
  LandingPage,
  WikiPage,
  Announcement
} from './types';
import { userRateLimiter, adminRateLimiter, applyRateLimit, checkPlanLimits } from './rateLimiter';
import { Billing } from '@google-cloud/billing';

admin.initializeApp();

// Small server-side email sender using Brevo settings in Firestore
async function sendEmailViaBrevo(toEmail: string, toName: string, subject: string, html: string) {
  if (!toEmail) throw new HttpsError('invalid-argument', 'Destino sem e-mail');
  const cfgSnap = await admin.firestore().doc('platform/brevo').get();
  const cfg = cfgSnap.exists ? (cfgSnap.data() as any) : null;
  const apiKey = cfg?.apiKey;
  const senderEmail = cfg?.senderEmail || 'no-reply@agendiia.app';
  const senderName = cfg?.senderName || 'Agendiia';
  if (!apiKey) throw new HttpsError('failed-precondition', 'Brevo não configurado.');
  const body = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    htmlContent: html,
  } as any;
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new HttpsError('internal', `Erro Brevo: ${resp.status} - ${t}`);
  }
  const json: any = await resp.json();
  return json?.messageId || (Array.isArray(json?.messageIds) ? json.messageIds[0] : null);
}

function formatDateTimePtBR(d: Date) {
  try { return d.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }); }
  catch { return d.toISOString(); }
}

function applyTemplate(template: string, vars: Record<string,string>) {
  console.log('applyTemplate - Template original:', template);
  console.log('applyTemplate - Variáveis disponíveis:', vars);
  let out = template;
  for (const k of Object.keys(vars)) {
    // Usar regex para fazer a substituição global e case-insensitive
    const token = `{${k}}`;
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedToken, 'g');
    const replacement = vars[k] ?? '';
    console.log(`applyTemplate - Substituindo ${token} por "${replacement}"`);
    out = out.replace(regex, replacement);
  }
  console.log('applyTemplate - Resultado final:', out);
  return out;
}

// Callable to create a Mercado Pago preference securely on the server
export const createMercadoPagoPreference = onCall({ 
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
  const { professionalId, item, payer, back_urls, statement_descriptor, metadata } = (request?.data || {}) as any;
  if (!professionalId) {
    throw new HttpsError('invalid-argument', 'professionalId é obrigatório');
  }

  try {
    // Load professional's Mercado Pago access token from Firestore
    const gwDoc = await admin.firestore().doc(`users/${professionalId}/gateways/mercadopago`).get();
    const gw = gwDoc.data() as any;
    const accessToken = gw?.config?.accessToken;
    if (!accessToken) {
      throw new HttpsError('failed-precondition', 'Mercado Pago não configurado.');
    }

    const body: any = {
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
      throw new HttpsError('internal', `Erro MP: ${resp.status} - ${t}`);
    }
  const json: any = await resp.json();
  // Persist Mercado Pago preference id to the reservation when metadata.reservationId is present
  try {
    const prefId = json.id;
    const reservationId = metadata?.reservationId;
      const appointmentId = metadata?.appointmentId;
    if (prefId && reservationId) {
      try {
        await admin.firestore().doc(`users/${professionalId}/reservations/${reservationId}`).update({ mpPreferenceId: prefId });
      } catch (e) {
        // Non-fatal: log and continue
        console.warn('Failed to persist mpPreferenceId on reservation', reservationId, e);
      }
    }
      // Persist preference id to appointment when appointmentId provided (two-step flow)
      if (prefId && appointmentId) {
        try {
          await admin.firestore().doc(`users/${professionalId}/appointments/${appointmentId}`).update({ mpPreferenceId: prefId });
        } catch (e) {
          console.warn('Failed to persist mpPreferenceId on appointment', appointmentId, e);
        }
      }
  } catch (e) {
    console.warn('Error while attempting to persist MercadoPago preference id', e);
  }

  return { init_point: json.init_point, sandbox_init_point: json.sandbox_init_point, id: json.id };
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao criar preferência');
  }
});

// Callable to send transactional email via Brevo (Sendinblue)
export const sendBrevoEmail = onCall({ region: 'us-central1' }, async (request) => {
  const { toEmail, toName, subject, html } = (request?.data || {}) as any;
  if (!toEmail || !subject || !html) {
    throw new HttpsError('invalid-argument', 'Parâmetros obrigatórios ausentes.');
  }
  try {
    const messageId = await sendEmailViaBrevo(toEmail, toName || toEmail, subject, html);
    return { messageId: messageId || null };
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao enviar e-mail');
  }
});

// Firestore trigger: send confirmation email when a new appointment is created
export const onAppointmentCreated = onDocumentCreated('users/{userId}/appointments/{appointmentId}', async (event) => {
  const { userId, appointmentId } = event.params;
  console.log(`[onAppointmentCreated] Triggered for appointmentId: ${appointmentId} under userId: ${userId}`);

  try {
    const snap = event.data;
    if (!snap || !snap.exists) {
      console.log('[onAppointmentCreated] no data, exiting');
      return;
    }
    const data = snap.data() as any;

    // ANTI-LOOP: Check if confirmation emails were already sent
    if (data.confirmationEmailStatus === 'sent' && data.professionalNotificationStatus === 'sent') {
      console.log(`[onAppointmentCreated] LOOP PREVENTION: Both confirmation emails already sent, skipping.`);
      return;
    }

    const clientEmail: string | undefined = data.clientEmail || data.email;
    const clientName: string = data.clientName || 'Cliente';
    const serviceName: string = data.service || 'Atendimento';
    const dt: Date = data.dateTime?.toDate ? data.dateTime.toDate() : new Date(data.dateTime);

    // Resolve professional name and email with fallbacks
    const db = admin.firestore();
    const profileSnap = await db.doc(`users/${userId}/profile/main`).get().catch(() => null);
    let professionalName = profileSnap && profileSnap.exists ? (profileSnap.data() as any)?.name : undefined;
    let profEmail = profileSnap && profileSnap.exists ? (profileSnap.data() as any)?.email : undefined;
    if (!professionalName || !profEmail) {
      const userDoc = await db.doc(`users/${userId}`).get().catch(() => null);
      if (userDoc && userDoc.exists) {
        const ud = userDoc.data() as any;
        professionalName = professionalName || ud?.name;
        profEmail = profEmail || ud?.email;
      }
    }
    if (!professionalName || !profEmail) {
      try {
        const authRec = await admin.auth().getUser(userId);
        professionalName = professionalName || authRec.displayName || authRec.email;
        profEmail = profEmail || authRec.email || undefined;
      } catch {}
    }
    professionalName = professionalName || 'Profissional';

    // Load templates
    const autoSnap = await db.doc('platform/automations').get().catch(() => null);
    let clientSubject = 'Seu agendamento foi confirmado!';
    let clientBody = 'Olá {clientName}, seu agendamento para {serviceName} em {dateTime} foi realizado com sucesso!';
    let profSubject = `Novo agendamento: {serviceName}`;
    let profBodyTemplate = `Olá {professionalName},\n\nVocê recebeu um novo agendamento.\nCliente: {clientName}\nServiço: {serviceName}\nData: {appointmentDate} - {appointmentTime}`;
    if (autoSnap && autoSnap.exists) {
      const au: any = autoSnap.data();
      const tClient = Array.isArray(au.templates) ? au.templates.find((t: any) => t.id === 't_sched') : null;
      const tProf = Array.isArray(au.templates) ? au.templates.find((t: any) => t.id === 't_sched_professional') : null;
      if (tClient?.subject) clientSubject = tClient.subject;
      if (tClient?.body) clientBody = tClient.body;
      if (tProf?.subject) profSubject = tProf.subject;
      if (tProf?.body) profBodyTemplate = tProf.body;
    }

    const vars: any = {
      clientName,
      professionalName,
      serviceName,
      appointmentDate: dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      appointmentTime: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      dateTime: formatDateTimePtBR(dt),
    };

    // Send email to client if available
    if (clientEmail) {
      try {
        const html = applyTemplate(clientBody, vars);
        const subj = applyTemplate(clientSubject, vars);
        const msgId = await sendEmailViaBrevo(clientEmail, clientName, subj, html);
        await snap.ref.set({ confirmationEmailStatus: 'sent', confirmationEmailId: msgId || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } catch (err: any) {
        console.warn('onAppointmentCreated: failed to send confirmation email to client', err);
        try { await snap.ref.set({ confirmationEmailStatus: 'error', confirmationEmailError: err?.message || String(err), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch {}
      }
    } else {
      try { await snap.ref.set({ confirmationEmailStatus: 'skipped_no_client_email', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch {}
    }

    // Notify professional (best-effort)
    if (profEmail) {
      try {
        const profHtml = applyTemplate(profBodyTemplate, vars);
        const profSubj = applyTemplate(profSubject, vars);
        const pMsgId = await sendEmailViaBrevo(profEmail, professionalName, profSubj, profHtml);
        try { await snap.ref.set({ professionalNotificationStatus: 'sent', professionalNotificationId: pMsgId || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch {}
      } catch (err: any) {
        console.warn('onAppointmentCreated: failed to notify professional', err);
        try { await snap.ref.set({ professionalNotificationStatus: 'error', professionalNotificationError: err?.message || String(err), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch {}
      }
    } else {
      try { await snap.ref.set({ professionalNotificationStatus: 'skipped_no_professional_email', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch {}
    }

  } catch (e) {
    console.error('[onAppointmentCreated] top-level error', e);
  }
});

export const onAppointmentUpdated = onDocumentUpdated('users/{userId}/appointments/{appointmentId}', async (event) => {
  const { userId, appointmentId } = event.params;
  console.log(`[onAppointmentUpdated] Triggered for appointmentId: ${appointmentId} under userId: ${userId}`);

  try {
    const snap = event.data?.after;
    if (!snap || !snap.exists) {
      console.log(`[onAppointmentUpdated] No data found for event or document deleted. Exiting.`);
      return;
    }
    const data = snap.data() as any;
    console.log(`[onAppointmentUpdated] Appointment data:`, JSON.stringify(data, null, 2));

    // ANTI-LOOP: Check if this update was caused by our own email status updates
    const before = event.data?.before?.data() as any;
    const hasNewEmailStatus = data.updateEmailStatus && (!before || before.updateEmailStatus !== data.updateEmailStatus);
    const hasNewProfNotificationStatus = data.professionalNotificationStatus && (!before || before.professionalNotificationStatus !== data.professionalNotificationStatus);
    
    if (hasNewEmailStatus || hasNewProfNotificationStatus) {
      console.log(`[onAppointmentUpdated] LOOP PREVENTION: Skipping execution because this update was triggered by email status change.`);
      return;
    }

    // Additional check: if both emails were already sent, skip
    if (data.updateEmailStatus === 'sent' && data.professionalNotificationStatus === 'sent') {
      console.log(`[onAppointmentUpdated] LOOP PREVENTION: Both emails already sent, skipping.`);
      return;
    }

    const clientEmail: string | undefined = data.clientEmail || data.email;
    const clientName: string = data.clientName || 'Cliente';
    console.log(`[onAppointmentUpdated] Extracted clientEmail: "${clientEmail}" and clientName: "${clientName}"`);

    // Prossegue mesmo sem email do cliente para tentar notificar o profissional
    const serviceName: string = data.service || 'Atendimento';
    const dt: Date = data.dateTime?.toDate ? data.dateTime.toDate() : new Date(data.dateTime);
    
    // Get professional name from profile, with sensible fallbacks (users/{userId} doc, then Auth)
    const userProfileSnap = await admin.firestore().doc(`users/${userId}/profile/main`).get();
    let professionalName: string | undefined = userProfileSnap.exists ? (userProfileSnap.data() as any)?.name : undefined;
    if (!professionalName) {
      // Try top-level users/{userId} doc
      try {
        const userDoc = await admin.firestore().doc(`users/${userId}`).get();
        professionalName = userDoc && userDoc.exists ? (userDoc.data() as any)?.name : undefined;
      } catch (e) {
        console.warn('onAppointmentUpdated - failed to read users/{userId} for professional name fallback', e);
      }
    }
    if (!professionalName) {
      // Try Firebase Auth displayName or email
      try {
        const authRec = await admin.auth().getUser(userId);
        professionalName = authRec.displayName || authRec.email || undefined;
      } catch (e) {
        // ignore
      }
    }
    professionalName = professionalName || 'Profissional';
    // Load template
    const autoSnap = await admin.firestore().doc('platform/automations').get();
    const defaults = {
      subject: 'Seu agendamento foi atualizado!',
      body: 'Olá {clientName}, seu agendamento para {serviceName} em {dateTime} foi atualizado com sucesso!',
    };
    let subject = defaults.subject;
    let body = defaults.body;
    if (autoSnap.exists) {
      const au: any = autoSnap.data();
      const tmpl = Array.isArray(au.templates) ? au.templates.find((t: any) => t.id === 't_sched') : null;
      if (tmpl?.subject) subject = tmpl.subject;
      if (tmpl?.body) body = tmpl.body;
    }
    const vars = {
      clientName,
      professionalName,
      serviceName,
      appointmentDate: dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      appointmentTime: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      // Compatibilidade com formato antigo
      dateTime: formatDateTimePtBR(dt),
      time: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    };

  // Backwards compatibility: also expose Portuguese variable names (some templates stored using these)
  (vars as any)['nome do cliente'] = clientName;
  (vars as any)['nome do profissional'] = professionalName;
  (vars as any)['nome do serviço'] = serviceName;
  (vars as any)['data'] = dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  (vars as any)['horário'] = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    if (clientEmail) {
      console.log(`[onAppointmentUpdated] Client email found. Preparing to send update notification to ${clientEmail}.`);
      const html = applyTemplate(body, vars);
      const subj = applyTemplate(subject, vars);
      const msgId = await sendEmailViaBrevo(clientEmail, clientName, subj, html);
      console.log(`[onAppointmentUpdated] Email sent to client. Message ID: ${msgId}`);
  // email do cliente enviado
      await snap.ref.update({ updateEmailStatus: 'sent', updateEmailId: msgId || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      console.log(`[onAppointmentUpdated] Client email not found. Skipping email to client.`);
      await snap.ref.update({ updateEmailStatus: 'skipped_no_client_email', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    // Also notify the professional via email (try multiple fallbacks for email)
    try {
      const profProfile = userProfileSnap; // já buscado antes
      let profEmail: string | undefined = profProfile.exists ? (profProfile.data() as any)?.email : undefined;
      // fallback 1: users/{userId} top-level doc
      if (!profEmail) {
        try {
          const userDoc = await admin.firestore().doc(`users/${userId}`).get();
          if (userDoc && userDoc.exists) {
      const tmp = (userDoc.data() as any)?.email;            
      profEmail = tmp || profEmail;
          }
        } catch (e) {
          console.warn('onAppointmentUpdated - falha ao ler users/{userId} para fallback de email', e);
        }
      }
      // fallback 2: Firebase Auth
      if (!profEmail) {
        try {
          const authRec = await admin.auth().getUser(userId);
          profEmail = authRec?.email || profEmail;
        } catch (e) {
          console.warn('onAppointmentUpdated - falha ao obter auth record para fallback de email', e);
        }
      }
      // fallback 3 (último recurso): se ainda não houver email, não envia
      if (profEmail) {
        // Carregar template específico para profissional
        const autoData: any = autoSnap.exists ? autoSnap.data() : null;
        const profTmpl = autoData && Array.isArray(autoData.templates) ? autoData.templates.find((t: any) => t.id === 't_sched_professional') : null;
        const profSubject = applyTemplate(profTmpl?.subject || `Novo agendamento: {serviceName}`, vars as Record<string,string>);
        const profBodyTemplate = profTmpl?.body || `<div>Olá {professionalName},<br/><br/>Seu agendamento foi atualizado.<br/><br/>Cliente: {clientName}<br/>Serviço: {serviceName}<br/>Data: {appointmentDate}<br/>Horário: {appointmentTime}<br/><br/>Atenciosamente,<br/>{professionalName}</div>`;
        // Garantir que variáveis críticas existam
        if (!(vars as any).appointmentDate) (vars as any).appointmentDate = dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        if (!(vars as any).appointmentTime) (vars as any).appointmentTime = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        if (!(vars as any).professionalName) (vars as any).professionalName = professionalName;
        const profHtml = applyTemplate(profBodyTemplate, vars as Record<string,string>);
        const pMsgId = await sendEmailViaBrevo(profEmail, professionalName, profSubject, profHtml);
    // email profissional enviado
        try {
          await snap.ref.set({ professionalNotificationStatus: 'sent', professionalNotificationId: pMsgId || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (w) {
          console.warn('onAppointmentUpdated - falha ao registrar status do email do profissional', w);
        }
      } else {
        try {
          await snap.ref.set({ professionalNotificationStatus: 'skipped_no_professional_email', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch {}
      }
    } catch (e) {
      console.warn('Failed to notify professional by email', e);
      try {
        await snap.ref.set({ professionalNotificationStatus: 'error', professionalNotificationError: (e as any)?.message || String(e), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } catch {}
    }
  } catch (e) {
    console.error(`[onAppointmentUpdated] Top-level error for appointmentId: ${appointmentId}`, e);
  }
});

// Scheduled reminder ~24h before: runs hourly, sends for items within 23.5h-24.5h from now and not yet reminded
export const sendDailyReminders = onSchedule({ schedule: 'every 60 minutes', timeZone: 'America/Sao_Paulo', region: 'us-central1' }, async (event) => {
  const now = new Date();
  const in23_5h = new Date(now.getTime() + 23.5 * 3600 * 1000);
  const in24_5h = new Date(now.getTime() + 24.5 * 3600 * 1000);
  
  const db = admin.firestore();
  const tsStart = admin.firestore.Timestamp.fromDate(in23_5h);
  const tsEnd = admin.firestore.Timestamp.fromDate(in24_5h);
  console.log(`[${event.jobName}] V4 START: Range: ${tsStart.toDate().toISOString()} to ${tsEnd.toDate().toISOString()}`);

  let appointmentDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  // TEMPORARY: Use only fallback until indices are built
  console.log(`[${event.jobName}] V4 USING_FALLBACK_ONLY: CollectionGroup disabled temporarily.`);
  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`[${event.jobName}] V4 FALLBACK_INFO: Scanning ${usersSnapshot.size} users.`);
    
    const promises = usersSnapshot.docs.map(userDoc => 
      db.collection(`users/${userDoc.id}/appointments`)
        .where('dateTime', '>=', tsStart)
        .where('dateTime', '<=', tsEnd)
        .get()
        .then(userAppointments => {
          if (!userAppointments.empty) {
            console.log(`[${event.jobName}] V4 FALLBACK_USER_SUCCESS: Found ${userAppointments.size} for user ${userDoc.id}`);
            return userAppointments.docs;
          }
          return [];
        })
        .catch(userErr => {
          console.warn(`[${event.jobName}] V4 CATCH_FALLBACK_USER: Failed for user ${userDoc.id}`, userErr);
          return [];
        })
    );
    
    const results = await Promise.all(promises);
    appointmentDocs = results.flat();
    console.log(`[${event.jobName}] V4 SUCCESS_FALLBACK: Fallback scan finished. Total appointments: ${appointmentDocs.length}`);
  } catch (fallbackErr) {
    console.error(`[${event.jobName}] V4 CATCH_FALLBACK: The entire fallback scan failed.`, fallbackErr);
    return; 
  }

  if (appointmentDocs.length === 0) {
    console.log(`[${event.jobName}] V4 END: No appointments found. Job finished.`);
    return;
  }

  let processedCount = 0;
  
  // Aggregated skip counters for diagnostics
  const skipCounters: Record<string, number> = {
    alreadySent: 0,
    statusNotAgendado: 0,
    missingEmail: 0,
    invalidDate: 0,
    ok: 0,
  };

  for (const docSnap of appointmentDocs) {
    const ap: any = docSnap.data();
    if (ap.reminder24hSent) { skipCounters.alreadySent++; continue; }
    if (ap.status && ap.status !== 'Agendado') { skipCounters.statusNotAgendado++; continue; }
    const email = ap.clientEmail || ap.email;
    if (!email) { skipCounters.missingEmail++; continue; }

    // Validate/normalize dateTime
    let dt: Date | null = null;
    try {
      const raw = ap.dateTime?.toDate ? ap.dateTime.toDate() : new Date(ap.dateTime);
      if (raw && !isNaN(raw.getTime())) dt = raw; else dt = null;
    } catch { dt = null; }
    if (!dt) { skipCounters.invalidDate++; continue; }

    const name = ap.clientName || 'Cliente';
    const serviceName = ap.service || 'Atendimento';
    const userId = docSnap.ref.path.split('/')[1];

    // Try to acquire a short-lived transactional lock so overlapping scheduler runs don't both send the same reminder
    const docRef = docSnap.ref;
    let acquired = false;
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get(docRef);
        const curData = cur.exists ? cur.data() as any : {};
        if (curData.reminder24hSent) return; // already sent
        if (curData.reminder24hSending) return; // someone else is processing
        tx.update(docRef, { reminder24hSending: admin.firestore.FieldValue.serverTimestamp() });
        acquired = true;
      }, { maxAttempts: 1 });
    } catch (tErr) {
      console.warn(`[${event.jobName}] V4 LOCK_FAIL: Could not acquire lock for ${docSnap.id}`, tErr);
      acquired = false;
    }

    if (!acquired) { skipCounters.alreadySent++; continue; }

    try {
      const userDoc = await db.doc(`users/${userId}`).get();
      const professionalName = userDoc.exists ? (userDoc.data() as any)?.name || 'Seu Profissional' : 'Seu Profissional';

      const autoSnap = await db.doc('platform/automations').get();
      let subject = 'Lembrete do seu agendamento';
      let body = `Olá {clientName},<br/><br/>Lembramos que você tem uma consulta agendada para amanhã.<br/>📅 Detalhes da Consulta:<br/><br/>&nbsp;&nbsp;&nbsp;&nbsp;Profissional: {professionalName}<br/>&nbsp;&nbsp;&nbsp;&nbsp;Serviço: {serviceName}<br/>&nbsp;&nbsp;&nbsp;&nbsp;Data: {data}<br/>&nbsp;&nbsp;&nbsp;&nbsp;Horário: {horário}<br/><br/>Se precisar reagendar ou cancelar, entre em contato conosco.<br/><br/>Atenciosamente,<br/>{professionalName}`;
      if (autoSnap.exists) {
        const au: any = autoSnap.data();
        const tmpl = Array.isArray(au.templates) ? au.templates.find((t: any) => t.id === 't_remind') : null;
        if (tmpl?.subject) subject = tmpl.subject;
        if (tmpl?.body) body = tmpl.body;
      }
      const vars = {
        'nome do cliente': name,
        'nome do profissional': professionalName,
        'nome do serviço': serviceName,
        'data': dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        'horário': dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        clientName: name, serviceName, dateTime: formatDateTimePtBR(dt),
        date: dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        time: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        professionalName,
      };

      await sendEmailViaBrevo(email, name, applyTemplate(subject, vars), applyTemplate(body, vars));
      // Mark sent and clear sending flag
      try {
        await docRef.update({ reminder24hSent: true, reminderSentAt: admin.firestore.FieldValue.serverTimestamp(), reminder24hSending: admin.firestore.FieldValue.delete() });
      } catch (w) {
        console.warn(`[${event.jobName}] V4 WARNING: Failed to update sent flag for ${docSnap.id}`, w);
      }

      processedCount++;
      skipCounters.ok++;
      console.log(`[${event.jobName}] V4 PROCESS_SUCCESS: Sent reminder for appointment ${docSnap.id} to ${email}.`);
    } catch (e) {
      console.error(`[${event.jobName}] V4 PROCESS_FAIL: Error on appointment ${docSnap.id}.`, e);
      // Clear sending flag so future runs can retry
      try { await docRef.update({ reminder24hSending: admin.firestore.FieldValue.delete(), reminder24hError: (e as any)?.message || String(e), reminder24hErrorAt: admin.firestore.FieldValue.serverTimestamp() }); } catch (u) { console.warn('Failed to clear reminder24hSending after error', u); }
    }
  }

  console.log(`[${event.jobName}] V4 SKIP_SUMMARY:`, JSON.stringify(skipCounters));
  console.log(`[${event.jobName}] V4 PROCESSED_COUNT: ${processedCount}`);
  if (processedCount === 0) {
    console.log(`[${event.jobName}] V4 END: No valid reminders to send.`);
  }
  console.log(`[${event.jobName}] V4 END: Job finished.`);
});

// Callable debug helper: allows testing the reminder logic with a custom window and optional dry run
export const debugSendDailyReminders = onCall({ region: 'us-central1' }, async (req) => {
  const { minutesFrom = 1410, minutesTo = 1470, execute = false } = (req.data || {}) as any; // default ~23.5h-24.5h
  if (minutesFrom >= minutesTo) throw new HttpsError('invalid-argument', 'minutesFrom deve ser < minutesTo');
  const now = new Date();
  const start = new Date(now.getTime() + minutesFrom * 60000);
  const end = new Date(now.getTime() + minutesTo * 60000);
  const db = admin.firestore();
  const tsStart = admin.firestore.Timestamp.fromDate(start);
  const tsEnd = admin.firestore.Timestamp.fromDate(end);

  const out: any = { window: { start: tsStart.toDate().toISOString(), end: tsEnd.toDate().toISOString() }, found: 0, processed: 0, skips: {}, dryRun: !execute, details: [] };
  try {
    const qs = await db.collectionGroup('appointments')
      .where('dateTime', '>=', tsStart)
      .where('dateTime', '<=', tsEnd)
      .get();
    out.found = qs.size;
    const skipCounters: Record<string, number> = { alreadySent: 0, statusNotAgendado: 0, missingEmail: 0, invalidDate: 0 };
    for (const docSnap of qs.docs) {
      const ap: any = docSnap.data();
      const info: any = { id: docSnap.id };
      if (ap.reminder24hSent) { skipCounters.alreadySent++; info.skip = 'alreadySent'; out.details.push(info); continue; }
      if (ap.status && ap.status !== 'Agendado') { skipCounters.statusNotAgendado++; info.skip = 'statusNotAgendado'; out.details.push(info); continue; }
      const email = ap.clientEmail || ap.email; if (!email) { skipCounters.missingEmail++; info.skip = 'missingEmail'; out.details.push(info); continue; }
      let dt: Date | null = null; try { const raw = ap.dateTime?.toDate ? ap.dateTime.toDate() : new Date(ap.dateTime); if (raw && !isNaN(raw.getTime())) dt = raw; else dt = null; } catch { dt = null; }
      if (!dt) { skipCounters.invalidDate++; info.skip = 'invalidDate'; out.details.push(info); continue; }
      info.email = email;
      if (!execute) { out.details.push(info); continue; }

      // Acquire transactional lock similar to production path
      const docRef = docSnap.ref;
      let acquired = false;
      try {
        await db.runTransaction(async (tx) => {
          const cur = await tx.get(docRef);
          const curData = cur.exists ? cur.data() as any : {};
          if (curData.reminder24hSent) return;
          if (curData.reminder24hSending) return;
          tx.update(docRef, { reminder24hSending: admin.firestore.FieldValue.serverTimestamp() });
          acquired = true;
        }, { maxAttempts: 1 });
      } catch (tErr) {
        acquired = false;
      }

      if (!acquired) { info.skip = 'locked'; out.details.push(info); continue; }

      try {
        const userId = docSnap.ref.path.split('/')[1];
        const userDoc = await db.doc(`users/${userId}`).get();
        const professionalName = userDoc.exists ? (userDoc.data() as any)?.name || 'Seu Profissional' : 'Seu Profissional';
        const name = ap.clientName || 'Cliente';
        const serviceName = ap.service || 'Atendimento';
        const subject = 'TESTE Lembrete (debug)';
        const body = `Debug: agendamento em ${dt.toISOString()} para {clientName}`;
        const vars = { clientName: name } as any;
        await sendEmailViaBrevo(email, name, applyTemplate(subject, vars), applyTemplate(body, vars));
        await docSnap.ref.set({ reminder24hSent: true, reminderSentAt: admin.firestore.FieldValue.serverTimestamp(), reminder24hSending: admin.firestore.FieldValue.delete() }, { merge: true });
        out.processed++;
        info.sent = true;
        out.details.push(info);
      } catch (e: any) {
        info.error = e?.message || String(e);
        // Clear sending marker on error so retries can happen
        try { await docSnap.ref.update({ reminder24hSending: admin.firestore.FieldValue.delete(), reminder24hError: info.error, reminder24hErrorAt: admin.firestore.FieldValue.serverTimestamp() }); } catch {}
        out.details.push(info);
      }
    }
    out.skips = skipCounters;
  } catch (e: any) {
    throw new HttpsError('internal', e?.message || 'Erro debug reminders');
  }
  return out;
});

// One-off callable to apply CORS configuration to the default Storage bucket
export const applyStorageCors = onCall({ region: 'us-central1' }, async () => {
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
    await (bucket as any).setCors([
      { origin: origins, method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'], responseHeader: ['Content-Type', 'Authorization'], maxAgeSeconds: 3600 },
    ]);
    return { ok: true, origins };
  } catch (e: any) {
    throw new HttpsError('internal', e?.message || 'Failed to set CORS');
  }
});

// Create a temporary reservation atomically: writes a doc under users/{professionalId}/reservations
export const createReservation = onCall({ 
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
  const { professionalId, serviceId, dateTime, duration, clientName, clientEmail, gateway } = (req.data || {}) as any;
  if (!professionalId || !serviceId || !dateTime || !duration || !clientName) {
    throw new HttpsError('invalid-argument', 'Parâmetros obrigatórios faltando');
  }
  try {
    const db = admin.firestore();
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + Number(duration) * 60000);

  // Load advanced settings for buffer validation (support legacy top-level fields and nested advancedSettings)
  const advancedSettingsDoc = await db.doc(`users/${professionalId}/availability/default`).get();
  const advDocData = advancedSettingsDoc.exists ? (advancedSettingsDoc.data() as any) : {};
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
      throw new HttpsError('failed-precondition', `Agendamento requer pelo menos ${minNoticeHours} hora(s) de antecedência`);
    }

    // Run a transaction: ensure no overlapping appointment or active reservation exists
    const reservationRef = db.collection(`users/${professionalId}/reservations`).doc();
    await db.runTransaction(async (tx) => {
      // Query appointments on that day that may overlap (with buffers)
      const apptQ = await db.collection(`users/${professionalId}/appointments`).get();
      const dayAppointments = apptQ.docs.filter(a => {
        const ad = a.data() as any;
        const aDate = ad.dateTime?.toDate ? ad.dateTime.toDate() : new Date(ad.dateTime);
        return aDate.toDateString() === start.toDateString() && ad.status !== 'Canceled';
      });

      // Check max appointments per day
      if (dayAppointments.length >= maxAppointmentsPerDay) {
        throw new HttpsError('resource-exhausted', 'Limite máximo de agendamentos por dia atingido');
      }

      // Check overlaps with appointments (including buffers)
      for (const a of apptQ.docs) {
        const ad = a.data() as any;
        if (ad.status === 'Canceled') continue;
        const aStart = ad.dateTime?.toDate ? ad.dateTime.toDate() : new Date(ad.dateTime);
        const aEnd = new Date(aStart.getTime() + (Number(ad.duration) || 0) * 60000);
        
        // Apply buffers to both appointments and new reservation
        const aStartWithBuffer = new Date(aStart.getTime() - bufferBefore * 60000);
        const aEndWithBuffer = new Date(aEnd.getTime() + bufferAfter * 60000);
        const startWithBuffer = new Date(start.getTime() - bufferBefore * 60000);
        const endWithBuffer = new Date(end.getTime() + bufferAfter * 60000);
        
        if (startWithBuffer < aEndWithBuffer && endWithBuffer > aStartWithBuffer) {
          throw new HttpsError('already-exists', 'Horário já agendado (considerando intervalos de segurança)');
        }
      }

      // Check existing active reservations (including buffers)
      const resSnap = await db.collection(`users/${professionalId}/reservations`).get();
      for (const r of resSnap.docs) {
        const rd = r.data() as any;
        if (rd.used) continue;
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
            throw new HttpsError('already-exists', 'Horário temporariamente reservado por outro cliente');
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
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao criar reserva');
  }
});

// Finalize reservation: mark used and create appointment atomically
// Helper: finalize reservation internal (used by callable and webhook)
export async function finalizeReservationInternal(db: admin.firestore.Firestore, professionalId: string, reservationId: string, paymentStatusParam?: string) {
  const resRef = db.doc(`users/${professionalId}/reservations/${reservationId}`);
  const apptRef = db.collection(`users/${professionalId}/appointments`).doc();

  // Load advanced settings for buffer validation
  const advancedSettingsDoc = await db.doc(`users/${professionalId}/availability/default`).get();
  const advancedSettings = advancedSettingsDoc.exists ? (advancedSettingsDoc.data() as any)?.advancedSettings : {};
  const bufferBefore = Number(advancedSettings?.bufferBefore) || 0;
  const bufferAfter = Number(advancedSettings?.bufferAfter) || 0;

  await db.runTransaction(async (tx) => {
    const resSnap = await tx.get(resRef);
    if (!resSnap.exists) throw new Error('Reserva nao encontrada');
    const rd = resSnap.data() as any;
    const expiresAt = rd.expiresAt?.toDate ? rd.expiresAt.toDate() : new Date(rd.expiresAt || 0);
    if (rd.used) throw new Error('Reserva ja utilizada');
    if (expiresAt < new Date()) throw new Error('Reserva expirou');

    const start = rd.dateTime?.toDate ? rd.dateTime.toDate() : new Date(rd.dateTime);
    const end = new Date(start.getTime() + (Number(rd.duration) || 0) * 60000);

    // Double-check no overlapping appointments were created meanwhile (with buffers)
    const apptQ = await db.collection(`users/${professionalId}/appointments`).get();
    for (const a of apptQ.docs) {
      const ad = a.data() as any;
      if (ad.status === 'Canceled') continue;
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

    const apptData: any = {
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
export const finalizeReservation = onCall({ region: 'us-central1' }, async (req) => {
  const db = admin.firestore();
  const { professionalId, reservationId, paymentStatus } = (req.data || {}) as any;
  if (!professionalId || !reservationId) throw new HttpsError('invalid-argument', 'professionalId e reservationId são obrigatórios');
  try {
    return await finalizeReservationInternal(db, professionalId, reservationId, paymentStatus);
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao finalizar reserva');
  }
});

// MercadoPago webhook endpoint: receives notifications and finalizes reservation when payment is approved.
export const mercadoPagoWebhook = onRequest({ region: 'us-central1', cors: false }, async (req, res) => {
  try {
    // Basic handling: MercadoPago will POST notifications with 'type' and 'data' that include an id (payment id or merchant_order id)
    const body = req.body || {};
    const topic = body.type || req.query.type || (req.headers as any)['x-mp-type'];
    const id = body.data?.id || req.query.id || (req.headers as any)['x-mp-id'];

    if (!id) {
      res.status(400).send({ error: 'Missing id' });
      return;
    }

    // We'll try to fetch payment or merchant_order detail to find preference id/metadata
    // Need professional's access token to call MercadoPago API; we'll attempt to look up any reservation that has mpPreferenceId equal to id first.
    const db = admin.firestore();
    // Search reservations with mpPreferenceId === id (fast path)
    const prefQuery = await db.collectionGroup('reservations').where('mpPreferenceId', '==', String(id)).limit(1).get();
    let targetReservation: admin.firestore.QueryDocumentSnapshot | null = null;
    if (!prefQuery.empty) targetReservation = prefQuery.docs[0];

    // If not found as reservation, try to find an appointment directly using mpPreferenceId (two-stage flow)
    let targetAppointment: admin.firestore.QueryDocumentSnapshot | null = null;
    if (!targetReservation) {
      const apptQuery = await db.collectionGroup('appointments').where('mpPreferenceId', '==', String(id)).limit(1).get();
      if (!apptQuery.empty) targetAppointment = apptQuery.docs[0];
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
      const mo = await resp2.json() as any;
        // merchant_order may contain 'payments' array; inspect payments' metadata or order items' metadata
        const payments = mo.payments || [];
        for (const p of payments) {
          const pref = p.preference_id || p.order?.preference_id || p.order?.preferenceId || p.preferenceId;
          if (pref) {
            const q = await db.collectionGroup('reservations').where('mpPreferenceId', '==', String(pref)).limit(1).get();
            if (!q.empty) { targetReservation = q.docs[0]; break; }
          }
          const resMeta = p.metadata || p.additional_info || {};
          const reservationId = resMeta.reservationId || resMeta.reservation_id || resMeta.reservation || null;
          if (reservationId) {
            // try to find any reservation with that id
            const rr = await db.collectionGroup('reservations').where('id', '==', String(reservationId)).limit(1).get();
            if (!rr.empty) { targetReservation = rr.docs[0]; break; }
          }
        }
      } else {
        // If global token present but payments endpoint succeeded, inspect returned JSON
  const json = await resp.json() as any;
        const pref = json.preference_id || json.order?.preference_id;
        if (pref) {
          const q = await db.collectionGroup('reservations').where('mpPreferenceId', '==', String(pref)).limit(1).get();
          if (!q.empty) targetReservation = q.docs[0];
        }
      }
    }

  if (!targetReservation && !targetAppointment) {
      res.status(202).send({ ok: true, note: 'No matching reservation found' });
      return;
    }

    let professionalId: string | null = null;
    let resData: any = null;
    if (targetReservation) {
      resData = targetReservation.data() as any;
      professionalId = targetReservation.ref.path.split('/')[1];
    } else if (targetAppointment) {
      resData = targetAppointment.data() as any;
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
          const pJson = await pResp.json() as any;
          if (pJson.status === 'approved' || pJson.status === 'paid') isApproved = true;
        }
      } else {
        // If no token, treat notification type 'payment' as approval for now
        if (String(topic).toLowerCase().includes('payment') || String(topic).toLowerCase().includes('approved')) isApproved = true;
      }

      if (isApproved) {
        if (targetReservation) {
          // finalize using internal helper for reservations
          await finalizeReservationInternal(db, professionalId!, targetReservation.id, 'paid');
          finalized = true;
        } else if (targetAppointment) {
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
          } catch (e) {
            console.warn('Failed to update appointment from webhook', e);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to finalize from webhook', e);
    }

    if (finalized) res.status(200).send({ ok: true });
    else res.status(202).send({ ok: true, note: 'Not finalized (not approved yet)' });
  } catch (e: any) {
    console.error('mercadoPagoWebhook error', e);
    res.status(500).send({ error: e?.message || 'internal' });
  }
});

// --- Admin Panel Helper Callables ---
// Very lightweight role check: admin emails stored in platform_settings.adminEmails
async function assertIsPlatformAdmin(ctx: any) {
  const uid = ctx.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário');
  const userRec = await admin.auth().getUser(uid).catch(() => null);
  const email = userRec?.email?.toLowerCase();
  if (!email) throw new HttpsError('permission-denied', 'Sem e-mail');
  // Read settings from either 'platform/settings' (modern) or 'platform_settings' (legacy).
  const extractEmails = (data: any): string[] => {
    if (!data) return [];
    if (typeof data === 'string') return [data];
    if (Array.isArray(data)) return data;
    if (data.adminEmails) {
      if (Array.isArray(data.adminEmails)) return data.adminEmails;
      if (typeof data.adminEmails === 'string') return [data.adminEmails];
    }
    if (data.emails) {
      if (Array.isArray(data.emails)) return data.emails;
      if (typeof data.emails === 'string') return [data.emails];
    }
    if (data.email && typeof data.email === 'string') return [data.email];
    return [];
  };

  const settingsRef1 = admin.firestore().doc('platform/settings');
  // legacy: try collection 'platform_settings' doc 'settings'
  const settingsRef2 = admin.firestore().doc('platform_settings/settings');
  const snap1 = await settingsRef1.get().catch(() => null);
  let admins: string[] = [];
  if (snap1 && snap1.exists) {
    admins = extractEmails(snap1.data());
  }
  if (!admins || admins.length === 0) {
    const snap2 = await settingsRef2.get().catch(() => null);
    if (snap2 && snap2.exists) {
      admins = extractEmails(snap2.data());
    }
  }
  const fallback = ['admin@agendiia.com.br', 'contato@agendiia.com.br', 'contato@agendiia'];
  const allowed = new Set([...(admins || []).map((e: any) => (typeof e === 'string' ? e.toLowerCase() : '')), ...fallback]);
  if (!allowed.has(email)) throw new HttpsError('permission-denied', 'Acesso restrito');
  return { uid, email };
}

// List users with basic auth metadata
export const listPlatformUsers = onCall({ region: 'us-central1' }, async (req) => {
  await assertIsPlatformAdmin(req);
  const { limit = 500 } = (req.data || {}) as any;
  const list = await admin.auth().listUsers(limit);
  // Merge with Firestore doc (plan/status/createdAt)
  const db = admin.firestore();
  const out = [] as any[];
  for (const u of list.users) {
    const fsDoc = await db.doc(`users/${u.uid}`).get().catch(() => null);
    const data: any = fsDoc?.exists ? fsDoc.data() : {};
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

// Update platform user data
export const updatePlatformUser = onCall({ 
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
  await assertIsPlatformAdmin(req);
  const { userId, userData } = (req.data || {}) as any;
  if (!userId) throw new HttpsError('invalid-argument', 'userId faltando');
  if (!userData) throw new HttpsError('invalid-argument', 'userData faltando');
  
  try {
    // Validate the user exists
    const userDoc = await admin.firestore().doc(`users/${userId}`).get();
    if (!userDoc.exists) throw new HttpsError('not-found', 'Usuário não encontrado');
    
    const currentData = userDoc.data();
    
    // Prepare update data with validation
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Only update allowed fields
    if (userData.name) updateData.name = userData.name;
    if (userData.email) updateData.email = userData.email;
    if (userData.plan) updateData.plan = userData.plan;
    if (userData.status) updateData.status = userData.status;
    
    // Update user document
    await admin.firestore().doc(`users/${userId}`).update(updateData);
    
    // Record audit log
    await admin.firestore().collection('platform_audit_logs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminId: req.auth?.uid,
      action: 'USER_UPDATED',
      details: `Updated user: ${userData.email || userId}`,
      metadata: { 
        before: currentData,
        after: updateData
      }
    });
    
    return { ok: true, message: 'Usuário atualizado com sucesso' };
  } catch (error: any) {
    console.error('Error updating user:', error);
    throw new HttpsError('internal', `Falha ao atualizar usuário: ${error.message}`);
  }
});

// Delete user safely with all related data
export const deletePlatformUser = onCall({ 
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
  await assertIsPlatformAdmin(req);
  const { userId } = (req.data || {}) as any;
  if (!userId) throw new HttpsError('invalid-argument', 'userId faltando');
  
  try {
    // Get user data before deletion for audit log
    const userDoc = await admin.firestore().doc(`users/${userId}`).get();
    const userData = userDoc.data();
    
    if (!userDoc.exists) throw new HttpsError('not-found', 'Usuário não encontrado');
    
    // Delete user document
    await admin.firestore().doc(`users/${userId}`).delete();
    
    // Delete from Firebase Auth if exists
    try {
      await admin.auth().deleteUser(userId);
    } catch (authError) {
      console.warn(`Failed to delete auth user ${userId}:`, authError);
    }
    
    // Clean up related collections (appointments, etc.)
    const batch = admin.firestore().batch();
    
    // Delete user's appointments
    const appointmentsQuery = await admin.firestore()
      .collection('appointments')
      .where('userId', '==', userId)
      .get();
    
    appointmentsQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete user's transactions
    const transactionsQuery = await admin.firestore()
      .collection('platform_transactions')
      .where('userId', '==', userId)
      .get();
    
    transactionsQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Record audit log
    await admin.firestore().collection('platform_audit_logs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminId: req.auth?.uid,
      action: 'USER_DELETED',
      details: `Deleted user: ${userData?.email || userId}`,
      metadata: { deletedUserData: userData }
    });
    
    return { ok: true, message: 'Usuário excluído com sucesso' };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new HttpsError('internal', `Falha ao excluir usuário: ${error.message}`);
  }
});

// Toggle suspension (status field only)
export const toggleUserStatus = onCall({ 
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
  await assertIsPlatformAdmin(req);
  const { userId } = (req.data || {}) as any;
  if (!userId) throw new HttpsError('invalid-argument', 'userId faltando');
  
  // Get current user status
  const userDoc = await admin.firestore().doc(`users/${userId}`).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'Usuário não encontrado');
  
  const currentStatus = userDoc.data()?.status || 'Ativo';
  const newStatus = currentStatus === 'Ativo' ? 'Suspenso' : 'Ativo';
  
  await admin.firestore().doc(`users/${userId}`).set({ 
    status: newStatus, 
    updatedAt: admin.firestore.FieldValue.serverTimestamp() 
  }, { merge: true });
  
  return { ok: true, newStatus };
});

// Force password reset: revoke tokens so next login requires reauth (UI will send reset email)
export const forcePasswordReset = onCall({ region: 'us-central1' }, async (req) => {
  await assertIsPlatformAdmin(req);
  const { userId } = (req.data || {}) as any;
  if (!userId) throw new HttpsError('invalid-argument', 'userId faltando');

  try {
    // Ensure the user exists in Auth before attempting to revoke tokens
    try {
      await admin.auth().getUser(userId);
    } catch (e) {
      throw new HttpsError('not-found', 'Usuário não encontrado');
    }

    // Revoke refresh tokens so next sign-in requires re-authentication
    await admin.auth().revokeRefreshTokens(userId);

    // Mark in Firestore so client UI can trigger reset email or show the flag
    await admin.firestore().doc(`users/${userId}`).set({ forcePasswordReset: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    return { ok: true };
  } catch (err: any) {
    console.error('forcePasswordReset error for userId', userId, err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao forçar reset de senha');
  }
});

// Impersonate: create a custom token for target user
export const impersonateUser = onCall({ region: 'us-central1' }, async (req) => {
  await assertIsPlatformAdmin(req);
  const { targetUserId } = (req.data || {}) as any;
  if (!targetUserId) throw new HttpsError('invalid-argument', 'targetUserId faltando');
  const token = await admin.auth().createCustomToken(targetUserId, { impersonated: true });
  return { token };
});

// Update platform settings + admin emails + feature flags
export const updatePlatformSettings = onCall({ region: 'us-central1' }, async (req) => {
  const adminInfo = await assertIsPlatformAdmin(req);
  const { settings, adminEmails, featureFlags } = (req.data || {}) as any;
  const ref = admin.firestore().doc('platform_settings');
  const data: any = {};
  if (settings) Object.assign(data, settings);
  if (Array.isArray(adminEmails)) data.adminEmails = adminEmails.map((e: string) => e.toLowerCase());
  if (featureFlags && typeof featureFlags === 'object') data.featureFlags = featureFlags;
  if (!Object.keys(data).length) throw new HttpsError('invalid-argument', 'Nada para atualizar');
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
export const recordAdminAction = onCall({ region: 'us-central1' }, async (req) => {
  const adminInfo = await assertIsPlatformAdmin(req);
  const { action, details } = (req.data || {}) as any;
  if (!action) throw new HttpsError('invalid-argument', 'action obrigatório');
  await admin.firestore().collection('platform_auditLogs').add({
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    user: adminInfo.email,
    action,
    details: details || '',
  });
  return { ok: true };
});

// Export audit logs as CSV (simple string return)
export const exportAuditLogsCsv = onCall({ region: 'us-central1' }, async (req) => {
  await assertIsPlatformAdmin(req);
  const { limit = 1000 } = (req.data || {}) as any;
  const qs = await admin.firestore().collection('platform_auditLogs').orderBy('timestamp', 'desc').limit(limit).get();
  const rows: string[] = ['timestamp,user,action,details'];
  for (const d of qs.docs) {
    const x: any = d.data();
    const ts = x.timestamp?.toDate ? x.timestamp.toDate().toISOString() : '';
    const esc = (v: string) => '"' + (v || '').replace(/"/g, '""') + '"';
    rows.push([ts, x.user, x.action, x.details].map(esc).join(','));
  }
  return { csv: rows.join('\n') };
});

// Manually set user plan
export const setUserPlan = onCall({ region: 'us-central1' }, async (req) => {
  await assertIsPlatformAdmin(req);
  const { userId, plan } = (req.data || {}) as any;
  if (!userId || !plan) throw new HttpsError('invalid-argument', 'userId e plan são obrigatórios');
  await admin.firestore().doc(`users/${userId}`).set({ plan, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

// Grant or extend trial
export const grantOrExtendTrial = onCall({ region: 'us-central1' }, async (req) => {
  await assertIsPlatformAdmin(req);
  const { userId, extraDays } = (req.data || {}) as any;
  if (!userId || !extraDays) throw new HttpsError('invalid-argument', 'userId e extraDays são obrigatórios');
  const ref = admin.firestore().doc(`users/${userId}`);
  const snap = await ref.get();
  const now = new Date();
  let current = now;
  const data: any = snap.exists ? snap.data() : {};
  if (data.trialEndsAt) {
    const cur = data.trialEndsAt.toDate ? data.trialEndsAt.toDate() : new Date(data.trialEndsAt);
    current = cur > now ? cur : now;
  }
  const newEnd = new Date(current.getTime() + extraDays * 86400000);
  await ref.set({ plan: 'Trial', trialEndsAt: newEnd.toISOString(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { trialEndsAt: newEnd.toISOString() };
});

// Stripe webhook skeleton (extend with real secret validation later)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
export const stripeWebhook = onRequest({ region: 'us-central1', cors: false }, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).send({ error: 'Webhook secret ausente' });
    return;
  }
  let event: Stripe.Event;
  try {
    // functions v2 may parse body; ensure raw body via req.rawBody
    const payload = (req as any).rawBody || JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(payload, sig as string, webhookSecret);
  } catch (err: any) {
    res.status(400).send({ error: `Assinatura inválida: ${err.message}` });
    return;
  }
  try {
    const db = admin.firestore();
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice;
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
        const inv = event.data.object as Stripe.Invoice;
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
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        // Optionally fetch customer for email
        try {
          const cust = await stripe.customers.retrieve(customerId);
          const email = (cust as any)?.email;
          if (email) {
            const qs = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
            if (!qs.empty) {
              const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
              const statusMap: any = { active: 'Ativo', trialing: 'Trial', past_due: 'Inativo', canceled: 'Inativo', incomplete: 'Inativo' };
              await qs.docs[0].ref.set({ subscriptionStatus: statusMap[sub.status] || 'Inativo', currentPeriodEnd: periodEnd }, { merge: true });
            }
          }
        } catch {}
        break;
      }
    }
    res.status(200).send({ received: true });
  } catch (e: any) {
    res.status(500).send({ error: e?.message || 'Falha processamento' });
  }
});

// Callable to create a Stripe Checkout Session for a user
export const createStripeCheckoutSession = onCall({ region: 'us-central1' }, async (request) => {
  const data = (request.data || {}) as any;
  const priceId: string = data.priceId;
  const mode: 'subscription' | 'payment' = data.mode || 'subscription';
  const successUrl: string = data.successUrl || data.success_url || data.success || null;
  const cancelUrl: string = data.cancelUrl || data.cancel_url || data.cancel || null;

  const uid = request.auth?.uid || data.userId;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário precisa estar autenticado');
  if (!priceId) throw new HttpsError('invalid-argument', 'priceId é obrigatório');

  try {
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData: any = userSnap.exists ? userSnap.data() : {};

    // Ensure Stripe Customer exists for this user
    let stripeCustomerId = userData.stripeCustomerId as string | undefined;
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
  } catch (err: any) {
    console.error('createStripeCheckoutSession error', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao criar sessão de checkout');
  }
});

// Callable to create a Stripe Customer Portal session
export const createStripeCustomerPortalSession = onCall({ region: 'us-central1' }, async (request) => {
  const data = (request.data || {}) as any;
  const returnUrl: string = data.returnUrl || data.return_url || data.return || null;
  const uid = request.auth?.uid || data.userId;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário precisa estar autenticado');

  try {
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData: any = userSnap.exists ? userSnap.data() : {};

    const stripeCustomerId = userData.stripeCustomerId as string | undefined;
    if (!stripeCustomerId) throw new HttpsError('failed-precondition', 'Stripe customer não encontrado para este usuário');

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || 'https://agendiia.com.br/account',
    });

    return { url: session.url };
  } catch (err: any) {
    console.error('createStripeCustomerPortalSession error', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao criar sessão do portal do cliente');
  }
});

// Callable: request cancellation of the customer's active Stripe subscription(s)
export const cancelStripeSubscription = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário precisa estar autenticado');
  
  console.log('cancelStripeSubscription called for uid:', uid);
  
  try {
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData: any = userSnap.exists ? userSnap.data() : {};
    const stripeCustomerId: string | undefined = userData.stripeCustomerId;
    
    console.log('User data loaded. stripeCustomerId:', stripeCustomerId ? 'exists' : 'not found');
    
    // Allow the client to request immediate cancellation or cancel at period end
    const { cancelAtPeriodEnd = true, immediate = false, reason = null } = (request.data || {}) as any;

    // Handle case where user doesn't have a Stripe customer yet (e.g., trial users)
    if (!stripeCustomerId) {
      console.log('No stripeCustomerId found, handling as trial user');
      // This could be a trial user who wants to prevent future billing
      // Just update Firestore to indicate they don't want to continue
      const now = new Date().toISOString();
      await userRef.set({
        subscriptionStatus: 'CancelRequested',
        cancelRequestedAt: now,
        cancellationReason: reason || 'trial_cancel',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log('Trial cancellation recorded successfully');
      return { 
        ok: true, 
        message: 'Cancelamento registrado para usuário sem customer Stripe',
        processed: [{ type: 'trial_cancel', cancelRequestedAt: now }]
      };
    }

    console.log('Processing Stripe customer with subscriptions...');

    // List subscriptions for this customer (include any statuses so we can handle trialing/past_due)
    const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, limit: 100 });
    if (!subs.data || subs.data.length === 0) {
      return { ok: false, message: 'Nenhuma assinatura encontrada' };
    }

    const processed: any[] = [];
    for (const s of subs.data) {
      try {
        if (immediate) {
          // Cancel immediately
          const deleted = await (stripe.subscriptions as any).del(s.id);
          const periodEnd = deleted.current_period_end ? new Date(deleted.current_period_end * 1000).toISOString() : null;
          processed.push({ id: s.id, canceledImmediately: true, periodEnd });
          await userRef.set({ subscriptionStatus: 'Inativo', canceledAt: admin.firestore.FieldValue.serverTimestamp(), endsAt: periodEnd, cancellationReason: reason || null }, { merge: true });
        } else if (cancelAtPeriodEnd) {
          const updated = await stripe.subscriptions.update(s.id, { cancel_at_period_end: true });
          const periodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null;
          processed.push({ id: s.id, cancelAtPeriodEnd: true, periodEnd });
          await userRef.set({ subscriptionStatus: 'CancelRequested', cancelRequestedAt: admin.firestore.FieldValue.serverTimestamp(), endsAt: periodEnd, cancellationReason: reason || null }, { merge: true });
        } else {
          // Fallback: schedule cancel at period end
          const updated = await stripe.subscriptions.update(s.id, { cancel_at_period_end: true });
          const periodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null;
          processed.push({ id: s.id, cancelAtPeriodEnd: true, periodEnd });
          await userRef.set({ subscriptionStatus: 'CancelRequested', cancelRequestedAt: admin.firestore.FieldValue.serverTimestamp(), endsAt: periodEnd, cancellationReason: reason || null }, { merge: true });
        }
      } catch (e) {
        console.warn('cancelStripeSubscription: failed to process', s.id, e);
      }
    }

    return { ok: true, processed };
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao cancelar assinatura');
  }

});

// Callable: reactivate a subscription that was scheduled to cancel at period end
export const reactivateStripeSubscription = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário precisa estar autenticado');
  
  console.log('reactivateStripeSubscription called for uid:', uid);
  
  try {
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData: any = userSnap.exists ? userSnap.data() : {};
    const stripeCustomerId: string | undefined = userData.stripeCustomerId;
    
    console.log('User data loaded. stripeCustomerId:', stripeCustomerId ? 'exists' : 'not found');
    console.log('Current subscriptionStatus:', userData.subscriptionStatus);
    
    // Handle case where user doesn't have a Stripe customer yet (e.g., trial users)
    if (!stripeCustomerId) {
      console.log('No stripeCustomerId found, checking for local cancellation');
      // If they don't have a Stripe customer, check if they have a local cancellation request
      if (userData.subscriptionStatus === 'CancelRequested') {
        console.log('Found local cancellation, reactivating trial user');
        // Reset their status to active/trialing
        await userRef.set({
          subscriptionStatus: 'Ativo',
          cancelRequestedAt: admin.firestore.FieldValue.delete(),
          cancellationReason: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('Trial user reactivated successfully');
        return { 
          ok: true, 
          message: 'Cancelamento local removido para usuário sem customer Stripe',
          reactivated: [{ type: 'trial_reactivate', status: 'Ativo' }]
        };
      } else {
        console.log('No local cancellation found for trial user');
        return { ok: false, message: 'Usuário não possui assinatura ou cancelamento para reativar' };
      }
    }

    const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, limit: 100 });
    if (!subs.data || subs.data.length === 0) {
      return { ok: false, message: 'Nenhuma assinatura encontrada' };
    }

    const reactivated: any[] = [];
    for (const s of subs.data) {
      try {
        if (s.cancel_at_period_end) {
          const updated = await stripe.subscriptions.update(s.id, { cancel_at_period_end: false });
          const periodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null;
          reactivated.push({ id: s.id, reactivated: true, periodEnd });
          await userRef.set({ 
            subscriptionStatus: 'Ativo', 
            updatedAt: admin.firestore.FieldValue.serverTimestamp(), 
            endsAt: periodEnd 
          }, { merge: true });
        } else if (s.status === 'canceled') {
          reactivated.push({ id: s.id, reactivated: false, reason: 'already_canceled' });
        } else {
          reactivated.push({ id: s.id, reactivated: false, reason: 'no_cancel_scheduled' });
        }
      } catch (e) {
        console.warn('reactivateStripeSubscription: failed for', s.id, e);
      }
    }

    return { ok: true, reactivated };
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err?.message || 'Falha ao reativar assinatura');
  }
});
// Analytics and Metrics Functions
export const getPlatformAnalytics = onCall({ region: 'us-central1' }, async (req) => {
  // Apply admin rate limiting
  if (req.auth?.uid) {
    await applyRateLimit(req.auth.uid, 'getPlatformAnalytics', adminRateLimiter);
  }
  
  await assertIsPlatformAdmin(req);
  
  // Check admin plan limits for analytics access
  if (req.auth?.uid) {
    await checkPlanLimits(req.auth.uid, 'apiCalls');
  }
  
  const { period = '30d', startDate, endDate } = (req.data || {}) as any;
  
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
      period: { start: start.toISOString(), end: end.toISOString() },
      dataSource: {
        users: users.length,
        transactions: transactions.length,
        appointments: appointments.length,
        isRealData: users.length > 0 && transactions.length > 0,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error: any) {
    throw new HttpsError('internal', `Erro ao calcular analytics: ${error.message}`);
  }
});

// Helper function to calculate platform metrics
async function calculatePlatformMetrics(users: any[], transactions: any[], appointments: any[], start: Date, end: Date) {
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
async function calculateRevenueMetrics(users: any[], transactions: any[], start: Date, end: Date) {
  const paidTransactions = transactions.filter(t => t.status === 'Paid');
  
  // Revenue by plan
  const byPlan: Record<string, number> = {};
  users.forEach(user => {
    const userTransactions = paidTransactions.filter(t => t.userId === user.id);
    const revenue = userTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    byPlan[user.plan || 'Unknown'] = (byPlan[user.plan || 'Unknown'] || 0) + revenue;
  });
  
  // Revenue by month (last 12 months)
  const byMonth: Array<{ month: string; revenue: number; users: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const monthEnd = new Date(end.getFullYear(), end.getMonth() - i + 1, 0);
    
    const monthRevenue = paidTransactions
      .filter(t => {
        const date = t.createdAt ? (t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt)) : null;
        return date && date >= monthStart && date <= monthEnd && t.status === 'Paid';
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
async function calculateUserGrowthMetrics(users: any[], start: Date, end: Date) {
  const newUsers: Array<{ date: string; count: number }> = [];
  const activeUsers: Array<{ date: string; count: number }> = [];
  const churnedUsers: Array<{ date: string; count: number }> = [];
  
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
async function calculateUsageMetrics(users: any[], start: Date, end: Date) {
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
async function calculateConversionMetrics(users: any[], start: Date, end: Date) {
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
async function calculateAppointmentMetrics(appointments: any[], start: Date, end: Date) {
  const periodAppointments = appointments.filter(a => {
    const date = a.dateTime ? (a.dateTime.toDate ? a.dateTime.toDate() : new Date(a.dateTime)) : null;
    return date && date >= start && date <= end;
  });
  
  const totalBookings = periodAppointments.length;
  
  // Get unique users from appointments
  const uniqueUsers = new Set(periodAppointments.map(a => a.userId || 'unknown')).size;
  const averageBookingsPerUser = uniqueUsers > 0 ? totalBookings / uniqueUsers : 0;
  
  // Booking trends (daily)
  const bookingTrends: Array<{ date: string; count: number }> = [];
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
  const serviceCounts: Record<string, number> = {};
  periodAppointments.forEach(a => {
    const service = a.service || 'Unknown';
    serviceCounts[service] = (serviceCounts[service] || 0) + 1;
  });
  
  const popularServices = Object.entries(serviceCounts)
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Time slot distribution
  const timeSlotDistribution: Record<string, number> = {
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
      if (hour >= 6 && hour < 9) timeSlotDistribution['06-09']++;
      else if (hour >= 9 && hour < 12) timeSlotDistribution['09-12']++;
      else if (hour >= 12 && hour < 15) timeSlotDistribution['12-15']++;
      else if (hour >= 15 && hour < 18) timeSlotDistribution['15-18']++;
      else if (hour >= 18 && hour < 21) timeSlotDistribution['18-21']++;
      else timeSlotDistribution['21-24']++;
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
export const expireTrialsDaily = onSchedule({ schedule: 'every 24 hours', timeZone: 'America/Sao_Paulo', region: 'us-central1' }, async () => {
  const db = admin.firestore();
  const now = new Date();
  // naive scan (optimize with collection group / index if large scale)
  const snap = await db.collection('users').get();
  const batch = db.batch();
  let writes = 0;
  for (const d of snap.docs) {
    const data: any = d.data();
    if (data.trialEndsAt) {
      const end = data.trialEndsAt.toDate ? data.trialEndsAt.toDate() : new Date(data.trialEndsAt);
      if (end < now && (data.plan === 'Trial')) {
    batch.update(d.ref, { plan: 'Profissional', subscriptionStatus: 'Inativo', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    writes++;
      }
    }
  }
  if (writes > 0) await batch.commit().catch(()=>{});
});

// Scheduled job: notify users on the last day of their free trial
export const notifyTrialsEndingToday = onSchedule({ schedule: 'every 24 hours', timeZone: 'America/Sao_Paulo', region: 'us-central1' }, async () => {
  const db = admin.firestore();
  try {
    const now = new Date();
    const todayStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const usersSnap = await db.collection('users').get();
    for (const u of usersSnap.docs) {
      try {
        const data: any = u.data();
        if (!data?.trialEndsAt) continue;
        const trialEnd = data.trialEndsAt.toDate ? data.trialEndsAt.toDate() : new Date(data.trialEndsAt);
        const trialEndStr = trialEnd.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        if (trialEndStr !== todayStr) continue;

        // Avoid duplicate notifications for the same day
        if (data.trialLastDayNotified === todayStr) continue;

        const email = data.email || null;
        const name = data.name || '';
        const subject = 'Seu período gratuito está terminando';
        const html = `<p>Olá ${name || ''},</p><p>Seu período gratuito está terminando hoje. Escolha um plano para continuar usando o app e não perder seus agendamentos.</p><p><a href="https://agendiia.com.br/account/subscription">Escolher um plano</a></p>`;

        // Send email if available (best-effort)
        if (email) {
          try {
            await sendEmailViaBrevo(email, name || email, subject, html);
          } catch (e) {
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
        } catch (e) {
          console.warn('notifyTrialsEndingToday: failed to write notification doc for', u.id, e);
        }

        // Mark user as notified today
        try {
          await u.ref.set({ trialLastDayNotified: todayStr, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (e) {
          console.warn('notifyTrialsEndingToday: failed to mark user notified', u.id, e);
        }
      } catch (inner) {
        console.warn('notifyTrialsEndingToday: processing user failed', u.id, inner);
      }
    }
  } catch (e) {
    console.error('notifyTrialsEndingToday error', e);
  }
});

// --- Billing Kill Switch Function ---

const billing = new Billing();
// The project ID is automatically available in the Cloud Functions environment
const PROJECT_ID = process.env.GCLOUD_PROJECT;
const PROJECT_NAME = `projects/${PROJECT_ID}`;

/**
 * This function is triggered by a Pub/Sub message from a Cloud Billing budget alert.
 * It checks if the cost has exceeded the budget and, if so, disables billing for the project
 * to prevent further costs. This is a critical safety measure.
 */
export const stopBilling = onMessagePublished('billing-kill-switch', async (event) => {
  const pubsubMessage = event.data.message;
  // The message payload is a JSON object with cost and budget details
  const budgetData = pubsubMessage.json;

  // Defensive check: ensure the cost has actually exceeded the budget
  if (budgetData.costAmount <= budgetData.budgetAmount) {
    console.log(`No action taken. Cost ${budgetData.costAmount} is not over budget ${budgetData.budgetAmount}.`);
    return;
  }

  console.log(`BUDGET ALERT: Cost ${budgetData.costAmount} has exceeded budget ${budgetData.budgetAmount}. Disabling billing for project ${PROJECT_ID}.`);

  try {
    const [projects] = await billing.listProjects();
    const project = projects.find(p => p.projectId === PROJECT_ID);

    if (project && project.billingEnabled) {
      // This is the "kill switch" action. It detaches the project from its billing account.
      const [res] = await billing.updateProjectBillingInfo({
        name: PROJECT_NAME,
        // Setting billingAccountName to an empty string disables billing
        projectBillingInfo: { billingAccountName: '' },
      });
      console.log(`SUCCESS: Billing has been disabled for project ${PROJECT_ID}. Response: ${JSON.stringify(res)}`);
    } else {
      console.log(`Billing was already disabled for project ${PROJECT_ID} or the project was not found.`);
    }
  } catch (err) {
    console.error('FATAL: FAILED TO DISABLE BILLING. IMMEDIATE MANUAL ACTION REQUIRED.', err);
    // You could add a fallback notification here, like sending an email through a different, free service.
  }
});
