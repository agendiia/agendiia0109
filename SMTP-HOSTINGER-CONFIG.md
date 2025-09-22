# 📧 Configuração SMTP Hostinger - Agendiia

## ✅ Implementação Concluída

O sistema agora está configurado para usar exclusivamente SMTP do Hostinger como método de envio de e-mails.

## 🔧 Configuração Necessária no Firestore

### 1. Documento Principal: `platform_settings/smtp`

Acesse o Firebase Console → Firestore Database e crie o documento com os seguintes campos:

```json
{
  "host": "smtp.hostinger.com",
  "port": 587,
  "secure": false,
  "user": "contato@agendiia.com.br",
  "pass": "sua_senha_do_email",
  "fromName": "Agendiia",
  "fromEmail": "contato@agendiia.com.br"
}
```

### 2. Configurações SMTP Hostinger

**Servidor SMTP:** smtp.hostinger.com  
**Porta:** 587 (recomendada) ou 465  
**Segurança:** STARTTLS (porta 587) ou SSL/TLS (porta 465)  
**Autenticação:** Sim (usuário e senha)

### 3. Providers

Não há fallback externo configurado. Toda a entrega é feita via SMTP.

## 🚀 Funcionalidades que Usam E-mail

1. **✉️ Confirmação de Agendamento** - Enviado automaticamente quando cliente agenda
2. **👋 Boas-vindas Profissional** - Enviado quando profissional cria conta  
3. **⏰ Lembretes 24h antes** - Enviado automaticamente antes de consultas
4. **📝 Atualizações de Agendamento** - Quando agendamento é modificado
5. **⚠️ Notificações de Trial** - Avisos sobre fim do período gratuito

## 🧪 Como Testar

### 1. Teste via Firebase Console
```javascript
// No Firebase Console → Functions → sendTransactionalEmail
{
  "toEmail": "seu_email@teste.com",
  "toName": "Seu Nome",
  "subject": "Teste SMTP Hostinger",
  "html": "<h1>Teste funcionando!</h1><p>E-mail enviado via SMTP Hostinger.</p>"
}
```

### 2. Teste via Agendamento
- Acesse a página pública de agendamentos
- Faça um agendamento teste
- Verifique se recebeu o e-mail de confirmação

## 🔍 Monitoramento e Logs

Os logs aparecerão no Firebase Console → Functions → Logs:

- ✅ `SMTP email sent: [messageId]` - Sucesso via SMTP
- ⚠️ `Erro SMTP: [erro]` - Problema com SMTP (verifique credenciais e DNS)

## 🛡️ Vantagens do SMTP Hostinger

- **✅ Controle Total** - Você controla o servidor de e-mail
- **✅ Melhor Entregabilidade** - E-mails enviados do seu domínio
- **✅ Sem Limites de API** - Não depende de quotas de terceiros
- **✅ Autenticação Automática** - SPF/DKIM configurados pelo Hostinger
- **✅ Custo Zero** - Incluído na hospedagem

## 📋 Próximos Passos

1. **Configurar SMTP** - Adicionar credenciais no Firestore `platform_settings/smtp`
2. **Testar Envio** - Usar função `sendTransactionalEmail`
3. **Verificar Logs** - Monitorar envios no Firebase Console

## 🔧 Estrutura do Código Atualizada

- **`sendEmailViaSMTP()`** - Implementação SMTP com nodemailer
- **`sendTransactionalEmail`** - Callable function para testes

---

**Status:** ✅ Implementado e pronto para configuração  
**Próximo:** Configurar credenciais SMTP no Firestore