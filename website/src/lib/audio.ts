export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientNodes: OscillatorNode[] = [];
  private ambientGain: GainNode | null = null;
  private _volume = 0.35;
  private _sfxEnabled = true;
  private _ambientEnabled = false;
  private _currentNotes: number[] = [];

  private getCtx(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._volume;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  get sfxEnabled() { return this._sfxEnabled; }
  get ambientEnabled() { return this._ambientEnabled; }
  get volume() { return this._volume; }

  setSfxEnabled(v: boolean) {
    this._sfxEnabled = v;
  }

  setAmbientEnabled(v: boolean) {
    this._ambientEnabled = v;
    if (v && this._currentNotes.length > 0) {
      this.startAmbient(this._currentNotes);
    } else {
      this.stopAmbient();
    }
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this._volume;
    }
  }

  playClick() {
    if (!this._sfxEnabled) return;
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }

  playHover() {
    if (!this._sfxEnabled) return;
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.frequency.value = 660;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  playSuccess() {
    if (!this._sfxEnabled) return;
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const startAt = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.08, startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.25);
        osc.start(startAt);
        osc.stop(startAt + 0.25);
      });
    } catch {}
  }

  startAmbient(notes: number[]) {
    this._currentNotes = notes;
    if (!this._ambientEnabled) return;
    this.stopAmbient();
    if (notes.length === 0) return;
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0, ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 3);
      this.ambientGain.connect(this.masterGain);

      for (const freq of notes) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(this.ambientGain);
        osc.start();
        this.ambientNodes.push(osc);

        // Second harmonic at half volume for richness
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        g2.gain.value = 0.3;
        osc2.connect(g2);
        g2.connect(this.ambientGain);
        osc2.start();
        this.ambientNodes.push(osc2);
      }
    } catch {}
  }

  stopAmbient() {
    if (this.ambientGain && this.ctx) {
      try {
        this.ambientGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
        const gainToStop = this.ambientGain;
        setTimeout(() => {
          for (const osc of this.ambientNodes) {
            try { osc.stop(); } catch {}
          }
          try { gainToStop.disconnect(); } catch {}
        }, 1600);
      } catch {}
    }
    this.ambientNodes = [];
    this.ambientGain = null;
  }

  suspend() {
    this.ctx?.suspend();
  }

  resume() {
    this.ctx?.resume();
  }
}

export const audioManager = new AudioManager();
