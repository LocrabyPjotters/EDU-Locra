import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu/src/pages'

pages = {
    'Platform.tsx': """import React from 'react'

export default function Platform() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>Het Onderwijs Platform</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Socratisch leren en veilig werken in de klas.</p>
    </div>
  )
}
""",
    'Academy.tsx': """import React from 'react'

export default function Academy() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>Locra Academy</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>AI-geletterdheid voor leerlingen en docenten.</p>
    </div>
  )
}
""",
    'Security.tsx': """import React from 'react'

export default function Security() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>Privacy & Beleid</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Volledig lokaal. Jouw onderwijsdata blijft veilig.</p>
    </div>
  )
}
""",
    'Enroll.tsx': """import React from 'react'

export default function Enroll() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>Licentie Aanvragen</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Kies het juiste EDU-pakket voor uw school.</p>
    </div>
  )
}
""",
    'Pricing.tsx': """import React from 'react'

export default function Pricing() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>EDU Licenties</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Transparante prijzen voor scholen en besturen.</p>
    </div>
  )
}
""",
    'Docs.tsx': """import React from 'react'

export default function Docs() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>Installatie & Documentatie</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Stap voor stap handleidingen voor de netwerkbeheerder.</p>
    </div>
  )
}
"""
}

for filename, content in pages.items():
    with open(os.path.join(base_path, filename), 'w') as f:
        f.write(content)

app_tsx_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu/src/App.tsx'
app_tsx_content = """import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Platform from './pages/Platform'
import Academy from './pages/Academy'
import Security from './pages/Security'
import Pricing from './pages/Pricing'
import Docs from './pages/Docs'
import Enroll from './pages/Enroll'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/platform" element={<Platform />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/security" element={<Security />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/enroll" element={<Enroll />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}
"""

with open(app_tsx_path, 'w') as f:
    f.write(app_tsx_content)

print("Added missing pages to locra-edu")
