import { resolveMeeting, resolveStockade, type StockadeChoice } from '../agitation';
import {
  buyPassage,
  dismissGangMember,
  fenceGold,
  recruitGangMember,
  stash,
  takePardon,
  unstash,
} from '../bandit';
import {
  abandonLease,
  buyBackShares,
  buyBattery,
  declareDividend,
  fireCrew,
  hireCrew,
  installPlant,
  sellOut,
  sellOwnShares,
  setCrewTask,
  setDriving,
  setLeasePlan,
} from '../company';
import { endDay, passKeptDays } from '../daily';
import {
  acceptCommission,
  buyGazetteShare,
  buyShamrock,
  buyShanty,
  openStore,
  retainLawyer,
  ruleOn,
  setStorePolicy,
  fundWork,
} from '../estate';
import {
  attendBall,
  buyCottage,
  canReconcile,
  consignGoods,
  giveGift,
  holdWedding,
  homeStash,
  homeUnstash,
  keepHearthEvent,
  payAddresses,
  proposeBanns,
  readLetters,
  reconcile,
  sendRemittance,
} from '../hearth';
import { buyLicence } from '../law';
import {
  buyGreens,
  buyHorse,
  buyItem,
  sellItem,
  buyProvisions,
  fillWater,
  sellGold,
} from '../market';
import {
  abandonClaim,
  dissolvePartnership,
  hireMate,
  hirePumpman,
  pegClaim,
  takePartner,
  timberShaft,
} from '../mining';
import { Log } from '../narrate';
import type { RNG } from '../rng';
import { clone, createInitialState, isCamp, recordWorth } from '../state';
import type { Action, CampId, GameState, StepResult } from '../types';
import { actionPayloadValid } from './validate';
import { handleAssizesChoice, handleBailUpChoice, handleClaimJumper, handlePatrolChoice } from './darkEncounters';
import { handleBushrangerChoice, handleTrooperChoice, resumePending } from './encounters';
import { screenForLocation } from './screen';
import { advanceKept, runTask } from './tasks';
import { beginNextYear, cycleSpell, saveGame, startNewGame } from './actions/framing';
import {
  buyMeal,
  fishForFood,
  inspectHorse,
  readGazette,
  sellSalvage,
  setLodging,
  steal,
  takeWork,
} from './actions/port';
import {
  chooseRoute,
  coach,
  followRumour,
  recoverNugget,
  searchSecret,
  travel,
  travelTo,
} from './actions/travel';
import { deposit, guardClaim, prospect, quack, registerClaim, withdraw } from './actions/town';
import {
  cardsDecision,
  drink,
  gamble,
  shoutBar,
  startGamble,
  twoUpCall,
  twoUpCollect,
} from './actions/gambling';
import { mine, rentPuddler } from './actions/diggings';
import { companyRelations, companySupplyContract, floatCompanyAction } from './actions/company';
import { holdCourtAction, placeStoryAction } from './actions/civic';
import {
  bailUpOnTheRoad,
  gatherIntelligenceAction,
  makeHideoutAction,
  robBankAction,
  robEscortAction,
} from './actions/dark';

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

function settle(state: GameState, log: Log): void {
  if (state.gameOver) state.pending = null;
  // The camp in the ranges is the one screen that can outlive the place it
  // belongs to: a raid takes it away under the player's feet.
  if (
    (state.screen === 'hideout' || state.screen === 'stash') &&
    (state.location !== 'hideout' || !state.hideout)
  ) {
    state.screen = screenForLocation(state.location === 'hideout' ? 'deep-mountains' : state.location);
  }
  // A question raised anywhere in the engine is put to the player, whatever he
  // thought he was doing.
  if (state.pending && !state.endOfYear && state.screen !== 'encounter') {
    state.screen = 'encounter';
  }
  if (state.gameOver === 'dead') {
    // The Times prints a man's death once, not every time he is spoken to.
    if (state.screen !== 'obituary') {
      state.screen = 'obituary';
      log.say('end.obituary', undefined, 'grave');
    }
    return;
  }
  if (state.gameOver === 'finished') {
    if (state.screen !== 'end') {
      state.screen = 'end';
      recordWorth(state);
    }
    return;
  }
  if (state.endOfYear && state.screen !== 'end') {
    state.screen = 'end';
    log.say('end.summary', undefined, 'title');
    // The last reading of the year, taken after the dividends are in, so the
    // chart ends where the tally does (§21).
    recordWorth(state);
  }
}

export function step(state: GameState, action: Action, rng: RNG): StepResult {
  const s = clone(state);
  rng.restore(s.rngState);
  const log = new Log(rng);

  apply(s, action, rng, log);

  settle(s, log);
  s.rngState = rng.save();
  return { state: s, events: log.events };
}

function apply(s: GameState, action: Action, rng: RNG, log: Log): void {
  if (!actionPayloadValid(action)) {
    log.raw('That quantity is not one the clerk can enter in the ledger.', 'bad');
    return;
  }
  // Encounters swallow everything until answered.
  if (s.pending && s.screen === 'encounter') {
    if (s.pending.kind === 'claimJumper') {
      handleClaimJumper(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'trooper') {
      handleTrooperChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'bushrangers') {
      handleBushrangerChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'patrol' || s.pending.kind === 'hideoutRaid') {
      handlePatrolChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'bailup') {
      handleBailUpChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'shantyRaid') {
      // Nothing to answer: the place is ash, and there is nobody to complain
      // to about it (§28.3).
      s.pending = null;
      s.screen = screenForLocation(s.location);
      resumePending(s, rng, log);
      return;
    }
    if (s.pending.kind === 'assizes') {
      handleAssizesChoice(s, rng, log, action);
      return;
    }
    if (s.pending.kind === 'pardon') {
      takePardon(s, log, action.type === 'takePardon' && action.take);
      resumePending(s, rng, log);
      return;
    }
    if (s.pending.kind === 'meeting') {
      resolveMeeting(s, rng, log, action.type === 'attendMeeting' && action.attend, (days) => advanceKept(s, rng, log, days));
      resumePending(s, rng, log);
      return;
    }
    if (s.pending.kind === 'stockade') {
      const choice: StockadeChoice =
        action.type === 'joinStockade'
          ? 'join'
          : action.type === 'sellSupplies'
            ? 'sellSupplies'
            : 'keepClear';
      resolveStockade(s, rng, log, choice, (days) => advanceKept(s, rng, log, days));
      // A refused sale leaves the question standing.
      if (s.pending) return;
      resumePending(s, rng, log);
      return;
    }
  }

  switch (action.type) {
    // --- framing -------------------------------------------------------
    case 'start':
      s.screen = 'title';
      return;

    case 'newGame': {
      startNewGame(s, rng, log, action);
      return;
    }

    case 'resumePrompt':
      s.screen = 'resume';
      return;

    case 'resume':
      Object.assign(s, action.state);
      rng.restore(s.rngState);
      log.raw('The game is resumed where you left it.', 'good');
      return;

    case 'continue':
      if (s.screen === 'intro') s.screen = 'suze';
      else if (s.screen === 'obituary') s.screen = 'title';
      else s.screen = screenForLocation(s.location);
      return;

    case 'goto':
      // Choosing a route arms a journey for the travel-mode screen; backing out
      // of it must not leave that half-made journey lying about in the state.
      if (s.journey && s.location !== 'on-road' && action.screen !== 'travel-mode') {
        s.journey = null;
      }
      s.screen = action.screen;
      return;

    case 'cycleSpell': {
      cycleSpell(s, log);
      return;
    }

    case 'quitToTitle':
      Object.assign(s, createInitialState(s.seed));
      s.screen = 'title';
      return;

    case 'save': {
      saveGame(s, rng, log, action);
      return;
    }

    case 'finish':
      s.gameOver = 'finished';
      return;

    case 'nextYear':
      beginNextYear(s, rng, log);
      return;

    // --- Port Gannet -----------------------------------------------------
    case 'work': {
      takeWork(s, rng, log, action);
      return;
    }

    case 'buy':
      buyItem(s, log, action.item, action.qty ?? 1);
      return;

    case 'sellItem':
      sellItem(s, log, action.item);
      return;

    case 'buyProvisions':
      buyProvisions(s, log, action.weeks);
      return;

    case 'buyGreens':
      buyGreens(s, log);
      return;

    case 'fillWater':
      fillWater(s, log);
      return;

    case 'buyHorse':
      buyHorse(s, rng, log, action.kind);
      return;

    case 'inspectHorse': {
      inspectHorse(s, rng, log, action);
      return;
    }

    case 'buyMeal':
      buyMeal(s, log);
      return;

    case 'fishForFood': {
      fishForFood(s, rng, log);
      return;
    }

    case 'setLodging': {
      setLodging(s, log, action);
      return;
    }

    case 'sellSalvage': {
      sellSalvage(s, rng, log);
      return;
    }

    case 'readGazette': {
      readGazette(s, rng, log);
      return;
    }

    case 'readJournal':
      if (s.items.journal < 1) {
        log.raw('You have no copy of the Journal.', 'bad');
        return;
      }
      s.screen = 'journal';
      return;

    case 'steal': {
      steal(s, rng, log, action);
      return;
    }

    // --- travel --------------------------------------------------------
    case 'chooseRoute':
      chooseRoute(s, action);
      return;

    case 'travel': {
      travel(s, rng, log, action);
      return;
    }

    case 'coach': {
      coach(s, rng, log);
      return;
    }

    case 'travelTo': {
      travelTo(s, rng, log, action);
      return;
    }

    case 'followRumour': {
      followRumour(s, rng, log);
      return;
    }

    case 'searchSecret': {
      searchSecret(s, rng, log, action);
      return;
    }

    case 'recoverNugget': {
      recoverNugget(s, rng, log);
      return;
    }

    // --- Slateford ---------------------------------------------------
    case 'deposit': {
      deposit(s, log, action);
      return;
    }

    case 'withdraw': {
      withdraw(s, log, action);
      return;
    }

    case 'sellGold':
      sellGold(s, rng, log, action.where, action.watch);
      return;

    case 'buyLicence':
      buyLicence(s, log);
      return;

    case 'registerClaim': {
      registerClaim(s, log, action);
      return;
    }

    case 'guardClaim': {
      guardClaim(s, log, action);
      return;
    }

    case 'pegClaim':
      if (!isCamp(s.location)) {
        log.raw('You must be on the ground to peg it.', 'bad');
        return;
      }
      pegClaim(s, rng, log, s.location as CampId);
      return;

    case 'abandonClaim':
      if (!isCamp(s.location)) {
        log.raw('You have no ground here to give up.', 'neutral');
        return;
      }
      abandonClaim(s, log, s.location as CampId);
      return;

    case 'prospect': {
      prospect(s, rng, log);
      return;
    }

    case 'complain':
      log.raw(
        rng.pick([
          'The clerk writes your complaint in a fine round hand, blots it, and puts it in a drawer with a great many others.',
          'A councillor hears you out. He owns the store, the hotel and the carting business, and agrees that something ought to be done.',
          'You complain of the state of the roads. So, it appears, has every man in the colony.',
          'You complain of the licence fee. The clerk observes that there will be rebellion soon, and goes back to his ledger.',
        ]),
        'neutral',
      );
      return;

    case 'hospital':
      runTask(s, rng, log, { kind: 'hospital', days: action.days });
      return;

    case 'quack': {
      quack(s, rng, log);
      return;
    }

    // The room reads him, and then serves him (§30.1, priced by §31.4).
    case 'drink': {
      drink(s, rng, log, action);
      return;
    }

    case 'shoutBar': {
      shoutBar(s, rng, log, action);
      return;
    }

    case 'startGamble': {
      startGamble(s, rng, log, action);
      return;
    }

    case 'twoUpCall': {
      twoUpCall(s, rng, log, action);
      return;
    }

    case 'twoUpCollect': {
      twoUpCollect(s, log);
      return;
    }

    case 'cardsDecision': {
      cardsDecision(s, rng, log, action);
      return;
    }

    case 'gamble': {
      gamble(s, rng, log, action);
      return;
    }

    // --- the diggings ---------------------------------------------------
    case 'mine': {
      mine(s, rng, log, action);
      return;
    }

    case 'hireMate':
      hireMate(s, log, action.days);
      return;

    case 'takePartner':
      takePartner(s, log);
      return;

    case 'dissolvePartnership':
      dissolvePartnership(s, log);
      return;

    case 'rentPuddler': {
      rentPuddler(s, log, action);
      return;
    }

    case 'timberShaft':
      if (timberShaft(s, log)) endDay(s, rng, log, { toil: true });
      return;

    case 'abandonShaft':
      if (!s.shaft) {
        log.raw('You have no shaft.', 'neutral');
        return;
      }
      s.shaft = null;
      log.raw('You leave the hole to fill with water and rubbish, as ten thousand others have been left.', 'neutral');
      return;

    case 'rest':
      runTask(s, rng, log, { kind: 'rest', days: action.days });
      return;

    // --- your own company ------------------------------------------------
    case 'floatCompany': {
      floatCompanyAction(s, rng, log, action);
      return;
    }

    case 'hireCrew':
      hireCrew(s, log);
      return;

    case 'fireCrew':
      fireCrew(s, log);
      return;

    case 'setCrewTask':
      setCrewTask(s, log, action.index, action.task, action.lease);
      return;

    case 'setLeasePlan':
      setLeasePlan(s, log, action.lease, action.plan);
      return;

    case 'installPlant':
      installPlant(s, log, action.lease, action.plant);
      return;

    case 'buyBattery':
      buyBattery(s, log);
      return;

    case 'setDriving':
      setDriving(s, log, action.rate);
      return;

    case 'abandonLease':
      abandonLease(s, log, action.lease);
      return;

    case 'hirePumpman':
      hirePumpman(s, log);
      return;

    case 'declareDividend':
      declareDividend(s, log, action.perShare);
      return;

    case 'sellOwnShares':
      sellOwnShares(s, rng, log, action.n);
      if (!s.company) s.screen = screenForLocation(s.location);
      return;

    case 'buyBackShares':
      buyBackShares(s, log, action.n);
      return;

    case 'sellOut':
      if (!s.company) {
        log.raw('You have no company to sell out of.', 'neutral');
        return;
      }
      sellOut(s, log);
      s.screen = screenForLocation(s.location);
      return;

    case 'companyRelations': {
      companyRelations(s, rng, log);
      return;
    }

    case 'companySupplyContract':
      companySupplyContract(s, rng, log);
      return;

    // --- the civic ladder (§26-§28) --------------------------------------
    case 'buyShamrock':
      buyShamrock(s, log);
      return;

    case 'openStore':
      openStore(s, log, action.camp);
      return;

    case 'setStorePolicy':
      setStorePolicy(s, log, action.policy);
      return;

    case 'buyGazetteShare':
      buyGazetteShare(s, log);
      return;

    case 'placeStory': {
      placeStoryAction(s, rng, log, action);
      return;
    }

    case 'fundWork':
      fundWork(s, log, action.work, action.camp);
      return;

    // --- Hearth & kin ---------------------------------------------------
    case 'attendBall':
      if (attendBall(s, rng, log)) endDay(s, rng, log, {});
      return;

    case 'payAddresses':
      payAddresses(s, log);
      return;

    case 'callAtThePort':
      if (keepHearthEvent(s, log)) endDay(s, rng, log, {});
      return;

    case 'giveGift':
      giveGift(s, log, action.lavish);
      return;

    case 'proposeBanns':
      proposeBanns(s, rng, log);
      return;

    case 'holdWedding':
      if (holdWedding(s, log)) endDay(s, rng, log, {});
      return;

    case 'buyCottage':
      buyCottage(s, log, action.size);
      return;

    case 'homeStash':
      homeStash(s, log, action.what, action.amount);
      return;

    case 'homeUnstash':
      homeUnstash(s, log, action.what, action.amount);
      return;

    case 'consignGoods':
      consignGoods(s, rng, log);
      return;

    case 'sendRemittance':
      sendRemittance(s, log, action.amount);
      return;

    case 'readLetters':
      readLetters(s, log);
      return;

    case 'seekReconciliation':
      if (!canReconcile(s)) return;
      passKeptDays(s, rng, log, 30);
      if (!s.gameOver && !s.endOfYear) reconcile(s, log);
      return;

    case 'acceptCommission':
      acceptCommission(s, log);
      return;

    case 'holdCourt': {
      holdCourtAction(s, rng, log);
      return;
    }

    case 'rule':
      if (s.screen !== 'court') {
        log.raw('The court is not sitting.', 'neutral');
        return;
      }
      ruleOn(s, log, action.ruling);
      s.screen = screenForLocation(s.location);
      return;

    case 'buyShanty':
      if (!isCamp(s.location)) {
        log.raw('Sly grog is sold at the diggings, not in a town with a licensed house in it.', 'bad');
        return;
      }
      buyShanty(s, log, s.location as CampId);
      return;

    case 'retainLawyer':
      retainLawyer(s, log);
      return;

    // --- the dark ladder (§23-§24) --------------------------------------
    case 'bailUp': {
      bailUpOnTheRoad(s, rng, log, action);
      return;
    }

    case 'makeHideout': {
      makeHideoutAction(s, rng, log);
      return;
    }

    case 'stash':
      stash(s, log, action.what, action.amount);
      return;

    case 'unstash':
      unstash(s, log, action.what, action.amount);
      return;

    case 'recruitGangMember':
      recruitGangMember(s, rng, log);
      return;

    case 'dismissGangMember':
      dismissGangMember(s, log, action.index);
      return;

    case 'gatherIntelligence': {
      gatherIntelligenceAction(s, rng, log);
      return;
    }

    case 'fenceGold':
      fenceGold(s, rng, log);
      return;

    case 'robBank': {
      robBankAction(s, rng, log);
      return;
    }

    case 'robEscort': {
      robEscortAction(s, rng, log);
      return;
    }

    case 'buyPassage':
      buyPassage(s, rng, log, (days) => advanceKept(s, rng, log, days));
      if (s.pending) s.screen = 'encounter';
      return;

    // --- encounters when nothing is pending -----------------------------
    case 'bribe':
    case 'submit':
    case 'resist':
    case 'flee':
    case 'bailUpTake':
    case 'letPass':
    case 'breakGaol':
    case 'awaitAssizes':
    case 'takePardon':
    case 'watchWeighing':
    case 'answerClaimJumper':
    case 'attendMeeting':
    case 'joinStockade':
    case 'keepClear':
    case 'sellSupplies':
      return;

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
