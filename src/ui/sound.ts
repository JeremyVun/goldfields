import type { Action, GameState, NarrationEvent } from '../engine/types';
import type { SoundCue, SoundPalette, SoundScene } from './sound-palette';
export type { SoundCue } from './sound-palette';

const SOUND_KEY = 'goldrush.sound';

/** Only the page being read may announce an outcome, never a future page. */
export function cueForPage(events: readonly NarrationEvent[]): SoundCue | null {
  if (events.some((e) => e.tone === 'grave')) return 'grave';
  if (events.some((e) => e.tone === 'bad')) return 'warning';
  const has = (pattern: RegExp) => events.some((e) => pattern.test(e.id));
  if (has(/^(mine\.(rich|good|shaft\.bonanza|shaft\.bottom\.payable)|prospect\.find|company\.prospect\.strike)$/)) return 'gold';
  if (has(/^hearth\.(wedding|event\.birth)$/)) return 'bell';
  if (has(/^(sell\.(bank|camp|store)|work\.(day|week)|gamble\..*\.win|company\.dividend)$/)) return 'coins';
  if (has(/^travel\.(horse|wagon)\.day$/)) return 'hooves';
  if (has(/^travel\.(walk\.day|depart\.)/)) return 'steps';
  if (has(/^mine\.(shaft\.sink|peg|fossick|dryblow)$/)) return 'pick';
  if (has(/^(intro\.arrival|travel\.arrive\.suze)$/)) return 'bell';
  return null;
}

/** Fallbacks for actions whose result is plain, untagged narration. */
export function cueForAction(action: Action, before: GameState, after: GameState): SoundCue {
  if (action.type === 'save') return 'save';
  if (action.type === 'fillWater' && after.waterDays > before.waterDays) return 'water';
  const paid = after.moneyPence !== before.moneyPence || after.bankPence !== before.bankPence;
  if (paid && ['buy', 'buyProvisions', 'buyGreens', 'buyHorse', 'buyMeal', 'sellItem', 'sellSalvage', 'sellGold', 'deposit', 'withdraw', 'buyLicence'].includes(action.type)) return 'coins';
  const worked = after.day !== before.day || after.yearsPlayed !== before.yearsPlayed;
  if (worked && action.type === 'mine') return ['pan', 'cradle', 'puddle'].includes(action.method) ? 'water' : 'pick';
  if (worked && action.type === 'work') return 'pick';
  if (worked && ['coach', 'travel', 'travelTo'].includes(action.type)) {
    return action.type === 'coach' || (action.type === 'travel' && action.mode !== 'walk') ? 'hooves' : 'steps';
  }
  return 'paper';
}

export function sceneFor(state: GameState): SoundScene | null {
  if (state.gameOver || ['title', 'resume', 'end'].includes(state.screen)) return null;
  if (/store|bank|hospital|company|journal|hearth|cottage|court|gaol/.test(state.screen)) return 'room';
  switch (state.location) {
    case 'suze-port': return 'harbour';
    case 'fields-town': return 'town';
    case 'damp-camp':
    case 'snakey-gully': return 'creek';
    case 'deep-mountains': return 'diggings';
    default: return 'bush';
  }
}

/** Audio is optional presentation. Every failure leaves the game playable. */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private palette: SoundPalette | null = null;
  private loading: Promise<void> | null = null;
  private stopAmbience: (() => void) | null = null;
  private ambientTimer: ReturnType<typeof setTimeout> | null = null;
  private scene: SoundScene | null = null;
  private playingScene: SoundScene | null = null;
  private lastPage: readonly NarrationEvent[] | null = null;
  private lastCueAt = -Infinity;
  private lastCue: SoundCue | null = null;
  private enabledValue = true;
  private disposed = false;
  private failed = false;
  private queued: { cue: SoundCue; at: number } | null = null;
  private readonly onVisibility = (): void => {
    if (document.hidden) this.quiet();
    // Returning to a tab does not start sound until the next interaction.
  };

  constructor() {
    try { this.enabledValue = localStorage.getItem(SOUND_KEY) !== 'off'; } catch { /* Private browsing. */ }
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get enabled(): boolean { return this.enabledValue; }
  get available(): boolean { return !this.failed && typeof AudioContext !== 'undefined'; }

  /** Called synchronously inside a pointer/key gesture, before any await. */
  unlock(): void {
    if (!this.enabled || !this.available || this.disposed || document.hidden) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.context.destination);
      }
      const ctx = this.context;
      const ready = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      if (!this.loading) {
        this.loading = import('./sound-palette').then(({ SoundPalette }) => {
          if (!this.disposed && this.master) this.palette = new SoundPalette(ctx, this.master);
        }).catch(() => { this.failed = true; this.quiet(); });
      }
      void Promise.all([ready, this.loading]).then(() => {
        if (!this.enabled || this.disposed || document.hidden || ctx.state !== 'running') return;
        if (this.master) {
          this.master.gain.cancelScheduledValues(0);
          this.master.gain.value = 0.55;
        }
        this.syncAmbience();
        const queued = this.queued;
        this.queued = null;
        if (queued && performance.now() - queued.at < 500) this.play(queued.cue);
      }).catch(() => { /* Autoplay denied: the next gesture may try again. */ });
    } catch {
      this.failed = true;
      this.quiet();
    }
  }

  toggle(): void {
    this.enabledValue = !this.enabledValue;
    try { localStorage.setItem(SOUND_KEY, this.enabled ? 'on' : 'off'); } catch { /* Session-only preference. */ }
    if (this.enabled) { this.unlock(); this.play('bell'); }
    else this.quiet();
  }

  setScene(scene: SoundScene | null): void {
    this.scene = scene;
    this.syncAmbience();
  }

  page(events: readonly NarrationEvent[], fallback: SoundCue = 'paper'): void {
    if (this.lastPage === events) return;
    this.lastPage = events;
    this.play(cueForPage(events) ?? fallback);
  }

  play(cue: SoundCue): void {
    if (!this.enabled || this.disposed || this.failed || document.hidden) return;
    if (!this.palette || this.context?.state !== 'running') {
      if (this.context) this.queued = { cue, at: performance.now() };
      return;
    }
    const now = performance.now();
    // Rapid page turns produce one quiet gesture, not a pile of overlapping sounds.
    // A closing menu's rustle must not swallow the save stamp or an outcome.
    if (now - this.lastCueAt < 85 && (cue === 'paper' || cue === this.lastCue)) return;
    this.lastCueAt = now;
    this.lastCue = cue;
    try { this.palette.play(cue); } catch { this.failed = true; this.quiet(); }
  }

  private syncAmbience(): void {
    if (!this.palette || !this.enabled || document.hidden || this.context?.state !== 'running') return;
    if (this.playingScene === this.scene) return;
    this.stopBed();
    if (!this.scene) return;
    try {
      this.playingScene = this.scene;
      this.stopAmbience = this.palette.ambience(this.scene);
      this.scheduleDetail();
    } catch { this.failed = true; this.quiet(); }
  }

  private scheduleDetail(): void {
    this.ambientTimer = setTimeout(() => {
      this.ambientTimer = null;
      if (!this.enabled || document.hidden || !this.playingScene || this.context?.state !== 'running') return;
      const cue: SoundCue | null = this.playingScene === 'room' ? null
        : this.playingScene === 'harbour' ? 'bell'
        : this.playingScene === 'town' ? 'hooves'
        : this.playingScene === 'diggings' ? 'pick' : 'bird';
      try { if (cue) this.palette?.play(cue, 0.2); } catch { this.failed = true; this.quiet(); return; }
      this.scheduleDetail();
    }, 8000 + Math.random() * 6000);
  }

  private stopBed(): void {
    if (this.ambientTimer !== null) clearTimeout(this.ambientTimer);
    this.ambientTimer = null;
    try { this.stopAmbience?.(); } catch { /* Audio context already closed. */ }
    this.stopAmbience = null;
    this.playingScene = null;
  }

  private quiet(): void {
    this.queued = null;
    this.stopBed();
    this.palette?.stop();
    if (this.context && this.context.state !== 'closed') {
      if (this.master) {
        this.master.gain.cancelScheduledValues(0);
        this.master.gain.value = 0;
      }
      void this.context.suspend().catch(() => {});
    }
  }

  destroy(): void {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.quiet();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
  }
}
