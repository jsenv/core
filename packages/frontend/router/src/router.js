import * as HistoryModule from "./history/history.js";
import * as NavModule from "./nav/nav.js";

export let navigationInstalled = false;

export const canUseNavigation = Boolean(window.navigation);
export const installNavigation = canUseNavigation
  ? (...args) => {
      navigationInstalled = true;
      NavModule.installNavigation(...args);
    }
  : (...args) => {
      navigationInstalled = true;
      HistoryModule.installNavigation(...args);
    };

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
