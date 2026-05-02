import type { ParticleConfig, ParticleType } from './themes';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  phase: number;
}

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private config: ParticleConfig | null = null;
  private rafId: number | null = null;
  private running = false;
  private density = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private resize = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  private handleVisibility = () => {
    if (document.hidden) {
      this.pause();
    } else if (this.config) {
      this.resume();
    }
  };

  setConfig(config: ParticleConfig | null, density = 1) {
    this.config = config;
    this.density = density;
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (config) {
      this.spawnInitial();
      this.resume();
    } else {
      this.pause();
    }
  }

  setDensity(density: number) {
    this.density = density;
    if (this.config) {
      const target = Math.floor(this.config.count * density);
      while (this.particles.length > target) this.particles.pop();
      while (this.particles.length < target) this.particles.push(this.createParticle(true));
    }
  }

  private pickColor(): string {
    const colors = this.config!.colors;
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private createParticle(scatter = false): Particle {
    const cfg = this.config!;
    const size = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
    const x = Math.random() * this.canvas.width;
    const y = scatter ? Math.random() * this.canvas.height : -size * 2;

    let vx = (Math.random() - 0.5) * cfg.speedX * 2;
    let vy = cfg.speedY * (0.4 + Math.random() * 0.6);

    const t = cfg.type as ParticleType;
    if (t === 'rain') {
      vx = (Math.random() - 0.5) * 1.5;
      vy = cfg.speedY * (0.8 + Math.random() * 0.2);
    } else if (t === 'blizzard') {
      vx = -cfg.speedX * (0.6 + Math.random() * 0.4);
      vy = cfg.speedY * (0.4 + Math.random() * 0.6);
    } else if (t === 'stars' || t === 'sparkles') {
      vx = 0;
      vy = 0;
    } else if (t === 'fireflies') {
      vx = (Math.random() - 0.5) * 0.6;
      vy = (Math.random() - 0.5) * 0.6;
    } else if (t === 'bats') {
      const dir = Math.random() > 0.5 ? 1 : -1;
      vx = dir * cfg.speedX * (0.5 + Math.random() * 0.5);
      vy = (Math.random() - 0.5) * 0.4;
    }

    return {
      x: t === 'bats' ? (Math.random() > 0.5 ? -size * 3 : this.canvas.width + size * 3) : x,
      y: scatter ? Math.random() * this.canvas.height : y,
      vx,
      vy,
      size,
      opacity: cfg.opacity * (0.5 + Math.random() * 0.5),
      color: this.pickColor(),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.08,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private spawnInitial() {
    if (!this.config) return;
    const count = Math.floor(this.config.count * this.density);
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  private update() {
    if (!this.config) return;
    const t = Date.now() / 1000;
    const type = this.config.type as ParticleType;
    const target = Math.floor(this.config.count * this.density);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (type === 'fireflies') {
        p.vx += Math.sin(t * 0.7 + p.phase) * 0.035;
        p.vy += Math.cos(t * 0.5 + p.phase + 1.3) * 0.035;
        p.vx *= 0.97;
        p.vy *= 0.97;
      } else if (type === 'snow' || type === 'blizzard') {
        p.vx += Math.sin(t * 0.8 + p.phase) * 0.018;
      } else if (type === 'bats') {
        p.vy = Math.sin(t * 1.8 + p.phase) * 0.6;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      if (type === 'stars' || type === 'sparkles') {
        // static, no movement
      } else if (type === 'fireflies') {
        if (p.x < -40) p.x = this.canvas.width + 40;
        if (p.x > this.canvas.width + 40) p.x = -40;
        if (p.y < -40) p.y = this.canvas.height + 40;
        if (p.y > this.canvas.height + 40) p.y = -40;
      } else if (type === 'bats') {
        if (p.vx > 0 && p.x > this.canvas.width + 60) {
          this.particles.splice(i, 1);
          continue;
        }
        if (p.vx < 0 && p.x < -60) {
          this.particles.splice(i, 1);
          continue;
        }
      } else {
        if (p.y > this.canvas.height + 20) {
          this.particles.splice(i, 1);
          continue;
        }
        if (p.x < -60) p.x = this.canvas.width + 60;
        if (p.x > this.canvas.width + 60) p.x = -60;
      }
    }

    // Spawn new particles to maintain count
    if (type !== 'stars' && type !== 'sparkles' && type !== 'fireflies') {
      while (this.particles.length < target) {
        this.particles.push(this.createParticle(false));
      }
    }
    // Spawn bats occasionally
    if (type === 'bats' && this.particles.length < target) {
      this.particles.push(this.createParticle(false));
    }
  }

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.config) return;

    const type = this.config.type as ParticleType;
    const glow = this.config.glow;
    const glowRadius = this.config.glowRadius ?? 8;
    const t = Date.now() / 1000;

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;

      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = glowRadius;
      }

      if (type === 'snow' || type === 'blizzard') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

      } else if (type === 'rain') {
        const len = p.vy * 0.6;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.6, p.y - len);
        ctx.stroke();

      } else if (type === 'petals' || type === 'sakura' || type === 'flowers') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

      } else if (type === 'fireflies') {
        const pulse = (Math.sin(t * 2.2 + p.phase) + 1) * 0.5;
        ctx.globalAlpha = p.opacity * (0.35 + pulse * 0.65);
        ctx.shadowBlur = glowRadius * (0.4 + pulse * 0.8);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.7 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fill();

      } else if (type === 'stars' || type === 'sparkles') {
        const pulse = (Math.sin(t * 1.6 + p.phase) + 1) * 0.5;
        ctx.globalAlpha = p.opacity * (0.15 + pulse * 0.85);
        ctx.shadowBlur = glowRadius * (0.3 + pulse * 0.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fill();

      } else if (type === 'confetti') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation + t * p.rotationSpeed * 10);
        ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);

      } else if (type === 'leaves') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.6, p.size * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();

      } else if (type === 'bats') {
        const wingFlap = Math.sin(t * 8 + p.phase) * 0.35;
        ctx.translate(p.x, p.y);
        if (p.vx < 0) ctx.scale(-1, 1);
        ctx.fillStyle = p.color;

        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.35, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.25, -p.size * 0.4);
        ctx.lineTo(-p.size * 0.35, -p.size * 0.85);
        ctx.lineTo(-p.size * 0.1, -p.size * 0.5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.size * 0.25, -p.size * 0.4);
        ctx.lineTo(p.size * 0.35, -p.size * 0.85);
        ctx.lineTo(p.size * 0.1, -p.size * 0.5);
        ctx.fill();

        // Left wing
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.3, 0);
        ctx.bezierCurveTo(
          -p.size * 1.2, -p.size * (0.6 + wingFlap),
          -p.size * 1.8, p.size * 0.3,
          -p.size * 0.35, p.size * 0.35,
        );
        ctx.fill();

        // Right wing
        ctx.beginPath();
        ctx.moveTo(p.size * 0.3, 0);
        ctx.bezierCurveTo(
          p.size * 1.2, -p.size * (0.6 + wingFlap),
          p.size * 1.8, p.size * 0.3,
          p.size * 0.35, p.size * 0.35,
        );
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private loop = () => {
    this.update();
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  pause() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resume() {
    if (!this.running && this.config) {
      this.running = true;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  destroy() {
    this.pause();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }
}
