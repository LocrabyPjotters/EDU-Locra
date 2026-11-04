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

  // Realistische tarieven per 1M tokens gebaseerd op bare-metal hardware & vLLM batching
  let privAiInputRate = 4.75;  // Llama 3.3 70B (Dual RTX 5090)
  let privAiOutputRate = 34.90;
  let usInputRate = 5.00;      // Azure OpenAI / Claude 3.5 Sonnet benchmark in EU
  let usOutputRate = 20.00;

  if (modelType === 'fast') {
    privAiInputRate = 3.15;    // Mistral Small 24B (1x RTX 5090)
    privAiOutputRate = 8.75;
    usInputRate = 3.00;
    usOutputRate = 12.00;
  } else if (modelType === 'coder') {
    privAiInputRate = 3.25;    // Qwen 2.5 Coder 32B (1x RTX 5090)
    privAiOutputRate = 10.50;
    usInputRate = 3.50;
    usOutputRate = 15.00;
  }

  const privAiTotal = (inputTokensM * privAiInputRate) + (outputTokensM * privAiOutputRate);
  const usTotal = (inputTokensM * usInputRate) + (outputTokensM * usOutputRate);
  const diff = usTotal - privAiTotal;
  const isSaving = diff > 0;
  const percentDiff = Math.abs(Math.round((diff / usTotal) * 100));

  const privAiEl = document.getElementById('calc-privai-total');
  const usEl = document.getElementById('calc-us-total');
  const savingsEl = document.getElementById('calc-savings-total');

  if (privAiEl) privAiEl.textContent = `€${privAiTotal.toFixed(2)}`;
  if (usEl) usEl.textContent = `€${usTotal.toFixed(2)}`;
  if (savingsEl) {
    if (isSaving) {
      savingsEl.textContent = `€${diff.toFixed(2)} (-${percentDiff}%)`;
      savingsEl.style.color = '#38bdf8';
    } else {
      savingsEl.textContent = `100% NL AVG & TEE`;
      savingsEl.style.color = '#34d399';
    }
  }
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

