/*
Safe Firestore migration: "Pago no Local" -> "Pago"

Usage (PowerShell):
  # dry-run (default)
  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"; node scripts/migrate-pago-no-local.js --dry-run

  # run the migration
  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"; node scripts/migrate-pago-no-local.js

Options:
  --dry-run       Print matched documents and counts but don't write changes.
  --limit=<N>     Limit how many documents to process (useful for testing). Default: no limit.

This script uses a collectionGroup query to find any subcollection named `appointments` or `reservations`
where the `paymentStatus` equals the legacy string `Pago no Local` and updates it to `Pago`.
It performs batched writes (500/docs per batch) and reports progress.
*/

const admin = require('firebase-admin');
const { argv } = require('process');

function parseArgs() {
  const args = { dryRun: false, limit: null };
  argv.slice(2).forEach(a => {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10) || null;
  });
  // default to dry-run true unless explicit --no-dry-run passed
  if (!argv.includes('--dry-run') && !argv.includes('--no-dry-run')) {
    args.dryRun = true;
  }
  if (argv.includes('--no-dry-run')) args.dryRun = false;
  return args;
}

async function initAdmin() {
  try {
    admin.initializeApp();
  } catch (e) {
    // already initialized
  }
  return admin.firestore();
}

async function processCollectionGroup(db, collectionGroup, args) {
  console.log(`\nScanning collectionGroup: ${collectionGroup}`);
  let query = db.collectionGroup(collectionGroup).where('paymentStatus', '==', 'Pago no Local');
  if (args.limit) query = query.limit(args.limit);
  const snapshot = await query.get();
  console.log(`Found ${snapshot.size} documents in ${collectionGroup} matching 'Pago no Local'.`);
  if (snapshot.empty) return { count: 0 };
  let count = 0;
  const updates = [];
  snapshot.forEach(doc => {
    count++;
  // Convert legacy 'Pago no Local' to canonical 'Pago'
  updates.push({ ref: doc.ref, data: { paymentStatus: 'Pago', updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
    if (count <= 10) {
      console.log(` - sample: ${doc.ref.path}`);
    }
  });

  if (args.dryRun) {
    console.log(`DRY RUN: Not applying ${count} updates for ${collectionGroup}.`);
    return { count };
  }

  // apply batched updates (chunked by 500)
  const chunks = [];
  for (let i = 0; i < updates.length; i += 500) chunks.push(updates.slice(i, i + 500));

  let applied = 0;
  for (const [i, chunk] of chunks.entries()) {
    const batch = db.batch();
    for (const u of chunk) batch.update(u.ref, u.data);
    await batch.commit();
    applied += chunk.length;
    console.log(`Committed batch ${i + 1}/${chunks.length} (${chunk.length} updates)`);
  }
  return { count: applied };
}

(async function main() {
  const args = parseArgs();
  console.log('Args:', args);
  if (args.dryRun) console.log('Running in DRY-RUN mode. To apply changes run with --no-dry-run.');

  try {
    const db = await initAdmin();
    const results = { appointments: 0, reservations: 0 };

    const apptRes = await processCollectionGroup(db, 'appointments', args);
    results.appointments = apptRes.count || 0;

    const resvRes = await processCollectionGroup(db, 'reservations', args);
    results.reservations = resvRes.count || 0;

    console.log('\nSummary:');
    console.log(` appointments matched: ${results.appointments}`);
    console.log(` reservations matched: ${results.reservations}`);
    if (!args.dryRun) console.log('Migration applied.');
    else console.log('Dry-run complete. No changes were made.');
  } catch (err) {
    console.error('Fatal error:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
