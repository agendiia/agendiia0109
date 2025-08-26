Simulação de webhook MercadoPago

Este pequeno utilitário envia uma notificação HTTP simulada ao endpoint `mercadoPagoWebhook` para testar a lógica de finalização de reservas e atualização de appointments.

Requisitos
- Node 18+ (fetch global) ou instalar `node-fetch` (Node <18)

Instalação
- (opcional) npm i minimist

Uso
- Testando contra Emulador/URL local de funções:

```powershell
node scripts/simulate-mp-webhook.js --url http://localhost:5001/<SEU_PROJETO>/us-central1/mercadoPagoWebhook --id MP_PREF_ID --type payment --status approved
```

- Testando contra função deployada:

```powershell
node scripts/simulate-mp-webhook.js --url https://us-central1-<PROJETO>.cloudfunctions.net/mercadoPagoWebhook --id MP_PREF_ID --type payment --status approved
```

Observações
- O script envia um body simples: { type, data: { id } }. A função `mercadoPagoWebhook` do servidor tentará localizar uma `reservation` ou `appointment` com `mpPreferenceId == id`.
- Para coberturas mais realistas, adicione o valor do preferenceId que foi gravado em `appointments/{appointmentId}.mpPreferenceId` durante a criação da preferência.
- Se desejar, posso estender o script para também chamar a API do MercadoPago e simular payloads mais complexos (merchant_order, payments arrays).
