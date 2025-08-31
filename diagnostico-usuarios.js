// Diagnóstico de Problemas - Página de Usuários
// Execute este script no console do navegador na página do admin

console.log('🔍 DIAGNÓSTICO DA PÁGINA DE USUÁRIOS');
console.log('===================================');

// 1. Verificar se o usuário está autenticado
console.log('1. 🔐 Verificando Autenticação...');
const auth = window.firebase?.auth();
if (auth && auth.currentUser) {
    console.log('✅ Usuário autenticado:', auth.currentUser.email);
    console.log('🆔 UID:', auth.currentUser.uid);
} else {
    console.error('❌ Usuário não autenticado');
}

// 2. Verificar conexão com Firestore
console.log('\n2. 🗄️ Verificando Firestore...');
try {
    const db = window.firebase?.firestore();
    if (db) {
        console.log('✅ Firestore conectado');
        // Tentar buscar usuários
        db.collection('users').limit(1).get()
            .then(snapshot => {
                console.log(`✅ Acesso à coleção 'users': ${snapshot.size} documento(s) encontrado(s)`);
            })
            .catch(error => {
                console.error('❌ Erro ao acessar coleção users:', error);
            });
    } else {
        console.error('❌ Firestore não disponível');
    }
} catch (error) {
    console.error('❌ Erro ao verificar Firestore:', error);
}

// 3. Verificar Cloud Functions
console.log('\n3. ☁️ Verificando Cloud Functions...');
try {
    const functions = window.firebase?.functions();
    if (functions) {
        console.log('✅ Functions conectado');
        
        // Testar cada função
        const functionsToTest = [
            'toggleUserStatus',
            'updatePlatformUser', 
            'deletePlatformUser',
            'forcePasswordReset',
            'impersonateUser'
        ];
        
        functionsToTest.forEach(funcName => {
            try {
                const callable = functions.httpsCallable(funcName);
                console.log(`✅ Função '${funcName}' disponível`);
            } catch (error) {
                console.error(`❌ Erro na função '${funcName}':`, error);
            }
        });
    } else {
        console.error('❌ Functions não disponível');
    }
} catch (error) {
    console.error('❌ Erro ao verificar Functions:', error);
}

// 4. Verificar elementos da UI
console.log('\n4. 🎨 Verificando Interface...');
const checkElement = (selector, name) => {
    const element = document.querySelector(selector);
    if (element) {
        console.log(`✅ ${name} encontrado`);
        return element;
    } else {
        console.error(`❌ ${name} não encontrado`);
        return null;
    }
};

// Verificar botões de ação
const editButtons = document.querySelectorAll('button[title="Editar"]');
const suspendButtons = document.querySelectorAll('button[title*="Suspender"], button[title*="Reativar"]');
const resetButtons = document.querySelectorAll('button[title*="reset"]');
const impersonateButtons = document.querySelectorAll('button[title*="Impersonar"]');
const deleteButtons = document.querySelectorAll('button[title="Excluir"]');

console.log(`📊 Botões encontrados:`);
console.log(`   ✏️ Editar: ${editButtons.length}`);
console.log(`   🔄 Suspender/Reativar: ${suspendButtons.length}`);
console.log(`   🔓 Reset Senha: ${resetButtons.length}`);
console.log(`   👤 Impersonar: ${impersonateButtons.length}`);
console.log(`   🗑️ Excluir: ${deleteButtons.length}`);

// 5. Verificar event listeners
console.log('\n5. 🎯 Verificando Event Listeners...');
if (editButtons.length > 0) {
    console.log('✅ Botões de edição encontrados');
    // Adicionar listener de teste
    editButtons[0].addEventListener('click', (e) => {
        console.log('🖱️ Clique no botão Editar detectado');
    }, { once: true });
}

// 6. Verificar estado da aplicação
console.log('\n6. 📊 Verificando Estado da Aplicação...');
try {
    // Verificar se existe React
    if (window.React) {
        console.log('✅ React carregado');
    } else {
        console.log('⚠️ React não detectado diretamente');
    }
    
    // Verificar se existe estado de usuários
    const userElements = document.querySelectorAll('td');
    const userCount = Math.floor(userElements.length / 8); // 8 colunas por usuário
    console.log(`👥 Aproximadamente ${userCount} usuários na tabela`);
    
} catch (error) {
    console.error('❌ Erro ao verificar estado:', error);
}

// 7. Verificar console para erros
console.log('\n7. 🐛 Verificando Erros no Console...');
console.log('⚠️ Verifique o console do navegador para erros de JavaScript');
console.log('⚠️ Procure por erros relacionados a:');
console.log('   - Firebase Auth');
console.log('   - Firestore permissions');
console.log('   - Cloud Functions');
console.log('   - Network requests');

// 8. Teste rápido de função
console.log('\n8. 🧪 Teste Rápido (se autenticado)...');
if (auth && auth.currentUser) {
    console.log('🚀 Para testar uma função específica, use:');
    console.log('   window.testUserFunction("FUNCTION_NAME", "USER_ID")');
    
    window.testUserFunction = async (functionName, userId) => {
        try {
            const functions = window.firebase.functions();
            const callable = functions.httpsCallable(functionName);
            const result = await callable({ userId });
            console.log(`✅ Teste de ${functionName}:`, result);
        } catch (error) {
            console.error(`❌ Erro no teste de ${functionName}:`, error);
        }
    };
}

console.log('\n✨ Diagnóstico concluído!');
console.log('📋 Verifique os resultados acima para identificar problemas.');
