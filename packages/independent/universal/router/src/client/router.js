import * as HistoryModule from "./history/history.js";
import * as NavModule from "./nav/nav.js";

const canUseNavigation = Boolean(window.navigation);
export const installNavigation = canUseNavigation
  ? NavModule.installNavigation
  : HistoryModule.installNavigation;

export const goTo = canUseNavigation ? NavModule.goTo : HistoryModule.goTo;
export const stopLoad = canUseNavigation
  ? NavModule.stopLoad
  : HistoryModule.stopLoad;
export const reload = canUseNavigation
  ? NavModule.reload
  : HistoryModule.reload;
export const goBack = canUseNavigation
  ? NavModule.goBack
  : HistoryModule.goBack;
export const goForward = canUseNavigation
  ? NavModule.goForward
  : HistoryModule.goForward;
