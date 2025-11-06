import { useEffect, useState } from 'react'
import { getProperties } from '../services/api'
import Card from '../components/Card'

const Properties = () => {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    city: '',
    min_age: '',
    max_age: '',
    has_hoa: '',
    opportunities_only: false,
    min_score: ''
  })

  useEffect(() => {
    loadProperties()
  }, [filters])

  const loadProperties = async () => {
    try {
      setLoading(true)
      const cleanFilters = {}
      Object.keys(filters).forEach(key => {
        if (filters[key] !== '' && filters[key] !== false) {
          cleanFilters[key] = filters[key]
        }
      })
      const response = await getProperties(cleanFilters)
      setProperties(response.data.items)
    } catch (error) {
      console.error('Failed to load properties:', error)
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
        <h1 className="text-3xl font-bold text-gray-900">Properties</h1>
        <p className="text-gray-600 mt-1">Property data and remodeling opportunities</p>
      </div>

      {/* Filters */}
      <Card title="Filters">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input
            type="text"
            placeholder="City"
            value={filters.city}
            onChange={(e) => handleFilterChange('city', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <input
            type="number"
            placeholder="Min Age (years)"
            value={filters.min_age}
            onChange={(e) => handleFilterChange('min_age', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <input
            type="number"
            placeholder="Max Age (years)"
            value={filters.max_age}
            onChange={(e) => handleFilterChange('max_age', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <select
            value={filters.has_hoa}
            onChange={(e) => handleFilterChange('has_hoa', e.target.value === 'true')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All HOA Status</option>
            <option value="true">Has HOA</option>
            <option value="false">No HOA</option>
          </select>
          <input
            type="number"
            placeholder="Min Score"
            value={filters.min_score}
            onChange={(e) => handleFilterChange('min_score', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
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

      {/* Properties List */}
      <Card title={`Properties (${properties.length})`}>
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading properties...</div>
        ) : properties.length > 0 ? (
          <div className="space-y-4">
            {properties.map((property) => (
              <div key={property.id} className="border-l-4 border-primary-500 pl-4 py-3 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">{property.address}</h3>
                      {property.is_opportunity && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                          ⭐ Opportunity
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {property.city}, {property.state} {property.zip_code}
                    </p>
                    <p className="text-sm text-gray-500">
                      Parcel: {property.parcel_id}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Built:</span> {property.year_built} ({property.building_age} years old)
                      </div>
                      <div>
                        <span className="text-gray-600">Type:</span> {property.property_type}
                      </div>
                      <div>
                        <span className="text-gray-600">Size:</span> {property.square_footage?.toLocaleString()} sq ft
                      </div>
                      <div>
                        <span className="text-gray-600">Owner:</span> {property.owner_name}
                      </div>
                      {property.has_hoa && (
                        <div>
                          <span className="text-gray-600">HOA:</span> {property.hoa_name || 'Yes'}
                        </div>
                      )}
                      {property.recent_permits > 0 && (
                        <div>
                          <span className="text-gray-600">Recent Permits:</span> {property.recent_permits}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {property.assessed_value && (
                      <p className="font-bold text-green-600">${property.assessed_value.toLocaleString()}</p>
                    )}
                    {property.opportunity_score && (
                      <p className="text-sm text-gray-600">Score: {property.opportunity_score.toFixed(1)}/100</p>
                    )}
                    {property.building_age >= 30 && (
                      <span className="inline-block px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded mt-1">
                        {property.building_age}+ years old
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            No properties found. Try adjusting your filters or run the scraper to collect data.
          </div>
        )}
      </Card>
    </div>
  )
}

export default Properties
