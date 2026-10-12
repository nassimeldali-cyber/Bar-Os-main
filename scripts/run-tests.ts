/**
 * CLI Test Runner for BarLounge SaaS
 * Verifies the 15 critical scenarios from Section 31
 */

import { runAllTests } from '../src/lib/testRunner.ts';

async function main() {
  console.log('\n======================================================');
  console.log('🧪 BARLOUNGE SAAS — EXÉCUTION DU BANC DE TEST (15 TESTS)');
  console.log('======================================================\n');

  const result = await runAllTests();

  result.results.forEach((r) => {
    const symbol = r.passed ? '✅' : '❌';
    console.log(`${symbol} [${r.category}] ${r.title} (${r.durationMs}ms)`);
    console.log(`   ${r.details}\n`);
  });

  console.log('------------------------------------------------------');
  console.log(`TOTAL: ${result.total} | SUCCÈS: ${result.passed} | ÉCHECS: ${result.failed}`);
  console.log('------------------------------------------------------\n');

  if (result.failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 TOUS LES 15 TESTS ONT RÉUSSI AVEC SUCCÈS !');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
