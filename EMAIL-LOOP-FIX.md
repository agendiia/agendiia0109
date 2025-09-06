# Correção de Loop Infinito de E-mails

## Problema Identificado

**Data:** 05/09/2025  
**Severidade:** CRÍTICA ⚠️

O sistema estava enviando e-mails continuamente (mais de 150 e-mails) para cada agendamento criado através da página pública.

## Causa Raiz

As funções Firebase `onAppointmentCreated` e `onAppointmentUpdated` estavam criando um **loop infinito**:

1. Cliente faz agendamento → `onAppointmentCreated` é disparada
2. Função envia e-mail e atualiza documento com `confirmationEmailStatus: 'sent'`
3. Atualização do documento dispara `onAppointmentUpdated`
4. `onAppointmentUpdated` envia outro e-mail e atualiza `updateEmailStatus: 'sent'`
5. Nova atualização dispara `onAppointmentUpdated` novamente
6. **Loop infinito** continua...

## Solução Implementada

### 1. Prevenção de Loop em `onAppointmentCreated`

```typescript
// ANTI-LOOP: Check if confirmation emails were already sent
if (data.confirmationEmailStatus === 'sent' && data.professionalNotificationStatus === 'sent') {
  console.log(`[onAppointmentCreated] LOOP PREVENTION: Both confirmation emails already sent, skipping.`);
  return;
}
```

### 2. Prevenção de Loop em `onAppointmentUpdated`

```typescript
// ANTI-LOOP: Check if this update was caused by our own email status updates
const before = event.data?.before?.data() as any;
const hasNewEmailStatus = data.updateEmailStatus && (!before || before.updateEmailStatus !== data.updateEmailStatus);
const hasNewProfNotificationStatus = data.professionalNotificationStatus && (!before || before.professionalNotificationStatus !== data.professionalNotificationStatus);

if (hasNewEmailStatus || hasNewProfNotificationStatus) {
  console.log(`[onAppointmentUpdated] LOOP PREVENTION: Skipping execution because this update was triggered by email status change.`);
  return;
}

// Additional check: if both emails were already sent, skip
if (data.updateEmailStatus === 'sent' && data.professionalNotificationStatus === 'sent') {
  console.log(`[onAppointmentUpdated] LOOP PREVENTION: Both emails already sent, skipping.`);
  return;
}
```

## Deploy da Correção

```bash
firebase deploy --only functions
```

**Status:** ✅ Deploy concluído com sucesso

## Verificação e Monitoramento

### Logs para Monitorar
```bash
firebase functions:log | Select-String "LOOP PREVENTION"
```

### Script de Verificação
Criado `fix-email-loop.js` para:
- Identificar agendamentos que podem estar em loop
- Marcar status como 'sent' para parar loops em andamento
- Gerar relatório de correções aplicadas

## Prevenção Futura

### Boas Práticas Implementadas:
1. ✅ **Verificação de estado anterior**: Comparar `before` e `after` data
2. ✅ **Guards condicionais**: Verificar se ações já foram executadas  
3. ✅ **Logs de debug**: Identificar rapidamente quando prevenção é ativada
4. ✅ **Status tracking**: Usar campos específicos para rastrear envios

### Monitoramento Contínuo:
- Verificar logs regularmente para mensagens "LOOP PREVENTION"
- Alertas para múltiplos IDs de e-mail no mesmo documento
- Limitar quantidade de atualizações por documento por período

## Arquivos Modificados

- `functions/src/index.ts` - Funções `onAppointmentCreated` e `onAppointmentUpdated`
- `fix-email-loop.js` - Script de verificação e correção
- `EMAIL-LOOP-FIX.md` - Esta documentação

## Contato de Emergência

Se o problema persistir:
1. Verificar logs: `firebase functions:log`
2. Executar: `node fix-email-loop.js`
3. Em caso extremo: desabilitar as funções temporariamente

---
**Resolved:** 05/09/2025  
**Next Review:** Após próximo agendamento de teste
