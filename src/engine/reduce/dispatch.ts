import {
  dismissGangMember,
  fenceGold,
  recruitGangMember,
  stash,
  unstash,
} from '../bandit';
import {
  abandonLease,
  advanceTreasury,
  buyBackShares,
  buyBattery,
  declareDividend,
  fireCrew,
  hireCrew,
  installPlant,
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
  openStore,
  retainLawyer,
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
import { dissolvePartnership, hireMate, hirePumpman, takePartner, timberShaft } from '../mining';
import { Log } from '../narrate';
import type { RNG } from '../rng';
import { clone, createInitialState } from '../state';
import type { Action, GameState, StepResult } from '../types';
import { answerPendingEncounter } from './answer';
import { screenForLocation, settle } from './screen';
import { runTask } from './tasks';
import { actionPayloadValid } from './validate';
import { beginNextYear, cycleSpell, saveGame, startNewGame } from './actions/framing';
import {
  buyMeal,
  fishForFood,
  inspectHorse,
  readGazette,
  readJournal,
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
import { complain, deposit, guardClaim, prospect, quack, registerClaim, withdraw } from './actions/town';
import {
  cardsDecision,
  drink,
  gamble,
  shoutBar,
  startGamble,
  twoUpCall,
  twoUpCollect,
} from './actions/gambling';
import { abandonClaimAction, abandonShaft, mine, pegClaimAction, rentPuddler } from './actions/diggings';
import {
  companyRelations,
  companySupplyContract,
  floatCompanyAction,
  sellOutAction,
} from './actions/company';
import { buyShantyAction, holdCourtAction, placeStoryAction, ruleAction } from './actions/civic';
import {
  bailUpOnTheRoad,
  buyPassageAction,
  gatherIntelligenceAction,
  makeHideoutAction,
  robBankAction,
  robEscortAction,
} from './actions/dark';

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

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
  if (answerPendingEncounter(s, rng, log, action)) return;

  switch (action.type) {
    // --- framing -------------------------------------------------------
    case 'start':
      s.screen = 'title';
      return;

    case 'newGame':
      startNewGame(s, rng, log, action);
      return;

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

    case 'cycleSpell':
      cycleSpell(s, log);
      return;

    case 'quitToTitle':
      Object.assign(s, createInitialState(s.seed));
      s.screen = 'title';
      return;

    case 'save':
      saveGame(s, rng, log, action);
      return;

    case 'finish':
      s.gameOver = 'finished';
      return;

    case 'nextYear':
      beginNextYear(s, rng, log);
      return;

    // --- Port Gannet -----------------------------------------------------
    case 'work':
      takeWork(s, rng, log, action);
      return;

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

    case 'inspectHorse':
      inspectHorse(s, rng, log, action);
      return;

    case 'buyMeal':
      buyMeal(s, log);
      return;

    case 'fishForFood':
      fishForFood(s, rng, log);
      return;

    case 'setLodging':
      setLodging(s, log, action);
      return;

    case 'sellSalvage':
      sellSalvage(s, rng, log);
      return;

    case 'readGazette':
      readGazette(s, rng, log);
      return;

    case 'readJournal':
      readJournal(s, log);
      return;

    case 'steal':
      steal(s, rng, log, action);
      return;

    // --- travel --------------------------------------------------------
    case 'chooseRoute':
      chooseRoute(s, action);
      return;

    case 'travel':
      travel(s, rng, log, action);
      return;

    case 'coach':
      coach(s, rng, log);
      return;

    case 'travelTo':
      travelTo(s, rng, log, action);
      return;

    case 'followRumour':
      followRumour(s, rng, log);
      return;

    case 'searchSecret':
      searchSecret(s, rng, log, action);
      return;

    case 'recoverNugget':
      recoverNugget(s, rng, log);
      return;

    // --- Slateford ---------------------------------------------------
    case 'deposit':
      deposit(s, log, action);
      return;

    case 'withdraw':
      withdraw(s, log, action);
      return;

    case 'sellGold':
      sellGold(s, rng, log, action.where, action.watch);
      return;

    case 'buyLicence':
      buyLicence(s, log);
      return;

    case 'registerClaim':
      registerClaim(s, log, action);
      return;

    case 'guardClaim':
      guardClaim(s, log, action);
      return;

    case 'pegClaim':
      pegClaimAction(s, rng, log);
      return;

    case 'abandonClaim':
      abandonClaimAction(s, log);
      return;

    case 'prospect':
      prospect(s, rng, log);
      return;

    case 'complain':
      complain(rng, log);
      return;

    case 'hospital':
      runTask(s, rng, log, { kind: 'hospital', days: action.days });
      return;

    case 'quack':
      quack(s, rng, log);
      return;

    // The room reads him, and then serves him (§30.1, priced by §31.4).
    case 'drink':
      drink(s, rng, log, action);
      return;

    case 'shoutBar':
      shoutBar(s, rng, log, action);
      return;

    case 'startGamble':
      startGamble(s, rng, log, action);
      return;

    case 'twoUpCall':
      twoUpCall(s, rng, log, action);
      return;

    case 'twoUpCollect':
      twoUpCollect(s, log);
      return;

    case 'cardsDecision':
      cardsDecision(s, rng, log, action);
      return;

    case 'gamble':
      gamble(s, rng, log, action);
      return;

    // --- the diggings ---------------------------------------------------
    case 'mine':
      mine(s, rng, log, action);
      return;

    case 'hireMate':
      hireMate(s, log, action.days);
      return;

    case 'takePartner':
      takePartner(s, log);
      return;

    case 'dissolvePartnership':
      dissolvePartnership(s, log);
      return;

    case 'rentPuddler':
      rentPuddler(s, log, action);
      return;

    case 'timberShaft':
      if (timberShaft(s, log)) endDay(s, rng, log, { toil: true });
      return;

    case 'abandonShaft':
      abandonShaft(s, log);
      return;

    case 'rest':
      runTask(s, rng, log, { kind: 'rest', days: action.days });
      return;

    // --- your own company ------------------------------------------------
    case 'floatCompany':
      floatCompanyAction(s, rng, log, action);
      return;

    case 'hireCrew':
      hireCrew(s, log);
      return;

    case 'advanceTreasury':
      advanceTreasury(s, log, action.amountPence);
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
      sellOutAction(s, log);
      return;

    case 'companyRelations':
      companyRelations(s, rng, log);
      return;

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

    case 'placeStory':
      placeStoryAction(s, rng, log, action);
      return;

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

    case 'holdCourt':
      holdCourtAction(s, rng, log);
      return;

    case 'rule':
      ruleAction(s, log, action);
      return;

    case 'buyShanty':
      buyShantyAction(s, log);
      return;

    case 'retainLawyer':
      retainLawyer(s, log);
      return;

    // --- the dark ladder (§23-§24) --------------------------------------
    case 'bailUp':
      bailUpOnTheRoad(s, rng, log, action);
      return;

    case 'makeHideout':
      makeHideoutAction(s, rng, log);
      return;

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

    case 'gatherIntelligence':
      gatherIntelligenceAction(s, rng, log);
      return;

    case 'fenceGold':
      fenceGold(s, rng, log);
      return;

    case 'robBank':
      robBankAction(s, rng, log);
      return;

    case 'robEscort':
      robEscortAction(s, rng, log);
      return;

    case 'buyPassage':
      buyPassageAction(s, rng, log);
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
