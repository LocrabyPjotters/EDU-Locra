/**
 * Locra Marketing Site Interactive Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // ─── Hero Interactive Demo Switcher ───
  const demoPrompts = {
    pythagoras: {
      question: "Kan je me helpen met de stelling van Pythagoras? Ik snap de formule a² + b² = c² niet.",
      answer: "Natuurlijk! Laten we het samen stap voor stap ontdekken. 📐<br><br>Stel je voor dat je een rechthoekige driehoek tekent op ruitjespapier. De twee korte zijden die aan de rechte hoek vastzitten noemen we <em>a</em> en <em>b</em>. Als je op beide zijden een vierkant tekent, is de totale oppervlakte van die twee vierkanten samen precies gelijk aan het vierkant op de langste zijde (<em>c</em>).<br><br><strong>Vraagje aan jou:</strong> Als zijde <em>a</em> = 3 en zijde <em>b</em> = 4, wat is dan 3² en wat is 4²?",
      tag: "Socratische Methode & Didactiek"
    },
    somtoday: {
      question: "Docent-assistent: Wat zijn de openstaande huiswerktaken voor klas 3B volgens SOMtoday?",
      answer: "📊 <strong>SOMtoday Koppeling Actief:</strong><br><br>Voor <strong>Klas 3B (Wiskunde)</strong> staan de volgende taken gepland:<br>• <em>Vrijdag 18 sept:</em> Opgaven 14 t/m 22 (Hfd 3: Goniometrie)<br>• <em>Dinsdag 22 sept:</em> Formatieve diagnostische toets<br><br>Gemiddeld cijfer klas op vorig hoofdstuk: <strong>6.8</strong> (3 leerlingen hebben extra remediëring nodig).",
      tag: "SOMtoday Live Integratie"
    },
    watermark: {
      question: "Controleer ingezonden essay 'De Industriële Revolutie' op Locra watermerk.",
      answer: "🔍 <strong>Watermerk Analyse Voltooid:</strong><br><br>• Status: <span style='color:#10b981;font-weight:700'>Geen Locra watermerk gedetecteerd (0%)</span>.<br>• Syntaxis-consistentie: 98% natuurlijk menselijk patroon.<br>• Bronvermeldingen: 4 geverifieerde historische bronnen aanwezig.<br><br><em>Conclusie docent: Dit werkstuk is zelfstandig door de leerling geschreven.</em>",
      tag: "Docenten Watermerk Detectie"
    },
    academy: {
      question: "Leerling: Hoe kan ik een goede prompt maken met het CLEAR-framework voor mijn geschiedenisverslag?",
      answer: "🎓 <strong>Locra Academy Didactiek:</strong><br><br>Super vraag! Laten we het CLEAR-model gebruiken:<br>• <strong>C (Context):</strong> De Koude Oorlog in Europa (klas 4)<br>• <strong>L (Lengte):</strong> 150 woorden met tussenkopjes<br>• <strong>E (Voorbeelden):</strong> Noem de Berlijnse Muur en de Cubacrisis<br>• <strong>A (Actief werkwoord):</strong> 'Vergelijk' in plaats van 'vertel iets over'<br>• <strong>R (Rol):</strong> Je bent een didactische geschiedenisleraar<br><br>💡 <em>Met deze gerichte aanpak bespaar je tevens tot 70% rekenkracht en CO₂-uitstoot!</em>",
      tag: "Locra Academy & AI-Geletterdheid"
    }
  };

  const chips = document.querySelectorAll('.demo-chip');
  const userBubble = document.getElementById('demo-user-bubble');
  const aiBubble = document.getElementById('demo-ai-bubble');
  const demoTag = document.getElementById('demo-tag');

  if (chips.length && userBubble && aiBubble) {
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const key = chip.dataset.demo;
        const data = demoPrompts[key];
        if (data) {
          userBubble.style.opacity = '0';
          aiBubble.style.opacity = '0';
          setTimeout(() => {
            userBubble.textContent = data.question;
            aiBubble.innerHTML = data.answer;
            if (demoTag) demoTag.textContent = data.tag;
            userBubble.style.opacity = '1';
            aiBubble.style.opacity = '1';
          }, 200);
        }
      });
    });
  }

  // ─── FAQ Accordions ───
  const faqQuestions = document.querySelectorAll('.faq-item-header');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
});
