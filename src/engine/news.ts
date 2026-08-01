import { AGITATION_STORIES, CAMP_TALK, GAZETTE_ADS, GAZETTE_STORIES } from '../content/library';
import { companyReport } from './company';
import { AFTERMATH_DAY, CAMP_DEFS, FLUSH_DAYS, MINERS_RIGHT_COST, STOCKADE_CAMP } from './constants';
import { rateTrendPhrase } from './market';
import { formatMoney } from './money';
import { inAftermath, rewardFor } from './state';
import { dayOfMonth, formatDate, ordinal, season } from './time';
import type { GameState } from './types';

/** Deterministic index so a day's paper reads the same each time you open it. */
function pickIndex(day: number, salt: number, len: number): number {
  let h = (day * 2654435761 + salt * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return len === 0 ? 0 : (h >>> 8) % len;
}

function rateComment(state: GameState): string {
  const r = state.bankRate;
  if (r >= 920) return 'Gold stands high. The Bank of Australasia is paying near the standard price.';
  if (r >= 860) return 'Gold is firm this week.';
  if (r >= 800) return 'Gold is steady, with little movement reported.';
  return 'Gold is down, and the diggers grumble at the banks.';
}

/** Which tier of licence story the paper is running, or none at all. */
function agitationTier(state: GameState): number {
  if (state.stockadeDone) return -1;
  if (state.agitation >= 75) return 3;
  if (state.agitation >= 50) return 2;
  if (state.agitation >= 25) return 1;
  if (state.agitation >= 10) return 0;
  return -1;
}

export function agitationStory(state: GameState): string | null {
  const tier = agitationTier(state);
  if (tier < 0) return null;
  const set = AGITATION_STORIES[tier];
  return set[pickIndex(state.day, 53 + tier, set.length)];
}

/** Whether today's paper carries something to make a digger angrier (§20). */
export function gazetteStokesTrouble(state: GameState): boolean {
  return agitationStory(state) !== null;
}

/** December at Snakey Gully, and what followed it. */
function stockadeStory(state: GameState): string | null {
  if (!state.stockadeDone) return null;
  const since = state.day - state.stockadeDay;
  if (since >= 0 && since <= 12) {
    return `THE RISING AT ${CAMP_DEFS[STOCKADE_CAMP].name.toUpperCase()}. The stockade on the flat was carried before dawn on Sunday, in something under twenty minutes, and the flag hauled down. Men are dead on both sides. The Angus has nothing to add to that fact, and no wish to be thought to excuse either party.`;
  }
  if (inAftermath(state) && state.day - AFTERMATH_DAY <= 20) {
    return `THE LICENCE ABOLISHED. It is announced that the miner's licence is at an end. In its place the Council will issue a miner's right, ${formatMoney(MINERS_RIGHT_COST)} for the year, carrying the vote with it, and the digger hunts are discontinued from this day. Thirty shillings a month has cost the Government a great deal more than it ever raised.`;
  }
  if (inAftermath(state)) {
    return `THE MINER'S RIGHT. The Council Chambers continue to issue the miner's right at ${formatMoney(MINERS_RIGHT_COST)} the year. No hunts are reported anywhere on the field.`;
  }
  return null;
}

/**
 * The reward notice, and what the colony is told of the man behind it (§23.2).
 * An honest digger's paper never carries a line of this.
 */
function outlawStory(state: GameState): string | null {
  const reward = rewardFor(state);
  if (reward <= 0) return null;
  const name = state.outlawed
    ? 'THE PROCLAIMED OUTLAW'
    : 'REWARD';
  const bits = [
    `${name}. The Commissioner offers ${formatMoney(reward)} for the apprehension of the man now working the roads, to be paid on conviction.`,
  ];
  if (state.bigJobsDone > 0) {
    bits.push(
      'The Angus observes that the colony has not seen work of this order since the McIvor escort, and that the Government has said a great deal about it and done very little.',
    );
  }
  if (state.diggersRobbed === 0 && state.stats.bailUps > 4) {
    bits.push(
      'Correspondents at the diggings continue to write in that no digger’s pile has been taken, a fact which this paper prints without in any way commending it.',
    );
  } else if (state.diggersRobbed > 0) {
    bits.push(
      'Diggers on the road have been robbed of their season’s washing, and the camps that once made a joke of the business are making none now.',
    );
  }
  return bits.join(' ');
}

export function gazetteFor(state: GameState): string[] {
  const lines: string[] = [];
  lines.push(`THE ANGUS GAZETTE — ${formatDate(state.day)}`);
  lines.push('');
  lines.push(
    `EXCHANGE. The Bank of Australasia at Fields Town buys gold at ${formatMoney(state.bankRate)} the ounce. ${rateComment(state)} ${rateTrendPhrase(state)} Camp storekeepers pay a good deal less, and their scales are their own.`,
  );

  if (state.rush && state.rush.since <= state.day && state.rush.untilDay >= state.day) {
    lines.push(
      `A RUSH AT ${CAMP_DEFS[state.rush.camp].name.toUpperCase()}. Word of heavy washdirt has emptied two camps. Every dray on the road is bound that way, and the ground will be pegged over within the week.`,
    );
  }
  if (state.hunt && state.hunt.untilDay >= state.day) {
    lines.push(
      `LICENCES. The Commissioner gives notice that the troopers will make a general inspection of licences at ${CAMP_DEFS[state.hunt.camp].name} in the coming days. Diggers are advised to have their papers about them.`,
    );
  }
  if (state.secret && !state.secret.chased) {
    lines.push(
      `CORRESPONDENCE. A correspondent writes of a working somewhere beyond ${CAMP_DEFS[state.secret.fromCamp].name}, kept quiet by a handful of men. We print the letter as we received it, and vouch for nothing.`,
    );
  }

  // The paragraph a spree buys, and cannot unbuy (§30.2).
  const spreeDay = state.estate.flushUntilDay - FLUSH_DAYS;
  if (state.estate.flushUntilDay >= state.day && state.day - spreeDay <= 3) {
    lines.push(
      state.estate.shamrock && state.estate.houseSpreeOn === spreeDay
        ? `TOWN TALK. The proprietor of the Shamrock entertained the town royally on the night of the ${ordinal(dayOfMonth(spreeDay))}, champagne being served to all comers at his own bar and the fiddler kept at it until daylight. We are told a hundred pounds would not cover the week's stock. It is his own house, and his own affair.`
        : `TOWN TALK. A lucky digger entertained the town royally on the night of the ${ordinal(dayOfMonth(spreeDay))}. Champagne was had at thirty shillings the bottle by men who had drunk nothing but creek water for a month, and the fiddler was paid to play till dawn. We have known such gentlemen to eat ten-pound notes in mutton sandwiches, and to be at the wash again on Friday with nothing whatever to show for it.`,
    );
  }

  const outlaw = outlawStory(state);
  if (outlaw) lines.push(outlaw);

  const trouble = agitationStory(state);
  if (trouble) lines.push(trouble);
  const stockade = stockadeStory(state);
  if (stockade) lines.push(stockade);
  const company = companyReport(state);
  if (company) lines.push(company);

  const s = season(state.day);
  if (s === 'summer') {
    lines.push(
      'WEATHER. Hot winds and dust continue. Travellers are again reminded to carry water; two men were brought in from the Pass Road this week, and one of them did not come in alive.',
    );
  } else if (s === 'winter') {
    lines.push(
      'WEATHER. The roads are a quagmire and the crossings are treacherous. Three drays lie bogged past the eight-mile, and the bullockies are heard for a mile in either direction.',
    );
  }

  lines.push(GAZETTE_STORIES[pickIndex(state.day, 7, GAZETTE_STORIES.length)]);
  lines.push(GAZETTE_STORIES[pickIndex(state.day, 23, GAZETTE_STORIES.length)]);
  lines.push(`ADVERTISEMENT. ${GAZETTE_ADS[pickIndex(state.day, 41, GAZETTE_ADS.length)]}`);
  return lines.filter((l, i, a) => l !== '' || a[i - 1] !== '');
}

export function campTalk(state: GameState): string {
  // Word of a rush crosses a bar counter faster than it crosses a newspaper.
  if (state.rush && state.rush.since <= state.day && state.rush.untilDay >= state.day) {
    const rush = state.rush;
    const name = CAMP_DEFS[rush.camp].name;
    const days = rush.untilDay - state.day + 1;
    const talk = [
      `Every second man is talking of the rush at ${name}. Those who went first have the ground; those who go now will have the leavings.`,
      `They say the ground at ${name} is being pegged over as fast as men can drive a stake, and it will be all taken inside ${days} day${days === 1 ? '' : 's'}.`,
      `A man in from ${name} says the wash there is the best on the field, and he did not stop long enough to finish his drink.`,
      `The talk is all of ${name}: drays on the road all night, and a tent town where there was scrub a week ago.`,
    ];
    return talk[pickIndex(state.day, 131, talk.length)];
  }
  return CAMP_TALK[pickIndex(state.day, 97, CAMP_TALK.length)];
}
