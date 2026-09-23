// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/engine/state';
import type { NarrationEvent } from '../src/engine/types';
import { pageEvents } from '../src/ui/narration';
import { GameAudio, cueForAction, cueForPage, sceneFor } from '../src/ui/sound';

const event = (id: string, tone: NarrationEvent['tone'] = 'neutral'): NarrationEvent => ({ id, tone, text: id });
afterEach(() => vi.unstubAllGlobals());

describe('sound follows the visible story', () => {
  it('does not announce a strike or death from a later page', () => {
    const pages = pageEvents([
      event('travel.walk.day'), event('travel.travellers'), event('travel.walk.day'),
      event('travel.travellers'), event('travel.walk.day'), event('mine.rich', 'good'),
      event('mine.cavein.death', 'grave'),
    ]);
    expect(pages).toHaveLength(3);
    expect(cueForPage(pages[0])).toBe('steps');
    expect(cueForPage(pages[1])).toBe('gold');
    expect(cueForPage(pages[2])).toBe('grave');
  });

  it('does not celebrate a page that also reports injury or loss', () => {
    expect(cueForPage([event('mine.rich', 'good'), event('mine.cavein.injury', 'bad')])).toBe('warning');
    expect(cueForPage([event('mine.rich', 'good'), event('mine.cavein.death', 'grave')])).toBe('grave');
    expect(cueForPage([event('prospect.rich', 'good')])).toBeNull(); // promising ground is not a find
  });

  it('keeps mining methods distinct and a rejected purchase quiet', () => {
    const before = createInitialState(3);
    const after = { ...before, day: before.day + 1 };
    expect(cueForAction({ type: 'mine', method: 'shaft', days: 1 }, before, after)).toBe('pick');
    expect(cueForAction({ type: 'mine', method: 'pan', days: 1 }, before, after)).toBe('water');
    expect(cueForAction({ type: 'mine', method: 'shaft', days: 1 }, before, before)).toBe('paper');
    expect(cueForAction({ type: 'buy', item: 'pan' }, before, before)).toBe('paper');
    expect(cueForAction({ type: 'buy', item: 'pan' }, before, { ...before, moneyPence: 24 })).toBe('coins');
    expect(cueForAction({ type: 'fillWater' }, before, { ...before, waterDays: 7 })).toBe('water');
  });

  it('uses distinct surroundings and leaves the title and ending silent', () => {
    const state = createInitialState(3);
    expect(sceneFor(state)).toBeNull();
    expect(sceneFor({ ...state, screen: 'suze' })).toBe('harbour');
    expect(sceneFor({ ...state, screen: 'suze-store' })).toBe('room');
    expect(sceneFor({ ...state, screen: 'camp', location: 'damp-camp' })).toBe('creek');
    expect(sceneFor({ ...state, screen: 'camp', location: 'deep-mountains' })).toBe('diggings');
    expect(sceneFor({ ...state, screen: 'camp', location: 'secret-mine' })).toBe('bush');
    expect(sceneFor({ ...state, screen: 'ftown', location: 'fields-town' })).toBe('town');
    expect(sceneFor({ ...state, screen: 'camp', gameOver: 'dead' })).toBeNull();
  });
});

describe('optional audio', () => {
  it('stays playable without Web Audio or storage access', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    const audio = new GameAudio();
    expect(audio.available).toBe(false);
    expect(audio.enabled).toBe(false);
    expect(audio.ambienceEnabled).toBe(false);
    expect(() => {
      audio.unlock();
      audio.setScene('harbour');
      audio.page([event('mine.rich', 'good')]);
      audio.toggle();
      audio.toggle();
      audio.destroy();
    }).not.toThrow();
  });

  it('reads and remembers mute without touching a game save', () => {
    const data = new Map([['goldrush.sound', 'off'], ['goldrush.save.1234', 'untouched']]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value) });
    vi.stubGlobal('AudioContext', undefined);
    const audio = new GameAudio();
    expect(audio.enabled).toBe(false);
    audio.toggle();
    expect(data.get('goldrush.sound')).toBe('on');
    expect(data.get('goldrush.save.1234')).toBe('untouched');
    audio.destroy();
  });

  it('keeps ambience opt-in independent of sound and persists both choices', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value) });
    vi.stubGlobal('AudioContext', undefined);
    const audio = new GameAudio();
    expect(audio.enabled).toBe(false);
    expect(audio.ambienceEnabled).toBe(false);
    audio.toggle();
    expect(audio.ambienceEnabled).toBe(false);
    audio.toggleAmbience();
    audio.toggle();
    expect(audio.enabled).toBe(false);
    expect(audio.ambienceEnabled).toBe(true);
    audio.destroy();
    const restored = new GameAudio();
    expect(restored.enabled).toBe(false);
    expect(restored.ambienceEnabled).toBe(true);
    restored.toggleAmbience();
    expect(data.get('goldrush.ambience')).toBe('off');
    restored.destroy();
  });

  it('never creates an audio context until a gesture, and contains device failure', () => {
    const ctor = vi.fn(function () { throw new Error('no audio device'); });
    vi.stubGlobal('AudioContext', ctor);
    vi.stubGlobal('localStorage', { getItem: () => null });
    const audio = new GameAudio();
    audio.setScene('harbour');
    audio.play('coins');
    expect(ctor).not.toHaveBeenCalled();
    audio.unlock();
    expect(ctor).not.toHaveBeenCalled(); // even gestures stay silent until explicit opt-in
    expect(() => audio.toggle()).not.toThrow();
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(audio.available).toBe(false);
    audio.unlock();
    expect(ctor).toHaveBeenCalledTimes(1);
    audio.destroy();
  });
});
