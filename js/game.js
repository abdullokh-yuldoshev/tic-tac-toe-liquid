/**
 * =====================================================================
 * TIC-TAC-TOE LIQUID PREMIUM — js/game.js v3.1.0
 * Monolithic ES-module: Audio, Haptic, Confetti, Storage, AI, Game
 * =====================================================================
 */

const network = {
  peer: null,
  conn: null,
  isHost: false,
  isActive: false,
  roomID: null
};

/* ─────────────────────────────────────────────────────
   AUDIO SUBSYSTEM (Web Audio API)
   ───────────────────────────────────────────────────── */
const Sfx = {
  ctx: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playTone(freq, type, duration, vol = 0.1) {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  pop(soundEnabled) {
    if (!soundEnabled) return;
    this.init();
    this.playTone(600, 'sine', 0.1, 0.15);
    setTimeout(() => this.playTone(800, 'sine', 0.1, 0.1), 50);
  },

  click(soundEnabled) {
    if (!soundEnabled) return;
    this.init();
    this.playTone(400, 'triangle', 0.05, 0.05);
  },

  win(soundEnabled) {
    if (!soundEnabled) return;
    this.init();
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.4, 0.2), i * 120);
    });
  }
};

/* ─────────────────────────────────────────────────────
   HAPTIC FEEDBACK
   ───────────────────────────────────────────────────── */
const Haptic = {
  trigger(type = 'light') {
    if (!navigator.vibrate) return;
    if (type === 'light')  navigator.vibrate(5);
    if (type === 'medium') navigator.vibrate(15);
    if (type === 'heavy')  navigator.vibrate([20, 30, 20]);
  }
};

/* ─────────────────────────────────────────────────────
   CONFETTI ANIMATION
   ───────────────────────────────────────────────────── */
const Confetti = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },

  resize() {
    if (!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  start() {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    this.particles = [];

    const colors = ['#00C6FF', '#0072FF', '#FF9500', '#FF2D55', '#AF52DE', '#FFD700', '#F5B041'];
    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x:     this.canvas.width  / 2,
        y:     this.canvas.height / 2,
        vx:    (Math.random() - 0.5) * 18,
        vy:    (Math.random() - 0.5) * 18 - 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        size:  Math.random() * 9 + 4,
        life:  1.0,
        rot:   Math.random() * Math.PI * 2,
        rotV:  (Math.random() - 0.5) * 0.2
      });
    }

    if (!this.animId) this.loop();
  },

  loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let active = false;

    this.particles.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.35; // gravity
      p.rot += p.rotV;
      p.life -= 0.013;

      if (p.life > 0) {
        active = true;
        this.ctx.save();
        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle   = p.color;
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rot);
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.ctx.restore();
      }
    });

    if (active) {
      this.animId = requestAnimationFrame(() => this.loop());
    } else {
      this.animId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
};

/* ─────────────────────────────────────────────────────
   LOCAL STORAGE HELPERS
   ───────────────────────────────────────────────────── */
const STORE_KEY = "ttt_settings_liquid_v3";
const GAME_KEY  = "ttt_game_liquid_v3";
const BUILD_VERSION = "3.1.0";

function defaultSettings() {
  return {
    lang:  "ru",
    theme: "light",
    matchMode: "classic",
    mode:  "pvp",
    size:  3,
    goal:  3,
    ai:    "expert",
    p1:    "Игрок 1",
    p2:    "Игрок 2",
    p3:    "Игрок 3",
    p4:    "Игрок 4",
    sound: true,
    sym1:  "X",
    sym2:  "O",
    sym3:  "△",
    sym4:  "□",
    gamesPlayed: 0,
    gamesWon: 0,
    pveLevel: 1,
    pveXp: 0
  };
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s) return { ...defaultSettings(), ...s };
  } catch (e) { /* ignore */ }
  return defaultSettings();
}

function saveSettings(cfg) {
  localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
}

function loadGame() {
  try {
    return JSON.parse(localStorage.getItem(GAME_KEY));
  } catch (e) {
    return null;
  }
}

function saveGame(gameState) {
  localStorage.setItem(GAME_KEY, JSON.stringify({
    version: BUILD_VERSION,
    ...gameState
  }));
}

/* ─────────────────────────────────────────────────────
   AI ENGINE
   ───────────────────────────────────────────────────── */

/**
 * Full win-check — returns { win: bool, line: [] }
 */
function checkWinFull(b, sz, goal) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let r = 0; r < sz; r++) {
    for (let c = 0; c < sz; c++) {
      const start = b[r * sz + c];
      if (!start) continue;

      for (const d of dirs) {
        const line = [];
        for (let k = 0; k < goal; k++) {
          const nr = r + d[0] * k;
          const nc = c + d[1] * k;
          if (nr < 0 || nr >= sz || nc < 0 || nc >= sz) break;
          if (b[nr * sz + nc] === start) {
            line.push(nr * sz + nc);
          } else {
            break;
          }
        }
        if (line.length === goal) return { win: true, line };
      }
    }
  }
  return { win: false };
}

function checkWinSimple(b, sz, goal) {
  return checkWinFull(b, sz, goal).win;
}

/* ─────────────────────────────────────────────────────
   AI ENGINE v2 — TACTICAL BRAIN
   Priority chain:
     1. Win immediately
     2. Block opponent win
     3. Create a Fork (two winning threats at once)
     4. Block opponent Fork
     5. Strategic position (center → corners → edges)
   Level Expert on 3×3: Minimax with alpha-beta pruning
   ───────────────────────────────────────────────────── */

/**
 * Count open winning lines that pass through a cell.
 * Used to score strategic positions.
 */
function countOpenLines(b, sz, goal, sym) {
  const dirs  = [[1,0],[0,1],[1,1],[1,-1]];
  let threats = 0;

  for (let r = 0; r < sz; r++) {
    for (let c = 0; c < sz; c++) {
      for (const d of dirs) {
        // check if a full line of `goal` starting here is unblocked for `sym`
        let ours    = 0;
        let blocked = false;
        for (let k = 0; k < goal; k++) {
          const nr = r + d[0]*k, nc = c + d[1]*k;
          if (nr < 0 || nr >= sz || nc < 0 || nc >= sz) { blocked = true; break; }
          const v = b[nr*sz + nc];
          if (v && v !== sym) { blocked = true; break; }
          if (v === sym) ours++;
        }
        if (!blocked) threats += ours;
      }
    }
  }
  return threats;
}

/**
 * Count how many winning moves (forks) a symbol can create from position `idx`.
 * A fork = after placing sym at idx, there are >= 2 distinct winning threats.
 */
function countWinningThreats(b, sz, goal, idx, sym) {
  if (b[idx]) return 0;
  b[idx] = sym;

  const dirs  = [[1,0],[0,1],[1,1],[1,-1]];
  const winLines = new Set();

  // find every (goal-1)-in-a-row that needs one more cell
  const empties = b.map((v,i) => v === '' ? i : -1).filter(i => i !== -1);
  for (const e of empties) {
    if (e === idx) continue;
    b[e] = sym;
    if (checkWinSimple(b, sz, goal)) {
      // encode the winning line's direction as a string key to avoid double-counting
      for (const d of dirs) {
        for (let r = 0; r < sz; r++) {
          for (let c = 0; c < sz; c++) {
            const line = [];
            for (let k = 0; k < goal; k++) {
              const nr = r + d[0]*k, nc = c + d[1]*k;
              if (nr < 0 || nr >= sz || nc < 0 || nc >= sz) break;
              if (b[nr*sz+nc] === sym) line.push(nr*sz+nc);
              else break;
            }
            if (line.length === goal && line.includes(e)) {
              winLines.add(line.sort().join(','));
            }
          }
        }
      }
    }
    b[e] = '';
  }

  b[idx] = '';
  return winLines.size;
}

/**
 * Minimax with alpha-beta pruning — only used for Expert on 3x3
 */
function minimax(b, sz, goal, depth, isMax, alpha, beta, meSymbol, enemySymbol, maxDepth) {
  const res = checkWinFull(b, sz, goal);
  if (res.win) {
    // whoever just moved won
    const winner = b[res.line[0]];
    return winner === meSymbol ? (100 - depth) : -(100 - depth);
  }

  const empties = b.map((v,i) => v === '' ? i : -1).filter(i => i !== -1);
  if (!empties.length || depth >= maxDepth) return 0;

  if (isMax) {
    let best = -Infinity;
    for (const i of empties) {
      b[i] = meSymbol;
      const score = minimax(b, sz, goal, depth+1, false, alpha, beta, meSymbol, enemySymbol, maxDepth);
      b[i] = '';
      best  = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break; // prune
    }
    return best;
  } else {
    let best = Infinity;
    for (const i of empties) {
      b[i] = enemySymbol;
      const score = minimax(b, sz, goal, depth+1, true, alpha, beta, meSymbol, enemySymbol, maxDepth);
      b[i] = '';
      best = Math.min(best, score);
      beta = Math.min(beta, best);
      if (beta <= alpha) break; // prune
    }
    return best;
  }
}

/**
 * Tactical AI: returns best move index.
 * level: 'easy' | 'normal' | 'hard' | 'expert'
 */
function findBestMove(board, empties, cfg, meSymbol, enemySymbol) {
  const sz   = cfg.size;
  const gl   = cfg.goal;
  const is3x3Expert = (sz === 3 && gl === 3 && cfg.ai === 'expert');

  /* ── STEP 1: Win immediately ── */
  for (const i of empties) {
    board[i] = meSymbol;
    const win = checkWinSimple(board, sz, gl);
    board[i] = '';
    if (win) return i;
  }

  /* ── STEP 2: Block opponent immediate win ── */
  for (const i of empties) {
    board[i] = enemySymbol;
    const win = checkWinSimple(board, sz, gl);
    board[i] = '';
    if (win) return i;
  }

  /* ── Expert 3×3: full Minimax ── */
  if (is3x3Expert) {
    let bestScore = -Infinity;
    let bestMove  = empties[0];
    for (const i of empties) {
      board[i] = meSymbol;
      const score = minimax(board, sz, gl, 0, false, -Infinity, Infinity, meSymbol, enemySymbol, 9);
      board[i] = '';
      if (score > bestScore) { bestScore = score; bestMove = i; }
    }
    return bestMove;
  }

  /* ── STEP 3 (Hard+): Create a Fork — two threats at once ── */
  if (cfg.ai === 'hard' || cfg.ai === 'expert') {
    for (const i of empties) {
      if (countWinningThreats(board, sz, gl, i, meSymbol) >= 2) return i;
    }

    /* ── STEP 4: Block opponent Fork ── */
    for (const i of empties) {
      if (countWinningThreats(board, sz, gl, i, enemySymbol) >= 2) return i;
    }
  }

  /* ── STEP 5: Strategic position scoring ── */
  const center = Math.floor(sz / 2);

  // Score each empty cell
  const scored = empties.map(i => {
    const r = Math.floor(i / sz), c = i % sz;
    let score = 0;

    // Center is highest priority
    if (r === center && c === center) score += 50;

    // Corners
    const isCorner = (r === 0 || r === sz-1) && (c === 0 || c === sz-1);
    if (isCorner) score += 20;

    // Edges (non-corner)
    const isEdge = (r === 0 || r === sz-1 || c === 0 || c === sz-1) && !isCorner;
    if (isEdge) score += 5;

    // Count open lines our symbol contributes to
    board[i] = meSymbol;
    score += countOpenLines(board, sz, gl, meSymbol) * 2;
    board[i] = '';

    // Small perturbation to break perfect ties stochastically
    score += Math.random() * 0.5;

    return { i, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].i;
}

/**
 * Returns the bot's chosen cell index.
 * Applies mistake probability for easy/normal; full tactics for hard/expert.
 */
function getBotMove(board, cfg, symbols) {
  const empties = board.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
  if (!empties.length) return -1;

  // Mistake probability by difficulty
  let mistakeChance = 0;
  if (cfg.ai === 'easy')   mistakeChance = 0.75; // very dumb
  if (cfg.ai === 'normal') mistakeChance = 0.35; // occasional errors
  if (cfg.ai === 'hard')   mistakeChance = 0.08; // rare slip
  // expert: 0 — always uses tactics / minimax

  if (Math.random() < mistakeChance) {
    // deliberate random mistake
    return empties[Math.floor(Math.random() * empties.length)];
  }

  return findBestMove(board, empties, cfg, symbols[1], symbols[0]);
}

/* ─────────────────────────────────────────────────────
   I18N — LOCALISATION
   ───────────────────────────────────────────────────── */
const I18N = {
  ru: {
    home: "Главная", settings: "Настройки", start: "Начать игру", save: "Сохранить",
    applied: "Настройки применены",
    lang: "Язык", theme: "Тема",
    themeLight: "Светлая", themeDark: "Тёмная", themeGold: "Золотая",
    thLight: "Светлая", thDark: "Тёмная", thGold: "Золотая",
    sound: "Звук", soundOn: "Включен", soundOff: "Выключен",
    mode: "Режим", size: "Размер поля", goal: "Цель (в ряд)", ai: "Сложность ИИ",
    aiEasy: "Лёгкая (Ошибается)", aiNormal: "Нормальная", aiHard: "Сложная", aiExpert: "Непобедимый",
    p1: "Игрок 1", p2: "Игрок 2", p3: "Игрок 3", p4: "Игрок 4",
    playersLabel: "Имена игроков",
    lblCustomSym: "Символы игроков (Эмодзи)",
    statsTitle: "Статистика", statsTotal: "Всего:", statsWins: "Побед:", statsWinrate: "Винрейт:",
    careerTitle: "Уровень Карьеры", careerXp: "Опыт:",
    btnAbout: "ℹ Об авторе",
    lblMatchMod: "Тип матча",
    modClassic: "Классика (Обычная игра)",
    modSuper: "Супер-режим (С абилками)",
    draftTitle: "Выбор способностей",
    draftSub: (p, c) => `Ход: ${p} (${c}/3)`,
    abilitiesData: [
      { name: "Удар Тора", desc: "Выжигает любую занятую клетку врага.", cat: "atk", emoji: "💥" },
      { name: "Хакинг", desc: "Перекрашивает чужую фигуру в твой символ.", cat: "atk", emoji: "🔄" },
      { name: "Землетрясение", desc: "Перемешивает 3 случайные фигуры на поле.", cat: "atk", emoji: "🌪️" },
      { name: "Заморозка", desc: "Блокирует пустую клетку на 2 хода.", cat: "def", emoji: "❄️" },
      { name: "Щит", desc: "Защищает твою фигуру от Тора и Хакинга.", cat: "def", emoji: "🛡️" },
      { name: "Оглушение", desc: "Заставляет врага пропустить 1 следующий ход.", cat: "def", emoji: "🛑" },
      { name: "Блицкриг", desc: "Позволяет сделать 2 хода подряд в этот раунд.", cat: "tac", emoji: "👟" },
      { name: "Телепорт", desc: "Переносит твою фигуру в пустое место.", cat: "tac", emoji: "🔮" },
      { name: "Отмена", desc: "Отменяет самый последний ход соперника.", cat: "tac", emoji: "🕵️♂️" },
      { name: "Зеркало", desc: "Отражает направленную в тебя абилку назад.", cat: "tac", emoji: "🃏" }
    ],
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 Игрока", mode4: "4 Игрока",
    exit: "Выйти", undo: "Отмена", restart: "Заново",
    turn:  (n)  => `Ход: ${n}`,
    sub:   (sz, g) => `${sz}×${sz} • Цель: ${g}`,
    play: "Игра идёт", win: "Победа!", draw: "Ничья",
    confirmTitle: "Подтверждение",
    confirmExit:  "Выйти в меню?", confirmNew: "Начать заново?",
    ok: "Да", cancel: "Нет",
    infoTitle: "Об авторе",
    infoBtnClose: "Закрыть",
    infoHtml: "Создатель игры: <strong>Абдуллох Юлдошев (Alex)</strong><br><br><a href='https://abdullokhyuldoshev.taplink.ws/' target='_blank' class='btn btnPrimary' style='display:inline-flex; width:auto; padding:10px 20px; font-size:15px; text-decoration:none; margin-top:8px;'>👉 Открыть Taplink</a>"
  },
  en: {
    home: "Home", settings: "Settings", start: "Start", save: "Save",
    applied: "Applied",
    lang: "Language", theme: "Theme",
    themeLight: "Light", themeDark: "Dark", themeGold: "Gold",
    thLight: "Light", thDark: "Dark", thGold: "Gold",
    sound: "Sound", soundOn: "On", soundOff: "Off",
    mode: "Mode", size: "Size", goal: "Goal", ai: "AI Level",
    aiEasy: "Easy (Mistakes)", aiNormal: "Normal", aiHard: "Hard", aiExpert: "Unbeatable",
    p1: "Player 1", p2: "Player 2", p3: "Player 3", p4: "Player 4",
    playersLabel: "Player Names",
    lblCustomSym: "Player Symbols (Emoji)",
    statsTitle: "Statistics", statsTotal: "Total:", statsWins: "Wins:", statsWinrate: "Win Rate:",
    careerTitle: "Career Level", careerXp: "XP:",
    btnAbout: "ℹ About Author",
    lblMatchMod: "Match Type",
    modClassic: "Classic (Standard Game)",
    modSuper: "Super Mode (Abilities)",
    draftTitle: "Draft Abilities",
    draftSub: (p, c) => `Turn: ${p} (${c}/3)`,
    abilitiesData: [
      { name: "Thor's Strike", desc: "Strikes and clears any occupied cell.", cat: "atk", emoji: "💥" },
      { name: "Hacking", desc: "Converts an enemy piece to your symbol.", cat: "atk", emoji: "🔄" },
      { name: "Earthquake", desc: "Shuffles 3 random pieces on the board.", cat: "atk", emoji: "🌪️" },
      { name: "Freeze", desc: "Blocks an empty cell for 2 turns.", cat: "def", emoji: "❄️" },
      { name: "Shield", desc: "Protects your piece from Thor or Hacking.", cat: "def", emoji: "🛡️" },
      { name: "Stun", desc: "Forces selected opponent to skip 1 turn.", cat: "def", emoji: "🛑" },
      { name: "Blitzkrieg", desc: "Grants you an extra move immediately.", cat: "tac", emoji: "👟" },
      { name: "Teleport", desc: "Moves your existing piece to any empty cell.", cat: "tac", emoji: "🔮" },
      { name: "Cancel", desc: "Reverts the last move made by an opponent.", cat: "tac", emoji: "🕵️♂️" },
      { name: "Mirror", desc: "Passively counters and reflects enemy perks.", cat: "tac", emoji: "🃏" }
    ],
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 Players", mode4: "4 Players",
    exit: "Exit", undo: "Undo", restart: "Restart",
    turn:  (n)  => `Turn: ${n}`,
    sub:   (sz, g) => `${sz}×${sz} • Goal: ${g}`,
    play: "Playing", win: "Winner!", draw: "Draw",
    confirmTitle: "Confirm",
    confirmExit:  "Exit to menu?", confirmNew: "Restart game?",
    ok: "Yes", cancel: "No",
    infoTitle: "About Author",
    infoBtnClose: "Close",
    infoHtml: "Game creator: <strong>Abdullokh Yuldoshev (Alex)</strong><br><br><a href='https://abdullokhyuldoshev.taplink.ws/' target='_blank' class='btn btnPrimary' style='display:inline-flex; width:auto; padding:10px 20px; font-size:15px; text-decoration:none; margin-top:8px;'>👉 Open Taplink</a>"
  },
  uz: {
    home: "Bosh sahifa", settings: "Sozlamalar", start: "Boshlash", save: "Saqlash",
    applied: "Saqlandi",
    lang: "Til", theme: "Mavzu",
    themeLight: "Yorug'", themeDark: "Qorong'i", themeGold: "Oltin",
    thLight: "Yorug'", thDark: "Tungi", thGold: "Oltin",
    sound: "Ovoz", soundOn: "Yonilgan", soundOff: "O'chirilgan",
    mode: "Rejim", size: "O'lcham", goal: "Maqsad", ai: "AI Darajasi",
    aiEasy: "Oson (Xato qiladi)", aiNormal: "O'rta", aiHard: "Qiyin", aiExpert: "Yengilmas",
    p1: "1-o'yinchi", p2: "2-o'yinchi", p3: "3-o'yinchi", p4: "4-o'yinchi",
    playersLabel: "O'yinchilar",
    lblCustomSym: "O'yinchi belgilari (Emoji)",
    statsTitle: "Statistika", statsTotal: "Jami:", statsWins: "G'alaba:", statsWinrate: "Yutuq:",
    careerTitle: "Karera darajasi", careerXp: "Tajriba:",
    btnAbout: "ℹ Muallif haqida",
    lblMatchMod: "O'yin turi",
    modClassic: "Klassika (Oddiy o'yin)",
    modSuper: "Super Rejim (Abilkalar)",
    draftTitle: "Qobiliyatlar tanlovi",
    draftSub: (p, c) => `Navbat: ${p} (${c}/3)`,
    abilitiesData: [
      { name: "Tor Zarbasi", desc: "Istalgan band katakni yo'q qiladi.", cat: "atk", emoji: "💥" },
      { name: "Xaking", desc: "Raqib belgisini o'zingiznikiga o'zgartiradi.", cat: "atk", emoji: "🔄" },
      { name: "Zilzila", desc: "Jamoadagi 3 ta belgini tasodifiy aralashtiradi.", cat: "atk", emoji: "🌪️" },
      { name: "Muzlatish", desc: "Bo'sh katakni 2 turgacha muzlatib qo'yadi.", cat: "def", emoji: "❄️" },
      { name: "Qalqon", desc: "Belgingizni Tor va Xakingdan himoya qiladi.", cat: "def", emoji: "🛡️" },
      { name: "Stun", desc: "Raqibni 1 ta navbatni o'tkazib yuborishga majbur qiladi.", cat: "def", emoji: "🛑" },
      { name: "Blitskrig", desc: "Ketma-ket 2 marta yurish imkonini beradi.", cat: "tac", emoji: "👟" },
      { name: "Teleport", desc: "Belgingizni boshqa bo'sh katakka ko'chiradi.", cat: "tac", emoji: "🔮" },
      { name: "Bekor qilish", desc: "Raqibning oxirgi yurishini bekor qiladi.", cat: "tac", emoji: "🕵️♂️" },
      { name: "Ko'zgu", desc: "Sizga qarshi ishlatilgan perkni qaytaradi.", cat: "tac", emoji: "🃏" }
    ],
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 Kishi", mode4: "4 Kishi",
    exit: "Chiqish", undo: "Bekor", restart: "Qayta",
    turn:  (n)  => `Navbat: ${n}`,
    sub:   (sz, g) => `${sz}×${sz} • Maqsad: ${g}`,
    play: "O'yin", win: "G'alaba!", draw: "Durang",
    confirmTitle: "Tasdiqlash",
    confirmExit:  "Chiqasizmi?", confirmNew: "Qayta boshlash?",
    ok: "Ha", cancel: "Yo'q",
    infoTitle: "Muallif haqida",
    infoBtnClose: "Yopish",
    infoHtml: "O'yin yaratuvchisi: <strong>Abdullokh Yuldoshev (Alex)</strong><br><br><a href='https://abdullokhyuldoshev.taplink.ws/' target='_blank' class='btn btnPrimary' style='display:inline-flex; width:auto; padding:10px 20px; font-size:15px; text-decoration:none; margin-top:8px;'>👉 Taplink ochish</a>"
  }
};

/* ─────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────── */
const MODES = [
  { id: "pvp", key: "modePVP", players: 2, ai: false },
  { id: "ai",  key: "modeAI",  players: 2, ai: true  },
  { id: "p3",  key: "mode3",   players: 3, ai: false },
  { id: "p4",  key: "mode4",   players: 4, ai: false }
];

const AI_LEVELS = [
  { id: "easy",   key: "aiEasy"   },
  { id: "normal", key: "aiNormal" },
  { id: "hard",   key: "aiHard"   },
  { id: "expert", key: "aiExpert" }
];

const THEMES = [
  { id: "light", key: "themeLight" },
  { id: "dark",  key: "themeDark"  },
  { id: "gold",  key: "themeGold"  }
];

const SYMBOLS = ["X", "O", "△", "□"];

/* SVG Icons */
const iconSpk    = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const iconSpkOff = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51c.66-1.24 1.03-2.65 1.03-4.15 0-4.28-2.99-7.86-7-8.76v2.06c2.89.86 5 3.54 5 6.7zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

/* ─────────────────────────────────────────────────────
   DOM HELPERS
   ───────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ─────────────────────────────────────────────────────
   GAME STATE
   ───────────────────────────────────────────────────── */
let superMode = {
  activeAbility: null,
  playerDecks: {},
  usedAbilities: {},
  activeStuns: {},
  frozenCells: {},
  shieldedCells: {},
  lastMove: null,
  draftOrder: [],
  draftTurnIndex: 0
};

let settings = loadSettings();
let board    = [];
let history  = [];
let gameOver = false;
let winLine  = [];

/* ─────────────────────────────────────────────────────
   DOM REFERENCES (declared once, after DOMContentLoaded)
   ───────────────────────────────────────────────────── */
let screenHome;
let screenSettings;
let screenGame;

/* ─────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────── */
function init() {
  // Resolve DOM references — exactly once each
  screenHome     = $("screenHome");
  screenSettings = $("screenSettings");
  screenGame     = $("screenGame");

  Confetti.init('confettiCanvas');
  applyTheme();
  renderUI();
  initP2PNetwork();

  /* ── Event Listeners ── */
  $("btnStart").onclick = () => {
    Sfx.click(settings.sound);
    Haptic.trigger('light');
    if (settings.matchMode === "super") {
      $("screenHome").classList.add("hidden");
      $("screenDraft").classList.remove("hidden");
      startDraftPhase();
    } else {
      startNewGame();
    }
  };

  if ($("btnCreateOnline")) {
    $("btnCreateOnline").onclick = () => {
      Sfx.click(settings.sound);
      Haptic.trigger('medium');
      startNetworkHost();
    };
  }
  
  if ($("btnCancelNet")) {
    $("btnCancelNet").onclick = () => {
      Sfx.click(settings.sound);
      $("netModal").classList.add("hidden");
      if (network.peer) {
        network.peer.destroy();
        network.peer = null;
      }
      network.isActive = false;
      
      // If we were a guest, remove ?room from URL
      if (!network.isHost) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
  }

  if ($("btnCopyNetLink")) {
    $("btnCopyNetLink").onclick = () => {
      Sfx.click(settings.sound);
      const link = window.location.origin + window.location.pathname + "?room=" + network.peer.id;
      navigator.clipboard.writeText(link).then(() => {
        showToast("Ссылка скопирована!");
      });
    };
  }

  $("tabHome").onclick      = () => { Sfx.click(settings.sound); go("home"); };
  $("tabSettings").onclick  = () => { Sfx.click(settings.sound); go("settings"); };

  $("btnInfo").onclick = () => {
    Sfx.click(settings.sound);
    const t = I18N[settings.lang];
    $("modalTitle").textContent    = t.infoTitle;
    $("modalText").innerHTML       = t.infoHtml;
    $("modalCancel").style.display = "none";
    $("modalOk").textContent       = t.infoBtnClose;
    $("modalBack").classList.add("on");
    $("modalOk").onclick = () => {
      Sfx.click(settings.sound);
      $("modalBack").classList.remove("on");
      // Restore Cancel visibility for future confirm dialogs
      $("modalCancel").style.display = "";
    };
    $("modalCancel").onclick = null;
  };

  $("btnSave").onclick = () => { Sfx.click(settings.sound); Haptic.trigger('medium'); saveAndApply(); };

  $("btnSoundToggle").onclick = () => {
    settings.sound = !settings.sound;
    if (settings.sound) Sfx.click(true);
    saveSettings(settings);
    renderUI();
  };

  if ($("selMode")) {
    $("selMode").onchange = () => {
      const currentMode = $("selMode").value;
      if ($("rowP3")) $("rowP3").style.display = (currentMode === "p3" || currentMode === "p4") ? "flex" : "none";
      if ($("rowP4")) $("rowP4").style.display = (currentMode === "p4") ? "flex" : "none";
      // Сохраняем промежуточное состояние, чтобы не терялось при переключении
      settings.mode = currentMode;
      saveAndApply();
    };
  }

  // Theme dropdown
  $("btnThemeToggle").onclick = (e) => {
    Sfx.click(settings.sound);
    $("themeMenu").classList.toggle("hidden");
    e.stopPropagation();
  };

  document.querySelectorAll(".btn-theme-item").forEach(btn => {
    btn.onclick = () => {
      Sfx.click(settings.sound);
      settings.theme = btn.getAttribute("data-theme");
      saveSettings(settings);
      $("themeMenu").classList.add("hidden");
      applyTheme();
      renderUI();
    };
  });

  // Language dropdown
  $("btnLangToggle").onclick = (e) => {
    Sfx.click(settings.sound);
    $("langMenu").classList.toggle("hidden");
    e.stopPropagation();
  };

  document.addEventListener("click", () => { 
    const lm = $("langMenu");
    const tm = $("themeMenu");
    if (lm) lm.classList.add("hidden"); 
    if (tm) tm.classList.add("hidden");
  });

  document.querySelectorAll(".btn-lang-item").forEach(btn => {
    btn.onclick = () => {
      Sfx.click(settings.sound);
      settings.lang = btn.getAttribute("data-lang");
      saveSettings(settings);
      $("langMenu").classList.add("hidden");
      renderUI();
      syncSettingsForm();
    };
  });
  $("selSize").onchange  = rebuildGoalSelect;

  $("btnExit").onclick = async () => {
    Sfx.click(settings.sound);
    if (await modalConfirm(I18N[settings.lang].confirmExit)) {
      board = []; gameOver = false;
      saveGameData();
      go("home");
    }
  };

  $("btnRestart").onclick = async () => {
    Sfx.click(settings.sound);
    if (await modalConfirm(I18N[settings.lang].confirmNew)) startNewGame();
  };

  $("btnUndo").onclick = () => {
    Sfx.click(settings.sound);
    Haptic.trigger('light');
    doUndo();
  };

  /* ── Try to restore saved game ── */
  const savedGame = loadGame();
  if (savedGame && savedGame.board && savedGame.board.length > 0 && !savedGame.gameOver) {
    board    = savedGame.board;
    history  = savedGame.history;
    gameOver = savedGame.gameOver;
    settings = { ...defaultSettings(), ...savedGame.settingsSnapshot };
    renderGame();
    go("game");
  } else {
    go("home");
  }
}

/* ─────────────────────────────────────────────────────
   NAVIGATION
   ───────────────────────────────────────────────────── */
function go(scr) {

  screenHome.classList.add("hidden");
  screenSettings.classList.add("hidden");
  screenGame.classList.add("hidden");

  ["tabHome", "tabSettings"].forEach(id => {
    const el = $(id);
    if(el) el.classList.remove("tabOn");
  });

  const tabbarGlobal = $("tabbarGlobal");
  if (tabbarGlobal) tabbarGlobal.classList.remove("hidden");

  if (scr === "home") {
    screenHome.classList.remove("hidden");
    $("tabHome").classList.add("tabOn");
    
    // Move indicator
    setTimeout(() => moveTabIndicator("tabHome", "tabIndicator"), 0);
    
    renderHomeMeta();
  } else if (scr === "settings") {
    screenSettings.classList.remove("hidden");
    $("tabSettings").classList.add("tabOn");
    
    // Move indicator
    setTimeout(() => moveTabIndicator("tabSettings", "tabIndicator"), 0);
    
    syncSettingsForm();
  } else if (scr === "game") {
    screenGame.classList.remove("hidden");
    if (tabbarGlobal) tabbarGlobal.classList.add("hidden");
  }
}

function moveTabIndicator(btnId, indId) {
  const btn = $(btnId);
  const ind = $(indId);
  if (!btn || !ind) return;
  
  ind.style.left = btn.offsetLeft + "px";
  ind.style.width = btn.offsetWidth + "px";
}

/* ─────────────────────────────────────────────────────
   HOME META
   ───────────────────────────────────────────────────── */
function renderHomeMeta() {
  const t = I18N[settings.lang];
  const m = MODES.find(x => x.id === settings.mode);
  $("homeMeta").textContent = `${t[m.key]} • ${settings.size}×${settings.size}`;
}

/* ─────────────────────────────────────────────────────
   SETTINGS FORM SYNC
   ───────────────────────────────────────────────────── */
function syncSettingsForm() {
  const t = I18N[settings.lang];


  const selMM = $("selMatchMode");
  if (selMM) {
    selMM.innerHTML = `<option value="classic">${t.modClassic}</option><option value="super">${t.modSuper}</option>`;
    selMM.value = settings.matchMode || "classic";
  }

  const selMode = $("selMode");
  selMode.innerHTML = "";
  MODES.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = t[m.key];
    selMode.appendChild(opt);
  });
  selMode.value = settings.mode;

  // Size selector
  const selSize = $("selSize");
  if (selSize.options.length === 0) {
    for (let i = 3; i <= 10; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${i}×${i}`;
      selSize.appendChild(opt);
    }
  }
  selSize.value = settings.size;
  rebuildGoalSelect();
  $("selGoal").value = settings.goal;

  // AI level selector
  const selAI = $("selAI");
  selAI.innerHTML = "";
  AI_LEVELS.forEach(lvl => {
    const opt = document.createElement("option");
    opt.value       = lvl.id;
    opt.textContent = t[lvl.key];
    selAI.appendChild(opt);
  });
  selAI.value = settings.ai;

  $("aiRow").style.display = (settings.mode === "ai") ? "block" : "none";

  $("inpP1").value = settings.p1;
  $("inpP2").value = settings.p2;
  $("inpP3").value = settings.p3;
  $("inpP4").value = settings.p4;
  if ($("rowP3")) $("rowP3").style.display = (settings.mode === "p3" || settings.mode === "p4") ? "flex" : "none";
  if ($("rowP4")) $("rowP4").style.display = (settings.mode === "p4") ? "flex" : "none";

  $("inpSym1").value = settings.sym1;
  $("inpSym2").value = settings.sym2;
  $("inpSym3").value = settings.sym3;
  $("inpSym4").value = settings.sym4;

  updateStatsUI();
}

/* ─────────────────────────────────────────────────────
   GOAL SELECT REBUILD
   ───────────────────────────────────────────────────── */
function rebuildGoalSelect() {
  const sz      = parseInt($("selSize").value);
  const selGoal = $("selGoal");
  selGoal.innerHTML = "";

  for (let i = 3; i <= sz; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    selGoal.appendChild(opt);
  }

  if (settings.goal <= sz && settings.goal >= 3) selGoal.value = settings.goal;
  else selGoal.value = Math.min(sz, 5);
}

/* ─────────────────────────────────────────────────────
   SAVE & APPLY SETTINGS
   ───────────────────────────────────────────────────── */
function saveAndApply() {
  if ($("selMatchMode")) settings.matchMode = $("selMatchMode").value;
  settings.mode = $("selMode").value;
  settings.size = parseInt($("selSize").value) || 3;
  settings.goal = parseInt($("selGoal").value) || 3;
  settings.ai   = $("selAI").value;

  settings.p1 = $("inpP1").value.trim() || "Player 1";
  settings.p2 = $("inpP2").value.trim() || "Player 2";
  settings.p3 = $("inpP3").value.trim() || "Player 3";
  settings.p4 = $("inpP4").value.trim() || "Player 4";

  settings.sym1 = Array.from($("inpSym1").value.trim())[0] || "X";
  settings.sym2 = Array.from($("inpSym2").value.trim())[0] || "O";
  settings.sym3 = Array.from($("inpSym3").value.trim())[0] || "△";
  settings.sym4 = Array.from($("inpSym4").value.trim())[0] || "□";

  saveSettings(settings);
  applyTheme();
  renderUI();
  showToast(I18N[settings.lang].applied);
}

/* ─────────────────────────────────────────────────────
   GAME: START
   ───────────────────────────────────────────────────── */
function startDraftPhase() {
  const t = I18N[settings.lang];
  superMode.playerDecks = { 0: [], 1: [], 2: [], 3: [] };
  superMode.usedAbilities = { 0: [], 1: [], 2: [], 3: [] };
  superMode.draftTurnIndex = 0;
  
  superMode.draftOrder = [0, 1];
  if (settings.mode === "p3") superMode.draftOrder = [0, 1, 2];
  if (settings.mode === "p4") superMode.draftOrder = [0, 1, 2, 3];
  
  renderDraftGrid();
}

function renderDraftGrid() {
  const t = I18N[settings.lang];
  const grid = $("draftGrid");
  const sub = $("draftSubtitle");
  if (!grid || !sub) return;
  
  grid.innerHTML = "";
  
  let totalNeeded = superMode.draftOrder.length * 3;
  let currentTotal = Object.values(superMode.playerDecks).reduce((a, b) => a + b.length, 0);
  
  if (currentTotal >= totalNeeded) {
    $("screenDraft").classList.add("hidden");
    startNewGame();
    return;
  }
  
  let activePlayerIdx = superMode.draftOrder[superMode.draftTurnIndex % superMode.draftOrder.length];
  
  // Проверка на лимит игрока (макс 3 карты)
  while (superMode.playerDecks[activePlayerIdx].length >= 3) {
    superMode.draftTurnIndex++;
    activePlayerIdx = superMode.draftOrder[superMode.draftTurnIndex % superMode.draftOrder.length];
  }
  
  let pName = getPlayerName(activePlayerIdx);
  sub.textContent = t.draftSub(pName, superMode.playerDecks[activePlayerIdx].length);
  
  // Логика автоматического драфта ИИ
  if (settings.mode === "ai" && activePlayerIdx === 1) {
    setTimeout(() => {
      let available = [];
      for (let i = 0; i < 10; i++) {
        if (!superMode.playerDecks[1].includes(i)) available.push(i);
      }
      let randomChoice = available[Math.floor(Math.random() * available.length)];
      superMode.playerDecks[1].push(randomChoice);
      superMode.draftTurnIndex++;
      renderDraftGrid();
    }, 400);
    return;
  }
  
  // Рендер 10 карточек в стиле Монополии
  t.abilitiesData.forEach((ab, idx) => {
    const card = document.createElement("div");
    // Делаем элемент списком во всю ширину
    card.className = "ability-card";
    card.style.display = "flex";
    card.style.flexDirection = "row";
    card.style.alignItems = "center";
    card.style.width = "100%";
    card.style.marginHeight = "6px";
    card.style.background = "var(--glass-bg)";
    card.style.border = "1px solid var(--glass-border)";
    card.style.borderRadius = "12px";
    card.style.padding = "10px 14px";
    card.style.gap = "0px";
    card.style.textAlign = "left";

    if (superMode.playerDecks[activePlayerIdx].includes(idx)) {
      card.style.opacity = "0.4";
      card.style.border = "1px solid var(--gold)";
    }

    card.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 55px; width: 55px; flex-shrink: 0; margin-right: 16px; box-sizing: border-box;">
        <span style="font-size: 24px; line-height: 1; display: block; margin-bottom: 3px;">${ab.emoji}</span>
        <span class="cat-${ab.cat}" style="font-size: 8px; font-weight: 900; padding: 2px 0; border-radius: 4px; color: #fff; text-transform: uppercase; display: block; text-align: center; width: 100%; box-sizing: border-box; line-height: 1.2;">${ab.cat}</span>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; box-sizing: border-box; text-align: left;">
        <div style="font-weight: 700; font-size: 14px; color: var(--text); margin-bottom: 2px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ab.name}</div>
        <div style="font-size: 11px; opacity: 0.8; color: var(--text); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${ab.desc}</div>
      </div>
    `;

    card.onclick = () => {
      if (superMode.playerDecks[activePlayerIdx].includes(idx)) return;
      
      if (network.isActive) {
        if (network.isHost && activePlayerIdx !== 0) return;
        if (!network.isHost && activePlayerIdx !== 1) return;
      }
      
      Sfx.click(settings.sound);
      Haptic.trigger('light');
      superMode.playerDecks[activePlayerIdx].push(idx);
      
      if (network.isActive && network.conn && network.conn.open) {
        network.conn.send({
          type: "DRAFT_SELECT",
          playerIdx: activePlayerIdx,
          abilityId: idx
        });
      }
      
      superMode.draftTurnIndex++;
      renderDraftGrid();
    };
    grid.appendChild(card);
  });
}

function renderAbilitiesBar() {
  const bar = document.getElementById("gameAbilitiesBar");
  if (!bar) return;
  bar.innerHTML = "";
  
  if (settings.matchMode !== "super" || gameOver) return;
  
  const t = I18N[settings.lang];
  // Определяем текущего игрока (0, 1, 2, 3)
  let pIdx = history.length % getPlayersCount(); 
  let deck = superMode.playerDecks[pIdx] || [];
  
  deck.forEach(abId => {
    const ab = t.abilitiesData[abId];
    if (!ab) return;
    
    const card = document.createElement("div");
    card.className = "ability-card";
    card.style.flex = "1";
    card.style.maxWidth = "110px";
    card.style.minWidth = "80px";
    
    if (superMode.usedAbilities[pIdx] && superMode.usedAbilities[pIdx].includes(abId)) {
      card.classList.add("used");
    }
    if (superMode.activeAbility === abId) {
      card.classList.add("active-perk");
    }
    
    const name = ab.name || "";
    // Добавляем emoji, короткое имя и категорию в верстку
    card.innerHTML = `
      <div class="card-header cat-${ab.cat}" style="font-size:9px; padding:3px 2px;">${ab.emoji} ${ab.cat.toUpperCase()}</div>
      <div style="padding:4px; text-align:center; font-size:11px; font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</div>
    `;
    
    card.onclick = (e) => {
      e.stopPropagation();
      if (superMode.usedAbilities[pIdx] && superMode.usedAbilities[pIdx].includes(abId)) return;
      
      // Check if network mode and not our turn
      if (network.isActive) {
        if (network.isHost && pIdx !== 0) return;
        if (!network.isHost && pIdx !== 1) return;
      }
      
      Sfx.click(settings.sound);
      Haptic.trigger('medium');
      
      if (superMode.activeAbility === abId) {
        superMode.activeAbility = null;
        showToast("Способность отменена");
      } else {
        superMode.activeAbility = abId;
        showToast(`Активировано: ${ab.name}. Нажми на клетку!`);
        
        // Моментальный Блицкриг (id: 6) без выбора клетки
        if (abId === 6) {
          superMode.usedAbilities[pIdx].push(6);
          superMode.activeAbility = null;
          // Добавляем виртуальный пустой ход в историю, чтобы сдвинуть и вернуть ход обратно текущему игроку
          history.push({ cell: -1, player: pIdx }); 
          showToast("👟 Блицкриг! +1 Ход");
        }
      }
      renderGame();
      renderAbilitiesBar();
    };
    bar.appendChild(card);
  });
}
function startNewGame() {
  board    = Array(settings.size * settings.size).fill("");
  history  = [];
  gameOver = false;
  winLine  = [];
  saveGameData();
  renderGame();
  go("game");
}

/* ─────────────────────────────────────────────────────
   GAME: RENDER
   ───────────────────────────────────────────────────── */
function renderGame() {
  const t   = I18N[settings.lang];
  const bEl = $("board");

  bEl.style.gridTemplateColumns = `repeat(${settings.size}, 1fr)`;
  bEl.style.gridTemplateRows    = `repeat(${settings.size}, 1fr)`;

  const gap = settings.size > 6 ? 4 : 7;
  bEl.style.gap = gap + "px";

  const fs = Math.max(14, 54 - settings.size * 3.5);
  bEl.style.setProperty("--cell-fs", fs + "px");

  bEl.innerHTML = "";

  board.forEach((val, idx) => {
    const c = document.createElement("div");
    c.className = "cell";

    if (val) {
      const sp = document.createElement("span");
      let displayVal = val;
      if (val === "X") displayVal = settings.sym1;
      else if (val === "O") displayVal = settings.sym2;
      else if (val === "△") displayVal = settings.sym3;
      else if (val === "□") displayVal = settings.sym4;
      
      sp.className   = "sym sym" + val;
      sp.textContent = displayVal;
      c.appendChild(sp);
    }

    if (winLine.includes(idx)) c.classList.add("cellWin");
    if (gameOver || val)       c.classList.add("cellDisabled");

    c.onclick = () => {
      if (network.isActive) {
        let currentTurnIdx = history.length % getPlayersCount();
        if (network.isHost && currentTurnIdx !== 0) { showToast("Сейчас ход соперника!"); return; }
        if (!network.isHost && currentTurnIdx !== 1) { showToast("Сейчас ход соперника!"); return; }
      }
      executeCellClick(idx, true);
    };
    bEl.appendChild(c);
  });

  const curP  = history.length % getPlayersCount();
  const pName = getPlayerName(curP);

  if (gameOver) {
    if (winLine.length) {
      $("turnTitle").textContent = t.win + " " + getPlayerName(SYMBOLS.indexOf(board[winLine[0]]));
    } else {
      $("turnTitle").textContent = t.draw;
    }
  } else {
    $("turnTitle").textContent = t.turn(pName, SYMBOLS[curP]);
  }

  $("turnSub").textContent = t.sub(settings.size, settings.goal);

  $("btnUndo").disabled     = (history.length === 0 || gameOver);
  $("btnUndo").style.opacity = $("btnUndo").disabled ? "0.45" : "1";
  
  renderAbilitiesBar();
}

function executeCellClick(idx, isLocal = false) {
  if (settings.matchMode === "super" && superMode.activeAbility !== null) {
    let pIdx = history.length % getPlayersCount();
    let abilityUsed = superMode.activeAbility;
    
    if (superMode.activeAbility === 0) { // Удар Тора
      if (board[idx] !== "") {
        board[idx] = "";
        superMode.usedAbilities[pIdx].push(0);
        superMode.activeAbility = null;
        showToast("💥 Клетка выжжена!");
        
        if (isLocal && network.isActive && network.conn && network.conn.open) {
          network.conn.send({ type: "MOVE", cellIndex: idx, abilityId: abilityUsed });
        }
        
        renderGame();
        renderAbilitiesBar();
        return;
      }
    }
    
    if (superMode.activeAbility === 1) { // Хакинг
      if (board[idx] !== "" && board[idx] !== SYMBOLS[pIdx]) {
        board[idx] = SYMBOLS[pIdx];
        superMode.usedAbilities[pIdx].push(1);
        superMode.activeAbility = null;
        showToast("🔄 Фигура взломана!");
        
        if (isLocal && network.isActive && network.conn && network.conn.open) {
          network.conn.send({ type: "MOVE", cellIndex: idx, abilityId: abilityUsed });
        }
        
        renderGame();
        renderAbilitiesBar();
        return;
      }
    }
    return;
  }
  makeMove(idx, isLocal);
}

/* ─────────────────────────────────────────────────────
   GAME: MAKE MOVE
   ───────────────────────────────────────────────────── */
function makeMove(idx, isLocal = false) {
  if (gameOver || board[idx]) return;

  Sfx.pop(settings.sound);
  Haptic.trigger('light');

  const pIdx  = history.length % getPlayersCount();
  board[idx]  = SYMBOLS[pIdx];
  history.push({ idx, p: pIdx });

  if (isLocal && network.isActive && network.conn && network.conn.open) {
    network.conn.send({
      type: "MOVE",
      cellIndex: idx,
      abilityId: superMode.activeAbility // if any active ability that wasn't consumed
    });
  }

  checkWinCondition();
  saveGameData();
  renderGame();

  // AI's turn
  if (!gameOver && settings.mode === "ai" && getPlayersCount() === 2) {
    if ((history.length % 2) === 1) {
      setTimeout(() => {
        const aiMove = getBotMove(board, settings, SYMBOLS);
        if (aiMove !== -1) makeMove(aiMove);
      }, 400);
    }
  }
}

/* ─────────────────────────────────────────────────────
   GAME: UNDO
   ───────────────────────────────────────────────────── */
function doUndo() {
  if (!history.length) return;
  const last = history.pop();
  board[last.idx] = "";

  // In AI mode undo two moves (player + AI)
  if (settings.mode === "ai" && history.length > 0) {
    const last2 = history.pop();
    board[last2.idx] = "";
  }

  gameOver = false;
  winLine  = [];
  saveGameData();
  renderGame();
}

/* ─────────────────────────────────────────────────────
   GAME: WIN CHECK
   ───────────────────────────────────────────────────── */
function checkWinCondition() {
  const res = checkWinFull(board, settings.size, settings.goal);
  if (res.win) {
    gameOver = true;
    winLine  = res.line;
    Sfx.win(settings.sound);
    Haptic.trigger('heavy');
    Confetti.start();
    
    settings.gamesPlayed = (settings.gamesPlayed || 0) + 1;
    if (board[winLine[0]] === "X") {
      settings.gamesWon = (settings.gamesWon || 0) + 1;
      
      // PvE Progress
      if (settings.mode === "ai") {
        settings.pveXp = (settings.pveXp || 0) + 20;
        if (settings.pveXp >= 100) {
          settings.pveLevel = (settings.pveLevel || 1) + 1;
          settings.pveXp = 0;
          setTimeout(() => {
            showToast("Level Up! New Level: " + settings.pveLevel);
            Confetti.start();
          }, 800);
        }
      }
    }
    saveSettings(settings);
    
  } else if (history.length === settings.size * settings.size) {
    gameOver = true;
    settings.gamesPlayed = (settings.gamesPlayed || 0) + 1;
    saveSettings(settings);
  }
}

/* ─────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────── */
function getPlayersCount() {
  return MODES.find(m => m.id === settings.mode).players;
}

function getPlayerName(idx) {
  if (idx === 0) return settings.p1;
  if (idx === 1) return settings.mode === "ai" ? "AI" : settings.p2;
  if (idx === 2) return settings.p3;
  if (idx === 3) return settings.p4;
  return "Player";
}

function updateStatsUI() {
  const t = I18N[settings.lang];
  const lblStatsTitle = $("lblStatsTitle");
  if (!lblStatsTitle) return;
  
  lblStatsTitle.textContent = t.statsTitle;
  
  const played = settings.gamesPlayed || 0;
  const won = settings.gamesWon || 0;
  const winrate = played > 0 ? Math.round((won / played) * 100) : 0;
  
  $("statTotal").textContent = `${t.statsTotal} ${played}`;
  $("statWins").textContent = `${t.statsWins} ${won}`;
  $("statWinrate").textContent = `${t.statsWinrate} ${winrate}%`;
}

function updateCareerUI() {
  const t = I18N[settings.lang];
  const lblTitle = $("lblCareerTitle");
  const lblXp = $("lblCareerXp");
  const fill = $("careerProgressFill");
  if (!lblTitle || !lblXp || !fill) return;

  const lvl = settings.pveLevel || 1;
  const xp = settings.pveXp || 0;
  
  lblTitle.textContent = `${t.careerTitle}: ${lvl}`;
  lblXp.textContent = `${t.careerXp} ${xp}/100`;
  fill.style.width = `${xp}%`;
}

/* ─────────────────────────────────────────────────────
   UI RENDER
   ───────────────────────────────────────────────────── */
function renderUI() {
  const t = I18N[settings.lang];

  $("btnStart").innerHTML        = "▶ " + t.start;
  const btnInfo = $("btnInfo");
  if (btnInfo && t.btnAbout) btnInfo.textContent = t.btnAbout;
  
  $("tabHome").textContent       = t.home;
  $("tabSettings").textContent   = t.settings;
  $("settingsTitle").textContent = t.settings;
  $("lblMode").textContent       = t.mode;
  $("lblSize").textContent       = t.size;
  $("lblGoal").textContent       = t.goal;
  $("lblAI").textContent         = t.ai;
  $("lblNames").textContent      = t.playersLabel;


  updateStatsUI();
  updateCareerUI();

  const flagMap = { "ru": "🇷🇺", "en": "🇺🇸", "uz": "🇺🇿" };
  const langToggleBtn = $("btnLangToggle");
  if (langToggleBtn) langToggleBtn.textContent = flagMap[settings.lang] || "🇷🇺";

  const themeIconMap = { "light": "☀️", "dark": "🌙", "gold": "👑" };
  const themeToggleBtn = $("btnThemeToggle");
  if (themeToggleBtn) themeToggleBtn.textContent = themeIconMap[settings.theme] || "☀️";

  const btnSoundToggle = $("btnSoundToggle");
  if (btnSoundToggle) {
    btnSoundToggle.textContent = settings.sound ? "🔊" : "🔇";
  }

  const txtL = document.querySelector(".theme-txt-light");
  if (txtL) txtL.textContent = t.thLight;
  const txtD = document.querySelector(".theme-txt-dark");
  if (txtD) txtD.textContent = t.thDark;
  const txtG = document.querySelector(".theme-txt-gold");
  if (txtG) txtG.textContent = t.thGold;

  $("inpP1").placeholder = t.p1;
  $("inpP2").placeholder = t.p2;
  $("inpP3").placeholder = t.p3;
  $("inpP4").placeholder = t.p4;

  $("btnSave").textContent = t.save;

  $("btnExit").textContent    = t.exit;
  $("btnUndo").innerHTML      = "↩ " + t.undo;
  $("btnRestart").innerHTML   = "⟲ " + t.restart;

  renderHomeMeta();
}

/* ─────────────────────────────────────────────────────
   THEME
   ───────────────────────────────────────────────────── */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", settings.theme);
}

/* ─────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────── */
function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("on");
  setTimeout(() => el.classList.remove("on"), 2200);
}

/* ─────────────────────────────────────────────────────
   MODAL CONFIRM
   ───────────────────────────────────────────────────── */
function modalConfirm(txt) {
  return new Promise(resolve => {
    const t = I18N[settings.lang];
    $("modalTitle").textContent  = t.confirmTitle;
    $("modalText").textContent   = txt;
    $("modalCancel").textContent = t.cancel;
    $("modalOk").textContent     = t.ok;

    $("modalBack").classList.add("on");

    $("modalOk").onclick = () => {
      Sfx.click(settings.sound);
      $("modalBack").classList.remove("on");
      resolve(true);
    };
    $("modalCancel").onclick = () => {
      Sfx.click(settings.sound);
      $("modalBack").classList.remove("on");
      resolve(false);
    };
  });
}

/* ─────────────────────────────────────────────────────
   SAVE GAME STATE
   ───────────────────────────────────────────────────── */
function saveGameData() {
  saveGame({
    settingsSnapshot: settings,
    board,
    history,
    gameOver
  });
}

/* ─────────────────────────────────────────────────────
   NETWORK (P2P via PeerJS)
   ───────────────────────────────────────────────────── */
function initP2PNetwork() {
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');
  
  if (room) {
    network.isHost = false;
    network.isActive = true;
    network.roomID = room;
    
    $("netModal").classList.remove("hidden");
    $("netStatusTitle").textContent = "Подключение...";
    $("netStatusDesc").textContent = "Ищем создателя игры...";
    $("btnCopyNetLink").style.display = "none";
    
    network.peer = new Peer();
    
    network.peer.on('open', (id) => {
      network.conn = network.peer.connect(room);
      setupConnection(network.conn);
    });
    
    network.peer.on('error', (err) => {
      $("netStatusTitle").textContent = "Ошибка сети";
      $("netStatusDesc").textContent = (err.type === "peer-unavailable") ? "Комната не найдена или хост отключился." : "Ошибка: " + err.message;
      $("btnCancelNet").textContent = "Закрыть";
    });
  }
}

function startNetworkHost() {
  network.isHost = true;
  network.isActive = true;
  
  $("netModal").classList.remove("hidden");
  $("netStatusTitle").textContent = "Создание комнаты...";
  $("netStatusDesc").textContent = "Генерируем P2P ссылку...";
  $("btnCopyNetLink").style.display = "none";
  $("btnCancelNet").textContent = "Отмена";
  
  network.peer = new Peer();
  
  network.peer.on('open', (id) => {
    network.roomID = id;
    $("netStatusDesc").textContent = "Ожидаем подключения второго игрока...";
    $("btnCopyNetLink").style.display = "block";
  });
  
  network.peer.on('connection', (conn) => {
    network.conn = conn;
    setupConnection(network.conn);
  });
  
  network.peer.on('error', (err) => {
    $("netStatusTitle").textContent = "Ошибка сети";
    $("netStatusDesc").textContent = "Ошибка: " + err.message;
    $("btnCopyNetLink").style.display = "none";
  });
}

function setupConnection(conn) {
  conn.on('open', () => {
    $("netModal").classList.add("hidden");
    showToast(network.isHost ? "Игрок подключился!" : "Успешно подключено к игре!");
    
    // Force 1 vs 1 mode for simplicity in this stage
    settings.mode = "pvp";
    saveSettings(settings);
    syncSettingsForm();
    
    startNewGame();
  });
  
  conn.on('data', (data) => {
    handleNetworkData(data);
  });
  
  conn.on('close', () => {
    showToast("Соединение разорвано");
    network.isActive = false;
    board = []; gameOver = false;
    saveGameData();
    go("home");
  });
}

function handleNetworkData(data) {
  console.log("Received data:", data);
  if (!data || !data.type) return;

  if (data.type === "MOVE") {
    // Применяем ход соперника локально
    if (data.abilityId !== null) {
      // Если соперник использовал способность, активируем её у него
      superMode.activeAbility = data.abilityId;
    }
    // Вызываем стандартную функцию клика по клетке для соперника
    executeCellClick(data.cellIndex, false); 
  }

  if (data.type === "DRAFT_SELECT") {
    // Синхронизация выбора карт на экране драфта
    const pIdx = data.playerIdx;
    if (!superMode.playerDecks[pIdx].includes(data.abilityId)) {
      superMode.playerDecks[pIdx].push(data.abilityId);
      superMode.draftTurnIndex++;
      renderDraftGrid();
    }
  }
}

/* ─────────────────────────────────────────────────────
   BOOTSTRAP — single DOMContentLoaded guard
   ───────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
