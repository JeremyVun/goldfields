/** The player's own menu, and the map of the country he is standing in. */

import { CAMP_DEFS, JOBS } from '../constants';
import { ILLNESS_NAMES } from '../health';
import { ITEM_NAMES, briggsDiscount } from '../market';
import { isWorkedOut } from '../mining';
import { formatGold, formatMoney } from '../money';
import {
  bushRankOf,
  notorietyPhrase,
  rewardFor,
  locationName,
  shaftRank,
  standingPhrase,
  washRank,
} from '../state';
import { formatDate, seasonPhrase } from '../time';
import type {
  CampId,
  GameState,
  MenuItem,
  ScreenView,
  ViewFigure,
  ViewPanel,
  SkillRank,
} from '../types';
import { item, bushArticle } from './shared';
import { STORE_ORDER } from './store';

function article(rank: SkillRank): string {
  return rank === 'old hand' ? 'an old hand' : rank === 'digger' ? 'a digger' : 'a new chum';
}

/** An item's name with the article knocked off it, for a list rather than a sentence. */
function bareItem(name: string): string {
  return name.replace(/^(a|an|the) /i, '').replace(/, loaded$/, ' (loaded)');
}

function days(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

function standingNumber(standing: number): string {
  return Number.isInteger(standing) ? String(standing) : standing.toFixed(2).replace(/0+$/, '');
}

/** How a man would speak of what is left in his sacks, rather than count it. */
function keepPhrase(days: number): string {
  if (days <= 0) return 'none left';
  if (days <= 3) return 'running short';
  if (days <= 7) return 'enough for the week';
  if (days >= 21) return 'well found';
  return 'a fair stock';
}

function keepTone(days: number): 'good' | 'bad' | undefined {
  if (days <= 3) return 'bad';
  if (days >= 21) return 'good';
  return undefined;
}

/**
 * The standing phrases end "on the field" because they are written to be read
 * in a sentence. Under a square captioned ON THE FIELD they would say it twice,
 * and the second saying costs a whole line of a phone. The caption keeps it.
 */
function unlocated(phrase: string): string {
  return phrase.replace(/ on the field$/, '');
}

/**
 * The menu (opened with ESC; the original "@" remains an alias).
 *
 * Only what belongs to the man himself. The day, the season, his money, his
 * gold, his health, his legal rung and his licence are already standing in the
 * status bar at the foot of every screen, and the price of gold is a thing of
 * the market, told where gold is sold — none of it is repeated here. What is
 * left is what a man cannot read anywhere else: his keep, his name, his hands,
 * and what he is carrying.
 *
 * His figures go in `figures`, in an order that never changes, so that the
 * answer to "how much water have I left" is in the same square of the page
 * every time the menu is opened. Everything that wants a sentence goes in
 * `panels` beneath, where growing does no harm. `body` carries the same matter
 * flattened for anything that reads the view as prose.
 */
export function menuView(state: GameState): ScreenView {
  // The figures, fixed in their order and never omitted: a cell holding a dash
  // is a cell whose neighbours have not moved.
  const figures: ViewFigure[] = [];
  const figure = (caption: string, value: string, note?: string, tone?: 'good' | 'bad') =>
    figures.push({ caption, value, note, tone });

  figure('In hand', formatMoney(state.moneyPence));
  figure('Gold', formatGold(state.goldCentiOz), state.goldCentiOz > 0 ? 'unsold' : undefined);
  figure('Food', days(state.provisionDays), keepPhrase(state.provisionDays), keepTone(state.provisionDays));
  if (state.items.waterBags > 0) {
    figure('Water', days(state.waterDays), keepPhrase(state.waterDays), keepTone(state.waterDays));
  } else {
    figure('Water', '—', 'no bags to carry it', 'bad');
  }

  figure('In the bank', state.bankPence > 0 ? formatMoney(state.bankPence) : '—');
  const briggsPct = `${Math.round(briggsDiscount(state) * 100)}%`;
  const briggsNext = state.briggsDays < 7 ? 7 : state.briggsDays < 21 ? 21 : state.briggsDays < 42 ? 42 : null;
  if (state.briggsBlacklisted) figure("At Bell's", '—', 'blacklisted from the counter', 'bad');
  else if (briggsNext === null) figure("At Bell's", briggsPct, 'top staff standing', 'good');
  else figure("At Bell's", briggsPct, `${state.briggsDays} of ${briggsNext} days served`);
  figure('On the field', `${standingNumber(state.standing)}/100`, `reckoned ${unlocated(standingPhrase(state.standing))}`);
  // The eighth square is the dark one, and stays empty until a man has earned it.
  if (state.notoriety > 0 || state.outlawed) {
    figure('To the traps', `${standingNumber(state.notoriety)}/100`, unlocated(notorietyPhrase(state.notoriety)), 'bad');
  }

  const panels: ViewPanel[] = [];
  const panel = (heading: string): ViewPanel => {
    const p: ViewPanel = { heading, rows: [] };
    panels.push(p);
    return p;
  };
  const row = (p: ViewPanel, label: string | undefined, text: string) => p.rows.push({ label, text });

  // The man --------------------------------------------------------------
  // His hands in the field's own words and not in days worked: the game says a
  // new chum, a digger, an old hand, and a man knows what those mean without
  // being shown the arithmetic behind them.
  const man = panel('THE MAN');
  row(
    man,
    undefined,
    `Reckoned ${article(washRank(state))} at the wash and ${article(shaftRank(state))} underground; ` +
      `in the bush, ${state.skill.bush > 0 ? bushArticle(bushRankOf(state)) : 'no hand at all'}.`,
  );
  // Health itself is in the status bar; the name of what has hold of you is not.
  if (state.illness) row(man, undefined, `Down with ${ILLNESS_NAMES[state.illness.id]}.`);
  if (state.employment) row(man, 'Last engaged as', JOBS[state.employment.job].name);

  // What he is carrying --------------------------------------------------
  const kit = panel('WHAT YOU CARRY');
  const owned = STORE_ORDER.filter((i) => state.items[i] > 0).map(
    (i) => `${bareItem(ITEM_NAMES[i])}${state.items[i] > 1 ? ` ×${state.items[i]}` : ''}`,
  );
  if (state.horse !== 'none') owned.push(state.horse);
  row(kit, 'Kit', owned.length ? owned.join(', ') : 'nothing but the clothes you stand in');
  const pegged = (Object.keys(state.claims) as CampId[]).filter((c) => state.claims[c]);
  row(kit, 'Claims', pegged.length ? pegged.map((c) => CAMP_DEFS[c].name).join(', ') : 'none pegged');
  if (state.shaft) {
    row(
      kit,
      'Shaft',
      `${CAMP_DEFS[state.shaft.camp].name}, ${state.shaft.depthFeet} feet down` +
        (state.shaft.bottomed ? ', bottomed on payable wash' : ', bottoming somewhere below') +
        `${state.shaft.timbered ? ', timbered' : ', untimbered'}${state.shaft.pumped ? ' and pumped' : ''}.`,
    );
  }
  if (state.company) {
    row(kit, state.company.name, `${state.company.sharesOwned} of the twenty shares, at ${formatMoney(state.company.sharePricePence)}`);
  }
  if (state.salvage > 0) row(kit, 'Salvage', `${state.salvage} scavenged chest${state.salvage === 1 ? '' : 's'} from the road`);

  // The traps ------------------------------------------------------------
  // The number and what the colony calls it are figures above; what is left
  // here is only what wants a sentence.
  if (state.outlawed || state.hideout || state.gang.length > 0 || rewardFor(state) > 0) {
    const dark = panel('THE TRAPS');
    const reward = rewardFor(state);
    if (reward > 0) row(dark, 'On your head', formatMoney(reward));
    if (state.outlawed) row(dark, undefined, 'Proclaimed an outlaw. There is no reforming out of this one.');
    if (state.hideout) {
      row(
        dark,
        'Split Rock Camp',
        `${formatMoney(state.hideout.stashPence)} and ${formatGold(state.hideout.stashCentiOz)} under the flat stone`,
      );
    }
    if (state.gang.length > 0) row(dark, 'Riding with you', state.gang.map((g) => g.name).join(', '));
  }

  const body: string[] = [
    `${formatDate(state.day)} — day ${state.day} of your year, in ${seasonPhrase(state.day)}.`,
    `You are at ${locationName(state.location)}.`,
    '',
    // A dash is a drawn thing, standing in for a figure that would be nothing.
    // Read aloud it is not worth saying, so the note speaks for the square.
    ...figures.map((f) =>
      f.value === '—'
        ? `${f.caption}: ${f.note ?? 'none'}`
        : `${f.caption}: ${f.value}${f.note ? ` — ${f.note}` : ''}`,
    ),
  ];
  for (const p of panels) {
    body.push('');
    body.push(p.heading);
    for (const r of p.rows) body.push(r.label ? `${r.label}: ${r.text}` : r.text);
  }

  // Gold is sold at the buyer's counter and at the bank, where the rate of the
  // day is on the wall beside it. A shortcut from here sold it blind.
  const menu: MenuItem[] = [
    item('A', 'Save the game', { type: 'save' }),
    item('B', 'Finish the game', { type: 'finish' }),
    item('0', 'Return to what you were doing', { type: 'continue' }),
  ];
  // The day's number and the season are in the status bar under every screen,
  // so the head carries only the date proper and where you are standing —
  // which on a phone is the difference between one line and three.
  const subtitle = `${formatDate(state.day)} — at ${locationName(state.location)}`;
  return { screen: 'camp', title: 'MENU', subtitle, body, figures, panels, menu };
}

/**
 * The words that go beneath the sheet. The country itself — the coast, the two
 * roads, the river, the town and the camps — is on the drawing, named where it
 * stands; what is left for the prose is only what a man's own year has put
 * there, kept short enough that map and notes are one page together.
 */
export function mapView(state: GameState): ScreenView {
  const body: string[] = [`The star marks where you are: ${locationName(state.location)}.`];

  if (state.rush && state.rush.since <= state.day && state.rush.untilDay >= state.day) {
    const days = state.rush.untilDay - state.day + 1;
    body.push(
      `There is a RUSH at ${CAMP_DEFS[state.rush.camp].name}, and it will be over in ${days} day${days === 1 ? '' : 's'}.`,
    );
  }

  const pegged = (Object.keys(state.claims) as CampId[]).filter((c) => state.claims[c]);
  if (pegged.length) {
    const words = pegged.map((c) => {
      const claim = state.claims[c];
      return `${CAMP_DEFS[c].name}${claim && isWorkedOut(claim) ? ' (worked out)' : ''}`;
    });
    body.push(`Your stakes are in the ground at ${words.join(' and ')}.`);
  } else {
    body.push('You have pegs in no ground anywhere on this field.');
  }

  if (state.company) {
    body.push(
      `The workings of ${state.company.name} lie in the ${CAMP_DEFS['deep-mountains'].name}, on ${state.company.leases.length} lease${state.company.leases.length === 1 ? '' : 's'}.`,
    );
  }

  if (state.hideout) {
    body.push('Split Rock Camp is off the surveyed country, and in your own hand.');
  }

  const reward = rewardFor(state);
  if (reward > 0) {
    body.push(
      `The notice pinned in the margin is your own: ${formatMoney(reward)} to the man who can take you.`,
    );
  }

  return {
    screen: 'camp',
    title: 'A MAP OF THE GOLDFIELDS',
    body,
    menu: [item('0', 'Back', { type: 'continue' })],
  };
}
