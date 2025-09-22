import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize Firebase Admin
let app;
try {
  const serviceAccountPath = './functions/serviceAccountKey.json';
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    app = initializeApp({ credential: cert(serviceAccount) });
  } else {
    app = initializeApp();
  }
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase:', error.message);
  process.exit(1);
}

const db = getFirestore(app);

async function checkSmtpConfig() {
  console.log('🔍 Verificando configuração SMTP (platform/settings.smtp)...\n');
  try {
    const snap = await db.doc('platform/settings').get();
    if (!snap.exists) {
      console.log('❌ Documento platform/settings não existe');
      process.exit(1);
    }
    const data = snap.data() || {};
    const smtp = data.smtp || {};
    console.log('📋 SMTP:');
    console.log(`   - host: ${smtp.host || '—'}`);
    console.log(`   - port: ${smtp.port || '—'}`);
    console.log(`   - secure: ${typeof smtp.secure === 'boolean' ? smtp.secure : '—'}`);
    console.log(`   - user: ${smtp.user || '—'}`);
    console.log(`   - fromName: ${smtp.fromName || '—'}`);
    console.log(`   - fromEmail: ${smtp.fromEmail || '—'}`);
    const ok = smtp.host && smtp.user && smtp.pass;
    console.log(`   - status: ${ok ? '✅ completo' : '❌ incompleto (host/user/pass)'}`);
  } catch (e) {
    console.error('❌ Erro ao verificar SMTP:', e);
  }
  process.exit(0);
}

checkSmtpConfig();