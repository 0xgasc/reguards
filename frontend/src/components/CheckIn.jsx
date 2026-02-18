/**
 * Customer Self Check-In page
 * Route: /checkin/:slug  (public URL, auth required to check in)
 *
 * Customer scans restaurant QR → lands here → taps "CHECK-IN" → earns points
 * Perfect for events, first visits, or anywhere the merchant can't use the POS.
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import useAuthStore from '../store/auth-store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function CheckIn() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, token, updatePoints } = useAuthStore();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [checkinLoading, setCheckinLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRestaurant();
    }, [slug]);

    async function fetchRestaurant() {
        try {
            const res = await axios.get(`${API_URL}/api/checkin/${slug}`);
            setData(res.data);
        } catch (err) {
            setError(err.response?.status === 404 ? 'Restaurante no encontrado' : 'Error cargando');
        } finally {
            setLoading(false);
        }
    }

    async function doCheckIn() {
        if (!isAuthenticated) {
            // Save intended destination and redirect to login
            sessionStorage.setItem('afterLogin', `/checkin/${slug}`);
            navigate('/login');
            return;
        }
        setCheckinLoading(true);
        try {
            const res = await axios.post(
                `${API_URL}/api/checkin/${slug}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setResult(res.data);
            updatePoints(res.data.newBalance);
            // Show achievement toasts
            (res.data.newAchievements || []).forEach(ach => {
                setTimeout(() => toast.success(`${ach.emoji} ¡Logro desbloqueado! ${ach.name}`, { duration: 4000 }), 500);
            });
        } catch (err) {
            const msg = err.response?.data?.error || 'Error en check-in';
            toast.error(msg);
        } finally {
            setCheckinLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin w-16 h-16 border-4 border-black border-t-yellow-300" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 px-4 text-center">
                <p className="text-6xl">😢</p>
                <h1 className="font-black text-3xl uppercase">{error}</h1>
                <Link to="/explore" className="border-4 border-black bg-yellow-300 px-8 py-3 font-black uppercase shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                    EXPLORAR RESTAURANTES
                </Link>
            </div>
        );
    }

    const { restaurant, campaign } = data;

    // ── Check-in success screen ─────────────────────────────────────────────────
    if (result) {
        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
                style={{ backgroundColor: restaurant.accentColor || '#FFFF00' }}
            >
                <div className="border-4 border-black bg-white shadow-brutal max-w-sm w-full p-8 space-y-5">
                    <p className="text-6xl">{restaurant.emoji}</p>
                    <div className="border-4 border-black bg-black text-yellow-300 py-4 px-6">
                        <p className="font-mono text-sm">CHECK-IN EXITOSO</p>
                        <p className="font-black text-5xl">+{result.checkinPoints}</p>
                        <p className="font-mono text-sm">PUNTOS</p>
                    </div>

                    <div className="space-y-2">
                        <p className="font-black text-lg">{restaurant.name}</p>
                        <p className="font-mono text-sm opacity-70">
                            Saldo actual: <span className="font-black">{result.newBalance} pts</span>
                        </p>
                        {result.streakDays >= 2 && (
                            <p className="font-black text-sm">
                                {'🔥'.repeat(Math.min(result.streakDays >= 30 ? 3 : result.streakDays >= 7 ? 2 : 1, 3))}
                                {' '}{result.streakDays} días seguidos
                            </p>
                        )}
                    </div>

                    {result.newAchievements?.length > 0 && (
                        <div className="border-4 border-black p-3 space-y-2">
                            <p className="font-black text-sm">🏆 LOGROS DESBLOQUEADOS</p>
                            {result.newAchievements.map((a, i) => (
                                <div key={i} className="flex items-center gap-2 justify-center">
                                    <span className="text-2xl">{a.emoji}</span>
                                    <span className="font-bold text-sm">{a.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Link
                            to="/dashboard"
                            className="flex-1 bg-yellow-300 border-4 border-black font-black py-3 text-sm text-center hover:bg-yellow-400 transition-colors"
                        >
                            VER SALDO
                        </Link>
                        <Link
                            to={`/r/${slug}`}
                            className="flex-1 bg-black text-yellow-300 border-4 border-black font-black py-3 text-sm text-center hover:bg-gray-900 transition-colors"
                        >
                            VER PREMIOS
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main check-in screen ────────────────────────────────────────────────────
    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-4"
            style={{ backgroundColor: restaurant.accentColor || '#FFFF00' }}
        >
            <div className="border-4 border-black bg-white shadow-brutal max-w-sm w-full">
                {/* Header */}
                <div
                    className="border-b-4 border-black p-8 text-center"
                    style={{ backgroundColor: restaurant.accentColor || '#FFFF00' }}
                >
                    <p className="text-7xl mb-3">{restaurant.emoji}</p>
                    <h1 className="font-black text-3xl uppercase leading-tight">{restaurant.name}</h1>
                    {restaurant.description && (
                        <p className="font-mono text-sm mt-2 opacity-70">{restaurant.description}</p>
                    )}
                </div>

                <div className="p-6 space-y-5">
                    {/* Points info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="border-4 border-black p-3 text-center">
                            <p className="font-black text-2xl">{restaurant.pointsPerQuetzal}</p>
                            <p className="font-mono text-xs">PT POR Q1</p>
                        </div>
                        <div className="border-4 border-black p-3 text-center">
                            <p className="font-black text-2xl">~{Math.max(5, Math.floor(restaurant.pointsPerQuetzal * 20))}</p>
                            <p className="font-mono text-xs">PTS HOY</p>
                        </div>
                    </div>

                    {/* Active campaign */}
                    {campaign && (
                        <div className="border-4 border-black bg-black text-orange-300 p-3 text-center">
                            <p className="font-black">🔥 {campaign.multiplier}X PUNTOS — {campaign.name}</p>
                        </div>
                    )}

                    {/* Welcome bonus */}
                    {restaurant.welcomeBonus > 0 && (
                        <div className="border-4 border-black bg-yellow-100 p-3 text-center">
                            <p className="font-black text-sm">👋 Primera visita: +{restaurant.welcomeBonus} pts de bienvenida</p>
                        </div>
                    )}

                    {/* CTA */}
                    <button
                        onClick={doCheckIn}
                        disabled={checkinLoading}
                        className="w-full bg-black text-yellow-300 border-4 border-black font-black text-2xl py-6 shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {checkinLoading ? 'REGISTRANDO...' :
                         !isAuthenticated ? '📱 INICIA SESIÓN PARA GANAR' :
                         '✓ REGISTRAR VISITA'}
                    </button>

                    {!isAuthenticated && (
                        <p className="font-mono text-xs text-center text-gray-500">
                            Necesitas una cuenta Reguards para ganar puntos.{' '}
                            <Link to="/login" className="underline font-bold">Regístrate gratis →</Link>
                        </p>
                    )}

                    {/* Rewards preview */}
                    {restaurant.rewards?.length > 0 && (
                        <div>
                            <p className="font-black text-sm mb-2">🎁 PREMIOS DISPONIBLES</p>
                            <div className="space-y-2">
                                {restaurant.rewards.slice(0, 3).map((rw, i) => (
                                    <div key={i} className="flex items-center justify-between border-2 border-black p-2">
                                        <span className="font-bold text-sm">{rw.emoji} {rw.name}</span>
                                        <span className="font-mono font-black text-sm">{rw.points} pts</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer links */}
            <div className="mt-6 flex gap-4 font-mono text-xs">
                <Link to={`/r/${slug}`} className="underline">Ver perfil completo</Link>
                <Link to="/explore" className="underline">Explorar →</Link>
            </div>
        </div>
    );
}
