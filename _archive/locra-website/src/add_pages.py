import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-website/src/pages'

pages = {
    'Platform.tsx': """import React from 'react'

export default function Platform() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>Het Platform</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Ontdek de modulaire opbouw van Locra.</p>
    </div>
  )
}
""",
    'CodeMatch.tsx': """import React from 'react'

export default function CodeMatch() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>CodeMatch Workspace</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>De ultieme in-browser IDE aangedreven door AI.</p>
    </div>
  )
}
""",
    'Security.tsx': """import React from 'react'

export default function Security() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>Privacy & Security</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Volledig lokaal. Geen data naar externe partijen.</p>
    </div>
  )
}
""",
    'Enroll.tsx': """import React from 'react'

export default function Enroll() {
  return (
    <div style={{ paddingTop: '120px', minHeight: '80vh', textAlign: 'center' }}>
      <h1>Vraag een Demo Aan</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Neem contact op voor een op maat gemaakte licentie.</p>
    </div>
  )
}
"""
}

for filename, content in pages.items():
    with open(os.path.join(base_path, filename), 'w') as f:
        f.write(content)

app_tsx_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-website/src/App.tsx'
app_tsx_content = """import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Platform from './pages/Platform'
import CodeMatch from './pages/CodeMatch'
import Security from './pages/Security'
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
          <Route path="/codematch" element={<CodeMatch />} />
          <Route path="/security" element={<Security />} />
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

print("Added missing pages to locra-website")
