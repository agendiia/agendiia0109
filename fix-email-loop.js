// Script para verificar e corrigir documentos que podem estar em loop
// Execute com: node fix-email-loop.js

const admin = require('firebase-admin');

// Você precisa do service account key do Firebase Console
// Baixe e coloque na pasta functions/ com o nome service-account-key.json
try {
  const serviceAccount = require('./functions/service-account-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'timevee-53a3c'
  });
} catch (e) {
  console.log('⚠️ service-account-key.json não encontrado. Usando credenciais padrão...');
  admin.initializeApp({
    projectId: 'timevee-53a3c'
  });
}

async function fixEmailLoop() {
  console.log('🔍 Verificando documentos que podem estar em loop...');
  
  const db = admin.firestore();
  
  try {
    // Buscar agendamentos criados hoje que podem estar em loop
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log(`📅 Buscando agendamentos criados entre ${today.toISOString()} e ${tomorrow.toISOString()}`);
    
    // Como não temos collectionGroup working, vamos usar uma abordagem diferente
    // Vamos buscar por usuários que tiveram atividade recente
    const usersSnapshot = await db.collection('users').limit(50).get();
    console.log(`👥 Verificando ${usersSnapshot.size} usuários...`);
    
    let totalChecked = 0;
    let fixedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const appointmentsRef = db.collection(`users/${userDoc.id}/appointments`);
        
        // Buscar agendamentos criados hoje
        const recentAppointments = await appointmentsRef
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
          .where('createdAt', '<', admin.firestore.Timestamp.fromDate(tomorrow))
          .get();
        
        for (const apptDoc of recentAppointments.docs) {
          totalChecked++;
          const data = apptDoc.data();
          
          console.log(`📋 Verificando agendamento ${apptDoc.id}:`);
          console.log(`  - confirmationEmailStatus: ${data.confirmationEmailStatus || 'não definido'}`);
          console.log(`  - updateEmailStatus: ${data.updateEmailStatus || 'não definido'}`);
          console.log(`  - professionalNotificationStatus: ${data.professionalNotificationStatus || 'não definido'}`);
          
          // Verificar se está em estado inconsistente (muitos IDs de email)
          const emailIds = [];
          if (data.confirmationEmailId) emailIds.push(data.confirmationEmailId);
          if (data.updateEmailId) emailIds.push(data.updateEmailId);
          if (data.professionalNotificationId) emailIds.push(data.professionalNotificationId);
          
          if (emailIds.length > 3) {
            console.log(`⚠️ Agendamento ${apptDoc.id} pode estar em loop - ${emailIds.length} IDs de email`);
            
            // Marcar como enviado para parar o loop
            const updateData = {
              confirmationEmailStatus: 'sent',
              updateEmailStatus: 'sent',
              professionalNotificationStatus: 'sent',
              emailLoopFixed: true,
              fixedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await apptDoc.ref.update(updateData);
            fixedCount++;
            console.log(`✅ Agendamento ${apptDoc.id} marcado como enviado para parar loop`);
          }
        }
      } catch (userError) {
        console.warn(`⚠️ Erro ao verificar usuário ${userDoc.id}:`, userError.message);
      }
    }
    
    console.log(`\n📊 Resumo:`);
    console.log(`  - Agendamentos verificados: ${totalChecked}`);
    console.log(`  - Loops corrigidos: ${fixedCount}`);
    
    if (fixedCount > 0) {
      console.log(`✅ ${fixedCount} agendamentos foram marcados como enviados para parar loops`);
    } else {
      console.log(`✅ Nenhum loop detectado nos agendamentos verificados`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar loops:', error);
  }
  
  process.exit(0);
}

fixEmailLoop();
