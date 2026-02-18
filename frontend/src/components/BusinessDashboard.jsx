import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Settings, Coins, Gift, Save, Users, TrendingUp, Plus, Eye, Edit, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function BusinessDashboard() {
  const { user, getAuthHeaders } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [settings, setSettings] = useState({
    pointsPerQuetzal: 1,
    experienceBonus: 20,
    minRedemption: 50,
    burnEnabled: true
  })
  const [customers, setCustomers] = useState([])
  const [offers, setOffers] = useState([])
  const [stats, setStats] = useState(null)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [transactionForm, setTransactionForm] = useState({
    customerEmail: '',
    amount: '',
    description: '',
    receiptNumber: ''
  })

  useEffect(() => {
    // Redirect non-business users
    if (user && user.role !== 'business') {
      if (user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/dashboard')
      }
      return
    }
    fetchProfile()
    fetchSettings()
    fetchBusinessData()
  }, [user, navigate])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      setProfile(data.user)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/business/settings', {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      if (data.success) {
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }
  
  const fetchBusinessData = async () => {
    try {
      // Fetch real business stats
      const statsRes = await fetch('/api/business/stats', {
        headers: getAuthHeaders()
      })
      const statsData = await statsRes.json()
      if (statsData.success) {
        setStats(statsData.stats)
      }
      
      // Fetch real customers
      const customersRes = await fetch('/api/business/customers', {
        headers: getAuthHeaders()
      })
      const customersData = await customersRes.json()
      if (customersData.success) {
        setCustomers(customersData.customers.map(cp => ({
          id: cp._id,
          name: cp.customerId?.email?.split('@')[0] || 'Unknown',
          email: cp.customerId?.email || 'Unknown',
          points: cp.currentBalance,
          visits: cp.totalVisits,
          spent: cp.totalSpent,
          lastVisit: cp.lastVisit
        })))
      }
      
      // Mock offers for now - will implement later
      setOffers([
        { id: 1, title: 'Café Gratis', cost: 100, active: true, redeemed: 0 },
        { id: 2, title: '15% Descuento', cost: 75, active: true, redeemed: 0 }
      ])
    } catch (error) {
      console.error('Error fetching business data:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/business/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(settings)
      })
      
      const data = await response.json()
      if (data.success) {
        toast.success('Configuración guardada exitosamente')
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }
  
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }
  
  const handleTransactionSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const response = await fetch('/api/business/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(transactionForm)
      })
      
      const data = await response.json()
      if (data.success) {
        toast.success(
          `¡Transacción registrada! Cliente ganó ${data.pointsEarned} puntos` +
          (data.isNewCustomer ? ` (incluyendo ${data.welcomeBonus} de bienvenida)` : '')
        )
        setTransactionForm({
          customerEmail: '',
          amount: '',
          description: '',
          receiptNumber: ''
        })
        setShowTransactionForm(false)
        // Refresh data
        fetchBusinessData()
      } else {
        toast.error(data.error || 'Error al registrar transacción')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">🇬🇹 {profile?.businessName || 'Mi Negocio'}</h1>
          <p className="text-gray-600 mt-2">
            Configuración de recompensas
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-blue-200 mb-8">
          <nav className="flex space-x-8 justify-center">
            {[
              { id: 'dashboard', label: 'Panel Principal', icon: TrendingUp },
              { id: 'customers', label: 'Mis Clientes', icon: Users },
              { id: 'offers', label: 'Ofertas', icon: Gift },
              { id: 'settings', label: 'Configuración', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-blue-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Coins className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Puntos Emitidos</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalPoints}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Ingresos (Q)</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalRevenue}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Gift className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Ofertas Activas</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeOffers}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Record Transaction */}
            <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 text-green-800">🛒 Registrar Venta</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <input
                  type="email"
                  placeholder="Email del cliente"
                  value={transactionForm.customerEmail}
                  onChange={(e) => setTransactionForm(prev => ({...prev, customerEmail: e.target.value}))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monto (Q)"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm(prev => ({...prev, amount: e.target.value}))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="text"
                  placeholder="Descripción"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm(prev => ({...prev, description: e.target.value}))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleTransactionSubmit}
                  disabled={saving || !transactionForm.customerEmail || !transactionForm.amount}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Registrando...' : 'Registrar Venta'}
                </button>
              </div>
              <p className="text-xs text-gray-600">
                El cliente ganará {settings.pointsPerQuetzal} punto{settings.pointsPerQuetzal > 1 ? 's' : ''} por cada quetzal gastado
              </p>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
              <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                  onClick={() => setActiveTab('offers')}
                  className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-left"
                >
                  <Gift className="w-8 h-8 text-blue-600 mb-2" />
                  <p className="font-medium">Crear Nueva Oferta</p>
                  <p className="text-sm text-gray-600">Agrega ofertas y promociones</p>
                </button>
                
                <button 
                  onClick={() => setActiveTab('customers')}
                  className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors text-left"
                >
                  <Users className="w-8 h-8 text-green-600 mb-2" />
                  <p className="font-medium">Ver Clientes</p>
                  <p className="text-sm text-gray-600">Gestiona tu base de clientes</p>
                </button>
                
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="p-4 border-2 border-yellow-200 rounded-lg hover:bg-yellow-50 transition-colors text-left"
                >
                  <Settings className="w-8 h-8 text-yellow-600 mb-2" />
                  <p className="font-medium">Configurar Recompensas</p>
                  <p className="text-sm text-gray-600">Ajusta puntos y bonificaciones</p>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'customers' && (
          <div className="bg-white rounded-lg shadow-sm border border-blue-200">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900">Base de Clientes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Puntos</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visitas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-blue-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{customer.name}</p>
                          <p className="text-sm text-gray-500">{customer.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                          {customer.points} pts
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{customer.visits}</td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-800">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="text-green-600 hover:text-green-800">
                            <Gift className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 'offers' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Gestión de Ofertas</h3>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nueva Oferta
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {offers.map((offer) => (
                <div key={offer.id} className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold text-lg">{offer.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      offer.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {offer.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">Costo: <span className="font-medium">{offer.cost} puntos</span></p>
                    <p className="text-sm text-gray-600">Canjeadas: <span className="font-medium">{offer.redeemed} veces</span></p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button className="flex-1 bg-blue-100 text-blue-700 py-2 px-3 rounded text-sm hover:bg-blue-200">
                      <Edit className="w-4 h-4 inline mr-1" />
                      Editar
                    </button>
                    <button className="flex-1 bg-red-100 text-red-700 py-2 px-3 rounded text-sm hover:bg-red-200">
                      <Trash2 className="w-4 h-4 inline mr-1" />
                      {offer.active ? 'Desactivar' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Configuración de Recompensas</h2>
              </div>
              
              <div className="space-y-6">
                {/* Points per Quetzal */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Coins className="w-4 h-4 text-blue-600" />
                    Puntos por Quetzal gastado
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={settings.pointsPerQuetzal}
                      onChange={(e) => handleSettingChange('pointsPerQuetzal', parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      Cada Q1 = {settings.pointsPerQuetzal} punto{settings.pointsPerQuetzal > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                
                {/* Experience Bonus */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Gift className="w-4 h-4 text-yellow-600" />
                    Puntos bonus por experiencia
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="5"
                      max="100"
                      step="5"
                      value={settings.experienceBonus}
                      onChange={(e) => handleSettingChange('experienceBonus', parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      +{settings.experienceBonus} puntos por foto compartida
                    </span>
                  </div>
                </div>
                
                {/* Minimum Redemption */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mínimo de puntos para canje
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="10"
                      max="500"
                      step="10"
                      value={settings.minRedemption}
                      onChange={(e) => handleSettingChange('minRedemption', parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      Los clientes necesitan al menos {settings.minRedemption} puntos para canjear
                    </span>
                  </div>
                </div>
                
                {/* Burn Enabled */}
                <div>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.burnEnabled}
                      onChange={(e) => handleSettingChange('burnEnabled', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Permitir quemar NFTs para recompensas especiales
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 ml-7">
                    Los clientes pueden quemar sus NFTs de experiencias para obtener descuentos mayores
                  </p>
                </div>
              </div>
              
              {/* Preview */}
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2">Vista previa:</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Compra de Q100 = {settings.pointsPerQuetzal * 100} puntos</p>
                  <p>• + Experiencia compartida = +{settings.experienceBonus} puntos bonus</p>
                  <p>• Total: {settings.pointsPerQuetzal * 100 + settings.experienceBonus} puntos</p>
                  <p>• Canje mínimo: {settings.minRedemption} puntos</p>
                </div>
              </div>
              
              {/* Save Button */}
              <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar Configuración
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}