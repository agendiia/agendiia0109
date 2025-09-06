const functions = require('../functions/lib/index');

async function run() {
  try {
    const req = { data: { minutesFrom: 1410, minutesTo: 1470, execute: false }, auth: { uid: 'script-runner' } };
    console.log('Calling debugSendDailyReminders (dry-run)...');
    const res = await functions.debugSendDailyReminders(req);
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error running debug callable:', e);
  }
}

run();
