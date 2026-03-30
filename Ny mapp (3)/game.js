// ===== MAIN GAME CONTROLLER =====
(function () {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 960;
    canvas.height = 540;

    // --- State ---
    let state = 'title'; // title, playing, paused, gameover, win, levelIntro
    let currentLevel = 0;
    let player, enemies, collectibles, flag, platforms;
    let gameTime = 0, levelTime = 0, totalScore = 0;
    let introTimer = 0;

    // --- DOM refs ---
    const titleScreen = document.getElementById('title-screen');
    const howScreen = document.getElementById('how-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const winScreen = document.getElementById('win-screen');
    const hud = document.getElementById('hud');
    const levelIntro = document.getElementById('level-intro');

    function showOverlay(el) {
        [titleScreen, howScreen, pauseScreen, gameoverScreen, winScreen].forEach(o => o.classList.remove('active'));
        if (el) el.classList.add('active');
    }

    // --- Buttons ---
    document.getElementById('btn-play').onclick = () => { startGame(); };
    document.getElementById('btn-how').onclick = () => showOverlay(howScreen);
    document.getElementById('btn-back').onclick = () => showOverlay(titleScreen);
    document.getElementById('btn-resume').onclick = () => resumeGame();
    document.getElementById('btn-quit').onclick = () => goToTitle();
    document.getElementById('btn-retry').onclick = () => { startGame(); };
    document.getElementById('btn-menu').onclick = () => goToTitle();
    document.getElementById('btn-next').onclick = () => nextLevel();
    document.getElementById('btn-win-menu').onclick = () => goToTitle();

    // --- Keyboard shortcuts ---
    window.addEventListener('keydown', e => {
        if (e.code === 'Enter' && state === 'title') startGame();
        if (e.code === 'Escape' && state === 'playing') pauseGame();
        if (e.code === 'Escape' && state === 'paused') resumeGame();
    });

    // --- Init audio on first interaction ---
    let audioInit = false;
    function ensureAudio() {
        if (!audioInit) { SFX.init(); audioInit = true; }
    }
    window.addEventListener('click', ensureAudio);
    window.addEventListener('keydown', ensureAudio);

    // --- Load Level ---
    function loadLevel(idx) {
        const lvl = LEVELS[idx];
        platforms = lvl.platforms.map(p => ({ ...p }));
        player = createPlayer(lvl.playerStart.x, lvl.playerStart.y);
        player.score = totalScore;
        enemies = lvl.enemies.map(e => createEnemy(e.x, e.y, e.type, e.patrol));
        collectibles = lvl.collectibles.map(c => createCollectible(c.x, c.y, c.type));
        flag = createFlag(lvl.flag.x, lvl.flag.y);
        Camera.reset();
        Particles.clear();
        levelTime = 0;
    }

    function startGame() {
        currentLevel = 0;
        totalScore = 0;
        loadLevel(0);
        showOverlay(null);
        showLevelIntro();
    }

    function showLevelIntro() {
        state = 'levelIntro';
        introTimer = 120;
        const lvl = LEVELS[currentLevel];
        document.getElementById('level-intro-text').textContent = 'Level ' + (currentLevel + 1);
        document.getElementById('level-intro-name').textContent = lvl.name;
        levelIntro.classList.remove('hidden');
        hud.classList.add('hidden');
    }

    function pauseGame() { state = 'paused'; showOverlay(pauseScreen); }
    function resumeGame() { state = 'playing'; showOverlay(null); }

    function goToTitle() {
        state = 'title';
        showOverlay(titleScreen);
        hud.classList.add('hidden');
        levelIntro.classList.add('hidden');
    }

    function nextLevel() {
        currentLevel++;
        if (currentLevel >= LEVELS.length) {
            // Beat all levels — show final win
            document.getElementById('win-score').textContent = 'Final Score: ' + player.score;
            document.getElementById('win-time').textContent = 'You beat all levels!';
            document.getElementById('btn-next').textContent = '↺ Play Again';
            document.getElementById('btn-next').onclick = () => {
                document.getElementById('btn-next').textContent = 'Next Level →';
                document.getElementById('btn-next').onclick = () => nextLevel();
                startGame();
            };
            return;
        }
        totalScore = player.score;
        loadLevel(currentLevel);
        showOverlay(null);
        showLevelIntro();
    }

    // --- HUD Update ---
    function updateHUD() {
        let hearts = '';
        for (let i = 0; i < player.lives; i++) hearts += '❤️';
        for (let i = player.lives; i < 3; i++) hearts += '🖤';
        document.getElementById('hud-lives').textContent = hearts;
        document.getElementById('hud-score').textContent = '🌟 ' + player.score;
        document.getElementById('hud-level').textContent = 'Level ' + (currentLevel + 1);
        document.getElementById('hud-time').textContent = '⏱ ' + Math.floor(levelTime / 60) + 's';
    }

    // --- Platform decoration ---
    function drawPlatforms(ctx, time) {
        for (const p of platforms) {
            // Main body
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - Camera.x, p.y - Camera.y, p.w, p.h);

            // Top surface highlight (only for thin platforms or top of ground)
            if (p.h <= 20 || p.y === Math.min(...platforms.filter(q => q.x === p.x).map(q => q.y))) {
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(p.x - Camera.x, p.y - Camera.y, p.w, 3);
            }

            // Grass/glow dots on top
            if (p.h <= 20) {
                ctx.fillStyle = 'rgba(168,85,247,0.3)';
                for (let gx = p.x + 4; gx < p.x + p.w - 4; gx += 12) {
                    const gh = Math.sin(gx * 0.3 + time * 0.02) * 2;
                    ctx.fillRect(gx - Camera.x, p.y - Camera.y - 2 + gh, 2, 3);
                }
            }
        }
    }

    // --- Main Game Loop ---
    function gameLoop() {
        gameTime++;

        if (state === 'levelIntro') {
            introTimer--;
            if (introTimer <= 0) {
                state = 'playing';
                levelIntro.classList.add('hidden');
                hud.classList.remove('hidden');
            }
            // Draw background during intro
            BG.draw(ctx, gameTime);
            drawPlatforms(ctx, gameTime);
            drawFlag(ctx, flag, gameTime);
        }

        if (state === 'playing') {
            levelTime++;

            // Update
            updatePlayer(player, platforms, 1);
            for (const e of enemies) updateEnemy(e, platforms);
            Particles.update();
            Camera.follow(player, LEVELS[currentLevel].worldWidth, LEVELS[currentLevel].worldHeight);

            // Player-enemy collision
            for (const e of enemies) {
                if (!e.alive || !rectsOverlap(player, e)) continue;
                if (player.invincible > 0) continue;
                // Stomp check: player falling and feet above enemy center
                if (player.vy > 0 && player.y + player.h - 4 < e.y + e.h / 2) {
                    e.alive = false;
                    e.squishTimer = 15;
                    player.vy = -7;
                    player.score += 100;
                    SFX.play('stomp');
                    Particles.spawn(e.x + e.w / 2, e.y + e.h / 2, 10, '#ef4444', { speed: 3 });
                } else {
                    hurtPlayer(player);
                }
            }

            // Collectibles
            for (const c of collectibles) {
                if (c.collected) continue;
                if (rectsOverlap(player, c)) {
                    c.collected = true;
                    if (c.type === 'star') {
                        player.score += 50;
                        SFX.play('coin');
                        Particles.spawn(c.x + 8, c.y + 8, 8, '#ffd700', { speed: 3, life: 20 });
                    } else if (c.type === 'gem') {
                        player.score += 200;
                        SFX.play('gem');
                        Particles.spawn(c.x + 8, c.y + 8, 15, '#06b6d4', { speed: 4, life: 25 });
                    }
                }
            }

            // Flag (win)
            if (rectsOverlap(player, flag)) {
                state = 'win';
                SFX.play('win');
                Particles.spawn(flag.x + 8, flag.y + 24, 30, '#22c55e', { speed: 5, life: 40 });
                Particles.spawn(flag.x + 8, flag.y + 24, 20, '#ffd700', { speed: 4, life: 35 });
                document.getElementById('win-score').textContent = 'Score: ' + player.score;
                document.getElementById('win-time').textContent = 'Time: ' + Math.floor(levelTime / 60) + 's';
                setTimeout(() => showOverlay(winScreen), 800);
                hud.classList.add('hidden');
            }

            // Death
            if (player.dead && player.deathTimer <= 0) {
                state = 'gameover';
                document.getElementById('final-score').textContent = 'Score: ' + player.score;
                showOverlay(gameoverScreen);
                hud.classList.add('hidden');
            }

            // --- DRAW ---
            BG.draw(ctx, gameTime);
            drawPlatforms(ctx, gameTime);

            for (const c of collectibles) drawCollectible(ctx, c, gameTime);
            drawFlag(ctx, flag, gameTime);
            for (const e of enemies) drawEnemy(ctx, e, gameTime);
            drawPlayer(ctx, player, gameTime);
            Particles.draw(ctx);

            updateHUD();
        }

        if (state === 'win') {
            Particles.update();
            BG.draw(ctx, gameTime);
            drawPlatforms(ctx, gameTime);
            for (const c of collectibles) drawCollectible(ctx, c, gameTime);
            drawFlag(ctx, flag, gameTime);
            for (const e of enemies) drawEnemy(ctx, e, gameTime);
            drawPlayer(ctx, player, gameTime);
            Particles.draw(ctx);
        }

        if (state === 'title') {
            // Animated title background
            BG.draw(ctx, gameTime);
        }

        requestAnimationFrame(gameLoop);
    }

    // --- Start ---
    BG.init();
    gameLoop();
})();
