import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Store, User, Zap, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [userType, setUserType] = useState('customer')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email) {
      toast.error('Por favor ingresa tu correo')
      return
    }
    
    setLoading(true)
    const success = await login(
      email, 
      userType === 'business' ? businessName : null
    )
    
    if (success) {
      setEmail('')
      setBusinessName('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" 
             style={{
               backgroundImage: 'linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px)',
               backgroundSize: '20px 20px'
             }}
        ></div>
      </div>
      
      <div className="relative flex items-center justify-center min-h-screen px-4 py-12">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-blue-900 mb-2">🇬🇹 GuateRewards</h1>
            <p className="text-blue-700 font-medium">Sistema de lealtad empresarial guatemalteco</p>
          </div>

          {/* Main Card */}
          <div className="bg-white border border-blue-200 shadow-xl rounded-lg p-8">
            {/* User Type Toggle */}
            <div className="flex gap-2 mb-8">
              <button
                onClick={() => setUserType('customer')}
                className={`flex-1 py-4 px-4 border-2 rounded-lg transition-all ${
                  userType === 'customer'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                    : 'border-blue-200 hover:border-blue-300 text-blue-700 hover:bg-blue-50'
                }`}
              >
                <User className="w-5 h-5 mx-auto mb-2" />
                <span className="text-sm font-semibold">Cliente</span>
              </button>
              <button
                onClick={() => setUserType('business')}
                className={`flex-1 py-4 px-4 border-2 rounded-lg transition-all ${
                  userType === 'business'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                    : 'border-blue-200 hover:border-blue-300 text-blue-700 hover:bg-blue-50'
                }`}
              >
                <Store className="w-5 h-5 mx-auto mb-2" />
                <span className="text-sm font-semibold">Negocio</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Business Name */}
              {userType === 'business' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Nombre del Negocio
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 text-gray-900 focus:border-blue-500 focus:outline-none transition-all rounded-lg"
                    placeholder="Café Chapín, Restaurante Antigua, etc."
                    required={userType === 'business'}
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-11 border-2 border-blue-200 text-gray-900 focus:border-blue-500 focus:outline-none transition-all rounded-lg"
                    placeholder="tu@correo.com"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 px-6 font-bold text-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Enviando enlace...
                  </span>
                ) : (
                  'Acceder con Email'
                )}
              </button>
            </form>

            {/* Info */}
            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">
                Recibirás un enlace de acceso en tu correo
              </p>
              <p className="text-blue-600 text-xs mt-2 font-medium">
                ✨ Funciona para usuarios nuevos y existentes
              </p>
            </div>

            {/* Features */}
            <div className="mt-8 pt-6 border-t border-blue-200">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <p className="text-gray-700 text-sm font-medium">Gana puntos con cada compra en Guatemala</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">📸</span>
                  </div>
                  <p className="text-gray-700 text-sm font-medium">Crea experiencias únicas con fotos</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">🎁</span>
                  </div>
                  <p className="text-gray-700 text-sm font-medium">Canjea recompensas y colecciona NFTs</p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Link */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/admin/login')}
              className="text-blue-600 hover:text-blue-800 transition-colors text-sm flex items-center justify-center gap-2 mx-auto"
            >
              <Shield className="w-4 h-4" />
              Portal de Administración
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}