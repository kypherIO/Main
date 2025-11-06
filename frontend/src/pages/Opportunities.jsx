import { useEffect, useState } from 'react'
import { getOpportunities } from '../services/api'
import Card from '../components/Card'

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState({ permits: [], bids: [], properties: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    loadOpportunities()
  }, [])

  const loadOpportunities = async () => {
    try {
      setLoading(true)
      const response = await getOpportunities({ limit: 50 })
      setOpportunities(response.data)
    } catch (error) {
      console.error('Failed to load opportunities:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAllOpportunities = () => {
    const all = [
      ...opportunities.permits.map(p => ({ ...p, type: 'permit' })),
      ...opportunities.bids.map(b => ({ ...b, type: 'bid' })),
      ...opportunities.properties.map(p => ({ ...p, type: 'property' }))
    ]
    return all.sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0))
  }

  const renderOpportunityCard = (item) => {
    if (item.type === 'permit') {
      return (
        <div key={`permit-${item.id}`} className="border-l-4 border-blue-500 pl-4 py-3 hover:bg-gray-50">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📋</span>
                <h3 className="font-semibold text-gray-900">{item.address}</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                  Permit
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{item.city} - {item.work_type}</p>
              <p className="text-sm text-gray-500">Owner: {item.owner_name}</p>
            </div>
            <div className="text-right ml-4">
              <p className="font-bold text-green-600">${item.project_value?.toLocaleString()}</p>
              <p className="text-sm font-semibold text-primary-600">
                Score: {item.opportunity_score?.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      )
    } else if (item.type === 'bid') {
      return (
        <div key={`bid-${item.id}`} className="border-l-4 border-purple-500 pl-4 py-3 hover:bg-gray-50">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xl">💼</span>
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                  Bid
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{item.city} - {item.agency_name}</p>
              <p className="text-sm text-gray-500">
                Due: {new Date(item.due_date).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="font-bold text-green-600">${item.estimated_value?.toLocaleString()}</p>
              <p className="text-sm font-semibold text-primary-600">
                Score: {item.opportunity_score?.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      )
    } else {
      return (
        <div key={`property-${item.id}`} className="border-l-4 border-green-500 pl-4 py-3 hover:bg-gray-50">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🏠</span>
                <h3 className="font-semibold text-gray-900">{item.address}</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                  Property
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {item.city} - {item.building_age} years old
              </p>
              <p className="text-sm text-gray-500">Owner: {item.owner_name}</p>
              {item.opportunity_reasons && (
                <p className="text-sm text-gray-600 mt-1">
                  {JSON.parse(item.opportunity_reasons)[0]}
                </p>
              )}
            </div>
            <div className="text-right ml-4">
              <p className="font-bold text-green-600">${item.assessed_value?.toLocaleString()}</p>
              <p className="text-sm font-semibold text-primary-600">
                Score: {item.opportunity_score?.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Top Opportunities</h1>
        <p className="text-gray-600 mt-1">AI-scored leads ranked by potential</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'All Opportunities', count: getAllOpportunities().length },
            { key: 'permits', label: 'Permits', count: opportunities.permits.length },
            { key: 'bids', label: 'Bids', count: opportunities.bids.length },
            { key: 'properties', label: 'Properties', count: opportunities.properties.length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Opportunities List */}
      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading opportunities...</div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'all' && getAllOpportunities().map(renderOpportunityCard)}
            {activeTab === 'permits' && opportunities.permits.map(p => renderOpportunityCard({ ...p, type: 'permit' }))}
            {activeTab === 'bids' && opportunities.bids.map(b => renderOpportunityCard({ ...b, type: 'bid' }))}
            {activeTab === 'properties' && opportunities.properties.map(p => renderOpportunityCard({ ...p, type: 'property' }))}

            {((activeTab === 'all' && getAllOpportunities().length === 0) ||
              (activeTab !== 'all' && opportunities[activeTab]?.length === 0)) && (
              <div className="text-center py-8 text-gray-600">
                No opportunities found yet. Run the scraper to discover leads!
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

export default Opportunities
