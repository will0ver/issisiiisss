// ===== ENGINE: Input, Camera, Physics, Particles, Audio =====

const Keys = {};
window.addEventListener('keydown', e => { Keys[e.code] = true; });
window.addEventListener('keyup', e => { Keys[e.code] = false; });

// --- Camera ---
const Camera = {
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    width: 960, height: 540,
    smoothing: 0.08,
    follow(entity, worldW, worldH) {
        this.targetX = entity.x + entity.w / 2 - this.width / 2;
        this.targetY = entity.y + entity.h / 2 - this.height / 2 + 40;
        this.x += (this.targetX - this.x) * this.smoothing;
        this.y += (this.targetY - this.y) * this.smoothing;
        this.x = Math.max(0, Math.min(this.x, worldW - this.width));
        this.y = Math.max(0, Math.min(this.y, worldH - this.height));
    },
    reset() { this.x = 0; this.y = 0; }
};

// --- Particles ---
const Particles = {
    list: [],
    spawn(x, y, count, color, opts = {}) {
        for (let i = 0; i < count; i++) {
            this.list.push({
                x, y,
                vx: (Math.random() - 0.5) * (opts.speed || 4),
                vy: (Math.random() - 0.8) * (opts.speed || 4),
                life: opts.life || 30 + Math.random() * 20,
                maxLife: opts.life || 30 + Math.random() * 20,
                size: opts.size || 2 + Math.random() * 3,
                color: color,
                gravity: opts.gravity || 0.05
            });
        }
    },
    update() {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const p = this.list[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.life--;
            if (p.life <= 0) this.list.splice(i, 1);
        }
    },
    draw(ctx) {
        for (const p of this.list) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - Camera.x, p.y - Camera.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    },
    clear() { this.list = []; }
};

// --- Simple Sound Effects (Web Audio) ---
const SFX = {
    ctx: null,
    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    play(type) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const t = this.ctx.currentTime;
        switch (type) {
            case 'jump':
                osc.type = 'square'; osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
                gain.gain.setValueAtTime(0.15, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                osc.start(t); osc.stop(t + 0.15); break;
            case 'coin':
                osc.type = 'square'; osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
                gain.gain.setValueAtTime(0.12, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                osc.start(t); osc.stop(t + 0.12); break;
            case 'gem':
                osc.type = 'sine'; osc.frequency.setValueAtTime(600, t);
                osc.frequency.exponentialRampToValueAtTime(1400, t + 0.2);
                gain.gain.setValueAtTime(0.15, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                osc.start(t); osc.stop(t + 0.25); break;
            case 'stomp':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, t);
                osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
                gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.start(t); osc.stop(t + 0.2); break;
            case 'hurt':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
                gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
                osc.start(t); osc.stop(t + 0.35); break;
            case 'win':
                osc.type = 'square';
                [523, 659, 784, 1047].forEach((f, i) => {
                    osc.frequency.setValueAtTime(f, t + i * 0.12);
                });
                gain.gain.setValueAtTime(0.12, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
                osc.start(t); osc.stop(t + 0.55); break;
            case 'die':
                osc.type = 'square'; osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(60, t + 0.6);
                gain.gain.setValueAtTime(0.18, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
                osc.start(t); osc.stop(t + 0.7); break;
        }
    }
};

// --- Collision helpers ---
function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// --- Drawing helpers ---
function drawRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - Camera.x), Math.round(y - Camera.y), w, h);
}

function drawCircle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(Math.round(x - Camera.x), Math.round(y - Camera.y), r, 0, Math.PI * 2);
    ctx.fill();
}

// --- Background renderer ---
const BG = {
    stars: [],
    init() {
        this.stars = [];
        for (let i = 0; i < 120; i++) {
            this.stars.push({
                x: Math.random() * 1920,
                y: Math.random() * 400,
                size: 0.5 + Math.random() * 2,
                twinkle: Math.random() * Math.PI * 2,
                speed: 0.3 + Math.random() * 0.5
            });
        }
    },
    draw(ctx, time) {
        // Sky gradient
        const grd = ctx.createLinearGradient(0, 0, 0, 540);
        grd.addColorStop(0, '#0d0b2e');
        grd.addColorStop(0.5, '#1a1145');
        grd.addColorStop(1, '#2d1b69');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 960, 540);

        // Parallax stars
        for (const s of this.stars) {
            const sx = ((s.x - Camera.x * s.speed * 0.1) % 960 + 960) % 960;
            const sy = s.y - Camera.y * 0.05;
            const alpha = 0.4 + Math.sin(time * 0.03 + s.twinkle) * 0.3;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx, sy, s.size, s.size);
        }
        ctx.globalAlpha = 1;

        // Mountains (parallax)
        ctx.fillStyle = 'rgba(30, 20, 60, 0.6)';
        ctx.beginPath();
        ctx.moveTo(0, 540);
        for (let x = 0; x <= 960; x += 60) {
            const h = 120 + Math.sin((x + Camera.x * 0.15) * 0.008) * 60
                        + Math.sin((x + Camera.x * 0.15) * 0.02) * 25;
            ctx.lineTo(x, 540 - h);
        }
        ctx.lineTo(960, 540);
        ctx.fill();

        // Hills (closer parallax)
        ctx.fillStyle = 'rgba(45, 30, 80, 0.5)';
        ctx.beginPath();
        ctx.moveTo(0, 540);
        for (let x = 0; x <= 960; x += 40) {
            const h = 70 + Math.sin((x + Camera.x * 0.3) * 0.012) * 40
                        + Math.sin((x + Camera.x * 0.3) * 0.03) * 15;
            ctx.lineTo(x, 540 - h);
        }
        ctx.lineTo(960, 540);
        ctx.fill();
    }
};
