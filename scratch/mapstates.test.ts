/**
 * Not a test: a bench for looking at the map in the states that only turn up
 * after a hard year — a rush on, pegs in two camps, a company at work, a price
 * on your head and a camp of your own beyond the ranges.
 *
 *   npx vitest run --config scratch/vitest.config.ts scratch/mapstates.test.ts
 *
 * Writes scratch/shots-map/states.html, which scratch/mapshots.mjs photographs.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { buildMap } from '../src/ui/map';
import type { GameState } from '../src/engine/types';

function base(): GameState {
  const s = createInitialState(11);
  s.day = 210;
  return s;
}

function outlaw(): GameState {
  const s = base();
  s.location = 'hideout';
  s.legal = 'wanted criminal';
  s.notoriety = 96;
  s.heat = { trickeys: 62, pass: 30 };
  s.hideout = { stashPence: 40_000, stashGold: 900, since: 150 } as never;
  s.intel = { kind: 'escort', untilDay: 220, route: 'trickeys' } as never;
  s.secret = { heard: true, genuine: true, chased: false, fromCamp: 'deep-mountains', heardOn: 90 };
  s.claims['snakey-gully'] = { quality: 90, workedDays: 4, peggedOn: 180, proven: false } as never;
  return s;
}

function digger(): GameState {
  const s = base();
  s.location = 'deep-mountains';
  s.claims['damp-camp'] = { quality: 120, workedDays: 3, peggedOn: 100, proven: false } as never;
  s.claims['snakey-gully'] = { quality: 80, workedDays: 90, peggedOn: 60, proven: false } as never;
  s.rush = { camp: 'snakey-gully', untilDay: 224, factor: 2, since: 200, base: 1 };
  s.company = { ...(createInitialState(2).company ?? {}) } as never;
  s.company = {
    name: 'The Golden Hope Quartz Mining Co.',
    treasury: 12_000,
    sharesOwned: 12,
    sharesPublic: 4,
    sharesUnsold: 4,
    sharePrice: 3360,
    crews: [{ task: 'mine' }],
    leases: [],
    weekProfit: [],
    lastWeekGold: 0,
    foundedOn: 150,
    lastDividendDay: 0,
    battery: false,
    driving: 'ordinary',
    lastWeek: null,
  } as never;
  s.estate = { ...s.estate, shanty: 'damp-camp' } as never;
  return s;
}

function travelling(): GameState {
  const s = base();
  s.location = 'on-road';
  s.journey = {
    route: 'trickeys',
    mode: 'walk',
    daysLeft: 4,
    daysTravelled: 4,
    to: 'fields-town',
    from: 'suze-port',
    salvage: 0,
  };
  return s;
}

it('draws the sheet in every state worth looking at', () => {
  const cases: Array<[string, GameState]> = [
    ['a fresh man at the port', base()],
    ['a digger with pegs, a rush, a shanty and a company', digger()],
    ['a wanted man with a camp of his own', outlaw()],
    ['four days up the road', travelling()],
  ];
  const sheets = cases
    .map(([name, state]) => `<figure><figcaption>${name}</figcaption>${buildMap(state).svg}</figure>`)
    .join('\n');
  mkdirSync('scratch/shots-map', { recursive: true });
  for (const theme of ['paper', 'noir', 'blue']) {
    writeFileSync(
      `scratch/shots-map/states-${theme}.html`,
      `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../src/ui/styles.css">` +
        `<body data-gf-theme="${theme}" style="background:var(--gf-bg);color:var(--gf-body);padding:16px">` +
        `<style>figure{margin:0 0 18px}figcaption{font-family:var(--gf-font);font-size:13px;margin-bottom:4px}` +
        `.gf-chart{width:960px;aspect-ratio:1000/660}</style>${sheets}</body>`,
    );
  }
});
