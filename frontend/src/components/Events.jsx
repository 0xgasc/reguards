import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import useAuthStore from '../store/auth-store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const TIER_COLORS = {
    BRONCE:  { bg: '#CD7F32', text: '#000' },
    PLATA:   { bg: '#C0C0C0', text: '#000' },
    ORO:     { bg: '#FFD700', text: '#000' },
    PLATINO: { bg: '#000',    text: '#fff' },
};

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-GT', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function RsvpStatusBadge({ status }) {
    const map = {
        confirmed:        { label: 'CONFIRMADO ✓',      bg: '#000', text: '#FFFF00' },
        pending_payment:  { label: 'PAGO PENDIENTE',    bg: '#FF0000', text: '#fff' },
        pending_approval: { label: 'VERIFICANDO...',    bg: '#0000FF', text: '#fff' },
        waitlist:         { label: 'LISTA DE ESPERA',   bg: '#888', text: '#fff' },
        declined:         { label: 'RECHAZADO',         bg: '#FF0000', text: '#fff' },
    };
    const s = map[status] || { label: status, bg: '#888', text: '#fff' };
    return (
        <span
            className="font-mono font-black text-xs px-2 py-1 border-2 border-black"
            style={{ backgroundColor: s.bg, color: s.text }}
        >
            {s.label}
        </span>
    );
}

// ─── Comprobante Upload ───────────────────────────────────────────────────────

function ComprovanteUpload({ event, rsvp, token, onDone }) {
    const [img, setImg] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef();

    function onFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('Máximo 5MB'); return; }
        const reader = new FileReader();
        reader.onload = ev => {
            setImg(ev.target.result);
            setPreview(ev.target.result);
        };
        reader.readAsDataURL(file);
    }

    async function submit() {
        if (!img) { setError('Selecciona una imagen'); return; }
        setLoading(true); setError('');
        try {
            await axios.post(
                `${API_URL}/api/events/${event._id}/comprobante`,
                { comprovanteData: img },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            onDone();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al subir');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="border-4 border-black bg-white p-6 shadow-brutal">
            <h3 className="font-black text-xl mb-1">SUBIR COMPROBANTE</h3>
            <p className="text-sm font-mono mb-4">
                Transfiere <span className="font-black">Q{event.priceGTQ}</span> a{' '}
                <span className="font-black">{event.bankName}</span>{' '}
                cuenta <span className="font-black">{event.bankAccount}</span>.
                <br />
                Escribe el código{' '}
                <span className="font-black bg-yellow-300 px-1">{rsvp.referenceCode}</span>{' '}
                en el concepto.
            </p>

            <div
                className="border-4 border-dashed border-black bg-neobrutalist-gray-100 flex items-center justify-center h-40 cursor-pointer mb-4 hover:bg-yellow-100 transition-colors"
                onClick={() => fileRef.current.click()}
            >
                {preview ? (
                    <img src={preview} alt="comprobante" className="h-full object-contain" />
                ) : (
                    <span className="font-mono font-bold text-gray-500">
                        TOCA PARA SUBIR FOTO
                    </span>
                )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

            {error && <p className="text-red-600 font-mono font-bold mb-3">{error}</p>}

            <button
                onClick={submit}
                disabled={loading || !img}
                className="w-full bg-black text-yellow-300 font-black text-lg py-4 border-4 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
            >
                {loading ? 'ENVIANDO...' : 'ENVIAR COMPROBANTE'}
            </button>
        </div>
    );
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────

function EventModal({ event: initialEvent, token, onClose }) {
    const [event, setEvent] = useState(initialEvent);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showComprobante, setShowComprobante] = useState(false);

    async function rsvp() {
        setLoading(true); setError('');
        try {
            const res = await axios.post(
                `${API_URL}/api/events/${event._id}/rsvp`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Refresh event data to show updated counts
            const refreshed = await axios.get(
                `${API_URL}/api/events/${event._id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setEvent(refreshed.data.event);
            if (res.data.status === 'pending_payment') {
                setShowComprobante(true);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error al hacer RSVP');
        } finally {
            setLoading(false);
        }
    }

    const myRsvp = event.myRsvp;
    const isFull = event.spotsLeft !== null && event.spotsLeft === 0;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white border-4 border-black w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-brutal">
                {/* Header */}
                <div
                    className="border-b-4 border-black p-6 flex items-start justify-between"
                    style={{ backgroundColor: event.coverColor || '#FFFF00' }}
                >
                    <div>
                        <div className="text-5xl mb-2">{event.coverEmoji}</div>
                        <h2 className="font-black text-2xl leading-tight">{event.title}</h2>
                        {event.tags?.map(t => (
                            <span key={t} className="inline-block border-2 border-black font-mono text-xs px-2 mr-1 mt-1">
                                {t}
                            </span>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="border-4 border-black font-black text-xl w-12 h-12 flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Date + venue */}
                    <div className="border-4 border-black p-4 bg-neobrutalist-gray-100">
                        <div className="font-mono font-bold">{formatDate(event.date)}</div>
                        {event.venue && <div className="font-black text-lg mt-1">{event.venue}</div>}
                        {event.address && <div className="font-mono text-sm">{event.address}</div>}
                    </div>

                    {/* Description */}
                    {event.description && (
                        <p className="font-mono text-sm leading-relaxed">{event.description}</p>
                    )}

                    {/* Social proof — who's going */}
                    {event.confirmedCount > 0 && (
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                {(event.attendees || []).slice(0, 5).map((a, i) => (
                                    <div
                                        key={i}
                                        className="w-9 h-9 border-2 border-black bg-yellow-300 flex items-center justify-center font-black text-xs"
                                    >
                                        {a.initials}
                                    </div>
                                ))}
                            </div>
                            <span className="font-mono font-bold text-sm">
                                {event.confirmedCount} {event.confirmedCount === 1 ? 'persona va' : 'personas van'}
                            </span>
                        </div>
                    )}

                    {/* Points reward */}
                    {event.pointsReward > 0 && (
                        <div className="border-4 border-black bg-black text-yellow-300 p-3 font-mono font-black">
                            +{event.pointsReward} PUNTOS por asistir
                        </div>
                    )}

                    {/* Spots left */}
                    {event.spotsLeft !== null && (
                        <div className={`border-4 border-black p-3 font-mono font-bold ${event.spotsLeft < 5 ? 'bg-red-100' : 'bg-white'}`}>
                            {event.spotsLeft === 0
                                ? 'SOLD OUT — Sin lugares disponibles'
                                : `${event.spotsLeft} lugar${event.spotsLeft !== 1 ? 'es' : ''} disponible${event.spotsLeft !== 1 ? 's' : ''}`
                            }
                        </div>
                    )}

                    {/* My RSVP status */}
                    {myRsvp && (
                        <div className="border-4 border-black p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-black">TU RSVP:</span>
                                <RsvpStatusBadge status={myRsvp.status} />
                            </div>
                            {myRsvp.referenceCode && (
                                <div className="bg-yellow-300 border-2 border-black p-3">
                                    <div className="font-mono text-xs mb-1">CÓDIGO DE REFERENCIA</div>
                                    <div className="font-black text-2xl tracking-widest">{myRsvp.referenceCode}</div>
                                </div>
                            )}
                            {myRsvp.status === 'pending_payment' && !showComprobante && (
                                <button
                                    onClick={() => setShowComprobante(true)}
                                    className="w-full border-4 border-black font-black py-3 hover:bg-black hover:text-white transition-colors"
                                >
                                    SUBIR COMPROBANTE DE PAGO
                                </button>
                            )}
                        </div>
                    )}

                    {/* Comprobante upload */}
                    {showComprobante && myRsvp?.status === 'pending_payment' && (
                        <ComprovanteUpload
                            event={event}
                            rsvp={myRsvp}
                            token={token}
                            onDone={async () => {
                                setShowComprobante(false);
                                const refreshed = await axios.get(
                                    `${API_URL}/api/events/${event._id}`,
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                                setEvent(refreshed.data.event);
                            }}
                        />
                    )}

                    {/* Error */}
                    {error && (
                        <div className="border-4 border-red-500 bg-red-100 p-3 font-mono font-bold text-red-700">
                            {error}
                        </div>
                    )}

                    {/* CTA */}
                    {!myRsvp && (
                        <button
                            onClick={rsvp}
                            disabled={loading || isFull}
                            className="w-full bg-black text-yellow-300 font-black text-xl py-5 border-4 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-40"
                        >
                            {loading ? '...' : isFull ? 'SIN LUGARES' : event.isFree ? 'APUNTARME GRATIS' : `RESERVAR — Q${event.priceGTQ}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onClick }) {
    const isNear = event.spotsLeft !== null && event.spotsLeft <= 5 && event.spotsLeft > 0;
    const isFull = event.spotsLeft === 0;

    return (
        <div
            onClick={onClick}
            className="border-4 border-black bg-white shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
        >
            {/* Color band */}
            <div
                className="h-3 border-b-4 border-black"
                style={{ backgroundColor: event.coverColor || '#FFFF00' }}
            />

            <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <span className="text-3xl">{event.coverEmoji}</span>
                        <h3 className="font-black text-lg mt-1 leading-tight">{event.title}</h3>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                        {event.isFree ? (
                            <span className="bg-black text-yellow-300 font-black font-mono text-sm px-2 py-1">GRATIS</span>
                        ) : (
                            <span className="border-2 border-black font-black font-mono text-sm px-2 py-1">Q{event.priceGTQ}</span>
                        )}
                    </div>
                </div>

                <div className="font-mono text-sm mb-3 text-gray-700">{formatDate(event.date)}</div>

                {event.venue && (
                    <div className="font-bold text-sm mb-3">📍 {event.venue}</div>
                )}

                {/* Tags */}
                {event.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {event.tags.map(t => (
                            <span key={t} className="border-2 border-black font-mono text-xs px-2">
                                {t}
                            </span>
                        ))}
                    </div>
                )}

                {/* Bottom row */}
                <div className="flex items-center justify-between pt-3 border-t-2 border-black">
                    <div className="flex items-center gap-2">
                        {event.confirmedCount > 0 && (
                            <span className="font-mono text-xs font-bold">
                                👥 {event.confirmedCount} van
                            </span>
                        )}
                        {event.pointsReward > 0 && (
                            <span className="font-mono text-xs font-bold bg-yellow-300 border border-black px-1">
                                +{event.pointsReward}pts
                            </span>
                        )}
                    </div>
                    <div>
                        {event.myRsvp && <RsvpStatusBadge status={event.myRsvp.status} />}
                        {!event.myRsvp && isFull && (
                            <span className="font-mono text-xs font-bold text-red-600">LLENO</span>
                        )}
                        {!event.myRsvp && isNear && (
                            <span className="font-mono text-xs font-bold text-red-600 animate-pulse">
                                {event.spotsLeft} LUGAR{event.spotsLeft !== 1 ? 'ES' : ''} ←
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({ token }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${API_URL}/api/events/social/leaderboard`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => setData(r.data.leaderboard || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="font-mono text-sm py-4">Cargando...</div>;
    if (!data.length) return null;

    return (
        <div className="border-4 border-black bg-white">
            <div className="border-b-4 border-black px-5 py-3 bg-black text-yellow-300">
                <span className="font-black text-sm">🏆 TOP PUNTOS</span>
            </div>
            {data.slice(0, 10).map(entry => {
                const tier = TIER_COLORS[entry.tier] || TIER_COLORS.BRONCE;
                return (
                    <div
                        key={entry.rank}
                        className={`flex items-center justify-between px-5 py-3 border-b-2 border-black last:border-b-0 ${entry.isMe ? 'bg-yellow-100' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="font-black font-mono text-lg w-8">
                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                            </span>
                            <div>
                                <div className="font-mono text-sm font-bold">
                                    {entry.displayName} {entry.isMe && <span className="text-xs">(tú)</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="font-mono font-black text-xs px-2 py-1 border-2 border-black"
                                style={{ backgroundColor: tier.bg, color: tier.text }}
                            >
                                {entry.tier}
                            </span>
                            <span className="font-black font-mono">{entry.totalPoints.toLocaleString()}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── My RSVPs ─────────────────────────────────────────────────────────────────

function MyRsvps({ token }) {
    const [myEvents, setMyEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${API_URL}/api/events/my/rsvps`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => setMyEvents(r.data.events || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="font-mono py-8 text-center">Cargando...</div>;

    if (!myEvents.length) {
        return (
            <div className="border-4 border-black p-10 text-center">
                <div className="text-6xl mb-4">🎟️</div>
                <p className="font-black text-xl">Sin RSVPs aún</p>
                <p className="font-mono text-sm mt-2 opacity-60">Cuando te apuntes a un evento aparecerá aquí</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {myEvents.map(ev => {
                const rsvp = ev.myRsvp;
                const isPast = new Date(ev.date) < new Date();
                return (
                    <div
                        key={ev._id}
                        className={`border-4 border-black shadow-brutal-sm ${isPast ? 'opacity-60' : 'bg-white'}`}
                    >
                        <div
                            className="h-2 border-b-2 border-black"
                            style={{ backgroundColor: ev.coverColor || '#FFFF00' }}
                        />
                        <div className="p-5 flex items-start gap-4">
                            <div
                                className="w-12 h-12 border-2 border-black flex items-center justify-center text-2xl shrink-0"
                                style={{ backgroundColor: ev.coverColor || '#FFFF00' }}
                            >
                                {ev.coverEmoji}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-base">{ev.title}</p>
                                <p className="font-mono text-xs text-gray-500">
                                    {new Date(ev.date).toLocaleString('es-GT', {
                                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                    {ev.venue && ` · ${ev.venue}`}
                                </p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <RsvpStatusBadge status={rsvp?.status} />
                                    {rsvp?.checkedIn && (
                                        <span className="font-mono text-xs font-bold text-green-700 border-2 border-green-700 px-2 py-0.5">
                                            ✓ CHECK-IN
                                        </span>
                                    )}
                                    {rsvp?.pointsAwarded && ev.pointsReward > 0 && (
                                        <span className="bg-yellow-300 border-2 border-black font-mono font-black text-xs px-2 py-0.5">
                                            +{ev.pointsReward}pts ganados
                                        </span>
                                    )}
                                </div>
                                {rsvp?.referenceCode && rsvp.status === 'pending_payment' && (
                                    <div className="mt-2 bg-yellow-100 border-2 border-black p-2">
                                        <p className="font-mono text-xs">Código de pago:</p>
                                        <p className="font-black text-lg tracking-widest">{rsvp.referenceCode}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Events Page ─────────────────────────────────────────────────────────

export default function Events() {
    const { token } = useAuthStore();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [tab, setTab] = useState('eventos'); // 'eventos' | 'mis-rsvps' | 'ranking'

    useEffect(() => {
        if (!token) return;
        axios.get(`${API_URL}/api/events`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => setEvents(r.data.events || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token]);

    function refreshEvents() {
        axios.get(`${API_URL}/api/events`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(r => setEvents(r.data.events || [])).catch(() => {});
    }

    return (
        <div className="min-h-screen bg-white font-sans">
            {/* Header */}
            <div className="border-b-4 border-black bg-black text-yellow-300 px-6 py-5">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="font-black text-2xl">EVENTOS</h1>
                        <p className="font-mono text-xs opacity-70">gana puntos asistiendo</p>
                    </div>
                    <div className="text-3xl">🎪</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b-4 border-black flex max-w-xl mx-auto">
                {[
                    { id: 'eventos',    label: '🎉 Eventos' },
                    { id: 'mis-rsvps', label: '🎟️ Mis RSVPs' },
                    { id: 'ranking',   label: '🏆 Ranking' },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 py-3 font-black text-xs uppercase border-r-2 border-black last:border-r-0 transition-colors
                            ${tab === t.id ? 'bg-black text-yellow-300' : 'bg-white hover:bg-yellow-50'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="max-w-xl mx-auto px-4 py-6">
                {tab === 'ranking' ? (
                    <Leaderboard token={token} />
                ) : tab === 'mis-rsvps' ? (
                    <MyRsvps token={token} />
                ) : loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="border-4 border-black h-40 animate-pulse bg-gray-100" />
                        ))}
                    </div>
                ) : events.length === 0 ? (
                    <div className="border-4 border-black p-10 text-center">
                        <div className="text-6xl mb-4">📭</div>
                        <p className="font-black text-xl">Sin eventos próximos</p>
                        <p className="font-mono text-sm mt-2 opacity-60">Vuelve pronto</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {events.map(event => (
                            <EventCard
                                key={event._id}
                                event={event}
                                onClick={() => setSelected(event)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Event modal */}
            {selected && (
                <EventModal
                    event={selected}
                    token={token}
                    onClose={() => { setSelected(null); refreshEvents(); }}
                />
            )}
        </div>
    );
}
