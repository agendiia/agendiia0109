// Teste simples da função cancelStripeSubscription
const admin = require('firebase-admin');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { initializeApp } = require('firebase/app');

const firebaseConfig = {
  projectId: "timevee-53a3c",
  // Adicione outras configurações se necessário
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

async function testCancelFunction() {
  try {
    console.log('Testando função cancelStripeSubscription...');
    
    const cancelFunction = httpsCallable(functions, 'cancelStripeSubscription');
    
    // Simular chamada como um usuário trial (sem stripeCustomerId)
    const result = await cancelFunction({ 
      cancelAtPeriodEnd: true, 
      reason: 'trial_cancel' 
    });
    
    console.log('Resultado:', result.data);
  } catch (error) {
    console.error('Erro ao testar função:', error);
    console.error('Error details:', error.details);
  }
}

testCancelFunction();
