// Teste rápido das Cloud Functions com CORS
// Execute este script no console do navegador

console.log('🧪 TESTE DAS CLOUD FUNCTIONS COM CORS CORRIGIDO');
console.log('================================================');

// Função para testar uma Cloud Function específica
async function testFunction(functionName, testData = {}) {
    try {
        console.log(`\n🔄 Testando ${functionName}...`);
        
        if (!window.firebase || !window.firebase.functions) {
            console.error('❌ Firebase Functions não disponível');
            return;
        }
        
        const functions = window.firebase.functions();
        const callable = functions.httpsCallable(functionName);
        
        console.log(`📤 Enviando dados:`, testData);
        const result = await callable(testData);
        console.log(`✅ ${functionName} funcionou!`, result.data);
        return result.data;
        
    } catch (error) {
        console.error(`❌ Erro em ${functionName}:`, error);
        
        // Verificar se é erro de CORS especificamente
        if (error.message.includes('CORS') || error.message.includes('Access-Control')) {
            console.error('🚫 ERRO DE CORS DETECTADO! Recarregue a página em alguns segundos.');
        }
        
        return null;
    }
}

// Função principal de teste
async function testarTodasAsFuncoes() {
    console.log('🚀 Iniciando testes...\n');
    
    // 1. Teste toggleUserStatus (com dados inválidos para ver se rejeita)
    await testFunction('toggleUserStatus', { userId: 'test-user-id-123' });
    
    // 2. Teste updatePlatformUser (com dados inválidos para ver se rejeita)
    await testFunction('updatePlatformUser', { 
        userId: 'test-user-id-123', 
        userData: { name: 'Teste' } 
    });
    
    // 3. Teste deletePlatformUser (com dados inválidos para ver se rejeita)
    await testFunction('deletePlatformUser', { userId: 'test-user-id-123' });
    
    // 4. Teste forcePasswordReset (função existente para comparação)
    await testFunction('forcePasswordReset', { userId: 'test-user-id-123' });
    
    // 5. Teste impersonateUser (função existente para comparação)
    await testFunction('impersonateUser', { targetUserId: 'test-user-id-123' });
    
    console.log('\n🏁 Testes concluídos!');
    console.log('📋 Se todas as funções retornaram erro de permissão/validação (não CORS), então o CORS está funcionando!');
}

// Executar os testes
testarTodasAsFuncoes();

// Disponibilizar função para teste individual
window.testFunction = testFunction;
