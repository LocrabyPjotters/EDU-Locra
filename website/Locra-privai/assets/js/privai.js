/**
 * Locra PrivAI™ Interactive Client Scripts
 */

function switchTab(containerId, tabName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const buttons = container.querySelectorAll('.code-tab-item');
  const panes = container.querySelectorAll('.code-pane');

  buttons.forEach(btn => btn.classList.remove('active'));
  panes.forEach(pane => pane.style.display = 'none');

  const activeBtn = container.querySelector(`[data-tab="${tabName}"]`);
  const activePane = container.querySelector(`[data-pane="${tabName}"]`);

  if (activeBtn) activeBtn.classList.add('active');
  if (activePane) activePane.style.display = 'block';
}

function copyCode(buttonEl) {
  const wrapper = buttonEl.closest('.terminal-box, .code-block-wrapper');
  if (!wrapper) return;
  const codeEl = wrapper.querySelector('pre, code');
  if (!codeEl) return;

  const text = codeEl.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = buttonEl.textContent;
    buttonEl.textContent = '✓ Gekopieerd!';
    setTimeout(() => {
      buttonEl.textContent = originalText;
    }, 2000);
  });
}

// Token Cost Calculator
function updatePrivAICalculator() {
  const inputTokensM = parseFloat(document.getElementById('calc-input-tokens')?.value || '5');
  const outputTokensM = parseFloat(document.getElementById('calc-output-tokens')?.value || '10');
  const modelType = document.getElementById('calc-model')?.value || 'pro';

  document.getElementById('calc-input-display').textContent = `${inputTokensM.toFixed(1)}M`;
  document.getElementById('calc-output-display').textContent = `${outputTokensM.toFixed(1)}M`;

  // Pricing rates per 1M tokens
  let privAiInputRate = 1.80;
  let privAiOutputRate = 5.40;
  let usInputRate = 5.00; // GPT-4o / Claude Opus benchmark
  let usOutputRate = 15.00;

  if (modelType === 'fast') {
    privAiInputRate = 0.30;
    privAiOutputRate = 0.90;
    usInputRate = 0.60;
    usOutputRate = 2.40;
  } else if (modelType === 'coder') {
    privAiInputRate = 0.90;
    privAiOutputRate = 2.70;
    usInputRate = 3.00;
    usOutputRate = 10.00;
  }

  const privAiTotal = (inputTokensM * privAiInputRate) + (outputTokensM * privAiOutputRate);
  const usTotal = (inputTokensM * usInputRate) + (outputTokensM * usOutputRate);
  const savings = Math.max(0, usTotal - privAiTotal);
  const savingsPercent = Math.round((savings / usTotal) * 100);

  const privAiEl = document.getElementById('calc-privai-total');
  const usEl = document.getElementById('calc-us-total');
  const savingsEl = document.getElementById('calc-savings-total');

  if (privAiEl) privAiEl.textContent = `€${privAiTotal.toFixed(2)}`;
  if (usEl) usEl.textContent = `€${usTotal.toFixed(2)}`;
  if (savingsEl) savingsEl.textContent = `€${savings.toFixed(2)} (-${savingsPercent}%)`;
}

// Live Attestation Quote Simulation
function simulateAttestation() {
  const outputEl = document.getElementById('attestation-output');
  const btnEl = document.getElementById('btn-fetch-attestation');
  if (!outputEl) return;

  if (btnEl) btnEl.textContent = '⏳ Verifiëren met hardware...';

  setTimeout(() => {
    const quote = {
      status: "verified",
      timestamp: new Date().toISOString(),
      enclave: {
        type: "AMD-SEV-SNP",
        hardware_root_of_trust: "AMD Secure Processor Silicon Key (ASP)",
        measurement_hash: "3a8f9c2d1e0b5a7e9f4c6b8d2a1e3f5c7a9b0d2e4f6a8c0e2b4d6f8a0c2e4f6a",
        enclave_public_key: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VuAyEA9f8k2l1m4n7q0r3t6w9z2c5e8h1k4n7q0r3t6w9z2c4=\n-----END PUBLIC KEY-----",
        datacenter: {
          country: "NL",
          facility: "Equinix AM4 (Science Park), Amsterdam",
          jurisdiction: "Nederlands Recht & AVG / GDPR Art. 28/32"
        }
      },
      guarantees: {
        zero_retention_ram_scrub: true,
        host_memory_access_blocked: true,
        prompt_logging_disabled: true
      }
    };

    outputEl.textContent = JSON.stringify(quote, null, 2);
    if (btnEl) btnEl.textContent = '✓ Hardware Attestation Geverifieerd';
  }, 400);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('calc-input-tokens')) {
    updatePrivAICalculator();
  }
});
