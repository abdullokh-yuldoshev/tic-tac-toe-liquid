/**
 * =====================================================================
 * TIC-TAC-TOE LIQUID PREMIUM — js/game.js v3.1.0
 * Monolithic ES-module: Audio, Haptic, Confetti, Storage, AI, Game
 * =====================================================================
 */

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
    mode:  "pvp",
    size:  3,
    goal:  3,
    ai:    "expert",
    p1:    "Игрок 1",
    p2:    "Игрок 2",
    p3:    "Игрок 3",
    p4:    "Игрок 4",
    sound: true
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

/**
 * Find best strategic move for AI
 */
function findBestMove(board, empties, cfg, meSymbol, enemySymbol) {
  const sz = cfg.size;
  const gl = cfg.goal;

  // 1. Win if possible
  for (const i of empties) {
    board[i] = meSymbol;
    if (checkWinSimple(board, sz, gl)) { board[i] = ""; return i; }
    board[i] = "";
  }

  // 2. Block opponent win
  for (const i of empties) {
    board[i] = enemySymbol;
    if (checkWinSimple(board, sz, gl)) { board[i] = ""; return i; }
    board[i] = "";
  }

  // 3. Prefer center proximity
  const center = (sz - 1) / 2;
  const sorted = [...empties].sort((a, b) => {
    const ra = Math.floor(a / sz), ca = a % sz;
    const rb = Math.floor(b / sz), cb = b % sz;
    const da = Math.abs(ra - center) + Math.abs(ca - center);
    const db = Math.abs(rb - center) + Math.abs(cb - center);
    return da - db;
  });

  return sorted[0];
}

/**
 * Returns the bot's chosen cell index
 */
function getBotMove(board, cfg, symbols) {
  const empties = board.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
  if (!empties.length) return -1;

  let mistakeChance = 0;
  if (cfg.ai === "easy")   mistakeChance = 0.70;
  if (cfg.ai === "normal") mistakeChance = 0.30;
  if (cfg.ai === "hard")   mistakeChance = 0.10;

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
    sound: "Звук", soundOn: "Включен", soundOff: "Выключен",
    mode: "Режим", size: "Размер поля", goal: "Цель (в ряд)", ai: "Сложность ИИ",
    aiEasy: "Лёгкая (Ошибается)", aiNormal: "Нормальная", aiHard: "Сложная", aiExpert: "Непобедимый",
    p1: "Игрок 1", p2: "Игрок 2", p3: "Игрок 3", p4: "Игрок 4",
    playersLabel: "Имена игроков",
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 Игрока", mode4: "4 Игрока",
    exit: "Выйти", undo: "Отмена", restart: "Заново",
    turn:  (n)  => `Ход: ${n}`,
    sub:   (sz, g) => `${sz}×${sz} • Цель: ${g}`,
    play: "Игра идёт", win: "Победа!", draw: "Ничья",
    confirmTitle: "Подтверждение",
    confirmExit:  "Выйти в меню?", confirmNew: "Начать заново?",
    ok: "Да", cancel: "Нет"
  },
  en: {
    home: "Home", settings: "Settings", start: "Start", save: "Save",
    applied: "Applied",
    lang: "Language", theme: "Theme",
    themeLight: "Light", themeDark: "Dark", themeGold: "Gold",
    sound: "Sound", soundOn: "On", soundOff: "Off",
    mode: "Mode", size: "Size", goal: "Goal", ai: "AI Level",
    aiEasy: "Easy (Mistakes)", aiNormal: "Normal", aiHard: "Hard", aiExpert: "Unbeatable",
    p1: "Player 1", p2: "Player 2", p3: "Player 3", p4: "Player 4",
    playersLabel: "Player Names",
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 Players", mode4: "4 Players",
    exit: "Exit", undo: "Undo", restart: "Restart",
    turn:  (n)  => `Turn: ${n}`,
    sub:   (sz, g) => `${sz}×${sz} • Goal: ${g}`,
    play: "Playing", win: "Winner!", draw: "Draw",
    confirmTitle: "Confirm",
    confirmExit:  "Exit to menu?", confirmNew: "Restart game?",
    ok: "Yes", cancel: "No"
  },
  uz: {
    home: "Bosh sahifa", settings: "Sozlamalar", start: "Boshlash", save: "Saqlash",
    applied: "Saqlandi",
    lang: "Til", theme: "Mavzu",
    themeLight: "Yorug'", themeDark: "Qorong'i", themeGold: "Oltin",
    sound: "Ovoz", soundOn: "Yonilgan", soundOff: "O'chirilgan",
    mode: "Rejim", size: "O'lcham", goal: "Maqsad", ai: "AI Darajasi",
    aiEasy: "Oson (Xato qiladi)", aiNormal: "O'rta", aiHard: "Qiyin", aiExpert: "Yengilmas",
    p1: "1-o'yinchi", p2: "2-o'yinchi", p3: "3-o'yinchi", p4: "4-o'yinchi",
    playersLabel: "O'yinchilar",
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 Kishi", mode4: "4 Kishi",
    exit: "Chiqish", undo: "Bekor", restart: "Qayta",
    turn:  (n)  => `Navbat: ${n}`,
    sub:   (sz, g) => `${sz}×${sz} • Maqsad: ${g}`,
    play: "O'yin", win: "G'alaba!", draw: "Durang",
    confirmTitle: "Tasdiqlash",
    confirmExit:  "Chiqasizmi?", confirmNew: "Qayta boshlash?",
    ok: "Ha", cancel: "Yo'q"
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

  /* ── Event Listeners ── */
  $("btnStart").onclick     = () => { Sfx.click(settings.sound); Haptic.trigger('light'); startNewGame(); };

  $("tabHome").onclick      = () => { Sfx.click(settings.sound); go("home"); };
  $("tabSettings").onclick  = () => { Sfx.click(settings.sound); go("settings"); };
  $("tabHome2").onclick     = () => { Sfx.click(settings.sound); go("home"); };
  $("tabSettings2").onclick = () => { Sfx.click(settings.sound); go("settings"); };

  $("btnSave").onclick = () => { Sfx.click(settings.sound); Haptic.trigger('medium'); saveAndApply(); };

  $("btnSoundToggle").onclick = () => {
    settings.sound = !settings.sound;
    Sfx.click(settings.sound);
    renderUI();
    saveSettings(settings);
  };

  $("selLang").onchange  = () => { settings.lang  = $("selLang").value;  renderUI(); syncSettingsForm(); };
  $("selTheme").onchange = () => { settings.theme = $("selTheme").value; applyTheme(); };
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

  ["tabHome", "tabSettings", "tabHome2", "tabSettings2"].forEach(id => {
    $(id).classList.remove("tabOn");
  });

  if (scr === "home") {
    screenHome.classList.remove("hidden");
    $("tabHome").classList.add("tabOn");
    $("tabHome2").classList.add("tabOn");
    renderHomeMeta();
  } else if (scr === "settings") {
    screenSettings.classList.remove("hidden");
    $("tabSettings").classList.add("tabOn");
    $("tabSettings2").classList.add("tabOn");
    syncSettingsForm();
  } else if (scr === "game") {
    screenGame.classList.remove("hidden");
  }
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
  $("selLang").value = settings.lang;

  const t = I18N[settings.lang];

  // Theme selector — rebuild with translated labels
  const selTheme = $("selTheme");
  selTheme.innerHTML = "";
  THEMES.forEach(th => {
    const opt = document.createElement("option");
    opt.value       = th.id;
    opt.textContent = t[th.key]; // ru: "Золотая", en: "Gold", uz: "Oltin"
    selTheme.appendChild(opt);
  });
  selTheme.value = settings.theme;

  // Mode chips
  const chipsDiv = $("modeChips");
  chipsDiv.innerHTML = "";
  MODES.forEach(m => {
    const b = document.createElement("div");
    b.className  = "chip" + (settings.mode === m.id ? " chipOn" : "");
    b.textContent = t[m.key];
    b.onclick = () => {
      Sfx.click(settings.sound);
      Haptic.trigger('light');
      settings.mode = m.id;
      syncSettingsForm();
    };
    chipsDiv.appendChild(b);
  });

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
  $("nameGrid34").style.display = (settings.mode === "p3" || settings.mode === "p4") ? "grid" : "none";
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
  settings.lang  = $("selLang").value;
  settings.theme = $("selTheme").value;

  const chips = $("modeChips").children;
  for (let i = 0; i < chips.length; i++) {
    if (chips[i].classList.contains("chipOn")) settings.mode = MODES[i].id;
  }

  settings.size = parseInt($("selSize").value);
  settings.goal = parseInt($("selGoal").value);
  settings.ai   = $("selAI").value;

  settings.p1 = $("inpP1").value.trim() || "Player 1";
  settings.p2 = $("inpP2").value.trim() || "Player 2";
  settings.p3 = $("inpP3").value.trim() || "Player 3";
  settings.p4 = $("inpP4").value.trim() || "Player 4";

  saveSettings(settings);
  applyTheme();
  renderUI();
  showToast(I18N[settings.lang].applied);
}

/* ─────────────────────────────────────────────────────
   GAME: START
   ───────────────────────────────────────────────────── */
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
      sp.className   = "sym sym" + val;
      sp.textContent = val;
      c.appendChild(sp);
    }

    if (winLine.includes(idx)) c.classList.add("cellWin");
    if (gameOver || val)       c.classList.add("cellDisabled");

    c.onclick = () => makeMove(idx);
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
}

/* ─────────────────────────────────────────────────────
   GAME: MAKE MOVE
   ───────────────────────────────────────────────────── */
function makeMove(idx) {
  if (gameOver || board[idx]) return;

  Sfx.pop(settings.sound);
  Haptic.trigger('light');

  const pIdx  = history.length % getPlayersCount();
  board[idx]  = SYMBOLS[pIdx];
  history.push({ idx, p: pIdx });

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
  } else if (history.length === settings.size * settings.size) {
    gameOver = true;
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
  if (idx === 1) return settings.p2;
  if (idx === 2) return settings.p3;
  if (idx === 3) return settings.p4;
  return "Player";
}

/* ─────────────────────────────────────────────────────
   UI RENDER
   ───────────────────────────────────────────────────── */
function renderUI() {
  const t = I18N[settings.lang];

  $("btnStart").innerHTML        = "▶ " + t.start;
  $("tabHome").textContent       = t.home;
  $("tabSettings").textContent   = t.settings;
  $("tabHome2").textContent      = t.home;
  $("tabSettings2").textContent  = t.settings;
  $("settingsTitle").textContent = t.settings;
  $("lblLang").textContent       = t.lang;
  $("lblTheme").textContent      = t.theme;
  $("lblMode").textContent       = t.mode;
  $("lblSize").textContent       = t.size;
  $("lblGoal").textContent       = t.goal;
  $("lblAI").textContent         = t.ai;
  $("lblNames").textContent      = t.playersLabel;
  $("lblSound").textContent      = t.sound;

  $("soundStatusText").textContent = settings.sound ? t.soundOn : t.soundOff;
  $("soundIcon").innerHTML         = settings.sound ? iconSpk : iconSpkOff;

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
   BOOTSTRAP — single DOMContentLoaded guard
   ───────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
