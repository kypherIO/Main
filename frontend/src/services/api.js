import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Health & Status
export const getHealth = () => api.get('/health')
export const getStatus = () => api.get('/status')

// Permits
export const getPermits = (params = {}) => api.get('/permits/', { params })
export const getPermit = (id) => api.get(`/permits/${id}`)
export const getPermitStats = () => api.get('/permits/stats/summary')

// Bids
export const getBids = (params = {}) => api.get('/bids/', { params })
export const getBid = (id) => api.get(`/bids/${id}`)
export const getBidStats = () => api.get('/bids/stats/summary')

// Properties
export const getProperties = (params = {}) => api.get('/properties/', { params })
export const getProperty = (id) => api.get(`/properties/${id}`)
export const getPropertyStats = () => api.get('/properties/stats/summary')

// Analytics
export const getDashboard = () => api.get('/analytics/dashboard')
export const getPermitTrends = (params = {}) => api.get('/analytics/trends/permits', { params })
export const getOpportunities = (params = {}) => api.get('/analytics/insights/opportunities', { params })
export const getAgePermitCorrelation = () => api.get('/analytics/correlations/property-age-permits')
export const analyzeWithAI = (dataType, itemId) =>
  api.post('/analytics/analyze', null, { params: { data_type: dataType, item_id: itemId } })

// Scraper
export const startScraping = (data) => api.post('/scraper/start', data)
export const getScraperStatus = () => api.get('/scraper/status')
export const getScrapeLogs = (params = {}) => api.get('/scraper/logs', { params })
export const getMunicipalities = () => api.get('/scraper/municipalities')

export default api
