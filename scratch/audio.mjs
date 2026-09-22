/** Real-browser audio lifecycle checks; --render also exports the acoustic palette.
 * node scratch/audio.mjs [port or URL] [--render]
 */
import { chromium, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';

const target = process.argv[2] ?? '5175';
const url = /^https?:\/\//.test(target) ? target : `http://localhost:${target}/`;
const browser = await (process.argv.includes('--webkit') ? webkit : chromium).launch();
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};
try {
  const context = await browser.newContext();
  const observeAudio = () => {
    window.audioContexts = [];
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        this.starts = 0;
        window.audioContexts.push(this);
      }
      createGain() {
        const node = super.createGain();
        this.master ??= node;
        return node;
      }
      createOscillator() {
        const source = super.createOscillator();
        const start = source.start.bind(source);
        source.start = (...args) => { this.starts++; start(...args); };
        return source;
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args) => { this.starts++; start(...args); };
        return source;
      }
    };
  };
  await context.addInitScript(observeAudio);
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  check(await page.evaluate(() => window.audioContexts.length === 0), 'no audio context or autoplay before interaction');
  await page.locator('#screen').focus();
  await page.keyboard.press('s');
  await page.waitForTimeout(250);
  check(await page.evaluate(() => localStorage.getItem('goldrush.sound') === 'off' && window.audioContexts.every((c) => c.state === 'suspended' && c.master.gain.value === 0)), 'mute silences the graph and persists');
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator('.gf-menu-item', { hasText: 'Sound: off' }).count() === 1, 'mute survives reload');
  await page.locator('#screen').focus();
  await page.keyboard.press('Space');
  check(await page.evaluate(() => window.audioContexts.length === 0), 'starting a muted game creates no audio context');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.waitForFunction(() => window.audioContexts[0]?.state === 'running' && window.audioContexts[0].starts > 0);
  check(await page.evaluate(() => window.audioContexts.length === 1), 'unmute resumes one context and produces sound');
  // Listen at the actual master bus with an analyser, without routing extra sound.
  await page.evaluate(() => {
    const c = window.audioContexts[0];
    c.meter = c.createAnalyser();
    c.meter.fftSize = 2048;
    c.master.connect(c.meter);
  });
  await page.waitForTimeout(50);
  check(await page.evaluate(() => {
    const c = window.audioContexts[0];
    const data = new Float32Array(2048);
    c.meter.getFloatTimeDomainData(data);
    return data.some((n) => Math.abs(n) > 0.0001);
  }), 'the live sound bus contains audible samples');
  await page.keyboard.press('Escape');
  const dev = await page.evaluate(() => !!window.__gf);
  if (dev) {
    check(await page.evaluate(() => {
      if (!window.__gf) return false;
      const c = window.audioContexts[0];
      const before = c.starts;
      window.__gf.app.render();
      window.__gf.app.render();
      return c.starts === before;
    }), 'redrawing the same narration never replays its cue');
  }
  for (let i = 0; i < 12 && await page.locator('.gf-prompt').count(); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  if ((await page.textContent('.gf-title')).includes('NEW ARRIVALS')) await page.keyboard.press('Space');
  for (let i = 0; i < 12 && await page.locator('.gf-prompt').count(); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.audioContexts.length === 1), 'scene changes reuse the existing audio context');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.audioContexts[0].state === 'suspended');
  check(await page.evaluate(() => window.audioContexts[0].master.gain.value === 0), 'hiding the tab stops both ambience and effects');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check(await page.evaluate(() => window.audioContexts[0].state === 'suspended'), 'returning to the tab stays quiet until interaction');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.audioContexts[0].state === 'running');
  check(true, 'interaction restores audio after tab suspension');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.waitForFunction(() => window.audioContexts[0].state === 'suspended');
  const starts = await page.evaluate(() => window.audioContexts[0].starts);
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  await page.waitForTimeout(300);
  check(await page.evaluate((before) => window.audioContexts[0].starts === before, starts), 'muted page and map interactions create no new voices');

  const mobile = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await mobile.addInitScript(observeAudio);
  const touch = await mobile.newPage();
  touch.on('pageerror', (error) => failures.push(error.message));
  await touch.goto(url, { waitUntil: 'networkidle' });
  await touch.locator('.gf-menu-item', { hasText: 'Begin a new game' }).tap();
  await touch.waitForFunction(() => window.audioContexts[0]?.state === 'running' && window.audioContexts[0].starts > 0);
  check(true, 'a touch gesture starts audio without a keyboard');
  for (let i = 0; i < 12 && await touch.locator('.gf-prompt').count(); i++) await touch.locator('.gf-prompt').tap();
  if ((await touch.textContent('.gf-title')).includes('NEW ARRIVALS')) await touch.locator('.gf-menu-item').first().tap();
  for (let i = 0; i < 12 && await touch.locator('.gf-prompt').count(); i++) await touch.locator('.gf-prompt').tap();
  await touch.locator('.gf-legend-act', { hasText: 'MENU' }).tap();
  await touch.locator('.gf-menu-item', { hasText: 'Sound: on' }).tap();
  await touch.waitForFunction(() => window.audioContexts[0].state === 'suspended');
  check(await touch.evaluate(() => window.audioContexts[0].master.gain.value === 0 && localStorage.getItem('goldrush.sound') === 'off'),
    'the touch menu mutes every sound and remembers the choice');
  await mobile.close();
  if (dev) {
    await page.evaluate(() => window.__gf.app.destroy());
    await page.waitForFunction(() => window.audioContexts[0].state === 'closed');
    check(true, 'unmounting the game releases its audio context');
  }

  if (process.argv.includes('--render')) {
    const rendered = await page.evaluate(async () => {
      const { SoundPalette } = await import('/src/ui/sound-palette.ts');
      const cues = ['paper', 'coins', 'pick', 'water', 'steps', 'hooves', 'gold', 'bell', 'warning', 'grave', 'save', 'bird'];
      const clips = [];
      for (const cue of cues) {
        const ctx = new OfflineAudioContext(1, 48000 * 2, 48000);
        const master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        new SoundPalette(ctx, master).play(cue);
        const buffer = await ctx.startRendering();
        const samples = buffer.getChannelData(0);
        let peak = 0, energy = 0, tail = 0;
        for (let i = 0; i < samples.length; i++) {
          peak = Math.max(peak, Math.abs(samples[i]));
          energy += samples[i] ** 2;
          if (i > samples.length - 4800) tail = Math.max(tail, Math.abs(samples[i]));
        }
        clips.push({ cue, peak, rms: Math.sqrt(energy / samples.length), tail, samples: Array.from(samples) });
      }
      return clips;
    });
    for (const c of rendered) check(c.peak < 0.5 && c.rms > 0.0001 && c.tail < 0.0001,
      `${c.cue}: peak ${c.peak.toFixed(3)}, RMS ${c.rms.toFixed(4)}, clean tail`);
    const count = rendered.reduce((n, c) => n + c.samples.length, 0);
    const wav = Buffer.alloc(44 + count * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
    let offset = 44;
    for (const clip of rendered) for (const sample of clip.samples) {
      wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), offset); offset += 2;
    }
    writeFileSync('/tmp/goldrush-sound-palette.wav', wav);
    console.log('Palette: /tmp/goldrush-sound-palette.wav (one effect every two seconds)');
  }
  await context.close();
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
console.log('Audio checks passed.');
