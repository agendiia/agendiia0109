const admin = require('firebase-admin');

// Script para testar envio direto de e-mail para profissional
async function testProfessionalEmail() {
  try {
    // Use environment variable for project ID
    process.env.GOOGLE_CLOUD_PROJECT = 'timevee-53a3c';
    
    admin.initializeApp({
      projectId: 'timevee-53a3c'
    });

    const db = admin.firestore();
    
    console.log('Criando agendamento de teste...');
    
    const testUserId = `test-prof-${Date.now()}`;
    
    // Create professional profile with email
    await db.doc(`users/${testUserId}/profile/main`).set({
      name: 'Dr. Teste Profissional',
      email: 'profissional@teste.com'
    });
    console.log('✅ Profile do profissional criado');
    
    // Create appointment to trigger onAppointmentCreated
    const appointmentData = {
      clientName: 'Cliente de Teste',
      clientEmail: 'cliente@teste.com',
      service: 'Consulta de Teste',
      dateTime: admin.firestore.Timestamp.now(),
      duration: 60,
      status: 'Agendado',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection(`users/${testUserId}/appointments`).add(appointmentData);
    console.log('✅ Agendamento criado:', docRef.id);
    console.log('📧 Isso deve disparar onAppointmentCreated e enviar e-mails para cliente E profissional');
    console.log('🔍 Verifique os logs em alguns segundos para ver se ambos os e-mails foram enviados');
    
    // Wait a bit for function execution
    setTimeout(() => {
      console.log('\n📋 Para verificar logs:');
      console.log('npx firebase functions:log');
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testProfessionalEmail();
