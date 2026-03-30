// ===== ENTITIES: Player, Enemies, Collectibles, Flag =====

// --- Player ---
function createPlayer(x, y) {
    return {
        x, y, w: 24, h: 32,
        vx: 0, vy: 0,
        speed: 3.2, jumpPower: -9.5,
        gravity: 0.45, maxFallSpeed: 10,
        grounded: false, jumps: 0, maxJumps: 2,
        facing: 1, // 1=right, -1=left
        lives: 3, score: 0,
        invincible: 0, // invincibility frames
        animTimer: 0, frame: 0,
        dead: false, deathTimer: 0,
        // trail for visual effect
        trail: []
    };
}

function updatePlayer(p, platforms, dt) {
    if (p.dead) { p.deathTimer--; return; }
    if (p.invincible > 0) p.invincible--;

    // Input
    const left = Keys['ArrowLeft'] || Keys['KeyA'];
    const right = Keys['ArrowRight'] || Keys['KeyD'];
    const jumpKey = Keys['Space'] || Keys['ArrowUp'] || Keys['KeyW'];

    // Horizontal movement with acceleration
    if (left) { p.vx = Math.max(p.vx - 0.5, -p.speed); p.facing = -1; }
    else if (right) { p.vx = Math.min(p.vx + 0.5, p.speed); p.facing = 1; }
    else { p.vx *= 0.8; if (Math.abs(p.vx) < 0.1) p.vx = 0; }

    // Jump
    if (jumpKey && !p._jumpHeld && p.jumps < p.maxJumps) {
        p.vy = p.jumpPower * (p.jumps === 1 ? 0.85 : 1);
        p.jumps++;
        p.grounded = false;
        SFX.play('jump');
        Particles.spawn(p.x + p.w / 2, p.y + p.h, 6, '#a78bfa', { speed: 2, life: 15 });
    }
    p._jumpHeld = jumpKey;

    // Gravity
    p.vy = Math.min(p.vy + p.gravity, p.maxFallSpeed);

    // Move X
    p.x += p.vx;
    for (const plat of platforms) {
        if (rectsOverlap(p, plat)) {
            if (p.vx > 0) p.x = plat.x - p.w;
            else if (p.vx < 0) p.x = plat.x + plat.w;
            p.vx = 0;
        }
    }

    // Move Y
    p.y += p.vy;
    p.grounded = false;
    for (const plat of platforms) {
        if (rectsOverlap(p, plat)) {
            if (p.vy > 0) {
                p.y = plat.y - p.h;
                p.grounded = true;
                p.jumps = 0;
            } else if (p.vy < 0) {
                p.y = plat.y + plat.h;
            }
            p.vy = 0;
        }
    }

    // Fall death
    if (p.y > 800) { hurtPlayer(p, true); }

    // Animation
    p.animTimer++;
    if (Math.abs(p.vx) > 0.5 && p.grounded) {
        if (p.animTimer % 8 === 0) p.frame = (p.frame + 1) % 4;
    } else if (!p.grounded) {
        p.frame = p.vy < 0 ? 5 : 6;
    } else {
        p.frame = 0;
    }

    // Trail
    if (Math.abs(p.vx) > 1.5 || !p.grounded) {
        p.trail.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, life: 8 });
    }
    for (let i = p.trail.length - 1; i >= 0; i--) {
        p.trail[i].life--;
        if (p.trail[i].life <= 0) p.trail.splice(i, 1);
    }
}

function hurtPlayer(p, fatal) {
    if (p.invincible > 0 && !fatal) return;
    p.lives--;
    SFX.play(p.lives <= 0 ? 'die' : 'hurt');
    if (p.lives <= 0) {
        p.dead = true;
        p.deathTimer = 60;
        Particles.spawn(p.x + p.w / 2, p.y + p.h / 2, 25, '#ef4444', { speed: 5 });
    } else {
        p.invincible = 90;
        p.vy = -6;
        Particles.spawn(p.x + p.w / 2, p.y + p.h / 2, 12, '#fbbf24', { speed: 3 });
    }
}

function drawPlayer(ctx, p, time) {
    if (p.dead) return;
    if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) return; // blink

    const sx = Math.round(p.x - Camera.x);
    const sy = Math.round(p.y - Camera.y);

    // Trail
    for (const t of p.trail) {
        const a = t.life / 8;
        ctx.globalAlpha = a * 0.3;
        ctx.fillStyle = '#a78bfa';
        ctx.fillRect(t.x - Camera.x - 3, t.y - Camera.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;

    // Body
    ctx.save();
    ctx.translate(sx + p.w / 2, sy + p.h / 2);
    ctx.scale(p.facing, 1);

    // Legs
    const legAnim = p.grounded && Math.abs(p.vx) > 0.5 ? Math.sin(p.animTimer * 0.4) * 4 : 0;
    ctx.fillStyle = '#4338ca';
    ctx.fillRect(-8, 6, 7, 14 + legAnim);
    ctx.fillRect(1, 6, 7, 14 - legAnim);

    // Torso
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(-10, -6, 20, 14);

    // Head
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-8, -16, 16, 12);

    // Eye
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(2, -13, 4, 4);

    // Visor shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(3, -13, 1, 2);

    // Cape (flowing)
    const capeWave = Math.sin(time * 0.08 + p.x * 0.1) * 3;
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-16 + capeWave, 10);
    ctx.lineTo(-10, 8);
    ctx.fill();

    ctx.restore();
}

// --- Enemies ---
function createEnemy(x, y, type, patrolDist) {
    return {
        x, y, w: 24, h: 24, type: type || 'walker',
        vx: 1, vy: 0, startX: x,
        patrolDist: patrolDist || 80,
        alive: true, squishTimer: 0, animTimer: 0
    };
}

function updateEnemy(e, platforms) {
    if (!e.alive) { e.squishTimer--; return; }
    e.animTimer++;

    if (e.type === 'walker') {
        e.x += e.vx;
        if (Math.abs(e.x - e.startX) > e.patrolDist) e.vx *= -1;
        // Gravity
        e.vy = Math.min(e.vy + 0.4, 8);
        e.y += e.vy;
        for (const plat of platforms) {
            if (rectsOverlap(e, plat) && e.vy > 0) {
                e.y = plat.y - e.h; e.vy = 0;
            }
        }
    } else if (e.type === 'flyer') {
        e.x += e.vx;
        if (Math.abs(e.x - e.startX) > e.patrolDist) e.vx *= -1;
        e.y += Math.sin(e.animTimer * 0.05) * 0.5;
    }
}

function drawEnemy(ctx, e, time) {
    if (!e.alive && e.squishTimer <= 0) return;
    const sx = Math.round(e.x - Camera.x);
    const sy = Math.round(e.y - Camera.y);

    if (!e.alive) {
        // Squished
        ctx.globalAlpha = e.squishTimer / 15;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(sx, sy + e.h - 6, e.w, 6);
        ctx.globalAlpha = 1;
        return;
    }

    if (e.type === 'walker') {
        // Body
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(sx + 2, sy + 4, 20, 16);
        // Head spikes
        ctx.fillStyle = '#dc2626';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(sx + 4 + i * 7, sy, 4, 6);
        }
        // Eyes
        const dir = e.vx > 0 ? 1 : 0;
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 5 + dir * 8, sy + 7, 5, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(sx + 7 + dir * 8, sy + 9, 2, 2);
        // Feet
        const fAnim = Math.sin(e.animTimer * 0.2) * 2;
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(sx + 3, sy + 20, 7, 4 + fAnim);
        ctx.fillRect(sx + 14, sy + 20, 7, 4 - fAnim);
    } else if (e.type === 'flyer') {
        // Wings
        const wingY = Math.sin(time * 0.15) * 4;
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(sx - 4, sy + 4 + wingY, 8, 10);
        ctx.fillRect(sx + e.w - 4, sy + 4 - wingY, 8, 10);
        // Body
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(sx + 4, sy + 2, 16, 18);
        // Face
        ctx.fillStyle = '#000';
        ctx.fillRect(sx + 7, sy + 7, 3, 3);
        ctx.fillRect(sx + 14, sy + 7, 3, 3);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(sx + 9, sy + 14, 6, 2);
    }
}

// --- Collectibles ---
function createCollectible(x, y, type) {
    return { x, y, w: 16, h: 16, type: type || 'star', collected: false, animTimer: Math.random() * 100 };
}

function drawCollectible(ctx, c, time) {
    if (c.collected) return;
    c.animTimer++;
    const sx = Math.round(c.x - Camera.x);
    const sy = Math.round(c.y - Camera.y + Math.sin(c.animTimer * 0.06) * 3);

    if (c.type === 'star') {
        const glow = 0.3 + Math.sin(c.animTimer * 0.08) * 0.15;
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(sx - 4, sy - 4, 24, 24);
        ctx.globalAlpha = 1;
        // Star shape using rects (pixel style)
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(sx + 5, sy, 6, 16);
        ctx.fillRect(sx, sy + 5, 16, 6);
        ctx.fillStyle = '#fff8dc';
        ctx.fillRect(sx + 6, sy + 6, 4, 4);
    } else if (c.type === 'gem') {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(sx + 2, sy, 12, 4);
        ctx.fillRect(sx, sy + 4, 16, 8);
        ctx.fillRect(sx + 2, sy + 12, 12, 4);
        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(sx + 3, sy + 2, 3, 3);
    }
}

// --- Flag (level end) ---
function createFlag(x, y) {
    return { x, y, w: 16, h: 48 };
}

function drawFlag(ctx, f, time) {
    const sx = Math.round(f.x - Camera.x);
    const sy = Math.round(f.y - Camera.y);
    // Pole
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(sx + 6, sy, 4, 48);
    // Flag cloth (waving)
    const wave = Math.sin(time * 0.08) * 3;
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(sx + 10, sy + 4);
    ctx.lineTo(sx + 30 + wave, sy + 10);
    ctx.lineTo(sx + 10, sy + 20);
    ctx.fill();
    // Star on flag
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sx + 15, sy + 10, 4, 4);
    // Base
    ctx.fillStyle = '#64748b';
    ctx.fillRect(sx + 2, sy + 44, 12, 4);
}
