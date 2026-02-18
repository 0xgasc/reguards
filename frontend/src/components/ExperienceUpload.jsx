import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Upload, Camera, Star, MapPin, Send, X, Sparkles } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function ExperienceUpload() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { getAuthHeaders } = useAuth()
  
  const receiptId = searchParams.get('receiptId')
  const [receipt, setReceipt] = useState(null)
  
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [description, setDescription] = useState('')
  const [rating, setRating] = useState(5)
  const [location, setLocation] = useState('')
  const [uploading, setUploading] = useState(false)
  
  // Fetch receipt data on mount
  useEffect(() => {
    if (receiptId) {
      fetchReceiptData()
    }
  }, [])
  
  const fetchReceiptData = async () => {
    try {
      const response = await fetch('/api/receipts/my-receipts', {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      const foundReceipt = data.receipts?.find(r => r._id === receiptId)
      setReceipt(foundReceipt)
    } catch (error) {
      console.error('Error fetching receipt:', error)
    }
  }

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target.result)
      reader.readAsDataURL(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!image) {
      toast.error('Por favor sube una foto de tu experiencia')
      return
    }
    
    setUploading(true)
    
    try {
      // First, create the experience
      const formData = new FormData()
      formData.append('photo', image)
      formData.append('receiptId', receiptId)
      formData.append('description', description)
      formData.append('rating', rating)
      formData.append('location', location)
      
      const expResponse = await fetch('/api/experience/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      })
      
      const expData = await expResponse.json()
      
      if (expData.success) {
        // Mark receipt as having experience and get bonus points
        const receiptResponse = await fetch(`/api/receipts/${receiptId}/create-experience`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          }
        })
        
        const receiptData = await receiptResponse.json()
        
        toast.success(`¡Experiencia creada! +${receiptData.experienceBonus || 20} puntos bonus`)
        setTimeout(() => navigate('/dashboard'), 2000)
      } else {
        toast.error(expData.error || 'Error al crear la experiencia')
      }
    } catch (error) {
      toast.error('Error al subir la experiencia')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    setImage(null)
    setPreview(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">📸 Crea tu Experiencia</h1>
          {receipt && (
            <div className="bg-white rounded-lg p-4 mt-4 border border-blue-200">
              <p className="font-medium text-gray-900">{receipt.businessName}</p>
              <p className="text-sm text-gray-600">
                Q{receipt.amount} • {new Date(receipt.date).toLocaleDateString('es-GT')}
              </p>
              <p className="text-sm text-blue-600 font-medium">Gana +20 puntos extra al compartir</p>
            </div>
          )}
        </div>

        {/* Upload Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            {!preview ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  isDragActive 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">
                  {isDragActive 
                    ? 'Suelta la imagen aquí...' 
                    : 'Arrastra una foto o haz clic para seleccionar'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  JPG, PNG, GIF hasta 10MB
                </p>
              </div>
            ) : (
              <div className="relative">
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe tu experiencia
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                rows="3"
                placeholder="¡El mejor café que he probado! El ambiente es acogedor y el servicio excelente..."
              />
            </div>

            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calificación
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star 
                      className={`w-8 h-8 ${
                        star <= rating 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                Ubicación (opcional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field"
                placeholder="Ciudad de Guatemala, Zona 10"
              />
            </div>

            {/* Bonus Points Info */}
            <div className="bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    ¡Puntos bonus por tu experiencia!
                  </p>
                  <p className="text-sm text-gray-600">
                    +20 puntos al compartir esta experiencia
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading || !image}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Creando experiencia...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Compartir Experiencia</span>
                </>
              )}
            </button>

            {/* Skip Option */}
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Tal vez más tarde
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}