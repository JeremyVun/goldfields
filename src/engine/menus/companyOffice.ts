/** The registrar's office, and the books of a company once it is floated. */

import {
  canFloat,
  developWeeksNeeded,
  floatRequirements,
  leaseIsWet,
  leaseWord,
  purse,
  subscriptionCost,
} from '../company';
import {
  COMPANY_CREW_WAGES,
  COMPANY_BATTERY_COST,
  COMPANY_DRIVE_COST,
  COMPANY_MAX_CREWS,
  COMPANY_PUMP_PLANT,
  COMPANY_REGISTRATION_FEE,
  COMPANY_SHARES,
  COMPANY_SINK_COST,
  COMPANY_SUBSCRIPTIONS,
  COMPANY_TIMBER_PLANT,
} from '../constants';
import { formatGold, formatMoney, pounds, shillings } from '../money';
import { companyWorth } from '../state';
import { formatDate } from '../time';
import type { AsideRow, Company, Crew, GameState, Lease, MenuItem, ScreenView } from '../types';
import { item, MENU_LETTERS, back, warned } from './shared';

function developProgress(lease: Lease): string {
  return `${lease.progressCrewWeeks} of ${developWeeksNeeded(lease)} crew-weeks`;
}

/** The verb a crew put to develop this lease would answer to. */
function developVerb(lease: Lease): string {
  if (lease.flooded) return 'de-water';
  return lease.plan === 'sink' ? 'sink' : lease.plan === 'drive' ? 'drive' : 'develop';
}

/**
 * What stands between a crew and any development work on this lease. A shut
 * row cannot be highlighted, so the reason travels in the alert as well.
 */
function developBar(lease: Lease): { alert: string; note: string } | null {
  if (lease.flooded && !lease.pump) {
    return { alert: 'wants a pump', note: 'a pumping plant must be installed before the water can be got out' };
  }
  if (!lease.flooded && leaseIsWet(lease) && !lease.pump) {
    return { alert: 'wants a pump', note: 'wet ground: install a pumping plant before it can be worked' };
  }
  if (!lease.flooded && !lease.plan) {
    return { alert: 'no work ordered', note: 'choose sinking or driving under Manage the mines first' };
  }
  return null;
}

/** Where a crew stands this week, as the manager would report it to the books. */
function crewWord(c: Company, crew: Crew): { text: string; idle: boolean } {
  const working = (text: string) => ({ text, idle: false });
  const idle = (text: string) => ({ text, idle: true });
  if (crew.task === 'prospect') return working('prospecting the ranges');
  const lease = crew.lease !== undefined ? c.leases[crew.lease] : c.leases[0];
  if (!lease) return idle('no ground to work');
  if (crew.task === 'mine') return working(`at the reef, ${lease.name}`);
  if (lease.flooded) {
    return lease.pump
      ? working(`de-watering ${lease.name}, ${developProgress(lease)}`)
      : idle(`idle at ${lease.name}, wanting a pump`);
  }
  if (leaseIsWet(lease) && !lease.pump) return idle(`idle at ${lease.name}, wanting a pump`);
  if (!lease.plan) return idle(`idle at ${lease.name}, no work ordered`);
  return working(`${lease.plan === 'sink' ? 'sinking' : 'driving'} ${lease.name}, ${developProgress(lease)}`);
}

export function companyEntryNote(state: GameState): string {
  if (state.company) return 'treasury, scrip, crews and leases';
  const reqs = floatRequirements(state);
  const met = reqs.filter((r) => r.met).length;
  return met === reqs.length
    ? 'all requirements met — the registrar has the ledger open'
    : `${met} of ${reqs.length} requirements met — see what the registrar still needs`;
}

/** The company office: the prospectus if there is no company, the books if there is. */
export function companyView(state: GameState): ScreenView {
  const c = state.company;
  const where = state.location === 'deep-mountains' ? 'camp' : state.location === 'suze-port' ? 'suze' : 'ftown';

  if (!c) {
    const reqs = floatRequirements(state);
    const body: string[] = [
      'The registrar keeps a ledger of companies, a box of blank scrip and a pot of sealing wax. Twenty shares to a company, ten pounds the share: the promoter takes what he will carry, and the public are invited to the rest.',
      '',
      `Registration fee: ${formatMoney(COMPANY_REGISTRATION_FEE)}. Before he will write you up he requires:`,
    ];
    for (const r of reqs) body.push(`  ${r.met ? '✓' : '✗'} ${r.text}`);
    if (!reqs.every((r) => r.met)) {
      body.push('');
      body.push('Come back when you can answer for all of it.');
    }
    const ok = canFloat(state);
    const menu: MenuItem[] = COMPANY_SUBSCRIPTIONS.map((n, i) => {
      const outlay = COMPANY_REGISTRATION_FEE + subscriptionCost(n);
      return item(
        String(i + 1),
        `Subscribe ${n} of the twenty shares — ${formatMoney(subscriptionCost(n))}`,
        { type: 'floatCompany', shares: n },
        `with the fee, ${formatMoney(outlay)} down; ${20 - n} shares offered to the public`,
        !ok || purse(state) < outlay,
      );
    });
    menu.push(back(where));
    return {
      screen: 'company',
      title: 'THE REGISTRAR OF COMPANIES',
      subtitle: 'Twenty shares at ten pounds',
      body,
      menu,
    };
  }

  const worth = companyWorth(state);

  if (state.screen === 'company-crews') {
    const menu: MenuItem[] = [];
    c.crews.forEach((crew, crewIndex) => {
      c.leases.forEach((lease, leaseIndex) => {
        const bar = developBar(lease);
        menu.push(
          item(
            MENU_LETTERS[menu.length],
            `No. ${crewIndex + 1} crew: mine ${lease.name}`,
            { type: 'setCrewTask', index: crewIndex, task: 'mine', lease: leaseIndex },
            leaseWord(lease),
            crew.task === 'mine' && crew.lease === leaseIndex,
          ),
          warned(
            MENU_LETTERS[menu.length + 1],
            `No. ${crewIndex + 1} crew: ${developVerb(lease)} ${lease.name}`,
            { type: 'setCrewTask', index: crewIndex, task: 'develop', lease: leaseIndex },
            bar?.alert,
            bar?.note
              ?? (lease.flooded
                ? `the pump is set; ${developProgress(lease)} to clear her`
                : `${lease.plan}ing is ordered — ${developProgress(lease)} done, and each crew-week advances it`),
            !!bar || (crew.task === 'develop' && crew.lease === leaseIndex),
          ),
        );
      });
      menu.push(
        item(
          MENU_LETTERS[menu.length],
          `No. ${crewIndex + 1} crew: prospect the ranges`,
          { type: 'setCrewTask', index: crewIndex, task: 'prospect' },
          c.leases.length >= 2 ? 'new finds extend the poorest existing mine' : 'look for a second named mine',
          crew.task === 'prospect',
        ),
      );
    });
    menu.push(back('company'));
    return {
      screen: 'company-crews',
      title: 'THE CREWS',
      subtitle: c.name,
      body: c.crews.length
        ? [
            'Every crew draws its wage, at work or not. A mining crew breaks stone at a bottomed level; a developing crew sinks, drives or pumps out the one mine it is put to, and wins nothing while it does.',
            '',
            'Development must be ordered first under Manage the mines: until sinking or driving is set there, no crew can be put to develop.',
          ]
        : [
            'There are no men on the books. Crews are taken on at the workings in the Blackcap Ranges, and nowhere else.',
          ],
      menu,
    };
  }

  if (state.screen === 'company-ground') {
    const developing = (leaseIndex: number) =>
      c.crews.some((k) => k.task === 'develop' && (k.lease ?? 0) === leaseIndex);
    const body = c.leases.length
      ? [
          'Ground is taken up by prospecting crews and worked level by level. What is given here is the order only: a crew must be put to develop the mine under Assign the crews before a foot of it is sunk or driven.',
          '',
          ...c.leases.flatMap((lease, i) => {
            const lines = [
              `${i + 1}. ${leaseWord(lease)}.`,
              `   ${lease.pump ? 'Pumping plant installed' : 'No pumping plant'}; ${lease.timbered ? 'timbered throughout' : 'no standing timber-work'}.`,
            ];
            if (lease.flooded) {
              lines.push(
                lease.pump
                  ? `   Full of water: a developing crew pumps her out, ${developProgress(lease)}.`
                  : '   Full of water, and no plant to get it out.',
              );
            } else if (lease.plan) {
              lines.push(
                `   Ordered to ${lease.plan}: ${developProgress(lease)} done${developing(i) ? '' : ', and no crew is put to it'}.`,
              );
            } else {
              lines.push('   No development ordered.');
            }
            return lines;
          }),
        ]
      : ['The company holds no ground. Put a crew to prospect the ranges for it.'];
    const menu: MenuItem[] = [];
    c.leases.forEach((lease, i) => {
      const prefix = c.leases.length > 1 ? `${i + 1}. ` : '';
      menu.push(
        item(MENU_LETTERS[menu.length], `${prefix}Sink ${lease.name} to the next level`, { type: 'setLeasePlan', lease: i, plan: 'sink' }, leaseIsWet(lease) && !lease.pump ? 'install a pumping plant before working below the water' : `${formatMoney(COMPANY_SINK_COST)} in materials each developing crew-week`, lease.plan === 'sink' || (leaseIsWet(lease) && !lease.pump)),
        item(MENU_LETTERS[menu.length + 1], `${prefix}Drive along the present level`, { type: 'setLeasePlan', lease: i, plan: 'drive' }, leaseIsWet(lease) && !lease.pump ? 'install a pumping plant before working below the water' : `${formatMoney(COMPANY_DRIVE_COST)} and one developing crew-week; a cheaper chance at a fresh face`, lease.level === 0 || lease.plan === 'drive' || (leaseIsWet(lease) && !lease.pump)),
        item(MENU_LETTERS[menu.length + 2], `${prefix}Install a pumping plant — ${formatMoney(COMPANY_PUMP_PLANT)}`, { type: 'installPlant', lease: i, plant: 'pump' }, 'needed for wet or deep ground; paid from the treasury', lease.pump || c.treasuryPence < COMPANY_PUMP_PLANT),
        item(MENU_LETTERS[menu.length + 3], `${prefix}Set standing timber-work — ${formatMoney(COMPANY_TIMBER_PLANT)}`, { type: 'installPlant', lease: i, plant: 'timber' }, 'halves the chance of a cave-in; paid from the treasury', lease.timbered || c.treasuryPence < COMPANY_TIMBER_PLANT),
        item(MENU_LETTERS[menu.length + 4], `${prefix}Abandon ${lease.name}`, { type: 'abandonLease', lease: i }, 'forfeit every level and item of plant in this mine'),
      );
    });
    menu.push(back('company'));
    return { screen: 'company-ground', title: 'THE MINES', subtitle: c.name, body, menu };
  }

  if (state.screen === 'company-policy') {
    return {
      screen: 'company-policy',
      title: 'PLANT AND POLICY',
      subtitle: c.name,
      body: [
        `The mine is driven ${c.driving}. ${c.battery ? 'The company owns its stamping battery.' : 'A public battery takes fifteen per cent of every crushing.'}`,
        `Treasury: ${formatMoney(c.treasuryPence)}.`,
      ],
      menu: [
        item('1', 'Drive cautiously', { type: 'setDriving', rate: 'cautious' }, 'less stone, half the cave-in risk and slower wear', c.driving === 'cautious'),
        item('2', 'Drive at the ordinary rate', { type: 'setDriving', rate: 'ordinary' }, 'the manager’s usual balance of output and risk', c.driving === 'ordinary'),
        item('3', 'Drive her hard', { type: 'setDriving', rate: 'hard' }, 'more stone now, twice the cave-in risk and faster exhaustion', c.driving === 'hard'),
        item('B', `Raise a stamping battery — ${formatMoney(COMPANY_BATTERY_COST)}`, { type: 'buyBattery' }, `${formatMoney(COMPANY_BATTERY_COST)} capital and £3 a week upkeep; crushing fees end`, c.battery || c.treasuryPence < COMPANY_BATTERY_COST),
        back('company'),
      ],
    };
  }

  if (state.screen === 'company-dividend') {
    const issued = c.sharesOwned + c.sharesPublic;
    const dividends: [string, number][] = [['1', shillings(5)], ['2', shillings(10)], ['3', pounds(1)]];
    return {
      screen: 'company-dividend',
      title: 'DECLARE A DIVIDEND',
      subtitle: `${c.name} · treasury ${formatMoney(c.treasuryPence)}`,
      body: ['A dividend is paid on every issued share. Your part comes to hand; the public’s leaves the company.'],
      menu: [
        ...dividends.map(([key, per]) => item(key, `${formatMoney(per)} the share`, { type: 'declareDividend', perShare: per }, `${formatMoney(per * issued)} from treasury; ${formatMoney(per * c.sharesOwned)} to you`, per * issued > c.treasuryPence)),
        back('company'),
      ],
    };
  }

  // The books are a ledger, not prose, and there are a dozen things a director
  // may do about them. Stacked one above the other they cannot both be read,
  // so the books stand in a pane of their own and the actions get the height.
  const rows: AsideRow[] = [
    { label: 'Treasury', value: formatMoney(c.treasuryPence), tone: c.treasuryPence <= 0 ? 'bad' : undefined },
    { label: 'Price of the day', value: `${formatMoney(c.sharePricePence)} the share` },
    { label: 'Your holding', value: formatMoney(worth) },
    { label: 'Wages', value: `${formatMoney(COMPANY_CREW_WAGES)} the week, each crew` },
    { label: 'Port relations', value: `${Math.round(c.relations ?? 0)}/100` },
    { label: 'Supply contract', value: (c.supplyContractUntilDay ?? 0) >= state.day ? `through day ${c.supplyContractUntilDay}` : 'none' },
    { label: 'Shares', value: '', heading: true },
    { label: 'Yours', value: String(c.sharesOwned) },
    { label: 'With the public', value: String(c.sharesPublic) },
    { label: 'Unsold', value: String(c.sharesUnsold) },
    { label: 'The crews', value: '', heading: true },
  ];
  if (c.crews.length === 0) {
    rows.push({ label: 'None at work', value: 'nothing is got out of it', tone: 'bad' });
  } else {
    c.crews.forEach((k, i) => {
      const word = crewWord(c, k);
      rows.push({ label: `No. ${i + 1}`, value: word.text, tone: word.idle ? 'bad' : undefined });
    });
  }
  if (c.leases.length) {
    rows.push({ label: 'The ground', value: '', heading: true });
    c.leases.forEach((l, i) => rows.push({ label: `Lease ${i + 1}`, value: leaseWord(l) }));
  }

  const body: string[] = [`Founded on day ${c.foundedOn}.`];
  if (c.crews.length === 0) {
    body.push('There are no men on the books. Crews are taken on at the workings in the Blackcap Ranges.');
  } else if (c.leases.length === 0) {
    body.push('The company holds no ground. A prospecting crew must find it before a shovel can be put in.');
  }
  const trail = c.weekProfitPence.slice(-6);
  if (trail.length) {
    // A run of sums set as a sentence wraps in the middle of a figure and can
    // be neither read nor compared. Ruled off in aligned columns, oldest
    // first, the shape of the quarter can be seen at a glance.
    const cells = trail.map((p) => (p >= 0 ? `+${formatMoney(p)}` : `-${formatMoney(-p)}`));
    const w = Math.max(...cells.map((t) => t.length));
    body.push('');
    body.push(`The last ${cells.length} week${cells.length === 1 ? '' : 's'}, oldest first:`);
    for (let i = 0; i < cells.length; i += 3) {
      body.push('  ' + cells.slice(i, i + 3).map((t) => t.padStart(w)).join('   '));
    }
  }
  if (c.lastWeekGoldCentiOz > 0) {
    body.push('');
    body.push(`The crews washed ${formatGold(c.lastWeekGoldCentiOz)} last week.`);
  }

  const issued = c.sharesOwned + c.sharesPublic;
  const menu: MenuItem[] = [];
  if (state.location === 'suze-port') {
    menu.push(item('R', 'Call on investors and agents — 10s, one day', { type: 'companyRelations' }, 'better relations improve public share demand and confidence', state.moneyPence < shillings(10) || (c.relations ?? 0) >= 100));
    const supplied = (c.supplyContractUntilDay ?? 0) >= state.day;
    menu.push(item('Q', supplied ? `Supplies contracted through day ${c.supplyContractUntilDay}` : 'Arrange a four-week supply contract — £4', { type: 'companySupplyContract' }, supplied ? 'the present contract must run its course before another is made' : 'costs £4 now; trims crew wages and weekly operating costs by ten per cent for 28 days', supplied || state.moneyPence < pounds(4)));
  }
  menu.push(item('1', 'Assign the crews', { type: 'goto', screen: 'company-crews' }, c.crews.length === 0 ? 'no men on the books; they are taken on at the workings' : 'put each crew to mining a named mine, to its development, or to prospecting', c.crews.length === 0));
  menu.push(item('2', 'Manage the mines', { type: 'goto', screen: 'company-ground' }, 'order sinking or driving, install plant, or abandon ground; a crew must then be put to the work'));
  menu.push(item('3', 'Plant and driving policy', { type: 'goto', screen: 'company-policy' }, 'risk, output and the company stamping battery'));
  menu.push(
    item(
      'H',
      `Take on a crew — ${formatMoney(COMPANY_CREW_WAGES)} the week`,
      { type: 'hireCrew' },
      state.location === 'deep-mountains'
        ? 'four wages-men, engaged at the workings'
        : 'men are taken on at the workings, not by letter',
      state.location !== 'deep-mountains' ||
        c.crews.length >= COMPANY_MAX_CREWS ||
        c.treasuryPence < COMPANY_CREW_WAGES,
    ),
  );
  menu.push(
    item(
      'A',
      `Advance ${formatMoney(pounds(10))} to the treasury`,
      { type: 'advanceTreasury', amountPence: pounds(10) },
      'your own money, given to the company outright',
      purse(state) < pounds(10),
    ),
  );
  menu.push(item('F', 'Pay off a crew', { type: 'fireCrew' }, undefined, c.crews.length === 0));
  menu.push(item('D', 'Declare a dividend', { type: 'goto', screen: 'company-dividend' }, 'choose the amount per issued share', issued <= 0));
  menu.push(
    item('S', `Sell one share at ${formatMoney(c.sharePricePence)}`, { type: 'sellOwnShares', n: 1 }, 'if there is any appetite for it', c.sharesOwned <= 0),
  );
  menu.push(
    item('V', 'Sell five shares', { type: 'sellOwnShares', n: 5 }, 'fewer than five retained and you are out of it altogether', c.sharesOwned <= 0),
  );
  menu.push(
    item('K', `Buy back a share at ${formatMoney(c.sharePricePence)}`, { type: 'buyBackShares', n: 1 }, undefined,
      c.sharesPublic + c.sharesUnsold <= 0 || state.moneyPence < c.sharePricePence),
  );
  menu.push(
    item('X', 'Sell out of the company entirely', { type: 'sellOut' }, `${formatMoney(worth)} for the scrip and your share of treasury, and your name off the door`),
  );
  menu.push(back(where));
  return {
    screen: 'company',
    title: c.name.toUpperCase(),
    subtitle: `${formatDate(state.day)} · ${c.sharesOwned} shares of ${COMPANY_SHARES}`,
    body,
    menu,
    aside: { title: 'The books', rows },
  };
}
