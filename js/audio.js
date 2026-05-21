/**
 * Audio subsystem for Tic-Tac-Toe using Web Audio API.
 */
export const Sfx = {
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
    const osc = this.ctx.createOscillator();
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
