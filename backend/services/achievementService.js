/**
 * Achievement Service
 *
 * Defines all achievement types and provides unlock logic.
 * Achievements are checked after key events:
 *   - Purchase recorded (visit count, streak, tier, explorer)
 *   - Reward redeemed
 *   - Referral completed
 *   - Birthday bonus awarded
 *   - Review submitted
 *
 * Usage:
 *   const { checkAchievements } = require('./achievementService');
 *   const newlyUnlocked = await checkAchievements(user, { event: 'purchase', ... });
 */

// ─── Achievement Catalogue ────────────────────────────────────────────────────
// Completely configurable — add/remove/edit achievements here.

const ACHIEVEMENTS = {
    FIRST_VISIT:   { id: 'FIRST_VISIT',   name: 'Primera Visita',   emoji: '🌱', desc: 'Registraste tu primera visita en Reguards' },
    VISITS_5:      { id: 'VISITS_5',      name: 'Regular',          emoji: '☕', desc: '5 visitas registradas' },
    VISITS_10:     { id: 'VISITS_10',     name: 'Fiel',             emoji: '🏅', desc: '10 visitas registradas' },
    VISITS_25:     { id: 'VISITS_25',     name: 'Veterano',         emoji: '⚡', desc: '25 visitas registradas' },
    VISITS_50:     { id: 'VISITS_50',     name: 'Leyenda Local',    emoji: '🦁', desc: '50 visitas registradas' },
    STREAK_3:      { id: 'STREAK_3',      name: 'On Fire',          emoji: '🔥', desc: '3 días seguidos visitando' },
    STREAK_7:      { id: 'STREAK_7',      name: 'Semana Perfecta',  emoji: '🏆', desc: '7 días seguidos visitando' },
    STREAK_30:     { id: 'STREAK_30',     name: 'Imparable',        emoji: '💥', desc: '30 días seguidos visitando' },
    TIER_PLATA:    { id: 'TIER_PLATA',    name: 'Plata',            emoji: '🥈', desc: 'Alcanzaste el nivel PLATA' },
    TIER_ORO:      { id: 'TIER_ORO',      name: 'Oro',              emoji: '🥇', desc: 'Alcanzaste el nivel ORO' },
    TIER_PLATINO:  { id: 'TIER_PLATINO',  name: 'Platino',          emoji: '💎', desc: 'Alcanzaste el nivel PLATINO' },
    FIRST_REDEEM:  { id: 'FIRST_REDEEM',  name: 'Primer Canje',     emoji: '🎁', desc: 'Canjeaste tu primer premio' },
    EXPLORER:      { id: 'EXPLORER',      name: 'Explorer',         emoji: '🗺️', desc: 'Visitaste 3 restaurantes distintos' },
    GLOBETROTTER:  { id: 'GLOBETROTTER',  name: 'Globetrotter',     emoji: '✈️', desc: 'Visitaste 5 restaurantes distintos' },
    SOCIAL_1:      { id: 'SOCIAL_1',      name: 'Conector',         emoji: '🫂', desc: 'Invitaste a tu primer amigo' },
    SOCIAL_5:      { id: 'SOCIAL_5',      name: 'Influencer',       emoji: '📣', desc: 'Invitaste a 5 amigos' },
    BIRTHDAY:      { id: 'BIRTHDAY',      name: 'Cumpleañero',      emoji: '🎂', desc: 'Recibiste tu bonus de cumpleaños' },
    REVIEWER:      { id: 'REVIEWER',      name: 'Crítico',          emoji: '⭐', desc: 'Dejaste tu primera reseña' },
    HIGH_ROLLER:   { id: 'HIGH_ROLLER',   name: 'High Roller',      emoji: '💸', desc: 'Acumulaste más de 1000 puntos' },
    ALLIANCE:      { id: 'ALLIANCE',      name: 'Aliado',           emoji: '🤝', desc: 'Canjeaste un premio en un restaurante aliado' },
};

/**
 * Check which achievements a user should unlock based on their current state.
 * Returns an array of newly unlocked achievement objects.
 * Mutates user.achievements in place (caller must save user).
 */
function checkAchievements(user, context = {}) {
    const unlocked = [];

    function tryUnlock(id) {
        if (!ACHIEVEMENTS[id]) return;
        if (user.achievements && user.achievements.some(a => a.id === id)) return; // already has it
        const ach = ACHIEVEMENTS[id];
        if (!user.achievements) user.achievements = [];
        user.achievements.push({ id, name: ach.name, emoji: ach.emoji, unlockedAt: new Date() });
        unlocked.push(ach);
    }

    // Visit count milestones
    const visits = user.visitCount || 0;
    if (visits >= 1)  tryUnlock('FIRST_VISIT');
    if (visits >= 5)  tryUnlock('VISITS_5');
    if (visits >= 10) tryUnlock('VISITS_10');
    if (visits >= 25) tryUnlock('VISITS_25');
    if (visits >= 50) tryUnlock('VISITS_50');

    // Streak milestones
    const streak = user.streakDays || 0;
    if (streak >= 3)  tryUnlock('STREAK_3');
    if (streak >= 7)  tryUnlock('STREAK_7');
    if (streak >= 30) tryUnlock('STREAK_30');

    // Tier milestones
    const pts = user.totalPoints || 0;
    if (pts >= 250)  tryUnlock('TIER_PLATA');
    if (pts >= 750)  tryUnlock('TIER_ORO');
    if (pts >= 2000) tryUnlock('TIER_PLATINO');
    if (pts >= 1000) tryUnlock('HIGH_ROLLER');

    // Referral milestones
    const refs = user.referralCount || 0;
    if (refs >= 1) tryUnlock('SOCIAL_1');
    if (refs >= 5) tryUnlock('SOCIAL_5');

    // Explorer milestones (unique restaurants visited)
    if (context.uniqueRestaurantCount !== undefined) {
        if (context.uniqueRestaurantCount >= 3) tryUnlock('EXPLORER');
        if (context.uniqueRestaurantCount >= 5) tryUnlock('GLOBETROTTER');
    }

    // Event-specific
    if (context.event === 'redeem') tryUnlock('FIRST_REDEEM');
    if (context.event === 'birthday') tryUnlock('BIRTHDAY');
    if (context.event === 'review') tryUnlock('REVIEWER');
    if (context.event === 'alliance_redeem') tryUnlock('ALLIANCE');

    return unlocked;
}

module.exports = { ACHIEVEMENTS, checkAchievements };
