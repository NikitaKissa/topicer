type AudioCtor = typeof AudioContext;

export class SlotSound {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private noiseBuf: AudioBuffer | null = null;
    private lastTick = 0;
    private on = true;

    get enabled(): boolean { return this.on; }
    setEnabled(value: boolean): void { this.on = value; }

    unlock(): void {
        if (!this.ctx) {
            const Ctor: AudioCtor | undefined =
                window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
            if (!Ctor) return;
            this.ctx = new Ctor();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.5;
            this.master.connect(this.ctx.destination);
        }
        void this.ctx.resume();
    }

    lever(): void {
        if (!this.ready()) return;
        this.tone(170, 55, 0.2, "sine", 0.6);
        this.noise(0.05, 0.35, 1800);
    }

    tick(): void {
        const ctx = this.ready();
        if (!ctx || ctx.currentTime - this.lastTick < 0.035) return;
        this.lastTick = ctx.currentTime;
        const pitch = 1150 * (0.96 + Math.random() * 0.08);
        this.tone(pitch, pitch * 0.7, 0.03, "triangle", 0.22);
    }

    land(): void {
        if (!this.ready()) return;
        this.tone(130, 45, 0.22, "sine", 0.7);
        this.noise(0.08, 0.3, 900);
    }

    win(): void {
        if (!this.ready()) return;
        [1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, f, 0.5, "sine", 0.18, 0.07 * i));
    }

    private ready(): AudioContext | null {
        return this.on && this.ctx && this.ctx.state !== "closed" ? this.ctx : null;
    }

    private tone(f0: number, f1: number, dur: number, type: OscillatorType, peak: number, delay = 0): void {
        const ctx = this.ctx!;
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(this.master!);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    private noise(dur: number, peak: number, freq: number): void {
        const ctx = this.ctx!;
        if (!this.noiseBuf) {
            this.noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
            const data = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        const t = ctx.currentTime;
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = this.noiseBuf;
        filter.type = "bandpass";
        filter.frequency.value = freq;
        gain.gain.setValueAtTime(peak, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter).connect(gain).connect(this.master!);
        src.start(t);
        src.stop(t + dur);
    }
}
