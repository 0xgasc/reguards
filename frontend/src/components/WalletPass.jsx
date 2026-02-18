/**
 * WalletPass — Downloadable loyalty card
 * Renders a styled canvas card and lets the user save it as PNG.
 * No external dependencies — pure Canvas 2D API.
 */
import { useRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';

const TIER_COLORS = {
    BRONCE:  { bg: '#CD7F32', text: '#fff', label: '🥉 BRONCE' },
    PLATA:   { bg: '#C0C0C0', text: '#000', label: '🥈 PLATA'  },
    ORO:     { bg: '#FFD700', text: '#000', label: '🥇 ORO'    },
    PLATINO: { bg: '#0a0a0a', text: '#FFFF00', label: '💎 PLATINO' },
};

export default function WalletPass({ profile }) {
    const canvasRef = useRef(null);
    const [rendered, setRendered] = useState(false);
    const [open, setOpen] = useState(false);

    const tier = profile?.tier || 'BRONCE';
    const tc = TIER_COLORS[tier] || TIER_COLORS.BRONCE;

    useEffect(() => {
        if (!open || !profile || !canvasRef.current) return;
        drawCard();
    }, [open, profile]);

    async function drawCard() {
        const canvas = canvasRef.current;
        const W = 680, H = 380;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // ── Background ──────────────────────────────────────────────────
        ctx.fillStyle = tc.bg;
        ctx.fillRect(0, 0, W, H);

        // ── Bold border ──────────────────────────────────────────────────
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, W - 8, H - 8);

        // ── Inner right panel (white) ─────────────────────────────────
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(W - 200, 0, 200, H);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(W - 200, 0);
        ctx.lineTo(W - 200, H);
        ctx.stroke();

        // ── REGUARDS wordmark ──────────────────────────────────────────
        ctx.fillStyle = tc.text;
        ctx.font = 'bold 36px Arial Black, sans-serif';
        ctx.fillText('REGUARDS', 32, 58);

        // ── Tier badge ──────────────────────────────────────────────────
        ctx.font = 'bold 22px Arial Black, sans-serif';
        ctx.fillText(tc.label, 32, 94);

        // ── Phone number ────────────────────────────────────────────────
        ctx.font = '18px monospace';
        ctx.fillStyle = tc.text;
        ctx.globalAlpha = 0.7;
        ctx.fillText(profile.phone || '', 32, 130);
        ctx.globalAlpha = 1;

        // ── Decorative horizontal rule ──────────────────────────────────
        ctx.strokeStyle = tc.text;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(32, 145);
        ctx.lineTo(W - 220, 145);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // ── Points block ────────────────────────────────────────────────
        const pts = (profile.totalPoints || 0).toLocaleString();
        ctx.font = 'bold 80px Arial Black, sans-serif';
        ctx.fillStyle = tc.text;
        ctx.fillText(pts, 32, 252);

        ctx.font = 'bold 18px monospace';
        ctx.globalAlpha = 0.7;
        ctx.fillText('PUNTOS DISPONIBLES', 32, 280);
        ctx.globalAlpha = 1;

        // ── Member since ────────────────────────────────────────────────
        const since = profile.createdAt
            ? new Date(profile.createdAt).getFullYear()
            : new Date().getFullYear();
        ctx.font = '14px monospace';
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = tc.text;
        ctx.fillText(`MIEMBRO DESDE ${since}`, 32, H - 32);
        ctx.globalAlpha = 1;

        // ── Visit count ─────────────────────────────────────────────────
        if (profile.visitCount) {
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = tc.text;
            ctx.globalAlpha = 0.75;
            ctx.fillText(`${profile.visitCount} VISITAS`, 32, H - 52);
            ctx.globalAlpha = 1;
        }

        // ── Decorative diagonal stripes (bottom-left corner) ────────────
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 12;
        for (let i = -H; i < W; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, H);
            ctx.lineTo(i + H, 0);
            ctx.stroke();
        }
        ctx.restore();

        // ── QR code in right panel ───────────────────────────────────────
        try {
            const payload = JSON.stringify({ phone: profile.phone, id: profile.id || profile._id });
            const qrDataUrl = await QRCode.toDataURL(payload, {
                width: 160,
                margin: 1,
                color: { dark: '#000000', light: '#ffffff' },
            });
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, W - 188, 28, 160, 160);

                // ── Phone snippet below QR ────────────────────────────
                ctx.fillStyle = '#000';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(profile.phone?.slice(-8) || '', W - 108, 210);

                // ── "PRESENTAR AL CAJERO" label ───────────────────────
                ctx.fillStyle = '#000';
                ctx.font = 'bold 10px Arial Black, sans-serif';
                ctx.fillText('PRESENTAR AL CAJERO', W - 108, 240);

                // ── Bottom label in right panel ───────────────────────
                ctx.font = 'bold 11px monospace';
                ctx.fillStyle = '#000';
                ctx.fillText('reguards.app', W - 108, H - 20);

                ctx.textAlign = 'left';
                setRendered(true);
            };
            img.src = qrDataUrl;
        } catch {
            setRendered(true);
        }
    }

    function downloadCard() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `reguards-${profile?.phone?.slice(-6) || 'card'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="w-full border-4 border-black bg-white shadow-brutal-sm py-5 font-black text-lg hover:bg-yellow-50 hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
                🪪 MI TARJETA DE LEALTAD
            </button>
        );
    }

    return (
        <div className="border-4 border-black shadow-brutal bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
                <p className="font-black text-lg">🪪 TU TARJETA REGUARDS</p>
                <button
                    onClick={() => { setOpen(false); setRendered(false); }}
                    className="border-2 border-black font-black text-xs px-3 py-1 hover:bg-gray-100"
                >
                    CERRAR
                </button>
            </div>

            <div className="overflow-x-auto">
                <canvas
                    ref={canvasRef}
                    className="border-4 border-black max-w-full"
                    style={{ imageRendering: 'crisp-edges' }}
                />
            </div>

            {rendered && (
                <div className="flex gap-3">
                    <button
                        onClick={downloadCard}
                        className="flex-1 bg-black text-yellow-300 border-4 border-black font-black py-3 text-sm shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                    >
                        ⬇ DESCARGAR PNG
                    </button>
                    <button
                        onClick={() => { setRendered(false); setOpen(false); setTimeout(() => setOpen(true), 50); }}
                        className="border-4 border-black font-black text-sm px-4 py-3 hover:bg-yellow-50 transition-colors"
                    >
                        ↺
                    </button>
                </div>
            )}

            <p className="font-mono text-xs opacity-50 text-center">
                Guarda esta imagen en tu galería para mostrarla en el restaurante
            </p>
        </div>
    );
}
