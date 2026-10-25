/*
 * What ties an askPopup() to the opening it asked for (see popup_ask.js): an
 * event in the opening's chain, which the popup's open controller takes when
 * that opening goes through and answers when that same opening ends (see
 * open_controller.js). Asked of the chain rather than of the element: a
 * picker opens a popup that is not the element the command was aimed at, and a
 * popup standing in builds itself in the very request (see
 * popup_stand_in.js) — the chain survives both.
 *
 * Apart from askPopup itself, which triggers the command: the open controller
 * reads this, and the commands read the open controller.
 */

import { chainEvent, findEvent } from "@jsenv/dom";

const POPUP_ASK_EVENT_TYPE = "navi_popup_ask";
const askByEvent = new WeakMap();

/**
 * The event an opening asked by askPopup() is triggered with, chained to the
 * event that caused the question.
 */
export const chainPopupAsk = (event, ask) => {
  const askEvent = new CustomEvent(POPUP_ASK_EVENT_TYPE, { detail: {} });
  chainEvent(askEvent, event);
  askByEvent.set(askEvent, ask);
  return askEvent;
};

/**
 * The ask behind an opening request, handed once to the open controller
 * letting that opening through (or already open): `answer(closeEvent)` is what
 * it calls when that opening ends, `supersede(requestOpenEvent)` when another
 * ask takes its place.
 */
export const takePopupAsk = (requestOpenEvent) => {
  const askEvent = findEvent(requestOpenEvent, POPUP_ASK_EVENT_TYPE);
  if (!askEvent) {
    return null;
  }
  const ask = askByEvent.get(askEvent);
  if (!ask || ask.taken) {
    return null;
  }
  ask.taken = true;
  return ask;
};
