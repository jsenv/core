import { dispatchInternalCustomEvent } from "@jsenv/dom";

import { findControlHost } from "./control_dom.js";

export const dispatchRequestSetUIState = (element, value, detail) => {
  const controlHost = findControlHost(element) || element;
  return dispatchInternalCustomEvent(controlHost, "navi_set_ui_state", {
    ...detail,
    value,
  });
};
export const dispatchRequestClearUIState = (element, e) => {
  const controlHost = findControlHost(element) || element;
  return dispatchInternalCustomEvent(controlHost, "navi_clear_ui_state", {
    event: e,
  });
};
export const dispatchRequestResetUIState = (element, e) => {
  const controlHost = findControlHost(element) || element;
  return dispatchInternalCustomEvent(controlHost, "navi_reset_ui_state", {
    event: e,
  });
};
/**
 * @param {Element} el
 * @param {{ own?: boolean }} [options] `own`: what the element holds BY ITSELF.
 *   Only a button ever answers differently — one with no value of its own
 *   inherits the value of the control around it, which is what makes
 *   `--navi-send` on a form's button be about that form. Something asking what
 *   THIS element says (a travel command reading what the travel is about) wants
 *   the own value and would otherwise be handed the surrounding control's.
 */
export const getUIStateFromElement = (el, { own } = {}) => {
  let uiState;
  dispatchInternalCustomEvent(el, "navi_get_ui_state", {
    own,
    respondWith: (v) => {
      uiState = v;
    },
  });
  return uiState;
};
