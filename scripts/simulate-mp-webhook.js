#!/usr/bin/env node
/*
  simulate-mp-webhook.js
  Envia uma notificação simulada do MercadoPago para o endpoint do webhook local ou remoto.

  Uso:
    node scripts/simulate-mp-webhook.js --url <WEBHOOK_URL> --id <PREFERENCE_ID> [--type payment|merchant_order] [--status approved|pending|failure]

  Exemplos:
    node scripts/simulate-mp-webhook.js --url http://localhost:5001/timevee-53a3c/us-central1/mercadoPagoWebhook --id 123456789 --type payment --status approved

  Notas:
  - Para testar localmente use o Firebase Emulator (functions) ou a URL da função deployada.
  - O script envia um POST com body similar ao que MercadoPago costuma enviar: { type, data: { id } }
*/

const args = require('minimist')(process.argv.slice(2));

const url = args.url || args.u;
const prefId = args.id || args.i;
const type = (args.type || 'payment');
const status = (args.status || 'approved');

if (!url || !prefId) {
  console.error('Parâmetros obrigatórios ausentes. Ex: --url <WEBHOOK_URL> --id <PREFERENCE_ID>');
  process.exit(1);
}

async function run() {
  try {
    const payload = {
      type,
      // Minimal data bag: MercadoPago usually posts an object with data.id
      data: { id: String(prefId) }
    };

    // Try to use global fetch (Node 18+) else fallback to node-fetch
    let fetchFn = global.fetch;
    if (!fetchFn) {
      try {
        fetchFn = (await import('node-fetch')).default;
      } catch (e) {
        console.error('Para Node <18 instale node-fetch: npm i node-fetch');
        process.exit(2);
      }
    }

    console.log(`Enviando simulação para ${url} -> type=${type} id=${prefId} status=${status}`);
    const resp = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    console.log('Status:', resp.status);
    console.log('Resposta:', text);
  } catch (err) {
    console.error('Erro ao enviar notificação de teste:', err);
    process.exit(3);
  }
}

run();
