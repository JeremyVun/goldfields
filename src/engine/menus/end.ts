/** The reckoning at the end of the year, the chart of it, and the death notice. */

import { sayFixed } from '../../content/say';
import { epilogueFor } from '../agitation';
import { leaseWord } from '../company';
import { CAMP_DEFS, COMPANY_SHARES, WORTH_SPARK_WIDTH } from '../constants';
import { estateDeeds, isJP, plaqueLine, WORK_NAMES } from '../estate';
import { hearthReckoning } from '../hearth';
import { ITEM_NAMES } from '../market';
import { formatGold, formatMoney } from '../money';
import {
  bushRankOf,
  companyWorth,
  estateWorth,
  hearthWorth,
  healthWord,
  notorietyPhrase,
  rewardFor,
  stashWorth,
  locationName,
  netWorth,
  titleCase,
} from '../state';
import { formatDate } from '../time';
import type { CampId, GameState, MenuItem, ScreenView } from '../types';
import { item, tally, bushArticle } from './shared';
import { STORE_ORDER } from './store';

function equipmentLines(state: GameState): string[] {
  const owned = STORE_ORDER.filter((i) => state.items[i] > 0).map(
    (i) => `${ITEM_NAMES[i]}${state.items[i] > 1 ? ` ×${state.items[i]}` : ''}`,
  );
  if (state.horse !== 'none') owned.push(`a ${state.horse}`);
  const claims = (Object.keys(state.claims) as CampId[]).filter((c) => state.claims[c]);
  const lines: string[] = [];
  lines.push(owned.length ? `You have ${owned.join(', ')}.` : 'You own nothing but the clothes you stand in.');
  lines.push(`Provisions: ${state.provisionDays} days. Water: ${state.waterDays} days.`);
  if (claims.length) lines.push(`Claims pegged at ${claims.map((c) => CAMP_DEFS[c].name).join(', ')}.`);
  if (state.company) {
    lines.push(
      `${state.company.sharesOwned} of the twenty shares in ${state.company.name}, at ${formatMoney(state.company.sharePrice)}.`,
    );
  }
  if (state.salvage > 0) lines.push(`${state.salvage} scavenged chest${state.salvage === 1 ? '' : 's'} from the road.`);
  return lines;
}

export function obituaryView(state: GameState): ScreenView {
  return {
    screen: 'obituary',
    title: 'THE SLATEFORD TIMES — DEATHS',
    body: [
      deathNotice(state),
      '',
      `A new chum of ${state.day} days on the diggings, who won ${formatGold(state.stats.goldWon)} of gold in all,`,
      `and left ${formatMoney(state.moneyPence + state.bankPence)} and ${formatGold(state.goldCentiOz)} behind.`,
      '',
      ...buriedRumourLines(state),
      ...(state.outlawed || state.notoriety >= 15
        ? [
            'Few men on these diggings are killed by bushrangers. The bushranger',
            'himself is another matter, and does not commonly die of old age.',
          ]
        : [
            'Disease kills more people than do accidents, and only rarely is anyone killed',
            'by bushrangers. There would be many unmarked graves in the bush.',
          ]),
      '',
      ...epilogueFor(state),
    ],
    menu: [item('1', 'Begin again', { type: 'newGame' }), item('0', 'Return to the title', { type: 'quitToTitle' })],
  };
}

// ---------------------------------------------------------------------------
// The shape of the year (§21)
// ---------------------------------------------------------------------------

/** Eight heights of block, low to high. Chrome, not narration. */
const SPARK_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * A row of block glyphs scaled to the best week of the run. A year longer than
 * the row is bucketed, each bucket showing its best week, so the peaks survive.
 */
export function sparkline(values: number[], width = WORTH_SPARK_WIDTH): string {
  if (values.length === 0) return '';
  const buckets: number[] = [];
  if (values.length <= width) {
    buckets.push(...values);
  } else {
    for (let i = 0; i < width; i++) {
      const from = Math.floor((i * values.length) / width);
      const to = Math.max(from + 1, Math.floor(((i + 1) * values.length) / width));
      buckets.push(Math.max(...values.slice(from, to)));
    }
  }
  const peak = Math.max(...buckets);
  if (peak <= 0) return SPARK_GLYPHS[0].repeat(buckets.length);
  const top = SPARK_GLYPHS.length - 1;
  return buckets
    .map((v) => SPARK_GLYPHS[Math.max(0, Math.min(top, Math.round((Math.max(0, v) / peak) * top)))])
    .join('');
}

/** The chart of the year, with the figures that give the glyphs their scale. */
export function worthChartLines(state: GameState): string[] {
  const history = state.worthHistory;
  if (history.length < 2) return [];
  const row = sparkline(history);
  const start = history[0];
  const peak = Math.max(...history);
  const final = history[history.length - 1];
  return [
    'THE SHAPE OF YOUR YEAR — what you were worth, week by week',
    row,
    `Began ${formatMoney(start)} · best week ${formatMoney(peak)} · ended ${formatMoney(final)}`,
  ];
}

/**
 * The head of the death notice. Most men die *of* something; a man who is
 * hanged or shot is not, and the column does not put it that way.
 */
function deathNotice(state: GameState): string {
  const cause = state.causeOfDeath ?? 'the hardships of the field';
  const where = `at ${locationName(state.location)}`;
  return /^(hanged|shot|killed|taken)/.test(cause)
    ? `Died on the ${formatDate(state.day)}: ${cause}.`
    : `Died on the ${formatDate(state.day)}, ${where}, of ${cause}.`;
}

/**
 * What the Times prints under an outlaw's death notice when he is known to
 * have had a camp in the ranges and nothing on him worth the naming: the
 * rumour of buried gold, which outlives every man it is told of (§24).
 */
function buriedRumourLines(state: GameState): string[] {
  const h = state.hideout;
  if (!h || h.discovered) return [];
  if (h.stashPence <= 0 && h.stashGold <= 0) return [];
  if (!state.outlawed && state.notoriety < 15) return [];
  return [sayFixed('end.buried.rumour', state.seed ^ (state.day * 7919)), ''];
}

/** How the outlaw's road finished, in the words the reckoning uses (§24). */
function outlawEndPhrase(state: GameState): string | null {
  switch (state.outlawEnd) {
    case 'hanged':
      return 'hanged at the Slateford assizes';
    case 'hulks':
      return 'years of it, and the road ends in the hulks';
    case 'california':
      return 'a berth for California, under a name off the wharf';
    case 'pardoned':
      return 'the Eureka pardon, bought with the whole of the stash';
    case 'at large':
      return 'still out in the ranges, and looked for yet';
    default:
      return state.outlawed ? 'proclaimed, and not yet taken' : null;
  }
}

/**
 * The tally the bank does not keep: what the roads brought in, what is set down
 * against him, and how the road ended. Ruled in the same hand as the deposit
 * certificate above it, because it is the same year (§24).
 */
function otherLedgerLines(state: GameState): string[] {
  if (!state.hideout && state.notoriety <= 0 && !state.outlawed) return [];
  const out: string[] = ['', 'THE OTHER LEDGER — WHAT IS SET DOWN AGAINST YOU'];
  if (state.stats.takings > 0) out.push(tally('Taken on the roads', formatMoney(state.stats.takings)));
  if (state.stats.bailUps > 0) {
    out.push(
      tally(
        'Travellers stopped',
        `${state.stats.bailUps}${
          state.diggersRobbed > 0
            ? `, of whom ${state.diggersRobbed} were diggers`
            : ', and never a digger among them'
        }`,
      ),
    );
  }
  if (state.stats.bigJobs > 0) {
    out.push(
      tally(
        'Banks and escorts',
        `${state.stats.bigJobs} attempted, ${state.bigJobsDone} came off`,
      ),
    );
  }
  out.push(tally('Notoriety', notorietyPhrase(state.notoriety)));
  out.push(tally('In the bush', bushArticle(bushRankOf(state))));
  const reward = rewardFor(state);
  out.push(
    tally(
      'On your head',
      reward > 0 ? `${formatMoney(reward)}, and printed in the Times` : 'nothing the Crown will pay for',
    ),
  );
  if (state.gang.length > 0) {
    out.push(tally('Riding with you', state.gang.map((g) => g.name).join(', ')));
  }
  if (state.hideout) {
    out.push(
      tally(
        'Under the stone',
        `${formatMoney(state.hideout.stashPence)} and ${formatGold(state.hideout.stashGold)}, worth ${formatMoney(stashWorth(state))}`,
      ),
    );
  }
  if (state.bloodShed) out.push(tally('Blood', 'shed, and the Crown hangs men for it'));
  const ended = outlawEndPhrase(state);
  if (ended) out.push(tally('How it ended', ended));
  return out;
}

/**
 * What a man's name is on at the end of the year: deeds, the plaques at the
 * Chambers, and the commission (§28.2). The works are worth nothing in the
 * tally above and everything in the paragraph below.
 */
function estateLedgerLines(state: GameState): string[] {
  const e = state.estate;
  const deeds = estateDeeds(state);
  if (deeds.length === 0 && e.works.length === 0 && e.jpSince === null) return [];
  const out: string[] = ['', 'THE ESTATE — WHAT YOUR NAME IS ON'];
  for (const d of deeds) out.push(tally('Deed', d));
  for (const w of e.works) {
    out.push(tally('Funded', `${WORK_NAMES[w.id]}${w.camp ? `, to ${CAMP_DEFS[w.camp].name}` : ''}, day ${w.day}`));
    out.push(`    ${plaqueLine(state, w.id)}`);
  }
  if (isJP(state)) {
    out.push(tally('Commission', `Justice of the Peace, gazetted day ${e.jpSince}`));
    out.push('    Arrived a new chum; sits on the Slateford bench now.');
  }
  return out;
}

function hearthLedgerLines(state: GameState): string[] {
  const r = hearthReckoning(state);
  if (!r.intendedName) return [];
  const out = ['', 'THE HEARTH — WHAT THE BANK DRAFT DOES NOT SAY'];
  out.push(tally('Household', `${r.intendedName}; ${r.rung}`));
  out.push(tally('Dated pulls', `${r.eventsKept} kept, ${r.eventsMissed} missed`));
  out.push(tally('Sent home', formatMoney(r.remittedPence)));
  if (r.cottage) out.push(tally('Home', `a cottage in Port Gannet${r.childBorn ? ', and a child born there' : ''}`));
  out.push(`    ${sayFixed(r.finalLetterKey, state.seed ^ state.day)}`);
  return out;
}

/** The Bank Draft tally at the end of the year (faithful: a bank draft sheet shipped with the game). */
export function endView(state: GameState): ScreenView {
  const gold = state.goldCentiOz;
  const c = state.company;
  const scrip = companyWorth(state);
  const buried = stashWorth(state);
  const deeds = estateWorth(state);
  const hearth = hearthWorth(state);
  const total = netWorth(state);
  const body: string[] = [];
  body.push(`After a year on the goldfields — ${formatDate(state.day)}.`);
  body.push('');
  body.push('THE BANK OF AUSTRALASIA — DEPOSIT CERTIFICATE');
  body.push(tally('Money in hand', formatMoney(state.moneyPence)));
  body.push(tally('On deposit', formatMoney(state.bankPence)));
  body.push(
    tally('Gold held', `${formatGold(gold)} (worth ${formatMoney(Math.floor((gold * state.bankRate) / 100))})`),
  );
  if (c) body.push(tally('Scrip and treasury', formatMoney(scrip)));
  if (buried > 0) body.push(tally('Buried in the ranges', `${formatMoney(buried)} (no bank knows of it)`));
  // Deeds at what was paid for them; the public works are worth nothing here
  // and everything below (§26, §28.2).
  if (deeds > 0) body.push(tally('Deeds and premises', formatMoney(deeds)));
  if (hearth > 0) body.push(tally('Hearth and home', formatMoney(hearth)));
  body.push(tally('IN ALL', formatMoney(total)));
  body.push('');
  const chart = worthChartLines(state);
  if (chart.length) {
    body.push(...chart);
    body.push('');
  }
  if (c) {
    body.push(`${c.name.toUpperCase()} — THE COMPANY'S BOOKS`);
    body.push(tally('Treasury', formatMoney(c.treasury)));
    body.push(
      tally('Shares', `${c.sharesOwned} yours of ${COMPANY_SHARES}, at ${formatMoney(c.sharePrice)} the share`),
    );
    body.push(
      tally(
        'Crews',
        `${c.crews.length}, on ${c.leases.length} lease${c.leases.length === 1 ? '' : 's'} (${c.leases.map(leaseWord).join('; ')})`,
      ),
    );
    body.push('');
  } else if (state.soldOut) {
    body.push(
      `You sold out of ${state.soldOut.name} on day ${state.soldOut.day} for ${formatMoney(state.soldOut.amount)}.`,
    );
    body.push('');
  }
  body.push(...equipmentLines(state));
  body.push(...estateLedgerLines(state));
  body.push(...hearthLedgerLines(state));
  body.push(...otherLedgerLines(state));
  body.push('');
  body.push(`Health: ${healthWord(state.health)}. Legal record: ${state.outlawed ? 'Proclaimed an outlaw' : titleCase(state.legal)}.`);
  body.push(
    `You worked ${state.stats.daysWorked} days for wages and ${state.stats.daysDug} days at the diggings,`,
  );
  body.push(
    `won ${formatGold(state.stats.goldWon)} of gold, sank ${state.stats.shaftsSunk} shaft${state.stats.shaftsSunk === 1 ? '' : 's'},`,
  );
  body.push(
    `were robbed ${state.stats.timesRobbed} time${state.stats.timesRobbed === 1 ? '' : 's'} and arrested ${state.stats.timesArrested}.`,
  );
  body.push('');
  const notable = state.journal.filter((j) => j.tone === 'good' || j.tone === 'bad').slice(-8);
  if (notable.length) {
    body.push('FROM YOUR DIARY:');
    for (const n of notable) body.push(`  Day ${n.day}: ${n.text}`);
    body.push('');
  }
  for (const line of epilogueFor(state)) body.push(line);
  body.push('');
  body.push('The computer makes no judgment. Whether you have made your fortune is for you to say.');

  const menu: MenuItem[] = [];
  if (!state.gameOver) {
    menu.push(item('1', 'Stay on for another year', { type: 'nextYear' }));
  }
  menu.push(item('2', 'Begin a new game', { type: 'newGame' }));
  menu.push(item('0', 'Return to the title screen', { type: 'quitToTitle' }));
  return { screen: 'end', title: 'THE RECKONING', body, menu };
}
