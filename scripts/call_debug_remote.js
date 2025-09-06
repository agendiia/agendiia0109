(async () => {
  try {
    const url = 'https://us-central1-timevee-53a3c.cloudfunctions.net/debugSendDailyReminders';
    const payload = { data: { execute: false } };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // timeout not standardized in fetch; rely on default
    });
    const text = await res.text();
    console.log('HTTP_STATUS', res.status);
    try { const json = JSON.parse(text); console.log(JSON.stringify(json, null, 2)); }
    catch { console.log(text); }
  } catch (e) {
    console.error('CALL_ERROR', e && e.toString ? e.toString() : e);
    process.exit(1);
  }
})();
