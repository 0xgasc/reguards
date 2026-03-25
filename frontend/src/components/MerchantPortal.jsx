/**
 * MerchantPortal — self-service dashboard for restaurant owners.
 *
 * Tabs:
 *  POS       — record customer purchase (same as admin POS but scoped to their restaurant)
 *  Premios   — manage custom rewards catalog
 *  Analytics — their restaurant's stats
 *  Ajustes   — restaurant profile, API key, integration guide
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Copy, Check, Camera, CameraOff } from 'lucide-react';
import useAuthStore from '../store/auth-store';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const EMOJI_PICKS = ['🍽️','☕','🍕','🌮','🥩','🍜','🍣','🥗','🍰','🍺','🥤','🍔'];
const COLOR_PICKS = ['#FFFF00','#FF0000','#0000FF','#00FF00','#FF69B4','#FFA500','#9B59B6','#000000'];

function BarChart({ data, valueKey, color = '#FFFF00', labelColor = '#000' }) {
    const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
    return (
        <div className="flex items-end gap-1 h-32 overflow-hidden">
            {data.map((d, i) => {
                const val = d[valueKey] || 0;
                const pct = Math.round((val / max) * 100);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="w-full relative" style={{ height: '96px' }}>
                            {val > 0 && (
                                <div
                                    className="absolute bottom-0 w-full border-2 border-black transition-all"
                                    style={{ height: `${pct}%`, backgroundColor: color }}
                                />
                            )}
                        </div>
                        <p className="font-mono text-[9px] text-gray-500 truncate w-full text-center">
                            {d.label?.split(' ')[0]}
                        </p>
                        {val > 0 && (
                            <p className="font-black text-[9px]">{val}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function MerchantPortal() {
    const { user, token, logout } = useAuthStore();
    const navigate = useNavigate();

    const [tab, setTab] = useState('pos');
    const [restaurant, setRestaurant] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    // POS state
    const [posPhone, setPosPhone] = useState('');
    const [posAmount, setPosAmount] = useState('');
    const [posDesc, setPosDesc] = useState('');
    const [posResult, setPosResult] = useState(null);
    const [posLoading, setPosLoading] = useState(false);

    // Rewards state
    const [newReward, setNewReward] = useState({ name: '', description: '', points: '', emoji: '🎁' });
    const [rewardLoading, setRewardLoading] = useState(false);

    // Settings state
    const [settings, setSettings] = useState({});
    const [settingsLoading, setSettingsLoading] = useState(false);

    // Validate redemption code state
    const [redeemCode, setRedeemCode] = useState('');
    const [redeemResult, setRedeemResult] = useState(null);
    const [redeemLoading, setRedeemLoading] = useState(false);

    // Reviews state
    const [reviews, setReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);

    // QR scanner state
    const [scanning, setScanning] = useState(false);
    const videoRef = useRef(null);
    const scanIntervalRef = useRef(null);

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        if (!user || !token) { navigate('/login'); return; }
        if (user.role !== 'merchant' && user.role !== 'admin') { navigate('/dashboard'); return; }
        fetchRestaurant();
    }, [user, token]);

    async function fetchRestaurant() {
        try {
            const [restRes, analyticsRes] = await Promise.all([
                axios.get(`${API_URL}/api/merchant/me`, { headers }),
                axios.get(`${API_URL}/api/merchant/analytics`, { headers }).catch(() => ({ data: null })),
            ]);
            setRestaurant(restRes.data.restaurant);
            setAnalytics(analyticsRes.data);
            setSettings({
                name: restRes.data.restaurant.name,
                emoji: restRes.data.restaurant.emoji,
                accentColor: restRes.data.restaurant.accentColor,
                description: restRes.data.restaurant.description || '',
                address: restRes.data.restaurant.address || '',
                phone: restRes.data.restaurant.phone || '',
                pointsPerQuetzal: restRes.data.restaurant.pointsPerQuetzal,
                welcomeBonus: restRes.data.restaurant.welcomeBonus || 0,
            });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error cargando restaurante');
        } finally {
            setLoading(false);
        }
    }

    // ── Reviews ────────────────────────────────────────────────────────────────

    async function fetchReviews() {
        if (!restaurant?._id) return;
        setReviewsLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/reviews/merchant/mine`, { headers });
            setReviews(res.data.reviews || []);
        } catch {
            toast.error('Error cargando reseñas');
        } finally {
            setReviewsLoading(false);
        }
    }

    async function toggleReviewVisibility(id, current) {
        try {
            await axios.patch(`${API_URL}/api/reviews/${id}/visibility`, {}, { headers });
            setReviews(rs => rs.map(r => r._id === id ? { ...r, isVisible: !current } : r));
            toast.success(current ? 'Reseña oculta' : 'Reseña visible');
        } catch {
            toast.error('Error');
        }
    }

    useEffect(() => {
        if (tab === 'reviews') fetchReviews();
    }, [tab]);

    // ── POS ────────────────────────────────────────────────────────────────────

    async function recordPurchase(e) {
        e.preventDefault();
        if (!posPhone || !posAmount) { toast.error('Teléfono y monto requeridos'); return; }
        setPosLoading(true); setPosResult(null);
        try {
            const res = await axios.post(`${API_URL}/api/merchant/record-purchase`, {
                customerPhone: posPhone.startsWith('+') ? posPhone : `+502${posPhone}`,
                amountQuetzales: posAmount,
                description: posDesc || undefined,
            }, { headers });
            setPosResult(res.data);
            toast.success(`¡${res.data.pointsEarned} puntos otorgados!`);
            setPosPhone(''); setPosAmount(''); setPosDesc('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error');
        } finally {
            setPosLoading(false);
        }
    }

    // ── Rewards ────────────────────────────────────────────────────────────────

    async function addReward(e) {
        e.preventDefault();
        if (!newReward.name || !newReward.points) { toast.error('Nombre y puntos requeridos'); return; }
        setRewardLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/merchant/rewards`, newReward, { headers });
            setRestaurant(r => ({ ...r, rewards: res.data.rewards }));
            setNewReward({ name: '', description: '', points: '', emoji: '🎁' });
            toast.success('Premio agregado');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error');
        } finally {
            setRewardLoading(false);
        }
    }

    async function toggleReward(rewardId, isActive) {
        try {
            const res = await axios.put(`${API_URL}/api/merchant/rewards/${rewardId}`,
                { isActive }, { headers });
            setRestaurant(r => ({ ...r, rewards: res.data.rewards }));
        } catch (err) { toast.error('Error'); }
    }

    async function deleteReward(rewardId) {
        try {
            await axios.delete(`${API_URL}/api/merchant/rewards/${rewardId}`, { headers });
            setRestaurant(r => ({ ...r, rewards: r.rewards.filter(rw => rw._id !== rewardId) }));
            toast.success('Premio eliminado');
        } catch (err) { toast.error('Error'); }
    }

    // ── Validate redemption code ───────────────────────────────────────────────

    async function validateCode(e) {
        e?.preventDefault();
        if (!redeemCode.trim()) { toast.error('Ingresa el código'); return; }
        setRedeemLoading(true); setRedeemResult(null);
        try {
            const res = await axios.post(`${API_URL}/api/merchant/validate-redemption`,
                { code: redeemCode.trim().toUpperCase() }, { headers });
            setRedeemResult({ success: true, ...res.data });
            toast.success(res.data.message || 'Premio validado');
            setRedeemCode('');
        } catch (err) {
            setRedeemResult({ success: false, error: err.response?.data?.error || 'Error' });
            toast.error(err.response?.data?.error || 'Código inválido');
        } finally {
            setRedeemLoading(false);
        }
    }

    // ── QR scanner (BarcodeDetector API — Chrome Android) ─────────────────────

    const stopScanner = useCallback(() => {
        if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        setScanning(false);
    }, []);

    async function startQRScanner() {
        if (!('BarcodeDetector' in window)) {
            toast.error('Tu navegador no soporta escaneo QR. Usa Chrome en Android.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (!videoRef.current) return;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);

            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

            scanIntervalRef.current = setInterval(async () => {
                if (!videoRef.current || videoRef.current.readyState < 2) return;
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0) {
                        const raw = barcodes[0].rawValue;
                        stopScanner();
                        // QR payload can be JSON {phone, id, t} — extract phone for POS
                        try {
                            const data = JSON.parse(raw);
                            if (data.phone) {
                                const digits = data.phone.replace(/^\+502/, '');
                                setPosPhone(digits);
                                toast.success(`Cliente: ${data.phone}`);
                            }
                        } catch {
                            // Maybe it's just a plain code string — try as redemption code
                            if (/^[A-F0-9]{6}$/.test(raw)) {
                                setRedeemCode(raw);
                                toast.success(`Código de canje: ${raw}`);
                            } else {
                                toast.error('QR no reconocido');
                            }
                        }
                    }
                } catch { /* detector not ready yet */ }
            }, 300);
        } catch (err) {
            toast.error('No se pudo acceder a la cámara');
        }
    }

    // Clean up scanner on unmount
    useEffect(() => { return stopScanner; }, [stopScanner]);

    // ── Settings ───────────────────────────────────────────────────────────────

    async function saveSettings(e) {
        e.preventDefault();
        setSettingsLoading(true);
        try {
            await axios.put(`${API_URL}/api/merchant/me`, settings, { headers });
            await fetchRestaurant();
            toast.success('Cambios guardados');
        } catch (err) {
            toast.error('Error guardando');
        } finally {
            setSettingsLoading(false);
        }
    }

    async function rotateKey() {
        if (!window.confirm('¿Generar una nueva API Key? La anterior dejará de funcionar.')) return;
        try {
            const res = await axios.post(`${API_URL}/api/merchant/rotate-key`, {}, { headers });
            setRestaurant(r => ({ ...r, apiKey: res.data.apiKey }));
            toast.success('Nueva API Key generada');
        } catch (err) { toast.error('Error'); }
    }

    function copyKey() {
        navigator.clipboard.writeText(restaurant.apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('API Key copiada');
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-black border-t-yellow-300 animate-spin mx-auto" />
                    <p className="mt-4 font-black">CARGANDO...</p>
                </div>
            </div>
        );
    }

    const accent = restaurant?.accentColor || '#FFFF00';

    const TABS = [
        { id: 'pos',       label: 'POS' },
        { id: 'premios',   label: 'Premios' },
        { id: 'analytics', label: 'Stats' },
        { id: 'reviews',   label: 'Reseñas' },
        { id: 'ajustes',   label: 'Ajustes' },
    ];

    return (
        <div className="min-h-screen bg-white font-sans">
            {/* Header */}
            <header className="border-b-4 border-black" style={{ backgroundColor: accent }}>
                <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-16">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{restaurant?.emoji}</span>
                        <div>
                            <p className="font-black text-sm leading-none">{restaurant?.name}</p>
                            <p className="font-mono text-xs opacity-60">Portal de comerciante</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="border-2 border-black p-2 hover:bg-black hover:text-white transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b-4 border-black flex max-w-2xl mx-auto">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 py-3 font-black text-xs border-r-2 border-black last:border-r-0 transition-colors
                            ${tab === t.id ? 'bg-black text-yellow-300' : 'bg-white hover:bg-gray-50'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

                {/* ── POS ─────────────────────────────────────────── */}
                {tab === 'pos' && (
                    <div className="space-y-6">
                        <div className="border-4 border-black shadow-brutal bg-white p-6">
                            <h2 className="font-black text-xl mb-5">REGISTRAR COMPRA</h2>
                            <form onSubmit={recordPurchase} className="space-y-4">
                                <div>
                                    <label className="block font-black text-sm mb-1">TELÉFONO DEL CLIENTE</label>
                                    <div className="flex border-4 border-black">
                                        <span className="px-3 py-3 font-mono font-bold border-r-4 border-black bg-gray-100 text-sm">+502</span>
                                        <input
                                            type="tel"
                                            value={posPhone}
                                            onChange={e => setPosPhone(e.target.value.replace(/\D/g,'').slice(0,8))}
                                            placeholder="5555-5555"
                                            className="flex-1 px-3 py-3 font-mono focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={scanning ? stopScanner : startQRScanner}
                                            className="px-3 border-l-4 border-black hover:bg-yellow-50 transition-colors"
                                            title="Escanear QR del cliente"
                                        >
                                            {scanning ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {/* QR scanner video */}
                                    {scanning && (
                                        <div className="mt-2 border-4 border-black relative">
                                            <video ref={videoRef} className="w-full" playsInline muted />
                                            <div className="absolute inset-0 border-4 border-yellow-300 opacity-50 pointer-events-none" />
                                            <p className="absolute bottom-0 left-0 right-0 bg-black text-yellow-300 font-mono text-xs text-center py-1">
                                                Apunta la cámara al QR del cliente
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block font-black text-sm mb-1">MONTO (Q)</label>
                                    <div className="flex border-4 border-black">
                                        <span className="px-3 py-3 font-mono font-bold border-r-4 border-black bg-gray-100">Q</span>
                                        <input
                                            type="number"
                                            value={posAmount}
                                            onChange={e => setPosAmount(e.target.value)}
                                            placeholder="0.00"
                                            min="1"
                                            step="0.01"
                                            className="flex-1 px-3 py-3 font-mono focus:outline-none text-xl"
                                        />
                                    </div>
                                    {posAmount && restaurant && (
                                        <p className="font-mono text-xs mt-1 opacity-60">
                                            = <strong>{Math.floor(parseFloat(posAmount || 0) * restaurant.pointsPerQuetzal)}</strong> puntos para el cliente
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block font-black text-sm mb-1">DESCRIPCIÓN (opcional)</label>
                                    <input
                                        type="text"
                                        value={posDesc}
                                        onChange={e => setPosDesc(e.target.value)}
                                        placeholder="Almuerzo ejecutivo"
                                        className="w-full border-4 border-black px-3 py-3 font-mono focus:outline-none focus:bg-yellow-50"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={posLoading}
                                    className="w-full border-4 border-black font-black text-lg py-4 shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                                    style={{ backgroundColor: accent }}
                                >
                                    {posLoading ? '...' : '✓ REGISTRAR COMPRA'}
                                </button>
                            </form>
                        </div>

                        {/* POS result */}
                        {posResult && (
                            <div className="border-4 border-black bg-black text-yellow-300 p-6 text-center shadow-brutal">
                                <p className="font-mono text-sm mb-2">PUNTOS OTORGADOS</p>
                                <p className="font-black text-6xl">+{posResult.pointsEarned}</p>
                                <p className="font-mono text-sm mt-3">
                                    Cliente: <strong>{posResult.customer?.phone}</strong>
                                </p>
                                <p className="font-mono text-sm">
                                    Saldo total: <strong>{posResult.newBalance}</strong> pts · Nivel: <strong>{posResult.customer?.tier}</strong>
                                </p>
                            </div>
                        )}

                        {/* ── Validate redemption code ────────────────── */}
                        <div className="border-4 border-black shadow-brutal bg-white p-6">
                            <h2 className="font-black text-xl mb-1">VALIDAR CANJE</h2>
                            <p className="font-mono text-xs mb-4 opacity-60">
                                El cliente muestra un código de 6 letras desde su app. Ingrésalo aquí para validarlo.
                            </p>
                            <form onSubmit={validateCode} className="flex gap-2">
                                <input
                                    type="text"
                                    value={redeemCode}
                                    onChange={e => setRedeemCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,6))}
                                    placeholder="A3F9B2"
                                    maxLength={6}
                                    className="flex-1 border-4 border-black px-4 py-3 font-mono text-2xl font-black tracking-widest focus:outline-none focus:bg-yellow-50 text-center"
                                />
                                <button
                                    type="submit"
                                    disabled={redeemLoading || redeemCode.length !== 6}
                                    className="border-4 border-black font-black px-5 py-3 shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                                    style={{ backgroundColor: accent }}
                                >
                                    {redeemLoading ? '...' : '✓'}
                                </button>
                            </form>

                            {redeemResult && (
                                <div className={`mt-4 border-4 border-black p-4 text-center ${redeemResult.success ? 'bg-green-200' : 'bg-red-200'}`}>
                                    {redeemResult.success ? (
                                        <>
                                            <p className="font-black text-2xl">{redeemResult.reward?.emoji} {redeemResult.reward?.name}</p>
                                            <p className="font-mono text-sm mt-1">✓ Canjeado para {redeemResult.customer?.phone}</p>
                                        </>
                                    ) : (
                                        <p className="font-black">{redeemResult.error}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── PREMIOS ──────────────────────────────────────── */}
                {tab === 'premios' && (
                    <div className="space-y-6">
                        {/* Current rewards */}
                        <div className="border-4 border-black shadow-brutal bg-white">
                            <div className="border-b-4 border-black px-5 py-3 flex items-center justify-between"
                                 style={{ backgroundColor: accent }}>
                                <h2 className="font-black text-lg">TUS PREMIOS</h2>
                                <span className="font-mono text-xs">
                                    {restaurant?.plan === 'free' ? `${restaurant?.rewards?.filter(r=>r.isActive).length}/3 (plan gratuito)` : 'ilimitados'}
                                </span>
                            </div>
                            {(!restaurant?.rewards?.length) ? (
                                <div className="p-8 text-center font-mono opacity-60">Sin premios aún</div>
                            ) : (
                                restaurant.rewards.map(rw => (
                                    <div key={rw._id}
                                         className={`flex items-center justify-between px-5 py-4 border-b-2 border-black last:border-b-0 ${!rw.isActive ? 'opacity-40' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{rw.emoji}</span>
                                            <div>
                                                <p className="font-black text-sm">{rw.name}</p>
                                                {rw.description && <p className="font-mono text-xs opacity-60">{rw.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="font-black font-mono text-sm border-2 border-black px-2 py-1">
                                                {rw.points}pts
                                            </span>
                                            <button
                                                onClick={() => toggleReward(rw._id, !rw.isActive)}
                                                className={`border-2 border-black font-mono text-xs px-2 py-1 transition-colors ${rw.isActive ? 'bg-yellow-300 hover:bg-gray-200' : 'bg-gray-200 hover:bg-yellow-300'}`}
                                            >
                                                {rw.isActive ? 'ACTIVO' : 'INACTIVO'}
                                            </button>
                                            <button
                                                onClick={() => deleteReward(rw._id)}
                                                className="border-2 border-black bg-red-200 font-black text-xs px-2 py-1 hover:bg-red-400 transition-colors"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add reward form */}
                        <div className="border-4 border-black shadow-brutal bg-white p-6">
                            <h3 className="font-black text-lg mb-4">+ AGREGAR PREMIO</h3>
                            <form onSubmit={addReward} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-black text-xs mb-1">NOMBRE *</label>
                                        <input
                                            type="text"
                                            value={newReward.name}
                                            onChange={e => setNewReward(p => ({...p, name: e.target.value}))}
                                            placeholder="CAFÉ GRATIS"
                                            className="w-full border-4 border-black px-3 py-2 font-mono text-sm focus:outline-none focus:bg-yellow-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-black text-xs mb-1">PUNTOS *</label>
                                        <input
                                            type="number"
                                            value={newReward.points}
                                            onChange={e => setNewReward(p => ({...p, points: e.target.value}))}
                                            min="1"
                                            placeholder="100"
                                            className="w-full border-4 border-black px-3 py-2 font-mono text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-black text-xs mb-1">DESCRIPCIÓN</label>
                                    <input
                                        type="text"
                                        value={newReward.description}
                                        onChange={e => setNewReward(p => ({...p, description: e.target.value}))}
                                        placeholder="Un café de tu elección"
                                        className="w-full border-4 border-black px-3 py-2 font-mono text-sm focus:outline-none focus:bg-yellow-50"
                                    />
                                </div>
                                <div>
                                    <label className="block font-black text-xs mb-2">EMOJI</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['🎁','☕','🥤','🍰','🍕','🌮','🥩','🎟️','🏷️','🎉'].map(e => (
                                            <button key={e} type="button"
                                                onClick={() => setNewReward(p => ({...p, emoji: e}))}
                                                className={`text-2xl border-2 p-1 ${newReward.emoji === e ? 'border-black scale-125' : 'border-gray-300'}`}
                                            >{e}</button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={rewardLoading}
                                    className="w-full border-4 border-black font-black py-3 shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                                    style={{ backgroundColor: accent }}
                                >
                                    {rewardLoading ? '...' : '+ AGREGAR PREMIO'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── ANALYTICS ────────────────────────────────────── */}
                {tab === 'analytics' && analytics && (
                    <div className="space-y-5">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'CLIENTES', value: analytics.overview?.uniqueCustomers ?? 0, bg: 'bg-yellow-300' },
                                { label: 'VISITAS TOTALES', value: analytics.overview?.totalTransactions ?? 0, bg: 'bg-white' },
                                { label: 'PTS EMITIDOS', value: analytics.overview?.totalPointsIssued ?? 0, bg: 'bg-white' },
                                { label: 'PTS CANJEADOS', value: analytics.overview?.totalPointsRedeemed ?? 0, bg: 'bg-red-100' },
                            ].map(({ label, value, bg }) => (
                                <div key={label} className={`border-4 border-black p-4 shadow-brutal-sm ${bg}`}>
                                    <p className="font-mono text-xs opacity-60 mb-1">{label}</p>
                                    <p className="font-black text-3xl font-mono">{value.toLocaleString()}</p>
                                </div>
                            ))}
                        </div>

                        {/* Redemption ratio */}
                        {analytics.overview?.totalPointsIssued > 0 && (
                            <div className="border-4 border-black p-5 bg-white shadow-brutal-sm">
                                <p className="font-black text-sm mb-3">TASA DE CANJE</p>
                                <div className="h-5 border-2 border-black bg-gray-100 overflow-hidden">
                                    <div
                                        className="h-full bg-black transition-all"
                                        style={{
                                            width: `${Math.min(100, Math.round((analytics.overview.totalPointsRedeemed / analytics.overview.totalPointsIssued) * 100))}%`
                                        }}
                                    />
                                </div>
                                <p className="font-mono text-xs mt-1 opacity-60">
                                    {Math.round((analytics.overview.totalPointsRedeemed / analytics.overview.totalPointsIssued) * 100)}% de puntos emitidos han sido canjeados
                                </p>
                            </div>
                        )}

                        {/* Daily activity bar chart */}
                        {analytics.dailyActivity?.length > 0 && (
                            <div className="border-4 border-black p-5 bg-white shadow-brutal-sm">
                                <p className="font-black text-sm mb-4">VISITAS — ÚLTIMOS 14 DÍAS</p>
                                <BarChart
                                    data={analytics.dailyActivity}
                                    valueKey="visits"
                                    color="#FFFF00"
                                />
                            </div>
                        )}

                        {/* Points issued bar chart */}
                        {analytics.dailyActivity?.length > 0 && (
                            <div className="border-4 border-black p-5 bg-white shadow-brutal-sm">
                                <p className="font-black text-sm mb-4">PUNTOS EMITIDOS — ÚLTIMOS 14 DÍAS</p>
                                <BarChart
                                    data={analytics.dailyActivity}
                                    valueKey="pointsIssued"
                                    color="#000"
                                    labelColor="#fff"
                                />
                            </div>
                        )}

                        {/* Top customers */}
                        {analytics.topCustomers?.length > 0 && (
                            <div className="border-4 border-black bg-white shadow-brutal-sm">
                                <div className="border-b-4 border-black px-5 py-3 bg-black text-yellow-300">
                                    <p className="font-black text-sm">TOP CLIENTES</p>
                                </div>
                                {analytics.topCustomers.map((c, i) => (
                                    <div key={i} className="flex items-center gap-4 px-5 py-3 border-b-2 border-black last:border-b-0">
                                        <span className="font-black text-2xl w-8 text-center">
                                            {`#${i+1}`}
                                        </span>
                                        <span className="font-mono text-sm flex-1">{c.phone}</span>
                                        <span className="font-black font-mono text-lg">{c.points.toLocaleString()} pts</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Plan & settings summary */}
                        <div className="border-4 border-black p-5 bg-black text-yellow-300 shadow-brutal">
                            <p className="font-mono text-xs mb-1 opacity-60">PLAN ACTIVO</p>
                            <p className="font-black text-2xl">{(analytics.restaurant?.plan || 'free').toUpperCase()}</p>
                            <p className="font-mono text-xs mt-2 opacity-60">
                                {analytics.overview?.pointsPerQuetzal}pt/Q1 ·{' '}
                                {analytics.restaurant?.rewardCount} premio{analytics.restaurant?.rewardCount !== 1 ? 's' : ''} activo{analytics.restaurant?.rewardCount !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                )}

                {/* ── REVIEWS ──────────────────────────────────────── */}
                {tab === 'reviews' && (
                    <div className="space-y-4">
                        <div className="border-4 border-black bg-white shadow-brutal p-5">
                            <h2 className="font-black text-xl mb-1">RESEÑAS DE CLIENTES</h2>
                            <p className="font-mono text-sm opacity-60 mb-4">Puedes ocultar reseñas que no quieras mostrar públicamente.</p>
                            {reviewsLoading ? (
                                <div className="text-center py-8">
                                    <div className="w-8 h-8 border-4 border-black border-t-yellow-300 animate-spin mx-auto" />
                                </div>
                            ) : reviews.length === 0 ? (
                                <div className="border-4 border-black p-8 text-center bg-gray-50">
                                    <p className="font-black">AÚN NO HAY RESEÑAS</p>
                                    <p className="font-mono text-sm opacity-60 mt-1">Las reseñas aparecerán aquí cuando los clientes visiten tu perfil</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {reviews.map(rv => (
                                        <div
                                            key={rv._id}
                                            className={`border-4 border-black p-4 ${!rv.isVisible ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">{rv.emoji || '⭐'}</span>
                                                    <div>
                                                        <p className="font-black text-sm">{'⭐'.repeat(rv.rating)}</p>
                                                        <p className="font-mono text-xs opacity-50">
                                                            {rv.user?.phone?.slice(-6) || 'Cliente'} · {new Date(rv.createdAt).toLocaleDateString('es-GT')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleReviewVisibility(rv._id, rv.isVisible)}
                                                    className={`shrink-0 border-2 border-black font-black text-xs px-3 py-1 transition-colors ${
                                                        rv.isVisible ? 'bg-white hover:bg-red-100' : 'bg-gray-200 hover:bg-green-100'
                                                    }`}
                                                >
                                                    {rv.isVisible ? 'OCULTAR' : 'MOSTRAR'}
                                                </button>
                                            </div>
                                            {rv.text && (
                                                <p className="font-mono text-sm mt-2 opacity-80 border-t-2 border-black pt-2">{rv.text}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── AJUSTES ──────────────────────────────────────── */}
                {tab === 'ajustes' && (
                    <div className="space-y-6">
                        {/* Profile */}
                        <div className="border-4 border-black shadow-brutal bg-white p-6">
                            <h2 className="font-black text-xl mb-5">PERFIL DEL RESTAURANTE</h2>
                            <form onSubmit={saveSettings} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-black text-xs mb-1">NOMBRE</label>
                                        <input
                                            type="text"
                                            value={settings.name || ''}
                                            onChange={e => setSettings(p => ({...p, name: e.target.value}))}
                                            className="w-full border-4 border-black px-3 py-2 font-mono text-sm focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-black text-xs mb-1">EMOJI</label>
                                        <div className="flex flex-wrap gap-1">
                                            {EMOJI_PICKS.map(e => (
                                                <button key={e} type="button"
                                                    onClick={() => setSettings(p => ({...p, emoji: e}))}
                                                    className={`text-xl border-2 p-1 ${settings.emoji === e ? 'border-black scale-110' : 'border-gray-300'}`}
                                                >{e}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-black text-xs mb-2">COLOR DE ACENTO</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {COLOR_PICKS.map(c => (
                                            <button key={c} type="button"
                                                onClick={() => setSettings(p => ({...p, accentColor: c}))}
                                                className={`w-9 h-9 border-4 ${settings.accentColor === c ? 'border-black scale-110' : 'border-gray-300'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-black text-xs mb-1">PTS POR Q1 GASTADO</label>
                                        <input
                                            type="number"
                                            value={settings.pointsPerQuetzal || 1}
                                            onChange={e => setSettings(p => ({...p, pointsPerQuetzal: parseFloat(e.target.value)}))}
                                            min="0.1" step="0.1"
                                            className="w-full border-4 border-black px-3 py-2 font-mono text-sm focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-black text-xs mb-1">BONO BIENVENIDA (pts)</label>
                                        <input
                                            type="number"
                                            value={settings.welcomeBonus || 0}
                                            onChange={e => setSettings(p => ({...p, welcomeBonus: parseInt(e.target.value)}))}
                                            min="0"
                                            className="w-full border-4 border-black px-3 py-2 font-mono text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-black text-xs mb-1">DIRECCIÓN</label>
                                    <input
                                        type="text"
                                        value={settings.address || ''}
                                        onChange={e => setSettings(p => ({...p, address: e.target.value}))}
                                        placeholder="Zona 10, Guatemala"
                                        className="w-full border-4 border-black px-3 py-2 font-mono text-sm focus:outline-none focus:bg-yellow-50"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={settingsLoading}
                                    className="w-full border-4 border-black font-black py-3 shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                                    style={{ backgroundColor: accent }}
                                >
                                    {settingsLoading ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                                </button>
                            </form>
                        </div>

                        {/* API Key */}
                        <div className="border-4 border-black shadow-brutal bg-white p-6">
                            <h2 className="font-black text-xl mb-2">API KEY (INTEGRACIÓN POS)</h2>
                            <p className="font-mono text-sm mb-4 opacity-60">
                                Usa esta clave para conectar cualquier sistema de POS, tablet o aplicación.
                                Sin login — solo la clave.
                            </p>
                            <div className="border-4 border-black bg-black text-yellow-300 p-4 flex items-center justify-between gap-3 mb-4">
                                <code className="font-mono text-xs break-all">{restaurant?.apiKey}</code>
                                <button onClick={copyKey}
                                    className="shrink-0 border-2 border-yellow-300 p-2 hover:bg-yellow-300 hover:text-black transition-colors">
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Integration guide */}
                            <div className="border-4 border-black bg-gray-50 p-4">
                                <p className="font-black text-sm mb-3">EJEMPLO DE INTEGRACIÓN:</p>
                                <pre className="font-mono text-xs overflow-x-auto text-gray-700 whitespace-pre-wrap">{`POST https://api.reguards.app/api/pos/purchase
X-API-Key: ${restaurant?.apiKey || 'tu-api-key'}
Content-Type: application/json

{
  "customerPhone": "+50212345678",
  "amountQuetzales": 150,
  "description": "Almuerzo"
}

// Respuesta:
{
  "success": true,
  "pointsEarned": 150,
  "newBalance": 420,
  "customer": { "tier": "PLATA" }
}`}</pre>
                            </div>

                            <button
                                onClick={rotateKey}
                                className="mt-4 w-full border-4 border-black border-red-400 bg-red-100 font-black py-2 text-sm hover:bg-red-300 transition-colors"
                            >
                                REGENERAR API KEY
                            </button>
                        </div>

                        {/* Plan info */}
                        <div className="border-4 border-black p-5 bg-white shadow-brutal-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-black text-lg">PLAN: {(restaurant?.plan || 'free').toUpperCase()}</p>
                                    {restaurant?.plan === 'free' && (
                                        <p className="font-mono text-sm opacity-60 mt-1">
                                            Gratis para siempre · Hasta 3 premios activos · POS incluido
                                        </p>
                                    )}
                                </div>
                                {restaurant?.plan === 'free' && (
                                    <span className="border-4 border-black font-black text-xs px-3 py-2 bg-yellow-300">
                                        GRATIS
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
