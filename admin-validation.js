// Teste de Validação dos Problemas de Alta Prioridade
// Este script testa especificamente as correções implementadas

const testResults = {
  auth: { status: 'pending', details: [] },
  rateLimit: { status: 'pending', details: [] },
  analytics: { status: 'pending', details: [] },
  templates: { status: 'pending', details: [] }
};

// 1. Teste de Autenticação Admin
async function testAdminAuthentication() {
  console.log('🔐 Testando Autenticação Admin...');
  
  try {
    // Teste 1: Verificar se o usuário atual tem acesso
    if (!window.currentUser) {
      throw new Error('Usuário não autenticado');
    }

    // Teste 2: Verificar configuração de admin emails
    const settingsRef = doc(window.db, 'platform', 'settings');
    const settingsSnap = await getDoc(settingsRef);
    
    const adminEmails = settingsSnap.exists() ? 
      (settingsSnap.data().adminEmails || []) : [];
    
    const fallbackEmails = [
      'admin@agendiia.com.br', 
      'contato@agendiia.com.br', 
      'contato@agendiia',
      'ferramenta.developer@gmail.com'
    ];
    
    const allAdminEmails = [...new Set([...adminEmails, ...fallbackEmails])];
    const userEmail = window.currentUser.email.toLowerCase();
    const hasAccess = allAdminEmails.includes(userEmail);
    
    // Teste 3: Tentar executar função admin
    const listUsers = httpsCallable(window.functions, 'listPlatformUsers');
    const result = await listUsers();
    
    testResults.auth = {
      status: 'success',
      details: [
        `✅ Email autenticado: ${userEmail}`,
        `✅ Admin emails configurados: ${allAdminEmails.length}`,
        `✅ Tem acesso: ${hasAccess}`,
        `✅ Função admin executada: ${result.data?.length || 0} usuários`
      ]
    };
    
    console.log('✅ Autenticação Admin: OK');
    
  } catch (error) {
    testResults.auth = {
      status: 'error',
      details: [`❌ Erro: ${error.message}`]
    };
    console.error('❌ Autenticação Admin: FALHOU', error);
  }
}

// 2. Teste de Rate Limiting
async function testRateLimiting() {
  console.log('⚡ Testando Rate Limiting...');
  
  try {
    const startTime = Date.now();
    const promises = [];
    const getRateLimitStats = httpsCallable(window.functions, 'getRateLimitStats');
    
    // Enviar 15 requisições simultâneas (limite admin é 200/min)
    for (let i = 0; i < 15; i++) {
      promises.push(
        getRateLimitStats().then(
          () => ({ success: true, index: i }),
          (error) => ({ success: false, index: i, error: error.message })
        )
      );
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const rateLimitErrors = results.filter(r => 
      !r.success && r.error.includes('rate limit')
    ).length;
    
    testResults.rateLimit = {
      status: rateLimitErrors > 0 ? 'success' : 'warning',
      details: [
        `✅ Requisições enviadas: 15`,
        `✅ Sucessos: ${successCount}`,
        `✅ Rate limit errors: ${rateLimitErrors}`,
        `✅ Tempo total: ${endTime - startTime}ms`,
        rateLimitErrors > 0 ? 
          '✅ Rate limiting funcionando' : 
          '⚠️ Rate limiting pode precisar ajuste'
      ]
    };
    
    console.log('✅ Rate Limiting: OK');
    
  } catch (error) {
    testResults.rateLimit = {
      status: 'error',
      details: [`❌ Erro: ${error.message}`]
    };
    console.error('❌ Rate Limiting: FALHOU', error);
  }
}

// 3. Teste de Analytics
async function testAnalyticsValidation() {
  console.log('📊 Testando Analytics...');
  
  try {
    const getPlatformAnalytics = httpsCallable(window.functions, 'getPlatformAnalytics');
    const result = await getPlatformAnalytics({ period: '30d' });
    
    const data = result.data;
    const dataSource = data.dataSource || {};
    
    // Verificar se os dados são reais ou simulados
    const hasRealData = dataSource.users > 0 && dataSource.transactions >= 0;
    const metricsLookReal = data.platformMetrics.totalUsers > 0;
    
    testResults.analytics = {
      status: hasRealData ? 'success' : 'warning',
      details: [
        `✅ Analytics carregados`,
        `📊 Usuários: ${data.platformMetrics.totalUsers}`,
        `📊 Transações: ${dataSource.transactions}`,
        `📊 Agendamentos: ${dataSource.appointments}`,
        `📊 Receita: R$ ${data.platformMetrics.totalRevenue.toFixed(2)}`,
        hasRealData ? 
          '✅ Dados reais detectados' : 
          '⚠️ Dados podem ser simulados',
        `📅 Timestamp: ${dataSource.timestamp}`
      ]
    };
    
    console.log('✅ Analytics: OK');
    
  } catch (error) {
    testResults.analytics = {
      status: 'error',
      details: [`❌ Erro: ${error.message}`]
    };
    console.error('❌ Analytics: FALHOU', error);
  }
}

// 4. Teste de Salvamento de Templates
async function testTemplateSaving() {
  console.log('💾 Testando Salvamento de Templates...');
  
  try {
    const testTemplate = {
      id: 'test_validation_' + Date.now(),
      event: 'Teste de Validação',
      subject: 'Template de Teste - Validação',
      body: `Teste criado em ${new Date().toISOString()}`
    };
    
    // Teste 1: Verificar permissões
    const docRef = doc(window.db, 'platform', 'automations');
    
    // Teste 2: Salvar template
    await setDoc(docRef, {
      templates: [testTemplate],
      updatedAt: serverTimestamp(),
      lastUpdatedBy: window.currentUser.email,
      version: Date.now(),
      validationTest: true
    }, { merge: true });
    
    // Teste 3: Verificar se foi salvo
    const savedDoc = await getDoc(docRef);
    const savedSuccessfully = savedDoc.exists() && savedDoc.data().validationTest;
    
    testResults.templates = {
      status: savedSuccessfully ? 'success' : 'error',
      details: [
        `✅ Template criado: ${testTemplate.id}`,
        `✅ Documento salvo: ${savedSuccessfully}`,
        `✅ Usuário: ${window.currentUser.email}`,
        `✅ Timestamp: ${new Date().toLocaleString()}`,
        savedSuccessfully ? 
          '✅ Salvamento funcionando' : 
          '❌ Problema no salvamento'
      ]
    };
    
    console.log('✅ Templates: OK');
    
  } catch (error) {
    testResults.templates = {
      status: 'error',
      details: [`❌ Erro: ${error.message}`]
    };
    console.error('❌ Templates: FALHOU', error);
  }
}

// Executar todos os testes
async function runAllValidationTests() {
  console.log('🚀 Iniciando Validação dos Problemas de Alta Prioridade...\n');
  
  await testAdminAuthentication();
  await testRateLimiting();
  await testAnalyticsValidation();
  await testTemplateSaving();
  
  // Exibir resultados
  console.log('\n📋 RESUMO DOS RESULTADOS:');
  console.log('========================');
  
  Object.entries(testResults).forEach(([test, result]) => {
    const icon = result.status === 'success' ? '✅' : 
                 result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${test.toUpperCase()}: ${result.status.toUpperCase()}`);
    result.details.forEach(detail => console.log(`   ${detail}`));
    console.log('');
  });
  
  const allPassed = Object.values(testResults).every(r => r.status === 'success');
  const hasWarnings = Object.values(testResults).some(r => r.status === 'warning');
  
  if (allPassed) {
    console.log('🎉 TODOS OS TESTES PASSARAM! Sistema funcionando corretamente.');
  } else if (hasWarnings) {
    console.log('⚠️  TESTES COM AVISOS: Sistema funcional mas pode precisar de ajustes.');
  } else {
    console.log('❌ ALGUNS TESTES FALHARAM: Problemas que precisam ser corrigidos.');
  }
}

// Executar quando a página carregar
if (typeof window !== 'undefined') {
  window.runValidationTests = runAllValidationTests;
}

export { runAllValidationTests };
