/**
 * LocalStorage wrapper for settings and game state.
 */

export const STORE_KEY = "ttt_settings_liquid";
export const GAME_KEY  = "ttt_game_liquid";
export const BUILD_VERSION = "2026.01.20.FixUI";

export function defaultSettings() {
  return {
    lang: "ru",
    theme: "light",
    mode: "pvp",
    size: 3,
    goal: 3,
    ai: "expert",
    p1: "Игрок 1",
    p2: "Игрок 2",
    p3: "Игрок 3",
    p4: "Игрок 4",
    sound: true
  };
}

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s) return { ...defaultSettings(), ...s };
  } catch(e) {}
  return defaultSettings();
}

export function saveSettings(settings) {
  localStorage.setItem(STORE_KEY, JSON.stringify(settings));
}

export function loadGame() {
  try {
    return JSON.parse(localStorage.getItem(GAME_KEY));
  } catch(e) {
    return null;
  }
}

export function saveGame(gameState) {
  localStorage.setItem(GAME_KEY, JSON.stringify({
    version: BUILD_VERSION,
    ...gameState
  }));
}
