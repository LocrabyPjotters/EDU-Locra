document.addEventListener('DOMContentLoaded', () => {
  // Mobile Menu Toggle
  const menuToggle = document.getElementById('mobile-toggle');
  const nav = document.getElementById('main-nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      menuToggle.textContent = nav.classList.contains('open') ? '✕' : '☰';
    });
  }

  // FAQ Accordion
  const faqs = document.querySelectorAll('.faq-item');
  faqs.forEach(faq => {
    const q = faq.querySelector('.faq-q');
    if (q) {
      q.addEventListener('click', () => {
        const isActive = faq.classList.contains('active');
        faqs.forEach(f => f.classList.remove('active'));
        if (!isActive) {
          faq.classList.add('active');
        }
      });
    }
  });

  // Demo Tabs
  const demoChips = document.querySelectorAll('.chat-chip');
  const demoUser = document.getElementById('demo-user');
  const demoAi = document.getElementById('demo-ai');
  
  const scenarios = {
    'Socratisch leren': { user: 'Ik snap Pythagoras niet.', ai: 'Laten we samen kijken: welke zijden vormen de rechte hoek? Als die 3 en 4 zijn, wat is dan 3² + 4²?' },
    'SOMtoday': { user: 'Wat staat er deze week op mijn planning?', ai: 'Met een gekoppelde agenda kan Locra helpen je taken en planning overzichtelijk te maken.' },
    'Academy': { user: 'Hoe maak ik een goede prompt?', ai: 'Gebruik CLEAR: Context, Lengte, Examples, Actief werkwoord en Rol. Zullen we je opdracht samen scherp maken?' },
    'Watermerk': { user: 'Is deze tekst met AI gemaakt?', ai: 'Watermerkdetectie helpt docenten signalen te onderzoeken — altijd als onderdeel van een zorgvuldig gesprek.' }
  };

  demoChips.forEach(chip => {
    chip.addEventListener('click', () => {
      demoChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const scenario = scenarios[chip.textContent.trim()];
      if (scenario && demoUser && demoAi) {
        demoUser.textContent = scenario.user;
        demoAi.textContent = scenario.ai;
      }
    });
  });

  // Copy command
  const copyBtn = document.getElementById('copy-cmd-btn');
  const cmdCode = document.getElementById('auto-install-cmd');
  if (copyBtn && cmdCode) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(cmdCode.textContent);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ Gekopieerd';
      setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
    });
  }

  // OS switch
  const osBtns = document.querySelectorAll('.os-btn');
  const osHint = document.getElementById('os-hint');
  osBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      osBtns.forEach(b => {
        b.style.background = 'rgba(255,255,255,0.1)';
      });
      btn.style.background = '#5b7a6a';
      const os = btn.dataset.os;
      if (cmdCode && osHint) {
        if (os === 'linux') {
          cmdCode.textContent = 'curl -fsSL https://edu-locra.pieteroosterling.online/install-edu.sh | bash';
          osHint.textContent = 'Vereisten: Linux/macOS, Node.js ≥ 18, npm, unzip';
        } else {
          cmdCode.textContent = 'powershell -ExecutionPolicy Bypass -Command "irm https://edu-locra.pieteroosterling.online/install-edu.ps1 | iex"';
          osHint.textContent = '⚠️ Voer dit commando uit in cmd.exe of PowerShell als Administrator. Node.js ≥ 18 vereist.';
        }
      }
    });
  });
});
