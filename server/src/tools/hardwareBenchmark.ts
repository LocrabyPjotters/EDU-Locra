#!/usr/bin/env node
/**
 * Locra Hardware & LLM Concurrency Capacity Benchmark Tester
 *
 * Dit script profileert de host hardware, analyseert model tiers (Licht, Gemiddeld, Zwaar),
 * simuleert realistische veelvoorkomende onderwijssituaties en berekent het exacte
 * geadviseerde concurrency limiet voor storingsvrij lesgebruik.
 */

import { benchmarkService } from '../services/benchmarkService';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bgBlue: '\x1b[44m',
};

async function main() {
  console.log('\n' + C.bold + C.cyan + '================================================================================' + C.reset);
  console.log(C.bold + C.blue + '  🎓 LOCRA HARDWARE & LLM CONCURRENCY BENCHMARK TESTER' + C.reset);
  console.log(C.dim + '  Berekening van hardware limieten, model tiers en klassikale capaciteit' + C.reset);
  console.log(C.bold + C.cyan + '================================================================================\n' + C.reset);

  console.log(C.yellow + '⚡ Bezig met analyseren van host hardware en rekenkracht...' + C.reset);
  const report = await benchmarkService.runFullBenchmark();
  const hw = report.hardware;

  // 1. Hardware Overzicht
  console.log('\n' + C.bold + '🖥️  HOST HARDWARE PROFIEL:' + C.reset);
  console.log(`   • Processor / SoC:   ${C.green}${hw.cpuModel}${C.reset} (${hw.logicalCores} Cores)`);
  console.log(`   • Besturingssysteem: ${hw.os} [${hw.arch}]`);
  console.log(`   • Werkgeheugen:      ${C.bold}${hw.totalRamGb} GB RAM${C.reset} (Waarvan ${hw.freeRamGb} GB direct beschikbaar)`);
  console.log(`   • Architectuur:      ${hw.isAppleSilicon ? C.magenta + 'Apple Silicon Unified Memory' : 'Standaard x86_64 / Discrete Bus'}${C.reset}`);
  console.log(`   • Geschatte Bandbr.: ${C.cyan}~${hw.estimatedMemoryBandwidthGbps} GB/s${C.reset}`);
  console.log(`   • Ollama Engine:     ${hw.ollamaAvailable ? C.green + 'Actief verbonden' : C.red + 'Niet lokaal actief'}${C.reset}`);
  if (hw.installedModels.length) {
    console.log(`   • Aanwezige modellen: ${C.dim}${hw.installedModels.slice(0, 5).join(', ')}${hw.installedModels.length > 5 ? ' (+' + (hw.installedModels.length - 5) + ' meer)' : ''}${C.reset}`);
  }

  // 2. Concurrency Degradatie curves per Model Tier
  console.log('\n' + C.bold + '📊 MODEL TIERS CAPACITEITSANALYSE:' + C.reset);
  console.log(C.dim + '   Hoe presteren lichte, gemiddelde en zware modellen onder gelijktijdige verzoeken?\n' + C.reset);

  for (const item of report.testedTiers) {
    const tier = item.tier;
    console.log(`   ${C.bold}▶ ${tier.label} ${C.dim}(${tier.paramRange})${C.reset}`);
    console.log(`     Geheugengebruik model: ${tier.weightRamGb} GB | KV-Cache per leerling: ~${tier.kvCachePerUserMb} MB`);
    console.log(`     Aanbevolen veilige concurrency: ${C.green}${C.bold}${item.maxSafeConcurrency} gelijktijdige streams${C.reset}`);
    
    // Mini tabel voor 1, 4, 8, 16 concurrency
    console.log(`     ${C.dim}Streams | Tok/sec p.p. | Totaal Tok/s | TTFT (ms) | Responstijd | RAM verbruik | Status${C.reset}`);
    console.log(`     ${C.dim}--------------------------------------------------------------------------------${C.reset}`);

    for (const step of item.concurrencyCurve.filter(s => [1, 2, 4, 8, 16].includes(s.concurrency))) {
      let statusColor = C.green;
      if (step.status === 'acceptable') statusColor = C.yellow;
      if (step.status === 'degraded') statusColor = C.magenta;
      if (step.status === 'overloaded') statusColor = C.red;

      const cStr = String(step.concurrency).padEnd(7);
      const tpsStr = (step.tokensPerSecPerStream + ' t/s').padEnd(12);
      const aggStr = (step.aggregateTokensPerSec + ' t/s').padEnd(12);
      const ttftStr = (step.timeToFirstTokenMs + ' ms').padEnd(10);
      const durStr = (step.totalDurationSec + ' s').padEnd(11);
      const ramStr = (step.totalRamUsedGb + ' GB').padEnd(12);
      const stStr = statusColor + step.status.toUpperCase() + C.reset;

      console.log(`     ${cStr} | ${tpsStr} | ${aggStr} | ${ttftStr} | ${durStr} | ${ramStr} | ${stStr}`);
    }
    console.log('');
  }

  // 3. Realistische School Scenarios
  console.log(C.bold + '🏫 VEELVOORKOMENDE PRAKTIJK SCENARIO\'S IN HET ONDERWIJS:' + C.reset);
  for (const s of report.scenarios) {
    console.log(`\n   ${C.bold}${s.title}${C.reset}`);
    console.log(`   ${C.dim}${s.description}${C.reset}`);
    console.log(`   • Leerlingen betrokken:   ${C.cyan}${s.studentCount}${C.reset}`);
    console.log(`   • Piekbelasting RAM:      ${s.peakRamUsedGb} GB`);
    console.log(`   • Gem. Responstijd:       ${s.avgResponseTimeSec} sec per antwoord`);
    console.log(`   • Max. Wachttijd wachtrij: ${s.maxWaitTimeSec > 0 ? C.yellow + s.maxWaitTimeSec + ' sec' : C.green + '0 sec (Direct)'}${C.reset}`);
    console.log(`   • Aanbevolen Concurrency: ${C.bold}${C.green}${s.recommendedConcurrencyCap} gelijktijdige verzoeken${C.reset}`);
  }

  // 4. Concreet Advies & Aanbevelingen
  const adv = report.advice;
  console.log('\n' + C.bold + C.bgBlue + ' 🎯 LOCRA HARDWARE ADVIESRAPPORT & AANBEVELINGEN ' + C.reset);
  console.log(`\n   ${C.bold}1. Aanbevolen Concurrency Limiet:${C.reset}`);
  console.log(`      Beperk Locra tot ${C.bold}${C.green}${adv.recommendedMaxConcurrency} gelijktijdige verzoeken${C.reset}.`);
  console.log(`      ${C.dim}Hierdoor blijft de responstijd voor elke leerling razendsnel en treden er geen haperingen op.${C.reset}`);

  console.log(`\n   ${C.bold}2. Wachtrij-instellingen (Queueing):${C.reset}`);
  console.log(`      Stel de wachtrij-timeout in op ${C.bold}${adv.recommendedQueueTimeoutSec} seconden${C.reset}.`);
  console.log(`      ${C.dim}Bij een plotselinge vraagbui (bijv. 30 leerlingen tegelijk) wachten overtollige verzoeken netjes in volgorde.${C.reset}`);

  console.log(`\n   ${C.bold}3. Klasgrootte & Gelijktijdige Capaciteit:${C.reset}`);
  console.log(`      • Comfortabele capaciteit:  ${C.green}${C.bold}tot ${adv.maxActiveStudentsComfortable} leerlingen${C.reset} continu in de les.`);
  console.log(`      • Absolute piekcapaciteit:  ${C.yellow}${C.bold}tot ${adv.maxActiveStudentsPeak} leerlingen${C.reset} met acceptabele wachtrij.`);

  console.log(`\n   ${C.bold}4. Aanbevolen Model voor jouw Machine:${C.reset}`);
  console.log(`      ${C.bold}${adv.optimalModelName}${C.reset}`);
  console.log(`      ${C.dim}Dit biedt het ideale evenwicht tussen didactische precisie (Socratische dialoog) en hoge verwerkingssnelheid.${C.reset}`);

  console.log(`\n   ${C.bold}5. Knelpunt Analyse:${C.reset}`);
  console.log(`      ${C.dim}${adv.bottleneckAnalysis}${C.reset}`);

  console.log(`\n   ${C.bold}6. Concrete Actiepunten:${C.reset}`);
  for (const item of adv.actionItems) {
    console.log(`      ${C.green}✓${C.reset} ${item}`);
  }

  console.log('\n' + C.bold + C.cyan + '================================================================================\n' + C.reset);
}

main().catch(err => {
  console.error('Fout bij uitvoeren van benchmark:', err);
  process.exit(1);
});
