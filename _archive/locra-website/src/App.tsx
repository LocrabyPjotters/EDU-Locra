import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
