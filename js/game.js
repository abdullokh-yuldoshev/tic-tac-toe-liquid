/**
 * =====================================================================
 * TIC-TAC-TOE LIQUID PREMIUM — js/game.js v4.5.0
 * Clean Monolith Reboot
 *
 * Subsystems: Audio, Haptic, Confetti, Storage, AI, Game Engine,
 *             P2P Network (PeerJS/WebRTC), Super Mode Draft,
 *             Monetization, Admin Panel
 *
 * Architecture Rules:
 *   - Zero Layout Thrashing (batched renders via requestAnimationFrame)
 *   - Cached DOM references (resolved once at bootstrap)
 *   - Deep-clone snapshots via JSON.parse(JSON.stringify())
 *   - Zero external audio files (Web Audio API oscillators only)
 *   - Rolling 50-packet P2P diagnostic log
 * =====================================================================
 */

const BUILD_VERSION = "4.5.0";
const STORE_KEY     = "ttt_settings_liquid_v4";
const GAME_KEY      = "ttt_game_liquid_v4";

/* ─────────────────────────────────────────────────────
   P2P NETWORK STATE
   ───────────────────────────────────────────────────── */
const network = {
  peer: null,
  conn: null,
  isHost: false,
  isActive: false,
  roomID: null
};

const networkLog = [];
function pushNetLog(direction, data) {
  networkLog.push({ ts: Date.now(), dir: direction, data: JSON.parse(JSON.stringify(data)) });
  if (networkLog.length > 50) networkLog.shift();
}

/* ─────────────────────────────────────────────────────
   PREMIUM SKINS & MONETIZATION
   ───────────────────────────────────────────────────── */
const PREMIUM_SKINS = [
  { id: "neon_fire",    emoji: "\uD83D\uDD25", name: "\u041E\u0433\u043E\u043D\u044C",    isLocked: true },
  { id: "neon_diamond", emoji: "\uD83D\uDC8E", name: "\u0410\u043B\u043C\u0430\u0437",    isLocked: true },
  { id: "neon_bolt",    emoji: "\u26A1",        name: "\u041C\u043E\u043B\u043D\u0438\u044F",   isLocked: true },
  { id: "neon_star",    emoji: "\uD83C\uDF1F",  name: "\u0417\u0432\u0435\u0437\u0434\u0430",   isLocked: true }
];

function isPremiumUnlocked(key) {
  try { return localStorage.getItem(key) === "true"; } catch (e) { return false; }
}

function unlockPremium(key) {
  try { localStorage.setItem(key, "true"); } catch (e) { /* noop */ }
}

function getUnlockedSkins() {
  try {
    const arr = JSON.parse(localStorage.getItem("unlocked_skins") || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function unlockSkin(skinId) {
  const skins = getUnlockedSkins();
  if (!skins.includes(skinId)) {
    skins.push(skinId);
    localStorage.setItem("unlocked_skins", JSON.stringify(skins));
  }
}

function isSkinUnlocked(skinId) {
  return getUnlockedSkins().includes(skinId);
}

function purchaseWithStars(itemKey, itemType) {
  const invoiceUrl = "https://t.me/$STARS_INVOICE_PLACEHOLDER";
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openInvoice) {
    window.Telegram.WebApp.openInvoice(invoiceUrl, function (status) {
      if (status === "paid") {
        if (itemType === "theme") {
          unlockPremium(itemKey);
          showToast("\u2705 \u0422\u0435\u043C\u0430 \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0430!");
        } else if (itemType === "skin") {
          unlockSkin(itemKey);
          showToast("\u2705 \u0421\u043A\u0438\u043D \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D!");
        }
        renderUI();
        syncSettingsForm();
      } else {
        showToast("\u274C \u041E\u043F\u043B\u0430\u0442\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430");
      }
    });
  } else {
    showToast("\u2B50\uFE0F \u041E\u043F\u043B\u0430\u0442\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 Telegram");
  }
}

/* ─────────────────────────────────────────────────────
   AUDIO SUBSYSTEM (Web Audio API — zero external files)
   ───────────────────────────────────────────────────── */
const Sfx = {
  ctx: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  },

  playTone(freq, type, duration, vol) {
    if (!this.ctx) return;
    vol = vol || 0.1;
    var osc  = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
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
    this.playTone(600, "sine", 0.1, 0.15);
    setTimeout(function () { Sfx.playTone(800, "sine", 0.1, 0.1); }, 50);
  },

  click(soundEnabled) {
    if (!soundEnabled) return;
    this.init();
    this.playTone(400, "triangle", 0.05, 0.05);
  },

  win(soundEnabled) {
    if (!soundEnabled) return;
    this.init();
    var freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach(function (f, i) {
      setTimeout(function () { Sfx.playTone(f, "sine", 0.4, 0.2); }, i * 120);
    });
  },

  lose(soundEnabled) {
    if (!soundEnabled) return;
    this.init();
    var freqs = [400, 350, 300, 250];
    freqs.forEach(function (f, i) {
      setTimeout(function () { Sfx.playTone(f, "sawtooth", 0.3, 0.12); }, i * 150);
    });
  }
};

/* ─────────────────────────────────────────────────────
   HAPTIC FEEDBACK (Navigator + Telegram WebApp)
   ───────────────────────────────────────────────────── */
const Haptic = {
  trigger(type) {
    type = type || "light";
    // Telegram WebApp Taptic Engine
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      var tg = window.Telegram.WebApp.HapticFeedback;
      if (type === "light")  tg.impactOccurred("light");
      if (type === "medium") tg.impactOccurred("medium");
      if (type === "heavy")  tg.impactOccurred("heavy");
      return;
    }
    // Standard mobile vibration fallback
    if (!navigator.vibrate) return;
    if (type === "light")  navigator.vibrate(5);
    if (type === "medium") navigator.vibrate(15);
    if (type === "heavy")  navigator.vibrate([20, 30, 20]);
  }
};

/* ─────────────────────────────────────────────────────
   CONFETTI ANIMATION (Canvas Particle System)
   ───────────────────────────────────────────────────── */
const Confetti = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    window.addEventListener("resize", function () { Confetti.resize(); });
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
    var colors = ["#00C6FF", "#0072FF", "#FF9500", "#FF2D55", "#AF52DE", "#FFD700", "#F5B041"];
    for (var i = 0; i < 120; i++) {
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
    var self = this;
    self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
    var active = false;
    self.particles.forEach(function (p) {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.35;
      p.rot += p.rotV;
      p.life -= 0.013;
      if (p.life > 0) {
        active = true;
        self.ctx.save();
        self.ctx.globalAlpha = p.life;
        self.ctx.fillStyle   = p.color;
        self.ctx.translate(p.x, p.y);
        self.ctx.rotate(p.rot);
        self.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        self.ctx.restore();
      }
    });
    if (active) {
      self.animId = requestAnimationFrame(function () { self.loop(); });
    } else {
      self.animId = null;
      self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
    }
  }
};

/* ─────────────────────────────────────────────────────
   LOCAL STORAGE HELPERS (deep-clone safety)
   ───────────────────────────────────────────────────── */
function defaultSettings() {
  return {
    lang: "ru",
    theme: "light",
    matchMode: "classic",
    mode: "pvp",
    size: 3,
    goal: 3,
    ai: "expert",
    p1: "\u0418\u0433\u0440\u043E\u043A 1",
    p2: "\u0418\u0433\u0440\u043E\u043A 2",
    p3: "\u0418\u0433\u0440\u043E\u043A 3",
    p4: "\u0418\u0433\u0440\u043E\u043A 4",
    sound: true,
    sym1: "X",
    sym2: "O",
    sym3: "\u25B3",
    sym4: "\u25A1",
    gamesPlayed: 0,
    gamesWon: 0,
    pveLevel: 1,
    pveXp: 0
  };
}

function loadSettings() {
  try {
    var s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s) return Object.assign({}, defaultSettings(), s);
  } catch (e) { /* noop */ }
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
  localStorage.setItem(GAME_KEY, JSON.stringify(
    Object.assign({ version: BUILD_VERSION }, gameState)
  ));
}

/* ─────────────────────────────────────────────────────
   AI ENGINE — TACTICAL BRAIN
   ───────────────────────────────────────────────────── */

function checkWinFull(b, sz, goal) {
  var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (var r = 0; r < sz; r++) {
    for (var c = 0; c < sz; c++) {
      var start = b[r * sz + c];
      if (!start) continue;
      for (var di = 0; di < dirs.length; di++) {
        var d = dirs[di];
        var line = [];
        for (var k = 0; k < goal; k++) {
          var nr = r + d[0] * k;
          var nc = c + d[1] * k;
          if (nr < 0 || nr >= sz || nc < 0 || nc >= sz) break;
          if (b[nr * sz + nc] === start) {
            line.push(nr * sz + nc);
          } else {
            break;
          }
        }
        if (line.length === goal) return { win: true, line: line };
      }
    }
  }
  return { win: false, line: [] };
}

function checkWinSimple(b, sz, goal) {
  return checkWinFull(b, sz, goal).win;
}

function countOpenLines(b, sz, goal, sym) {
  var dirs  = [[1, 0], [0, 1], [1, 1], [1, -1]];
  var threats = 0;
  for (var r = 0; r < sz; r++) {
    for (var c = 0; c < sz; c++) {
      for (var di = 0; di < dirs.length; di++) {
        var d = dirs[di];
        var ours = 0;
        var blocked = false;
        for (var k = 0; k < goal; k++) {
          var nr = r + d[0] * k, nc = c + d[1] * k;
          if (nr < 0 || nr >= sz || nc < 0 || nc >= sz) { blocked = true; break; }
          var v = b[nr * sz + nc];
          if (v && v !== sym) { blocked = true; break; }
          if (v === sym) ours++;
        }
        if (!blocked) threats += ours;
      }
    }
  }
  return threats;
}

function countWinningThreats(b, sz, goal, idx, sym) {
  if (b[idx]) return 0;
  b[idx] = sym;
  var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  var winLines = {};
  var winCount = 0;
  var empties = [];
  for (var ei = 0; ei < b.length; ei++) {
    if (b[ei] === "") empties.push(ei);
  }
  for (var x = 0; x < empties.length; x++) {
    var e = empties[x];
    if (e === idx) continue;
    b[e] = sym;
    if (checkWinSimple(b, sz, goal)) {
      for (var di = 0; di < dirs.length; di++) {
        var d = dirs[di];
        for (var r = 0; r < sz; r++) {
          for (var c = 0; c < sz; c++) {
            var line = [];
            for (var k = 0; k < goal; k++) {
              var nr = r + d[0] * k, nc = c + d[1] * k;
              if (nr < 0 || nr >= sz || nc < 0 || nc >= sz) break;
              if (b[nr * sz + nc] === sym) line.push(nr * sz + nc);
              else break;
            }
            if (line.length === goal && line.indexOf(e) !== -1) {
              var key = line.slice().sort(function (a, b2) { return a - b2; }).join(",");
              if (!winLines[key]) { winLines[key] = true; winCount++; }
            }
          }
        }
      }
    }
    b[e] = "";
  }
  b[idx] = "";
  return winCount;
}

function minimax(b, sz, goal, depth, isMax, alpha, beta, meSymbol, enemySymbol, maxDepth) {
  var res = checkWinFull(b, sz, goal);
  if (res.win) {
    var winner = b[res.line[0]];
    return winner === meSymbol ? (100 - depth) : -(100 - depth);
  }
  var empties = [];
  for (var i = 0; i < b.length; i++) { if (b[i] === "") empties.push(i); }
  if (!empties.length || depth >= maxDepth) return 0;

  if (isMax) {
    var best = -Infinity;
    for (var ei = 0; ei < empties.length; ei++) {
      b[empties[ei]] = meSymbol;
      var score = minimax(b, sz, goal, depth + 1, false, alpha, beta, meSymbol, enemySymbol, maxDepth);
      b[empties[ei]] = "";
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    var best2 = Infinity;
    for (var ei2 = 0; ei2 < empties.length; ei2++) {
      b[empties[ei2]] = enemySymbol;
      var score2 = minimax(b, sz, goal, depth + 1, true, alpha, beta, meSymbol, enemySymbol, maxDepth);
      b[empties[ei2]] = "";
      if (score2 < best2) best2 = score2;
      if (best2 < beta) beta = best2;
      if (beta <= alpha) break;
    }
    return best2;
  }
}

function findBestMove(board, empties, cfg, meSymbol, enemySymbol) {
  var sz = cfg.size;
  var gl = cfg.goal;
  var is3x3Expert = (sz === 3 && gl === 3 && cfg.ai === "expert");

  // STEP 1: Win immediately
  for (var i = 0; i < empties.length; i++) {
    board[empties[i]] = meSymbol;
    if (checkWinSimple(board, sz, gl)) { board[empties[i]] = ""; return empties[i]; }
    board[empties[i]] = "";
  }

  // STEP 2: Block opponent immediate win
  for (var j = 0; j < empties.length; j++) {
    board[empties[j]] = enemySymbol;
    if (checkWinSimple(board, sz, gl)) { board[empties[j]] = ""; return empties[j]; }
    board[empties[j]] = "";
  }

  // Expert 3x3: full Minimax with alpha-beta
  if (is3x3Expert) {
    var bestScore = -Infinity;
    var bestMove  = empties[0];
    for (var mi = 0; mi < empties.length; mi++) {
      board[empties[mi]] = meSymbol;
      var sc = minimax(board, sz, gl, 0, false, -Infinity, Infinity, meSymbol, enemySymbol, 9);
      board[empties[mi]] = "";
      if (sc > bestScore) { bestScore = sc; bestMove = empties[mi]; }
    }
    return bestMove;
  }

  // STEP 3 (Hard+): Create a Fork
  if (cfg.ai === "hard" || cfg.ai === "expert") {
    for (var fi = 0; fi < empties.length; fi++) {
      if (countWinningThreats(board, sz, gl, empties[fi], meSymbol) >= 2) return empties[fi];
    }
    // STEP 4: Block opponent Fork
    for (var bi = 0; bi < empties.length; bi++) {
      if (countWinningThreats(board, sz, gl, empties[bi], enemySymbol) >= 2) return empties[bi];
    }
  }

  // STEP 5: Strategic position scoring
  var center = Math.floor(sz / 2);
  var scored = empties.map(function (idx) {
    var r = Math.floor(idx / sz), c = idx % sz;
    var score = 0;
    if (r === center && c === center) score += 50;
    var isCorner = (r === 0 || r === sz - 1) && (c === 0 || c === sz - 1);
    if (isCorner) score += 20;
    var isEdge = (r === 0 || r === sz - 1 || c === 0 || c === sz - 1) && !isCorner;
    if (isEdge) score += 5;
    board[idx] = meSymbol;
    score += countOpenLines(board, sz, gl, meSymbol) * 2;
    board[idx] = "";
    score += Math.random() * 0.5;
    return { i: idx, score: score };
  });
  scored.sort(function (a, b) { return b.score - a.score; });
  return scored[0].i;
}

function getBotMove(board, cfg, symbols) {
  var empties = [];
  for (var i = 0; i < board.length; i++) { if (board[i] === "") empties.push(i); }
  if (!empties.length) return -1;

  var mistakeChance = 0;
  if (cfg.ai === "easy")   mistakeChance = 0.75;
  if (cfg.ai === "normal") mistakeChance = 0.35;
  if (cfg.ai === "hard")   mistakeChance = 0.08;

  if (Math.random() < mistakeChance) {
    return empties[Math.floor(Math.random() * empties.length)];
  }
  return findBestMove(board, empties, cfg, symbols[1], symbols[0]);
}

/* ─────────────────────────────────────────────────────
   I18N — LOCALISATION
   ───────────────────────────────────────────────────── */
var I18N = {
  ru: {
    home: "\u0413\u043B\u0430\u0432\u043D\u0430\u044F", settings: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438", start: "\u041D\u0430\u0447\u0430\u0442\u044C \u0438\u0433\u0440\u0443", save: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
    applied: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u044B",
    lang: "\u042F\u0437\u044B\u043A", theme: "\u0422\u0435\u043C\u0430",
    themeLight: "\u0421\u0432\u0435\u0442\u043B\u0430\u044F", themeDark: "\u0422\u0451\u043C\u043D\u0430\u044F", themeGold: "\u0417\u043E\u043B\u043E\u0442\u0430\u044F",
    thLight: "\u0421\u0432\u0435\u0442\u043B\u0430\u044F", thDark: "\u0422\u0451\u043C\u043D\u0430\u044F", thGold: "\u0417\u043E\u043B\u043E\u0442\u0430\u044F",
    sound: "\u0417\u0432\u0443\u043A", soundOn: "\u0412\u043A\u043B\u044E\u0447\u0435\u043D", soundOff: "\u0412\u044B\u043A\u043B\u044E\u0447\u0435\u043D",
    mode: "\u0420\u0435\u0436\u0438\u043C", size: "\u0420\u0430\u0437\u043C\u0435\u0440 \u043F\u043E\u043B\u044F", goal: "\u0426\u0435\u043B\u044C (\u0432 \u0440\u044F\u0434)", ai: "\u0421\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u0418\u0418",
    aiEasy: "\u041B\u0451\u0433\u043A\u0430\u044F (\u041E\u0448\u0438\u0431\u0430\u0435\u0442\u0441\u044F)", aiNormal: "\u041D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u0430\u044F", aiHard: "\u0421\u043B\u043E\u0436\u043D\u0430\u044F", aiExpert: "\u041D\u0435\u043F\u043E\u0431\u0435\u0434\u0438\u043C\u044B\u0439",
    p1: "\u0418\u0433\u0440\u043E\u043A 1", p2: "\u0418\u0433\u0440\u043E\u043A 2", p3: "\u0418\u0433\u0440\u043E\u043A 3", p4: "\u0418\u0433\u0440\u043E\u043A 4",
    playersLabel: "\u0418\u043C\u0435\u043D\u0430 \u0438\u0433\u0440\u043E\u043A\u043E\u0432",
    lblCustomSym: "\u0421\u0438\u043C\u0432\u043E\u043B\u044B \u0438\u0433\u0440\u043E\u043A\u043E\u0432 (Emoji)",
    statsTitle: "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430", statsTotal: "\u0412\u0441\u0435\u0433\u043E:", statsWins: "\u041F\u043E\u0431\u0435\u0434:", statsWinrate: "\u0412\u0438\u043D\u0440\u0435\u0439\u0442:",
    careerTitle: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u041A\u0430\u0440\u044C\u0435\u0440\u044B", careerXp: "\u041E\u043F\u044B\u0442:",
    btnAbout: "\u2139 \u041E\u0431 \u0430\u0432\u0442\u043E\u0440\u0435",
    lblMatchMod: "\u0422\u0438\u043F \u043C\u0430\u0442\u0447\u0430",
    modClassic: "\u041A\u043B\u0430\u0441\u0441\u0438\u043A\u0430 (\u041E\u0431\u044B\u0447\u043D\u0430\u044F \u0438\u0433\u0440\u0430)",
    modSuper: "\u0421\u0443\u043F\u0435\u0440-\u0440\u0435\u0436\u0438\u043C (\u0421 \u0430\u0431\u0438\u043B\u043A\u0430\u043C\u0438)",
    draftTitle: "\u0412\u044B\u0431\u043E\u0440 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0435\u0439",
    draftSub: function (p, c) { return "\u0425\u043E\u0434: " + p + " (" + c + "/3)"; },
    draftWaiting: "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430...",
    draftBotPicking: "\uD83E\uDD16 \u0411\u043E\u0442 \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u043A\u0430\u0440\u0442\u044B...",
    abilitiesData: [
      { name: "\u0423\u0434\u0430\u0440 \u0422\u043E\u0440\u0430", desc: "\u0412\u044B\u0436\u0438\u0433\u0430\u0435\u0442 \u043B\u044E\u0431\u0443\u044E \u0437\u0430\u043D\u044F\u0442\u0443\u044E \u043A\u043B\u0435\u0442\u043A\u0443 \u0432\u0440\u0430\u0433\u0430.", cat: "atk", emoji: "\uD83D\uDCA5" },
      { name: "\u0425\u0430\u043A\u0438\u043D\u0433", desc: "\u041F\u0435\u0440\u0435\u043A\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u0442 \u0447\u0443\u0436\u0443\u044E \u0444\u0438\u0433\u0443\u0440\u0443 \u0432 \u0442\u0432\u043E\u0439 \u0441\u0438\u043C\u0432\u043E\u043B.", cat: "atk", emoji: "\uD83D\uDD04" },
      { name: "\u0417\u0435\u043C\u043B\u0435\u0442\u0440\u044F\u0441\u0435\u043D\u0438\u0435", desc: "\u041F\u0435\u0440\u0435\u043C\u0435\u0448\u0438\u0432\u0430\u0435\u0442 3 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0435 \u0444\u0438\u0433\u0443\u0440\u044B \u043D\u0430 \u043F\u043E\u043B\u0435.", cat: "atk", emoji: "\uD83C\uDF2A\uFE0F" },
      { name: "\u0417\u0430\u043C\u043E\u0440\u043E\u0437\u043A\u0430", desc: "\u0411\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442 \u043F\u0443\u0441\u0442\u0443\u044E \u043A\u043B\u0435\u0442\u043A\u0443 \u043D\u0430 2 \u0445\u043E\u0434\u0430.", cat: "def", emoji: "\u2744\uFE0F" },
      { name: "\u0429\u0438\u0442", desc: "\u0417\u0430\u0449\u0438\u0449\u0430\u0435\u0442 \u0442\u0432\u043E\u044E \u0444\u0438\u0433\u0443\u0440\u0443 \u043E\u0442 \u0422\u043E\u0440\u0430 \u0438 \u0425\u0430\u043A\u0438\u043D\u0433\u0430.", cat: "def", emoji: "\uD83D\uDEE1\uFE0F" },
      { name: "\u041E\u0433\u043B\u0443\u0448\u0435\u043D\u0438\u0435", desc: "\u0417\u0430\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0432\u0440\u0430\u0433\u0430 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C 1 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0445\u043E\u0434.", cat: "def", emoji: "\uD83D\uDED1" },
      { name: "\u0411\u043B\u0438\u0446\u043A\u0440\u0438\u0433", desc: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0441\u0434\u0435\u043B\u0430\u0442\u044C 2 \u0445\u043E\u0434\u0430 \u043F\u043E\u0434\u0440\u044F\u0434 \u0432 \u044D\u0442\u043E\u0442 \u0440\u0430\u0443\u043D\u0434.", cat: "tac", emoji: "\uD83D\uDC5F" },
      { name: "\u0422\u0435\u043B\u0435\u043F\u043E\u0440\u0442", desc: "\u041F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u0442 \u0442\u0432\u043E\u044E \u0444\u0438\u0433\u0443\u0440\u0443 \u0432 \u043F\u0443\u0441\u0442\u043E\u0435 \u043C\u0435\u0441\u0442\u043E.", cat: "tac", emoji: "\uD83D\uDD2E" },
      { name: "\u041E\u0442\u043C\u0435\u043D\u0430", desc: "\u041E\u0442\u043C\u0435\u043D\u044F\u0435\u0442 \u0441\u0430\u043C\u044B\u0439 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0445\u043E\u0434 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430.", cat: "tac", emoji: "\uD83D\uDD75\uFE0F\u200D\u2642\uFE0F" },
      { name: "\u0417\u0435\u0440\u043A\u0430\u043B\u043E", desc: "\u041E\u0442\u0440\u0430\u0436\u0430\u0435\u0442 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u0443\u044E \u0432 \u0442\u0435\u0431\u044F \u0430\u0431\u0438\u043B\u043A\u0443 \u043D\u0430\u0437\u0430\u0434.", cat: "tac", emoji: "\uD83C\uDCCF" }
    ],
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 \u0418\u0433\u0440\u043E\u043A\u0430", mode4: "4 \u0418\u0433\u0440\u043E\u043A\u0430",
    exit: "\u0412\u044B\u0439\u0442\u0438", undo: "\u041E\u0442\u043C\u0435\u043D\u0430", restart: "\u0417\u0430\u043D\u043E\u0432\u043E",
    turn:  function (n) { return "\u0425\u043E\u0434: " + n; },
    sub:   function (sz, g) { return sz + "\u00D7" + sz + " \u2022 \u0426\u0435\u043B\u044C: " + g; },
    play: "\u0418\u0433\u0440\u0430 \u0438\u0434\u0451\u0442", win: "\u041F\u043E\u0431\u0435\u0434\u0430!", draw: "\u041D\u0438\u0447\u044C\u044F",
    confirmTitle: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435",
    confirmExit: "\u0412\u044B\u0439\u0442\u0438 \u0432 \u043C\u0435\u043D\u044E?", confirmNew: "\u041D\u0430\u0447\u0430\u0442\u044C \u0437\u0430\u043D\u043E\u0432\u043E?",
    ok: "\u0414\u0430", cancel: "\u041D\u0435\u0442",
    infoTitle: "\u041E\u0431 \u0430\u0432\u0442\u043E\u0440\u0435",
    infoBtnClose: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
    infoHtml: "\u0421\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044C \u0438\u0433\u0440\u044B: <strong>\u0410\u0431\u0434\u0443\u043B\u043B\u043E\u0445 \u042E\u043B\u0434\u043E\u0448\u0435\u0432 (Alex)</strong><br><br><a href='https://abdullokhyuldoshev.taplink.ws/' target='_blank' class='btn btnPrimary' style='display:inline-flex; width:auto; padding:10px 20px; font-size:15px; text-decoration:none; margin-top:8px;'>\uD83D\uDC49 \u041E\u0442\u043A\u0440\u044B\u0442\u044C Taplink</a>"
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
    btnAbout: "\u2139 About Author",
    lblMatchMod: "Match Type",
    modClassic: "Classic (Standard Game)",
    modSuper: "Super Mode (Abilities)",
    draftTitle: "Draft Abilities",
    draftSub: function (p, c) { return "Turn: " + p + " (" + c + "/3)"; },
    draftWaiting: "Waiting for opponent...",
    draftBotPicking: "\uD83E\uDD16 Bot is picking cards...",
    abilitiesData: [
      { name: "Thor's Strike", desc: "Strikes and clears any occupied cell.", cat: "atk", emoji: "\uD83D\uDCA5" },
      { name: "Hacking", desc: "Converts an enemy piece to your symbol.", cat: "atk", emoji: "\uD83D\uDD04" },
      { name: "Earthquake", desc: "Shuffles 3 random pieces on the board.", cat: "atk", emoji: "\uD83C\uDF2A\uFE0F" },
      { name: "Freeze", desc: "Blocks an empty cell for 2 turns.", cat: "def", emoji: "\u2744\uFE0F" },
      { name: "Shield", desc: "Protects your piece from Thor or Hacking.", cat: "def", emoji: "\uD83D\uDEE1\uFE0F" },
      { name: "Stun", desc: "Forces selected opponent to skip 1 turn.", cat: "def", emoji: "\uD83D\uDED1" },
      { name: "Blitzkrieg", desc: "Grants you an extra move immediately.", cat: "tac", emoji: "\uD83D\uDC5F" },
      { name: "Teleport", desc: "Moves your existing piece to any empty cell.", cat: "tac", emoji: "\uD83D\uDD2E" },
      { name: "Cancel", desc: "Reverts the last move made by an opponent.", cat: "tac", emoji: "\uD83D\uDD75\uFE0F\u200D\u2642\uFE0F" },
      { name: "Mirror", desc: "Passively counters and reflects enemy perks.", cat: "tac", emoji: "\uD83C\uDCCF" }
    ],
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 Players", mode4: "4 Players",
    exit: "Exit", undo: "Undo", restart: "Restart",
    turn:  function (n) { return "Turn: " + n; },
    sub:   function (sz, g) { return sz + "\u00D7" + sz + " \u2022 Goal: " + g; },
    play: "Playing", win: "Winner!", draw: "Draw",
    confirmTitle: "Confirm",
    confirmExit: "Exit to menu?", confirmNew: "Restart game?",
    ok: "Yes", cancel: "No",
    infoTitle: "About Author",
    infoBtnClose: "Close",
    infoHtml: "Game creator: <strong>Abdullokh Yuldoshev (Alex)</strong><br><br><a href='https://abdullokhyuldoshev.taplink.ws/' target='_blank' class='btn btnPrimary' style='display:inline-flex; width:auto; padding:10px 20px; font-size:15px; text-decoration:none; margin-top:8px;'>\uD83D\uDC49 Open Taplink</a>"
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
    btnAbout: "\u2139 Muallif haqida",
    lblMatchMod: "O'yin turi",
    modClassic: "Klassika (Oddiy o'yin)",
    modSuper: "Super Rejim (Abilkalar)",
    draftTitle: "Qobiliyatlar tanlovi",
    draftSub: function (p, c) { return "Navbat: " + p + " (" + c + "/3)"; },
    draftWaiting: "Raqib kutilmoqda...",
    draftBotPicking: "\uD83E\uDD16 Bot kartalarni tanlayapti...",
    abilitiesData: [
      { name: "Tor Zarbasi", desc: "Istalgan band katakni yo'q qiladi.", cat: "atk", emoji: "\uD83D\uDCA5" },
      { name: "Xaking", desc: "Raqib belgisini o'zingiznikiga o'zgartiradi.", cat: "atk", emoji: "\uD83D\uDD04" },
      { name: "Zilzila", desc: "Jamoadagi 3 ta belgini tasodifiy aralashtiradi.", cat: "atk", emoji: "\uD83C\uDF2A\uFE0F" },
      { name: "Muzlatish", desc: "Bo'sh katakni 2 turgacha muzlatib qo'yadi.", cat: "def", emoji: "\u2744\uFE0F" },
      { name: "Qalqon", desc: "Belgingizni Tor va Xakingdan himoya qiladi.", cat: "def", emoji: "\uD83D\uDEE1\uFE0F" },
      { name: "Stun", desc: "Raqibni 1 ta navbatni o'tkazib yuborishga majbur qiladi.", cat: "def", emoji: "\uD83D\uDED1" },
      { name: "Blitskrig", desc: "Ketma-ket 2 marta yurish imkonini beradi.", cat: "tac", emoji: "\uD83D\uDC5F" },
      { name: "Teleport", desc: "Belgingizni boshqa bo'sh katakka ko'chiradi.", cat: "tac", emoji: "\uD83D\uDD2E" },
      { name: "Bekor qilish", desc: "Raqibning oxirgi yurishini bekor qiladi.", cat: "tac", emoji: "\uD83D\uDD75\uFE0F\u200D\u2642\uFE0F" },
      { name: "Ko'zgu", desc: "Sizga qarshi ishlatilgan perkni qaytaradi.", cat: "tac", emoji: "\uD83C\uDCCF" }
    ],
    modePVP: "1 vs 1", modeAI: "1 vs AI", mode3: "3 Kishi", mode4: "4 Kishi",
    exit: "Chiqish", undo: "Bekor", restart: "Qayta",
    turn:  function (n) { return "Navbat: " + n; },
    sub:   function (sz, g) { return sz + "\u00D7" + sz + " \u2022 Maqsad: " + g; },
    play: "O'yin", win: "G'alaba!", draw: "Durang",
    confirmTitle: "Tasdiqlash",
    confirmExit: "Chiqasizmi?", confirmNew: "Qayta boshlash?",
    ok: "Ha", cancel: "Yo'q",
    infoTitle: "Muallif haqida",
    infoBtnClose: "Yopish",
    infoHtml: "O'yin yaratuvchisi: <strong>Abdullokh Yuldoshev (Alex)</strong><br><br><a href='https://abdullokhyuldoshev.taplink.ws/' target='_blank' class='btn btnPrimary' style='display:inline-flex; width:auto; padding:10px 20px; font-size:15px; text-decoration:none; margin-top:8px;'>\uD83D\uDC49 Taplink ochish</a>"
  }
};

/* ─────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────── */
var MODES = [
  { id: "pvp", key: "modePVP", players: 2, ai: false },
  { id: "ai",  key: "modeAI",  players: 2, ai: true  },
  { id: "p3",  key: "mode3",   players: 3, ai: false },
  { id: "p4",  key: "mode4",   players: 4, ai: false }
];

var AI_LEVELS = [
  { id: "easy",   key: "aiEasy"   },
  { id: "normal", key: "aiNormal" },
  { id: "hard",   key: "aiHard"   },
  { id: "expert", key: "aiExpert" }
];

var SYMBOLS = ["X", "O", "\u25B3", "\u25A1"];

/* ─────────────────────────────────────────────────────
   CACHED DOM REFERENCES (resolved once at bootstrap)
   ───────────────────────────────────────────────────── */
var DOM = {};

function $(id) { return document.getElementById(id); }

function cacheDOMRefs() {
  DOM.screenHome      = $("screenHome");
  DOM.screenSettings  = $("screenSettings");
  DOM.screenGame      = $("screenGame");
  DOM.screenDraft     = $("screenDraft");
  DOM.board           = $("board");
  DOM.homeMeta        = $("homeMeta");
  DOM.settingsTitle   = $("settingsTitle");
  DOM.turnTitle       = $("turnTitle");
  DOM.turnSub         = $("turnSub");
  DOM.tabbarGlobal    = $("tabbarGlobal");
  DOM.tabHome         = $("tabHome");
  DOM.tabSettings     = $("tabSettings");
  DOM.tabIndicator    = $("tabIndicator");
  DOM.btnStart        = $("btnStart");
  DOM.btnInfo         = $("btnInfo");
  DOM.btnSave         = $("btnSave");
  DOM.btnCreateOnline = $("btnCreateOnline");
  DOM.btnCopyNetLink  = $("btnCopyNetLink");
  DOM.btnCancelNet    = $("btnCancelNet");
  DOM.btnSoundToggle  = $("btnSoundToggle");
  DOM.btnThemeToggle  = $("btnThemeToggle");
  DOM.btnLangToggle   = $("btnLangToggle");
  DOM.themeMenu       = $("themeMenu");
  DOM.langMenu        = $("langMenu");
  DOM.btnExit         = $("btnExit");
  DOM.btnRestart      = $("btnRestart");
  DOM.btnUndo         = $("btnUndo");
  DOM.selMatchMode    = $("selMatchMode");
  DOM.selMode         = $("selMode");
  DOM.selSize         = $("selSize");
  DOM.selGoal         = $("selGoal");
  DOM.selAI           = $("selAI");
  DOM.aiRow           = $("aiRow");
  DOM.inpP1           = $("inpP1");
  DOM.inpP2           = $("inpP2");
  DOM.inpP3           = $("inpP3");
  DOM.inpP4           = $("inpP4");
  DOM.inpSym1         = $("inpSym1");
  DOM.inpSym2         = $("inpSym2");
  DOM.inpSym3         = $("inpSym3");
  DOM.inpSym4         = $("inpSym4");
  DOM.rowP3           = $("rowP3");
  DOM.rowP4           = $("rowP4");
  DOM.modalBack       = $("modalBack");
  DOM.modalTitle      = $("modalTitle");
  DOM.modalText       = $("modalText");
  DOM.modalCancel     = $("modalCancel");
  DOM.modalOk         = $("modalOk");
  DOM.toast           = $("toast");
  DOM.gameAbilitiesBar = $("gameAbilitiesBar");
  DOM.draftTitle      = $("draftTitle");
  DOM.draftSubtitle   = $("draftSubtitle");
  DOM.draftTimerNum   = $("draftTimerNum");
  DOM.draftGrid       = $("draftGrid");
  DOM.netModal        = $("netModal");
  DOM.netStatusTitle  = $("netStatusTitle");
  DOM.netStatusDesc   = $("netStatusDesc");
  DOM.adminModal      = $("adminModal");
  DOM.adminLoginScreen = $("adminLoginScreen");
  DOM.adminDashboard  = $("adminDashboard");
  DOM.adminLoginInput = $("adminLoginInput");
  DOM.adminPassInput  = $("adminPassInput");
  DOM.adminLoginBtn   = $("adminLoginBtn");
  DOM.adminCloseBtn   = $("adminCloseBtn");
  DOM.adminCloseBtn2  = $("adminCloseBtn2");
  DOM.adminUnlockAll  = $("adminUnlockAll");
  DOM.adminClearStorage = $("adminClearStorage");
  DOM.adminRefreshNet = $("adminRefreshNet");
  DOM.adminNetMonitor = $("adminNetMonitor");
  DOM.gameVersion     = $("gameVersion");
  DOM.lblCareerTitle  = $("lblCareerTitle");
  DOM.lblCareerXp     = $("lblCareerXp");
  DOM.careerProgressFill = $("careerProgressFill");
  DOM.lblStatsTitle   = $("lblStatsTitle");
  DOM.statTotal       = $("statTotal");
  DOM.statWins        = $("statWins");
  DOM.statWinrate     = $("statWinrate");
  DOM.lblMatchMod     = $("lblMatchMod");
  DOM.lblMode         = $("lblMode");
  DOM.lblSize         = $("lblSize");
  DOM.lblGoal         = $("lblGoal");
  DOM.lblAI           = $("lblAI");
  DOM.lblNames        = $("lblNames");
  DOM.btnDevPanel     = $("btnDevPanel");
}

/* ─────────────────────────────────────────────────────
   GAME STATE
   ───────────────────────────────────────────────────── */
var superMode = {
  activeAbility: null,
  playerDecks: {},
  usedAbilities: {},
  frozenCells: {},
  shieldedCells: {},
  draftOrder: [],
  draftTurnIndex: 0
};

var settings = loadSettings();
var board    = [];
var moveHistory  = [];
var gameOver = false;
var winLine  = [];
var draftTimerInterval = null;
var pendingRenderFrame = null;

/* ─────────────────────────────────────────────────────
   BATCHED RENDER (Zero Layout Thrashing)
   ───────────────────────────────────────────────────── */
function scheduleRender() {
  if (pendingRenderFrame) return;
  pendingRenderFrame = requestAnimationFrame(function () {
    pendingRenderFrame = null;
    renderGame();
  });
}

/* ─────────────────────────────────────────────────────
   INIT — SINGLE BOOTSTRAP ENTRY
   ───────────────────────────────────────────────────── */
function init() {
  cacheDOMRefs();
  Confetti.init("confettiCanvas");
  applyTheme();
  renderUI();
  initP2PNetwork();
  bindEvents();

  // Restore saved game
  var savedGame = loadGame();
  if (savedGame && savedGame.board && savedGame.board.length > 0 && !savedGame.gameOver) {
    board    = savedGame.board;
    moveHistory  = savedGame.history || [];
    gameOver = savedGame.gameOver;
    settings = Object.assign({}, defaultSettings(), savedGame.settingsSnapshot);
    renderGame();
    go("game");
  } else {
    go("home");
  }
}

/* ─────────────────────────────────────────────────────
   EVENT BINDING (single pass, no accumulation)
   ───────────────────────────────────────────────────── */
function bindEvents() {
  DOM.btnStart.onclick = function () {
    Sfx.click(settings.sound);
    Haptic.trigger("light");
    if (settings.matchMode === "super") {
      DOM.screenHome.classList.add("hidden");
      DOM.screenDraft.classList.remove("hidden");
      startDraftPhase();
    } else {
      startNewGame();
    }
  };

  if (DOM.btnCreateOnline) {
    DOM.btnCreateOnline.onclick = function () {
      Sfx.click(settings.sound);
      Haptic.trigger("medium");
      startNetworkHost();
    };
  }

  if (DOM.btnCancelNet) {
    DOM.btnCancelNet.onclick = function () {
      Sfx.click(settings.sound);
      DOM.netModal.classList.add("hidden");
      if (network.peer) { network.peer.destroy(); network.peer = null; }
      network.isActive = false;
      if (!network.isHost) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
  }

  if (DOM.btnCopyNetLink) {
    DOM.btnCopyNetLink.onclick = function () {
      Sfx.click(settings.sound);
      var link = window.location.origin + window.location.pathname + "?room=" + network.peer.id;
      navigator.clipboard.writeText(link).then(function () {
        showToast("\u0421\u0441\u044B\u043B\u043A\u0430 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0430!");
      });
    };
  }

  DOM.tabHome.onclick     = function () { Sfx.click(settings.sound); go("home"); };
  DOM.tabSettings.onclick = function () { Sfx.click(settings.sound); go("settings"); };

  DOM.btnInfo.onclick = function () {
    Sfx.click(settings.sound);
    var t = I18N[settings.lang];
    DOM.modalTitle.textContent    = t.infoTitle;
    DOM.modalText.innerHTML       = t.infoHtml;
    DOM.modalCancel.style.display = "none";
    DOM.modalOk.textContent       = t.infoBtnClose;
    DOM.modalBack.classList.add("on");
    DOM.modalOk.onclick = function () {
      Sfx.click(settings.sound);
      DOM.modalBack.classList.remove("on");
      DOM.modalCancel.style.display = "";
    };
    DOM.modalCancel.onclick = null;
  };

  DOM.btnSave.onclick = function () {
    Sfx.click(settings.sound);
    Haptic.trigger("medium");
    saveAndApply();
  };

  DOM.btnSoundToggle.onclick = function () {
    settings.sound = !settings.sound;
    if (settings.sound) Sfx.click(true);
    saveSettings(settings);
    renderUI();
  };

  if (DOM.selMode) {
    DOM.selMode.onchange = function () {
      var currentMode = DOM.selMode.value;
      if (DOM.rowP3) DOM.rowP3.style.display = (currentMode === "p3" || currentMode === "p4") ? "flex" : "none";
      if (DOM.rowP4) DOM.rowP4.style.display = (currentMode === "p4") ? "flex" : "none";
      settings.mode = currentMode;
      saveAndApply();
    };
  }

  // Theme dropdown
  DOM.btnThemeToggle.onclick = function (e) {
    Sfx.click(settings.sound);
    DOM.themeMenu.classList.toggle("hidden");
    e.stopPropagation();
  };

  document.querySelectorAll(".btn-theme-item").forEach(function (btn) {
    btn.onclick = function () {
      Sfx.click(settings.sound);
      var chosenTheme = btn.getAttribute("data-theme");
      if (chosenTheme === "gold" && !isPremiumUnlocked("gold_theme_unlocked")) {
        showToast("\u2B50\uFE0F \u0417\u043E\u043B\u043E\u0442\u0430\u044F \u0442\u0435\u043C\u0430 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0430. \u041A\u0443\u043F\u0438\u0442\u0435 \u0437\u0430 Telegram Stars!");
        purchaseWithStars("gold_theme_unlocked", "theme");
        DOM.themeMenu.classList.add("hidden");
        return;
      }
      settings.theme = chosenTheme;
      saveSettings(settings);
      DOM.themeMenu.classList.add("hidden");
      applyTheme();
      renderUI();
    };
  });

  // Language dropdown
  DOM.btnLangToggle.onclick = function (e) {
    Sfx.click(settings.sound);
    DOM.langMenu.classList.toggle("hidden");
    e.stopPropagation();
  };

  document.addEventListener("click", function () {
    if (DOM.langMenu)  DOM.langMenu.classList.add("hidden");
    if (DOM.themeMenu) DOM.themeMenu.classList.add("hidden");
  });

  document.querySelectorAll(".btn-lang-item").forEach(function (btn) {
    btn.onclick = function () {
      Sfx.click(settings.sound);
      settings.lang = btn.getAttribute("data-lang");
      saveSettings(settings);
      DOM.langMenu.classList.add("hidden");
      renderUI();
      syncSettingsForm();
    };
  });

  DOM.selSize.onchange = rebuildGoalSelect;

  DOM.btnExit.onclick = function () {
    Sfx.click(settings.sound);
    modalConfirm(I18N[settings.lang].confirmExit).then(function (ok) {
      if (ok) {
        board = [];
        gameOver = false;
        saveGameData();
        go("home");
      }
    });
  };

  DOM.btnRestart.onclick = function () {
    Sfx.click(settings.sound);
    modalConfirm(I18N[settings.lang].confirmNew).then(function (ok) {
      if (ok) startNewGame();
    });
  };

  DOM.btnUndo.onclick = function () {
    Sfx.click(settings.sound);
    Haptic.trigger("light");
    doUndo();
  };

  // Admin Panel
  if (DOM.btnDevPanel) {
    DOM.btnDevPanel.onclick = function (e) {
      e.preventDefault();
      Sfx.click(settings.sound);
      DOM.adminModal.classList.remove("hidden");
      DOM.adminLoginScreen.classList.remove("hidden");
      DOM.adminDashboard.classList.add("hidden");
      if (DOM.adminLoginInput) DOM.adminLoginInput.value = "";
      if (DOM.adminPassInput)  DOM.adminPassInput.value = "";
    };
  }

  if (DOM.adminLoginBtn) {
    DOM.adminLoginBtn.onclick = function () {
      var login = DOM.adminLoginInput.value.trim();
      var pass  = DOM.adminPassInput.value.trim();
      if (login === "alex" && pass === "liquid4ever") {
        DOM.adminLoginScreen.classList.add("hidden");
        DOM.adminDashboard.classList.remove("hidden");
        refreshAdminMonitor();
      } else {
        showToast("\u274C \u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043B\u043E\u0433\u0438\u043D \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C");
      }
    };
  }

  if (DOM.adminUnlockAll) {
    DOM.adminUnlockAll.onclick = function () {
      unlockPremium("gold_theme_unlocked");
      PREMIUM_SKINS.forEach(function (s) { unlockSkin(s.id); });
      showToast("\u2705 \u0412\u0441\u0451 \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E!");
      renderUI();
    };
  }

  if (DOM.adminClearStorage) {
    DOM.adminClearStorage.onclick = function () {
      localStorage.clear();
      showToast("\uD83D\uDDD1\uFE0F localStorage \u043E\u0447\u0438\u0449\u0435\u043D");
      settings = defaultSettings();
      renderUI();
      syncSettingsForm();
    };
  }

  if (DOM.adminRefreshNet) {
    DOM.adminRefreshNet.onclick = function () { refreshAdminMonitor(); };
  }

  if (DOM.adminCloseBtn) {
    DOM.adminCloseBtn.onclick = function () { DOM.adminModal.classList.add("hidden"); };
  }

  if (DOM.adminCloseBtn2) {
    DOM.adminCloseBtn2.onclick = function () { DOM.adminModal.classList.add("hidden"); };
  }
}

/* ─────────────────────────────────────────────────────
   NAVIGATION
   ───────────────────────────────────────────────────── */
function go(scr) {
  DOM.screenHome.classList.add("hidden");
  DOM.screenSettings.classList.add("hidden");
  DOM.screenGame.classList.add("hidden");

  DOM.tabHome.classList.remove("tabOn");
  DOM.tabSettings.classList.remove("tabOn");

  if (DOM.tabbarGlobal) DOM.tabbarGlobal.classList.remove("hidden");

  if (scr === "home") {
    DOM.screenHome.classList.remove("hidden");
    DOM.tabHome.classList.add("tabOn");
    setTimeout(function () { moveTabIndicator("tabHome"); }, 0);
    renderHomeMeta();
  } else if (scr === "settings") {
    DOM.screenSettings.classList.remove("hidden");
    DOM.tabSettings.classList.add("tabOn");
    setTimeout(function () { moveTabIndicator("tabSettings"); }, 0);
    syncSettingsForm();
  } else if (scr === "game") {
    DOM.screenGame.classList.remove("hidden");
    if (DOM.tabbarGlobal) DOM.tabbarGlobal.classList.add("hidden");
  }
}

function moveTabIndicator(btnId) {
  var btn = $(btnId);
  if (!btn || !DOM.tabIndicator) return;
  DOM.tabIndicator.style.left  = btn.offsetLeft + "px";
  DOM.tabIndicator.style.width = btn.offsetWidth + "px";
}

/* ─────────────────────────────────────────────────────
   HOME META
   ───────────────────────────────────────────────────── */
function renderHomeMeta() {
  var t = I18N[settings.lang];
  var m = MODES.find(function (x) { return x.id === settings.mode; });
  DOM.homeMeta.textContent = t[m.key] + " \u2022 " + settings.size + "\u00D7" + settings.size;
}

/* ─────────────────────────────────────────────────────
   SETTINGS FORM SYNC
   ───────────────────────────────────────────────────── */
function syncSettingsForm() {
  var t = I18N[settings.lang];

  if (DOM.selMatchMode) {
    DOM.selMatchMode.innerHTML = "<option value=\"classic\">" + t.modClassic + "</option><option value=\"super\">" + t.modSuper + "</option>";
    DOM.selMatchMode.value = settings.matchMode || "classic";
  }

  DOM.selMode.innerHTML = "";
  MODES.forEach(function (m) {
    var opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = t[m.key];
    DOM.selMode.appendChild(opt);
  });
  DOM.selMode.value = settings.mode;

  if (DOM.selSize.options.length === 0) {
    for (var i = 3; i <= 10; i++) {
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i + "\u00D7" + i;
      DOM.selSize.appendChild(opt);
    }
  }
  DOM.selSize.value = settings.size;
  rebuildGoalSelect();
  DOM.selGoal.value = settings.goal;

  DOM.selAI.innerHTML = "";
  AI_LEVELS.forEach(function (lvl) {
    var opt = document.createElement("option");
    opt.value       = lvl.id;
    opt.textContent = t[lvl.key];
    DOM.selAI.appendChild(opt);
  });
  DOM.selAI.value = settings.ai;
  DOM.aiRow.style.display = (settings.mode === "ai") ? "block" : "none";

  DOM.inpP1.value = settings.p1;
  DOM.inpP2.value = settings.p2;
  DOM.inpP3.value = settings.p3;
  DOM.inpP4.value = settings.p4;
  if (DOM.rowP3) DOM.rowP3.style.display = (settings.mode === "p3" || settings.mode === "p4") ? "flex" : "none";
  if (DOM.rowP4) DOM.rowP4.style.display = (settings.mode === "p4") ? "flex" : "none";

  DOM.inpSym1.value = settings.sym1;
  DOM.inpSym2.value = settings.sym2;
  DOM.inpSym3.value = settings.sym3;
  DOM.inpSym4.value = settings.sym4;

  updateStatsUI();
}

/* ─────────────────────────────────────────────────────
   GOAL SELECT REBUILD
   ───────────────────────────────────────────────────── */
function rebuildGoalSelect() {
  var sz = parseInt(DOM.selSize.value);
  DOM.selGoal.innerHTML = "";
  for (var i = 3; i <= Math.min(sz, 5); i++) {
    var opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    DOM.selGoal.appendChild(opt);
  }
  if (settings.goal <= sz && settings.goal >= 3) DOM.selGoal.value = settings.goal;
  else DOM.selGoal.value = Math.min(sz, 5);
}

/* ─────────────────────────────────────────────────────
   SAVE & APPLY SETTINGS
   ───────────────────────────────────────────────────── */
function saveAndApply() {
  if (DOM.selMatchMode) settings.matchMode = DOM.selMatchMode.value;
  settings.mode = DOM.selMode.value;
  settings.size = parseInt(DOM.selSize.value) || 3;
  settings.goal = parseInt(DOM.selGoal.value) || 3;
  settings.ai   = DOM.selAI.value;

  settings.p1 = DOM.inpP1.value.trim() || "Player 1";
  settings.p2 = DOM.inpP2.value.trim() || "Player 2";
  settings.p3 = DOM.inpP3.value.trim() || "Player 3";
  settings.p4 = DOM.inpP4.value.trim() || "Player 4";

  settings.sym1 = Array.from(DOM.inpSym1.value.trim())[0] || "X";
  settings.sym2 = Array.from(DOM.inpSym2.value.trim())[0] || "O";
  settings.sym3 = Array.from(DOM.inpSym3.value.trim())[0] || "\u25B3";
  settings.sym4 = Array.from(DOM.inpSym4.value.trim())[0] || "\u25A1";

  saveSettings(settings);
  applyTheme();
  renderUI();
  showToast(I18N[settings.lang].applied);
}

/* ─────────────────────────────────────────────────────
   SUPER MODE — SYNCHRONOUS DRAFT PHASE
   ───────────────────────────────────────────────────── */
function startDraftPhase() {
  var t = I18N[settings.lang];
  if (!superMode.playerDecks[0]) superMode.playerDecks = { 0: [], 1: [], 2: [], 3: [] };
  if (!superMode.usedAbilities[0]) superMode.usedAbilities = { 0: [], 1: [], 2: [], 3: [] };
  superMode.frozenCells = {};
  superMode.shieldedCells = {};
  superMode.draftTurnIndex = 0;

  superMode.draftOrder = [0, 1];
  if (settings.mode === "p3") superMode.draftOrder = [0, 1, 2];
  if (settings.mode === "p4") superMode.draftOrder = [0, 1, 2, 3];
  if (settings.mode === "ai") superMode.draftOrder = [0, 1];

  renderDraftGrid();
  startDraftTimer();
}

function startDraftTimer() {
  if (draftTimerInterval) clearInterval(draftTimerInterval);
  var timeLeft = 20;
  if (DOM.draftTimerNum) DOM.draftTimerNum.textContent = timeLeft;

  draftTimerInterval = setInterval(function () {
    timeLeft--;
    if (DOM.draftTimerNum) DOM.draftTimerNum.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(draftTimerInterval);
      draftTimerInterval = null;

      var myIdx = network.isActive ? (network.isHost ? 0 : 1) : null;

      // Auto-fill missing abilities via random ID generation
      for (var pi = 0; pi < superMode.draftOrder.length; pi++) {
        var p = superMode.draftOrder[pi];
        if (network.isActive && p !== myIdx) continue;
        superMode.playerDecks[p] = superMode.playerDecks[p] || [];
        var deck = superMode.playerDecks[p];
        var available = [];
        for (var ai = 0; ai < 10; ai++) {
          if (deck.indexOf(ai) === -1) available.push(ai);
        }
        while (deck.length < 3 && available.length > 0) {
          var ri = Math.floor(Math.random() * available.length);
          deck.push(available[ri]);
          available.splice(ri, 1);
        }
      }

      // Broadcast PLAYER_READY
      if (network.isActive && network.conn && network.conn.open) {
        var pkt = {
          type: "PLAYER_READY",
          playerIdx: myIdx,
          deck: superMode.playerDecks[myIdx]
        };
        pushNetLog("OUT", pkt);
        network.conn.send(pkt);
      }

      renderDraftGrid();
    }
  }, 1000);
}

function renderDraftGrid() {
  var t = I18N[settings.lang];
  if (!DOM.draftGrid || !DOM.draftSubtitle) return;

  DOM.draftGrid.innerHTML = "";

  var hostDeck  = superMode.playerDecks[0] || [];
  var guestDeck = superMode.playerDecks[1] || [];

  var myIdx = network.isActive ? (network.isHost ? 0 : 1) : null;

  // Lock when local player has 3 cards, send PLAYER_READY
  if (network.isActive && superMode.playerDecks[myIdx] && superMode.playerDecks[myIdx].length >= 3) {
    DOM.draftSubtitle.textContent = t.draftWaiting;
    if (network.conn && network.conn.open) {
      var readyPkt = {
        type: "PLAYER_READY",
        playerIdx: myIdx,
        deck: superMode.playerDecks[myIdx]
      };
      pushNetLog("OUT", readyPkt);
      network.conn.send(readyPkt);
    }
  }

  // Game starts only when BOTH decks have 3 cards
  var allReady = true;
  for (var oi = 0; oi < superMode.draftOrder.length; oi++) {
    var deckCheck = superMode.playerDecks[superMode.draftOrder[oi]] || [];
    if (deckCheck.length < 3) { allReady = false; break; }
  }

  if (allReady) {
    if (draftTimerInterval) { clearInterval(draftTimerInterval); draftTimerInterval = null; }
    DOM.screenDraft.classList.add("hidden");
    board = Array(settings.size * settings.size).fill("");
    moveHistory = [];
    gameOver = false;
    winLine = [];
    renderGame();
    go("game");
    return;
  }

  // AI auto-draft
  if (settings.mode === "ai" && hostDeck.length >= 3 && guestDeck.length < 3) {
    DOM.draftSubtitle.textContent = t.draftBotPicking;
  }

  var activePlayerIdx = superMode.draftOrder[superMode.draftTurnIndex % superMode.draftOrder.length];
  superMode.playerDecks[activePlayerIdx] = superMode.playerDecks[activePlayerIdx] || [];

  while (superMode.playerDecks[activePlayerIdx].length >= 3) {
    superMode.draftTurnIndex++;
    activePlayerIdx = superMode.draftOrder[superMode.draftTurnIndex % superMode.draftOrder.length];
    superMode.playerDecks[activePlayerIdx] = superMode.playerDecks[activePlayerIdx] || [];
  }

  var pName = getPlayerName(activePlayerIdx);
  DOM.draftSubtitle.textContent = t.draftSub(pName, superMode.playerDecks[activePlayerIdx].length);

  // AI draft logic (priority: Thor, Hack, Blitzkrieg)
  if (settings.mode === "ai" && activePlayerIdx === 1) {
    setTimeout(function () {
      superMode.playerDecks[1] = superMode.playerDecks[1] || [];
      var available = [];
      for (var ai = 0; ai < 10; ai++) {
        if (superMode.playerDecks[1].indexOf(ai) === -1) available.push(ai);
      }
      var priorityAbilities = [0, 1, 6];
      var bestChoice = -1;
      for (var pi = 0; pi < priorityAbilities.length; pi++) {
        if (available.indexOf(priorityAbilities[pi]) !== -1) {
          bestChoice = priorityAbilities[pi];
          break;
        }
      }
      if (bestChoice === -1) {
        bestChoice = available[Math.floor(Math.random() * available.length)];
      }
      superMode.playerDecks[1].push(bestChoice);
      superMode.draftTurnIndex++;
      renderDraftGrid();
    }, 400);
    return;
  }

  // Render 10 ability cards (Anti-Clipped Layout per PRD)
  t.abilitiesData.forEach(function (ab, idx) {
    var card = document.createElement("div");
    card.className = "draft-card-row";

    if (superMode.playerDecks[activePlayerIdx].indexOf(idx) !== -1) {
      card.classList.add("picked");
    }

    card.innerHTML =
      '<div class="draft-card-left">' +
        '<span class="card-emoji">' + ab.emoji + '</span>' +
        '<span class="card-cat cat-' + ab.cat + '">' + ab.cat + '</span>' +
      '</div>' +
      '<div class="draft-card-right">' +
        '<div class="card-name">' + ab.name + '</div>' +
        '<div class="card-desc">' + ab.desc + '</div>' +
      '</div>';

    card.onclick = function () {
      if (superMode.playerDecks[activePlayerIdx].indexOf(idx) !== -1) return;
      if (network.isActive) {
        if (network.isHost && activePlayerIdx !== 0) return;
        if (!network.isHost && activePlayerIdx !== 1) return;
      }
      Sfx.click(settings.sound);
      Haptic.trigger("light");
      superMode.playerDecks[activePlayerIdx].push(idx);

      if (network.isActive && network.conn && network.conn.open) {
        var pkt = { type: "DRAFT_SELECT", playerIdx: activePlayerIdx, abilityId: idx };
        pushNetLog("OUT", pkt);
        network.conn.send(pkt);
      }

      superMode.draftTurnIndex++;
      renderDraftGrid();
    };

    DOM.draftGrid.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────────
   ABILITIES BAR (in-game)
   ───────────────────────────────────────────────────── */
function renderAbilitiesBar() {
  if (!DOM.gameAbilitiesBar) return;
  DOM.gameAbilitiesBar.innerHTML = "";

  if (settings.matchMode !== "super" || gameOver) return;

  var t = I18N[settings.lang];
  var pIdx = moveHistory.length % getPlayersCount();
  var deck = superMode.playerDecks[pIdx] || [];

  deck.forEach(function (abId) {
    var ab = t.abilitiesData[abId];
    if (!ab) return;

    var card = document.createElement("div");
    card.className = "ability-card";
    card.style.flex = "1";
    card.style.maxWidth = "110px";
    card.style.minWidth = "80px";

    superMode.usedAbilities[pIdx] = superMode.usedAbilities[pIdx] || [];
    if (superMode.usedAbilities[pIdx].indexOf(abId) !== -1) {
      card.classList.add("used");
    }
    if (superMode.activeAbility === abId) {
      card.classList.add("active-perk");
    }

    card.innerHTML =
      '<div class="card-header cat-' + ab.cat + '">' + ab.emoji + ' ' + ab.cat.toUpperCase() + '</div>' +
      '<div style="padding:4px;text-align:center;font-size:11px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + ab.name + '</div>';

    card.onclick = function (e) {
      e.stopPropagation();
      superMode.usedAbilities[pIdx] = superMode.usedAbilities[pIdx] || [];
      if (superMode.usedAbilities[pIdx].indexOf(abId) !== -1) return;

      if (network.isActive) {
        if (network.isHost && pIdx !== 0) return;
        if (!network.isHost && pIdx !== 1) return;
      }

      Sfx.click(settings.sound);
      Haptic.trigger("medium");

      if (superMode.activeAbility === abId) {
        superMode.activeAbility = null;
        showToast("\u0421\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430");
      } else {
        superMode.activeAbility = abId;
        showToast("\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u043E: " + ab.name + ". \u041D\u0430\u0436\u043C\u0438 \u043D\u0430 \u043A\u043B\u0435\u0442\u043A\u0443!");

        // Blitzkrieg (id: 6) — instant, no cell selection
        if (abId === 6) {
          superMode.usedAbilities[pIdx] = superMode.usedAbilities[pIdx] || [];
          superMode.usedAbilities[pIdx].push(6);
          superMode.activeAbility = null;
          moveHistory.push({ idx: -1, p: pIdx });
          showToast("\uD83D\uDC5F \u0411\u043B\u0438\u0446\u043A\u0440\u0438\u0433! +1 \u0425\u043E\u0434");
        }
      }
      renderGame();
      renderAbilitiesBar();
    };
    DOM.gameAbilitiesBar.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────────
   GAME: START
   ───────────────────────────────────────────────────── */
function startNewGame() {
  board    = Array(settings.size * settings.size).fill("");
  moveHistory  = [];
  gameOver = false;
  winLine  = [];
  saveGameData();
  renderGame();
  go("game");
}

/* ─────────────────────────────────────────────────────
   GAME: RENDER (batched, single-pass DOM build)
   ───────────────────────────────────────────────────── */
function renderGame() {
  var t   = I18N[settings.lang];
  var bEl = DOM.board;

  bEl.style.gridTemplateColumns = "repeat(" + settings.size + ", 1fr)";
  bEl.style.gridTemplateRows    = "repeat(" + settings.size + ", 1fr)";

  var gap = settings.size > 6 ? 4 : 7;
  bEl.style.gap = gap + "px";

  var fs = Math.max(14, 54 - settings.size * 3.5);
  bEl.style.setProperty("--cell-fs", fs + "px");

  // Build all cells in a document fragment (zero layout thrashing)
  var frag = document.createDocumentFragment();

  for (var idx = 0; idx < board.length; idx++) {
    var val = board[idx];
    var c = document.createElement("div");
    c.className = "cell";

    if (val) {
      var sp = document.createElement("span");
      var displayVal = val;
      if (val === "X") displayVal = settings.sym1;
      else if (val === "O") displayVal = settings.sym2;
      else if (val === "\u25B3") displayVal = settings.sym3;
      else if (val === "\u25A1") displayVal = settings.sym4;

      sp.className   = "sym sym" + val;
      sp.textContent = displayVal;
      c.appendChild(sp);
    }

    if (winLine.indexOf(idx) !== -1) c.classList.add("cellWin");
    if (gameOver || val) c.classList.add("cellDisabled");

    // Frozen cell visual
    if (superMode.frozenCells && superMode.frozenCells[idx] && superMode.frozenCells[idx] > 0) {
      c.classList.add("cellFrozen");
      c.classList.add("cellDisabled");
    }

    (function (cellIdx) {
      c.onclick = function () {
        // P2P turn validation by symbol (Host=X, Guest=O)
        if (network.isActive) {
          var currentSymbol = SYMBOLS[moveHistory.length % getPlayersCount()];
          if (network.isHost && currentSymbol !== "X") {
            showToast("\u0421\u0435\u0439\u0447\u0430\u0441 \u0445\u043E\u0434 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430!");
            return;
          }
          if (!network.isHost && currentSymbol !== "O") {
            showToast("\u0421\u0435\u0439\u0447\u0430\u0441 \u0445\u043E\u0434 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430!");
            return;
          }
        }
        executeCellClick(cellIdx, true);
      };
    })(idx);

    frag.appendChild(c);
  }

  bEl.innerHTML = "";
  bEl.appendChild(frag);

  // Turn info
  var curP  = moveHistory.length % getPlayersCount();
  var pName = getPlayerName(curP);

  if (gameOver) {
    if (winLine.length) {
      DOM.turnTitle.textContent = t.win + " " + getPlayerName(SYMBOLS.indexOf(board[winLine[0]]));
    } else {
      DOM.turnTitle.textContent = t.draw;
    }
  } else {
    DOM.turnTitle.textContent = t.turn(pName);
  }

  DOM.turnSub.textContent = t.sub(settings.size, settings.goal);
  DOM.btnUndo.disabled     = (moveHistory.length === 0 || gameOver);
  DOM.btnUndo.style.opacity = DOM.btnUndo.disabled ? "0.45" : "1";

  renderAbilitiesBar();
}

/* ─────────────────────────────────────────────────────
   GAME: CELL CLICK (ability execution matrix)
   ───────────────────────────────────────────────────── */
function executeCellClick(idx, isLocal) {
  isLocal = isLocal !== false;

  if (settings.matchMode === "super" && superMode.activeAbility !== null) {
    var pIdx = moveHistory.length % getPlayersCount();
    var abilityUsed = superMode.activeAbility;
    superMode.usedAbilities[pIdx] = superMode.usedAbilities[pIdx] || [];

    // Thor's Strike (id: 0)
    if (superMode.activeAbility === 0) {
      if (board[idx] !== "") {
        board[idx] = "";
        superMode.usedAbilities[pIdx].push(0);
        superMode.activeAbility = null;
        showToast("\uD83D\uDCA5 \u041A\u043B\u0435\u0442\u043A\u0430 \u0432\u044B\u0436\u0436\u0435\u043D\u0430!");
        if (isLocal && network.isActive && network.conn && network.conn.open) {
          var pkt = { type: "MOVE", cellIndex: idx, abilityId: abilityUsed };
          pushNetLog("OUT", pkt);
          network.conn.send(pkt);
        }
        renderGame();
        return;
      }
      return;
    }

    // Hacking (id: 1)
    if (superMode.activeAbility === 1) {
      if (board[idx] !== "" && board[idx] !== SYMBOLS[pIdx]) {
        board[idx] = SYMBOLS[pIdx];
        superMode.usedAbilities[pIdx].push(1);
        superMode.activeAbility = null;
        showToast("\uD83D\uDD04 \u0424\u0438\u0433\u0443\u0440\u0430 \u0432\u0437\u043B\u043E\u043C\u0430\u043D\u0430!");
        if (isLocal && network.isActive && network.conn && network.conn.open) {
          var pkt2 = { type: "MOVE", cellIndex: idx, abilityId: abilityUsed };
          pushNetLog("OUT", pkt2);
          network.conn.send(pkt2);
        }
        renderGame();
        return;
      }
      return;
    }

    return;
  }

  makeMove(idx, isLocal);
}

/* ─────────────────────────────────────────────────────
   GAME: MAKE MOVE
   ───────────────────────────────────────────────────── */
function makeMove(idx, isLocal) {
  isLocal = isLocal !== false;
  if (gameOver || board[idx]) return;

  // Check frozen cells
  if (superMode.frozenCells && superMode.frozenCells[idx] && superMode.frozenCells[idx] > 0) return;

  Sfx.pop(settings.sound);
  Haptic.trigger("light");

  var pIdx  = moveHistory.length % getPlayersCount();
  board[idx] = SYMBOLS[pIdx];
  moveHistory.push({ idx: idx, p: pIdx });

  // Decrement frozen cell counters
  if (superMode.frozenCells) {
    var frozenKeys = Object.keys(superMode.frozenCells);
    for (var fi = 0; fi < frozenKeys.length; fi++) {
      superMode.frozenCells[frozenKeys[fi]]--;
      if (superMode.frozenCells[frozenKeys[fi]] <= 0) {
        delete superMode.frozenCells[frozenKeys[fi]];
      }
    }
  }

  if (isLocal && network.isActive && network.conn && network.conn.open) {
    var pkt = {
      type: "MOVE",
      cellIndex: idx,
      abilityId: superMode.activeAbility
    };
    pushNetLog("OUT", pkt);
    network.conn.send(pkt);
  }

  checkWinCondition();
  saveGameData();
  renderGame();

  // AI's turn
  if (!gameOver && settings.mode === "ai" && getPlayersCount() === 2) {
    if ((moveHistory.length % 2) === 1) {
      setTimeout(function () {
        // AI Super Mode: evaluate abilities using localized simulation
        if (settings.matchMode === "super") {
          var botDecks = superMode.playerDecks[1] || [];
          superMode.usedAbilities[1] = superMode.usedAbilities[1] || [];
          var usedAb = superMode.usedAbilities[1];

          var hasThor = botDecks.indexOf(0) !== -1 && usedAb.indexOf(0) === -1;
          var hasHack = botDecks.indexOf(1) !== -1 && usedAb.indexOf(1) === -1;

          if (hasThor || hasHack) {
            // p0Threat simulation inside localized loop (no structural mutation)
            var p0Threat = false;
            for (var ti = 0; ti < board.length; ti++) {
              if (board[ti] === "") {
                var savedVal = board[ti];
                board[ti] = SYMBOLS[0];
                if (checkWinSimple(board, settings.size, settings.goal)) p0Threat = true;
                board[ti] = savedVal;
              }
            }

            var abilityFired = false;

            // Hack logic — simulate inside localized loop
            if (hasHack && !abilityFired) {
              for (var hi = 0; hi < board.length; hi++) {
                if (board[hi] === SYMBOLS[0]) {
                  var savedHack = board[hi];
                  board[hi] = SYMBOLS[1];
                  var wouldWin = checkWinSimple(board, settings.size, settings.goal);
                  board[hi] = savedHack;
                  if (wouldWin || p0Threat) {
                    superMode.activeAbility = 1;
                    executeCellClick(hi, false);
                    abilityFired = true;
                    break;
                  }
                }
              }
            }

            // Thor logic
            if (hasThor && !abilityFired && p0Threat) {
              var p0Cells = [];
              for (var thi = 0; thi < board.length; thi++) {
                if (board[thi] === SYMBOLS[0]) p0Cells.push(thi);
              }
              if (p0Cells.length > 0) {
                var cellToDestroy = p0Cells[Math.floor(Math.random() * p0Cells.length)];
                superMode.activeAbility = 0;
                executeCellClick(cellToDestroy, false);
              }
            }
          }
        }

        var aiMove = getBotMove(board, settings, SYMBOLS);
        if (aiMove !== -1) makeMove(aiMove, false);
      }, 400);
    }
  }
}

/* ─────────────────────────────────────────────────────
   GAME: UNDO (skips Blitzkrieg idx:-1 entries)
   ───────────────────────────────────────────────────── */
function doUndo() {
  if (!moveHistory.length) return;

  var last = moveHistory.pop();
  if (last.idx !== -1) board[last.idx] = "";

  // In AI mode undo two moves (player + AI)
  if (settings.mode === "ai" && moveHistory.length > 0) {
    var last2 = moveHistory.pop();
    if (last2.idx !== -1) board[last2.idx] = "";
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
  var res = checkWinFull(board, settings.size, settings.goal);
  if (res.win) {
    gameOver = true;
    winLine  = res.line;
    Sfx.win(settings.sound);
    Haptic.trigger("heavy");
    Confetti.start();

    settings.gamesPlayed = (settings.gamesPlayed || 0) + 1;
    var myIdx = network.isActive ? (network.isHost ? 0 : 1) : 0;
    if (board[winLine[0]] === SYMBOLS[myIdx]) {
      settings.gamesWon = (settings.gamesWon || 0) + 1;
      if (settings.mode === "ai") {
        settings.pveXp = (settings.pveXp || 0) + 20;
        if (settings.pveXp >= 100) {
          settings.pveLevel = (settings.pveLevel || 1) + 1;
          settings.pveXp = 0;
          setTimeout(function () {
            showToast("Level Up! New Level: " + settings.pveLevel);
            Confetti.start();
          }, 800);
        }
      }
    } else {
      Sfx.lose(settings.sound);
    }
    saveSettings(settings);
  } else {
    // Check draw — count non-empty cells (accounting for Blitzkrieg phantom entries)
    var filledCells = 0;
    for (var di = 0; di < board.length; di++) {
      if (board[di] !== "") filledCells++;
    }
    if (filledCells === board.length) {
      gameOver = true;
      settings.gamesPlayed = (settings.gamesPlayed || 0) + 1;
      saveSettings(settings);
    }
  }
}

/* ─────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────── */
function getPlayersCount() {
  var m = MODES.find(function (m2) { return m2.id === settings.mode; });
  return m ? m.players : 2;
}

function getPlayerName(idx) {
  // Mirrored Identity Layout: local client always position 1
  if (network.isActive) {
    if (network.isHost) {
      return idx === 0
        ? "\uD83D\uDC51 \u0418\u0433\u0440\u043E\u043A 1 (\u0412\u044B)"
        : "\u26A1 \u0418\u0433\u0440\u043E\u043A 2 (\u0421\u043E\u043F\u0435\u0440\u043D\u0438\u043A)";
    } else {
      return idx === 1
        ? "\uD83D\uDC51 \u0418\u0433\u0440\u043E\u043A 1 (\u0412\u044B)"
        : "\u26A1 \u0418\u0433\u0440\u043E\u043A 2 (\u0421\u043E\u043F\u0435\u0440\u043D\u0438\u043A)";
    }
  }
  if (idx === 0) return "\uD83D\uDC51 " + settings.p1;
  if (idx === 1) return settings.mode === "ai" ? "\uD83E\uDD16 AI" : "\u26A1 " + settings.p2;
  if (idx === 2) return settings.p3;
  if (idx === 3) return settings.p4;
  return "Player";
}

function updateStatsUI() {
  var t = I18N[settings.lang];
  if (!DOM.lblStatsTitle) return;

  DOM.lblStatsTitle.textContent = t.statsTitle;
  var played  = settings.gamesPlayed || 0;
  var won     = settings.gamesWon || 0;
  var winrate = played > 0 ? Math.round((won / played) * 100) : 0;

  DOM.statTotal.textContent   = t.statsTotal + " " + played;
  DOM.statWins.textContent    = t.statsWins + " " + won;
  DOM.statWinrate.textContent = t.statsWinrate + " " + winrate + "%";
}

function updateCareerUI() {
  var t = I18N[settings.lang];
  if (!DOM.lblCareerTitle || !DOM.lblCareerXp || !DOM.careerProgressFill) return;

  var lvl = settings.pveLevel || 1;
  var xp  = settings.pveXp || 0;

  DOM.lblCareerTitle.textContent = t.careerTitle + ": " + lvl;
  DOM.lblCareerXp.textContent = t.careerXp + " " + xp + "/100";
  DOM.careerProgressFill.style.width = xp + "%";
}

/* ─────────────────────────────────────────────────────
   UI RENDER (batched top-level)
   ───────────────────────────────────────────────────── */
function renderUI() {
  var t = I18N[settings.lang];

  if (DOM.gameVersion) DOM.gameVersion.textContent = "v" + BUILD_VERSION;

  DOM.btnStart.innerHTML = "\u25B6 " + t.start;
  if (DOM.btnInfo && t.btnAbout) DOM.btnInfo.textContent = t.btnAbout;

  DOM.tabHome.textContent       = t.home;
  DOM.tabSettings.textContent   = t.settings;
  DOM.settingsTitle.textContent = t.settings;
  DOM.lblMode.textContent       = t.mode;
  DOM.lblSize.textContent       = t.size;
  DOM.lblGoal.textContent       = t.goal;
  DOM.lblAI.textContent         = t.ai;
  DOM.lblNames.textContent      = t.playersLabel;

  if (DOM.lblMatchMod) DOM.lblMatchMod.textContent = t.lblMatchMod;

  updateStatsUI();
  updateCareerUI();

  var flagMap = { "ru": "\uD83C\uDDF7\uD83C\uDDFA", "en": "\uD83C\uDDFA\uD83C\uDDF8", "uz": "\uD83C\uDDFA\uD83C\uDDFF" };
  if (DOM.btnLangToggle) DOM.btnLangToggle.textContent = flagMap[settings.lang] || "\uD83C\uDDF7\uD83C\uDDFA";

  var themeIconMap = { "light": "\u2600\uFE0F", "dark": "\uD83C\uDF19", "gold": "\uD83D\uDC51" };
  if (DOM.btnThemeToggle) DOM.btnThemeToggle.textContent = themeIconMap[settings.theme] || "\u2600\uFE0F";

  if (DOM.btnSoundToggle) {
    DOM.btnSoundToggle.textContent = settings.sound ? "\uD83D\uDD0A" : "\uD83D\uDD07";
  }

  var txtL = document.querySelector(".theme-txt-light");
  if (txtL) txtL.textContent = t.thLight;
  var txtD = document.querySelector(".theme-txt-dark");
  if (txtD) txtD.textContent = t.thDark;
  var txtG = document.querySelector(".theme-txt-gold");
  if (txtG) txtG.textContent = t.thGold;

  DOM.inpP1.placeholder = t.p1;
  DOM.inpP2.placeholder = t.p2;
  DOM.inpP3.placeholder = t.p3;
  DOM.inpP4.placeholder = t.p4;

  DOM.btnSave.textContent = t.save;
  DOM.btnExit.textContent = t.exit;
  DOM.btnUndo.innerHTML   = "\u21A9 " + t.undo;
  DOM.btnRestart.innerHTML = "\u27F2 " + t.restart;

  renderHomeMeta();
}

/* ─────────────────────────────────────────────────────
   THEME APPLICATION (with Gold revert guard)
   ───────────────────────────────────────────────────── */
function applyTheme() {
  if (settings.theme === "gold" && !isPremiumUnlocked("gold_theme_unlocked")) {
    settings.theme = "light";
    saveSettings(settings);
  }
  document.documentElement.setAttribute("data-theme", settings.theme);
}

/* ─────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────── */
function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add("on");
  setTimeout(function () { DOM.toast.classList.remove("on"); }, 2200);
}

/* ─────────────────────────────────────────────────────
   MODAL CONFIRM
   ───────────────────────────────────────────────────── */
function modalConfirm(txt) {
  return new Promise(function (resolve) {
    var t = I18N[settings.lang];
    DOM.modalTitle.textContent  = t.confirmTitle;
    DOM.modalText.textContent   = txt;
    DOM.modalCancel.textContent = t.cancel;
    DOM.modalOk.textContent     = t.ok;
    DOM.modalCancel.style.display = "";
    DOM.modalBack.classList.add("on");

    var resolved = false;
    function guard(val) {
      return function () {
        if (resolved) return;
        resolved = true;
        Sfx.click(settings.sound);
        DOM.modalBack.classList.remove("on");
        resolve(val);
      };
    }
    DOM.modalOk.onclick     = guard(true);
    DOM.modalCancel.onclick = guard(false);
  });
}

/* ─────────────────────────────────────────────────────
   SAVE GAME STATE (deep-clone snapshot)
   ───────────────────────────────────────────────────── */
function saveGameData() {
  saveGame({
    settingsSnapshot: JSON.parse(JSON.stringify(settings)),
    board: board,
    history: moveHistory,
    gameOver: gameOver
  });
}

/* ─────────────────────────────────────────────────────
   P2P NETWORK ENGINE (Robust WebRTC via PeerJS)
   ───────────────────────────────────────────────────── */
function initP2PNetwork() {
  var urlParams = new URLSearchParams(window.location.search);
  var room = urlParams.get("room");
  if (!room) return;

  network.isHost   = false;
  network.isActive = true;
  network.roomID   = room;

  DOM.netModal.classList.remove("hidden");
  DOM.netStatusTitle.textContent = "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435...";
  DOM.netStatusDesc.textContent  = "\u0418\u0449\u0435\u043C \u0441\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044F \u0438\u0433\u0440\u044B...";
  DOM.btnCopyNetLink.style.display = "none";

  network.peer = new Peer();

  network.peer.on("open", function () {
    var outgoingConn = network.peer.connect(room, { reliable: true });
    network.conn = outgoingConn;
    setupConnection(network.conn);
  });

  network.peer.on("error", function (err) {
    DOM.netStatusTitle.textContent = "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438";
    DOM.netStatusDesc.textContent = (err.type === "peer-unavailable")
      ? "\u041A\u043E\u043C\u043D\u0430\u0442\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0438\u043B\u0438 \u0445\u043E\u0441\u0442 \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F."
      : "\u041E\u0448\u0438\u0431\u043A\u0430: " + err.message;
    DOM.btnCancelNet.textContent = "\u0417\u0430\u043A\u0440\u044B\u0442\u044C";
  });
}

function startNetworkHost() {
  network.isHost   = true;
  network.isActive = true;

  DOM.netModal.classList.remove("hidden");
  DOM.netStatusTitle.textContent = "\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u043A\u043E\u043C\u043D\u0430\u0442\u044B...";
  DOM.netStatusDesc.textContent  = "\u0413\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0435\u043C P2P \u0441\u0441\u044B\u043B\u043A\u0443...";
  DOM.btnCopyNetLink.style.display = "none";
  DOM.btnCancelNet.textContent = "\u041E\u0442\u043C\u0435\u043D\u0430";

  if (!network.peer || network.peer.destroyed) {
    network.peer = new Peer();
  }

  network.peer.on("open", function (id) {
    network.roomID = id;
    DOM.netStatusDesc.textContent = "\u041E\u0436\u0438\u0434\u0430\u0435\u043C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0432\u0442\u043E\u0440\u043E\u0433\u043E \u0438\u0433\u0440\u043E\u043A\u0430...";
    DOM.btnCopyNetLink.style.display = "block";
  });

  // Prevent callback accumulation
  if (network.peer) network.peer.removeAllListeners("connection");
  network.peer.on("connection", function (incomingConn) {
    network.conn = incomingConn;
    setupConnection(network.conn);
  });

  network.peer.on("error", function (err) {
    DOM.netStatusTitle.textContent = "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438";
    DOM.netStatusDesc.textContent = "\u041E\u0448\u0438\u0431\u043A\u0430: " + err.message;
    DOM.btnCopyNetLink.style.display = "none";
  });
}

function setupConnection(conn) {
  conn.on("open", function () {
    DOM.netModal.classList.add("hidden");
    showToast(network.isHost
      ? "\u0418\u0433\u0440\u043E\u043A \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F! \u041D\u0430\u0447\u0438\u043D\u0430\u0435\u043C..."
      : "\u0423\u0441\u043F\u0435\u0448\u043D\u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043A \u0445\u043E\u0441\u0442\u0443!");

    settings.mode = "pvp";

    if (network.isHost) {
      // Host Configuration Broadcasting
      setTimeout(function () {
        if (network.conn && network.conn.open) {
          var pkt = {
            type: "START_CONFIG",
            settings: JSON.parse(JSON.stringify(settings)),
            superDecks: JSON.parse(JSON.stringify(superMode.playerDecks))
          };
          pushNetLog("OUT", pkt);
          network.conn.send(pkt);
        }
      }, 500);

      if (settings.matchMode === "super") {
        DOM.screenHome.classList.add("hidden");
        DOM.screenDraft.classList.remove("hidden");
        startDraftPhase();
      } else {
        startNewGame();
      }
    }
  });

  // Prevent callback accumulation
  conn.removeAllListeners("data");
  conn.on("data", function (data) {
    pushNetLog("IN", data);
    handleNetworkData(data);
  });

  conn.on("close", function () {
    showToast("\u0421\u043E\u043F\u0435\u0440\u043D\u0438\u043A \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F");
    network.isActive = false;
    board = [];
    gameOver = false;
    saveGameData();
    go("home");
  });
}

function handleNetworkData(data) {
  if (!data || !data.type) return;

  if (data.type === "START_CONFIG") {
    // Guest dynamically re-initializes layout based on Host config
    settings.size      = data.settings.size;
    settings.goal      = data.settings.goal;
    settings.matchMode = data.settings.matchMode;
    settings.mode      = "pvp";

    if (data.superDecks && !superMode.playerDecks[0]) {
      superMode.playerDecks = JSON.parse(JSON.stringify(data.superDecks));
    }

    saveSettings(settings);
    syncSettingsForm();

    if (settings.matchMode === "super") {
      DOM.screenHome.classList.add("hidden");
      DOM.screenSettings.classList.add("hidden");
      DOM.screenDraft.classList.remove("hidden");
      startDraftPhase();
    } else {
      startNewGame();
    }
    return;
  }

  if (data.type === "MOVE") {
    if (typeof data.abilityId !== "undefined" && data.abilityId !== null) {
      superMode.activeAbility = data.abilityId;
    }
    executeCellClick(data.cellIndex, false);
    renderGame();
  }

  if (data.type === "DRAFT_SELECT") {
    var pIdx = data.playerIdx;
    superMode.playerDecks[pIdx] = superMode.playerDecks[pIdx] || [];
    if (superMode.playerDecks[pIdx].indexOf(data.abilityId) === -1) {
      superMode.playerDecks[pIdx].push(data.abilityId);
      renderDraftGrid();
    }
  }

  if (data.type === "PLAYER_READY") {
    superMode.playerDecks[data.playerIdx] = data.deck;
    renderDraftGrid();
    return;
  }
}

/* ─────────────────────────────────────────────────────
   ADMIN PANEL — TELEMETRY MONITOR
   ───────────────────────────────────────────────────── */
function refreshAdminMonitor() {
  if (!DOM.adminNetMonitor) return;

  var peerStatus = network.peer
    ? (network.peer.destroyed ? "destroyed" : (network.peer.disconnected ? "disconnected" : "alive"))
    : "null";
  var connStatus = network.conn
    ? (network.conn.open ? "open" : "closed")
    : "null";

  var html = '<div style="font-size:12px;font-family:monospace;color:var(--text);text-align:left;">';
  html += '<b>Room ID:</b> ' + (network.roomID || "\u2014") + '<br>';
  html += '<b>Role:</b> ' + (network.isActive ? (network.isHost ? "HOST" : "GUEST") : "OFFLINE") + '<br>';
  html += '<b>Peer:</b> ' + peerStatus + '<br>';
  html += '<b>Conn:</b> ' + connStatus + '<br>';
  html += '<hr style="border-color:rgba(255,255,255,0.1);margin:6px 0;">';
  html += '<b>Last ' + Math.min(networkLog.length, 10) + ' packets:</b><br>';

  var recent = networkLog.slice(-10).reverse();
  if (recent.length === 0) {
    html += '<i style="opacity:0.5;">No packets yet</i>';
  } else {
    recent.forEach(function (entry) {
      var dir  = entry.dir === "IN" ? "\uD83D\uDCE5" : "\uD83D\uDCE4";
      var type = (entry.data && entry.data.type) ? entry.data.type : "?";
      var time = new Date(entry.ts).toLocaleTimeString();
      html += dir + ' <b>' + type + '</b> @ ' + time + '<br>';
    });
  }
  html += '</div>';
  DOM.adminNetMonitor.innerHTML = html;
}

/* ─────────────────────────────────────────────────────
   BOOTSTRAP — single DOMContentLoaded guard
   ───────────────────────────────────────────────────── */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
