import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Features from './pages/Features'
import Veiligheid from './pages/Veiligheid'
import Prijzen from './pages/Prijzen'
import Docs from './pages/Docs'
import Aanmelden from './pages/Aanmelden'
import Academy from './pages/Academy'
import Demo from './pages/Demo'
import Workshop from './pages/Workshop'
import Download from './pages/Download'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/veiligheid" element={<Veiligheid />} />
          <Route path="/prijzen" element={<Prijzen />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/aanmelden" element={<Aanmelden />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/onlinedemo" element={<Demo />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route path="/download" element={<Download />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
