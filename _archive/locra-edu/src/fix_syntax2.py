import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu/src/pages'

pages_info = {
    "Docs.tsx": {"name": "Docs", "title": "Documentatie & Kennisbank", "desc": "Ontdek handleidingen voor docenten, leerlingen en ICT-beheerders."},
    "Academy.tsx": {"name": "Academy", "title": "AI Geletterdheid", "desc": "Interactieve E-learning modules over prompting, deepfakes en ethiek."},
    "Workshop.tsx": {"name": "Workshop", "title": "Trainingen op maat", "desc": "Plan een in-house workshop voor uw docententeam (€1.250 per sessie)."},
    "Download.tsx": {"name": "Download", "title": "Desktop & Mobiel", "desc": "Download de standalone apps voor Windows, macOS en iOS/Android."}
}

template = """export default function {name}() {{
  return (
    <div className="page-content" style={{{{ paddingTop: '120px', paddingBottom: '4rem' }}}}>
      <div className="container" style={{{{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', textAlign: 'center' }}}}>
        <span className="overline">{name}</span>
        <h1 style={{{{ fontSize: '3rem', marginBottom: '1.5rem' }}}}>{title}</h1>
        <p style={{{{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}}}>{desc}</p>
      </div>
    </div>
  )
}}
"""

for filename, info in pages_info.items():
    content = template.format(name=info["name"], title=info["title"], desc=info["desc"])
    with open(os.path.join(base_path, filename), 'w') as f:
        f.write(content)

print("Fixed simple template pages.")
