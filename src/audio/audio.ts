/**
 * Procedural Web Audio, adapted from Monster Island's oscillator/noise engine.
 * No sound files or network. A single scheduler owns the music and ambience.
 */
import type { DistrictId } from "../game/content/ids";
import type { Settings } from "../game/logic";
import { tts } from "./tts";

export type SfxName = "pickup" | "give" | "trade" | "correct" | "tryAgain"
  | "lockClick" | "chestOpen" | "fireworks" | "micOn" | "micOff" | "tap"
  | "footstep" | "journal";
type Tune = DistrictId | "celebrate";
interface Track { tune: Tune; bus: GainNode; next: number; step: number; retireAt?: number }
interface ToneOptions {
  bus?: AudioNode; peak?: number; decay?: number; attack?: number;
  type?: OscillatorType; to?: number;
}
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);
const unit = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const MUSIC: Record<Tune, { bpm: number; melody: number[]; roots: number[]; type: OscillatorType }> = {
  square: { bpm: 94, melody: [76,0,79,0,81,79,76,0,74,0,72,0,74,76,72,0], roots: [48,41,43,48], type: "sine" },
  market: { bpm: 110, melody: [72,0,76,79,0,76,79,0,74,0,77,81,0,79,74,0], roots: [48,45,41,43], type: "triangle" },
  school: { bpm: 78, melody: [84,0,0,88,0,0,86,0,84,0,0,79,0,0,81,0], roots: [48,41,48,43], type: "sine" },
  harbor: { bpm: 88, melody: [76,0,79,0,0,81,79,0,74,0,0,76,0,72,0,0], roots: [48,43,45,41], type: "triangle" },
  festival: { bpm: 112, melody: [72,0,76,0,79,0,84,79,77,0,81,0,79,76,72,0], roots: [48,41,43,48], type: "triangle" },
  celebrate: { bpm: 120, melody: [72,0,76,0,79,0,84,0,83,79,0,76,79,0,84,0], roots: [48,41,43,48], type: "triangle" }
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private musicDuck: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private ambienceDuck: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private waves: GainNode | null = null;
  private waveSource: AudioBufferSourceNode | null = null;
  private noise: AudioBuffer | null = null;
  private tracks: Track[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private unsubscribe: (() => void) | undefined;
  private district: DistrictId = "square";
  private celebrating = false;
  private speaking = false;
  private externalSpeaking = false;
  private listening = false;
  private musicVolume = 0.6;
  private effectsVolume = 0.8;
  private nextAmbience = 0;
  private ambienceStep = 0;
  private readonly visibility = () => {
    if (!this.ctx) return;
    const transition = document.hidden ? this.ctx.suspend() : this.ctx.resume();
    void transition.catch(() => {});
  };

  /** Call within Start/tap. Unsupported Web Audio leaves subtitles/UI intact. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      try { this.ctx = new Ctx(); } catch { return; }
      const ctx = this.ctx;
      const master = ctx.createGain();
      master.gain.value = 0.8;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 4;
      master.connect(compressor).connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicDuck = ctx.createGain();
      this.musicBus.connect(this.musicDuck).connect(master);
      this.ambienceBus = ctx.createGain();
      this.ambienceDuck = ctx.createGain();
      this.ambienceBus.connect(this.ambienceDuck).connect(master);
      this.effectsBus = ctx.createGain();
      this.effectsBus.connect(master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      let last = 0;
      for (let index = 0; index < data.length; index++) {
        last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
        data[index] = last * 1.6;
      }
      this.speaking = tts.isSpeaking();
      this.unsubscribe = tts.onSpeakingChange((speaking) => this.setSpeaking(speaking));
      this.applyVolumes();
      this.startWaves();
      this.changeTune();
      this.timer = setInterval(() => this.schedule(), 60);
      document.addEventListener("visibilitychange", this.visibility);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
  }

  configure(settings: Settings): void {
    this.musicVolume = unit(settings.music);
    this.effectsVolume = unit(settings.effects);
    this.applyVolumes();
  }
  setDistrict(district: DistrictId): void {
    if (this.district === district) return;
    this.district = district;
    this.changeTune();
    this.updateWaves();
  }
  /** Celebration loops until explicitly cleared; district selection is retained. */
  celebrate(on = true): void {
    if (this.celebrating === on) return;
    this.celebrating = on;
    this.changeTune();
  }
  setSpeaking(on: boolean): void { this.speaking = on; this.applyDuck(); }
  /** Pronunciation coach owns browser speech outside the main TTS wrapper. */
  setExternalSpeaking(on: boolean): void { this.externalSpeaking = on; this.applyDuck(); }
  setListening(on: boolean): void { this.listening = on; this.applyDuck(); }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    this.musicBus?.gain.setTargetAtTime(this.musicVolume * 0.35, time, 0.03);
    this.ambienceBus?.gain.setTargetAtTime(this.effectsVolume * 0.2, time, 0.03);
    this.effectsBus?.gain.setTargetAtTime(this.effectsVolume * 0.8, time, 0.03);
    this.applyDuck();
  }
  private applyDuck(): void {
    if (!this.ctx) return;
    for (const [bus, duck] of [[this.musicDuck, 0.24], [this.ambienceDuck, 0.35]] as const) {
      if (!bus) continue;
      bus.gain.cancelScheduledValues(this.ctx.currentTime);
      // Exact silence from the start of listening; a fade has an audible tail.
      if (this.listening) bus.gain.setValueAtTime(0, this.ctx.currentTime);
      else bus.gain.setTargetAtTime(this.speaking || this.externalSpeaking ? duck : 1, this.ctx.currentTime, 0.06);
    }
  }
  private tone(frequency: number, time: number, options: ToneOptions = {}): void {
    const ctx = this.ctx;
    const bus = options.bus ?? this.effectsBus;
    if (!ctx || !bus) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const attack = options.attack ?? 0.006;
    const end = time + attack + (options.decay ?? 0.24);
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, time);
    if (options.to) oscillator.frequency.exponentialRampToValueAtTime(options.to, end);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.peak ?? 0.12), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(bus);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time);
    oscillator.stop(end + 0.02);
  }
  private noiseBurst(time: number, frequency: number, peak: number, decay: number, bus?: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.effectsBus) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0002, peak), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    source.connect(filter).connect(gain).connect(bus ?? this.effectsBus);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(time, 0, decay + 0.03);
  }
  play(name: SfxName): void {
    if (this.ctx?.state !== "running") return;
    const time = this.ctx.currentTime + 0.008;
    const notes = (sequence: number[], gap = 0.08, peak = 0.12) =>
      sequence.forEach((note, index) => this.tone(midi(note), time + index * gap, { peak, type: "triangle" }));
    switch (name) {
      case "pickup": notes([84,91]); this.noiseBurst(time, 2200, 0.04, 0.09); break;
      case "give": notes([76,79]); this.noiseBurst(time, 900, 0.06, 0.2); break;
      case "trade": notes([72,79,76,84]); break;
      case "correct": notes([79,84], 0.11); break;
      case "tryAgain": notes([67,64], 0.16, 0.045); break;
      case "lockClick": this.noiseBurst(time, 2100, 0.08, 0.055); notes([81], 0.1, 0.05); break;
      case "chestOpen": notes([60,64,67,72,76,84], 0.1); this.noiseBurst(time, 500, 0.1, 0.5); break;
      case "fireworks":
        for (let index = 0; index < 5; index++) {
          this.noiseBurst(time + index * 0.28, 500 + index * 250, 0.13, 0.45);
          this.tone(midi(84 + index * 2), time + index * 0.28 + 0.08, { peak: 0.07, decay: 0.6 });
        }
        break;
      case "micOn": this.tone(880, time, { to: 1320, peak: 0.07, decay: 0.07 }); break;
      case "micOff": this.tone(1100, time, { to: 700, peak: 0.05, decay: 0.07 }); break;
      case "tap": this.tone(1250, time, { peak: 0.04, decay: 0.025 }); break;
      case "footstep": this.noiseBurst(time, 250, 0.025, 0.055); break;
      case "journal": this.noiseBurst(time, 2400, 0.04, 0.14); notes([79,83,86], 0.07, 0.05); break;
    }
  }

  private changeTune(): void {
    if (!this.ctx || !this.musicBus) return;
    const time = this.ctx.currentTime;
    for (const track of this.tracks) {
      if (track.retireAt !== undefined) continue;
      track.bus.gain.cancelScheduledValues(time);
      track.bus.gain.setTargetAtTime(0, time, 0.3);
      track.retireAt = time + 1.5;
    }
    const bus = this.ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.musicBus);
    bus.gain.setTargetAtTime(1, time, 0.3);
    this.tracks.push({ tune: this.celebrating ? "celebrate" : this.district, bus, next: time + 0.04, step: 0 });
  }
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    this.tracks = this.tracks.filter((track) => {
      if (track.retireAt !== undefined && ctx.currentTime >= track.retireAt) {
        track.bus.disconnect();
        return false;
      }
      return true;
    });
    for (const track of this.tracks) {
      const piece = MUSIC[track.tune];
      const eighth = 30 / piece.bpm;
      if (track.next < ctx.currentTime - 0.3) track.next = ctx.currentTime;
      while (track.next < ctx.currentTime + 0.2) {
        const step = track.step++;
        const note = piece.melody[step % piece.melody.length];
        const root = piece.roots[Math.floor(step / 8) % piece.roots.length];
        if (note) {
          this.tone(midi(note), track.next, { bus: track.bus, type: piece.type, peak: 0.1, decay: track.tune === "school" ? 1.1 : 0.36 });
          if (track.tune === "square" || track.tune === "school")
            this.tone(midi(note) * 2.01, track.next, { bus: track.bus, peak: 0.025, decay: 0.13 });
        }
        if (step % 4 === 0) this.tone(midi(root), track.next, { bus: track.bus, type: "triangle", peak: 0.09, decay: eighth * 2 });
        if (track.tune === "festival" || track.tune === "celebrate") {
          if (step % 4 === 0) this.tone(110, track.next, { bus: track.bus, to: 48, peak: 0.18, decay: 0.18 });
          if (step % 2 === 1) this.noiseBurst(track.next, 4200, 0.035, 0.05, track.bus);
        }
        track.next += eighth;
      }
    }
    if (ctx.currentTime >= this.nextAmbience) {
      this.nextAmbience = ctx.currentTime + 1.4;
      this.ambient();
    }
  }
  private startWaves(): void {
    if (!this.ctx || !this.noise || !this.ambienceBus) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    this.waves = this.ctx.createGain();
    source.connect(filter).connect(this.waves).connect(this.ambienceBus);
    source.start();
    this.waveSource = source;
    this.updateWaves();
  }
  private updateWaves(): void {
    if (this.ctx && this.waves) this.waves.gain.setTargetAtTime(this.district === "harbor" ? 0.55 : 0, this.ctx.currentTime, 0.5);
  }
  private ambient(): void {
    if (!this.ctx || !this.ambienceBus || this.listening) return;
    const time = this.ctx.currentTime + 0.01;
    const step = this.ambienceStep++;
    if (this.district === "market") {
      // Wordless murmur, never English that could become a recognition answer.
      for (let index = 0; index < 3; index++)
        this.tone(190 + Math.random() * 160, time + index * 0.13, { bus: this.ambienceBus, peak: 0.025, attack: 0.06, decay: 0.15 });
    } else if (this.district === "school" && step % 18 === 0) {
      this.tone(midi(84), time, { bus: this.ambienceBus, peak: 0.08, decay: 1.5 });
      this.tone(midi(84) * 2.7, time, { bus: this.ambienceBus, peak: 0.015, decay: 0.7 });
    } else if (step % 3 === 0) {
      const gull = this.district === "harbor";
      for (let index = 0; index < 2; index++)
        this.tone(gull ? 1250 : 2200 + Math.random() * 500, time + index * 0.15, {
          bus: this.ambienceBus, to: gull ? 800 : 2900, peak: 0.04, decay: gull ? 0.25 : 0.09
        });
    }
  }
  /** Releases all timers, subscriptions, looping nodes and the browser context. */
  dispose(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.visibility);
    this.waveSource?.stop();
    this.waveSource = null;
    this.tracks.forEach((track) => track.bus.disconnect());
    this.tracks = [];
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
    this.musicBus = this.musicDuck = this.ambienceBus = this.ambienceDuck = this.effectsBus = this.waves = null;
    this.noise = null;
    this.listening = false;
    this.externalSpeaking = false;
  }
}

export const audio = new AudioEngine();
