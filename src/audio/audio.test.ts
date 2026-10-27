import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../game/logic";

class Parameter {
  value = 1;
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class Node {
  gain = new Parameter();
  frequency = new Parameter();
  Q = new Parameter();
  threshold = new Parameter();
  ratio = new Parameter();
  connect = vi.fn((node: Node) => node);
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class Context {
  static latest: Context;
  currentTime = 0;
  sampleRate = 8;
  state = "running";
  destination = new Node();
  gains: Node[] = [];
  close = vi.fn(async () => {});
  suspend = vi.fn(async () => {});
  resume = vi.fn(async () => {});
  constructor() { Context.latest = this; }
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createDynamicsCompressor() { return new Node(); }
  createOscillator() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createBufferSource() { return new Node(); }
  createBuffer(_channels: number, frames: number) { return { getChannelData: () => new Float32Array(frames) }; }
}

describe("procedural audio buses", () => {
  let dispose: (() => void) | undefined;
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal("window", { AudioContext: Context });
    vi.stubGlobal("document", { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => { dispose?.(); dispose = undefined; vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("makes both background buses exactly silent while listening, including during TTS", async () => {
    const { audio } = await import("./audio");
    dispose = () => audio.dispose();
    audio.unlock();
    const context = Context.latest;
    const musicDuck = context.gains[2].gain;
    const ambienceDuck = context.gains[4].gain;
    audio.setListening(true);
    expect(musicDuck.value).toBe(0);
    expect(ambienceDuck.value).toBe(0);
    audio.setSpeaking(true);
    expect(musicDuck.value).toBe(0);
    expect(ambienceDuck.value).toBe(0);
    audio.setListening(false);
    expect(musicDuck.value).toBeLessThan(1);
    expect(ambienceDuck.value).toBeLessThan(1);
    expect(musicDuck.value).toBeGreaterThan(0);
    audio.setSpeaking(false);
    expect(musicDuck.value).toBe(1);
    expect(ambienceDuck.value).toBe(1);
  });

  it("applies teacher volumes and crossfades tracks without leaking retired buses", async () => {
    const { audio } = await import("./audio");
    dispose = () => audio.dispose();
    audio.unlock();
    const context = Context.latest;
    audio.configure({ ...DEFAULT_SETTINGS, music: 0, effects: 0 });
    expect(context.gains[1].gain.value).toBe(0);
    expect(context.gains[3].gain.value).toBe(0);
    expect(context.gains[5].gain.value).toBe(0);
    const originalTrack = context.gains.at(-1)!;
    audio.setDistrict("harbor");
    const harborTrack = context.gains.at(-1)!;
    expect(originalTrack.gain.value).toBe(0);
    expect(harborTrack.gain.value).toBe(1);
    context.currentTime = 2;
    await vi.advanceTimersByTimeAsync(60);
    expect(originalTrack.disconnect).toHaveBeenCalledOnce();
    expect(harborTrack.disconnect).not.toHaveBeenCalled();
    audio.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    dispose = undefined;
  });

  it("retains a district chosen before browser audio is unlocked", async () => {
    const { audio } = await import("./audio");
    dispose = () => audio.dispose();
    audio.setDistrict("market");
    audio.unlock();
    const context = Context.latest;
    const count = context.gains.length;
    audio.setDistrict("market");
    expect(context.gains).toHaveLength(count);
    audio.celebrate();
    expect(context.gains).toHaveLength(count + 1);
    audio.celebrate(false);
    expect(context.gains).toHaveLength(count + 2);
  });

  it("keeps backgrounds ducked until both game TTS and external coach speech finish", async () => {
    const { audio } = await import("./audio");
    dispose = () => audio.dispose();
    audio.unlock();
    const musicDuck = Context.latest.gains[2].gain;
    audio.setSpeaking(true);
    audio.setExternalSpeaking(true);
    audio.setSpeaking(false);
    expect(musicDuck.value).toBeLessThan(1);
    audio.setExternalSpeaking(false);
    expect(musicDuck.value).toBe(1);
    audio.setSpeaking(true);
    audio.setExternalSpeaking(true);
    audio.setExternalSpeaking(false);
    expect(musicDuck.value).toBeLessThan(1);
    audio.setSpeaking(false);
    expect(musicDuck.value).toBe(1);
  });
});
