import { crimeVisible, travellerPatrolChance } from './bandit';
import { CAMP_DEFS, HIDEOUT_TRAVEL_DAYS, ROUTES, SECRET_TRAVEL_DAYS, WAGON_FARE } from './constants';
import { endDay } from './daily';
import { flushFactor } from './events';
import { contract, damage } from './health';
import { formatMoney } from './money';
import type { Log } from './narrate';
import type { RNG } from './rng';
import { addJournal, hasWork, isCamp } from './state';
import { season } from './time';
import type { CampId, GameState, LocationId, Route, TravelMode } from './types';

export const SALVAGE_FINDS = [
  'a chest of fancy clothes',
  'a case of books, swollen with rain',
  'a crate of china basins',
  'a japanned tin trunk of ladies’ things',
  'a bundle of blankets and a broken stretcher',
  'a box of ironmongery, too heavy for its owner',
  'a canteen of silver spoons',
];

export interface TravelPlan {
  route: Route;
  mode: TravelMode;
  days: number;
  fare: number;
  problems: string[];
}

export function planJourney(state: GameState, route: Route, mode: TravelMode): TravelPlan {
  const r = ROUTES[route];
  let days = mode === 'walk' ? r.walkDays : mode === 'wagon' ? r.wagonDays : r.horseDays;
  const problems: string[] = [];
  let fare = 0;

  if (mode === 'horse') {
    if (state.horse === 'none') problems.push('You have no horse.');
    if (state.horse === 'hack' && route === 'pass') days += 1;
  }
  if (mode === 'wagon') {
    fare = WAGON_FARE;
    if (state.moneyPence < fare) problems.push(`The wagon master wants ${formatMoney(fare)}.`);
  }
  if (mode === 'walk') {
    if (state.items.cradle > 0 && state.items.barrow < 1) {
      problems.push('A footslogger cannot hump a cradle without a barrow; it will be left behind.');
    }
    if (state.items.pump > 0 && state.items.barrow < 1) {
      problems.push('The pump cannot be carried on your back; it will be left behind.');
    }
  }
  if (state.waterDays <= 0 && season(state.day) === 'summer') {
    problems.push('You carry no water, and it is high summer. Travellers have died of thirst.');
  }
  if (state.provisionDays < days) {
    problems.push('You have not enough provisions for the road.');
  }
  return { route, mode, days, fare, problems };
}

export function beginJourney(
  state: GameState,
  log: Log,
  route: Route,
  mode: TravelMode,
  to: LocationId,
): boolean {
  const plan = planJourney(state, route, mode);
  if (mode === 'horse' && state.horse === 'none') {
    log.raw('You have no horse to ride.', 'bad');
    return false;
  }
  if (mode === 'wagon') {
    if (state.moneyPence < plan.fare) {
      log.raw(`The wagon master wants ${formatMoney(plan.fare)}, or you walk.`, 'bad');
      return false;
    }
    state.moneyPence -= plan.fare;
    log.raw(
      `You pay ${formatMoney(plan.fare)} to a bullocky with room on his dray, and your kit goes up with the flour sacks.`,
      'neutral',
    );
  }
  if (mode === 'walk') {
    if (state.items.cradle > 0 && state.items.barrow < 1) {
      state.items.cradle = 0;
      log.raw('The cradle is left standing by the road. You cannot carry it and live.', 'bad');
    }
    if (state.items.pump > 0 && state.items.barrow < 1) {
      state.items.pump = 0;
      log.raw('The pump goes the way of the cradle.', 'bad');
    }
  }

  state.journey = {
    route,
    mode,
    daysLeft: plan.days,
    daysTravelled: 0,
    to,
    from: state.location,
    salvage: 0,
  };
  state.location = 'on-road';
  log.say(route === 'trickeys' ? 'travel.depart.trickeys' : 'travel.depart.pass', undefined, 'neutral');
  return true;
}

/**
 * Whether this leg is the one the subscribers bridged: Fields Town to Damp
 * Camp, over the Blue River, where the ford used to swallow wheels (§27).
 */
export function bridged(state: GameState, from: LocationId, to: LocationId): boolean {
  if (!hasWork(state, 'bridge')) return false;
  const legs = [from, to];
  return legs.includes('fields-town') && legs.includes('damp-camp');
}

export type TravelStop = 'bushrangers' | 'trooper' | 'dead' | 'arrived' | 'yearEnd' | null;

/** One day on the road, upkeep included. */
export function travelOneDay(state: GameState, rng: RNG, log: Log): TravelStop {
  const j = state.journey;
  if (!j) return 'arrived';
  const r = ROUTES[j.route];
  const danger = r.danger;
  const s = season(state.day);

  const modeKey =
    j.mode === 'walk' ? 'travel.walk.day' : j.mode === 'wagon' ? 'travel.wagon.day' : 'travel.horse.day';
  log.say(modeKey, undefined, 'neutral');

  // --- troopers on a road that has been made hot (§23.3) ---------------
  if (crimeVisible(state) && rng.chance(travellerPatrolChance(state, j.route))) {
    log.say('bandit.patrol.road', undefined, 'bad');
    state.pending = { kind: 'patrol', data: { route: j.route } };
    return 'trooper';
  }

  // --- bushrangers ----------------------------------------------------
  // A man the town knows to be flush is followed out of it (§30.2).
  const companyOnRoad = j.mode === 'wagon' ? 0.65 : j.mode === 'horse' ? 1.1 : 1;
  if (rng.chance(0.035 * danger * flushFactor(state) * companyOnRoad)) {
    state.pending = { kind: 'bushrangers' };
    log.say('bushranger.bailup', undefined, 'bad');
    return 'bushrangers';
  }

  // --- the road itself -------------------------------------------------
  // The Blue River bridge takes the winter out of the Damp Camp leg, for the
  // player and for every bullocky on it (§27). Now and then he is shown it.
  if (bridged(state, j.from, j.to) && s === 'winter') {
    if (rng.chance(0.2)) log.say('works.bridge.absence', undefined, 'good');
  } else if (s === 'winter' && j.mode === 'wagon' && rng.chance(0.11 * danger)) {
    const lost = rng.int(1, 3);
    log.say('travel.bogged', { days: lost }, 'bad');
    for (let i = 0; i < lost; i++) {
      endDay(state, rng, log, { travelling: true });
      if (state.gameOver) return 'dead';
      if (state.endOfYear) return 'yearEnd';
    }
  } else if (s === 'winter' && rng.chance(0.022 * danger)) {
    log.say('travel.flood', undefined, 'bad');
    damage(state, rng.int(4, 14), 'a flash flood');
    if (rng.chance(0.3) && state.moneyPence > 0) {
      const lost = Math.floor(state.moneyPence * rng.range(0.1, 0.4));
      state.moneyPence -= lost;
      log.raw(`The water takes ${formatMoney(lost)} of your swag downstream.`, 'bad');
    }
    if (state.gameOver) return 'dead';
  } else if (rng.chance(0.012 * danger)) {
    contract(state, rng, log, 'snakebite', rng.chance(0.3) ? 2 : 1);
    damage(state, rng.int(4, 12), 'a snakebite');
    if (state.gameOver) return 'dead';
  } else if (j.mode === 'horse' && state.horse === 'hack' && rng.chance(0.05 * danger)) {
    log.say('travel.hack.suffers', undefined, 'bad');
    if (rng.chance(0.25)) {
      state.horse = 'none';
      log.raw('The hack is done for. You go on afoot, poorer by twenty-five pounds.', 'bad');
      j.daysLeft += 2;
    }
  } else if (rng.chance(0.07)) {
    log.say('travel.salvage', { item: rng.pick(SALVAGE_FINDS) }, 'good');
    j.salvage += 1;
    state.salvage += 1;
  } else if (rng.chance(0.14)) {
    log.say('travel.travellers', undefined, 'neutral');
    if (rng.chance(0.25)) {
      // a little news changes hands
      if (state.rush && state.rush.since <= state.day) {
        log.raw(
          `They speak of a rush at ${CAMP_DEFS[state.rush.camp].name}; every man on the road is bound for it.`,
          'neutral',
        );
      }
    }
  } else if (rng.chance(0.08)) {
    log.say('travel.footsore', undefined, 'neutral');
  }

  // A heavy load of salvage slows a walker.
  // Capped: a man loaded to the eyes is slow, but the road still has an end.
  if (j.mode === 'walk' && state.salvage > 0 && rng.chance(Math.min(0.3, 0.04 * state.salvage))) {
    log.raw('The scavenged load tells on you, and you make poor time.', 'bad');
    j.daysLeft += 1;
  }

  endDay(state, rng, log, { travelling: true, toil: j.mode === 'walk' });
  if (state.gameOver) return 'dead';
  j.daysTravelled += 1;
  j.daysLeft -= 1;
  if (state.endOfYear) return 'yearEnd';
  if (j.daysLeft <= 0) return 'arrived';
  return null;
}

export function arrive(state: GameState, log: Log): void {
  const j = state.journey;
  if (!j) return;
  state.location = j.to;
  state.journey = null;
  if (j.to === 'fields-town') {
    log.say('travel.arrive.ftown', undefined, 'good');
    addJournal(state, 'Came down into Fields Town at last.', 'good');
  } else if (j.to === 'suze-port') {
    log.say('travel.arrive.suze', undefined, 'neutral');
  } else if (j.to === 'hideout') {
    log.say('bandit.hideout.arrive', undefined, 'good');
  } else if (isCamp(j.to)) {
    log.say('travel.arrive.camp', { camp: CAMP_DEFS[j.to as CampId].name }, 'neutral');
    const claim = state.claims[j.to as CampId];
    if (claim?.jumpedOn) {
      state.pending = { kind: 'claimJumper', data: { camp: j.to } };
      addJournal(state, `Returned to find claim-jumpers on the ground at ${CAMP_DEFS[j.to as CampId].name}.`, 'bad');
      log.raw('Your notice board has been torn down. Smoke rises from a stranger’s fire on your claim.', 'bad');
    }
  }
}

/** Days between Fields Town and a camp (or between camps). */
export function localTravelDays(state: GameState, to: LocationId): number {
  // The secret mine is a hard journey in both directions; coming back out of
  // the desert is no shorter than going in.
  if (to === 'secret-mine' || state.location === 'secret-mine') return SECRET_TRAVEL_DAYS;
  // The ranges beyond the Deep Mountains: two days up, and two days down.
  if (to === 'hideout' || state.location === 'hideout') {
    const near = to === 'deep-mountains' || state.location === 'deep-mountains';
    const days = near ? HIDEOUT_TRAVEL_DAYS : HIDEOUT_TRAVEL_DAYS + 1;
    return state.horse !== 'none' ? Math.max(1, Math.ceil(days / 2)) : days;
  }
  const base = isCamp(to) ? CAMP_DEFS[to as CampId].daysFromTown : 1;
  let days = base;
  if (isCamp(state.location) && isCamp(to)) {
    days = Math.max(1, CAMP_DEFS[to as CampId].daysFromTown);
  }
  if (state.horse !== 'none') days = Math.max(1, Math.ceil(days / 2));
  return days;
}
