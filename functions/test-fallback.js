const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

async function testFallback() {
  const db = admin.firestore();
  const now = new Date();
  const in23_5h = new Date(now.getTime() + 23.5 * 3600 * 1000);
  const in24_5h = new Date(now.getTime() + 24.5 * 3600 * 1000);
  
  const tsStart = admin.firestore.Timestamp.fromDate(in23_5h);
  const tsEnd = admin.firestore.Timestamp.fromDate(in24_5h);
  
  console.log('Testing collectionGroup query with time range:', tsStart.toDate().toISOString(), 'to', tsEnd.toDate().toISOString());
  
  try {
    const qs = await db.collectionGroup('appointments')
      .where('dateTime', '>=', tsStart)
      .where('dateTime', '<=', tsEnd)
      .get();
    console.log('✅ CollectionGroup query successful! Found', qs.size, 'appointments');
    if (qs.size > 0) {
      console.log('Sample appointment:', qs.docs[0].data());
    }
  } catch (e) {
    console.log('❌ CollectionGroup query failed:', e.message);
    console.log('Testing fallback approach...');
    
    try {
      const usersSnapshot = await db.collection('users').get();
      console.log('Found', usersSnapshot.size, 'users for fallback scan');
      
      let totalAppointments = 0;
      for (const userDoc of usersSnapshot.docs) {
        try {
          const userAppointments = await db.collection(`users/${userDoc.id}/appointments`)
            .where('dateTime', '>=', tsStart)
            .where('dateTime', '<=', tsEnd)
            .get();
          if (userAppointments.size > 0) {
            console.log(`User ${userDoc.id} has ${userAppointments.size} appointments in range`);
            totalAppointments += userAppointments.size;
          }
        } catch (userErr) {
          console.log(`Failed to query appointments for user ${userDoc.id}:`, userErr.message);
        }
      }
      console.log('✅ Fallback successful! Total appointments found:', totalAppointments);
    } catch (fallbackErr) {
      console.log('❌ Fallback also failed:', fallbackErr.message);
    }
  }
  
  process.exit(0);
}

testFallback().catch(console.error);
