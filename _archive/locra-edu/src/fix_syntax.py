import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu/src/pages'

files_to_fix = ['Academy.tsx', 'Docs.tsx', 'Workshop.tsx', 'Download.tsx']

for filename in files_to_fix:
    path = os.path.join(base_path, filename)
    with open(path, 'r') as f:
        content = f.read()
    
    # Python format() reduced {{}} to {} which broke React's style prop.
    # We replace the bad style prop with the correct double-bracketed one.
    content = content.replace(
        "style={ paddingTop: '120px', paddingBottom: '4rem' }",
        "style={{ paddingTop: '120px', paddingBottom: '4rem' }}"
    )
    content = content.replace(
        "style={ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', textAlign: 'center' }",
        "style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', textAlign: 'center' }}"
    )
    
    with open(path, 'w') as f:
        f.write(content)

print("Fixed React style prop syntax errors.")
