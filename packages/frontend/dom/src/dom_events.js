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
    detail: resolveEventDetail(customEventDetail),
    cancelable: true,
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
    cancelable: true,
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
  if (!event) {
    return { ...rest };
  }
  // Always build eventChain from the first wrapping so callers can rely on it
  // being present whenever `event` is set.
  // eventChain = [oldest, ..., event] — the full ancestor list including the direct parent.
  const previousChain = event.detail?.eventChain;
  const eventChain = previousChain ? [...previousChain, event] : [event];
  return { ...rest, event, eventChain };
};

/**
 * Returns true if the event itself or any event in its chain matches the predicate.
 *
 * The full chain checked (oldest to newest) is:
 *   initiator (event.detail.event) → ...intermediates (event.detail.eventChain)... → event
 *
 * Examples:
 *   findEvent(e, "mousedown")
 *   findEvent(e, ["mousedown", "touchstart"])
 *   findEvent(e, (e) => e.type === "mousedown")
 *   findEvent(e, (e) => e.type === "navi_list_select")
 */
export const findEvent = (event, predicate) => {
  if (!event) {
    return undefined;
  }
  const match = resolveEventPredicate(predicate);
  if (match(event)) {
    return event;
  }
  if (event.detail?.eventChain) {
    for (const chainedEvent of event.detail.eventChain) {
      if (match(chainedEvent)) {
        return chainedEvent;
      }
    }
  }
  return undefined;
};

const resolveEventPredicate = (predicate) => {
  if (typeof predicate === "string") {
    return (e) => e.type === predicate;
  }
  if (Array.isArray(predicate)) {
    return (e) => predicate.includes(e.type);
  }
  return predicate;
};

/**
 * Formats an event (and its chain when it's a custom event) for debug logging.
 * For a plain browser event: `"mousedown" on button#submit`
 * For a custom event with a chain: `"mousedown" on li#item-1 -> navi_list_request_select -> navi_list_nav`
 */
export const formatEventSideEffect = (e, sideEffect) => {
  const parts = [];
  if (e.detail?.eventChain) {
    const chain = e.detail.eventChain;
    const initiator = chain[0];
    parts.push(
      `"${initiator.type}" on ${getElementSignature(initiator.target)}`,
    );
    // chain[0] is shown as initiator above; chain includes event as last element
    for (const chainedEvent of chain.slice(1)) {
      parts.push(chainedEvent.type);
    }
    parts.push(e.type);
  } else {
    parts.push(`"${e.type}" on ${getElementSignature(e.target)}`);
  }
  return `${parts.join(" -> ")} -> ${sideEffect}`;
};

/**
 * Creates a stateful debug logger that groups side effects by their native initiator event.
 * Use createCategory(name, color) to get a typed logger function for each concern.
 *
 * Usage:
 *   const logger = createEventGroupLogger();
 *   const logAction = logger.createCategory("[action]", "#e67e22");
 *   logAction(e, "action started");  // opens/reuses a group for the initiator event
 *
 * The group closes automatically after the current JS task completes (setTimeout 0).
 */
export const createEventGroupLogger = () => {
  let currentInitiator = null;
  let closeGroupTimeout = null;

  const scheduleGroupEnd = () => {
    if (closeGroupTimeout !== null) {
      clearTimeout(closeGroupTimeout);
    }
    closeGroupTimeout = setTimeout(() => {
      console.groupEnd();
      currentInitiator = null;
      closeGroupTimeout = null;
    }, 0);
  };

  const log = (category, color, e, ...args) => {
    if (!(e instanceof Event)) {
      console.debug(
        `%c${category}`,
        `color:${color};font-weight:bold`,
        e,
        ...args,
      );
      return;
    }
    const chain = e.detail?.eventChain;
    const initiator = chain ? chain[0] : e;
    if (initiator !== currentInitiator) {
      if (currentInitiator !== null) {
        clearTimeout(closeGroupTimeout);
        closeGroupTimeout = null;
        console.groupEnd();
      }
      const label = initiator.target
        ? `"${initiator.type}" on ${getElementSignature(initiator.target)}`
        : `"${initiator.type}"`;
      console.group(label);
      currentInitiator = initiator;
    }
    const line = formatSideEffectLine(e, category);
    console.debug(`%c${line}`, `color:${color};font-weight:bold`, ...args);
    scheduleGroupEnd();
  };

  return {
    createCategory: (name, color = "inherit") => {
      return (e, ...args) => {
        log(name, color, e, ...args);
      };
    },
  };
};

const formatSideEffectLine = (e, prefix) => {
  const parts = [prefix];
  const chain = e.detail?.eventChain;
  if (chain) {
    // chain[0] is the root event, already shown as the group label — skip it.
    // chain includes the direct parent (e.detail.event) as its last element.
    for (const chainedEvent of chain.slice(1)) {
      parts.push(chainedEvent.type);
    }
  }
  return parts.join(" -> ");
};
