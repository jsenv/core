/*
 * A popup opened as a question, whose answer the opener awaits: a card thrown
 * off a list asks "delete it?", and the throw lands or flies home on the
 * answer. The answer is how the popup closed, and navi owns every way it can
 * close — a yes (`--navi-confirm`, a send inside), and everything else.
 *
 * The opening is the one `--navi-open` makes, so the popup stays the popup:
 * uncontrolled, its own say over closing. How the close finds its way back to
 * the asker is popup_ask_chain.js.
 */

import { findEvent } from "@jsenv/dom";

import { triggerNaviCommand } from "../control/commands.js";
import { chainPopupAsk } from "./popup_ask_chain.js";

/**
 * Opens a popup as `--navi-open` does, and answers once it has closed.
 *
 * ```js
 * toss: async (event) => {
 *   const { confirmed } = await askPopup(dialogEl, event, { value: alertId });
 *   if (!confirmed) {
 *     throw undefined; // the card goes home, nothing said
 *   }
 * };
 * ```
 *
 * `confirmed` is the close saying yes: a `--navi-confirm`, or a send the popup
 * closed on (a `<Form>` inside it, a row's `--navi-send`). Any other way out is
 * a no — Escape, the backdrop, the cross, a link leaving, Back, the popup
 * leaving the page. It settles after the popup's own `onClose`, and once the
 * action of the yes has run: a button's command waits for its action.
 *
 * Asked again while its answer is pending — the popup still open — the earlier
 * ask is answered no (its `closeEvent` is then the request that took its
 * place) and this one waits for the close; the popup stays open on what it
 * was opened on.
 *
 * @param {Element} element The element asking, as for triggerNaviCommand: the
 *   popup itself, or an element whose `commandfor` names it.
 * @param {Event} event What caused the question — forwarded, as
 *   triggerNaviCommand requires.
 * @param {object} [options]
 * @param {any} [options.value] What the popup is opened ON (its `onOpen`
 *   reads it in `detail.value`).
 * @param {Element} [options.anchor] Where it opens, when not on `element`.
 * @returns {Promise<{ confirmed: boolean, closeEvent: CustomEvent }>}
 *   Rejected with `undefined` when nothing opened — no popup found, or the
 *   popup refused the opening: what a gesture's answer reads as a refusal
 *   to say nothing about.
 */
export const askPopup = (element, event, { value, anchor } = {}) => {
  return new Promise((resolve, reject) => {
    const ask = {
      taken: false,
      answer: (closeEvent) => {
        resolve({ confirmed: closeSaysYes(closeEvent), closeEvent });
      },
      // Asked again before the close: no close of its own to answer with, so
      // the request that took its place is handed over instead.
      supersede: (requestOpenEvent) => {
        resolve({ confirmed: false, closeEvent: requestOpenEvent });
      },
    };
    const askEvent = chainPopupAsk(event, ask);
    triggerNaviCommand(element, "--navi-open", askEvent, { value, anchor });
    // An opening is decided within its request, whatever builds or animates it
    // afterwards: not taken by now, it was not let through.
    if (!ask.taken) {
      reject(undefined);
    }
  });
};

// "sent" is what a send's follow-up is chained to (createSentEvent in
// commands.js): the popup closed because what it held went through.
const closeSaysYes = (closeEvent) => {
  const { detail } = closeEvent;
  if (detail.isCancel) {
    return false;
  }
  return Boolean(
    detail.isConfirm || detail.isSend || findEvent(closeEvent, "sent"),
  );
};
