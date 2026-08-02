import { describe, expect, it } from 'vitest';
import {
  CARDS_PAYOUT,
  CARDS_WIN,
  DRINKS,
  FLUSH_DAYS,
  FLUSH_ROBBERY_FACTOR,
  LABOURER_WEEK,
  NEW_CHUM_ODDS_FACTOR,
  OWN_HOUSE_SHOUT_FACTOR,
  PARLOUR_ODDS_FACTOR,
  PROVISIONS_CEILING,
  PROVISIONS_FLOOR,
  PROVISIONS_WEEK,
  TWOUP_WIN,
  RECEPTION_FEARED_NOTORIETY,
  RECEPTION_FIELDS_OWN,
  RECEPTION_KNOWN,
  RECEPTION_RESPECTED,
  SHOUT_CAP_DAYS,
  SHOUT_HEADS,
  SHOUT_HEAD_COST,
  SHOUT_STANDING,
  SPREE_COST,
  SPREE_STANDING,
} from '../src/engine/constants';
import { variantsOf } from '../src/content/say';
import { AGITATION_STORIES } from '../src/content/library';
import { flushFactor, pursuitTick } from '../src/engine/events';
import { getView } from '../src/engine/menus';
import { provisionsPrice, provisionsNote } from '../src/engine/market';
import { pounds, shillings } from '../src/engine/money';
import { Log } from '../src/engine/narrate';
import { makeRng } from '../src/engine/rng';
import { step } from '../src/engine/reduce';
import {
  drinkAt,
  headsPresent,
  oddsFactor,
  parlourOpen,
  receptionLine,
  receptionTier,
  rumourTier,
  shoutTheBar,
  venueFor,
} from '../src/engine/shamrock';
import { createInitialState } from '../src/engine/state';
import type { GameState } from '../src/engine/types';

function fresh(seed = 7): { state: GameState; rng: ReturnType<typeof makeRng>; log: Log } {
  const state = createInitialState(seed);
  const rng = makeRng(seed);
  return { state, rng, log: new Log(rng) };
}

function atShamrock(seed = 7, standing = 0, notoriety = 0): GameState {
  const { state } = fresh(seed);
  state.location = 'fields-town';
  state.screen = 'ftown-hotel';
  state.standing = standing;
  state.notoriety = notoriety;
  state.moneyPence = pounds(50);
  state.provisionDays = 60;
  return state;
}

// ---------------------------------------------------------------------------
// The room reads you (§30.1)
// ---------------------------------------------------------------------------

describe('reception tiers', () => {
  it('read standing at the boundaries', () => {
    expect(receptionTier(atShamrock(1, 0))).toBe('chum');
    expect(receptionTier(atShamrock(1, RECEPTION_KNOWN - 1))).toBe('chum');
    expect(receptionTier(atShamrock(1, RECEPTION_KNOWN))).toBe('known');
    expect(receptionTier(atShamrock(1, RECEPTION_RESPECTED - 1))).toBe('known');
    expect(receptionTier(atShamrock(1, RECEPTION_RESPECTED))).toBe('respected');
    expect(receptionTier(atShamrock(1, RECEPTION_FIELDS_OWN - 1))).toBe('respected');
    expect(receptionTier(atShamrock(1, RECEPTION_FIELDS_OWN))).toBe('own');
  });

  it('take whichever tale is the taller', () => {
    // Feared at the notoriety threshold, when nothing taller stands against it.
    expect(receptionTier(atShamrock(1, 0, RECEPTION_FEARED_NOTORIETY))).toBe('feared');
    expect(receptionTier(atShamrock(1, 0, RECEPTION_FEARED_NOTORIETY - 1))).toBe('chum');
    // A greater name on the honest ladder outweighs it.
    expect(receptionTier(atShamrock(1, 70, RECEPTION_FEARED_NOTORIETY))).toBe('own');
    expect(receptionTier(atShamrock(1, 30, 45))).toBe('feared');
  });

  it('give every tier and every house a line of its own', () => {
    for (const venue of ['shamrock', 'grogtent']) {
      for (const tier of ['chum', 'known', 'respected', 'own', 'feared']) {
        expect(variantsOf(`${venue}.recv.${tier}`).length).toBeGreaterThan(1);
      }
    }
    const state = atShamrock(3, 65);
    // The greeting must not flicker between two looks at the same screen.
    expect(receptionLine(state)).toBe(receptionLine(state));
    expect(receptionLine(state)).not.toBe(receptionLine({ ...state, day: state.day + 1 }));
  });

  it('put the barman one tier above his own name', () => {
    const state = atShamrock(1, RECEPTION_KNOWN);
    expect(rumourTier(state)).toBe('known');
    state.employment = { job: 'barman', since: 1, daysWorked: 3 };
    expect(rumourTier(state)).toBe('respected');
    expect(parlourOpen(state)).toBe(true);
    // The dark mirror is not improved by pulling ale.
    const feared = atShamrock(1, 0, 50);
    feared.employment = { job: 'barman', since: 1, daysWorked: 3 };
    expect(rumourTier(feared)).toBe('feared');
  });

  it('sharpen the card sharps against a new chum and play the parlour straight', () => {
    expect(oddsFactor(atShamrock(1, 0), shillings(1))).toBeLessThan(1);
    expect(oddsFactor(atShamrock(1, RECEPTION_KNOWN), shillings(1))).toBe(1);
    expect(oddsFactor(atShamrock(1, RECEPTION_RESPECTED), pounds(2))).toBeGreaterThan(1);
    // Small stakes in the yard are still the yard's odds.
    expect(oddsFactor(atShamrock(1, RECEPTION_RESPECTED), shillings(1))).toBe(1);
  });

  it('never lets the house lose on expectation, even at the parlour table', () => {
    // A win at two-up pays the stake; at cards, CARDS_PAYOUT times it. The
    // best odds any man can be dealt are the parlour's — if either game goes
    // positive there, the room is a money pump and not a vice (§30.1).
    const bestOdds = Math.max(1, PARLOUR_ODDS_FACTOR, NEW_CHUM_ODDS_FACTOR);
    expect(TWOUP_WIN * bestOdds * 2 - 1).toBeLessThan(0);
    expect(CARDS_WIN * bestOdds * (1 + CARDS_PAYOUT) - 1).toBeLessThan(0);
  });

  it('open the parlour only to men the corner will sit with', () => {
    expect(parlourOpen(atShamrock(1, RECEPTION_RESPECTED - 1))).toBe(false);
    expect(parlourOpen(atShamrock(1, RECEPTION_RESPECTED))).toBe(true);
    const view = getView(atShamrock(1, RECEPTION_RESPECTED));
    expect(view.screen).toBe('ftown-hotel');
    const gamble = getView({ ...atShamrock(1, RECEPTION_RESPECTED), screen: 'ftown-gamble' });
    expect(gamble.menu.some((m) => m.label.includes('parlour'))).toBe(true);
    const poor = getView({ ...atShamrock(1, 0), screen: 'ftown-gamble' });
    expect(poor.menu.some((m) => m.label.includes('parlour'))).toBe(false);
  });

  it("gives the field's own man the landlord's table once a week, and no oftener", () => {
    const state = atShamrock(11, 70);
    const rng = makeRng(11);
    const log = new Log(rng);
    drinkAt(state, rng, log, 'nobbler');
    expect(state.estate.landlordOn).toBe(state.day);
    const first = state.estate.landlordOn;
    for (let i = 0; i < 4; i++) drinkAt(state, rng, log, 'nobbler');
    expect(state.estate.landlordOn).toBe(first);
  });

  it('sends an informer out after a wanted man, sometimes', () => {
    let informed = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const state = atShamrock(seed, 10, 50);
      state.legal = 'wanted criminal';
      const rng = makeRng(seed * 31);
      drinkAt(state, rng, new Log(rng), 'nobbler');
      if (state.estate.informerUntilDay > 0) informed += 1;
    }
    expect(informed).toBeGreaterThan(0);
    expect(informed).toBeLessThan(30); // 4% a visit, not a certainty
  });

  it('never sends an informer after an honest man', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const state = atShamrock(seed, 50);
      const rng = makeRng(seed);
      drinkAt(state, rng, new Log(rng), 'nobbler');
      expect(state.estate.informerUntilDay).toBe(0);
    }
  });

  it('lets an admirer warn the man who never robbed a digger', () => {
    let warned = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const state = atShamrock(seed, 10, 55);
      const rng = makeRng(seed * 7);
      drinkAt(state, rng, new Log(rng), 'nobbler');
      if (state.estate.warnedUntilDay > 0) warned += 1;
    }
    expect(warned).toBeGreaterThan(5);

    // A man who has robbed diggers gets no such friends.
    for (let seed = 1; seed <= 60; seed++) {
      const state = atShamrock(seed, 10, 55);
      state.diggersRobbed = 2;
      const rng = makeRng(seed * 7);
      drinkAt(state, rng, new Log(rng), 'nobbler');
      expect(state.estate.warnedUntilDay).toBe(0);
    }
  });
});

describe('what follows a night out', () => {
  it('brings the traps inside three days of an informer’s word', () => {
    const state = atShamrock(21, 5, 55);
    state.legal = 'wanted criminal';
    state.estate.informerUntilDay = state.day + 3;
    let came = false;
    for (let i = 0; i < 3 && !came; i++) {
      const rng = makeRng(100 + i);
      came = pursuitTick(state, rng, new Log(rng));
      if (!came) state.day += 1;
    }
    expect(came).toBe(true);
    expect(state.estate.informerUntilDay).toBe(0);
  });

  it('turns one pursuit aside on a friend’s warning, and only one', () => {
    const state = atShamrock(22, 5, 55);
    state.legal = 'wanted criminal';
    state.estate.informerUntilDay = state.day; // certain: the last day of the word
    state.estate.warnedUntilDay = state.day + 3;
    const rng = makeRng(5);
    expect(pursuitTick(state, rng, new Log(rng))).toBe(false);
    expect(state.estate.warnedUntilDay).toBe(0);

    state.estate.informerUntilDay = state.day;
    expect(pursuitTick(state, rng, new Log(rng))).toBe(true);
  });

  it('makes a flush man the dearer to rob for seven days', () => {
    const state = atShamrock(23, 20);
    expect(flushFactor(state)).toBe(1);
    state.estate.flushUntilDay = state.day + FLUSH_DAYS;
    expect(flushFactor(state)).toBe(FLUSH_ROBBERY_FACTOR);
    state.day += FLUSH_DAYS + 1;
    expect(flushFactor(state)).toBe(1);
  });

  it('lets the room mind its own man’s pockets, and fleeces the stranger', () => {
    // Over many nights, a new chum can lose the lot; the field's own cannot.
    let chumWorst = 0;
    let ownWorst = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const chum = atShamrock(seed, 0);
      const own = atShamrock(seed, 70);
      const rngA = makeRng(seed * 3);
      const rngB = makeRng(seed * 3);
      const chumBefore = chum.moneyPence;
      const ownBefore = own.moneyPence;
      drinkAt(chum, rngA, new Log(rngA), 'nobbler');
      drinkAt(own, rngB, new Log(rngB), 'nobbler');
      chumWorst = Math.max(chumWorst, chumBefore - chum.moneyPence);
      ownWorst = Math.max(ownWorst, ownBefore - own.moneyPence);
    }
    expect(chumWorst).toBeGreaterThan(pounds(10));
    expect(ownWorst).toBeLessThanOrEqual(pounds(2) + shillings(1));
  });

  it('has a line for every house and every kind of night', () => {
    for (const key of [
      'drink.good.house',
      'drink.bad.house',
      'drink.bad.minded',
      'drink.bad.feared',
      'shamrock.house.shouts',
      'shamrock.admirer',
      'shamrock.informer',
      'shamrock.warned.dodge',
      'shamrock.grog.bad',
      'shamrock.landlord.honest',
      'shout.town',
      'shout.camp',
      'shout.ownhouse',
      'shout.spree',
      'shout.spree.morning',
      'shout.capped',
      'shout.standing',
      'shout.shanty',
      'shout.shanty.alone',
    ]) {
      expect(variantsOf(key).length).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Drink, priced by house (§31.4)
// ---------------------------------------------------------------------------

describe('the drink table', () => {
  it('keeps the Journal’s relativities: port cheapest, sly-grog dearest', () => {
    for (const what of ['nobbler', 'ale', 'bottle'] as const) {
      expect(DRINKS[what].suze).toBeLessThan(DRINKS[what].shamrock);
      expect(DRINKS[what].shamrock).toBeLessThan(DRINKS[what].camp);
    }
    expect(DRINKS.nobbler.shamrock).toBe(shillings(1));
    expect(DRINKS.ale.suze).toBe(4);
    expect(DRINKS.champagne.shamrock).toBe(shillings(30));
  });

  it('charges by the house the player is standing in', () => {
    const state = atShamrock(5, 20);
    const rng = makeRng(5);
    const before = state.moneyPence;
    drinkAt(state, rng, new Log(rng), 'ale');
    expect(before - state.moneyPence).toBeGreaterThanOrEqual(DRINKS.ale.shamrock);

    const camp = atShamrock(5, 20);
    camp.location = 'snakey-gully';
    expect(venueFor(camp)).toBe('camp');
    const rng2 = makeRng(5);
    const spent = camp.moneyPence;
    drinkAt(camp, rng2, new Log(rng2), 'ale');
    expect(spent - camp.moneyPence).toBeGreaterThanOrEqual(DRINKS.ale.camp);
  });

  it('makes the grog tent’s liquor a hazard the Crown & Cradle’s is not', () => {
    let campIll = 0;
    let townIll = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const camp = atShamrock(seed, 20);
      camp.location = 'damp-camp';
      const rngA = makeRng(seed * 13);
      drinkAt(camp, rngA, new Log(rngA), 'nobbler');
      if (camp.illness) campIll += 1;

      const town = atShamrock(seed, 20);
      const rngB = makeRng(seed * 13);
      drinkAt(town, rngB, new Log(rngB), 'nobbler');
      if (town.illness) townIll += 1;
    }
    expect(campIll).toBeGreaterThan(townIll);
  });

  it('costs the evening, through the reducer', () => {
    const state = atShamrock(9, 20);
    const out = step(state, { type: 'drink', what: 'nobbler' }, makeRng(9));
    expect(out.state.day).toBe(state.day + 1);
    expect(out.state.moneyPence).toBeLessThan(state.moneyPence);
  });
});

// ---------------------------------------------------------------------------
// Shouting the bar (§30.2)
// ---------------------------------------------------------------------------

describe('shouting the bar', () => {
  it('charges two shillings a head, and the heads are the house’s', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = atShamrock(seed, 20);
      const rng = makeRng(seed);
      const before = state.moneyPence;
      const out = shoutTheBar(state, rng, new Log(rng), false);
      expect(out.heads).toBeGreaterThanOrEqual(SHOUT_HEADS.town.lo);
      expect(out.heads).toBeLessThanOrEqual(SHOUT_HEADS.town.hi);
      expect(out.cost).toBe(SHOUT_HEAD_COST * out.heads);
      expect(before - state.moneyPence).toBeGreaterThanOrEqual(out.cost);
      expect(out.days).toBe(1);
    }
  });

  it('holds fewer heads in a camp tent than in the town', () => {
    const camp = atShamrock(3, 20);
    camp.location = 'damp-camp';
    const rng = makeRng(3);
    for (let i = 0; i < 20; i++) {
      const heads = headsPresent(camp, rng);
      expect(heads).toBeGreaterThanOrEqual(SHOUT_HEADS.camp.lo);
      expect(heads).toBeLessThanOrEqual(SHOUT_HEADS.camp.hi);
    }
  });

  it('buys standing once in a fortnight and no oftener (§30.3)', () => {
    const state = atShamrock(4, 20);
    const rng = makeRng(4);
    const log = new Log(rng);
    shoutTheBar(state, rng, log, false);
    expect(state.standing).toBe(20 + SHOUT_STANDING);
    expect(state.estate.shoutedOn).toBe(state.day);

    // A second round inside the fortnight is only extravagance.
    const after = state.standing;
    state.day += SHOUT_CAP_DAYS - 1;
    shoutTheBar(state, rng, log, false);
    expect(state.standing).toBe(after);

    // On the fourteenth day it counts again.
    state.day += 1;
    shoutTheBar(state, rng, log, false);
    expect(state.standing).toBe(after + SHOUT_STANDING);
  });

  it('shares the cap between the round and the spree', () => {
    const state = atShamrock(6, 20);
    state.moneyPence = pounds(200);
    const rng = makeRng(6);
    const log = new Log(rng);
    shoutTheBar(state, rng, log, false);
    const after = state.standing;
    shoutTheBar(state, rng, log, true); // the spree, same fortnight
    expect(state.standing).toBe(after);
    state.day += SHOUT_CAP_DAYS;
    shoutTheBar(state, rng, log, true);
    expect(state.standing).toBe(after + SPREE_STANDING);
  });

  it('runs the spree at fifteen to twenty-five pounds, and costs the next day', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = atShamrock(seed, 20);
      state.moneyPence = pounds(100);
      const health = state.health;
      const rng = makeRng(seed);
      const out = shoutTheBar(state, rng, new Log(rng), true);
      expect(out.cost).toBeGreaterThanOrEqual(SPREE_COST.lo);
      expect(out.cost).toBeLessThanOrEqual(SPREE_COST.hi);
      expect(out.days).toBe(2); // the night, and the day that is lost
      expect(state.health).toBeLessThan(health);
      expect(state.estate.flushUntilDay).toBe(state.day + FLUSH_DAYS);
      expect(state.journal.some((j) => j.text.includes('champagne'))).toBe(true);
    }
  });

  it('sells a man his own house at wholesale', () => {
    const plain = atShamrock(8, 45);
    const own = atShamrock(8, 45);
    own.estate.shamrock = true;
    const a = shoutTheBar(plain, makeRng(8), new Log(makeRng(8)), false);
    const b = shoutTheBar(own, makeRng(8), new Log(makeRng(8)), false);
    expect(b.heads).toBe(a.heads);
    expect(b.cost).toBe(Math.round(a.cost * OWN_HOUSE_SHOUT_FACTOR));
  });

  it('buys loyalty and not standing at a man’s own sly-grog shanty', () => {
    const state = atShamrock(12, 50, 60);
    state.location = 'snakey-gully';
    state.estate.shanty = 'snakey-gully';
    state.gang = [
      { name: 'Flash Jack', joined: 1, loyaltyFrac: 0.5 },
      { name: 'Larry the Bull', joined: 1, loyaltyFrac: 0.9 },
    ];
    const standing = state.standing;
    const rng = makeRng(12);
    shoutTheBar(state, rng, new Log(rng), false);
    expect(state.standing).toBe(standing);
    expect(state.estate.shoutedOn).toBe(0);
    expect(state.gang[0].loyaltyFrac).toBeCloseTo(0.6, 5);
    expect(state.gang[1].loyaltyFrac).toBeCloseTo(1, 5); // loyalty never passes one
    expect(state.estate.warnedUntilDay).toBe(state.day + 7);
  });

  it('is refused to a man who cannot pay for it', () => {
    const state = atShamrock(2, 20);
    state.moneyPence = shillings(1);
    const rng = makeRng(2);
    const out = shoutTheBar(state, rng, new Log(rng), false);
    expect(out.days).toBe(0);
    expect(state.moneyPence).toBe(shillings(1));
  });

  it('has no room to shout on the road', () => {
    const state = atShamrock(2, 20);
    state.location = 'on-road';
    const rng = makeRng(2);
    expect(shoutTheBar(state, rng, new Log(rng), false).days).toBe(0);
  });

  it('leaves the town knowing he is flush, and thieves the dearer for it', () => {
    const state = atShamrock(14, 30);
    state.moneyPence = pounds(60);
    const rng = makeRng(14);
    shoutTheBar(state, rng, new Log(rng), true);
    expect(state.estate.flushUntilDay).toBeGreaterThanOrEqual(state.day);
    expect(FLUSH_ROBBERY_FACTOR).toBeGreaterThan(1);
  });

  it('prints the Times paragraph while the town still remembers', () => {
    const state = atShamrock(15, 30);
    state.moneyPence = pounds(60);
    const out = step(state, { type: 'shoutBar', spree: true }, makeRng(15));
    const paper = getView({ ...out.state, screen: 'gazette' }).body.join(' ');
    expect(paper).toContain('entertained the town royally');
  });
});

// ---------------------------------------------------------------------------
// Price relativities (§31)
// ---------------------------------------------------------------------------

describe('the price of a week', () => {
  it('never moves at the wharf, where the ships land', () => {
    const state = atShamrock(1, 0);
    state.location = 'suze-port';
    expect(PROVISIONS_WEEK.suze).toBe(shillings(5));
    for (let d = 1; d < 365; d += 11) {
      expect(provisionsPrice({ ...state, day: d })).toBe(shillings(5));
    }
  });

  it('runs from twelve to twenty-five shillings inland, and never outside it', () => {
    const state = atShamrock(1, 0);
    let lowest = Infinity;
    let highest = 0;
    for (const loc of ['fields-town', 'damp-camp', 'snakey-gully'] as const) {
      for (let d = 1; d <= 365; d++) {
        const price = provisionsPrice({ ...state, location: loc, day: d });
        expect(price).toBeGreaterThanOrEqual(PROVISIONS_FLOOR);
        expect(price).toBeLessThanOrEqual(PROVISIONS_CEILING);
        lowest = Math.min(lowest, price);
        highest = Math.max(highest, price);
      }
    }
    expect(lowest).toBeLessThan(highest); // the season is felt
  });

  it('is dearer in summer than in the mild months, and dearer again in a rush', () => {
    const state = atShamrock(1, 0);
    state.location = 'damp-camp';
    const autumn = provisionsPrice({ ...state, day: 90 }); // April
    const summer = provisionsPrice({ ...state, day: 20 }); // January
    expect(summer).toBeGreaterThan(autumn);

    const rushed = provisionsPrice({
      ...state,
      day: 90,
      rush: { camp: 'damp-camp', untilDay: 120, factor: 1.5, since: 85, base: 1 },
    });
    expect(rushed).toBeGreaterThan(autumn);
  });

  it('never falls to less than twice the wharf price (§31 harness rule)', () => {
    const state = atShamrock(1, 0);
    for (const loc of ['fields-town', 'damp-camp'] as const) {
      for (let d = 1; d <= 365; d += 7) {
        expect(provisionsPrice({ ...state, location: loc, day: d })).toBeGreaterThanOrEqual(
          2 * PROVISIONS_WEEK.suze,
        );
      }
    }
  });

  it('holds its price for the week rather than flickering daily', () => {
    const state = atShamrock(1, 0);
    state.location = 'damp-camp';
    const a = provisionsPrice({ ...state, day: 71 });
    const b = provisionsPrice({ ...state, day: 72 });
    expect(a).toBe(b);
  });

  it('says the faithful words when bread is at five shillings the loaf', () => {
    const state = atShamrock(1, 0);
    state.location = 'snakey-gully';
    let dear: string | undefined;
    for (let d = 1; d <= 365 && !dear; d++) {
      const note = provisionsNote({
        ...state,
        day: d,
        rush: { camp: 'snakey-gully', untilDay: d + 5, factor: 1.5, since: d, base: 1 },
      });
      if (note && note.includes('loaf')) dear = note;
    }
    expect(dear).toBeDefined();
    expect(dear).toContain('five shillings the four-pound loaf');
    expect(dear).toContain('£20 the hundredweight');
    expect(dear).toContain('bucket of water');
  });

  it('keeps the labourer’s five shillings a week in the licence copy (§31.1)', () => {
    const council = getView({ ...atShamrock(1, 0), screen: 'ftown-council' }).body.join(' ');
    expect(council).toContain("labourer's wage is five shillings a week");
    expect(council).toContain('eighteen pounds a year');
    expect(LABOURER_WEEK).toBe(shillings(5));

    const agitation = AGITATION_STORIES.flat().join(' ');
    expect(agitation).toContain('five shillings a week');
  });

  it('marvels at a shepherd’s month in a week (§31.1)', () => {
    const boom = variantsOf('work.boom').join(' ');
    expect(boom).toContain("shepherd's month in a week");
    expect(variantsOf('work.boom').length).toBeGreaterThan(1);
  });
});
