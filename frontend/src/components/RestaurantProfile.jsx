/**
 * RestaurantProfile — Public restaurant profile page
 * Route: /r/:slug
 * No auth required. Shareable via Instagram bio, QR, etc.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import useAuthStore from '../store/auth-store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function RestaurantProfile() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [myReview, setMyReview] = useState({ rating: 5, text: '', emoji: '😋' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [reserveForm, setReserveForm] = useState({ date: '', time: '19:00', partySize: 2, notes: '' });
  const [reserveLoading, setReserveLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [slug]);

  async function fetchProfile() {
    try {
      const res = await axios.get(`${API_URL}/api/restaurants/${slug}`);
      setData(res.data);
      fetchReviews(res.data.restaurant._id);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Restaurante no encontrado' : 'Error cargando perfil');
    } finally {
      setLoading(false);
    }
  }

  async function fetchReviews(restaurantId) {
    try {
      const id = restaurantId || data?.restaurant?._id;
      if (!id) return;
      const res = await axios.get(`${API_URL}/api/reviews/${id}`);
      setReviews(res.data);
    } catch {}
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!isAuthenticated) { toast.error('Inicia sesión para dejar una reseña'); return; }
    setSubmittingReview(true);
    try {
      await axios.post(
        `${API_URL}/api/reviews`,
        { restaurantId: data.restaurant._id, ...myReview },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('¡Reseña enviada!');
      fetchReviews(data.restaurant._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error enviando reseña');
    } finally {
      setSubmittingReview(false);
    }
  }

  async function submitReservation(e) {
    e.preventDefault();
    if (!isAuthenticated) { toast.error('Inicia sesión para reservar'); return; }
    if (!reserveForm.date || !reserveForm.time) { toast.error('Fecha y hora requeridos'); return; }
    setReserveLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/reservations`,
        { restaurantId: data.restaurant._id, ...reserveForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('¡Reservación enviada!');
      setShowReserve(false);
      setReserveForm({ date: '', time: '19:00', partySize: 2, notes: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando reservación');
    } finally {
      setReserveLoading(false);
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="font-black text-3xl uppercase">{error}</h1>
        <Link
          to="/explore"
          className="border-4 border-black bg-yellow-300 px-8 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
        >
          Ver todos los restaurantes
        </Link>
      </div>
    );
  }

  const { restaurant, alliances, activeCampaign, events } = data;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Banner */}
      <div
        className="border-b-4 border-black px-4 py-12 text-center"
        style={{ backgroundColor: restaurant.accentColor || '#FFFF00' }}
      >
        {/* Nav */}
        <div className="max-w-2xl mx-auto mb-8 flex justify-between items-center">
          <Link to="/explore" className="border-2 border-black bg-white px-3 py-1 font-black text-sm hover:bg-gray-100 transition-colors">
            ← EXPLORAR
          </Link>
          {restaurant.isFeatured && (
            <span className="border-4 border-black bg-black text-yellow-300 px-3 py-1 font-black text-sm">
              DESTACADO
            </span>
          )}
        </div>

        <div className="text-8xl mb-4">{restaurant.emoji}</div>
        <h1 className="font-black text-5xl uppercase tracking-tight mb-2">{restaurant.name}</h1>

        {restaurant.description && (
          <p className="font-mono text-lg max-w-xl mx-auto mt-3 opacity-80">{restaurant.description}</p>
        )}

        <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
          {restaurant.zone && (
            <span className="border-2 border-black bg-white px-3 py-1 font-bold text-sm">
              {restaurant.zone}
            </span>
          )}
          {restaurant.category && (
            <span className="border-2 border-black bg-white px-3 py-1 font-bold text-sm uppercase">
              {restaurant.category}
            </span>
          )}
        </div>

        {/* Active campaign banner */}
        {activeCampaign && (
          <div className="mt-6 max-w-md mx-auto border-4 border-black bg-black text-orange-300 px-6 py-3 font-black text-lg animate-pulse">
            {activeCampaign.multiplier}X PUNTOS — {activeCampaign.name}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border-4 border-black p-4 text-center">
            <p className="font-black text-3xl">{restaurant.pointsPerQuetzal}</p>
            <p className="font-mono text-xs uppercase mt-1">pt por Q1</p>
          </div>
          <div className="border-4 border-black p-4 text-center">
            <p className="font-black text-3xl">{restaurant.rewards?.length || 0}</p>
            <p className="font-mono text-xs uppercase mt-1">premios</p>
          </div>
          <div className="border-4 border-black p-4 text-center">
            <p className="font-black text-3xl">{restaurant.welcomeBonus || 0}</p>
            <p className="font-mono text-xs uppercase mt-1">bono entrada</p>
          </div>
        </div>

        {/* Reservation */}
        <section>
          {!showReserve ? (
            <button
              onClick={() => setShowReserve(true)}
              className="w-full border-4 border-black bg-black text-yellow-300 font-black text-lg py-4 shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
              RESERVAR MESA
            </button>
          ) : (
            <div className="border-4 border-black bg-white shadow-brutal p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-xl">RESERVAR MESA</h3>
                <button onClick={() => setShowReserve(false)} className="border-2 border-black font-black text-xs px-3 py-1 hover:bg-gray-100">
                  CERRAR
                </button>
              </div>
              <form onSubmit={submitReservation} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-black text-xs mb-1">FECHA</label>
                    <input
                      type="date"
                      value={reserveForm.date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setReserveForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full border-4 border-black px-3 py-2 font-mono focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-black text-xs mb-1">HORA</label>
                    <input
                      type="time"
                      value={reserveForm.time}
                      onChange={e => setReserveForm(f => ({ ...f, time: e.target.value }))}
                      className="w-full border-4 border-black px-3 py-2 font-mono focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-black text-xs mb-1">PERSONAS</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5,6,8,10].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReserveForm(f => ({ ...f, partySize: n }))}
                        className={`flex-1 border-4 border-black font-black py-2 transition-all ${
                          reserveForm.partySize === n ? 'bg-black text-yellow-300' : 'bg-white hover:bg-yellow-50'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-black text-xs mb-1">NOTAS (opcional)</label>
                  <textarea
                    value={reserveForm.notes}
                    onChange={e => setReserveForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Alergias, ocasión especial, preferencia de mesa..."
                    maxLength={500}
                    rows={2}
                    className="w-full border-4 border-black px-3 py-2 font-mono text-sm resize-none focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={reserveLoading || !isAuthenticated}
                  className="w-full bg-yellow-300 border-4 border-black font-black py-3 shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50"
                >
                  {!isAuthenticated ? 'INICIA SESION PARA RESERVAR' : reserveLoading ? 'ENVIANDO...' : 'CONFIRMAR RESERVACION'}
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Active Alliances */}
        {alliances?.length > 0 && (
          <section>
            <h2 className="font-black text-2xl uppercase border-b-4 border-black pb-2 mb-4">
              ALIANZAS ACTIVAS
            </h2>
            <div className="space-y-3">
              {alliances.map((a, i) => (
                <div key={i} className="border-4 border-black p-4 flex items-center gap-3">
                  <span className="text-3xl">{a.emoji}</span>
                  <div>
                    <p className="font-black text-lg">{a.name}</p>
                    {a.description && <p className="font-mono text-sm opacity-70">{a.description}</p>}
                    {a.conversionRate !== 1 && (
                      <p className="font-mono text-xs mt-1">Tasa: {a.conversionRate}x</p>
                    )}
                    {a.endDate && (
                      <p className="font-mono text-xs opacity-60">
                        Hasta: {new Date(a.endDate).toLocaleDateString('es-GT')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rewards Catalog */}
        {restaurant.rewards?.length > 0 && (
          <section>
            <h2 className="font-black text-2xl uppercase border-b-4 border-black pb-2 mb-4">
              PREMIOS DISPONIBLES
            </h2>
            <div className="space-y-3">
              {restaurant.rewards.map((rw, i) => (
                <div
                  key={i}
                  className="border-4 border-black p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{rw.emoji || '🎁'}</span>
                    <div>
                      <p className="font-black text-lg">{rw.name}</p>
                      {rw.description && <p className="font-mono text-sm opacity-70">{rw.description}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 border-4 border-black bg-yellow-300 px-4 py-2 text-center">
                    <p className="font-black text-xl">{rw.points}</p>
                    <p className="font-mono text-xs">pts</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Events */}
        {events?.length > 0 && (
          <section>
            <h2 className="font-black text-2xl uppercase border-b-4 border-black pb-2 mb-4">
              PRÓXIMOS EVENTOS
            </h2>
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div key={i} className="border-4 border-black p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{ev.coverEmoji || '🎉'}</span>
                    <div>
                      <p className="font-black text-lg">{ev.title}</p>
                      <p className="font-mono text-sm opacity-70">
                        {new Date(ev.date).toLocaleString('es-GT', {
                          weekday: 'long', day: 'numeric', month: 'long',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {ev.venue && <p className="font-mono text-sm opacity-60">{ev.venue}</p>}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {ev.isFree
                          ? <span className="bg-green-200 border border-black px-2 py-0.5 font-black text-xs">GRATIS</span>
                          : <span className="border border-black px-2 py-0.5 font-black text-xs">Q{ev.priceGTQ}</span>
                        }
                        {ev.pointsReward > 0 && (
                          <span className="bg-yellow-300 border border-black px-2 py-0.5 font-black text-xs">+{ev.pointsReward} pts</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact info */}
        {(restaurant.address || restaurant.phone || restaurant.website) && (
          <section>
            <h2 className="font-black text-2xl uppercase border-b-4 border-black pb-2 mb-4">
              INFORMACIÓN
            </h2>
            <div className="border-4 border-black p-5 space-y-2">
              {restaurant.address && (
                <p className="font-mono"><span className="font-black">Dirección:</span> {restaurant.address}</p>
              )}
              {restaurant.phone && (
                <p className="font-mono"><span className="font-black">Teléfono:</span> {restaurant.phone}</p>
              )}
              {restaurant.website && (
                <p className="font-mono">
                  <span className="font-black">Web:</span>{' '}
                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="underline">
                    {restaurant.website}
                  </a>
                </p>
              )}
            </div>
          </section>
        )}

        {/* Reviews */}
        <section>
          <h2 className="font-black text-2xl uppercase border-b-4 border-black pb-2 mb-4">
            RESEÑAS
          </h2>

          {/* Avg rating summary */}
          {reviews && reviews.total > 0 && (
            <div className="border-4 border-black p-5 mb-4 flex items-center gap-6">
              <div className="text-center">
                <p className="font-black text-5xl">{reviews.avgRating?.toFixed(1)}</p>
                <p className="font-mono text-xs">DE 5 — {reviews.total} reseña{reviews.total !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex-1 space-y-1">
                {[5,4,3,2,1].map(star => {
                  const count = reviews.distribution?.[star] || 0;
                  const pct = reviews.total > 0 ? (count / reviews.total) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="font-mono text-xs w-4">{star}</span>
                      <div className="flex-1 h-2 border border-black bg-gray-100">
                        <div className="h-full bg-yellow-300" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono text-xs w-4 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Write a review */}
          <div className="border-4 border-black p-5 mb-4 bg-yellow-50">
            <p className="font-black text-sm mb-3">DEJA TU RESEÑA</p>
            <form onSubmit={submitReview} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">RATING:</span>
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMyReview(r => ({ ...r, rating: n }))}
                    className={`text-2xl transition-transform hover:scale-110 ${n <= myReview.rating ? '' : 'opacity-30'}`}
                  >⭐</button>
                ))}
              </div>
              <div className="flex gap-2">
                {['😋','🔥','👌','😍','🫶','💯'].map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setMyReview(r => ({ ...r, emoji: em }))}
                    className={`text-xl border-2 p-1 ${myReview.emoji === em ? 'border-black bg-yellow-300' : 'border-gray-300'}`}
                  >{em}</button>
                ))}
              </div>
              <textarea
                value={myReview.text}
                onChange={e => setMyReview(r => ({ ...r, text: e.target.value }))}
                placeholder="Cuéntanos tu experiencia (opcional)"
                maxLength={500}
                rows={3}
                className="w-full border-4 border-black p-3 font-mono text-sm resize-none focus:outline-none"
              />
              <button
                type="submit"
                disabled={submittingReview || !isAuthenticated}
                className="w-full bg-black text-yellow-300 border-4 border-black font-black py-3 hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {!isAuthenticated ? 'INICIA SESIÓN PARA RESEÑAR' : submittingReview ? 'ENVIANDO...' : 'ENVIAR RESEÑA'}
              </button>
            </form>
          </div>

          {/* Review list */}
          {reviews?.reviews?.length > 0 && (
            <div className="space-y-3">
              {reviews.reviews.map((rv, i) => (
                <div key={i} className="border-4 border-black p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{rv.emoji || '⭐'}</span>
                      <div>
                        <p className="font-black text-sm">{rv.user?.phone?.slice(-6) || 'Usuario'}</p>
                        <p className="font-mono text-xs opacity-50">
                          {new Date(rv.createdAt).toLocaleDateString('es-GT')}
                        </p>
                      </div>
                    </div>
                    <div className="font-black text-lg shrink-0">
                      {'⭐'.repeat(rv.rating)}
                    </div>
                  </div>
                  {rv.text && <p className="font-mono text-sm opacity-80">{rv.text}</p>}
                </div>
              ))}
            </div>
          )}

          {reviews?.total === 0 && (
            <div className="border-4 border-black p-8 text-center bg-gray-50">
              <p className="font-black">SÉ EL PRIMERO EN RESEÑAR</p>
              <p className="font-mono text-sm opacity-60 mt-1">Tu opinión ayuda a otros usuarios</p>
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="border-4 border-black bg-black text-white p-8 text-center">
          <p className="font-black text-2xl uppercase mb-2">
            {isAuthenticated ? '¡Visita y gana puntos!' : 'Únete a REGUARDS'}
          </p>
          <p className="font-mono text-sm opacity-70 mb-6">
            {isAuthenticated
              ? 'Muestra tu QR al cajero en tu próxima visita.'
              : 'Regístrate gratis y empieza a ganar puntos hoy.'
            }
          </p>
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="border-4 border-yellow-300 bg-yellow-300 text-black px-8 py-3 font-black uppercase hover:bg-white transition-colors"
            >
              VER MI SALDO
            </button>
          ) : (
            <Link
              to="/login"
              className="border-4 border-yellow-300 bg-yellow-300 text-black px-8 py-3 font-black uppercase hover:bg-white transition-colors inline-block"
            >
              REGISTRARSE GRATIS
            </Link>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="border-t-4 border-black bg-yellow-300 py-6 text-center">
        <p className="font-black text-sm uppercase">REGUARDS — Puntos que valen</p>
        <Link to="/explore" className="font-mono text-xs underline">
          Ver todos los restaurantes →
        </Link>
      </div>
    </div>
  );
}
