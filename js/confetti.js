/**
 * Confetti animation system for win state.
 */
export const Confetti = {
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
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },
  
  start() {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    this.particles = [];
    
    const colors = ['#00C6FF', '#0072FF', '#FF9500', '#FF2D55', '#AF52DE'];
    for (let i = 0; i < 100; i++) {
      this.particles.push({
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15 - 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        life: 1.0
      });
    }
    
    if (!this.animId) this.loop();
  },
  
  loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let active = false;
    
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3; // gravity
      p.life -= 0.015;
      
      if (p.life > 0) {
        active = true;
        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x, p.y, p.size, p.size);
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
