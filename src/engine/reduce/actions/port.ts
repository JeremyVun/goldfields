import {
  COOKSHOP_MEAL_PRICE,
  HARBOUR_FISH_CATCH_DAYS,
  HARBOUR_FISH_FAILURE_CHANCE,
  JOBS,
  STANDING_COUNCIL_JOB,
  HEAT_PER_CRIME,
  NOTORIETY_THEFT,
  STEAL_DRUNK,
  STEAL_KNOWN_CHANCE,
  STEAL_STORE,
} from '../../constants';
import { agitationFromStory } from '../../agitation';
import { addHeat, rewardNotice, worsenForCrime } from '../../bandit';
import { endDay } from '../../daily';
import { maybeRumour, salvageValue } from '../../events';
import { toGaol, worsen } from '../../law';
import { bankRefuses } from '../../market';
import { formatMoney, shillings } from '../../money';
import { Log } from '../../narrate';
import { gazetteStokesTrouble } from '../../news';
import type { RNG } from '../../rng';
import { addJournal, addNotoriety, heatZoneFor } from '../../state';
import type { Action, GameState } from '../../types';
import { screenForLocation } from '../screen';
import { checkGraveAfter, runTask } from '../tasks';

// ---------------------------------------------------------------------------
// Port Gannet: wages, the cookshop, lodging, the Times, and theft.
// ---------------------------------------------------------------------------

export function takeWork(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'work' }>): void {
  const job = JOBS[action.job];
  // From wanted criminal no honest house in either town will engage him;
  // there is a notice of him on the wall of the police camp (§23.1).
  if (bankRefuses(s)) {
    log.say('bandit.work.refused', undefined, 'bad');
    return;
  }
  if (job.id === 'council' && s.legal !== 'honest') {
    log.say('work.council.refused', undefined, 'bad');
    return;
  }
  if (job.id === 'council' && s.standing < STANDING_COUNCIL_JOB) {
    log.say('work.council.unknown', undefined, 'bad');
    return;
  }
  s.employment = { job: action.job, since: s.day, daysWorked: action.days };
  runTask(s, rng, log, { kind: 'work', job: action.job, days: action.days });
}

export function inspectHorse(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'inspectHorse' }>): void {
  if (action.method === 'look') {
    s.horseInspection[action.kind] = Math.max(s.horseInspection[action.kind], 1);
    log.raw('You inspect the teeth, legs and feet, and make what you can of them.', 'neutral');
    return;
  }
  const fee = action.method === 'ostler' ? shillings(1) : shillings(5);
  if (s.moneyPence < fee) {
    log.raw('Knowledge has its price, and you cannot meet it.', 'bad');
    return;
  }
  s.moneyPence -= fee;
  s.horseInspection.brumby = 2;
  s.horseInspection.hack = 2;
  s.horseKnowledge = Math.min(10, s.horseKnowledge + 2);
  log.raw(action.method === 'ostler'
    ? 'The ostler gives a blunt account of both animals, with no dealer listening.'
    : 'A day on the road reveals what standing at a rail could not.', 'good');
  if (action.method === 'trial') endDay(s, rng, log, {});
}

export function buyMeal(s: GameState, log: Log): void {
  if (s.fedToday) {
    log.raw('You have a meal waiting already.', 'neutral');
  } else if (s.moneyPence < COOKSHOP_MEAL_PRICE) {
    log.raw('The cookshop does not give credit.', 'bad');
  } else {
    s.moneyPence -= COOKSHOP_MEAL_PRICE;
    s.fedToday = true;
    log.raw('Stew, bread and onions: plain, hot and enough for today.', 'good');
  }
}

export function fishForFood(s: GameState, rng: RNG, log: Log): void {
  const caught = rng.chance(HARBOUR_FISH_FAILURE_CHANCE)
    ? 0
    : rng.int(HARBOUR_FISH_CATCH_DAYS.lo, HARBOUR_FISH_CATCH_DAYS.hi);
  if (caught === 0) {
    log.raw('A day among the pilings brings no catch at all.', 'bad');
  } else {
    s.provisionDays = Math.min(84, s.provisionDays + caught);
    log.raw(
      `A day among the pilings brings ${caught} days' worth of fish to eat or smoke.`,
      'good',
    );
  }
  endDay(s, rng, log, { toil: true });
}

export function setLodging(s: GameState, log: Log, action: Extract<Action, { type: 'setLodging' }>): void {
  if (s.location === 'fields-town') s.slatefordLodging = action.kind;
  else if (s.location === 'suze-port') s.lodging = action.kind;
  else return;
  const key =
    action.kind === 'inn'
      ? 'lodging.inn'
      : action.kind === 'stable'
        ? 'lodging.stable'
        : action.kind === 'tentground'
          ? 'lodging.tentground'
          : 'lodging.rough';
  log.say(key, undefined, 'neutral');
}

export function sellSalvage(s: GameState, rng: RNG, log: Log): void {
  if (s.salvage <= 0) {
    log.raw('You have nothing scavenged to sell.', 'neutral');
    return;
  }
  if (s.location !== 'suze-port') {
    log.raw(
      'Chests of finery are worth nothing at the diggings. Few people head away from the fields, and so the goods lie rotting.',
      'bad',
    );
    return;
  }
  const value = salvageValue(s, rng);
  s.moneyPence += value;
  log.raw(
    `The Port Gannet dealers fall on your scavenged chests and pay ${formatMoney(value)} — a wonderful profit for goods that lay rotting on the track.`,
    'good',
  );
  addJournal(s, `Sold scavenged goods at Port Gannet for ${formatMoney(value)}.`, 'good');
  s.salvage = 0;
}

export function readGazette(s: GameState, rng: RNG, log: Log): void {
  const firstReadingToday = s.gazetteReadOn !== s.day;
  if (firstReadingToday && s.moneyPence < 1) {
    log.raw('The boy will not part with a copy of the Times for nothing.', 'bad');
    return;
  }
  if (firstReadingToday) s.moneyPence -= 1;
  // A licence story read over a pannikin of tea is worth a day's grumbling.
  if (s.gazetteReadOn !== s.day && gazetteStokesTrouble(s)) agitationFromStory(s);
  s.gazetteReadOn = s.day;
  maybeRumour(s, rng, log, 2.5);
  s.screen = 'gazette';
}

export function readJournal(s: GameState, log: Log): void {
  if (s.items.journal < 1) {
    log.raw('You have no copy of the Journal.', 'bad');
    return;
  }
  s.screen = 'journal';
}

export function steal(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'steal' }>): void {
  const def = action.target === 'store' ? STEAL_STORE : STEAL_DRUNK;
  if (rng.chance(def.caught)) {
    log.say(action.target === 'store' ? 'steal.store.caught' : 'steal.drunk.caught', undefined, 'bad');
    worsen(s, log, 1);
    if (action.target === 'store') s.briggsBlacklisted = true;
    addNotoriety(s, NOTORIETY_THEFT);
    s.stats.timesArrested += 1;
    toGaol(s, rng, log);
    if (s.pending) {
      s.screen = 'encounter';
      return;
    }
    if (!s.gameOver) s.screen = screenForLocation(s.location);
    return;
  }
  const loot = rng.int(def.take.lo, def.take.hi);
  s.moneyPence += loot;
  s.stats.takings += loot;
  log.say(action.target === 'store' ? 'steal.store.ok' : 'steal.drunk.ok', { loot: formatMoney(loot) }, 'neutral');
  addJournal(s, `Took ${formatMoney(loot)} that was not yours.`, 'bad');
  addNotoriety(s, NOTORIETY_THEFT);
  // A thief who gets clean away is a thief still, and the name follows him
  // about the port soon enough — which is how the dark ladder is entered.
  if (rng.chance(STEAL_KNOWN_CHANCE)) worsenForCrime(s, log);
  rewardNotice(s, log);
  addHeat(s, heatZoneFor(s), HEAT_PER_CRIME);
  // Watching a store, or a drunk, is a night's work like any other.
  endDay(s, rng, log, {});
  checkGraveAfter(s, rng, log);
}
