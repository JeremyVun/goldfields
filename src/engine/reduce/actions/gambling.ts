import { TWOUP_WIN, CARDS_WIN, CARDS_PAYOUT } from '../../constants';
import { endDay } from '../../daily';
import { formatMoney } from '../../money';
import { Log } from '../../narrate';
import { drinkAt, oddsFactor, shoutTheBar } from '../../shamrock';
import type { RNG } from '../../rng';
import type { Action, GameState } from '../../types';

// ---------------------------------------------------------------------------
// The bar and the ring (§30.1).
// ---------------------------------------------------------------------------

export function drink(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'drink' }>): void {
  const days = drinkAt(s, rng, log, action.what ?? 'nobbler');
  for (let i = 0; i < days && !s.gameOver && !s.endOfYear; i++) endDay(s, rng, log, {});
}

export function shoutBar(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'shoutBar' }>): void {
  const result = shoutTheBar(s, rng, log, action.spree);
  for (let i = 0; i < result.days && !s.gameOver && !s.endOfYear; i++) {
    endDay(s, rng, log, {});
  }
}

export function startGamble(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'startGamble' }>): void {
  if (action.stake <= 0 || s.moneyPence < action.stake) {
    log.raw('You cannot cover the stake.', 'bad');
    return;
  }
  s.moneyPence -= action.stake;
  s.gambling = {
    game: action.game,
    stake: action.stake,
    pot: 0,
    round: 1,
    hand: rng.int(1, 10),
    tell: rng.pick(['steady', 'eager', 'uneasy'] as const),
  };
  s.screen = action.game === 'twoup' ? 'ftown-twoup' : 'ftown-cards';
}

export function twoUpCall(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'twoUpCall' }>): void {
  const g = s.gambling;
  if (!g || g.game !== 'twoup') return;
  const wager = g.pot > 0 ? g.pot : g.stake;
  const toss = rng.chance(0.5) ? 'heads' : 'tails';
  if (toss === action.side) {
    g.pot = wager * 2;
    g.round += 1;
    log.raw(`${toss.toUpperCase()}. The ring pays, and asks whether it rides again.`, 'good');
  } else {
    s.stats.gamblingNet -= g.stake;
    log.raw(`${toss.toUpperCase()}. Everything left in the ring is gone.`, 'bad');
    s.gambling = null;
    s.screen = 'ftown-gamble';
  }
}

export function twoUpCollect(s: GameState, log: Log): void {
  const g = s.gambling;
  if (!g || g.game !== 'twoup' || g.pot <= 0) return;
  s.moneyPence += g.pot;
  s.stats.gamblingNet += g.pot - g.stake;
  log.raw(`You rake back ${formatMoney(g.pot)} and leave the spinner to the next man.`, 'good');
  s.gambling = null;
  s.screen = 'ftown-gamble';
}

export function cardsDecision(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'cardsDecision' }>): void {
  const g = s.gambling;
  if (!g || g.game !== 'cards') return;
  let totalRisk = g.stake;
  if (action.choice === 'fold') {
    const saved = Math.floor(g.stake / 2);
    s.moneyPence += saved;
    s.stats.gamblingNet -= g.stake - saved;
    log.raw(`You throw the hand in and save ${formatMoney(saved)} of the stake.`, 'neutral');
  } else {
    if (action.choice === 'raise') {
      if (s.moneyPence < g.stake) return;
      s.moneyPence -= g.stake;
      totalRisk *= 2;
    }
    const opponent = rng.int(1, 10);
    const tellBonus = g.tell === 'uneasy' ? 1 : g.tell === 'eager' ? -1 : 0;
    const player = g.hand + (action.choice === 'bluff' ? rng.int(-2, 4) + tellBonus : 0);
    const won = player >= opponent;
    if (won) {
      const returned = Math.round(totalRisk * CARDS_PAYOUT);
      s.moneyPence += returned;
      s.stats.gamblingNet += returned - totalRisk;
      log.raw(action.choice === 'bluff' ? 'He looks once more at you, not his cards, and folds.' : `The hands turn over. Yours is good; ${formatMoney(returned)} comes across the table.`, 'good');
    } else {
      s.stats.gamblingNet -= totalRisk;
      log.raw(action.choice === 'bluff' ? 'He calls at once. Your story was better than your cards.' : 'The hands turn over. His is better.', 'bad');
    }
  }
  s.gambling = null;
  s.screen = 'ftown-gamble';
}

export function gamble(s: GameState, rng: RNG, log: Log, action: Extract<Action, { type: 'gamble' }>): void {
  const stake = Math.min(action.stake, s.moneyPence);
  if (stake <= 0) {
    log.raw('You have nothing to stake.', 'bad');
    return;
  }
  // Card sharps seek out a new chum; the parlour plays straight (§30.1).
  const odds = oddsFactor(s, stake);
  if (action.game === 'twoup') {
    if (rng.chance(TWOUP_WIN * odds)) {
      s.moneyPence += stake;
      s.stats.gamblingNet += stake;
      log.say('gamble.twoup.win', { amount: formatMoney(stake) }, 'good');
    } else {
      s.moneyPence -= stake;
      s.stats.gamblingNet -= stake;
      log.say('gamble.twoup.lose', { amount: formatMoney(stake) }, 'bad');
    }
  } else {
    if (rng.chance(CARDS_WIN * odds)) {
      const won = Math.round(stake * CARDS_PAYOUT);
      s.moneyPence += won;
      s.stats.gamblingNet += won;
      log.say('gamble.cards.win', { amount: formatMoney(won) }, 'good');
    } else {
      s.moneyPence -= stake;
      s.stats.gamblingNet -= stake;
      log.say('gamble.cards.lose', { amount: formatMoney(stake) }, 'bad');
    }
  }
}
