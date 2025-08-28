const admin = require('firebase-admin');

// Initialize Firebase Admin (it should use the same project)
admin.initializeApp();
const db = admin.firestore();

async function createTestAppointment() {
  try {
    const testUserId = 'test-professional-123';
    const appointmentData = {
      clientName: 'Cliente Teste',
      clientEmail: 'cliente@teste.com',
      service: 'Consulta Teste',
      dateTime: admin.firestore.Timestamp.fromDate(new Date()),
      duration: 60,
      status: 'Agendado',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('Creating test professional profile...');
    // Create test professional profile with email
    await db.doc(`users/${testUserId}/profile/main`).set({
      name: 'Dr. Teste',
      email: 'profissional@teste.com'
    });
    console.log('Professional profile created');
    
    console.log('Creating test appointment...');
    // Create test appointment to trigger onAppointmentCreated
    const docRef = await db.collection('users').doc(testUserId).collection('appointments').add(appointmentData);
    console.log('Test appointment created with ID:', docRef.id);
    console.log('This should trigger onAppointmentCreated function');
    
    // Wait a bit for the function to execute
    console.log('Waiting 5 seconds for function execution...');
    setTimeout(() => {
      console.log('Check Firebase Console Logs for onAppointmentCreated messages');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('Error creating test appointment:', error);
    process.exit(1);
  }
}

createTestAppointment();
