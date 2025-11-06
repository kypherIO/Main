import { useEffect, useState } from 'react'
import { getBids } from '../services/api'
import Card from '../components/Card'

const Bids = () => {
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    city: '',
    status: '',
    category: '',
    opportunities_only: false,
    active_only: false
  })

  useEffect(() => {
    loadBids()
  }, [filters])

  const loadBids = async () => {
    try {
      setLoading(true)
      const response = await getBids(filters)
      setBids(response.data.items)
    } catch (error) {
      console.error('Failed to load bids:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const getDaysUntilDue = (dueDate) => {
    const days = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24))
    return days
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Municipal Bids & RFPs</h1>
        <p className="text-gray-600 mt-1">Discover bidding opportunities from local governments</p>
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
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
            <option value="Awarded">Awarded</option>
          </select>
          <input
            type="text"
            placeholder="Category"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.active_only}
              onChange={(e) => handleFilterChange('active_only', e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Active Only</span>
          </label>
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

      {/* Bids List */}
      <Card title={`Bids (${bids.length})`}>
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading bids...</div>
        ) : bids.length > 0 ? (
          <div className="space-y-4">
            {bids.map((bid) => {
              const daysUntilDue = getDaysUntilDue(bid.due_date)
              return (
                <div key={bid.id} className="border-l-4 border-primary-500 pl-4 py-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-gray-900">{bid.title}</h3>
                        {bid.is_opportunity && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                            ⭐ Opportunity
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {bid.city}, {bid.state} | {bid.category}
                      </p>
                      <p className="text-sm text-gray-500">
                        Bid #{bid.bid_number} | {bid.agency_name}
                      </p>
                      <div className="mt-2 flex items-center space-x-4 text-sm">
                        <span className="text-gray-600">
                          Posted: {new Date(bid.posted_date).toLocaleDateString()}
                        </span>
                        {bid.status === 'Open' && (
                          <span className={`font-semibold ${
                            daysUntilDue <= 7 ? 'text-red-600' :
                            daysUntilDue <= 14 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            Due in {daysUntilDue} days
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {bid.estimated_value && (
                        <p className="font-bold text-green-600">${bid.estimated_value.toLocaleString()}</p>
                      )}
                      {bid.opportunity_score && (
                        <p className="text-sm text-gray-600">Score: {bid.opportunity_score.toFixed(1)}</p>
                      )}
                      <span className={`inline-block px-2 py-1 text-xs rounded mt-1 ${
                        bid.status === 'Open' ? 'bg-green-100 text-green-800' :
                        bid.status === 'Awarded' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {bid.status}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            No bids found. Try adjusting your filters or run the scraper to collect data.
          </div>
        )}
      </Card>
    </div>
  )
}

export default Bids
