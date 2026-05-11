/**
 * Navi uses three categories of custom events:
 *
 * 1. **Internal events** (`dispatchInternalCustomEvent`) — a component communicates
 *    with other navi components internally. Not meant to be observed from outside.
 *    They do not bubble so they stay contained within the subtree that handles them.
 *    Names often reflect their internal nature (e.g. `navi_pseudo_state_request_check`).
 *
 * 2. **Public events** (`dispatchPublicCustomEvent`) — a component exposes information
 *    about something that happened (e.g. `navi_list_select`). They bubble so any
 *    ancestor can observe them. These are part of the public API and should be documented.
 *
 * 3. **Request events** (`dispatchCustomEvent`) — code *outside* a component asks it
 *    to perform an action (e.g. `navi_list_request_open`). They are cancelable so the
 *    component can signal whether it handled the request. Names are prefixed
 *    with `request_` by convention.
 */

import { getElementSignature } from "./element_signature.js";

/**
 * Dispatches an internal event on `el`.
 * Does not bubble — stays within the local subtree.
 */
export const dispatchInternalCustomEvent = (
  el,
  customEventName,
  customEventDetail,
) => {
  const customEvent = new CustomEvent(customEventName, {
    detail: customEventDetail,
  });
  return el.dispatchEvent(customEvent);
};

/**
 * Dispatches a public event from `el`, announcing something that happened.
 * Bubbles so any ancestor can observe it.
 */
export const dispatchPublicCustomEvent = (
  el,
  customEventName,
  customEventDetail,
) => {
  const customEvent = new CustomEvent(customEventName, {
    detail: resolveEventDetail(customEventDetail),
    bubbles: true,
  });
  return el.dispatchEvent(customEvent);
};

/**
 * Dispatches a request event *at* `el`, asking it to perform an action.
 * Cancelable — returns `false` if the component called `preventDefault()`,
 * indicating it did not (or could not) handle the request.
 * Names are conventionally prefixed with `request_` (e.g. `navi_list_request_open`).
 */
export const dispatchCustomEvent = (el, customEventName, customEventDetail) => {
  const customEvent = new CustomEvent(customEventName, {
    detail: resolveEventDetail(customEventDetail),
    cancelable: true,
  });
  const result = el.dispatchEvent(customEvent);
  return result;
};

const resolveEventDetail = (customEventDetail) => {
  const { event, ...rest } = customEventDetail ?? {};
  const isWrappedCustomEvent = event?.detail?.event !== undefined;
  if (!isWrappedCustomEvent) {
    return { ...rest, event };
  }
  const previousChain = event.detail.eventChain;
  const eventChain = previousChain ? [...previousChain, event] : [event];
  return { ...rest, event: event.detail.event, eventChain };
};

/**
 * Returns true if the event itself or any event in its chain matches the predicate.
 *
 * The full chain checked (oldest to newest) is:
 *   initiator (event.detail.event) → ...intermediates (event.detail.eventChain)... → event
 *
 * Examples:
 *   eventInvolves(e, (e) => e.type === "mousedown")
 *   eventInvolves(e, (e) => e.type === "navi_list_select")
 */
export const eventInvolves = (event, predicate) => {
  if (predicate(event)) {
    return true;
  }
  if (event.detail?.eventChain) {
    for (const chainedEvent of event.detail.eventChain) {
      if (predicate(chainedEvent)) {
        return true;
      }
    }
  }
  if (event.detail?.event !== undefined) {
    if (predicate(event.detail.event)) {
      return true;
    }
  }
  return false;
};

/**
 * Formats an event (and its chain when it's a custom event) for debug logging.
 * For a plain browser event: `"mousedown" on button#submit`
 * For a custom event with a chain: `"mousedown" on li#item-1 -> navi_list_request_select -> navi_list_nav`
 */
export const formatEventSideEffect = (e, sideEffect) => {
  const parts = [];
  if (e.detail?.event !== undefined) {
    const initiator = e.detail.event;
    parts.push(
      `"${initiator.type}" on ${getElementSignature(initiator.target)}`,
    );
    if (e.detail.eventChain) {
      for (const chainedEvent of e.detail.eventChain) {
        parts.push(chainedEvent.type);
      }
    }
    parts.push(e.type);
  } else {
    parts.push(`"${e.type}" on ${getElementSignature(e.target)}`);
  }
  return `${parts.join(" -> ")} -> ${sideEffect}`;
};
