import { useEffect, useState } from 'react'
import { getPermits } from '../services/api'
import Card from '../components/Card'

const Permits = () => {
  const [permits, setPermits] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    city: '',
    status: '',
    opportunities_only: false,
    min_value: '',
    days_recent: 30
  })

  useEffect(() => {
    loadPermits()
  }, [filters])

  const loadPermits = async () => {
    try {
      setLoading(true)
      const response = await getPermits(filters)
      setPermits(response.data.items)
    } catch (error) {
      console.error('Failed to load permits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Construction Permits</h1>
        <p className="text-gray-600 mt-1">Track building permits in your area</p>
      </div>

      {/* Filters */}
      <Card title="Filters">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="City"
            value={filters.city}
            onChange={(e) => handleFilterChange('city', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Expired">Expired</option>
          </select>
          <input
            type="number"
            placeholder="Min Value ($)"
            value={filters.min_value}
            onChange={(e) => handleFilterChange('min_value', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <select
            value={filters.days_recent}
            onChange={(e) => handleFilterChange('days_recent', parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="">All time</option>
          </select>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.opportunities_only}
              onChange={(e) => handleFilterChange('opportunities_only', e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Opportunities Only</span>
          </label>
        </div>
      </Card>

      {/* Permits List */}
      <Card title={`Permits (${permits.length})`}>
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading permits...</div>
        ) : permits.length > 0 ? (
          <div className="space-y-4">
            {permits.map((permit) => (
              <div key={permit.id} className="border-l-4 border-primary-500 pl-4 py-3 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">{permit.address}</h3>
                      {permit.is_opportunity && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                          ⭐ Opportunity
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {permit.city}, {permit.state} - {permit.work_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      Permit #{permit.permit_number} | Type: {permit.permit_type}
                    </p>
                    {permit.description && (
                      <p className="text-sm text-gray-600 mt-1">{permit.description}</p>
                    )}
                    {permit.owner_name && (
                      <p className="text-sm text-gray-500 mt-1">Owner: {permit.owner_name}</p>
                    )}
                    {permit.contractor_name && (
                      <p className="text-sm text-gray-500">Contractor: {permit.contractor_name}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    {permit.project_value && (
                      <p className="font-bold text-green-600">${permit.project_value.toLocaleString()}</p>
                    )}
                    {permit.opportunity_score && (
                      <p className="text-sm text-gray-600">Score: {permit.opportunity_score.toFixed(1)}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(permit.issue_date).toLocaleDateString()}
                    </p>
                    <span className={`inline-block px-2 py-1 text-xs rounded mt-1 ${
                      permit.status === 'Active' ? 'bg-green-100 text-green-800' :
                      permit.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {permit.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            No permits found. Try adjusting your filters or run the scraper to collect data.
          </div>
        )}
      </Card>
    </div>
  )
}

export default Permits
