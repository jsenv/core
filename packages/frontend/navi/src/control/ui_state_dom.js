import { dispatchInternalCustomEvent } from "@jsenv/dom";

import { findControlHost } from "./control_dom.js";

export const dispatchRequestSetUIState = (element, value, detail) => {
  const controlHost = findControlHost(element) || element;
  return dispatchInternalCustomEvent(controlHost, "navi_set_ui_state", {
    ...detail,
    value,
  });
};
export const dispatchRequestResetUIState = (element, e) => {
  return dispatchInternalCustomEvent(element, "navi_request_reset_ui_state", {
    event: e,
  });
};
export const getUIStateFromElement = (el) => {
  let uiState;
  dispatchInternalCustomEvent(el, "navi_get_ui_state", {
    respondWith: (v) => {
      uiState = v;
    },
  });
  return uiState;
};
