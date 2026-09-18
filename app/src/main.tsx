import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './index.css'
import Shell from './components/Shell'
import Group from './pages/Group'
import Company from './pages/Company'
import CashPath from './pages/CashPath'
import Plan from './pages/Plan'
import Alerts from './pages/Alerts'
import { GROUP_ID } from './data'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to={`/g/${GROUP_ID}`} replace />} />
        <Route path="/g/:gid" element={<Shell />}>
          <Route index element={<Group />} />
          <Route path="alertas" element={<Alerts />} />
          <Route path="c/:id" element={<Company />} />
          <Route path="c/:id/caja" element={<CashPath />} />
          <Route path="c/:id/plan/:goalId" element={<Plan />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)
