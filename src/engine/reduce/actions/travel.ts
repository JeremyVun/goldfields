import { COACH_DAYS, COACH_FARE } from '../../constants';
import { endDay } from '../../daily';
import { damage } from '../../health';
import { formatGold, pounds } from '../../money';
import { Log } from '../../narrate';
import type { RNG } from '../../rng';
import { addJournal } from '../../state';
import { beginJourney, localTravelDays } from '../../travel';
import type { Action, GameState, LocationId } from '../../types';
import { screenForLocation } from '../screen';
import { runTask } from '../tasks';

// ---------------------------------------------------------------------------
// The road: routes, the coach, local journeys and the secret working.
// ---------------------------------------------------------------------------

export function chooseRoute(s: GameState, action: Extract<Action, { type: 'chooseRoute' }>): void {
  s.screen = 'travel-mode';
  s.journey = {
    route: action.route,
    mode: 'walk',
    daysLeft: 0,
    daysTravelled: 0,
    to: 'fields-town',
    from: s.location,
    salvage: 0,
  };
}

export function travel(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'travel' }>): void {
  const to: LocationId = s.location === 'suze-port' ? 'fields-town' : 'suze-port';
  s.journey = null;
  if (!beginJourney(s, log, action.route, action.mode, to)) {
    s.screen = screenForLocation(s.location === 'on-road' ? 'suze-port' : s.location);
    return;
  }
  runTask(s, rng, log, { kind: 'travel' });
}

export function coach(s: GameState, rng: RNG, log: Log): void {
  if (s.moneyPence < COACH_FARE) {
    log.raw('Cobb & Co. carry travellers with money, not ordinary diggers.', 'bad');
    return;
  }
  s.moneyPence -= COACH_FARE;
  log.raw(
    'The driver is a Yankee with a long whip, longer pistols and a Bowie knife, and hair enough to frighten a bushranger. The team goes off with mud flying and diggers cursing.',
    'neutral',
  );
  for (let i = 0; i < COACH_DAYS; i++) {
    endDay(s, rng, log, { travelling: true });
    if (s.gameOver || s.endOfYear) return;
  }
  s.location = 'suze-port';
  s.screen = 'suze';
  log.say('travel.arrive.suze', undefined, 'neutral');
}

export function travelTo(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'travelTo' }>): void {
  if (action.place === s.location) {
    log.raw('You are standing in it already.', 'neutral');
    return;
  }
  const days = localTravelDays(s, action.place);
  s.journey = {
    route: 'trickeys',
    mode: s.horse !== 'none' ? 'horse' : 'walk',
    daysLeft: days,
    daysTravelled: 0,
    to: action.place,
    from: s.location,
    salvage: 0,
  };
  s.location = 'on-road';
  runTask(s, rng, log, { kind: 'travel' });
}

export function followRumour(s: GameState, rng: RNG, log: Log): void {
  if (!s.secret) {
    log.raw('There is no such talk about just now.', 'neutral');
    return;
  }
  s.secret.chased = true;
  if (!s.secret.genuine) {
    const wasted = rng.int(3, 7);
    for (let i = 0; i < wasted; i++) {
      endDay(s, rng, log, { travelling: true, toil: true });
      if (s.gameOver || s.endOfYear) return;
    }
    log.say('rumour.hoax', undefined, 'bad');
    addJournal(s, `Chased a hoax for ${wasted} days.`, 'bad');
    s.secret = null;
    return;
  }
  s.secretGenuineUsed = true;
  s.secretExpedition = { trail: 0, daysSearched: 0, nuggetFound: false, exhausted: false };
  log.say('rumour.genuine', undefined, 'good');
  s.journey = {
    route: 'pass',
    mode: s.horse !== 'none' ? 'horse' : 'walk',
    daysLeft: localTravelDays(s, 'secret-mine'),
    daysTravelled: 0,
    to: 'secret-mine',
    from: s.location,
    salvage: 0,
  };
  s.location = 'on-road';
  runTask(s, rng, log, { kind: 'travel' });
}

export function searchSecret(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'searchSecret' }>): void {
  const e = s.secretExpedition;
  if (s.location !== 'secret-mine' || !e || e.exhausted || e.nuggetFound) return;
  if (action.approach === 'dig' && e.trail < 4) {
    log.raw('You have not yet found the black leader named in the scratched direction.', 'bad');
    return;
  }
  e.daysSearched += 1;
  if (action.approach === 'search') {
    if (e.trail < 4) {
      e.trail += 1;
      log.raw([
        'Beyond the fire-hole you find a line of shallow dish-holes, almost erased by weather.',
        'A rusted pick-head lies under a stone cairn. The old party came this way.',
        'The cairn bears a scratched direction: THREE RED GUMS — BLACK LEADER.',
        'At the three dead gums, your pick exposes a seam of blackened quartz. This is the bed named in the story.',
      ][e.trail - 1], 'good');
    } else {
      log.raw('You trench across the leader and narrow the place where the old party stopped.', 'neutral');
    }
  } else if (action.approach === 'winnow') {
    const gold = rng.chance(0.55) ? rng.int(8, 80) : 0;
    if (gold > 0) {
      s.goldCentiOz += gold;
      s.stats.goldWon += gold;
      log.raw(`Hand winnowing leaves ${formatGold(gold)} of ordinary fine gold in the dish.`, 'good');
    } else {
      log.raw('The wind takes the dust and leaves no colour worth keeping.', 'neutral');
    }
  } else {
    const digs = Math.max(0, e.daysSearched - 4);
    // Four clues merely find the leader. It then takes at least three days
    // of trenching before the legendary stone can be exposed.
    const chance = digs < 3 ? 0 : Math.min(0.5, 0.1 + (digs - 3) * 0.1);
    if (rng.chance(chance)) {
      const gold = rng.int(60000, 110000);
      e.nuggetFound = true;
      e.nuggetCentiOz = gold;
      e.nuggetRecovered = false;
      log.raw(`The pick rings on metal. The Southern Cross lies exposed: a single monstrous nugget of ${formatGold(gold)}, too heavy for two men to shift. It remains in the hole until you bring a dray and enough hands.`, 'good');
      addJournal(s, `Exposed The Southern Cross, a giant nugget of ${formatGold(gold)}, at the secret working.`, 'good');
    } else {
      log.raw('The leader pinches, turns and disappears. You widen the hole; the promise survives another day.', 'bad');
    }
  }
  damage(s, rng.int(1, 4), 'the desert search');
  if (!s.gameOver) endDay(s, rng, log, { toil: true });
  if (e.daysSearched >= 14 && !e.nuggetFound) {
    e.exhausted = true;
    log.raw('Ten days of signs and holes end in barren stone. The expedition is over; only the return remains.', 'bad');
  }
}

export function recoverNugget(s: GameState, rng: RNG, log: Log): void {
  const e = s.secretExpedition;
  const weight = e?.nuggetCentiOz ?? 0;
  if (s.location !== 'secret-mine' || !e?.nuggetFound || e.nuggetRecovered || weight <= 0) return;
  const cost = pounds(10);
  if (s.moneyPence < cost) {
    log.raw('A dray, six men and their water cost ten pounds. Promises will not move the stone.', 'bad');
    return;
  }
  s.moneyPence -= cost;
  for (let i = 0; i < 3; i++) {
    endDay(s, rng, log, { toil: true });
    if (s.gameOver || s.endOfYear) return;
  }
  e.nuggetRecovered = true;
  s.goldCentiOz += weight;
  s.stats.goldWon += weight;
  log.raw(`Six men, a block and tackle and a groaning dray bring The Southern Cross out whole. ${formatGold(weight)} is now packed for the bank.`, 'good');
  addJournal(s, `Recovered The Southern Cross with a hired dray and six men.`, 'good');
}
