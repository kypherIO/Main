import { useEffect, useState } from 'react'
import { getMunicipalities, startScraping, getScraperStatus, getScrapeLogs } from '../services/api'
import Card from '../components/Card'

const Scraper = () => {
  const [municipalities, setMunicipalities] = useState([])
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadStatus, 5000) // Refresh status every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [muniRes, statusRes, logsRes] = await Promise.all([
        getMunicipalities(),
        getScraperStatus(),
        getScrapeLogs({ limit: 20 })
      ])

      setMunicipalities(muniRes.data.municipalities)
      setStatus(statusRes.data)
      setLogs(logsRes.data.items)
    } catch (error) {
      console.error('Failed to load scraper data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStatus = async () => {
    try {
      const statusRes = await getScraperStatus()
      setStatus(statusRes.data)

      // Reload logs if scraping is active
      if (statusRes.data.running_tasks > 0) {
        const logsRes = await getScrapeLogs({ limit: 20 })
        setLogs(logsRes.data.items)
      }
    } catch (error) {
      console.error('Failed to refresh status:', error)
    }
  }

  const handleStartScraping = async (municipalitySlug = null, dataType = null) => {
    try {
      setScraping(true)
      await startScraping({
        municipality_slug: municipalitySlug,
        data_type: dataType
      })

      alert('Scraping task started! Check the status below for progress.')

      // Reload status after a short delay
      setTimeout(loadStatus, 2000)
    } catch (error) {
      console.error('Failed to start scraping:', error)
      alert('Failed to start scraping. Check console for details.')
    } finally {
      setScraping(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600'
      case 'running': return 'text-blue-600'
      case 'failed': return 'text-red-600'
      case 'partial': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      success: 'bg-green-100 text-green-800',
      running: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      partial: 'bg-yellow-100 text-yellow-800',
      queued: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading scraper...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Web Scraper</h1>
        <p className="text-gray-600 mt-1">Collect data from municipal sources</p>
      </div>

      {/* Status Overview */}
      <Card title="Scraper Status">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Running Tasks</p>
            <p className="text-3xl font-bold text-blue-600">{status?.running_tasks || 0}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Active Municipalities</p>
            <p className="text-3xl font-bold text-green-600">
              {municipalities.filter(m => m.permits_enabled || m.bids_enabled || m.properties_enabled).length}
            </p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">Recent Logs</p>
            <p className="text-3xl font-bold text-purple-600">{logs.length}</p>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleStartScraping(null, 'permits')}
            disabled={scraping}
            className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
          >
            📋 Scrape All Permits
          </button>
          <button
            onClick={() => handleStartScraping(null, 'bids')}
            disabled={scraping}
            className="px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold"
          >
            💼 Scrape All Bids
          </button>
          <button
            onClick={() => handleStartScraping()}
            disabled={scraping}
            className="px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
          >
            🔄 Scrape Everything
          </button>
        </div>
      </Card>

      {/* Municipalities */}
      <Card title="Municipalities">
        <div className="space-y-3">
          {municipalities.map((muni) => (
            <div key={muni.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{muni.name}</h3>
                  <p className="text-sm text-gray-600">
                    {muni.distance_from_base} miles from base
                  </p>
                  <div className="flex space-x-2 mt-2">
                    {muni.permits_enabled && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        Permits
                      </span>
                    )}
                    {muni.bids_enabled && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                        Bids
                      </span>
                    )}
                    {muni.properties_enabled && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Properties
                      </span>
                    )}
                  </div>
                  {muni.last_scraped_at && (
                    <p className="text-xs text-gray-500 mt-2">
                      Last scraped: {new Date(muni.last_scraped_at).toLocaleString()}
                      {muni.last_scrape_status && (
                        <span className={`ml-2 ${getStatusColor(muni.last_scrape_status)}`}>
                          ({muni.last_scrape_status})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm text-gray-600 mb-2">
                    {muni.total_permits > 0 && <div>Permits: {muni.total_permits}</div>}
                    {muni.total_bids > 0 && <div>Bids: {muni.total_bids}</div>}
                    {muni.total_properties > 0 && <div>Properties: {muni.total_properties}</div>}
                  </div>
                  <button
                    onClick={() => handleStartScraping(muni.slug)}
                    disabled={scraping}
                    className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:bg-gray-400"
                  >
                    Scrape Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Running Tasks */}
      {status?.running_tasks > 0 && (
        <Card title="Running Tasks">
          <div className="space-y-2">
            {status.running.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <span className="font-semibold text-blue-900">
                    Municipality #{task.municipality_id} - {task.data_type}
                  </span>
                  <p className="text-sm text-blue-700">
                    Started: {new Date(task.started_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-blue-600 font-semibold">
                  {task.items_found} items found
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Scrape Logs */}
      <Card title="Recent Scrape Logs">
        <div className="space-y-2">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="border-l-4 border-gray-300 pl-4 py-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded font-semibold ${getStatusBadge(log.status)}`}>
                        {log.status}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        Municipality #{log.municipality_id} - {log.data_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(log.started_at).toLocaleString()}
                      {log.duration_seconds && ` - ${log.duration_seconds}s`}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                    )}
                  </div>
                  <div className="text-right text-sm ml-4">
                    {log.items_new > 0 && <div className="text-green-600">{log.items_new} new</div>}
                    {log.items_updated > 0 && <div className="text-blue-600">{log.items_updated} updated</div>}
                    {log.items_failed > 0 && <div className="text-red-600">{log.items_failed} failed</div>}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No scrape logs yet</p>
          )}
        </div>
      </Card>

      {/* Important Notice */}
      <Card>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Important Notes</h3>
          <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
            <li>Scraping respects robots.txt and includes delays to avoid overloading servers</li>
            <li>Some municipalities may require API keys or have restricted access</li>
            <li>You may need to configure scraper selectors for specific municipalities</li>
            <li>Always ensure compliance with each website's terms of service</li>
            <li>This is a proof of concept - production use requires proper configuration</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

export default Scraper
