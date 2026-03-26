import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import useAuthStore from '../store/auth-store';
import toast from 'react-hot-toast';
import axios from 'axios';
import QRCode from 'qrcode';
import WalletPass from './WalletPass';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const TIER_CONFIG = {
    BRONCE:  { color: '#CD7F32', next: 'PLATA',   nextAt: 250,  emoji: '' },
    PLATA:   { color: '#C0C0C0', next: 'ORO',     nextAt: 750,  emoji: '' },
    ORO:     { color: '#FFD700', next: 'PLATINO', nextAt: 2000, emoji: '' },
    PLATINO: { color: '#000',    next: null,       nextAt: null, emoji: '', textColor: '#fff' },
};

const TIER_MIN = { BRONCE: 0, PLATA: 250, ORO: 750, PLATINO: 2000 };

function TierBadge({ tier, points }) {
    const cfg = TIER_CONFIG[tier] || TIER_CONFIG.BRONCE;
    const min = TIER_MIN[tier] || 0;
    const progress = cfg.nextAt
        ? Math.min(100, Math.round(((points - min) / (cfg.nextAt - min)) * 100))
        : 100;

    return (
        <div className="border-4 border-black p-5 shadow-brutal-sm"
             style={{ backgroundColor: cfg.color }}>
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="font-mono text-xs font-bold opacity-70"
                       style={{ color: cfg.textColor || '#000' }}>NIVEL</p>
                    <p className="font-black text-3xl leading-none"
                       style={{ color: cfg.textColor || '#000' }}>{cfg.emoji} {tier}</p>
                </div>
                {cfg.next && (
                    <div className="text-right">
                        <p className="font-mono text-xs opacity-70"
                           style={{ color: cfg.textColor || '#000' }}>SIGUIENTE</p>
                        <p className="font-black text-sm"
                           style={{ color: cfg.textColor || '#000' }}>{cfg.next}</p>
                        <p className="font-mono text-xs"
                           style={{ color: cfg.textColor || '#000' }}>
                            {cfg.nextAt - points} pts más
                        </p>
                    </div>
                )}
            </div>
            {cfg.nextAt && (
                <div className="h-3 border-2 border-black bg-white">
                    <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
}

function InviteSection({ profile }) {
    const [copied, setCopied] = useState(false);
    const code = profile?.referralCode;

    function copy() {
        if (!code) return;
        const text = `Únete a Reguards y gana puntos en tus restaurantes favoritos de Guatemala. Usa mi código: ${code}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('¡Copiado!');
        });
    }

    function shareWhatsApp() {
        if (!code) return;
        const text = encodeURIComponent(
            `¡Únete a Reguards! Gana puntos en restaurantes de Guatemala\nUsa mi código: *${code}*\nhttps://reguards.app/signup?ref=${code}`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }

    return (
        <div className="border-4 border-black bg-white shadow-brutal-sm p-5">
            <h3 className="font-black text-lg mb-1">INVITAR AMIGOS</h3>
            <p className="font-mono text-sm mb-4 text-gray-600">
                Tú y tu amigo ganan <span className="font-black">50 puntos</span> cuando se registre.
                {profile?.referralCount > 0 && (
                    <> Has invitado a <span className="font-black">{profile.referralCount}</span> persona{profile.referralCount !== 1 ? 's' : ''}.</>
                )}
            </p>

            {code ? (
                <div className="space-y-3">
                    <div className="border-4 border-black bg-yellow-300 p-3 flex items-center justify-between">
                        <span className="font-black text-xl tracking-widest font-mono">{code}</span>
                        <button
                            onClick={copy}
                            className="border-2 border-black bg-black text-yellow-300 font-bold text-xs px-3 py-2 hover:bg-white hover:text-black transition-colors"
                        >
                            {copied ? '✓ COPIADO' : 'COPIAR'}
                        </button>
                    </div>
                    <button
                        onClick={shareWhatsApp}
                        className="w-full bg-green-500 border-4 border-black text-white font-black py-3 shadow-brutal-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                    >
                        COMPARTIR POR WHATSAPP
                    </button>
                </div>
            ) : (
                <p className="font-mono text-sm text-gray-500">Cargando código...</p>
            )}
        </div>
    );
}

function LoyaltyQR({ profile }) {
    const canvasRef = useRef(null);
    const [showQR, setShowQR] = useState(false);

    useEffect(() => {
        if (!showQR || !profile || !canvasRef.current) return;
        // QR payload: just the phone number — simple, scannable by any QR reader
        const payload = JSON.stringify({
            phone: profile.phone,
            id: profile.id,
            t: Date.now(),
        });
        QRCode.toCanvas(canvasRef.current, payload, {
            width: 240,
            margin: 2,
            color: { dark: '#000000', light: '#FFFF00' },
        }).catch(() => {});
    }, [showQR, profile]);

    if (!showQR) {
        return (
            <button
                onClick={() => setShowQR(true)}
                className="w-full border-4 border-black bg-white shadow-brutal-sm py-5 font-black text-lg hover:bg-yellow-50 hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
                MOSTRAR MI QR DE LEALTAD
            </button>
        );
    }

    return (
        <div className="border-4 border-black bg-yellow-300 shadow-brutal text-center p-6">
            <p className="font-black text-lg mb-1">TU CÓDIGO DE LEALTAD</p>
            <p className="font-mono text-xs mb-4 opacity-60">
                Muéstralo en el restaurante para registrar tu visita
            </p>
            <div className="inline-block border-4 border-black p-2 bg-yellow-300">
                <canvas ref={canvasRef} />
            </div>
            <div className="mt-4 bg-black text-yellow-300 font-mono font-black text-sm px-4 py-2 inline-block border-2 border-black">
                {profile?.phone}
            </div>
            <br />
            <button
                onClick={() => setShowQR(false)}
                className="mt-4 border-4 border-black font-black px-6 py-2 hover:bg-black hover:text-yellow-300 transition-colors"
            >
                CERRAR
            </button>
        </div>
    );
}

export default function Dashboard() {
    const { user, token, logout, updatePoints } = useAuthStore();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [birthdayEdit, setBirthdayEdit] = useState({ month: '', day: '' });
    const [savingBirthday, setSavingBirthday] = useState(false);
    const [achievements, setAchievements] = useState([]);
    const [challenges, setChallenges] = useState([]);
    const [reservations, setReservations] = useState([]);

    useEffect(() => {
        if (!user || !token) { navigate('/login'); return; }
        if (user.role === 'admin') { navigate('/admin'); return; }
        fetchData();
    }, [user, token, navigate]);

    async function fetchData() {
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [profileRes, rewardsRes, eventsRes, achRes, chalRes, resRes] = await Promise.all([
                axios.get(`${API_URL}/api/auth/profile`, { headers }),
                axios.get(`${API_URL}/api/rewards`, { headers }).catch(() => ({ data: { rewards: [] } })),
                axios.get(`${API_URL}/api/events`, { headers }).catch(() => ({ data: { events: [] } })),
                axios.get(`${API_URL}/api/achievements/mine`, { headers }).catch(() => ({ data: { achievements: [] } })),
                axios.get(`${API_URL}/api/challenges/active`, { headers }).catch(() => ({ data: { challenges: [] } })),
                axios.get(`${API_URL}/api/reservations/mine`, { headers }).catch(() => ({ data: { reservations: [] } })),
            ]);

            setProfile(profileRes.data.user);
            setRewards(rewardsRes.data.rewards || []);
            setUpcomingEvents((eventsRes.data.events || []).slice(0, 3));
            setAchievements(achRes.data.achievements || []);
            setChallenges(chalRes.data.challenges || []);
            setReservations((resRes.data.reservations || []).filter(r => ['pending','confirmed'].includes(r.status)).slice(0, 5));
            // Pre-fill birthday edit if already set
            if (profileRes.data.user.birthDate?.month) {
                setBirthdayEdit({
                    month: String(profileRes.data.user.birthDate.month),
                    day:   String(profileRes.data.user.birthDate.day),
                });
            }

            if (profileRes.data.user.transactions) {
                setTransactions(profileRes.data.user.transactions.slice(-15).reverse());
            }
        } catch (err) {
            toast.error('Error cargando datos');
        } finally {
            setLoading(false);
        }
    }

    async function saveBirthday(e) {
        e.preventDefault();
        if (!birthdayEdit.month || !birthdayEdit.day) { toast.error('Ingresa mes y día'); return; }
        setSavingBirthday(true);
        try {
            await axios.put(
                `${API_URL}/api/auth/profile`,
                { birthDate: { month: parseInt(birthdayEdit.month), day: parseInt(birthdayEdit.day) } },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('¡Cumpleaños guardado!');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error guardando');
        } finally {
            setSavingBirthday(false);
        }
    }

    async function cancelReservation(id) {
        try {
            const headers = { Authorization: `Bearer ${token}` };
            await axios.patch(`${API_URL}/api/reservations/${id}/cancel`, {}, { headers });
            setReservations(rs => rs.filter(r => r._id !== id));
            toast.success('Reservación cancelada');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error');
        }
    }

    // Check if today is the user's birthday (for banner)
    const isBirthday = (() => {
        if (!profile?.birthDate?.month) return false;
        const today = new Date();
        return profile.birthDate.month === today.getMonth() + 1 &&
               profile.birthDate.day   === today.getDate();
    })();

    async function handleRedeem(reward) {
        if (!profile || profile.totalPoints < reward.points) {
            toast.error('No tienes suficientes puntos');
            return;
        }
        try {
            const res = await axios.post(
                `${API_URL}/api/rewards/redeem`,
                { rewardId: reward._id, restaurantId: reward.restaurantId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                const code = res.data.code;
                toast.success(`¡Premio canjeado! Código: ${code} · Válido 15 min`, { duration: 8000 });
                updatePoints(res.data.newBalance);
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error canjeando');
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-black border-t-yellow-300 animate-spin mx-auto" />
                    <p className="mt-4 font-black uppercase">CARGANDO...</p>
                </div>
            </div>
        );
    }

    const pts = profile?.totalPoints || 0;
    const tier = profile?.tier || 'BRONCE';

    return (
        <div className="min-h-screen bg-white font-sans">
            {/* Header */}
            <header className="border-b-4 border-black bg-black text-yellow-300">
                <div className="max-w-xl mx-auto px-4 flex justify-between items-center h-16">
                    <div className="font-black text-xl tracking-tight">REGUARDS</div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-xs opacity-70">{profile?.phone?.slice(-8)}</span>
                        <button
                            onClick={() => { logout(); navigate('/login'); }}
                            className="border-2 border-yellow-300 p-2 hover:bg-yellow-300 hover:text-black transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Nav bar */}
            <nav className="border-b-4 border-black bg-white flex max-w-xl mx-auto">
                <Link to="/dashboard" className="flex-1 py-3 text-center font-black text-xs border-r-2 border-black bg-black text-yellow-300">
                    INICIO
                </Link>
                <Link to="/events" className="flex-1 py-3 text-center font-black text-xs border-r-2 border-black hover:bg-yellow-50 transition-colors">
                    EVENTOS
                </Link>
                <Link to="/explore" className="flex-1 py-3 text-center font-black text-xs border-r-2 border-black hover:bg-yellow-50 transition-colors">
                    EXPLORAR
                </Link>
                <Link to="/events?tab=ranking" className="flex-1 py-3 text-center font-black text-xs hover:bg-yellow-50 transition-colors">
                    RANKING
                </Link>
            </nav>

            <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
                {/* Streak chip */}
                {(profile?.streakDays || 0) >= 2 && (
                    <div className={`border-4 border-black px-4 py-3 flex items-center justify-between ${
                        profile.streakDays >= 30 ? 'bg-black text-yellow-300' :
                        profile.streakDays >= 7  ? 'bg-orange-500 text-white' :
                        'bg-orange-200'
                    }`}>
                        <div>
                            <span className="font-black text-lg">
                                {profile.streakDays} días seguidos
                            </span>
                            <p className="font-mono text-xs opacity-70">
                                {profile.streakDays === 3  ? '¡+25 pts bonus desbloqueados!' :
                                 profile.streakDays === 7  ? '¡+100 pts bonus desbloqueados!' :
                                 profile.streakDays === 30 ? '¡+500 pts bonus desbloqueados!' :
                                 profile.streakDays < 3  ? `${3 - profile.streakDays} días más para bonus de 25 pts` :
                                 profile.streakDays < 7  ? `${7 - profile.streakDays} días más para bonus de 100 pts` :
                                 profile.streakDays < 30 ? `${30 - profile.streakDays} días más para bonus de 500 pts` :
                                 '¡Racha máxima!'}
                            </p>
                        </div>
                        <span className="font-black text-3xl">
                            {profile.streakDays >= 30 ? '' : profile.streakDays >= 7 ? '' : ''}
                        </span>
                    </div>
                )}

                {/* Birthday banner */}
                {isBirthday && (
                    <div className="border-4 border-black bg-pink-300 p-4 text-center shadow-brutal animate-pulse">
                        <p className="font-black text-2xl">¡FELIZ CUMPLEAÑOS!</p>
                        <p className="font-mono text-sm mt-1">
                            Te regalamos <span className="font-black">100 puntos</span> hoy. ¡Disfruta tu día!
                        </p>
                    </div>
                )}

                {/* BIG Points + Tier */}
                <div className="border-4 border-black bg-yellow-300 shadow-brutal p-8 text-center">
                    <p className="font-mono font-bold text-sm uppercase tracking-widest mb-2">TUS PUNTOS</p>
                    <p className="text-8xl font-black font-mono leading-none">{pts.toLocaleString()}</p>
                    <p className="font-mono text-sm mt-3 opacity-60">PUNTOS DISPONIBLES</p>
                </div>

                {/* Tier progress */}
                <TierBadge tier={tier} points={pts} />

                {/* Active challenges */}
                {challenges.length > 0 && (
                    <div className="border-4 border-black bg-white shadow-brutal-sm">
                        <div className="border-b-4 border-black px-5 py-3">
                            <span className="font-black text-lg">DESAFÍOS ACTIVOS</span>
                        </div>
                        <div className="divide-y-4 divide-black">
                            {challenges.map((ch) => {
                                const prog = ch.userProgress || 0;
                                const pct = Math.min(100, Math.round((prog / ch.target) * 100));
                                const done = ch.userCompleted;
                                return (
                                    <div key={ch._id} className={`p-4 ${done ? 'opacity-60' : ''}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">{ch.emoji}</span>
                                                <div>
                                                    <p className="font-black text-sm leading-tight">{ch.name}</p>
                                                    <p className="font-mono text-xs opacity-60">{ch.description}</p>
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                {done ? (
                                                    <span className="bg-green-500 text-white font-black text-xs px-2 py-1">✓ COMPLETADO</span>
                                                ) : (
                                                    <>
                                                        <p className="font-black text-sm">{prog}/{ch.target}</p>
                                                        <p className="font-mono text-xs text-yellow-600">+{ch.bonusPoints}pts</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {!done && (
                                            <div className="h-3 border-2 border-black bg-gray-100">
                                                <div
                                                    className="h-full bg-yellow-300 transition-all"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        )}
                                        {ch.endDate && (
                                            <p className="font-mono text-xs opacity-40 mt-1">
                                                Vence: {new Date(ch.endDate).toLocaleDateString('es-GT')}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Achievements trophy case */}
                {achievements.length > 0 && (
                    <div className="border-4 border-black bg-white shadow-brutal-sm">
                        <div className="border-b-4 border-black px-5 py-3 flex items-center justify-between">
                            <span className="font-black text-lg">LOGROS ({achievements.length})</span>
                        </div>
                        <div className="p-4 grid grid-cols-4 gap-3">
                            {achievements.map((ach, i) => (
                                <div
                                    key={i}
                                    title={`${ach.name} · ${new Date(ach.unlockedAt).toLocaleDateString('es-GT')}`}
                                    className="border-4 border-black bg-yellow-300 aspect-square flex flex-col items-center justify-center gap-1 cursor-default hover:bg-yellow-400 transition-colors"
                                >
                                    <span className="text-2xl">{ach.emoji}</span>
                                    <p className="font-black text-xs text-center leading-tight px-1">{ach.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Loyalty QR card + Wallet Pass */}
                <LoyaltyQR profile={profile} />
                <WalletPass profile={profile} />

                {/* Upcoming events preview */}
                {upcomingEvents.length > 0 && (
                    <div className="border-4 border-black bg-white shadow-brutal-sm">
                        <div className="border-b-4 border-black px-5 py-3 flex items-center justify-between">
                            <span className="font-black">PRÓXIMOS EVENTOS</span>
                            <Link to="/events" className="font-mono text-xs underline font-bold">VER TODOS →</Link>
                        </div>
                        {upcomingEvents.map(ev => (
                            <Link
                                key={ev._id}
                                to="/events"
                                className="flex items-center gap-4 px-5 py-4 border-b-2 border-black last:border-b-0 hover:bg-yellow-50 transition-colors"
                            >
                                <div
                                    className="w-10 h-10 border-2 border-black flex items-center justify-center text-xl shrink-0"
                                    style={{ backgroundColor: ev.coverColor || '#FFFF00' }}
                                >
                                    {ev.coverEmoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm truncate">{ev.title}</p>
                                    <p className="font-mono text-xs text-gray-500">
                                        {new Date(ev.date).toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        {ev.venue && ` · ${ev.venue}`}
                                    </p>
                                </div>
                                <div className="shrink-0">
                                    {ev.pointsReward > 0 && (
                                        <span className="bg-black text-yellow-300 font-mono font-black text-xs px-2 py-1">
                                            +{ev.pointsReward}pts
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Upcoming Reservations */}
                {reservations.length > 0 && (
                    <div className="border-4 border-black bg-white shadow-brutal-sm">
                        <div className="border-b-4 border-black px-5 py-3">
                            <span className="font-black text-lg">MIS RESERVACIONES</span>
                        </div>
                        <div className="divide-y-4 divide-black">
                            {reservations.map(rv => (
                                <div key={rv._id} className="p-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-black text-sm">
                                            {rv.restaurant?.emoji} {rv.restaurant?.name}
                                        </p>
                                        <p className="font-mono text-xs opacity-60">
                                            {new Date(rv.date).toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            {' '}{rv.time} — {rv.partySize} pers.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`border-2 border-black font-black text-xs px-2 py-1 ${
                                            rv.status === 'confirmed' ? 'bg-green-200' : 'bg-yellow-200'
                                        }`}>
                                            {rv.status === 'confirmed' ? 'CONFIRMADA' : 'PENDIENTE'}
                                        </span>
                                        <button
                                            onClick={() => cancelReservation(rv._id)}
                                            className="border-2 border-black font-black text-xs px-2 py-1 hover:bg-red-100 transition-colors"
                                        >
                                            CANCELAR
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Rewards Grid */}
                <div>
                    <h2 className="font-black text-2xl mb-4">PREMIOS</h2>
                    {rewards.length === 0 ? (
                        <div className="border-4 border-black p-8 text-center bg-gray-50">
                            <p className="font-black">AÚN NO HAY PREMIOS</p>
                            <p className="font-mono text-sm mt-1 opacity-60">Visita un restaurante para ver sus premios aquí</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {rewards.map(reward => {
                                const canRedeem = pts >= reward.points;
                                return (
                                    <div
                                        key={reward._id}
                                        className={`border-4 border-black p-4 shadow-brutal-sm ${canRedeem ? 'bg-white' : 'bg-gray-100'}`}
                                    >
                                        {/* Restaurant name + alliance badge */}
                                        <div className="flex items-center gap-1 mb-2 flex-wrap">
                                            <span className="font-mono text-xs font-bold opacity-60">
                                                {reward.restaurantEmoji} {reward.restaurantName}
                                            </span>
                                        </div>
                                        {reward.campaign && (
                                            <div className="bg-orange-500 text-white font-mono font-black text-xs px-2 py-0.5 mb-2 inline-block">
                                                {reward.campaign.multiplier}X — {reward.campaign.name}
                                            </div>
                                        )}
                                        {reward.isAllied && reward.allianceInfo && (
                                            <div className="bg-black text-yellow-300 font-mono font-black text-xs px-2 py-0.5 mb-2 inline-block">
                                                {reward.allianceInfo.allianceName}
                                            </div>
                                        )}
                                        <p className="font-black text-sm uppercase leading-tight mb-1">{reward.name}</p>
                                        <p className="font-mono text-xs text-gray-600 mb-3">{reward.description}</p>
                                        <p className="font-black font-mono text-2xl mb-3">{reward.points}<span className="text-xs ml-1 font-mono">PTS</span></p>
                                        <button
                                            onClick={() => handleRedeem(reward)}
                                            disabled={!canRedeem}
                                            className={`w-full border-4 border-black py-2 font-black text-sm transition-all
                                                ${canRedeem
                                                    ? 'bg-yellow-300 hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-brutal-sm'
                                                    : 'opacity-40 cursor-not-allowed'
                                                }`}
                                        >
                                            {canRedeem ? 'CANJEAR' : `FALTAN ${reward.points - pts}`}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Invite section */}
                <InviteSection profile={profile} />

                {/* Birthday section */}
                <div className="border-4 border-black bg-white shadow-brutal-sm p-5">
                    <h3 className="font-black text-lg mb-1">TU CUMPLEAÑOS</h3>
                    <p className="font-mono text-sm mb-4 text-gray-600">
                        Recibe <span className="font-black">100 puntos</span> de regalo el día de tu cumpleaños.
                    </p>
                    {profile?.birthDate?.month ? (
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="border-4 border-black bg-yellow-300 px-4 py-2 font-black text-lg">
                                {String(profile.birthDate.day).padStart(2,'0')}/{String(profile.birthDate.month).padStart(2,'0')}
                            </div>
                            <button
                                onClick={() => setProfile(p => ({ ...p, birthDate: null }))}
                                className="border-2 border-black font-mono text-xs px-3 py-2 hover:bg-gray-100"
                            >
                                CAMBIAR
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={saveBirthday} className="flex gap-2 items-end flex-wrap">
                            <div>
                                <label className="block font-black text-xs mb-1">MES</label>
                                <input
                                    type="number"
                                    min="1" max="12"
                                    value={birthdayEdit.month}
                                    onChange={e => setBirthdayEdit(p => ({ ...p, month: e.target.value }))}
                                    placeholder="1–12"
                                    className="border-4 border-black px-3 py-2 font-mono w-20 focus:outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block font-black text-xs mb-1">DÍA</label>
                                <input
                                    type="number"
                                    min="1" max="31"
                                    value={birthdayEdit.day}
                                    onChange={e => setBirthdayEdit(p => ({ ...p, day: e.target.value }))}
                                    placeholder="1–31"
                                    className="border-4 border-black px-3 py-2 font-mono w-20 focus:outline-none"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={savingBirthday}
                                className="border-4 border-black bg-yellow-300 font-black px-4 py-2 shadow-brutal-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
                            >
                                {savingBirthday ? 'GUARDANDO...' : 'GUARDAR'}
                            </button>
                        </form>
                    )}
                </div>

                {/* Notification feed */}
                <NotificationFeed transactions={transactions} />
            </main>
        </div>
    );
}

function getNotifIcon(tx) {
    if (tx.type === 'redeemed') return '🎁';
    if (tx.description?.toLowerCase().includes('bienvenida') || tx.description?.toLowerCase().includes('welcome')) return '👋';
    if (tx.description?.toLowerCase().includes('cumpleaños') || tx.description?.toLowerCase().includes('birthday')) return '🎂';
    if (tx.description?.toLowerCase().includes('racha') || tx.description?.toLowerCase().includes('streak')) return '🔥';
    if (tx.description?.toLowerCase().includes('referido') || tx.description?.toLowerCase().includes('referral')) return '🫂';
    return '⭐';
}

function getNotifColor(tx) {
    if (tx.type === 'redeemed') return 'bg-red-50 border-red-300';
    if (tx.description?.toLowerCase().includes('cumpleaños')) return 'bg-pink-50 border-pink-300';
    if (tx.description?.toLowerCase().includes('racha')) return 'bg-orange-50 border-orange-300';
    return 'bg-white border-black';
}

function dayLabel(ts) {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'HOY';
    if (d.toDateString() === yesterday.toDateString()) return 'AYER';
    return d.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

function NotificationFeed({ transactions }) {
    const [showAll, setShowAll] = useState(false);
    const items = showAll ? transactions : transactions.slice(0, 8);

    // Group by day
    const groups = [];
    let lastDay = null;
    items.forEach(tx => {
        const day = new Date(tx.timestamp).toDateString();
        if (day !== lastDay) {
            groups.push({ day, label: dayLabel(tx.timestamp), items: [] });
            lastDay = day;
        }
        groups[groups.length - 1].items.push(tx);
    });

    return (
        <div>
            <h2 className="font-black text-2xl mb-4">ACTIVIDAD</h2>
            {transactions.length === 0 ? (
                <div className="border-4 border-black p-8 text-center bg-gray-50">
                    <p className="text-4xl mb-2"></p>
                    <p className="font-black">AÚN NO HAY ACTIVIDAD</p>
                    <p className="font-mono text-sm mt-1 opacity-60">Visita un restaurante para empezar</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {groups.map(group => (
                        <div key={group.day}>
                            <div className="border-4 border-black bg-black text-yellow-300 px-4 py-2 font-black text-xs uppercase tracking-widest">
                                {group.label}
                            </div>
                            {group.items.map((tx, i) => (
                                <div
                                    key={i}
                                    className={`border-x-4 border-b-4 border-black p-4 flex items-center justify-between gap-3 ${getNotifColor(tx)}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl shrink-0">{getNotifIcon(tx)}</span>
                                        <div>
                                            <p className="font-bold text-sm leading-tight">{tx.description}</p>
                                            <p className="font-mono text-xs opacity-50 mt-0.5">
                                                {new Date(tx.timestamp).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`shrink-0 font-black font-mono text-lg ${
                                        tx.type === 'earned' ? 'text-green-700' : 'text-red-600'
                                    }`}>
                                        {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                                        <span className="text-xs ml-0.5">pts</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                    {transactions.length > 8 && (
                        <button
                            onClick={() => setShowAll(s => !s)}
                            className="w-full border-4 border-black py-3 font-black text-sm hover:bg-yellow-50 transition-colors"
                        >
                            {showAll ? '▲ VER MENOS' : `▼ VER TODOS (${transactions.length})`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
