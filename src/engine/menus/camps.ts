/** The diggings themselves: the camp, the day's work, the tent store, the grog tent. */

import { hasKey, sayFixed } from '../../content/say';
import { canFloat } from '../company';
import {
  CAMP_DEFS,
  MATE_WAGE,
  PUDDLER_RENT,
  QUACK_FEE,
  STANDING_PARTNER,
  SHANTY_NOTORIETY,
} from '../constants';
import { METHOD_NAMES, checkMethod, hasMate, isWorkedOut, seasonEffect } from '../mining';
import { ownsThisShanty, receptionLine } from '../shamrock';
import { formatGold, formatMoney, pounds, shillings } from '../money';
import { campTalk } from '../news';
import { isLicensed, titleCase } from '../state';
import { formatDate, season, seasonPhrase } from '../time';
import { localTravelDays } from '../travel';
import type { CampId, GameState, MenuItem, MiningMethod, ScreenView } from '../types';
import { item, back } from './shared';
import { storeMenu, storeAside } from './store';
import { drinkMenu, shoutMenu } from './grog';
import { estateEntry } from './civic';
import { banditEntry } from './darkLadder';
import { companyEntryNote } from './companyOffice';

export function campView(state: GameState): ScreenView {
  const camp = state.location as CampId;
  const def = CAMP_DEFS[camp];
  const claim = state.claims[camp];
  // What is distinct about this camp today comes first, so that moving on
  // feels like arriving somewhere new.
  const body: string[] = [groundLine(state, camp), '', ...campCharacter(state, camp), ''];
  if (claim) {
    body.push(
      isWorkedOut(claim)
        ? 'Your stakes are in the ground, but the wash has gone off it entirely.'
        : claim.workedDays === 0
          ? 'Your stakes are in the ground, and not a sod of it turned yet.'
          : `Your stakes are in the ground, and you have worked it ${claim.workedDays} day${claim.workedDays === 1 ? '' : 's'}.`,
    );
    body.push(claim.registered ? 'The claim is entered in the Council ledger.' : 'The claim is unregistered.');
    if ((claim.guardedUntilDay ?? 0) >= state.day) body.push(`A watchman is paid through day ${claim.guardedUntilDay}.`);
  } else {
    body.push('You have pegged no claim here.');
  }
  if (state.partner) body.push('You are gone mates with a digger, share and share alike.');
  if (!isLicensed(state)) body.push('You have no licence. The troopers hunt diggers here.');
  if (state.shaft && state.shaft.camp === camp) {
    body.push(
      `Your shaft stands at ${state.shaft.depthFeet} feet${state.shaft.bottomed ? ', bottomed on payable wash' : ''}${state.shaft.timbered ? ', timbered' : ', untimbered'}.`,
    );
  }
  body.push('');
  body.push(campTalk(state));

  const menu: MenuItem[] = [
    item('1', 'Dig', { type: 'goto', screen: 'camp-mine' }, `spells of ${state.spellDays} days`),
    item('2', 'Peg a claim (twelve feet square)', { type: 'pegClaim' }, claim ? 'already pegged' : 'free, one to a camp', !!claim),
    item('3', "The camp storekeeper", { type: 'goto', screen: 'camp-store' }, 'food and equipment at camp prices; he buys gold poorly and may cheat the scales'),
    item('4', `Hire a mate — ${formatMoney(MATE_WAGE)} a day`, { type: 'hireMate', days: state.spellDays }, state.partner ? 'you have a partner already' : state.mateUntilDay >= state.day ? `you have a mate until day ${state.mateUntilDay}` : 'one rocks while the other shovels', state.partner),
    item('5', 'Rest a spell', { type: 'rest', days: state.spellDays }, `${state.spellDays} days`),
    item('6', `A camp "doctor" — ${formatMoney(QUACK_FEE)}`, { type: 'quack' }, 'a butcher by trade; I would rather be treated by a horse-coper', state.moneyPence < QUACK_FEE),
    item('7', 'Move on', { type: 'goto', screen: 'ftown-depart' }),
    item('8', 'Back to Slateford', { type: 'travelTo', place: 'fields-town' }),
    item('P', 'Try the ground with a dish', { type: 'prospect' }, state.items.pan < 1 ? 'you want a pan for it' : claim ? 'a day spent learning what your claim is worth' : 'a day spent learning what the field has left', state.items.pan < 1),
  ];
  if (claim) {
    menu.push(
      item('A', 'Give up the claim', { type: 'abandonClaim' }, isWorkedOut(claim) ? 'worked out; peg fresh ground and start again' : 'the pegs come out, and any man may take it'),
    );
    menu.push(item('W', 'Pay a watchman for seven days — 5s', { type: 'guardClaim', camp, days: 7 }, 'he stays when you leave; registration and standing reduce the risk further', state.moneyPence < shillings(5)));
  }
  if (state.partner) {
    menu.push(item('N', 'Part with your partner', { type: 'dissolvePartnership' }, 'and keep all you win, and do all the work'));
  } else {
    menu.push(
      item('N', 'Go mates with a digger', { type: 'takePartner' },
        state.standing >= STANDING_PARTNER ? 'no wage, but half the gold' : 'no man here knows you well enough yet',
        state.standing < STANDING_PARTNER),
    );
  }
  if (camp === 'deep-mountains') {
    menu.push(
      item(
        'C',
        state.company
          ? `The books of ${state.company.name}`
          : canFloat(state)
            ? 'Float a company of your own'
            : 'Ask about floating a company of your own',
        { type: 'goto', screen: 'company' },
        companyEntryNote(state),
      ),
    );
  }
  menu.push(
    item(
      'G',
      ownsThisShanty(state) ? 'Your own sly-grog shanty' : 'The grog tent',
      { type: 'goto', screen: 'camp-grog' },
      ownsThisShanty(state) ? 'no licence, no ledger, and it is yours' : 'illegal, and protected by the police for a fee',
    ),
  );
  if (state.shaft && state.shaft.camp === camp) {
    if (!state.shaft.timbered && state.items.timber > 0) {
      menu.push(item('T', 'Timber the shaft', { type: 'timberShaft' }, 'avoid cave-ins by installing timber supports'));
    }
    menu.push(item('X', 'Abandon the shaft', { type: 'abandonShaft' }, 'and start afresh somewhere else on your ground'));
  }
  if (state.secret && !state.secret.chased) {
    menu.push(item('S', "Follow the talk of Widow's Reef", { type: 'followRumour' }, 'it may be a hoax'));
  }
  if (state.items.journal > 0) menu.push(item('J', "Read The New Chum's Companion", { type: 'readJournal' }));
  const estate = estateEntry(state, 'E');
  if (estate) menu.push(estate);
  const bandit = banditEntry(state, 'B');
  if (bandit) menu.push(bandit);
  menu.push(item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`));
  return {
    screen: 'camp',
    title: def.name.toUpperCase(),
    subtitle: `${formatDate(state.day)} · ${titleCase(seasonPhrase(state.day))}`,
    body,
    menu,
  };
}

export function campMineView(state: GameState): ScreenView {
  const methods: MiningMethod[] = ['fossick', 'pan', 'cradle', 'puddle', 'dryblow', 'shaft', 'company'];
  const menu: MenuItem[] = [];
  let n = 1;
  for (const m of methods) {
    const chk = checkMethod(state, m);
    if (!chk.ok && (m === 'puddle' || m === 'dryblow' || m === 'company')) {
      // Methods peculiar to one camp are simply not offered elsewhere.
      const wrongPlace =
        (m === 'puddle' && state.location !== 'snakey-gully') ||
        (m === 'dryblow' && state.location !== 'secret-mine') ||
        (m === 'company' && state.location !== 'deep-mountains');
      if (wrongPlace) continue;
    }
    let note = chk.ok ? undefined : chk.reason;
    if (m === 'cradle' && chk.ok && !hasMate(state)) note = 'without a mate the yields are halved';
    // The warning about watching your dirt is on the camp screen already;
    // this row has a season to carry as well and cannot hold both.
    if (m === 'puddle' && chk.ok) note = `${formatMoney(PUDDLER_RENT)} a day to the owner`;
    if (m === 'company' && chk.ok) note = 'wages, and none of the gold is yours';
    // The season decides half of what a method is worth, so it is said here,
    // where the choice is made, and not left to be inferred from the takings.
    if (chk.ok) {
      const weather = seasonEffect(state, m).note;
      if (weather) note = note ? `${note}; ${weather}` : weather;
    }
    menu.push(
      item(String(n++), METHOD_NAMES[m], { type: 'mine', method: m, days: state.spellDays }, note, !chk.ok),
    );
  }
  menu.push(item('D', 'Length of a spell of work', { type: 'cycleSpell' }, `${state.spellDays} days`));
  menu.push(back('camp'));
  return {
    screen: 'camp-mine',
    title: 'HOW WILL YOU WORK?',
    subtitle: `A spell of ${state.spellDays} day${state.spellDays === 1 ? '' : 's'} · ${titleCase(seasonPhrase(state.day))}`,
    body: [
      'Cradling is the easiest and surest way of finding gold, but never in such',
      'large quantities as are possible with shaft mining.',
    ],
    menu,
  };
}

export function campStoreView(state: GameState): ScreenView {
  return {
    screen: 'camp-store',
    title: "THE STOREKEEPER'S TENT",
    body: [
      'The tent carries food and equipment at the freight-heavy prices of the fields.',
      'He buys gold below the bank rate. Watch his weights, or trust him at your cost.',
    ],
    menu: storeMenu(state, 'camp'),
    aside: storeAside(state),
  };
}

// The camp's grog tent: the same trade, worse liquor, and no licence (§30, §31.4).
export function campGrogView(state: GameState): ScreenView {
  const shanty = ownsThisShanty(state);
  return {
    screen: 'camp-grog',
    title: shanty ? 'YOUR OWN SLY-GROG SHANTY' : 'THE GROG TENT',
    body: [
      'The grog shops offer some relief to tired, lonely diggers. Some become fighting',
      'drunk, but most just relax. Grog shops are illegal, and most are protected by',
      'the police — for a fee.',
      '',
      receptionLine(state),
      ...(shanty
        ? ['', 'It is your tent, your rum, and your men drinking it.']
        : state.notoriety >= SHANTY_NOTORIETY && !state.estate.shanty
          ? [
              '',
              'The keeper has been asking after you by name, and lets it be known he',
              'would sell the place tomorrow to a man the traps already want.',
            ]
          : []),
    ],
    menu: [...drinkMenu(state, '1234'), ...shoutMenu(state, 'SP'), back('camp')],
  };
}

export function secretExpeditionView(state: GameState): ScreenView {
  const e = state.secretExpedition;
  const trail = e?.trail ?? 0;
  const clues = [
    'The old fire-hole is found, but the country beyond it is a blank of stone and glare.',
    'A line of shallow dish-holes leads away from the abandoned working.',
    'A broken pick-head and a cairn confirm that somebody followed this reef before you.',
    'Under the cairn is a scratched direction: THREE RED GUMS — BLACK LEADER.',
    'The black leader is under your feet. If the promised nugget exists, this is its bed.',
  ];
  return {
    screen: 'secret-expedition',
    title: 'THE SECRET WORKING',
    subtitle: `${formatDate(state.day)} · ${state.waterDays} days of water`,
    body: [
      'There is no camp here: no store, troopers, claims or company office. Only the',
      'abandoned holes and the story of The Southern Cross—a nugget said to be so large',
      'that two men could scarcely lift it from the earth.',
      'It is open desert, with no water within forty miles.',
      '',
      clues[Math.min(4, trail)],
      ...(e?.nuggetFound && !e.nuggetRecovered
        ? ['', `The Southern Cross lies exposed in the hole. At ${formatGold(e.nuggetCentiOz ?? 0)}, two men cannot move it.`]
        : e?.nuggetRecovered
          ? ['', 'The great nugget is packed on the hired dray. Nothing here can equal that moment again.']
          : []),
      ...(e?.exhausted && !e.nuggetFound ? ['', 'The trail has failed. More digging here would only spend water and life.'] : []),
    ],
    menu: [
      item('1', 'Search the old workings for the next sign', { type: 'searchSecret', approach: 'search' }, 'a hard day in the desert', !!e?.exhausted || !!e?.nuggetFound),
      item('2', 'Dig the black leader for The Southern Cross', { type: 'searchSecret', approach: 'dig' }, trail >= 4 ? 'the promised bed is found' : 'you have not followed the trail far enough', trail < 4 || !!e?.exhausted || !!e?.nuggetFound),
      item('3', 'Winnow a little dry dirt by hand', { type: 'searchSecret', approach: 'winnow' }, 'a small side chance for ordinary gold, not the purpose of the expedition', !!e?.exhausted),
      ...(e?.nuggetFound && !e.nuggetRecovered
        ? [item('R', 'Bring a dray and six men for The Southern Cross — £10', { type: 'recoverNugget' }, 'three days to rig, lift and pack it for the bank', state.moneyPence < pounds(10))]
        : []),
      item('4', 'Rest for a day', { type: 'rest', days: 1 }, 'save your strength, but water and food still go'),
      item('5', 'Turn back towards Slateford', { type: 'travelTo', place: 'fields-town' }, `${localTravelDays(state, 'fields-town')} days away`),
    ],
  };
}

/**
 * What this camp is, and what a man can do here that he can do nowhere else
 * (§21). The prose is fixed to the day so a screen looked at twice reads the
 * same twice.
 */
function campCharacter(state: GameState, camp: CampId): string[] {
  const lines: string[] = [sayFixed(`camp.${camp}.lead`, state.day * 31 + camp.length)];
  const weather = `camp.${camp}.${season(state.day)}`;
  if (hasKey(weather)) lines.push(sayFixed(weather, state.day * 17 + 5));

  // Then whatever there is here to be done about it.
  switch (camp) {
    case 'snakey-gully':
      lines.push(
        `The horse-powered puddling machine stands at the head of the gully; ${formatMoney(PUDDLER_RENT)} the day to the man who owns it, and watch your piece of dirt while he works it.`,
      );
      break;
    case 'deep-mountains':
      lines.push(
        state.company
          ? `The office of ${state.company.name} keeps its books at the end of the flat, and they are your books.`
          : canFloat(state)
            ? 'The company office is at the end of the flat, and the registrar is ready to write you up as a company of your own.'
            : `The company office is at the end of the flat: shares, wages underground, and a registrar who will tell you what is needed to float a company of your own.`,
      );
      break;
    case 'secret-mine':
      lines.push(
        'There is no water within forty miles. A little dirt may be winnowed by hand, but the legendary nugget is the reason to be here.',
      );
      break;
    default:
      break;
  }
  return lines;
}

/** What the ground here is like today — the first thing a man notices, and why camps differ. */
function groundLine(state: GameState, camp: CampId): string {
  if (state.rush && state.rush.camp === camp && state.rush.since <= state.day && state.rush.untilDay >= state.day) {
    const days = state.rush.untilDay - state.day + 1;
    return `A RUSH is on here. Every hole has three men in it, and the best of the ground will be pegged over inside ${days} day${days === 1 ? '' : 's'}.`;
  }
  const f = state.freshness[camp] ?? 1;
  if (f >= 1.25) return 'The ground here is all but untouched; the gullies have hardly been scratched.';
  if (f >= 1.0) return 'There is good ground here yet, and room enough to peg it.';
  if (f >= 0.8) return 'The flat has been well worked over, though there is gold in it still for a patient man.';
  if (f >= 0.6) return 'Old ground, this: mullock heaps to the skyline and the creek turned over twice.';
  return 'The field is picked clean. Whole streets of tents have gone elsewhere and left their holes behind.';
}
