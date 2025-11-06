import { useEffect, useState } from 'react'
import { getDashboard, getPermitStats, getBidStats, getPropertyStats } from '../services/api'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [permitStats, setPermitStats] = useState(null)
  const [bidStats, setBidStats] = useState(null)
  const [propertyStats, setPropertyStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [dashRes, permitRes, bidRes, propRes] = await Promise.all([
        getDashboard(),
        getPermitStats(),
        getBidStats(),
        getPropertyStats()
      ])

      setDashboard(dashRes.data)
      setPermitStats(permitRes.data)
      setBidStats(bidRes.data)
      setPropertyStats(propRes.data)
      setError(null)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError('Failed to load dashboard data. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Error</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of contractor opportunities in your area</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Permits"
          value={permitStats?.total_permits?.toLocaleString() || 0}
          subtitle={`${permitStats?.recent_permits_30_days || 0} in last 30 days`}
          icon="📋"
        />
        <StatCard
          title="Active Bids"
          value={bidStats?.active_bids?.toLocaleString() || 0}
          subtitle={`${bidStats?.opportunities || 0} opportunities`}
          icon="💼"
        />
        <StatCard
          title="Properties Tracked"
          value={propertyStats?.total_properties?.toLocaleString() || 0}
          subtitle={`${propertyStats?.opportunities || 0} opportunities`}
          icon="🏠"
        />
        <StatCard
          title="Total Opportunities"
          value={(
            (dashboard?.permits?.opportunities || 0) +
            (dashboard?.bids?.opportunities || 0) +
            (dashboard?.properties?.opportunities || 0)
          ).toLocaleString()}
          subtitle="AI-scored leads"
          icon="⭐"
        />
      </div>

      {/* Recent High-Value Permits */}
      <Card title="Recent High-Value Permits">
        {dashboard?.recent_high_value_permits?.length > 0 ? (
          <div className="space-y-3">
            {dashboard.recent_high_value_permits.map((permit) => (
              <div key={permit.id} className="border-l-4 border-primary-500 pl-4 py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{permit.address}</h3>
                    <p className="text-sm text-gray-600">{permit.city} - {permit.work_type}</p>
                    <p className="text-sm text-gray-500">Permit: {permit.permit_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      ${permit.project_value?.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(permit.issue_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No recent high-value permits found. Try running the scraper!</p>
        )}
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Permit Insights">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Average Project Value</span>
              <span className="font-semibold">
                ${permitStats?.average_project_value?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Opportunity Rate</span>
              <span className="font-semibold">
                {permitStats?.total_permits > 0
                  ? Math.round((permitStats?.opportunities / permitStats?.total_permits) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </Card>

        <Card title="Bid Insights">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Average Bid Value</span>
              <span className="font-semibold">
                ${bidStats?.average_estimated_value?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Bids</span>
              <span className="font-semibold">{bidStats?.total_bids || 0}</span>
            </div>
          </div>
        </Card>

        <Card title="Property Insights">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Building Age</span>
              <span className="font-semibold">
                {propertyStats?.average_building_age || 0} years
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">With HOA</span>
              <span className="font-semibold">
                {propertyStats?.properties_with_hoa || 0}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Getting Started */}
      {(permitStats?.total_permits || 0) === 0 && (
        <Card title="Getting Started">
          <div className="text-center py-8">
            <p className="text-lg text-gray-600 mb-4">
              Welcome to Kypher! To get started, run the scraper to collect data from municipal sources.
            </p>
            <a
              href="/scraper"
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
            >
              Go to Scraper →
            </a>
          </div>
        </Card>
      )}
    </div>
  )
}

export default Dashboard
