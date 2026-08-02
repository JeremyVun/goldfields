/** Which screen a player is looking at, and the rules about where he may not be. */

import { isCamp } from '../state';
import type { GameState, ScreenView } from '../types';
import { homeScreenFor } from './shared';
import { estateView, pressView, courtView } from './civic';
import { banditView, roadsView, gangView, hideoutView, stashView } from './darkLadder';
import { hearthView, ballView, lettersView } from './hearthScreens';
import { companyView } from './companyOffice';
import { campView, campMineView, campStoreView, campGrogView, secretExpeditionView } from './camps';
import { encounterView } from './encounters';
import { endView, obituaryView } from './end';
import {
  titleView,
  resumeView,
  introView,
  suzeView,
  suzeWorkView,
  suzeStoreView,
  suzeLodgingsView,
  suzeHorsesView,
  suzeCrimeView,
  gazetteView,
  journalView,
  travelRouteView,
  travelModeView,
} from './port';
import {
  ftownView,
  ftownLodgingsView,
  ftownBankView,
  ftownStoreView,
  storeSellView,
  ftownCouncilView,
  ftownWorkView,
  ftownHospitalView,
  ftownHotelView,
  ftownGambleView,
  ftownTwoUpView,
  ftownCardsView,
  ftownDepartView,
} from './town';

/** Screens that only make sense with your boots on a camp's dirt. */
const CAMP_SCREENS = new Set(['camp', 'camp-store', 'camp-mine', 'camp-grog']);
const COMPANY_SCREENS = new Set(['company', 'company-crews', 'company-ground', 'company-policy', 'company-dividend']);
const TOWN_SCREENS = new Set([
  'ftown',
  'ftown-bank',
  'ftown-lodgings',
  'ftown-store',
  'ftown-council',
  'ftown-work',
  'ftown-hospital',
  'ftown-hotel',
  'ftown-gamble',
  'ftown-twoup',
  'ftown-cards',
]);
const PORT_SCREENS = new Set([
  'suze',
  'suze-work',
  'suze-store',
  'suze-lodgings',
  'suze-horses',
  'suze-crime',
  'travel-route',
  'travel-mode',
]);

/** Screens that only exist for a man with business in the ranges (§23). */
const BANDIT_SCREENS = new Set(['bandit', 'bandit-roads', 'gang']);
const HIDEOUT_SCREENS = new Set(['hideout', 'stash']);

export function getView(state: GameState): ScreenView {
  // An encounter that nothing is pending for has already been answered. Never
  // leave the player staring at a question with no action that resolves it.
  if (state.screen === 'encounter' && !state.pending) {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  // The camp in the ranges is not a place a man can be shown when he is not in
  // it, and there is no going to its screens from a public street.
  if (HIDEOUT_SCREENS.has(state.screen) && state.location !== 'hideout') {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  if (BANDIT_SCREENS.has(state.screen) && state.location === 'on-road') {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  // Defensive: a player carted off to Canvas House mid-shift must not be shown
  // a camp screen for a camp he is no longer standing in.
  if (CAMP_SCREENS.has(state.screen) && !isCamp(state.location)) {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  if (CAMP_SCREENS.has(state.screen) && state.location === 'secret-mine') {
    return getView({ ...state, screen: 'secret-expedition' });
  }
  // The company's books are at the workings and Council; its commercial business
  // is conducted with investors and shipping agents at Port Gannet.
  if (
    COMPANY_SCREENS.has(state.screen) &&
    state.location !== 'deep-mountains' &&
    state.location !== 'fields-town' &&
    state.location !== 'suze-port'
  ) {
    return getView({ ...state, screen: homeScreenFor(state) });
  }
  // Likewise, a man at the diggings cannot walk into the Bank of Australasia.
  if (TOWN_SCREENS.has(state.screen) && state.location !== 'fields-town') {
    if (state.screen === 'ftown-bank' && state.location === 'suze-port') {
      // The Port Gannet branch is the one exception.
    } else if (state.location !== 'on-road') {
      return getView({ ...state, screen: homeScreenFor(state) });
    }
  }
  if (PORT_SCREENS.has(state.screen) && state.location !== 'suze-port') {
    if (state.location !== 'on-road') return getView({ ...state, screen: homeScreenFor(state) });
  }
  switch (state.screen) {
    case 'title':
      return titleView();

    case 'resume':
      return resumeView();

    case 'intro':
      return introView();

    // --- Port Gannet -----------------------------------------------------
    case 'suze':
      return suzeView(state);

    case 'suze-work':
      return suzeWorkView(state);

    case 'suze-store':
      return suzeStoreView(state);

    case 'suze-lodgings':
      return suzeLodgingsView(state);

    case 'suze-horses':
      return suzeHorsesView(state);

    case 'suze-crime':
      return suzeCrimeView(state);

    // --- reading -------------------------------------------------------
    case 'gazette':
      return gazetteView(state);

    case 'journal':
      return journalView();

    // --- travel ---------------------------------------------------------
    case 'travel-route':
      return travelRouteView();

    case 'travel-mode':
      return travelModeView(state);

    // --- Slateford -----------------------------------------------------
    case 'ftown':
      return ftownView(state);

    case 'ftown-lodgings':
      return ftownLodgingsView(state);

    case 'ftown-bank':
      return ftownBankView(state);

    case 'ftown-store':
      return ftownStoreView(state);

    case 'store-sell':
      return storeSellView(state);

    case 'ftown-council':
      return ftownCouncilView(state);

    case 'ftown-work':
      return ftownWorkView(state);

    case 'ftown-hospital':
      return ftownHospitalView(state);

    case 'ftown-hotel':
      return ftownHotelView(state);

    case 'ftown-gamble':
      return ftownGambleView(state);

    case 'ftown-twoup':
      return ftownTwoUpView(state);

    case 'ftown-cards':
      return ftownCardsView(state);

    case 'camp-grog':
      return campGrogView(state);

    case 'ftown-depart':
      return ftownDepartView(state);

    case 'secret-expedition':
      return secretExpeditionView(state);

    // --- camps -----------------------------------------------------------
    case 'camp':
      return campView(state);

    case 'camp-mine':
      return campMineView(state);

    case 'camp-store':
      return campStoreView(state);

    case 'company':
    case 'company-crews':
    case 'company-ground':
    case 'company-policy':
    case 'company-dividend':
      return companyView(state);

    case 'hearth':
      return hearthView(state);

    case 'ball':
      return ballView(state);

    case 'letters':
      return lettersView(state);

    // --- the civic ladder (§26-§28) ---------------------------------------
    case 'estate':
      return estateView(state);

    case 'press':
      return pressView(state);

    case 'court':
      return courtView(state);

    // --- the dark ladder (§23) --------------------------------------------
    case 'bandit':
      return banditView(state);

    case 'bandit-roads':
      return roadsView(state);

    case 'gang':
      return gangView(state);

    case 'hideout':
      return hideoutView(state);

    case 'stash':
      return stashView(state);

    // --- encounters --------------------------------------------------------
    case 'encounter':
      return encounterView(state);

    // --- end ---------------------------------------------------------------
    case 'end':
      return endView(state);

    case 'obituary':
      return obituaryView(state);

    default: {
      const exhaustive: never = state.screen;
      return exhaustive;
    }
  }
}
