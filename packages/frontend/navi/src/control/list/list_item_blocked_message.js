import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";

// What a row may say it is waiting on, all of them about the row as a thing
// the LIST holds: joining it, leaving it, or being saved where it is. A
// selectable row waiting on the list's own send is a different event with a
// different subject — the selection, not the row (see list_selectable.jsx).
const LOADING_REASON_SET = new Set(["adding", "removing", "updating"]);

/**
 * What a row waiting on something has to say when it is pressed. `loading` may
 * say WHAT it is waiting for: a row being created is not simply "busy", and
 * saying which one it is tells the user what to expect.
 *
 * Shared with the selectable row, which carries the same `loading` on the
 * hidden input holding its selection — the row and that control must answer a
 * press with one sentence, whichever of them catches it.
 */
export const listItemBusyMessage = (loading, props) => {
  if (LOADING_REASON_SET.has(loading)) {
    return naviI18n(`constraint.busy.item.${loading}`, props);
  }
  return naviI18n("constraint.busy.item", props);
};

/** Why the row cannot be acted on, in the row's own terms. */
export const listItemBlockedMessage = (loading, props) => {
  if (!loading) {
    return naviI18n("constraint.readonly.item", props);
  }
  return listItemBusyMessage(loading, props);
};
