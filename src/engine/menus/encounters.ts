/** What steps out of the scrub, or comes up the gully, and must be answered. */

import { agitationWord, canSellSupplies } from '../agitation';
import { canBreakGaol } from '../bandit';
import { BAILUP_VICTIMS, CAMP_DEFS, STOCKADE_CAMP } from '../constants';
import { formatMoney } from '../money';
import { stashWorth } from '../state';
import type { CampId, GameState, ScreenView } from '../types';
import { item } from './shared';

export function encounterView(state: GameState): ScreenView {
  if (state.pending?.kind === 'claimJumper') {
    const camp = state.pending.data?.camp as CampId;
    const claim = state.claims[camp];
    return {
      screen: 'encounter',
      title: 'STRANGERS ON YOUR CLAIM',
      body: [
        'Two men have shifted your pegs and put down a shallow hole. One says the ground was deserted; the other keeps a hand near his belt. They know who you are—or do not.',
        '',
        claim?.registered
          ? 'Your claim is in the Council ledger, with its date and boundaries.'
          : 'You never registered the ground. At the Council it would be your word against theirs.',
      ],
      menu: [
        item('1', 'Order them off and stand your ground', { type: 'answerClaimJumper', choice: 'confront' }, 'standing, a gun and a mate all strengthen your hand'),
        item('2', 'Take the dispute to the Council', { type: 'answerClaimJumper', choice: 'council' }, claim?.registered ? 'lose two days, but registered ground is hard to steal' : 'without registration the result is doubtful'),
        item('3', 'Pull your remaining pegs and walk away', { type: 'answerClaimJumper', choice: 'abandon' }),
      ],
    };
  }
  if (state.pending?.kind === 'bailup') return bailUpView(state);
  if (state.pending?.kind === 'patrol' || state.pending?.kind === 'hideoutRaid') {
    return patrolView(state);
  }
  if (state.pending?.kind === 'shantyRaid') return shantyRaidView(state);
  if (state.pending?.kind === 'assizes') return assizesView(state);
  if (state.pending?.kind === 'pardon') return pardonView(state);
  if (state.pending?.kind === 'meeting') {
    return {
      screen: 'encounter',
      title: 'A MONSTER MEETING',
      body: [
        'They are lighting torches on the flat below the camp, and men are coming in from every gully with their hats off and their pipes out. There will be speeches against the fee, against the Commissioner, and against the hunts; a hundred men will put their names to a petition and a good many more will shout for something a deal stronger than a petition.',
        '',
        `The field is ${agitationWord(state.agitation)} on the licence question tonight.`,
      ],
      menu: [
        item('1', 'Go down and stand with them', { type: 'attendMeeting', attend: true },
          state.legal === 'honest'
            ? 'a man is known by the meetings he is seen at'
            : 'and the traps take names, and they have yours already'),
        item('2', 'Keep to your tent', { type: 'attendMeeting', attend: false }, 'politics never washed a dish of dirt'),
      ],
    };
  }
  if (state.pending?.kind === 'stockade') {
    const canSell = canSellSupplies(state);
    return {
      screen: 'encounter',
      title: `THE STOCKADE AT ${CAMP_DEFS[STOCKADE_CAMP].name.toUpperCase()}`,
      body: [
        'The diggers have thrown up a stockade of slabs and overturned drays on the flat, and hoisted a flag of their own over it — the Cross of the south, in white on blue. Inside, men are drilling with pikes made that afternoon and swearing by the Southern Cross to stand by each other. The soldiers are camped a mile off and everybody knows what the morning brings.',
        '',
        'It will not hold. Everybody knows that too.',
      ],
      menu: [
        item('1', 'Go in behind the slabs with them', { type: 'joinStockade' }, 'and take what comes of it'),
        item('2', 'Keep well clear of the whole business', { type: 'keepClear' }, 'you came out to dig gold, not to be shot at'),
        item(
          '3',
          'Sell to both sides while you may',
          { type: 'sellSupplies' },
          canSell ? 'flour and powder fetch what you ask tonight; the field will remember it' : 'you have nothing either side would buy',
          !canSell,
        ),
      ],
    };
  }
  if (state.pending?.kind === 'trooper') {
    return {
      screen: 'encounter',
      title: 'A TROOPER HAS YOU',
      body: [
        'A rough-looking sergeant has you by the collar and wants to see a licence you have not got. A lot of the police are good men following orders, and a lot are as corrupt as five-day-old fish.',
      ],
      menu: [
        item('1', 'Offer him a five pound note', { type: 'bribe' }, 'a fiver is a good-sized bribe for most troopers', state.moneyPence < 1200),
        item('2', 'Go quietly to the logs', { type: 'submit' }, 'and wait for the travelling magistrate'),
        item('3', 'Make a run for the scrub', { type: 'resist' }, 'if he catches you it will go the worse'),
      ],
    };
  }
  return {
    screen: 'encounter',
    title: 'BAILED UP',
    body: [
      'Two men step out of the scrub with their faces covered. So many villains are drawn here that you should be armed.',
    ],
    menu: [
      item('1', state.items.gun > 0 ? 'Show them your loaded piece' : 'Fight them', { type: 'resist' }, state.items.gun > 0 ? 'they usually think better of it' : 'unarmed, and against two'),
      item('2', 'Hand over what you have', { type: 'submit' }, 'you cannot complain about it when you are dead'),
    ],
  };
}

/** How each sort of traveller takes it, once the word is said. */
const VICTIM_STAND: Record<string, string> = {
  newchum:
    'The lad has his hands up before the word is out of your mouth, and higher than they need to be. He has read about this in a book on the ship.',
  digger:
    'It is a digger with his year under his shirt. A digger’s pile is a year of wet feet and bad water, and the field does not forgive the man who takes one.',
  squatter:
    'The horses are pulled up hard and the gentleman on the box is the colour of his own wool. He is calculating what the box under the seat is worth to him.',
  chinese:
    'They set the poles down in the dust together, without a word between them, and wait. They have done this before and they know how long it takes.',
  parson:
    'He does not put his hands up. He looks at the pistol, and then past it at you, and asks whether you would not rather have his dinner and his blessing.',
  buyer:
    'The driver reaches for something under the seat and thinks better of it. The box is there under the tarpaulin, and every man on this road knows what is in it.',
  trooper:
    'The carbine is across his saddle and his hand is on it, and he is looking at you the way a man looks at a thing he will describe under oath.',
};

/** The traveller stands in the road with his hands where you can see them. */
function bailUpView(state: GameState): ScreenView {
  const id = String(state.pending?.data?.victim ?? 'newchum');
  const victim = BAILUP_VICTIMS.find((v) => v.id === id);
  const digger = !!victim?.digger;
  const knows = state.pending?.data?.knows === true;
  // A party on the road is "them"; everybody else on the table is one man.
  const them = id === 'chinese';
  const him = them ? 'them' : 'him';
  const stand =
    VICTIM_STAND[id] ??
    'He has stopped. He is weighing you, the pistol, the distance to the timber, and how much he minds losing what he is carrying.';
  return {
    screen: 'encounter',
    title: 'STAND AND DELIVER',
    body: [
      'You step out of the timber with the pistol up and the word said, and the whole business now turns on the next half minute and on nothing else.',
      '',
      stand,
      ...(knows
        ? [
            '',
            them
              ? 'They have heard the name before, and none of them has the least intention of being the party that argued with it.'
              : 'He has heard the name before, and it is plain in his face that he has no intention whatever of being the man who argued with it.',
          ]
        : []),
    ],
    menu: [
      item('1', `Order ${him} to deliver`, { type: 'bailUpTake', shoot: false }, `and take what ${them ? 'they have' : 'he has'}`),
      item('2', `Cover ${him}, and fire if ${them ? 'they move' : 'he moves'}`, { type: 'bailUpTake', shoot: true }, 'they hang men for what may follow'),
      item(
        '3',
        `Let ${him} go by`,
        { type: 'letPass' },
        digger ? 'a digger’s pile is safe with you, and the camps will hear of it' : 'and take nothing at all',
      ),
    ],
  };
}

/** Troopers, and three ways of answering them. */
function patrolView(state: GameState): ScreenView {
  const raid = state.pending?.kind === 'hideoutRaid';
  return {
    screen: 'encounter',
    title: raid ? 'THE CAMP IS FOUND' : 'TROOPERS',
    body: raid
      ? [
          'They are coming up the only way in, on foot and spread out, and there is a sergeant behind them with a warrant and a great deal of patience. The stash is under the stone at your feet and there is no time to lift it.',
        ]
      : [
          'Mounted police, and they have seen you. There is a carbine across the nearest saddle and a description of you in the sergeant’s pocket that he has read so often he could recite it.',
        ],
    menu: [
      item('1', 'Ride for the gullies', { type: 'flee' }, state.horse === 'none' ? 'afoot, which is how men are taken' : 'what a horse and a knowledge of the country are for'),
      item('2', 'Stand and fight them', { type: 'resist' }, state.items.gun > 0 ? 'and cross the line there is no coming back over' : 'unarmed, against carbines'),
      item('3', 'Put your hands where they can see them', { type: 'submit' }, state.outlawed ? 'and answer for it at the assizes' : 'and take what the magistrate gives'),
    ],
  };
}

/** Waiting on the judge who is coming up from the capital (§24). */
function assizesView(state: GameState): ScreenView {
  const canBreak = canBreakGaol(state);
  return {
    screen: 'encounter',
    title: 'THE SLATEFORD LOCK-UP',
    body: [
      'A slab hut with a chain running through it and a trooper on the door. The monthly magistrate is not mentioned; you are for the assizes, and a judge is coming up from the capital for the purpose.',
      '',
      state.bloodShed
        ? 'There is blood on this account. Everybody in the hut knows what the assizes do about blood, and nobody says it.'
        : 'No man died at your hands, which is the whole of the difference between the yard and the hulks.',
      '',
      canBreak
        ? 'Word comes in with the bread that there are men on this field willing to be somewhere else at two in the morning.'
        : 'Nobody outside is offering to be anywhere near this wall tonight.',
    ],
    menu: [
      item(
        '1',
        'Try the wall tonight',
        { type: 'breakGaol' },
        canBreak ? 'two chances in five, and the sentence doubled if it fails' : 'there is nobody out there who would risk it for you',
        !canBreak,
      ),
      item('2', 'Wait for the assizes', { type: 'awaitAssizes' }, 'and let the judge say it'),
    ],
  };
}

/** The amnesty that followed December, offered once (§24). */
function pardonView(state: GameState): ScreenView {
  return {
    screen: 'encounter',
    title: 'THE AMNESTY',
    body: [
      'The men taken at the stockade have been tried and acquitted to a man, and the Government, having lost the licence, has no appetite left for hanging anybody. A magistrate who saw you behind the slabs sends word: the amnesty is a wide one, and he is willing to read it widely.',
      '',
      `It will cost the whole of the stash — ${formatMoney(stashWorth(state))} — paid into the court as restitution, and the proclamation against you is withdrawn. The name stays; the price on it goes.`,
    ],
    menu: [
      item('1', 'Take the pardon', { type: 'takePardon', take: true }, 'everything under the stone, for the right to be nobody again'),
      item('2', 'Refuse it', { type: 'takePardon', take: false }, 'and stay out in the ranges with what you have'),
    ],
  };
}

/** The morning after the troopers came for the shanty (§28.3). */
function shantyRaidView(state: GameState): ScreenView {
  const camp = state.pending?.data?.camp;
  return {
    screen: 'encounter',
    title: 'THE TRAPS BURN OUT THE SHANTY',
    body: [
      'They came down on the place at four in the morning with axes and a lamp, staved in every cask, took the scales away on a pack-horse and put a match to the bark roof. There is nothing to be done and nobody to complain to: the shanty was never on any paper in this colony, which was the whole of its value until this morning.',
      '',
      typeof camp === 'string'
        ? `Eighty pounds, gone at ${CAMP_DEFS[camp as CampId].name} in under an hour.`
        : 'Eighty pounds, gone in under an hour.',
    ],
    menu: [item('1', 'Watch it burn, and say nothing', { type: 'continue' })],
  };
}
