import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Console from './pages/Console'
import Door from './pages/Door'
import Home from './pages/Home'
// The simulator pulls in the barcode renderer; load it only when needed.
const Sim = lazy(() => import('./pages/Sim'))
const Eval = lazy(() => import('./pages/Eval'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Console />} />
        <Route path="/home" element={<Home />} />
        <Route path="/door" element={<Door />} />
        <Route path="/sim" element={<Suspense fallback={null}><Sim /></Suspense>} />
        <Route path="/eval" element={<Suspense fallback={null}><Eval /></Suspense>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
