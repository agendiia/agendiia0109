const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./functions/src/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'timevee-53a3c'
});

const db = admin.firestore();

async function testCancelFunction() {
  console.log('🧪 Testando função cancelStripeSubscription...');
  
  // Simular um usuário trial sem stripeCustomerId
  const testUserId = 'test_user_debug';
  
  try {
    // Criar usuário de teste
    await db.collection('users').doc(testUserId).set({
      email: 'test@example.com',
      subscription: {
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias no futuro
        plan: 'prof'
      }
      // Nota: SEM stripeCustomerId para simular usuário trial
    });
    
    console.log('✅ Usuário de teste criado');
    
    // Tentar cancelar a assinatura
    const functions = admin.functions();
    const cancelFunction = functions.httpsCallable('cancelStripeSubscription');
    
    const result = await cancelFunction.call(null, {}, {
      auth: {
        uid: testUserId
      }
    });
    
    console.log('✅ Resultado da função:', result);
    
    // Verificar o estado do usuário após cancelamento
    const userDoc = await db.collection('users').doc(testUserId).get();
    const userData = userDoc.data();
    
    console.log('✅ Estado do usuário após cancelamento:', userData);
    
  } catch (error) {
    console.error('❌ Erro ao testar função:', error.message);
    console.error('Detalhes do erro:', error);
  } finally {
    // Limpar usuário de teste
    try {
      await db.collection('users').doc(testUserId).delete();
      console.log('🧹 Usuário de teste removido');
    } catch (cleanupError) {
      console.warn('⚠️ Erro ao limpar teste:', cleanupError.message);
    }
  }
}

testCancelFunction().then(() => {
  console.log('🏁 Teste concluído');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro crítico no teste:', error);
  process.exit(1);
});
