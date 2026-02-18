/**
 * Public Explore / Marketplace page
 * No login required — anyone can discover Reguards restaurants.
 * Featured restaurants appear at the top (admin-controlled, paid tier).
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/auth-store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const CATEGORIES = ['Todos', 'comida chapina', 'italiana', 'cafetería', 'mariscos', 'desayunos', 'pizza', 'sushi', 'bar'];
const ZONES = ['Todos', 'Zona 1', 'Zona 4', 'Zona 9', 'Zona 10', 'Zona 14', 'Miraflores', 'Cayalá'];

export default function Explore() {
    const { isAuthenticated } = useAuthStore();
    const navigate = useNavigate();

    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [selectedZone, setSelectedZone] = useState('Todos');
    const [filterAlliance, setFilterAlliance] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);

    useEffect(() => {
        fetchRestaurants();
    }, []);

    async function fetchRestaurants() {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/api/restaurants/explore`);
            setRestaurants(res.data.restaurants || []);
        } catch (err) {
            console.error('Explore fetch error:', err);
        } finally {
            setLoading(false);
        }
    }

    const filtered = restaurants.filter(r => {
        const matchCat = selectedCategory === 'Todos' || (r.category || '').toLowerCase().includes(selectedCategory.toLowerCase());
        const matchZone = selectedZone === 'Todos' || (r.zone || '').toLowerCase().includes(selectedZone.toLowerCase());
        const matchAlliance = !filterAlliance || r.alliances.length > 0;
        const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchZone && matchAlliance && matchSearch;
    });

    const featured = filtered.filter(r => r.isFeatured);
    const regular = filtered.filter(r => !r.isFeatured);

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b-4 border-black bg-black text-yellow-300 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
                    <button onClick={() => navigate(-1)} className="font-black text-xl mr-4">←</button>
                    <div className="font-black text-xl tracking-tight">🗺️ EXPLORAR</div>
                    <div className="flex gap-2">
                        {isAuthenticated ? (
                            <Link
                                to="/dashboard"
                                className="border-2 border-yellow-300 px-3 py-1 font-black text-xs hover:bg-yellow-300 hover:text-black transition-colors"
                            >
                                MI APP →
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className="bg-yellow-300 text-black border-2 border-yellow-300 px-3 py-1 font-black text-xs hover:bg-white transition-colors"
                            >
                                UNIRSE
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero */}
            <div className="bg-yellow-300 border-b-4 border-black px-4 py-8">
                <div className="max-w-5xl mx-auto">
                    <h1 className="font-black text-4xl md:text-5xl leading-none mb-2">
                        RESTAURANTES<br />REGUARDS
                    </h1>
                    <p className="font-mono text-sm mb-5 opacity-70">
                        Descubre, acumula puntos y canjea premios exclusivos.
                    </p>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar restaurante..."
                        className="w-full max-w-md border-4 border-black px-4 py-3 font-mono text-base focus:outline-none bg-white"
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="border-b-4 border-black bg-white px-4 py-4 overflow-x-auto">
                <div className="max-w-5xl mx-auto space-y-3">
                    {/* Category filter */}
                    <div className="flex gap-2 flex-nowrap pb-1">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`shrink-0 border-4 border-black font-black text-xs px-3 py-1.5 transition-all ${
                                    selectedCategory === cat
                                        ? 'bg-black text-yellow-300'
                                        : 'bg-white hover:bg-yellow-50'
                                }`}
                            >
                                {cat.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    {/* Zone + alliance filters */}
                    <div className="flex gap-2 flex-nowrap pb-1">
                        {ZONES.map(z => (
                            <button
                                key={z}
                                onClick={() => setSelectedZone(z)}
                                className={`shrink-0 border-4 border-black font-black text-xs px-3 py-1.5 transition-all ${
                                    selectedZone === z
                                        ? 'bg-black text-yellow-300'
                                        : 'bg-white hover:bg-yellow-50'
                                }`}
                            >
                                {z.toUpperCase()}
                            </button>
                        ))}
                        <button
                            onClick={() => setFilterAlliance(!filterAlliance)}
                            className={`shrink-0 border-4 border-black font-black text-xs px-3 py-1.5 transition-all ${
                                filterAlliance ? 'bg-black text-yellow-300' : 'bg-white hover:bg-yellow-50'
                            }`}
                        >
                            🤝 CON ALIANZA
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 border-4 border-black border-t-yellow-300 animate-spin mx-auto" />
                        <p className="mt-4 font-black uppercase">CARGANDO...</p>
                    </div>
                ) : (
                    <>
                        {/* Featured section */}
                        {featured.length > 0 && (
                            <section>
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="font-black text-2xl">⭐ DESTACADOS</h2>
                                    <span className="bg-black text-yellow-300 font-mono font-black text-xs px-2 py-0.5">PREMIUM</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {featured.map(r => (
                                        <RestaurantCard
                                            key={r._id}
                                            restaurant={r}
                                            featured
                                            onSelect={() => setSelectedRestaurant(r)}
                                            isAuthenticated={isAuthenticated}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Regular grid */}
                        <section>
                            {featured.length > 0 && (
                                <h2 className="font-black text-2xl mb-4">TODOS LOS RESTAURANTES</h2>
                            )}
                            {regular.length === 0 && featured.length === 0 ? (
                                <div className="border-4 border-black p-12 text-center">
                                    <p className="font-black text-xl">SIN RESULTADOS</p>
                                    <p className="font-mono text-sm mt-2 opacity-60">Intenta con otros filtros</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {regular.map(r => (
                                        <RestaurantCard
                                            key={r._id}
                                            restaurant={r}
                                            onSelect={() => setSelectedRestaurant(r)}
                                            isAuthenticated={isAuthenticated}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Join CTA for logged-out users */}
                        {!isAuthenticated && (
                            <section className="border-4 border-black bg-black text-yellow-300 p-8 text-center shadow-brutal">
                                <h2 className="font-black text-3xl mb-2">¿LISTO PARA GANAR?</h2>
                                <p className="font-mono text-sm mb-6 opacity-70">
                                    Regístrate gratis y empieza a acumular puntos en todos estos restaurantes.
                                </p>
                                <Link
                                    to="/login"
                                    className="inline-block bg-yellow-300 text-black border-4 border-yellow-300 font-black text-lg px-8 py-4 shadow-[8px_8px_0px_0px_rgba(255,255,0,0.5)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                                >
                                    ÚNETE A REGUARDS →
                                </Link>
                            </section>
                        )}
                    </>
                )}
            </main>

            {/* Restaurant detail modal */}
            {selectedRestaurant && (
                <RestaurantModal
                    restaurant={selectedRestaurant}
                    isAuthenticated={isAuthenticated}
                    onClose={() => setSelectedRestaurant(null)}
                />
            )}
        </div>
    );
}

function RestaurantCard({ restaurant: r, featured, onSelect, isAuthenticated }) {
    return (
        <div
            className={`border-4 border-black shadow-brutal cursor-pointer hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all ${
                featured ? 'bg-yellow-300' : 'bg-white'
            }`}
            onClick={onSelect}
        >
            {/* Color banner */}
            <div
                className="h-16 border-b-4 border-black flex items-center justify-center"
                style={{ backgroundColor: r.accentColor || '#FFFF00' }}
            >
                <span className="text-5xl">{r.emoji}</span>
            </div>

            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-black text-lg leading-tight">{r.name}</h3>
                    {featured && (
                        <span className="shrink-0 bg-black text-yellow-300 font-mono font-black text-xs px-1.5 py-0.5">
                            DESTACADO
                        </span>
                    )}
                </div>

                {r.zone && (
                    <p className="font-mono text-xs text-gray-500 mb-2">📍 {r.zone}</p>
                )}
                {r.category && (
                    <p className="font-mono text-xs text-gray-500 mb-2">🍴 {r.category}</p>
                )}

                <div className="flex gap-2 flex-wrap mb-3">
                    <span className="border-2 border-black font-mono font-black text-xs px-2 py-0.5">
                        {r.rewardCount} premio{r.rewardCount !== 1 ? 's' : ''}
                    </span>
                    <span className="border-2 border-black font-mono font-black text-xs px-2 py-0.5">
                        {r.pointsPerQuetzal}pt/Q
                    </span>
                    {r.welcomeBonus > 0 && (
                        <span className="bg-yellow-200 border-2 border-black font-mono font-black text-xs px-2 py-0.5">
                            +{r.welcomeBonus} bienvenida
                        </span>
                    )}
                </div>

                {r.alliances.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                        {r.alliances.map((a, i) => (
                            <span key={i} className="bg-black text-yellow-300 font-mono font-black text-xs px-2 py-0.5">
                                {a.emoji} {a.name}
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={e => { e.stopPropagation(); onSelect(); }}
                        className="flex-1 border-4 border-black font-black text-sm py-2 bg-white hover:bg-yellow-300 transition-colors"
                    >
                        VER PREMIOS
                    </button>
                    {r.slug && (
                        <a
                            href={`/r/${r.slug}`}
                            onClick={e => e.stopPropagation()}
                            className="border-4 border-black font-black text-sm px-3 py-2 bg-black text-yellow-300 hover:bg-gray-800 transition-colors shrink-0"
                            title="Ver página del restaurante"
                        >
                            ↗
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function RestaurantModal({ restaurant: r, isAuthenticated, onClose }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white border-4 border-black shadow-brutal w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div
                    className="border-b-4 border-black p-6 flex items-center gap-4"
                    style={{ backgroundColor: r.accentColor || '#FFFF00' }}
                >
                    <span className="text-5xl">{r.emoji}</span>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-black text-2xl leading-tight">{r.name}</h2>
                        {r.zone && <p className="font-mono text-sm opacity-70">📍 {r.zone}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="border-4 border-black bg-white font-black text-xl w-12 h-12 flex items-center justify-center hover:bg-gray-100 shrink-0"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {r.description && (
                        <p className="font-mono text-sm text-gray-700">{r.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="border-4 border-black p-3 text-center">
                            <p className="font-black text-2xl">{r.pointsPerQuetzal}</p>
                            <p className="font-mono text-xs">PT POR QUETZAL</p>
                        </div>
                        <div className="border-4 border-black p-3 text-center">
                            <p className="font-black text-2xl">{r.rewardCount}</p>
                            <p className="font-mono text-xs">PREMIOS</p>
                        </div>
                        {r.welcomeBonus > 0 && (
                            <div className="border-4 border-black bg-yellow-300 p-3 text-center col-span-2">
                                <p className="font-black text-xl">+{r.welcomeBonus} pts</p>
                                <p className="font-mono text-xs">BONO PRIMERA VISITA</p>
                            </div>
                        )}
                    </div>

                    {r.alliances.length > 0 && (
                        <div>
                            <h3 className="font-black mb-2">🤝 ALIANZAS ACTIVAS</h3>
                            <div className="space-y-2">
                                {r.alliances.map((a, i) => (
                                    <div key={i} className="border-4 border-black bg-black text-yellow-300 px-4 py-2 font-black text-sm">
                                        {a.emoji} {a.name}
                                    </div>
                                ))}
                            </div>
                            <p className="font-mono text-xs mt-2 opacity-60">
                                Usa tus puntos en todos los restaurantes aliados
                            </p>
                        </div>
                    )}

                    {r.address && (
                        <div className="border-4 border-black p-3">
                            <p className="font-black text-xs mb-1">DIRECCIÓN</p>
                            <p className="font-mono text-sm">{r.address}</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {r.slug && (
                            <a
                                href={`/r/${r.slug}`}
                                className="block w-full bg-white border-4 border-black font-black text-sm py-3 text-center hover:bg-yellow-50 transition-colors"
                            >
                                VER PÁGINA COMPLETA ↗
                            </a>
                        )}
                        {isAuthenticated ? (
                            <a
                                href="/dashboard"
                                className="block w-full bg-yellow-300 border-4 border-black font-black text-lg py-4 text-center shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                            >
                                IR A MIS PREMIOS →
                            </a>
                        ) : (
                            <a
                                href="/login"
                                className="block w-full bg-black text-yellow-300 border-4 border-black font-black text-lg py-4 text-center shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                            >
                                ÚNETE GRATIS PARA GANAR PUNTOS →
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
