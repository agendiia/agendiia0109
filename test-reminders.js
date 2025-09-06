// Teste manual da função sendDailyReminders
// Execute este arquivo com: node test-reminders.js

const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./functions/service-account-key.json'); // você precisa baixar este arquivo do Firebase Console
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'timevee-53a3c'
});

async function testReminders() {
  console.log('🔍 Testando lógica de lembretes...');
  
  const now = new Date();
  const in23_5h = new Date(now.getTime() + 23.5 * 3600 * 1000);
  const in24_5h = new Date(now.getTime() + 24.5 * 3600 * 1000);
  
  const db = admin.firestore();
  const tsStart = admin.firestore.Timestamp.fromDate(in23_5h);
  const tsEnd = admin.firestore.Timestamp.fromDate(in24_5h);
  
  console.log(`📅 Janela de busca: ${tsStart.toDate().toISOString()} até ${tsEnd.toDate().toISOString()}`);
  
  try {
    // Tentar collectionGroup primeiro
    console.log('🔍 Tentando collectionGroup query...');
    const qs = await db.collectionGroup('appointments')
      .where('dateTime', '>=', tsStart)
      .where('dateTime', '<=', tsEnd)
      .get();
    
    console.log(`✅ CollectionGroup encontrou ${qs.size} documentos`);
    
    if (qs.size > 0) {
      qs.docs.forEach(doc => {
        const data = doc.data();
        const dt = data.dateTime?.toDate?.() || new Date(data.dateTime);
        console.log(`  📋 ${doc.id}: ${dt.toISOString()} | ${data.clientEmail || 'sem email'} | Status: ${data.status || 'sem status'} | Enviado: ${data.reminder24hSent ? 'SIM' : 'NÃO'}`);
      });
    }
    
  } catch (collErr) {
    console.warn('❌ CollectionGroup falhou:', collErr.message);
    console.log('🔄 Tentando fallback por usuários...');
    
    try {
      const usersSnapshot = await db.collection('users').limit(5).get(); // limitando para teste
      console.log(`👥 Verificando ${usersSnapshot.size} usuários...`);
      
      for (const userDoc of usersSnapshot.docs) {
        try {
          const userAppointments = await db.collection(`users/${userDoc.id}/appointments`)
            .where('dateTime', '>=', tsStart)
            .where('dateTime', '<=', tsEnd)
            .get();
          
          if (!userAppointments.empty) {
            console.log(`👤 Usuário ${userDoc.id}: ${userAppointments.size} agendamentos`);
            userAppointments.docs.forEach(doc => {
              const data = doc.data();
              const dt = data.dateTime?.toDate?.() || new Date(data.dateTime);
              console.log(`  📋 ${doc.id}: ${dt.toISOString()} | ${data.clientEmail || 'sem email'} | Status: ${data.status || 'sem status'} | Enviado: ${data.reminder24hSent ? 'SIM' : 'NÃO'}`);
            });
          }
        } catch (userErr) {
          console.warn(`⚠️ Erro no usuário ${userDoc.id}:`, userErr.message);
        }
      }
    } catch (fallbackErr) {
      console.error('❌ Fallback também falhou:', fallbackErr);
    }
  }
  
  // Verificar configuração do Brevo
  console.log('\n📧 Verificando configuração Brevo...');
  try {
    const brevoDoc = await db.doc('platform/brevo').get();
    if (brevoDoc.exists()) {
      const config = brevoDoc.data();
      console.log(`✅ Brevo configurado: API Key ${config.apiKey ? 'OK' : 'FALTA'}, Sender: ${config.senderEmail || 'não definido'}`);
    } else {
      console.log('❌ Documento platform/brevo não existe');
    }
  } catch (brevoErr) {
    console.error('❌ Erro ao verificar Brevo:', brevoErr);
  }
  
  process.exit(0);
}

testReminders().catch(console.error);
