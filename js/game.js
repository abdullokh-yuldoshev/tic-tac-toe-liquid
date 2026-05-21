import { Sfx } from './audio.js';
import { Haptic } from './haptic.js';
import { Confetti } from './confetti.js';
import { loadSettings, saveSettings, loadGame, saveGame } from './storage.js';
import { checkWinFull, getBotMove } from './ai.js';

const I18N = {
  ru: {
    home:"Главная", settings:"Настройки", start:"Начать игру", save:"Сохранить",
    applied:"Настройки применены",
    lang:"Язык", theme:"Тема", 
    themeLight:"Светлая", themeDark:"Тёмная", themeGold:"Золотая",
    sound:"Звук", soundOn:"Включен", soundOff:"Выключен",
    mode:"Режим", size:"Размер поля", goal:"Цель (в ряд)", ai:"Сложность ИИ",
    aiEasy:"Лёгкая (Ошибается)", aiNormal:"Нормальная", aiHard:"Сложная", aiExpert:"Непобедимый",
    p1:"Игрок 1", p2:"Игрок 2", p3:"Игрок 3", p4:"Игрок 4",
    playersLabel:"Имена игроков",
    modePVP:"1 vs 1", modeAI:"1 vs AI", mode3:"3 Игрока", mode4:"4 Игрока",
    exit:"Выйти", undo:"Отмена", restart:"Заново",
    turn:(n,s)=>`Ход: ${n}`,
    sub:(sz,g)=>`${sz}×${sz} • Цель: ${g}`,
    play:"Игра идёт", win:"Победа!", draw:"Ничья",
    confirmTitle: "Подтверждение",
    confirmExit:"Выйти в меню?", confirmNew:"Начать заново?",
    ok:"Да", cancel:"Нет"
  },
  en: {
    home:"Home", settings:"Settings", start:"Start", save:"Save",
    applied:"Applied",
    lang:"Language", theme:"Theme", 
    themeLight:"Light", themeDark:"Dark", themeGold:"Gold",
    sound:"Sound", soundOn:"On", soundOff:"Off",
    mode:"Mode", size:"Size", goal:"Goal", ai:"AI Level",
    aiEasy:"Easy (Mistakes)", aiNormal:"Normal", aiHard:"Hard", aiExpert:"Unbeatable",
    p1:"Player 1", p2:"Player 2", p3:"Player 3", p4:"Player 4",
    playersLabel:"Player Names",
    modePVP:"1 vs 1", modeAI:"1 vs AI", mode3:"3 Players", mode4:"4 Players",
    exit:"Exit", undo:"Undo", restart:"Restart",
    turn:(n,s)=>`Turn: ${n}`,
    sub:(sz,g)=>`${sz}×${sz} • Goal: ${g}`,
    play:"Playing", win:"Winner!", draw:"Draw",
    confirmTitle: "Confirm",
    confirmExit:"Exit to menu?", confirmNew:"Restart game?",
    ok:"Yes", cancel:"No"
  },
  uz: {
    home:"Bosh sahifa", settings:"Sozlamalar", start:"Boshlash", save:"Saqlash",
    applied:"Saqlandi",
    lang:"Til", theme:"Mavzu", 
    themeLight:"Yorug‘", themeDark:"Qorong‘i", themeGold:"Oltin",
    sound:"Ovoz", soundOn:"Yonilgan", soundOff:"O‘chirilgan",
    mode:"Rejim", size:"O‘lcham", goal:"Maqsad", ai:"AI Darajasi",
    aiEasy:"Oson (Xato qiladi)", aiNormal:"O‘rta", aiHard:"Qiyin", aiExpert:"Yengilmas",
    p1:"1-o‘yinchi", p2:"2-o‘yinchi", p3:"3-o‘yinchi", p4:"4-o‘yinchi",
    playersLabel:"O‘yinchilar",
    modePVP:"1 vs 1", modeAI:"1 vs AI", mode3:"3 Kishi", mode4:"4 Kishi",
    exit:"Chiqish", undo:"Bekor", restart:"Qayta",
    turn:(n,s)=>`Navbat: ${n}`,
    sub:(sz,g)=>`${sz}×${sz} • Maqsad: ${g}`,
    play:"O‘yin", win:"G‘alaba!", draw:"Durang",
    confirmTitle: "Tasdiqlash",
    confirmExit:"Chiqasizmi?", confirmNew:"Qayta boshlash?",
    ok:"Ha", cancel:"Yo‘q"
  }
};

const MODES = [
  {id:"pvp", key:"modePVP", players:2, ai:false},
  {id:"ai",  key:"modeAI",  players:2, ai:true},
  {id:"p3",  key:"mode3",   players:3, ai:false},
  {id:"p4",  key:"mode4",   players:4, ai:false}
];

const AI_LEVELS = [
  {id:"easy", key:"aiEasy"},
  {id:"normal", key:"aiNormal"},
  {id:"hard", key:"aiHard"},
  {id:"expert", key:"aiExpert"}
];

const THEMES = [
  {id:"light", key:"themeLight"},
  {id:"dark", key:"themeDark"},
  {id:"gold", key:"themeGold"}
];

const SYMBOLS = ["X","O","△","□"];

// SVG Icons
const iconSpk = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const iconSpkOff = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51c.66-1.24 1.03-2.65 1.03-4.15 0-4.28-2.99-7.86-7-8.76v2.06c2.89.86 5 3.54 5 6.7zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

// DOM Elements
const $ = id => document.getElementById(id);
const screenHome = $("screenHome");
const screenSettings = $("screenSettings");
const screenGame = $("screenGame");

// State
let settings = loadSettings();
let board = [];
let history = [];
let gameOver = false;
let winLine = [];

function init() {
  Confetti.init('confettiCanvas');
  applyTheme();
  renderUI();
  
  // Event Listeners
  $("btnStart").onclick = () => { Sfx.click(settings.sound); Haptic.trigger('light'); startNewGame(); };
  $("tabHome").onclick = () => { Sfx.click(settings.sound); go("home"); };
  $("tabSettings").onclick = () => { Sfx.click(settings.sound); go("settings"); };
  $("tabHome2").onclick = () => { Sfx.click(settings.sound); go("home"); };
  $("tabSettings2").onclick = () => { Sfx.click(settings.sound); go("settings"); };
  
  $("btnSave").onclick = () => { Sfx.click(settings.sound); Haptic.trigger('medium'); saveAndApply(); };
  
  $("btnSoundToggle").onclick = () => {
     settings.sound = !settings.sound;
     Sfx.click(settings.sound);
     renderUI();
     saveSettings(settings);
  };
  
  $("selLang").onchange = () => { settings.lang = $("selLang").value; renderUI(); syncSettingsForm(); };
  $("selTheme").onchange = () => { settings.theme = $("selTheme").value; applyTheme(); };
  $("selSize").onchange = rebuildGoalSelect;
  
  $("btnExit").onclick = async () => {
    Sfx.click(settings.sound);
    if(await modalConfirm(I18N[settings.lang].confirmExit)) {
      board = []; gameOver = false; 
      saveGameData(); 
      go("home");
    }
  };
  
  $("btnRestart").onclick = async () => {
     Sfx.click(settings.sound);
     if(await modalConfirm(I18N[settings.lang].confirmNew)) startNewGame();
  };
  
  $("btnUndo").onclick = () => {
    Sfx.click(settings.sound); Haptic.trigger('light');
    doUndo();
  };
  
  // Try loading saved game
  const g = loadGame();
  if (g && g.board && g.board.length > 0 && !g.gameOver) {
    board = g.board; history = g.history; gameOver = g.gameOver;
    settings = g.settingsSnapshot;
    renderGame();
    go("game");
  } else {
    go("home");
  }
}

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

function renderHomeMeta() {
  const t = I18N[settings.lang];
  const m = MODES.find(x => x.id === settings.mode);
  $("homeMeta").textContent = `${t[m.key]} • ${settings.size}x${settings.size}`;
}

function syncSettingsForm() {
  $("selLang").value = settings.lang;
  
  const t = I18N[settings.lang];

  const selTheme = $("selTheme");
  selTheme.innerHTML = "";
  THEMES.forEach(th => {
      const opt = document.createElement("option");
      opt.value = th.id;
      opt.textContent = t[th.key];
      selTheme.appendChild(opt);
  });
  selTheme.value = settings.theme;
  
  const chipsDiv = $("modeChips");
  chipsDiv.innerHTML = "";
  MODES.forEach(m => {
    const b = document.createElement("div");
    b.className = "chip" + (settings.mode === m.id ? " chipOn" : "");
    b.textContent = t[m.key];
    b.onclick = () => { 
      Sfx.click(settings.sound); Haptic.trigger('light');
      settings.mode = m.id; 
      syncSettingsForm(); 
    };
    chipsDiv.appendChild(b);
  });

  const selSize = $("selSize");
  if(selSize.options.length === 0) {
      for(let i=3; i<=10; i++) {
         const opt = document.createElement("option");
         opt.value = i; opt.textContent = `${i}x${i}`;
         selSize.appendChild(opt);
      }
  }
  selSize.value = settings.size;
  rebuildGoalSelect();
  
  const selAI = $("selAI");
  selAI.innerHTML = "";
  AI_LEVELS.forEach(lvl => {
      const opt = document.createElement("option");
      opt.value = lvl.id;
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

function rebuildGoalSelect() {
  const sz = parseInt($("selSize").value);
  const selGoal = $("selGoal");
  selGoal.innerHTML = "";
  
  for(let i=3; i<=sz; i++) {
     const opt = document.createElement("option");
     opt.value = i; opt.textContent = i;
     selGoal.appendChild(opt);
  }
  
  if(settings.goal <= sz && settings.goal >= 3) selGoal.value = settings.goal;
  else selGoal.value = Math.min(sz, 5); 
}

function saveAndApply() {
  settings.lang = $("selLang").value;
  settings.theme = $("selTheme").value;
  
  const chips = $("modeChips").children;
  for(let i=0; i<chips.length; i++) {
     if(chips[i].classList.contains("chipOn")) settings.mode = MODES[i].id;
  }

  settings.size = parseInt($("selSize").value);
  settings.goal = parseInt($("selGoal").value);
  settings.ai = $("selAI").value;
  
  settings.p1 = $("inpP1").value.trim() || "Player 1";
  settings.p2 = $("inpP2").value.trim() || "Player 2";
  settings.p3 = $("inpP3").value.trim() || "Player 3";
  settings.p4 = $("inpP4").value.trim() || "Player 4";

  saveSettings(settings);
  renderUI();
  showToast(I18N[settings.lang].applied);
}

function startNewGame() {
  board = Array(settings.size * settings.size).fill("");
  history = [];
  gameOver = false;
  winLine = [];
  saveGameData();
  renderGame();
  go("game");
}

function renderGame() {
  const t = I18N[settings.lang];
  const bEl = $("board");
  
  bEl.style.gridTemplateColumns = `repeat(${settings.size}, 1fr)`;
  bEl.style.gridTemplateRows = `repeat(${settings.size}, 1fr)`;
  
  const gap = settings.size > 6 ? 4 : 8;
  bEl.style.gap = gap + "px";

  const fs = Math.max(16, 54 - settings.size * 3.5);
  bEl.style.setProperty("--cell-fs", fs + "px");
  
  bEl.innerHTML = "";
  
  board.forEach((val, idx) => {
    const c = document.createElement("div");
    c.className = "cell";
    if (val) {
      const sp = document.createElement("span");
      sp.className = "sym sym" + val; 
      sp.textContent = val;
      c.appendChild(sp);
    }
    if (winLine.includes(idx)) c.classList.add("cellWin");
    if (gameOver || val) c.classList.add("cellDisabled");
    
    c.onclick = () => makeMove(idx);
    bEl.appendChild(c);
  });

  const curP = history.length % getPlayersCount();
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
  
  $("btnUndo").disabled = (history.length === 0 || gameOver);
  $("btnUndo").style.opacity = $("btnUndo").disabled ? 0.5 : 1;
}

function makeMove(idx) {
  if(gameOver || board[idx]) return;
  
  Sfx.pop(settings.sound); 
  Haptic.trigger('light'); 

  const pIdx = history.length % getPlayersCount();
  board[idx] = SYMBOLS[pIdx];
  history.push({idx, p: pIdx});
  
  checkWinCondition();
  saveGameData();
  renderGame();
  
  if(!gameOver && settings.mode === "ai" && getPlayersCount() === 2) {
     if( (history.length % 2) === 1 ){
        setTimeout(() => {
          const aiMove = getBotMove(board, settings, SYMBOLS);
          if (aiMove !== -1) makeMove(aiMove);
        }, 400);
     }
  }
}

function doUndo() {
  if(!history.length) return;
  const last = history.pop();
  board[last.idx] = "";
  
  if(settings.mode === "ai" && history.length > 0) {
     const last2 = history.pop();
     board[last2.idx] = "";
  }
  
  gameOver = false; 
  winLine = [];
  saveGameData();
  renderGame();
}

function checkWinCondition() {
  const res = checkWinFull(board, settings.size, settings.goal);
  if (res.win) {
     gameOver = true; 
     winLine = res.line;
     
     Sfx.win(settings.sound);
     Haptic.trigger('heavy');
     Confetti.start();
  } else if (history.length === settings.size * settings.size) {
     gameOver = true;
  }
}

function getPlayersCount() {
   return MODES.find(m => m.id === settings.mode).players;
}

function getPlayerName(idx) {
   if(idx === 0) return settings.p1;
   if(idx === 1) return settings.p2;
   if(idx === 2) return settings.p3;
   if(idx === 3) return settings.p4;
   return "Player";
}

function renderUI() {
   const t = I18N[settings.lang];
   $("btnStart").innerHTML = "▶ " + t.start;
   $("tabHome").textContent = t.home;
   $("tabSettings").textContent = t.settings;
   $("tabHome2").textContent = t.home;
   $("tabSettings2").textContent = t.settings;
   $("settingsTitle").textContent = t.settings;
   $("lblLang").textContent = t.lang;
   $("lblTheme").textContent = t.theme;
   $("lblMode").textContent = t.mode;
   $("lblSize").textContent = t.size;
   $("lblGoal").textContent = t.goal;
   $("lblAI").textContent = t.ai;
   $("lblNames").textContent = t.playersLabel;
   
   $("lblSound").textContent = t.sound;
   $("soundStatusText").textContent = settings.sound ? t.soundOn : t.soundOff;
   $("soundIcon").innerHTML = settings.sound ? iconSpk : iconSpkOff;
   
   $("inpP1").placeholder = t.p1;
   $("inpP2").placeholder = t.p2;
   $("inpP3").placeholder = t.p3;
   $("inpP4").placeholder = t.p4;
   
   $("btnSave").textContent = t.save;
   
   renderHomeMeta();
}

function applyTheme() {
   document.documentElement.setAttribute("data-theme", settings.theme);
}

function showToast(msg) {
   const t = $("toast");
   t.textContent = msg;
   t.classList.add("on");
   setTimeout(() => t.classList.remove("on"), 2000);
}

function modalConfirm(txt) {
   return new Promise(resolve => {
      const t = I18N[settings.lang];
      $("modalTitle").textContent = t.confirmTitle; 
      $("modalText").textContent = txt;
      $("modalCancel").textContent = t.cancel;
      $("modalOk").textContent = t.ok;

      $("modalBack").classList.add("on");
      
      $("modalOk").onclick = () => { 
          Sfx.click(settings.sound); 
          $("modalBack").classList.remove("on"); resolve(true); 
      };
      $("modalCancel").onclick = () => { 
          Sfx.click(settings.sound); 
          $("modalBack").classList.remove("on"); resolve(false); 
      };
   });
}

function saveGameData() {
  saveGame({
    settingsSnapshot: settings,
    board,
    history,
    gameOver
  });
}

// Start application
init();
