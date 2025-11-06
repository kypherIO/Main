import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Permits from './pages/Permits'
import Bids from './pages/Bids'
import Properties from './pages/Properties'
import Opportunities from './pages/Opportunities'
import Scraper from './pages/Scraper'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/permits" element={<Permits />} />
          <Route path="/bids" element={<Bids />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/scraper" element={<Scraper />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
