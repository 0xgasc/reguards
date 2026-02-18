/**
 * Notification Service — WhatsApp via Twilio
 *
 * Silently no-ops if TWILIO_* env vars are absent, so the app works
 * without WhatsApp configured during development.
 *
 * Setup:
 *   TWILIO_ACCOUNT_SID=ACxxx
 *   TWILIO_AUTH_TOKEN=xxx
 *   TWILIO_WHATSAPP_FROM=+14155238886   (Twilio sandbox or approved number)
 *
 * To use Twilio sandbox: join sandbox first, then messages work immediately.
 */

let twilioClient = null;

function getClient() {
    if (!twilioClient) {
        const sid   = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        if (!sid || !token) return null;
        try {
            const twilio = require('twilio');
            twilioClient = twilio(sid, token);
        } catch {
            // twilio package not installed — skip silently
            return null;
        }
    }
    return twilioClient;
}

const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

/**
 * Send a WhatsApp message.
 * @param {string} to   — E.164 phone, e.g. "+50212345678"
 * @param {string} body — Message text
 */
async function sendWhatsApp(to, body) {
    const client = getClient();
    if (!client) return; // WhatsApp not configured — skip silently

    try {
        await client.messages.create({
            from: FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`,
            to:   `whatsapp:${to}`,
            body,
        });
    } catch (err) {
        // Log but never throw — notifications are best-effort
        console.warn('⚠️  WhatsApp send failed:', err.message);
    }
}

// ─── Message templates ────────────────────────────────────────────────────────

/**
 * Notify customer that they earned points at a restaurant.
 */
async function notifyPointsEarned({ phone, pointsEarned, totalPoints, restaurantName, tier }) {
    const tierEmoji = { BRONCE: '🥉', PLATA: '🥈', ORO: '🥇', PLATINO: '💎' }[tier] || '⭐';

    const body = [
        `🎉 *¡Ganaste ${pointsEarned} puntos en ${restaurantName}!*`,
        ``,
        `Saldo total: *${totalPoints} pts* ${tierEmoji} ${tier}`,
        ``,
        `Sigue acumulando para canjear premios en la app REGUARDS.`,
    ].join('\n');

    await sendWhatsApp(phone, body);
}

/**
 * Notify customer that their reward redemption was validated.
 */
async function notifyRedemptionFulfilled({ phone, rewardName, restaurantName, remainingPoints }) {
    const body = [
        `✅ *¡Premio canjeado!*`,
        ``,
        `${rewardName} en ${restaurantName}`,
        ``,
        `Puntos restantes: *${remainingPoints}*`,
        `¡Gracias por usar REGUARDS! 🙌`,
    ].join('\n');

    await sendWhatsApp(phone, body);
}

/**
 * Notify customer their RSVP was confirmed for an event.
 */
async function notifyRsvpConfirmed({ phone, eventTitle, eventDate, venue }) {
    const dateStr = new Date(eventDate).toLocaleString('es-GT', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit',
    });

    const body = [
        `🎟️ *¡Tu RSVP fue confirmado!*`,
        ``,
        `*${eventTitle}*`,
        `📅 ${dateStr}`,
        venue ? `📍 ${venue}` : '',
        ``,
        `Muestra este mensaje o abre REGUARDS el día del evento para hacer check-in.`,
    ].filter(Boolean).join('\n');

    await sendWhatsApp(phone, body);
}

module.exports = {
    sendWhatsApp,
    notifyPointsEarned,
    notifyRedemptionFulfilled,
    notifyRsvpConfirmed,
};
