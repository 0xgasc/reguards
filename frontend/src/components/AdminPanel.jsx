import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, DollarSign, Users, TrendingUp } from 'lucide-react';
import useAuthStore from '../store/auth-store';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function AdminPanel() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('pos');
  const [analytics, setAnalytics] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // POS State
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseDescription, setPurchaseDescription] = useState('');

  // Points Adjustment State
  const [adjustPhone, setAdjustPhone] = useState('');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustType, setAdjustType] = useState('add');

  // Merchants State
  const [merchants, setMerchants] = useState([]);
  const [newMerchant, setNewMerchant] = useState({
    phone: '', pin: '', restaurantName: '', emoji: '🍽️',
    accentColor: '#FFFF00', pointsPerQuetzal: 1, welcomeBonus: 0,
    category: '', zone: '',
  });
  const [merchantLoading, setMerchantLoading] = useState(false);

  // Campaigns State
  const [campaigns, setCampaigns] = useState([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    restaurantId: '', name: '', multiplier: 2, startDate: '', endDate: '',
  });

  // Challenges State
  const [challenges, setChallenges] = useState([]);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    name: '', description: '', emoji: '⚡',
    metric: 'visits', target: 5, bonusPoints: 100,
    bonusName: '', bonusEmoji: '🏆',
    startDate: '', endDate: '',
  });

  // Broadcast State
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSegment, setBroadcastSegment] = useState('all');
  const [broadcastDryRun, setBroadcastDryRun] = useState(true);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // Alliances State
  const [alliances, setAlliances] = useState([]);
  const [allianceLoading, setAllianceLoading] = useState(false);
  const [newAlliance, setNewAlliance] = useState({
    name: '', emoji: '🤝', description: '',
    restaurants: [], conversionRate: 1.0,
    startDate: '', endDate: '',
  });

  // Events State
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventRsvps, setEventRsvps] = useState([]);
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', date: '', venue: '', address: '',
    maxAttendees: '', pointsReward: 50, isFree: true, priceGTQ: '',
    coverEmoji: '🎉', coverColor: '#FFFF00', tags: '',
  });
  const [checkInPhone, setCheckInPhone] = useState('');

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
      return;
    }

    if (user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }

    fetchAnalytics();
  }, [user, token, navigate]);

  const fetchAnalytics = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/admin/analytics`, { headers });
      setAnalytics(res.data);
    } catch (error) {
      console.error('Analytics error:', error);
      toast.error('Error cargando analytics');
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/admin/customers`, { headers });
      setCustomers(res.data.customers);
    } catch (error) {
      console.error('Customers error:', error);
      toast.error('Error cargando clientes');
    } finally {
      setLoading(false);
    }
  };

  const searchCustomer = async (phone) => {
    if (!phone || phone.length < 4) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/admin/customers/search?phone=${phone}`, {
        headers,
      });

      if (res.data.customers.length > 0) {
        setSelectedCustomer(res.data.customers[0]);
      } else {
        toast.error('Cliente no encontrado');
        setSelectedCustomer(null);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Error buscando cliente');
    }
  };

  const recordPurchase = async (e) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error('Selecciona un cliente');
      return;
    }

    if (!purchaseAmount || parseFloat(purchaseAmount) <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(
        `${API_URL}/api/admin/record-purchase`,
        {
          customerPhone: selectedCustomer.phone,
          amountQuetzales: purchaseAmount,
          description: purchaseDescription,
        },
        { headers }
      );

      if (res.data.success) {
        toast.success(`¡${res.data.pointsEarned} puntos otorgados!`);
        setSelectedCustomer({ ...selectedCustomer, totalPoints: res.data.newBalance });
        setPurchaseAmount('');
        setPurchaseDescription('');
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Record purchase error:', error);
      toast.error(error.response?.data?.error || 'Error registrando compra');
    } finally {
      setLoading(false);
    }
  };

  const adjustPointsHandler = async (e) => {
    e.preventDefault();

    if (!adjustPhone || !adjustPoints) {
      toast.error('Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(
        `${API_URL}/api/admin/adjust-points`,
        {
          customerPhone: adjustPhone,
          points: adjustPoints,
          reason: adjustReason,
          type: adjustType,
        },
        { headers }
      );

      if (res.data.success) {
        toast.success(`Puntos ajustados: ${res.data.adjustment}`);
        setAdjustPhone('');
        setAdjustPoints('');
        setAdjustReason('');
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Adjust points error:', error);
      toast.error(error.response?.data?.error || 'Error ajustando puntos');
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchants = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/admin/merchants`, { headers });
      setMerchants(res.data.restaurants || []);
    } catch (err) {
      toast.error('Error cargando comerciantes');
    }
  };

  const createMerchant = async (e) => {
    e.preventDefault();
    if (!newMerchant.phone || !newMerchant.pin || !newMerchant.restaurantName) {
      toast.error('Teléfono, PIN y nombre del restaurante requeridos');
      return;
    }
    setMerchantLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/api/admin/merchants`, newMerchant, { headers });
      toast.success('¡Comerciante creado!');
      setNewMerchant({ phone: '', pin: '', restaurantName: '', emoji: '🍽️', accentColor: '#FFFF00', pointsPerQuetzal: 1, welcomeBonus: 0, category: '', zone: '' });
      fetchMerchants();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando comerciante');
    } finally {
      setMerchantLoading(false);
    }
  };

  const toggleFeatured = async (id, isFeatured) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(`${API_URL}/api/admin/restaurants/${id}/feature`, { isFeatured: !isFeatured }, { headers });
      toast.success(isFeatured ? 'Restaurante removido de destacados' : '¡Restaurante destacado!');
      fetchMerchants();
    } catch (err) {
      toast.error('Error actualizando');
    }
  };

  const fetchCampaigns = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/admin/campaigns`, { headers });
      setCampaigns(res.data.campaigns || []);
    } catch (err) {
      toast.error('Error cargando campañas');
    }
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaign.restaurantId || !newCampaign.name || !newCampaign.endDate) {
      toast.error('Restaurante, nombre y fecha fin requeridos');
      return;
    }
    setCampaignLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/api/admin/campaigns`, newCampaign, { headers });
      toast.success('¡Campaña creada!');
      setNewCampaign({ restaurantId: '', name: '', multiplier: 2, startDate: '', endDate: '' });
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando campaña');
    } finally {
      setCampaignLoading(false);
    }
  };

  const deleteCampaign = async (id) => {
    if (!window.confirm('¿Eliminar esta campaña?')) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/api/admin/campaigns/${id}`, { headers });
      toast.success('Campaña eliminada');
      fetchCampaigns();
    } catch (err) {
      toast.error('Error eliminando campaña');
    }
  };

  const toggleCampaign = async (id, isActive) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(`${API_URL}/api/admin/campaigns/${id}`, { isActive: !isActive }, { headers });
      toast.success(isActive ? 'Campaña pausada' : '¡Campaña activada!');
      fetchCampaigns();
    } catch (err) {
      toast.error('Error actualizando campaña');
    }
  };

  const fetchChallenges = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/admin/challenges`, { headers });
      setChallenges(res.data.challenges || []);
    } catch {
      toast.error('Error cargando desafíos');
    }
  };

  const createChallenge = async (e) => {
    e.preventDefault();
    if (!newChallenge.name || !newChallenge.target || !newChallenge.bonusPoints) {
      toast.error('Nombre, meta y puntos de bonus requeridos');
      return;
    }
    setChallengeLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/api/admin/challenges`, newChallenge, { headers });
      toast.success('¡Desafío creado!');
      setNewChallenge({ name: '', description: '', emoji: '⚡', metric: 'visits', target: 5, bonusPoints: 100, bonusName: '', bonusEmoji: '🏆', startDate: '', endDate: '' });
      fetchChallenges();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando desafío');
    } finally {
      setChallengeLoading(false);
    }
  };

  const toggleChallenge = async (id, current) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(`${API_URL}/api/admin/challenges/${id}`, { isActive: !current }, { headers });
      fetchChallenges();
    } catch { toast.error('Error'); }
  };

  const deleteChallenge = async (id) => {
    if (!confirm('¿Eliminar desafío?')) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/api/admin/challenges/${id}`, { headers });
      fetchChallenges();
    } catch { toast.error('Error'); }
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) { toast.error('Escribe un mensaje'); return; }
    setBroadcastLoading(true); setBroadcastResult(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${API_URL}/api/admin/broadcast`, {
        message: broadcastMsg,
        segment: broadcastSegment,
        dryRun: broadcastDryRun,
      }, { headers });
      setBroadcastResult(res.data);
      toast.success(broadcastDryRun ? `Simulación: ${res.data.total} destinatarios` : `¡Enviado a ${res.data.sent} clientes!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error enviando');
    } finally {
      setBroadcastLoading(false);
    }
  };

  const fetchAlliances = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/admin/alliances`, { headers });
      setAlliances(res.data.alliances || []);
    } catch (err) {
      toast.error('Error cargando alianzas');
    }
  };

  const createAlliance = async (e) => {
    e.preventDefault();
    if (!newAlliance.name || newAlliance.restaurants.length < 2) {
      toast.error('Nombre y al menos 2 restaurantes requeridos');
      return;
    }
    setAllianceLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        ...newAlliance,
        endDate: newAlliance.endDate || null,
        startDate: newAlliance.startDate || new Date().toISOString(),
      };
      await axios.post(`${API_URL}/api/admin/alliances`, payload, { headers });
      toast.success('¡Alianza creada!');
      setNewAlliance({ name: '', emoji: '🤝', description: '', restaurants: [], conversionRate: 1.0, startDate: '', endDate: '' });
      fetchAlliances();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando alianza');
    } finally {
      setAllianceLoading(false);
    }
  };

  const toggleAlliance = async (id, isActive) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(`${API_URL}/api/admin/alliances/${id}`, { isActive: !isActive }, { headers });
      toast.success(isActive ? 'Alianza desactivada' : '¡Alianza activada!');
      fetchAlliances();
    } catch (err) {
      toast.error('Error actualizando alianza');
    }
  };

  const deleteAlliance = async (id) => {
    if (!window.confirm('¿Eliminar esta alianza?')) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/api/admin/alliances/${id}`, { headers });
      toast.success('Alianza eliminada');
      fetchAlliances();
    } catch (err) {
      toast.error('Error eliminando alianza');
    }
  };

  const fetchEvents = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/events/admin/all`, { headers });
      setEvents(res.data.events || []);
    } catch (err) {
      toast.error('Error cargando eventos');
    }
  };

  const createEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) { toast.error('Título y fecha requeridos'); return; }
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        ...newEvent,
        tags: newEvent.tags ? newEvent.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        maxAttendees: newEvent.maxAttendees ? parseInt(newEvent.maxAttendees) : null,
        pointsReward: parseInt(newEvent.pointsReward) || 0,
        priceGTQ: parseFloat(newEvent.priceGTQ) || 0,
        isFree: newEvent.isFree,
      };
      await axios.post(`${API_URL}/api/events`, payload, { headers });
      toast.success('¡Evento creado!');
      setNewEvent({ title: '', description: '', date: '', venue: '', address: '',
        maxAttendees: '', pointsReward: 50, isFree: true, priceGTQ: '',
        coverEmoji: '🎉', coverColor: '#FFFF00', tags: '' });
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando evento');
    } finally {
      setLoading(false);
    }
  };

  const loadEventRsvps = async (eventId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/events/${eventId}/rsvps`, { headers });
      setEventRsvps(res.data.rsvps || []);
      setSelectedEvent(events.find(e => e._id === eventId));
    } catch (err) {
      toast.error('Error cargando RSVPs');
    }
  };

  const approveRsvp = async (eventId, rsvpId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/api/events/${eventId}/rsvps/${rsvpId}/approve`, {}, { headers });
      toast.success('RSVP aprobado');
      loadEventRsvps(eventId);
    } catch (err) {
      toast.error('Error aprobando RSVP');
    }
  };

  const rejectRsvp = async (eventId, rsvpId, reason) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/api/events/${eventId}/rsvps/${rsvpId}/reject`, { reason }, { headers });
      toast.success('RSVP rechazado');
      loadEventRsvps(eventId);
    } catch (err) {
      toast.error('Error rechazando RSVP');
    }
  };

  const handleCheckIn = async (eventId) => {
    if (!checkInPhone) { toast.error('Ingresa el teléfono del cliente'); return; }
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${API_URL}/api/events/${eventId}/check-in`,
        { customerPhone: checkInPhone }, { headers });
      toast.success(res.data.message || 'Check-in exitoso');
      setCheckInPhone('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error en check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Sesión cerrada');
  };

  return (
    <div className="min-h-screen bg-neobrutalist-white">
      {/* Header */}
      <header className="border-b-4 border-neobrutalist-black bg-neobrutalist-yellow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div>
              <h1 className="text-3xl font-bold text-neobrutalist-black uppercase tracking-tight">
                ADMIN PANEL
              </h1>
              <p className="text-sm font-bold text-neobrutalist-black font-mono">
                REGUARDS MANAGEMENT
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="border-4 border-neobrutalist-black bg-neobrutalist-red text-neobrutalist-white px-4 py-2 font-bold uppercase hover:translate-x-1 hover:translate-y-1 transition-transform flex items-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              SALIR
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b-4 border-neobrutalist-black bg-neobrutalist-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 py-4">
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'pos'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              <DollarSign className="w-5 h-5 inline mr-2" />
              POS
            </button>
            <button
              onClick={() => {
                setActiveTab('customers');
                fetchCustomers();
              }}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'customers'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              <Users className="w-5 h-5 inline mr-2" />
              CLIENTES
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'analytics'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              <TrendingUp className="w-5 h-5 inline mr-2" />
              ANALYTICS
            </button>
            <button
              onClick={() => { setActiveTab('events'); fetchEvents(); }}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'events'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              EVENTOS
            </button>
            <button
              onClick={() => { setActiveTab('merchants'); fetchMerchants(); }}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'merchants'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              COMERCIANTES
            </button>
            <button
              onClick={() => { setActiveTab('alliances'); fetchAlliances(); fetchMerchants(); }}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'alliances'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              ALIANZAS
            </button>
            <button
              onClick={() => { setActiveTab('campaigns'); fetchCampaigns(); fetchMerchants(); }}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'campaigns'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              CAMPAÑAS
            </button>
            <button
              onClick={() => { setActiveTab('challenges'); fetchChallenges(); }}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'challenges'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              DESAFÍOS
            </button>
            <button
              onClick={() => setActiveTab('broadcast')}
              className={`px-6 py-3 font-bold uppercase border-4 border-neobrutalist-black transition-all ${
                activeTab === 'broadcast'
                  ? 'bg-neobrutalist-yellow'
                  : 'bg-neobrutalist-white hover:bg-neobrutalist-gray-100'
              }`}
            >
              BROADCAST
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* POS Tab */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Customer Search */}
            <div className="bg-neobrutalist-white border-4 border-neobrutalist-black shadow-brutal p-6">
              <h2 className="text-2xl font-bold text-neobrutalist-black uppercase mb-6">
                BUSCAR CLIENTE
              </h2>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') searchCustomer(searchPhone);
                    }}
                    className="flex-1 px-4 py-3 border-4 border-neobrutalist-black font-mono text-lg font-bold focus:outline-none focus:border-neobrutalist-yellow"
                    placeholder="5555-5555"
                  />
                  <button
                    onClick={() => searchCustomer(searchPhone)}
                    className="px-6 py-3 bg-neobrutalist-blue text-neobrutalist-white border-4 border-neobrutalist-black font-bold uppercase hover:translate-x-1 hover:translate-y-1 transition-transform"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>

                {selectedCustomer && (
                  <div className="bg-neobrutalist-yellow border-4 border-neobrutalist-black p-4">
                    <p className="font-bold text-neobrutalist-black uppercase text-sm mb-2">
                      CLIENTE SELECCIONADO
                    </p>
                    <p className="font-mono font-bold text-2xl text-neobrutalist-black">
                      {selectedCustomer.phone}
                    </p>
                    <p className="font-bold text-neobrutalist-black mt-2">
                      Puntos actuales: {selectedCustomer.totalPoints || 0}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Record Purchase */}
            <div className="bg-neobrutalist-white border-4 border-neobrutalist-black shadow-brutal p-6">
              <h2 className="text-2xl font-bold text-neobrutalist-black uppercase mb-6">
                REGISTRAR COMPRA
              </h2>

              <form onSubmit={recordPurchase} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-neobrutalist-black uppercase mb-2">
                    Monto (Quetzales)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="w-full px-4 py-3 border-4 border-neobrutalist-black font-mono text-2xl font-bold focus:outline-none focus:border-neobrutalist-yellow"
                    placeholder="100.00"
                    required
                  />
                  <p className="text-xs font-bold text-neobrutalist-gray-800 mt-2">
                    1 Quetzal = 1 Punto
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-neobrutalist-black uppercase mb-2">
                    Descripción (Opcional)
                  </label>
                  <input
                    type="text"
                    value={purchaseDescription}
                    onChange={(e) => setPurchaseDescription(e.target.value)}
                    className="w-full px-4 py-3 border-4 border-neobrutalist-black font-bold focus:outline-none focus:border-neobrutalist-yellow"
                    placeholder="Ej: Almuerzo, Café, etc."
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedCustomer || loading}
                  className="w-full bg-neobrutalist-yellow border-4 border-neobrutalist-black py-4 font-bold text-lg uppercase shadow-brutal hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? 'PROCESANDO...' : 'REGISTRAR COMPRA'}
                </button>
              </form>
            </div>

            {/* Points Adjustment */}
            <div className="bg-neobrutalist-white border-4 border-neobrutalist-black shadow-brutal p-6 lg:col-span-2">
              <h2 className="text-2xl font-bold text-neobrutalist-black uppercase mb-6">
                AJUSTE MANUAL DE PUNTOS
              </h2>

              <form onSubmit={adjustPointsHandler} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="tel"
                  value={adjustPhone}
                  onChange={(e) => setAdjustPhone(e.target.value)}
                  className="px-4 py-3 border-4 border-neobrutalist-black font-mono font-bold focus:outline-none focus:border-neobrutalist-yellow"
                  placeholder="Teléfono"
                  required
                />

                <input
                  type="number"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  className="px-4 py-3 border-4 border-neobrutalist-black font-mono font-bold focus:outline-none focus:border-neobrutalist-yellow"
                  placeholder="Puntos"
                  required
                />

                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="px-4 py-3 border-4 border-neobrutalist-black font-bold focus:outline-none focus:border-neobrutalist-yellow"
                >
                  <option value="add">AGREGAR (+)</option>
                  <option value="subtract">RESTAR (-)</option>
                </select>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-neobrutalist-red text-neobrutalist-white border-4 border-neobrutalist-black font-bold uppercase hover:translate-x-1 hover:translate-y-1 transition-transform disabled:opacity-50"
                >
                  AJUSTAR
                </button>
              </form>

              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full mt-4 px-4 py-3 border-4 border-neobrutalist-black font-bold focus:outline-none focus:border-neobrutalist-yellow"
                placeholder="Razón del ajuste (opcional)"
              />
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div className="bg-neobrutalist-white border-4 border-neobrutalist-black shadow-brutal">
            <div className="p-6 border-b-4 border-neobrutalist-black bg-neobrutalist-yellow">
              <h2 className="text-2xl font-bold text-neobrutalist-black uppercase">
                TODOS LOS CLIENTES
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin w-16 h-16 border-4 border-neobrutalist-black border-t-neobrutalist-yellow mx-auto"></div>
              </div>
            ) : customers.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-bold text-neobrutalist-gray-800 uppercase">NO HAY CLIENTES</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b-4 border-neobrutalist-black bg-neobrutalist-gray-100">
                  <tr>
                    <th className="text-left p-4 font-bold uppercase">Teléfono</th>
                    <th className="text-left p-4 font-bold uppercase">Email</th>
                    <th className="text-right p-4 font-bold uppercase">Puntos</th>
                    <th className="text-right p-4 font-bold uppercase">Registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer._id}
                      className="border-b-4 border-neobrutalist-black last:border-b-0 hover:bg-neobrutalist-gray-100"
                    >
                      <td className="p-4 font-mono font-bold">{customer.phone}</td>
                      <td className="p-4 font-bold text-neobrutalist-gray-800">
                        {customer.email || 'N/A'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-neobrutalist-black">
                        {customer.totalPoints || 0}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-neobrutalist-gray-800 text-sm">
                        {new Date(customer.createdAt).toLocaleDateString('es-GT')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-neobrutalist-yellow border-4 border-neobrutalist-black shadow-brutal p-6">
                <p className="text-sm font-bold uppercase text-neobrutalist-black mb-2">
                  Total Clientes
                </p>
                <p className="text-5xl font-bold font-mono text-neobrutalist-black">
                  {analytics.overview.totalCustomers}
                </p>
              </div>

              <div className="bg-neobrutalist-blue text-neobrutalist-white border-4 border-neobrutalist-black shadow-brutal p-6">
                <p className="text-sm font-bold uppercase mb-2">Puntos en Circulación</p>
                <p className="text-5xl font-bold font-mono">
                  {analytics.overview.totalPoints.toLocaleString()}
                </p>
              </div>

              <div className="bg-neobrutalist-white border-4 border-neobrutalist-black shadow-brutal p-6">
                <p className="text-sm font-bold uppercase text-neobrutalist-black mb-2">
                  Promedio por Cliente
                </p>
                <p className="text-5xl font-bold font-mono text-neobrutalist-black">
                  {analytics.overview.avgPointsPerCustomer}
                </p>
              </div>
            </div>

            {/* Top Customers */}
            <div className="bg-neobrutalist-white border-4 border-neobrutalist-black shadow-brutal">
              <div className="p-6 border-b-4 border-neobrutalist-black bg-neobrutalist-yellow">
                <h2 className="text-2xl font-bold text-neobrutalist-black uppercase">
                  TOP CLIENTES
                </h2>
              </div>

              <table className="w-full">
                <thead className="border-b-4 border-neobrutalist-black bg-neobrutalist-gray-100">
                  <tr>
                    <th className="text-left p-4 font-bold uppercase">Posición</th>
                    <th className="text-left p-4 font-bold uppercase">Teléfono</th>
                    <th className="text-right p-4 font-bold uppercase">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topCustomers.map((customer, index) => (
                    <tr
                      key={customer._id}
                      className="border-b-4 border-neobrutalist-black last:border-b-0"
                    >
                      <td className="p-4">
                        <span className="bg-neobrutalist-yellow border-4 border-neobrutalist-black px-4 py-2 font-bold text-lg">
                          #{index + 1}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold">{customer.phone}</td>
                      <td className="p-4 text-right font-mono font-bold text-2xl text-neobrutalist-black">
                        {customer.totalPoints.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-8">
            {/* Create Event Form */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-yellow-300">
                <h2 className="text-2xl font-black uppercase">CREAR EVENTO</h2>
              </div>
              <form onSubmit={createEvent} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-black text-sm mb-1">TÍTULO *</label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                    placeholder="Noche de Jazz"
                    className="w-full border-4 border-black p-3 font-mono focus:outline-none focus:bg-yellow-50"
                    required
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">FECHA Y HORA *</label>
                  <input
                    type="datetime-local"
                    value={newEvent.date}
                    onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))}
                    className="w-full border-4 border-black p-3 font-mono focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">LUGAR</label>
                  <input
                    type="text"
                    value={newEvent.venue}
                    onChange={e => setNewEvent(p => ({ ...p, venue: e.target.value }))}
                    placeholder="Restaurante El Portal"
                    className="w-full border-4 border-black p-3 font-mono focus:outline-none focus:bg-yellow-50"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">DIRECCIÓN</label>
                  <input
                    type="text"
                    value={newEvent.address}
                    onChange={e => setNewEvent(p => ({ ...p, address: e.target.value }))}
                    placeholder="Zona 10, Guatemala"
                    className="w-full border-4 border-black p-3 font-mono focus:outline-none focus:bg-yellow-50"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-black text-sm mb-1">DESCRIPCIÓN</label>
                  <textarea
                    value={newEvent.description}
                    onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                    placeholder="Descripción del evento..."
                    rows={2}
                    className="w-full border-4 border-black p-3 font-mono focus:outline-none focus:bg-yellow-50 resize-none"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">EMOJI PORTADA</label>
                  <input
                    type="text"
                    value={newEvent.coverEmoji}
                    onChange={e => setNewEvent(p => ({ ...p, coverEmoji: e.target.value }))}
                    className="w-full border-4 border-black p-3 font-mono text-3xl focus:outline-none"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">COLOR DE ACENTO</label>
                  <div className="flex gap-2">
                    {['#FFFF00','#FF0000','#0000FF','#00FF00','#FF69B4','#000000'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewEvent(p => ({ ...p, coverColor: c }))}
                        className={`w-10 h-10 border-4 ${newEvent.coverColor === c ? 'border-black scale-110' : 'border-gray-400'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">PUNTOS POR ASISTIR</label>
                  <input
                    type="number"
                    value={newEvent.pointsReward}
                    onChange={e => setNewEvent(p => ({ ...p, pointsReward: e.target.value }))}
                    min="0"
                    className="w-full border-4 border-black p-3 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">MAX ASISTENTES (vacío = sin límite)</label>
                  <input
                    type="number"
                    value={newEvent.maxAttendees}
                    onChange={e => setNewEvent(p => ({ ...p, maxAttendees: e.target.value }))}
                    placeholder="50"
                    min="1"
                    className="w-full border-4 border-black p-3 font-mono focus:outline-none focus:bg-yellow-50"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">¿ES GRATIS?</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setNewEvent(p => ({ ...p, isFree: true }))}
                      className={`flex-1 py-3 border-4 border-black font-black ${newEvent.isFree ? 'bg-black text-yellow-300' : 'bg-white'}`}
                    >
                      GRATIS
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEvent(p => ({ ...p, isFree: false }))}
                      className={`flex-1 py-3 border-4 border-black font-black ${!newEvent.isFree ? 'bg-black text-yellow-300' : 'bg-white'}`}
                    >
                      DE PAGO
                    </button>
                  </div>
                </div>
                {!newEvent.isFree && (
                  <div>
                    <label className="block font-black text-sm mb-1">PRECIO (GTQ)</label>
                    <input
                      type="number"
                      value={newEvent.priceGTQ}
                      onChange={e => setNewEvent(p => ({ ...p, priceGTQ: e.target.value }))}
                      placeholder="150"
                      min="0"
                      className="w-full border-4 border-black p-3 font-mono focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-black text-sm mb-1">ETIQUETAS (separadas por coma)</label>
                  <input
                    type="text"
                    value={newEvent.tags}
                    onChange={e => setNewEvent(p => ({ ...p, tags: e.target.value }))}
                    placeholder="música, comida, exclusivo"
                    className="w-full border-4 border-black p-3 font-mono focus:outline-none focus:bg-yellow-50"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black text-yellow-300 font-black text-lg py-4 border-4 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                  >
                    {loading ? 'CREANDO...' : '+ PUBLICAR EVENTO'}
                  </button>
                </div>
              </form>
            </div>

            {/* Events list */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-black text-yellow-300 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase">TODOS LOS EVENTOS</h2>
                <button onClick={fetchEvents} className="border-2 border-yellow-300 px-3 py-1 font-mono text-sm hover:bg-yellow-300 hover:text-black transition-colors">
                  ↺ ACTUALIZAR
                </button>
              </div>

              {events.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-black text-xl">Sin eventos aún</p>
                </div>
              ) : (
                <div>
                  {events.map(ev => (
                    <div key={ev._id} className="border-b-4 border-black last:border-b-0 p-5">
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-12 h-12 border-2 border-black flex items-center justify-center text-2xl shrink-0"
                            style={{ backgroundColor: ev.coverColor || '#FFFF00' }}
                          >
                            {ev.coverEmoji}
                          </div>
                          <div>
                            <p className="font-black text-lg">{ev.title}</p>
                            <p className="font-mono text-sm text-gray-600">
                              {new Date(ev.date).toLocaleString('es-GT')}
                              {ev.venue && ` · ${ev.venue}`}
                            </p>
                            <div className="flex gap-3 mt-1 font-mono text-xs">
                              <span className="text-green-700 font-bold">✓ {ev.confirmedCount} confirmados</span>
                              {ev.pendingCount > 0 && (
                                <span className="text-orange-600 font-bold animate-pulse">{ev.pendingCount} pendientes</span>
                              )}
                              {ev.pointsReward > 0 && (
                                <span className="bg-yellow-300 border border-black px-1">+{ev.pointsReward}pts</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => loadEventRsvps(ev._id)}
                            className="border-4 border-black font-black text-xs px-4 py-2 hover:bg-yellow-300 transition-colors"
                          >
                            VER RSVPs
                          </button>
                          {/* Check-in inline */}
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Teléfono check-in"
                              value={selectedEvent?._id === ev._id ? checkInPhone : ''}
                              onFocus={() => setSelectedEvent(ev)}
                              onChange={e => { setSelectedEvent(ev); setCheckInPhone(e.target.value); }}
                              className="border-4 border-black px-2 py-2 font-mono text-xs w-36 focus:outline-none"
                            />
                            <button
                              onClick={() => { setSelectedEvent(ev); handleCheckIn(ev._id); }}
                              className="border-4 border-black bg-green-400 font-black text-xs px-3 py-2 hover:bg-green-500 transition-colors"
                            >
                              CHECK-IN
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* RSVPs panel */}
                      {selectedEvent?._id === ev._id && eventRsvps.length > 0 && (
                        <div className="mt-4 border-2 border-black">
                          <div className="bg-black text-yellow-300 px-4 py-2 font-black text-sm">
                            RSVPs — {ev.title}
                          </div>
                          {eventRsvps.map(rsvp => (
                            <div key={rsvp._id} className="flex items-center justify-between px-4 py-3 border-b border-black last:border-b-0 flex-wrap gap-2">
                              <div>
                                <p className="font-mono font-bold text-sm">{rsvp.user?.phone || 'Sin teléfono'}</p>
                                <p className="font-mono text-xs text-gray-500">
                                  {rsvp.checkedIn ? '✓ Check-in realizado' : 'Sin check-in'}
                                  {rsvp.referenceCode && ` · Ref: ${rsvp.referenceCode}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-black text-xs px-2 py-1 border-2 border-black ${
                                  rsvp.status === 'confirmed' ? 'bg-yellow-300' :
                                  rsvp.status === 'pending_approval' ? 'bg-blue-200 animate-pulse' :
                                  rsvp.status === 'pending_payment' ? 'bg-orange-200' : 'bg-gray-200'
                                }`}>
                                  {rsvp.status.toUpperCase().replace('_', ' ')}
                                </span>
                                {rsvp.comprovanteUrl && rsvp.status === 'pending_approval' && (
                                  <>
                                    <button
                                      onClick={() => window.open(rsvp.comprovanteUrl, '_blank')}
                                      className="border-2 border-black font-mono text-xs px-2 py-1 hover:bg-blue-100"
                                    >
                                      VER COMPROBANTE
                                    </button>
                                    <button
                                      onClick={() => approveRsvp(ev._id, rsvp._id)}
                                      className="border-2 border-black bg-green-400 font-black text-xs px-2 py-1 hover:bg-green-500"
                                    >
                                      ✓ APROBAR
                                    </button>
                                    <button
                                      onClick={() => rejectRsvp(ev._id, rsvp._id, 'Pago no verificado')}
                                      className="border-2 border-black bg-red-300 font-black text-xs px-2 py-1 hover:bg-red-400"
                                    >
                                      ✗ RECHAZAR
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Merchants Tab */}
        {activeTab === 'merchants' && (
          <div className="space-y-8">
            {/* Create merchant form */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-yellow-300">
                <h2 className="text-2xl font-black uppercase">NUEVO COMERCIANTE</h2>
              </div>
              <form onSubmit={createMerchant} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-black text-sm mb-1">TELÉFONO *</label>
                  <div className="flex border-4 border-black">
                    <span className="px-3 py-3 bg-gray-100 font-mono text-sm border-r-4 border-black">+502</span>
                    <input
                      type="tel"
                      value={newMerchant.phone}
                      onChange={e => setNewMerchant(p => ({ ...p, phone: e.target.value.replace(/\D/g,'').slice(0,8) }))}
                      placeholder="5555-5555"
                      className="flex-1 px-3 py-3 font-mono focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">PIN (4 dígitos) *</label>
                  <input
                    type="text"
                    value={newMerchant.pin}
                    onChange={e => setNewMerchant(p => ({ ...p, pin: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                    placeholder="1234"
                    maxLength={4}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">NOMBRE DEL RESTAURANTE *</label>
                  <input
                    type="text"
                    value={newMerchant.restaurantName}
                    onChange={e => setNewMerchant(p => ({ ...p, restaurantName: e.target.value }))}
                    placeholder="El Rincón Chapín"
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none focus:bg-yellow-50"
                    required
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">EMOJI</label>
                  <input
                    type="text"
                    value={newMerchant.emoji}
                    onChange={e => setNewMerchant(p => ({ ...p, emoji: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono text-2xl focus:outline-none"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">PTS POR Q1 GASTADO</label>
                  <input
                    type="number"
                    value={newMerchant.pointsPerQuetzal}
                    onChange={e => setNewMerchant(p => ({ ...p, pointsPerQuetzal: parseFloat(e.target.value) }))}
                    min="0.1" step="0.1"
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">BONO BIENVENIDA (pts)</label>
                  <input
                    type="number"
                    value={newMerchant.welcomeBonus}
                    onChange={e => setNewMerchant(p => ({ ...p, welcomeBonus: parseInt(e.target.value) }))}
                    min="0"
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">CATEGORÍA</label>
                  <select
                    value={newMerchant.category}
                    onChange={e => setNewMerchant(p => ({ ...p, category: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  >
                    <option value="">— Sin categoría —</option>
                    <option value="comida chapina">Comida Chapina</option>
                    <option value="italiana">Italiana</option>
                    <option value="mariscos">Mariscos</option>
                    <option value="cafetería">Cafetería</option>
                    <option value="sushi">Sushi</option>
                    <option value="carnes">Carnes</option>
                    <option value="tacos">Tacos</option>
                    <option value="postres">Postres</option>
                  </select>
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">ZONA</label>
                  <select
                    value={newMerchant.zone}
                    onChange={e => setNewMerchant(p => ({ ...p, zone: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  >
                    <option value="">— Sin zona —</option>
                    <option value="Zona 1">Zona 1</option>
                    <option value="Zona 4">Zona 4</option>
                    <option value="Zona 10">Zona 10</option>
                    <option value="Zona 13">Zona 13</option>
                    <option value="Zona 14">Zona 14</option>
                    <option value="Zona 15">Zona 15</option>
                    <option value="Miraflores">Miraflores</option>
                    <option value="Cayalá">Cayalá</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={merchantLoading}
                    className="w-full bg-black text-yellow-300 font-black text-lg py-4 border-4 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                  >
                    {merchantLoading ? 'CREANDO...' : '+ CREAR COMERCIANTE'}
                  </button>
                </div>
              </form>
            </div>

            {/* Merchants list */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-black text-yellow-300 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase">COMERCIANTES ACTIVOS</h2>
                <button onClick={fetchMerchants} className="border-2 border-yellow-300 px-3 py-1 font-mono text-sm hover:bg-yellow-300 hover:text-black transition-colors">
                  ↺ ACTUALIZAR
                </button>
              </div>
              {merchants.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-black text-xl">Sin comerciantes aún</p>
                  <p className="font-mono text-sm mt-2 opacity-60">Crea el primero con el formulario de arriba</p>
                </div>
              ) : (
                <div>
                  {merchants.map(m => (
                    <div key={m._id} className="border-b-4 border-black last:border-b-0 p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-14 h-14 border-2 border-black flex items-center justify-center text-3xl shrink-0"
                            style={{ backgroundColor: m.accentColor || '#FFFF00' }}
                          >
                            {m.emoji}
                          </div>
                          <div>
                            <p className="font-black text-lg">{m.name}</p>
                            <p className="font-mono text-xs text-gray-500">
                              Dueño: {m.owner?.phone || '—'}
                            </p>
                            <div className="flex gap-3 mt-1 font-mono text-xs flex-wrap">
                              <span className="border border-black px-2 py-0.5 font-bold">
                                {m.pointsPerQuetzal}pt/Q
                              </span>
                              <span className="border border-black px-2 py-0.5 font-bold">
                                Plan: {(m.plan || 'free').toUpperCase()}
                              </span>
                              {m.category && (
                                <span className="bg-blue-100 border border-black px-2 py-0.5 font-bold">
                                  {m.category}
                                </span>
                              )}
                              {m.zone && (
                                <span className="bg-green-100 border border-black px-2 py-0.5 font-bold">
                                  {m.zone}
                                </span>
                              )}
                              {m.welcomeBonus > 0 && (
                                <span className="bg-yellow-200 border border-black px-2 py-0.5 font-bold">
                                  Bono: {m.welcomeBonus}pts
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            onClick={() => toggleFeatured(m._id, m.isFeatured)}
                            className={`border-4 border-black font-black text-sm px-4 py-2 transition-all ${
                              m.isFeatured
                                ? 'bg-yellow-300 hover:bg-yellow-400'
                                : 'bg-white hover:bg-yellow-50'
                            }`}
                            title={m.isFeatured ? 'Quitar de destacados' : 'Marcar como destacado'}
                          >
                            {m.isFeatured ? 'DESTACADO' : 'DESTACAR'}
                          </button>
                          <div>
                            <p className="font-mono text-xs text-gray-400 mb-1">API KEY</p>
                            <code className="font-mono text-xs bg-black text-yellow-300 px-2 py-1 block max-w-[180px] truncate">
                              {m.apiKey}
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="space-y-8">
            {/* Create campaign form */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-orange-300">
                <h2 className="text-2xl font-black uppercase">NUEVA CAMPAÑA</h2>
                <p className="font-mono text-sm mt-1 opacity-70">Multiplica los puntos por tiempo limitado en un restaurante</p>
              </div>
              <form onSubmit={createCampaign} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block font-black text-sm mb-1">RESTAURANTE *</label>
                  <select
                    value={newCampaign.restaurantId}
                    onChange={e => setNewCampaign(p => ({ ...p, restaurantId: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                    required
                  >
                    <option value="">— Seleccionar restaurante —</option>
                    {merchants.map(m => (
                      <option key={m._id} value={m._id}>{m.emoji} {m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">NOMBRE DE LA CAMPAÑA *</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                    placeholder="Fin de semana doble"
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none focus:bg-yellow-50"
                    required
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-2">MULTIPLICADOR</label>
                  <div className="flex gap-2">
                    {[2, 3, 5].map(x => (
                      <button
                        key={x}
                        type="button"
                        onClick={() => setNewCampaign(p => ({ ...p, multiplier: x }))}
                        className={`flex-1 border-4 border-black font-black text-xl py-3 transition-all ${
                          newCampaign.multiplier === x ? 'bg-black text-yellow-300' : 'bg-white hover:bg-yellow-50'
                        }`}
                      >
                        {x}X
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">FECHA INICIO</label>
                  <input
                    type="datetime-local"
                    value={newCampaign.startDate}
                    onChange={e => setNewCampaign(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">FECHA FIN *</label>
                  <input
                    type="datetime-local"
                    value={newCampaign.endDate}
                    onChange={e => setNewCampaign(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={campaignLoading}
                    className="w-full bg-black text-orange-300 font-black text-lg py-4 border-4 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                  >
                    {campaignLoading ? 'CREANDO...' : `LANZAR CAMPAÑA ${newCampaign.multiplier}X`}
                  </button>
                </div>
              </form>
            </div>

            {/* Campaigns list */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-black text-orange-300 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase">CAMPAÑAS</h2>
                <button onClick={fetchCampaigns} className="border-2 border-orange-300 px-3 py-1 font-mono text-sm hover:bg-orange-300 hover:text-black transition-colors">
                  ↺ ACTUALIZAR
                </button>
              </div>
              {campaigns.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-black text-xl">Sin campañas aún</p>
                  <p className="font-mono text-sm mt-2 opacity-60">Crea la primera con el formulario de arriba</p>
                </div>
              ) : (
                <div>
                  {campaigns.map(c => {
                    const now = new Date();
                    const isLive = c.isActive && new Date(c.startDate) <= now && new Date(c.endDate) >= now;
                    const isExpired = new Date(c.endDate) < now;
                    const daysLeft = isLive
                      ? Math.max(0, Math.ceil((new Date(c.endDate) - now) / 86400000))
                      : null;
                    return (
                      <div key={c._id} className="border-b-4 border-black last:border-b-0 p-5">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-14 h-14 border-2 border-black flex items-center justify-center font-black text-2xl shrink-0"
                              style={{ backgroundColor: c.restaurant?.accentColor || '#FFFF00' }}
                            >
                              {c.multiplier}X
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-black text-lg">{c.name}</p>
                                {isLive && <span className="bg-orange-300 border-2 border-black font-black text-xs px-2 py-0.5 animate-pulse">EN VIVO</span>}
                                {isExpired && <span className="bg-gray-200 border-2 border-black font-black text-xs px-2 py-0.5">EXPIRADA</span>}
                                {!isLive && !isExpired && c.isActive && <span className="bg-blue-200 border-2 border-black font-black text-xs px-2 py-0.5">PROGRAMADA</span>}
                              </div>
                              <p className="font-mono text-xs text-gray-500 mt-0.5">
                                {c.restaurant?.emoji} {c.restaurant?.name}
                              </p>
                              <div className="flex gap-3 mt-1 font-mono text-xs flex-wrap">
                                <span className="border border-black px-2 py-0.5 font-bold">
                                  Hasta: {new Date(c.endDate).toLocaleDateString('es-GT')}
                                </span>
                                {daysLeft !== null && (
                                  <span className={`border border-black px-2 py-0.5 font-bold ${daysLeft <= 1 ? 'bg-red-100' : 'bg-orange-100'}`}>
                                    {daysLeft === 0 ? '¡Último día!' : `${daysLeft} días restantes`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => toggleCampaign(c._id, c.isActive)}
                              className={`border-4 border-black font-black text-xs px-4 py-2 transition-colors ${
                                c.isActive ? 'bg-gray-200 hover:bg-gray-300' : 'bg-orange-300 hover:bg-orange-400'
                              }`}
                            >
                              {c.isActive ? 'PAUSAR' : 'ACTIVAR'}
                            </button>
                            <button
                              onClick={() => deleteCampaign(c._id)}
                              className="border-4 border-black bg-red-300 font-black text-xs px-4 py-2 hover:bg-red-400 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alliances Tab */}
        {activeTab === 'alliances' && (
          <div className="space-y-8">
            {/* Create alliance form */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-yellow-300">
                <h2 className="text-2xl font-black uppercase">NUEVA ALIANZA</h2>
                <p className="font-mono text-sm mt-1 opacity-70">Conecta restaurantes para que clientes usen puntos entre ellos</p>
              </div>
              <form onSubmit={createAlliance} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-black text-sm mb-1">NOMBRE DE LA ALIANZA *</label>
                    <input
                      type="text"
                      value={newAlliance.name}
                      onChange={e => setNewAlliance(p => ({ ...p, name: e.target.value }))}
                      placeholder="Circuito del Sabor"
                      className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none focus:bg-yellow-50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-black text-sm mb-1">EMOJI</label>
                    <input
                      type="text"
                      value={newAlliance.emoji}
                      onChange={e => setNewAlliance(p => ({ ...p, emoji: e.target.value }))}
                      className="w-full border-4 border-black px-3 py-3 font-mono text-2xl focus:outline-none"
                      maxLength={2}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-black text-sm mb-1">DESCRIPCIÓN</label>
                    <input
                      type="text"
                      value={newAlliance.description}
                      onChange={e => setNewAlliance(p => ({ ...p, description: e.target.value }))}
                      placeholder="Descripción de la alianza para los clientes"
                      className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none focus:bg-yellow-50"
                    />
                  </div>
                  <div>
                    <label className="block font-black text-sm mb-1">TASA DE CONVERSIÓN</label>
                    <input
                      type="number"
                      value={newAlliance.conversionRate}
                      onChange={e => setNewAlliance(p => ({ ...p, conversionRate: parseFloat(e.target.value) }))}
                      min="0.1" step="0.1"
                      className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                    />
                    <p className="font-mono text-xs mt-1 opacity-60">1.0 = 1pt en A vale 1pt en B</p>
                  </div>
                  <div>
                    <label className="block font-black text-sm mb-1">FECHA INICIO</label>
                    <input
                      type="datetime-local"
                      value={newAlliance.startDate}
                      onChange={e => setNewAlliance(p => ({ ...p, startDate: e.target.value }))}
                      className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-black text-sm mb-1">FECHA FIN (dejar vacío = permanente)</label>
                    <input
                      type="datetime-local"
                      value={newAlliance.endDate}
                      onChange={e => setNewAlliance(p => ({ ...p, endDate: e.target.value }))}
                      className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none focus:bg-yellow-50"
                    />
                  </div>
                </div>

                {/* Restaurant multi-select */}
                <div>
                  <label className="block font-black text-sm mb-2">RESTAURANTES (mín. 2, máx. 5) *</label>
                  {merchants.length === 0 ? (
                    <p className="font-mono text-sm text-gray-500">Cargando restaurantes...</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {merchants.map(m => {
                        const selected = newAlliance.restaurants.includes(m._id);
                        return (
                          <button
                            key={m._id}
                            type="button"
                            onClick={() => {
                              setNewAlliance(p => ({
                                ...p,
                                restaurants: selected
                                  ? p.restaurants.filter(id => id !== m._id)
                                  : p.restaurants.length < 5
                                    ? [...p.restaurants, m._id]
                                    : p.restaurants,
                              }));
                            }}
                            className={`border-4 border-black p-3 text-left transition-all ${
                              selected ? 'bg-black text-yellow-300' : 'bg-white hover:bg-yellow-50'
                            }`}
                          >
                            <span className="text-xl mr-2">{m.emoji}</span>
                            <span className="font-black text-sm">{m.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {newAlliance.restaurants.length > 0 && (
                    <p className="font-mono text-xs mt-2 text-gray-600">
                      {newAlliance.restaurants.length} restaurante{newAlliance.restaurants.length !== 1 ? 's' : ''} seleccionado{newAlliance.restaurants.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={allianceLoading || newAlliance.restaurants.length < 2}
                  className="w-full bg-black text-yellow-300 font-black text-lg py-4 border-4 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                >
                  {allianceLoading ? 'CREANDO...' : 'CREAR ALIANZA'}
                </button>
              </form>
            </div>

            {/* Alliances list */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-black text-yellow-300 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase">ALIANZAS ACTIVAS</h2>
                <button onClick={fetchAlliances} className="border-2 border-yellow-300 px-3 py-1 font-mono text-sm hover:bg-yellow-300 hover:text-black transition-colors">
                  ↺ ACTUALIZAR
                </button>
              </div>
              {alliances.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-black text-xl">Sin alianzas aún</p>
                  <p className="font-mono text-sm mt-2 opacity-60">Crea la primera con el formulario de arriba</p>
                </div>
              ) : (
                <div>
                  {alliances.map(a => {
                    const isExpired = a.endDate && new Date(a.endDate) < new Date();
                    const daysLeft = a.endDate
                      ? Math.max(0, Math.ceil((new Date(a.endDate) - new Date()) / 86400000))
                      : null;
                    return (
                      <div key={a._id} className="border-b-4 border-black last:border-b-0 p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-start gap-3">
                            <div className="w-14 h-14 border-2 border-black flex items-center justify-center text-3xl shrink-0 bg-yellow-300">
                              {a.emoji}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-black text-lg">{a.name}</p>
                                {isExpired && (
                                  <span className="bg-red-200 border-2 border-black font-black text-xs px-2 py-0.5">EXPIRADA</span>
                                )}
                                {!isExpired && a.isActive && (
                                  <span className="bg-green-300 border-2 border-black font-black text-xs px-2 py-0.5">ACTIVA</span>
                                )}
                                {!a.isActive && (
                                  <span className="bg-gray-200 border-2 border-black font-black text-xs px-2 py-0.5">INACTIVA</span>
                                )}
                              </div>
                              {a.description && (
                                <p className="font-mono text-sm text-gray-600 mt-0.5">{a.description}</p>
                              )}
                              <div className="flex gap-3 mt-2 font-mono text-xs flex-wrap">
                                <span className="border border-black px-2 py-0.5 font-bold">
                                  Conversión: {a.conversionRate}x
                                </span>
                                {daysLeft !== null ? (
                                  <span className={`border border-black px-2 py-0.5 font-bold ${daysLeft <= 3 ? 'bg-red-100' : 'bg-white'}`}>
                                    {daysLeft === 0 ? '¡Expira hoy!' : `${daysLeft} días restantes`}
                                  </span>
                                ) : (
                                  <span className="border border-black px-2 py-0.5 font-bold bg-yellow-100">PERMANENTE</span>
                                )}
                              </div>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {(a.restaurants || []).map(r => (
                                  <span key={r._id} className="bg-white border-2 border-black font-mono text-xs px-2 py-0.5">
                                    {r.emoji} {r.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => toggleAlliance(a._id, a.isActive)}
                              className={`border-4 border-black font-black text-xs px-4 py-2 transition-colors ${
                                a.isActive ? 'bg-gray-200 hover:bg-gray-300' : 'bg-green-300 hover:bg-green-400'
                              }`}
                            >
                              {a.isActive ? 'PAUSAR' : 'ACTIVAR'}
                            </button>
                            <button
                              onClick={() => deleteAlliance(a._id)}
                              className="border-4 border-black bg-red-300 font-black text-xs px-4 py-2 hover:bg-red-400 transition-colors"
                            >
                              ✕ ELIMINAR
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── CHALLENGES TAB ────────────────────────────── */}
        {activeTab === 'challenges' && (
          <div className="space-y-8">
            {/* Create challenge */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-yellow-300">
                <h2 className="text-2xl font-black uppercase">NUEVO DESAFÍO</h2>
                <p className="font-mono text-sm mt-1 opacity-70">Retos mensuales o semanales para mantener clientes activos</p>
              </div>
              <form onSubmit={createChallenge} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-black text-sm mb-1">NOMBRE *</label>
                  <input
                    type="text"
                    value={newChallenge.name}
                    onChange={e => setNewChallenge(p => ({ ...p, name: e.target.value }))}
                    placeholder="Visita 5 restaurantes este mes"
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none focus:bg-yellow-50"
                    required
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">EMOJI</label>
                  <div className="flex gap-2 flex-wrap">
                    {['⚡','🔥','🏃','🌟','💪','🎯','🗓️','🤝'].map(em => (
                      <button key={em} type="button"
                        onClick={() => setNewChallenge(p => ({ ...p, emoji: em }))}
                        className={`text-xl border-2 p-1 ${newChallenge.emoji === em ? 'border-black bg-yellow-300' : 'border-gray-300'}`}
                      >{em}</button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block font-black text-sm mb-1">DESCRIPCIÓN</label>
                  <input
                    type="text"
                    value={newChallenge.description}
                    onChange={e => setNewChallenge(p => ({ ...p, description: e.target.value }))}
                    placeholder="Visita restaurantes diferentes para completar el desafío"
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none focus:bg-yellow-50"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">MÉTRICA</label>
                  <select
                    value={newChallenge.metric}
                    onChange={e => setNewChallenge(p => ({ ...p, metric: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  >
                    <option value="visits">Visitas totales</option>
                    <option value="points_earned">Puntos ganados</option>
                    <option value="restaurants">Restaurantes únicos</option>
                    <option value="referrals">Referidos</option>
                    <option value="redeems">Canjes</option>
                  </select>
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">META (número)</label>
                  <input
                    type="number" min="1"
                    value={newChallenge.target}
                    onChange={e => setNewChallenge(p => ({ ...p, target: parseInt(e.target.value) }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">PUNTOS BONUS *</label>
                  <input
                    type="number" min="1"
                    value={newChallenge.bonusPoints}
                    onChange={e => setNewChallenge(p => ({ ...p, bonusPoints: parseInt(e.target.value) }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">NOMBRE DEL BONUS</label>
                  <input
                    type="text"
                    value={newChallenge.bonusName}
                    onChange={e => setNewChallenge(p => ({ ...p, bonusName: e.target.value }))}
                    placeholder="Explorador del Mes"
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">FECHA INICIO</label>
                  <input
                    type="datetime-local"
                    value={newChallenge.startDate}
                    onChange={e => setNewChallenge(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm mb-1">FECHA FIN</label>
                  <input
                    type="datetime-local"
                    value={newChallenge.endDate}
                    onChange={e => setNewChallenge(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={challengeLoading}
                    className="w-full bg-black text-yellow-300 font-black text-lg py-4 border-4 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                  >
                    {challengeLoading ? 'CREANDO...' : 'CREAR DESAFÍO'}
                  </button>
                </div>
              </form>
            </div>

            {/* Challenges list */}
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-black text-yellow-300 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase">DESAFÍOS</h2>
                <button onClick={fetchChallenges} className="border-2 border-yellow-300 px-3 py-1 font-mono text-sm hover:bg-yellow-300 hover:text-black transition-colors">
                  ↺ ACTUALIZAR
                </button>
              </div>
              {challenges.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-black text-xl">Sin desafíos aún</p>
                  <p className="font-mono text-sm mt-2 opacity-60">Crea el primero con el formulario de arriba</p>
                </div>
              ) : (
                <div className="divide-y-4 divide-black">
                  {challenges.map(ch => (
                    <div key={ch._id} className="p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{ch.emoji}</span>
                        <div>
                          <p className="font-black text-lg">{ch.name}</p>
                          <p className="font-mono text-sm opacity-60">{ch.description}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <span className="border border-black px-2 py-0.5 font-mono text-xs">{ch.metric} × {ch.target}</span>
                            <span className="border border-black px-2 py-0.5 font-mono text-xs bg-yellow-100">+{ch.bonusPoints}pts</span>
                            <span className={`px-2 py-0.5 font-bold text-xs border ${ch.isActive ? 'bg-green-100 border-green-400' : 'bg-gray-100 border-gray-400'}`}>
                              {ch.isActive ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => toggleChallenge(ch._id, ch.isActive)}
                          className={`border-4 border-black font-black text-xs px-4 py-2 transition-colors ${ch.isActive ? 'bg-gray-200 hover:bg-gray-300' : 'bg-yellow-300 hover:bg-yellow-400'}`}
                        >
                          {ch.isActive ? 'PAUSAR' : 'ACTIVAR'}
                        </button>
                        <button
                          onClick={() => deleteChallenge(ch._id)}
                          className="border-4 border-black bg-red-300 font-black text-xs px-4 py-2 hover:bg-red-400 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BROADCAST TAB ─────────────────────────────── */}
        {activeTab === 'broadcast' && (
          <div className="max-w-2xl space-y-8">
            <div className="border-4 border-black shadow-brutal bg-white">
              <div className="p-5 border-b-4 border-black bg-green-400">
                <h2 className="text-2xl font-black uppercase">BROADCAST WHATSAPP</h2>
                <p className="font-mono text-sm mt-1 opacity-70">Envía un mensaje masivo a tus clientes via WhatsApp</p>
              </div>
              <form onSubmit={sendBroadcast} className="p-6 space-y-5">
                <div>
                  <label className="block font-black text-sm mb-1">SEGMENTO</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: 'all', label: 'TODOS' },
                      { id: 'BRONCE', label: 'BRONCE' },
                      { id: 'PLATA', label: 'PLATA' },
                      { id: 'ORO', label: 'ORO' },
                    ].map(seg => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => setBroadcastSegment(seg.id)}
                        className={`border-4 border-black font-black text-sm py-3 transition-all ${
                          broadcastSegment === seg.id ? 'bg-black text-yellow-300' : 'bg-white hover:bg-yellow-50'
                        }`}
                      >
                        {seg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-black text-sm mb-1">MENSAJE *</label>
                  <textarea
                    value={broadcastMsg}
                    onChange={e => setBroadcastMsg(e.target.value)}
                    placeholder="Hola {nombre}! 🎉 Este fin de semana: 2x puntos en todos los restaurantes Reguards. ¡No te lo pierdas!"
                    rows={5}
                    maxLength={1000}
                    className="w-full border-4 border-black px-3 py-3 font-mono text-sm resize-none focus:outline-none focus:bg-yellow-50"
                    required
                  />
                  <p className="font-mono text-xs opacity-50 mt-1">{broadcastMsg.length}/1000 caracteres</p>
                </div>

                <div className="border-4 border-black p-4 flex items-center justify-between">
                  <div>
                    <p className="font-black text-sm">MODO SIMULACIÓN</p>
                    <p className="font-mono text-xs opacity-60">Prueba sin enviar mensajes reales</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBroadcastDryRun(d => !d)}
                    className={`border-4 border-black font-black text-sm px-4 py-2 transition-all ${
                      broadcastDryRun ? 'bg-yellow-300' : 'bg-green-400'
                    }`}
                  >
                    {broadcastDryRun ? 'SIMULACIÓN' : 'REAL'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={broadcastLoading}
                  className={`w-full font-black text-lg py-4 border-4 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40 ${
                    broadcastDryRun ? 'bg-yellow-300' : 'bg-green-400'
                  }`}
                >
                  {broadcastLoading
                    ? 'PROCESANDO...'
                    : broadcastDryRun
                    ? 'SIMULAR ENVÍO'
                    : 'ENVIAR A CLIENTES'}
                </button>
              </form>
            </div>

            {broadcastResult && (
              <div className={`border-4 border-black p-6 shadow-brutal ${broadcastDryRun ? 'bg-yellow-100' : 'bg-green-100'}`}>
                <h3 className="font-black text-xl mb-3">
                  {broadcastResult.dryRun ? 'RESULTADO DE SIMULACIÓN' : 'ENVÍO COMPLETADO'}
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="border-4 border-black bg-white p-3">
                    <p className="font-black text-3xl">{broadcastResult.total}</p>
                    <p className="font-mono text-xs">DESTINATARIOS</p>
                  </div>
                  <div className="border-4 border-black bg-green-200 p-3">
                    <p className="font-black text-3xl">{broadcastResult.sent || broadcastResult.total}</p>
                    <p className="font-mono text-xs">ENVIADOS</p>
                  </div>
                  <div className="border-4 border-black bg-red-100 p-3">
                    <p className="font-black text-3xl">{broadcastResult.failed || 0}</p>
                    <p className="font-mono text-xs">FALLIDOS</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
