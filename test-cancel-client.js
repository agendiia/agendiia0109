// Teste simples para verificar a chamada da função cancelStripeSubscription
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const config = {
  apiKey: "AIzaSyDle5HF4ylU2K1_wGUS4odwk-RDcWHNp1M",
  authDomain: "timevee-53a3c.firebaseapp.com",
  projectId: "timevee-53a3c",
  storageBucket: "timevee-53a3c.appspot.com",
  messagingSenderId: "628542376232",
  appId: "1:628542376232:web:b1512d940c837370b3e81d"
};

const app = initializeApp(config);
const functions = getFunctions(app);

async function testCancelFunction() {
  console.log('🧪 Testando cancelamento direto via cliente Firebase...');
  
  try {
    // Chamar a função exatamente como o frontend faz
    const callable = httpsCallable(functions, 'cancelStripeSubscription');
    const result = await callable({ cancelAtPeriodEnd: true, reason: 'trial_cancel' });
    
    console.log('✅ Função executada com sucesso!');
    console.log('📊 Resultado:', result.data);
    
  } catch (error) {
    console.error('❌ Erro ao chamar função:');
    console.error('📋 Código:', error.code);
    console.error('📝 Mensagem:', error.message);
    console.error('🔍 Detalhes:', error.details);
    console.error('📦 Erro completo:', error);
  }
}

testCancelFunction();
