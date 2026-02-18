/**
 * WhatsApp Bot Service
 *
 * Two-way chatbot via Twilio WhatsApp webhook.
 * Mount at POST /api/webhooks/whatsapp in server.js.
 *
 * Commands (case-insensitive):
 *   PUNTOS        → balance + tier progress
 *   PREMIOS       → available rewards from visited restaurants
 *   EVENTOS       → upcoming events
 *   QR            → loyalty QR (send as text payload — image requires media hosting)
 *   CANJEAR XXXX  → validate a 6-char redemption code on behalf of customer
 *   AYUDA         → command list
 *
 * Setup env vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 */

const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Campaign = require('../models/Campaign');
const Alliance = require('../models/Alliance');

// ─── Intent parser ─────────────────────────────────────────────────────────────

function parseIntent(body) {
    const text = (body || '').trim().toUpperCase();

    if (text === 'PUNTOS' || text === 'BALANCE' || text === 'SALDO') {
        return { intent: 'PUNTOS' };
    }
    if (text === 'PREMIOS' || text === 'REWARDS' || text === 'RECOMPENSAS') {
        return { intent: 'PREMIOS' };
    }
    if (text === 'EVENTOS' || text === 'EVENTS') {
        return { intent: 'EVENTOS' };
    }
    if (text === 'QR' || text === 'MI QR') {
        return { intent: 'QR' };
    }
    if (text === 'AYUDA' || text === 'HELP' || text === 'MENU' || text === 'HOLA' || text === 'HI') {
        return { intent: 'AYUDA' };
    }
    // CANJEAR XXXXXX
    const canjearMatch = text.match(/^CANJEAR\s+([A-F0-9]{6})$/);
    if (canjearMatch) {
        return { intent: 'CANJEAR', code: canjearMatch[1] };
    }
    // Bare 6-char hex code
    const codeOnly = text.match(/^([A-F0-9]{6})$/);
    if (codeOnly) {
        return { intent: 'CANJEAR', code: codeOnly[1] };
    }

    return { intent: 'UNKNOWN' };
}

// ─── Handlers ──────────────────────────────────────────────────────────────────

async function handlePuntos(user) {
    const tier = user.tier || 'BRONCE';
    const tierEmoji = { BRONCE: '🥉', PLATA: '🥈', ORO: '🥇', PLATINO: '💎' }[tier] || '⭐';
    const nextAt = { BRONCE: 250, PLATA: 750, ORO: 2000, PLATINO: null }[tier];
    const nextTier = { BRONCE: 'PLATA', PLATA: 'ORO', ORO: 'PLATINO', PLATINO: null }[tier];

    const lines = [
        `💰 *Tus puntos REGUARDS*`,
        ``,
        `*${user.totalPoints.toLocaleString()} pts* ${tierEmoji} ${tier}`,
    ];

    if (nextAt && nextTier) {
        const remaining = nextAt - user.totalPoints;
        if (remaining > 0) {
            lines.push(`Faltan *${remaining} pts* para llegar a ${nextTier}`);
        } else {
            lines.push(`¡Listo para subir a *${nextTier}*!`);
        }
    } else {
        lines.push(`¡Nivel máximo alcanzado! 💎`);
    }

    if ((user.streakDays || 0) >= 2) {
        lines.push(``, `🔥 Racha: *${user.streakDays} días seguidos*`);
    }

    lines.push(``, `Responde *PREMIOS* para ver tus recompensas disponibles.`);
    return lines.join('\n');
}

async function handlePremios(user) {
    // Get visited restaurant IDs
    const visitedIds = [...new Set(
        (user.transactions || []).map(t => t.restaurantId?.toString()).filter(Boolean)
    )];

    if (visitedIds.length === 0) {
        return '🎁 Aún no has visitado ningún restaurante Reguards.\n\nEscribe *EVENTOS* para ver próximos eventos.';
    }

    const restaurants = await Restaurant.find({ _id: { $in: visitedIds }, isActive: true })
        .select('name emoji rewards').lean();

    const lines = [`🎁 *Tus premios disponibles:*`, ``];

    let count = 0;
    restaurants.forEach(r => {
        const active = (r.rewards || []).filter(rw => rw.isActive);
        if (active.length === 0) return;
        lines.push(`*${r.emoji} ${r.name}*`);
        active.slice(0, 3).forEach(rw => {
            const canRedeem = user.totalPoints >= rw.points;
            lines.push(`${canRedeem ? '✅' : '⭕'} ${rw.name} — ${rw.points} pts`);
            count++;
        });
        lines.push('');
    });

    if (count === 0) {
        return '🎁 Tus restaurantes no tienen premios activos por ahora.';
    }

    lines.push(`Abre la app para canjear → https://reguards.app`);
    return lines.join('\n');
}

async function handleEventos() {
    let Event;
    try { Event = require('../models/Event'); } catch { return '🎉 No hay eventos próximos por el momento.'; }

    const events = await Event.find({
        date: { $gte: new Date() },
        isPublished: true,
    }).sort({ date: 1 }).limit(5).lean();

    if (events.length === 0) {
        return '🎉 No hay eventos próximos por ahora.\n\nEscribe *AYUDA* para ver todos los comandos.';
    }

    const lines = [`🎉 *Próximos eventos REGUARDS:*`, ``];
    events.forEach(ev => {
        const dateStr = new Date(ev.date).toLocaleString('es-GT', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit',
        });
        lines.push(`*${ev.coverEmoji || '🎉'} ${ev.title}*`);
        lines.push(`📅 ${dateStr}`);
        if (ev.venue) lines.push(`📍 ${ev.venue}`);
        if (ev.pointsReward > 0) lines.push(`⭐ +${ev.pointsReward} pts por asistir`);
        lines.push('');
    });

    lines.push(`Regístrate en la app → https://reguards.app/events`);
    return lines.join('\n');
}

async function handleQR(user) {
    return [
        `📲 *Tu código de lealtad REGUARDS*`,
        ``,
        `Tu número registrado: *${user.phone}*`,
        ``,
        `Muéstrale este número al cajero o abre la app para mostrar tu QR:`,
        `https://reguards.app/dashboard`,
        ``,
        `El cajero puede buscarte por tu número.`,
    ].join('\n');
}

async function handleCanjear(user, code) {
    const upperCode = code.toUpperCase();
    const redemption = (user.pendingRedemptions || []).find(
        r => r.code === upperCode && r.status === 'pending'
    );

    if (!redemption) {
        return `❌ Código *${upperCode}* no encontrado o ya utilizado.\n\nAbre la app para generar un nuevo código → https://reguards.app`;
    }

    if (new Date(redemption.expiresAt) < new Date()) {
        redemption.status = 'expired';
        await user.save();
        return `⏰ El código *${upperCode}* ha expirado (válido 15 min).\n\nAbre la app para generar uno nuevo.`;
    }

    return [
        `🎟️ *Código listo para canjear*`,
        ``,
        `Código: *${upperCode}*`,
        `Premio: ${redemption.rewardEmoji} ${redemption.rewardName}`,
        `Restaurante: ${redemption.restaurantName}`,
        ``,
        `Muestra este mensaje al cajero para que valide el código.`,
        `Válido hasta: ${new Date(redemption.expiresAt).toLocaleTimeString('es-GT')}`,
    ].join('\n');
}

function handleAyuda() {
    return [
        `👋 *Bienvenido a REGUARDS*`,
        ``,
        `Comandos disponibles:`,
        ``,
        `💰 *PUNTOS* — Ver tu saldo y nivel`,
        `🎁 *PREMIOS* — Ver premios disponibles`,
        `🎉 *EVENTOS* — Próximos eventos`,
        `📲 *QR* — Tu código de lealtad`,
        `✅ *CANJEAR XXXXXX* — Validar un código de premio`,
        ``,
        `O abre la app: https://reguards.app`,
    ].join('\n');
}

function handleUnknown() {
    return [
        `🤔 No entendí ese mensaje.`,
        ``,
        `Responde *AYUDA* para ver los comandos disponibles.`,
    ].join('\n');
}

// ─── Main webhook handler ──────────────────────────────────────────────────────

/**
 * Express handler for POST /api/webhooks/whatsapp
 * Twilio sends: Body (message text), From (whatsapp:+502...), To
 */
async function whatsappWebhookHandler(req, res) {
    try {
        const body = req.body.Body || '';
        const fromRaw = req.body.From || ''; // "whatsapp:+50212345678"
        const phone = fromRaw.replace('whatsapp:', '');

        // Find user by phone
        const user = await User.findOne({ phone, role: 'customer' });

        if (!user) {
            const reply = [
                `👋 ¡Hola! No encontramos una cuenta con este número.`,
                ``,
                `Regístrate gratis en: https://reguards.app`,
            ].join('\n');
            return sendTwiMLReply(res, reply);
        }

        const { intent, code } = parseIntent(body);
        let replyText;

        switch (intent) {
            case 'PUNTOS':  replyText = await handlePuntos(user);  break;
            case 'PREMIOS': replyText = await handlePremios(user); break;
            case 'EVENTOS': replyText = await handleEventos();     break;
            case 'QR':      replyText = await handleQR(user);      break;
            case 'CANJEAR': replyText = await handleCanjear(user, code); break;
            case 'AYUDA':   replyText = handleAyuda();             break;
            default:        replyText = handleUnknown();           break;
        }

        sendTwiMLReply(res, replyText);
    } catch (err) {
        console.error('WhatsApp bot error:', err);
        sendTwiMLReply(res, '⚠️ Hubo un error. Intenta de nuevo en un momento.');
    }
}

function sendTwiMLReply(res, message) {
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`);
}

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = { whatsappWebhookHandler, parseIntent };
