import { signal, effect } from "@preact/signals";
import { useState, useLayoutEffect } from "preact/hooks";

/**
 * Generates a unique signature for various types of elements that can be used for identification in logs.
 *
 * This function handles different types of elements and returns an appropriate identifier:
 * - For DOM elements: Creates a CSS selector using tag name, data-ui-name, ID, classes, or parent hierarchy
 * - For React/Preact elements (JSX): Returns JSX-like representation with type and props
 * - For functions: Returns function name and optional underlying element reference in brackets
 * - For null/undefined: Returns the string representation
 *
 * The returned signature for DOM elements is a valid CSS selector that can be copy-pasted
 * into browser dev tools to locate the element in the DOM.
 *
 * @param {HTMLElement|Object|Function|null|undefined} element - The element to generate a signature for
 * @returns {string} A unique identifier string in various formats depending on element type
 *
 * @example
 * // For DOM element with data-ui-name
 * // <div data-ui-name="header">
 * getElementSignature(element) // Returns: `div[data-ui-name="header"]`
 *
 * @example
 * // For DOM element with ID
 * // <div id="main" class="container active">
 * getElementSignature(element) // Returns: "div#main"
 *
 * @example
 * // For DOM element with classes only
 * // <button class="btn primary">
 * getElementSignature(element) // Returns: "button.btn.primary"
 *
 * @example
 * // For DOM element without distinguishing features (uses parent hierarchy)
 * // <p> inside <section id="content">
 * getElementSignature(element) // Returns: "section#content > p"
 *
 * @example
 * // For React/Preact element with props
 * // <MyComponent id="widget" />
 * getElementSignature(element) // Returns: `<MyComponent id="widget" />`
 *
 * @example
 * // For named function with underlying element reference
 * const MyComponent = () => {}; MyComponent.underlyingElementId = "div#main";
 * getElementSignature(MyComponent) // Returns: "[function MyComponent for div#main]"
 *
 * @example
 * // For anonymous function without underlying element
 * const anonymousFunc = () => {};
 * getElementSignature(anonymousFunc) // Returns: "[function]"
 *
 * @example
 * // For named function without underlying element
 * function namedHandler() {}
 * getElementSignature(namedHandler) // Returns: "[function namedHandler]"
 *
 * @example
 * // For null/undefined
 * getElementSignature(null) // Returns: "null"
 */
const getElementSignature = (element) => {
  if (Array.isArray(element)) {
    if (element.length === 0) {
      return "empty";
    }
    if (element.length === 1) {
      return getElementSignature(element[0]);
    }
    const parent = element[0].parentNode;
    return `${getElementSignature(parent)} children`;
  }
  if (!element) {
    return String(element);
  }
  if (typeof element === "string") {
    return element === ""
      ? "empty string"
      : element.length > 10
        ? `${element.slice(0, 10)}...`
        : element;
  }
  if (typeof element === "function") {
    const functionName = element.name;
    const functionLabel = functionName
      ? `function ${functionName}`
      : "function";
    const underlyingElementId = element.underlyingElementId;
    if (underlyingElementId) {
      return `[${functionLabel} for ${underlyingElementId}]`;
    }
    return `[${functionLabel}]`;
  }
  if (element.props) {
    const type = element.type;
    const elementName = typeof type === "function" ? type.name : type;
    const id = element.props.id;
    if (id) {
      return `<${elementName} id="${id}" />`;
    }
    return `<${elementName} />`;
  }
  if (element.nodeType === Node.TEXT_NODE) {
    return `#text(${getElementSignature(element.nodeValue)})`;
  }
  if (element instanceof HTMLElement) {
    const tagName = element.tagName.toLowerCase();
    const dataUIName = element.getAttribute("data-ui-name");
    if (dataUIName) {
      return `${tagName}[data-ui-name="${dataUIName}"]`;
    }
    if (tagName === "input") {
      const type = element.type || "text";
      const name = element.getAttribute("name");
      if (type === "radio" || type === "checkbox") {
        const value = element.getAttribute("value");
        if (name && value) {
          return `${type}[name="${name}"][value="${value}"]`;
        }
        if (name) {
          return `${type}[name="${name}"]`;
        }
        return `${type}`;
      }
      if (name) {
        return `input[name="${name}"]`;
      }
      return `input[type="${type}"]`;
    }
    if (tagName === "form") {
      const name = element.getAttribute("name");
      if (name) {
        return `form[name="${name}"]`;
      }
      return "form";
    }
    if (element === document.body) {
      return "document.body";
    }
    if (element === document.documentElement) {
      return "document.html";
    }
    const elementId = element.id;
    if (elementId && !looksLikeGeneratedId(elementId)) {
      return `${tagName}#${elementId}`;
    }
    if (tagName === "button") {
      // The label BEFORE the text: an icon button has no text worth reading
      // (an svg, a zero-width space), and its aria-label is the one thing that
      // says which button it is — which is the whole point of a signature in a
      // log. A labelled button says so even when it also has text.
      const label = element.getAttribute("aria-label");
      if (label) {
        return `button[aria-label="${label}"]`;
      }
      const text = element.textContent.trim();
      if (text) {
        const excerpt = text.length > 10 ? `${text.slice(0, 10)}…` : text;
        return `button:text("${excerpt}")`;
      }
      const parentSignature = getElementSignature(element.parentElement);
      return `${parentSignature} > button:empty`;
    }
    const role = element.getAttribute("role");
    if (role) {
      return `${tagName}[role="${role}"]`;
    }
    const className = element.className;
    if (className) {
      return `${tagName}.${className.split(" ").join(".")}`;
    }
    if (elementId) {
      return `${tagName}#${elementId}`;
    }

    const parentSignature = getElementSignature(element.parentElement);
    return `${parentSignature} > ${tagName}`;
  }
  return String(element);
};

// Generated ids from frameworks (Preact useId, React useId, etc.) look like
// "P0-0", ":r0:", "P1-3" — short alphanumeric tokens with dashes or colons.
// If an id matches this pattern we prefer className over it.
const looksLikeGeneratedId = (id) => {
  return /^[A-Z][0-9]+-[0-9]+$|^:[a-z][0-9]*:$/.test(id);
};

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


/**
 * Dispatches an internal event on `el`.
 * Does not bubble — stays within the local subtree.
 */
const dispatchInternalCustomEvent = (
  el,
  customEventName,
  customEventDetail,
) => {
  const customEvent = new CustomEvent(customEventName, {
    detail: customEventDetail || {},
    cancelable: true,
  });
  chainEvent(customEvent, customEventDetail?.event);
  return el.dispatchEvent(customEvent);
};

/**
 * Dispatches a public event from `el`, announcing something that happened.
 * Bubbles so any ancestor can observe it.
 */
const dispatchPublicCustomEvent = (
  el,
  customEventName,
  customEventDetail,
) => {
  const customEvent = new CustomEvent(customEventName, {
    detail: customEventDetail || {},
    bubbles: true,
    cancelable: true,
  });
  chainEvent(customEvent, customEventDetail?.event);
  return el.dispatchEvent(customEvent);
};

/**
 * Dispatches a request event *at* `el`, asking it to perform an action.
 * Cancelable — returns `false` if the component called `preventDefault()`,
 * indicating it did not (or could not) handle the request.
 * Names are conventionally prefixed with `request_` (e.g. `navi_list_request_open`).
 */
const dispatchCustomEvent = (el, customEventName, customEventDetail) => {
  const customEvent = new CustomEvent(customEventName, {
    detail: customEventDetail || {},
    cancelable: true,
  });
  chainEvent(customEvent, customEventDetail?.event);
  const result = el.dispatchEvent(customEvent);
  return result;
};

const chainEvent = (customEvent, parentEvent) => {
  if (!parentEvent) {
    return customEvent;
  }
  if (!customEvent.detail || typeof customEvent.detail !== "object") {
    // A native event has nowhere to hang the chain: `Event` has no detail at
    // all and `UIEvent` (so `InputEvent` too) exposes it as a readonly number.
    // Give it an own detail object, shadowing the prototype getter, so a
    // synthetic event dispatched on behalf of a gesture can still say what
    // caused it.
    if (nativeDetailHasMeaning(customEvent)) {
      console.warn(
        `Chaining "${customEvent.type}" to "${parentEvent.type}" replaces its native detail (${customEvent.detail}), which carries the click count on this event type. Chain a custom event instead, or read the click count before chaining.`,
      );
    }
    Object.defineProperty(customEvent, "detail", {
      value: {},
      configurable: true,
      enumerable: true,
    });
  }
  // Always build eventChain from the first wrapping so callers can rely on it
  // being present whenever `parentEvent` is set.
  // eventChain = [oldest, ..., parentEvent] — the full ancestor list including the direct parent.
  const previousChain = parentEvent.detail?.eventChain;
  const eventChain = previousChain
    ? [...previousChain, parentEvent]
    : [parentEvent];
  customEvent.detail.event = parentEvent;
  customEvent.detail.eventChain = eventChain;
  return customEvent;
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
const findEvent = (event, predicate) => {
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

// `detail` is a click count on the pointer events that define one, and 0
// everywhere else (`input`, `focus`, `wheel`…). Overwriting it there loses the
// only way to tell a real click from a keyboard/programmatic one (detail === 0),
// so those events must not be chained.
const EVENT_TYPES_WITH_MEANINGFUL_DETAIL = new Set([
  "click",
  "auxclick",
  "dblclick",
  "mousedown",
  "mouseup",
]);
const nativeDetailHasMeaning = (event) => {
  if (EVENT_TYPES_WITH_MEANINGFUL_DETAIL.has(event.type)) {
    return true;
  }
  return typeof event.detail === "number" && event.detail !== 0;
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
const formatEventSideEffect = (e, sideEffect) => {
  const parts = [];
  if (e.detail?.eventChain) {
    const chain = e.detail.eventChain;
    const initiator = chain[0];
    parts.push(
      `"${getEventLabel(initiator)}" on ${getElementSignature(initiator.target)}`,
    );
    // chain[0] is shown as initiator above; chain includes event as last element
    for (const chainedEvent of chain.slice(1)) {
      parts.push(getEventLabel(chainedEvent));
    }
    parts.push(getEventLabel(e));
  } else {
    parts.push(`"${getEventLabel(e)}" on ${getElementSignature(e.target)}`);
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
const createEventGroupLogger = () => {
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
        ? `"${getEventLabel(initiator)}" on ${getElementSignature(initiator.target)}`
        : `"${getEventLabel(initiator)}"`;
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
      parts.push(getEventLabel(chainedEvent));
    }
  }
  return parts.join(" -> ");
};

const getEventLabel = (e) => {
  if (e.type === "mousedown" || e.type === "click") {
    if (e.button !== 0) {
      return `${e.type}:right_button`;
    }
    return e.type;
  }
  if (e.type === "keydown") {
    const key = e.key === " " ? "space" : e.key?.toLowerCase();
    const modifiers = [];
    if (e.ctrlKey) {
      modifiers.push("ctrl");
    }
    if (e.metaKey) {
      modifiers.push("meta");
    }
    if (e.altKey) {
      modifiers.push("alt");
    }
    if (e.shiftKey) {
      modifiers.push("shift");
    }
    modifiers.push(key);
    return `keydown:${modifiers.join("+")}`;
  }
  return e.type;
};

const createIterableWeakSet = () => {
  const objectWeakRefSet = new Set();

  return {
    add: (object) => {
      const objectWeakRef = new WeakRef(object);
      objectWeakRefSet.add(objectWeakRef);
    },

    delete: (object) => {
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() === object) {
          objectWeakRefSet.delete(weakRef);
          return true;
        }
      }
      return false;
    },

    *[Symbol.iterator]() {
      for (const objectWeakRef of objectWeakRefSet) {
        const object = objectWeakRef.deref();
        if (object === undefined) {
          objectWeakRefSet.delete(objectWeakRef);
          continue;
        }
        yield object;
      }
    },

    has: (object) => {
      for (const weakRef of objectWeakRefSet) {
        const objectCandidate = weakRef.deref();
        if (objectCandidate === undefined) {
          objectWeakRefSet.delete(weakRef);
          continue;
        }
        if (objectCandidate === object) {
          return true;
        }
      }
      return false;
    },

    clear: () => {
      objectWeakRefSet.clear();
    },

    get size() {
      return objectWeakRefSet.size;
    },

    getStats: () => {
      let alive = 0;
      let dead = 0;
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() !== undefined) {
          alive++;
        } else {
          dead++;
        }
      }
      return { total: objectWeakRefSet.size, alive, dead };
    },
  };
};

/**
 * Creates a simple publish/subscribe pair.
 *
 * @param {boolean} [clearOnPublish=false] - When true, all subscribers are removed after each publish call.
 * @returns {[publish: (...args: any[]) => any[], subscribe: (callback: Function) => () => void, clear: () => void]}
 *   - `publish(...args)` — calls all subscribers with the given arguments and returns their return values.
 *   - `subscribe(callback)` — registers a subscriber and returns an unsubscribe function.
 *   - `clear()` — removes all subscribers without calling them.
 */
const createPubSub = (clearOnPublish = false) => {
  const callbackSet = new Set();

  const publish = (...args) => {
    const results = [];
    for (const callback of callbackSet) {
      const result = callback(...args);
      results.push(result);
    }
    if (clearOnPublish) {
      callbackSet.clear();
    }
    return results;
  };

  const subscribe = (callback) => {
    if (typeof callback !== "function") {
      throw new TypeError("callback must be a function");
    }
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  const clear = () => {
    callbackSet.clear();
  };

  return [publish, subscribe, clear];
};

const createValueEffect = (value) => {
  const callbackSet = new Set();
  const valueCleanupSet = new Set();

  const cleanup = () => {
    for (const valueCleanup of valueCleanupSet) {
      valueCleanup();
    }
    valueCleanupSet.clear();
  };

  const updateValue = (newValue) => {
    if (newValue === value) {
      return;
    }
    cleanup();
    const oldValue = value;
    value = newValue;
    for (const callback of callbackSet) {
      const returnValue = callback(newValue, oldValue);
      if (typeof returnValue === "function") {
        valueCleanupSet.add(returnValue);
      }
    }
  };

  const addEffect = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  return [updateValue, addEffect, cleanup];
};

// https://github.com/davidtheclark/tabbable/blob/master/index.js
const isDocumentElement = (node) =>
  node === node.ownerDocument.documentElement;

/**
 * elementToOwnerWindow returns the window owning the element.
 * Usually an element window will just be window.
 * But when an element is inside an iframe, the window of that element
 * is iframe.contentWindow
 * It's often important to work with the correct window because
 * element are scoped per iframes.
 */
const elementToOwnerWindow = (element) => {
  if (elementIsWindow(element)) {
    return element;
  }
  if (elementIsDocument(element)) {
    return element.defaultView;
  }
  return elementToOwnerDocument(element).defaultView;
};
/**
 * elementToOwnerDocument returns the document containing the element.
 * Usually an element document is window.document.
 * But when an element is inside an iframe, the document of that element
 * is iframe.contentWindow.document
 * It's often important to work with the correct document because
 * element are scoped per iframes.
 */
const elementToOwnerDocument = (element) => {
  if (elementIsWindow(element)) {
    return element.document;
  }
  if (elementIsDocument(element)) {
    return element;
  }
  return element.ownerDocument;
};

const elementIsWindow = (a) => a.window === a;
const elementIsDocument = (a) => a.nodeType === 9;
const elementIsDetails = ({ nodeName }) => nodeName === "DETAILS";
const elementIsSummary = ({ nodeName }) => nodeName === "SUMMARY";
const elementIsDialog = ({ nodeName }) => nodeName === "DIALOG";

// should be used ONLY when an element is related to other elements that are not descendants of this element
const getAssociatedElements = (element) => {
  if (element.tagName === "COL") {
    const columnCells = [];
    const colgroup = element.parentNode;
    const columnIndex = Array.from(colgroup.children).indexOf(element);
    const table = element.closest("table");
    const rows = table.querySelectorAll("tr");
    for (const row of rows) {
      const rowCells = row.children;
      for (const rowCell of rowCells) {
        if (rowCell.cellIndex === columnIndex) {
          columnCells.push(rowCell);
        }
      }
    }
    return columnCells;
  }
  // if (element.tagName === "TR") {
  //   const rowCells = Array.from(element.children);
  //   return rowCells;
  // }
  return null;
};

/**
 * Determines if the current color scheme is dark mode
 * @param {Element} [element] - DOM element to check color-scheme against (optional)
 * @returns {boolean} True if dark mode is active
 */
const prefersDarkColors = (element) => {
  const colorScheme = getPreferedColorScheme(element);
  return colorScheme.includes("dark");
};
const prefersLightColors = (element) => {
  return !prefersDarkColors(element);
};
const getPreferedColorScheme = (element) => {
  const computedStyle = getComputedStyle(element || document.documentElement);
  const colorScheme = computedStyle.colorScheme;

  // If no explicit color-scheme is set, or it's "normal",
  // fall back to prefers-color-scheme media query
  if (!colorScheme || colorScheme === "normal") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return colorScheme;
};

const updateRGBA = (rgba, toUpdate) => {
  const copy = [...rgba];
  if (toUpdate.r !== undefined) {
    copy[0] = toUpdate.r;
  }
  if (toUpdate.g !== undefined) {
    copy[1] = toUpdate.g;
  }
  if (toUpdate.b !== undefined) {
    copy[2] = toUpdate.b;
  }
  if (toUpdate.a !== undefined) {
    copy[3] = toUpdate.a;
  }
  return copy;
};
const areSameRGBA = (first, second) => {
  const [r, g, b, a] = first;
  const [r2, g2, b2, a2] = second;
  return r === r2 && g === g2 && b === b2 && a === a2;
};
const resolveCSSColor = (color, element) => {
  const rgba = parseCSSColor(color, element);
  const colorString = stringifyCSSColor(rgba);
  return colorString;
};

/**
 * Resolves a color value, handling CSS custom properties and light-dark() function
 * @param {string} color - CSS color value (may include CSS variables, light-dark())
 * @param {Element} element - DOM element to resolve CSS variables and light-dark() against
 * @param {string} context - Return format: "js" for RGBA array, "css" for CSS string
 * @returns {Array<number>|string|null} [r, g, b, a] values, CSS string, or null if parsing fails
 */
const parseCSSColor = (color, element) => {
  if (!color) {
    return null;
  }
  if (typeof color !== "string") {
    return color;
  }
  if (color === "inherit") {
    if (!element) {
      return color;
    }
    const computedStyle = getComputedStyle(element);
    const resolvedColor = parseCSSColor(computedStyle.color, element);
    return resolvedColor;
  }
  let resolvedColor = color;

  // Handle light-dark() function
  const lightDarkMatch = color.match(/light-dark\(([^,]+),([^)]+)\)/);
  if (lightDarkMatch) {
    const lightColor = lightDarkMatch[1].trim();
    const darkColor = lightDarkMatch[2].trim();

    // Select the appropriate color and recursively resolve it
    const prefersDark = prefersDarkColors(element);
    resolvedColor = prefersDark ? darkColor : lightColor;
    return parseCSSColor(resolvedColor, element);
  }

  if (color.startsWith("color-mix(")) {
    return color;
  }

  // Pass through CSS functions that we don't want to resolve
  if (
    color.includes("calc(") ||
    color.includes("min(") ||
    color.includes("max(") ||
    color.includes("clamp(") ||
    color.includes("env(") ||
    color.includes("attr(")
  ) {
    return color;
  }

  // oklab(L a b) and oklab(L a b / alpha)
  if (color.startsWith("oklab(")) {
    const oklabMatch = color.match(
      /^oklab\(\s*([\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/,
    );
    if (oklabMatch) {
      const L = parseFloat(oklabMatch[1]);
      const a = parseFloat(oklabMatch[2]);
      const b = parseFloat(oklabMatch[3]);
      const alpha = oklabMatch[4] !== undefined ? parseFloat(oklabMatch[4]) : 1;
      const [r, g, bChannel] = oklabToRgb(L, a, b);
      return [r, g, bChannel, alpha];
    }
    return color;
  }

  // Pass through CSS color functions we don't handle
  if (
    color.startsWith("lch(") ||
    color.startsWith("oklch(") ||
    color.startsWith("lab(") ||
    color.startsWith("hwb(") ||
    color.includes("color-contrast(")
  ) {
    return color;
  }

  // color(srgb r g b) and color(srgb r g b / a)
  if (color.startsWith("color(")) {
    const srgbMatch = color.match(
      /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/,
    );
    if (srgbMatch) {
      const r = Math.round(parseFloat(srgbMatch[1]) * 255);
      const g = Math.round(parseFloat(srgbMatch[2]) * 255);
      const b = Math.round(parseFloat(srgbMatch[3]) * 255);
      const a = srgbMatch[4] !== undefined ? parseFloat(srgbMatch[4]) : 1;
      return [r, g, b, a];
    }
    return color;
  }

  // Pass through relative color syntax (CSS Color Module Level 5)
  if (color.includes(" from ")) {
    return color;
  }

  // If it's a CSS custom property, resolve it using getComputedStyle
  if (resolvedColor.includes("var(")) {
    if (!element) {
      // console.warn(`"${resolvedColor}" cannot be resolved without element.`);
      return resolvedColor;
    }
    const computedStyle = getComputedStyle(element);

    // Handle var() syntax
    const varMatch = color.match(/var\(([^,)]+)(?:,([^)]+))?\)/);
    if (varMatch) {
      const propertyName = varMatch[1].trim();
      const fallback = varMatch[2]?.trim();

      const resolvedValue = computedStyle.getPropertyValue(propertyName).trim();
      if (resolvedValue) {
        // Recursively resolve in case the CSS variable contains light-dark() or other variables
        return parseCSSColor(resolvedValue, element);
      }
      if (fallback) {
        // Recursively resolve fallback (in case it's also a CSS variable)
        return parseCSSColor(fallback, element);
      }
    }
  }

  if (color.startsWith("--")) {
    console.warn(`found "${color}". Use "var(${color})" instead.`);
    return null;
  }
  const rgba = convertColorToRgba(resolvedColor);
  return rgba;
};
const oklabToRgb = (L, a, b) => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const rLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toSrgb = (linear) => {
    const clamped = linear < 0 ? 0 : linear > 1 ? 1 : linear;
    const srgb =
      clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  };
  return [toSrgb(rLinear), toSrgb(gLinear), toSrgb(bLinear)];
};

/**
 * Converts HSL color to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {Array<number>} [r, g, b] values
 */
const hslToRgb = (h, s, l) => {
  h = h % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const createRgb = (r, g, b) => {
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  };

  if (h >= 0 && h < 60) {
    return createRgb(c, x, 0);
  }
  if (h >= 60 && h < 120) {
    return createRgb(x, c, 0);
  }
  if (h >= 120 && h < 180) {
    return createRgb(0, c, x);
  }
  if (h >= 180 && h < 240) {
    return createRgb(0, x, c);
  }
  if (h >= 240 && h < 300) {
    return createRgb(x, 0, c);
  }
  if (h >= 300 && h < 360) {
    return createRgb(c, 0, x);
  }

  return createRgb(0, 0, 0);
};
/**
 * Parses a CSS color string into RGBA values
 * Supports hex (#rgb, #rrggbb, #rrggbbaa), rgb(), rgba(), hsl(), hsla()
 * @param {string} color - CSS color string
 * @returns {Array<number>|null} [r, g, b, a] values or null if parsing fails
 */
const convertColorToRgba = (color) => {
  if (!color || typeof color !== "string") {
    return null;
  }
  color = color.trim().toLowerCase();
  // Hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      // #rgb -> #rrggbb
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b, 1];
    }
    if (hex.length === 6) {
      // #rrggbb
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b, 1];
    }
    if (hex.length === 8) {
      // #rrggbbaa
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return [r, g, b, a];
    }
  }

  // RGB/RGBA colors
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const values = rgbMatch[1].split(",").map((v) => parseFloat(v.trim()));
    if (values.length >= 3) {
      const r = values[0];
      const g = values[1];
      const b = values[2];
      const a = values.length >= 4 ? values[3] : 1;
      return [r, g, b, a];
    }
  }

  // HSL/HSLA colors - convert to RGB
  const hslMatch = color.match(/hsla?\(([^)]+)\)/);
  if (hslMatch) {
    const values = hslMatch[1].split(",").map((v) => parseFloat(v.trim()));
    if (values.length >= 3) {
      const [h, s, l] = values;
      const a = values.length >= 4 ? values[3] : 1;
      const [r, g, b] = hslToRgb(h, s / 100, l / 100);
      return [r, g, b, a];
    }
  }

  if (color === "transparent") {
    return [0, 0, 0, 0];
  }

  // Named colors (basic set)
  const namedColorRgb = namedColors[color];
  if (namedColorRgb) {
    return [...namedColorRgb, 1];
  }
  return null;
};

/**
 * Converts RGBA values back to a CSS color string
 * Prefers named colors when possible, then rgb() for opaque colors, rgba() for transparent
 * @param {Array<number>} rgba - [r, g, b, a] values
 * @returns {string|null} CSS color string or null if invalid input
 */
const stringifyCSSColor = (value) => {
  if (typeof value === "string") {
    // can happen for css variables that we can't resolve
    return value;
  }
  if (!Array.isArray(value) || value.length < 3) {
    return null;
  }
  const rgba = value;
  const [r, g, b, a = 1] = rgba;
  // Validate RGB values
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return null;
  }
  // Validate alpha value
  if (a < 0 || a > 1) {
    return null;
  }

  // Round RGB values to integers
  const rInt = Math.round(r);
  const gInt = Math.round(g);
  const bInt = Math.round(b);

  // Check for named colors (only for fully opaque colors)
  if (a === 1) {
    for (const [name, [nameR, nameG, nameB]] of Object.entries(namedColors)) {
      if (rInt === nameR && gInt === nameG && bInt === nameB) {
        return name;
      }
    }
    // Use rgb() for opaque colors, rgba() for transparent
    return `rgb(${rInt}, ${gInt}, ${bInt})`;
  }
  if (a === 0 && rInt === 0 && gInt === 0 && bInt === 0) {
    return "transparent";
  }
  return `rgba(${rInt}, ${gInt}, ${bInt}, ${a})`;
};
const namedColors = {
  // Basic colors
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],

  // Gray variations
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  lightgray: [211, 211, 211],
  lightgrey: [211, 211, 211],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  gainsboro: [220, 220, 220],
  whitesmoke: [245, 245, 245],

  // Extended basic colors
  maroon: [128, 0, 0],
  olive: [128, 128, 0],
  lime: [0, 255, 0],
  aqua: [0, 255, 255],
  teal: [0, 128, 128],
  navy: [0, 0, 128],
  fuchsia: [255, 0, 255],
  purple: [128, 0, 128],

  // Red variations
  darkred: [139, 0, 0],
  firebrick: [178, 34, 34],
  crimson: [220, 20, 60],
  indianred: [205, 92, 92],
  lightcoral: [240, 128, 128],
  salmon: [250, 128, 114],
  darksalmon: [233, 150, 122],
  lightsalmon: [255, 160, 122],

  // Pink variations
  pink: [255, 192, 203],
  lightpink: [255, 182, 193],
  hotpink: [255, 105, 180],
  deeppink: [255, 20, 147],
  mediumvioletred: [199, 21, 133],
  palevioletred: [219, 112, 147],

  // Orange variations
  orange: [255, 165, 0],
  darkorange: [255, 140, 0],
  orangered: [255, 69, 0],
  tomato: [255, 99, 71],
  coral: [255, 127, 80],

  // Yellow variations
  gold: [255, 215, 0],
  lightyellow: [255, 255, 224],
  lemonchiffon: [255, 250, 205],
  lightgoldenrodyellow: [250, 250, 210],
  papayawhip: [255, 239, 213],
  moccasin: [255, 228, 181],
  peachpuff: [255, 218, 185],
  palegoldenrod: [238, 232, 170],
  khaki: [240, 230, 140],
  darkkhaki: [189, 183, 107],

  // Green variations
  darkgreen: [0, 100, 0],
  forestgreen: [34, 139, 34],
  seagreen: [46, 139, 87],
  mediumseagreen: [60, 179, 113],
  springgreen: [0, 255, 127],
  mediumspringgreen: [0, 250, 154],
  lawngreen: [124, 252, 0],
  chartreuse: [127, 255, 0],
  greenyellow: [173, 255, 47],
  limegreen: [50, 205, 50],
  palegreen: [152, 251, 152],
  lightgreen: [144, 238, 144],
  mediumaquamarine: [102, 205, 170],
  aquamarine: [127, 255, 212],
  darkolivegreen: [85, 107, 47],
  olivedrab: [107, 142, 35],
  yellowgreen: [154, 205, 50],

  // Blue variations
  darkblue: [0, 0, 139],
  mediumblue: [0, 0, 205],
  royalblue: [65, 105, 225],
  steelblue: [70, 130, 180],
  dodgerblue: [30, 144, 255],
  deepskyblue: [0, 191, 255],
  skyblue: [135, 206, 235],
  lightskyblue: [135, 206, 250],
  lightblue: [173, 216, 230],
  powderblue: [176, 224, 230],
  lightcyan: [224, 255, 255],
  paleturquoise: [175, 238, 238],
  darkturquoise: [0, 206, 209],
  mediumturquoise: [72, 209, 204],
  turquoise: [64, 224, 208],
  cadetblue: [95, 158, 160],
  darkcyan: [0, 139, 139],
  lightseagreen: [32, 178, 170],

  // Purple variations
  indigo: [75, 0, 130],
  darkviolet: [148, 0, 211],
  blueviolet: [138, 43, 226],
  mediumpurple: [147, 112, 219],
  mediumslateblue: [123, 104, 238],
  slateblue: [106, 90, 205],
  darkslateblue: [72, 61, 139],
  lavender: [230, 230, 250],
  thistle: [216, 191, 216],
  plum: [221, 160, 221],
  violet: [238, 130, 238],
  orchid: [218, 112, 214],
  mediumorchid: [186, 85, 211],
  darkorchid: [153, 50, 204],
  darkmagenta: [139, 0, 139],

  // Brown variations
  brown: [165, 42, 42],
  saddlebrown: [139, 69, 19],
  sienna: [160, 82, 45],
  chocolate: [210, 105, 30],
  darkgoldenrod: [184, 134, 11],
  peru: [205, 133, 63],
  rosybrown: [188, 143, 143],
  goldenrod: [218, 165, 32],
  sandybrown: [244, 164, 96],
  tan: [210, 180, 140],
  burlywood: [222, 184, 135],
  wheat: [245, 222, 179],
  navajowhite: [255, 222, 173],
  bisque: [255, 228, 196],
  blanchedalmond: [255, 235, 205],
  cornsilk: [255, 248, 220],

  // Special colors
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  honeydew: [240, 255, 240],
  ivory: [255, 255, 240],
  lavenderblush: [255, 240, 245],
  linen: [250, 240, 230],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  oldlace: [253, 245, 230],
  seashell: [255, 245, 238],
  snow: [255, 250, 250],
};

// Export named colors and create a Set of color keywords for efficient lookup
const cssColorKeywordSet = new Set([
  ...Object.keys(namedColors),
  "transparent",
  "currentcolor",
]);

// Shared tokenization utilities for CSS parsing

// Tokenize CSS string into individual values, respecting function boundaries
const tokenizeCSS = (cssString, options = {}) => {
  const {
    separators = [" "],
    preserveSeparators = false,
    respectFunctions = true,
  } = options;

  const tokens = [];
  let current = "";
  let depth = 0;
  let inFunction = false;

  for (let i = 0; i < cssString.length; i++) {
    const char = cssString[i];

    if (respectFunctions && char === "(") {
      depth++;
      inFunction = true;
      current += char;
    } else if (respectFunctions && char === ")") {
      depth--;
      current += char;
      if (depth === 0) {
        inFunction = false;
      }
    } else if (
      separators.includes(char) &&
      (!respectFunctions || (!inFunction && depth === 0))
    ) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = "";
      }
      if (preserveSeparators) {
        tokens.push(char);
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
};

// Split CSS string into layers/sections (handle commas not inside functions)
const splitCSSLayers = (cssString) => {
  const layers = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < cssString.length; i++) {
    const char = cssString[i];

    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    } else if (char === "," && depth === 0) {
      layers.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    layers.push(current.trim());
  }

  return layers;
};

// Convert image object to CSS string
const stringifyCSSImage = (imageObj) => {
  if (typeof imageObj === "string") {
    return imageObj;
  }

  if (typeof imageObj !== "object" || imageObj === null) {
    return imageObj;
  }

  switch (imageObj.type) {
    case "url":
      return `url(${imageObj.value})`;

    case "linear-gradient":
      return stringifyLinearGradient(imageObj);

    case "radial-gradient":
      return stringifyRadialGradient(imageObj);

    case "conic-gradient":
      return stringifyConicGradient(imageObj);

    case "repeating-linear-gradient":
      return `repeating-${stringifyLinearGradient(imageObj)}`;

    case "repeating-radial-gradient":
      return `repeating-${stringifyRadialGradient(imageObj)}`;

    case "repeating-conic-gradient":
      return `repeating-${stringifyConicGradient(imageObj)}`;

    default:
      // Fallback for unknown types
      return imageObj.original || "none";
  }
};

// Parse CSS image string into structured object
const parseCSSImage = (imageString, element) => {
  if (!imageString || imageString === "none") {
    return undefined;
  }

  if (typeof imageString !== "string") {
    return imageString;
  }

  const trimmed = imageString.trim();

  // Parse URL
  const urlMatch = trimmed.match(/^url\s*\(([^)]*)\)$/);
  if (urlMatch) {
    return {
      type: "url",
      value: cleanUrlValue(urlMatch[1]),
      original: trimmed,
    };
  }

  // Parse gradients
  const gradientMatch = trimmed.match(
    /^(repeating-)?(linear-gradient|radial-gradient|conic-gradient)\s*\(([\s\S]*)\)$/,
  );
  if (gradientMatch) {
    const [, repeating, gradientType, content] = gradientMatch;
    const type = repeating ? `repeating-${gradientType}` : gradientType;

    switch (gradientType) {
      case "linear-gradient":
        return parseLinearGradient(content, type, trimmed, element);
      case "radial-gradient":
        return parseRadialGradient(content, type, trimmed, element);
      case "conic-gradient":
        return parseConicGradient(content, type, trimmed, element);
    }
  }

  // Other image functions (element, cross-fade, etc.)
  const functionMatch = trimmed.match(/^([a-z-]+)\s*\(([\s\S]*)\)$/);
  if (functionMatch) {
    return {
      type: functionMatch[1],
      content: functionMatch[2],
      original: trimmed,
    };
  }

  // Fallback for unrecognized values
  return {
    type: "unknown",
    value: trimmed,
    original: trimmed,
  };
};

// Helper functions for gradient parsing
const parseLinearGradient = (content, type, original, element) => {
  const { direction, colors } = parseGradientContent(content, element, {
    isRadial: false,
  });

  return {
    type,
    direction: direction || "to bottom",
    colors,
    original,
  };
};

const parseRadialGradient = (content, type, original, element) => {
  const { shape, colors } = parseGradientContent(content, element, {
    isRadial: true,
  });

  return {
    type,
    shape: shape || "ellipse",
    colors,
    original,
  };
};

const parseConicGradient = (content, type, original, element) => {
  const { direction, colors } = parseGradientContent(content, element, {
    isConic: true,
  });

  return {
    type,
    from: direction || "0deg",
    colors,
    original,
  };
};

// Parse gradient content (colors and direction/shape)
const parseGradientContent = (content, element, { isRadial, isConic } = {}) => {
  const parts = tokenizeCSS(content, { separators: [","] });
  const colors = [];
  let direction = null;
  let shape = null;

  for (const part of parts) {
    const trimmedPart = part.trim();

    // Check if it's a direction/shape (before any colors)
    if (colors.length === 0) {
      if (isRadial && isRadialShape(trimmedPart)) {
        shape = trimmedPart;
        continue;
      } else if (!isRadial && !isConic && isLinearDirection(trimmedPart)) {
        direction = trimmedPart;
        continue;
      } else if (isConic && trimmedPart.startsWith("from ")) {
        // Conic gradient "from" direction - extract just the angle part
        direction = trimmedPart.substring(5).trim(); // Remove "from " prefix
        continue;
      }
    }

    // Parse as color stop
    const colorStop = parseColorStop(trimmedPart, element);
    if (colorStop) {
      colors.push(colorStop);
    }
  }

  return { direction, shape, colors };
};

// Parse individual color stop
const parseColorStop = (stopString, element) => {
  const trimmed = stopString.trim();

  // Match color with optional position
  // Examples: "red", "red 50%", "#ff0000 25% 75%", "rgba(255,0,0,0.5)", "rgb(0,122,204) 8px", "red 45deg", "blue 180deg"
  const colorMatch = trimmed.match(
    /^((?:rgb|hsl)a?\([^)]*\)|#[a-f0-9]{3,8}|[a-z](?:[a-z-]*[a-z])?|var\([^)]*\))(?:\s+([\d.]+(?:deg|turn|rad|grad|px|%|em|rem|vh|vw|ch|ex|cm|mm|in|pt|pc)?(?:\s+[\d.]+(?:deg|turn|rad|grad|px|%|em|rem|vh|vw|ch|ex|cm|mm|in|pt|pc)?)*)?)?$/i,
  );

  if (colorMatch) {
    const [, color, positions] = colorMatch;
    const stopStrings = positions ? positions.split(/\s+/) : [];

    // Parse stop positions into structured objects
    const stops =
      stopStrings.length > 0
        ? stopStrings.map((stop) => {
            const match = stop.match(/^([+-]?\d+(?:\.\d+)?|\d*\.\d+)(\D*)$/);
            if (match) {
              return {
                isNumeric: true,
                value: parseFloat(match[1]),
                unit: match[2] || "",
              };
            }
            return {
              isNumeric: false,
              value: stop,
              unit: "",
            };
          })
        : undefined;

    const result = {
      color: parseCSSColor(color.trim(), element),
      stops,
    };
    return result;
  }

  return null;
};

// Direction/shape detection helpers
const isLinearDirection = (value) => {
  return (
    value.includes("deg") ||
    value.includes("turn") ||
    value.includes("rad") ||
    value.includes("grad") ||
    value.startsWith("to ") ||
    ["top", "bottom", "left", "right"].some((dir) => value.includes(dir))
  );
};

const isRadialShape = (value) => {
  return (
    value.includes("circle") ||
    value.includes("ellipse") ||
    value.includes("at ") ||
    value.includes("closest") ||
    value.includes("farthest")
  );
};

// Stringification helpers
const stringifyLinearGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.direction && gradientObj.direction !== "to bottom") {
    parts.push(gradientObj.direction);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `linear-gradient(${parts.join(", ")})`;
};

const stringifyRadialGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.shape && gradientObj.shape !== "ellipse") {
    parts.push(gradientObj.shape);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `radial-gradient(${parts.join(", ")})`;
};

const stringifyConicGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.from && gradientObj.from !== "0deg") {
    parts.push(`from ${gradientObj.from}`);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `conic-gradient(${parts.join(", ")})`;
};

const stringifyColorStop = (colorStop) => {
  if (typeof colorStop === "string") {
    return colorStop;
  }

  // Convert color back to CSS string (handles both strings and structured colors)
  const colorString =
    typeof colorStop.color === "string"
      ? colorStop.color
      : stringifyCSSColor(colorStop.color);
  const parts = [colorString];

  if (colorStop.stops) {
    // Handle structured stop objects
    const stopStrings = colorStop.stops.map((stop) => {
      if (typeof stop === "string") {
        return stop;
      }
      // If it's a parsed object, reconstruct the string
      if (stop.isNumeric) {
        return `${stop.value}${stop.unit}`;
      }
      return stop.value;
    });
    parts.push(...stopStrings);
  }

  return parts.join(" ");
};

// Helper to clean URL values (remove quotes)
const cleanUrlValue = (urlValue) => {
  const trimmed = urlValue.trim();
  // Remove surrounding quotes if present
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

// Convert background object to CSS string
const stringifyCSSBackground = (backgroundObj, normalize) => {
  const parts = [];

  // Order matters for CSS background shorthand
  // background: [background-color] [background-image] [background-repeat]
  //            [background-attachment] [background-position] / [background-size]
  //            [background-clip] [background-origin]

  if (backgroundObj.image !== undefined) {
    const normalizedImage =
      typeof backgroundObj.image === "object" && backgroundObj.image !== null
        ? stringifyCSSImage(backgroundObj.image)
        : normalize(backgroundObj.image, "backgroundImage", "css");
    parts.push(normalizedImage);
  }

  if (backgroundObj.repeat !== undefined) {
    parts.push(backgroundObj.repeat);
  }

  if (backgroundObj.attachment !== undefined) {
    parts.push(backgroundObj.attachment);
  }

  if (backgroundObj.position !== undefined) {
    parts.push(backgroundObj.position);
  }

  if (backgroundObj.size !== undefined) {
    // background-size must be preceded by "/"
    parts.push(`/ ${backgroundObj.size}`);
  }

  if (backgroundObj.clip !== undefined) {
    parts.push(backgroundObj.clip);
  }

  if (backgroundObj.origin !== undefined) {
    parts.push(backgroundObj.origin);
  }

  if (backgroundObj.color !== undefined) {
    const normalizedColor = normalize(
      backgroundObj.color,
      "backgroundColor",
      "css",
    );
    parts.push(normalizedColor);
  }

  return parts.join(" ");
};

// Parse background CSS string into object
const parseCSSBackground = (
  backgroundString,
  { parseStyle, element },
) => {
  if (!backgroundString || backgroundString === "none") {
    return {};
  }
  if (backgroundString === "transparent") {
    return {
      color: parseStyle("transparent", "backgroundColor", element),
    };
  }

  // Handle simple cases first
  if (isSimpleColor(backgroundString)) {
    const normalizedColor = parseStyle(
      backgroundString,
      "backgroundColor",
      element,
    );
    return { color: normalizedColor };
  }

  // Complex background parsing - split by commas for multiple backgrounds
  const layers = splitCSSLayers(backgroundString);

  if (layers.length === 1) {
    return parseBackgroundLayer(layers[0], { parseStyle, element });
  }

  // Multiple background layers - return array
  return layers.map((layer) =>
    parseBackgroundLayer(layer, { parseStyle, element }),
  );
};

// Parse a single background layer
const parseBackgroundLayer = (layerString, { parseStyle, element }) => {
  const backgroundObj = {};
  const tokens = tokenizeCSS(layerString, {
    separators: [" ", "/"],
    preserveSeparators: true,
  });

  let i = 0;
  let expectingSize = false; // Track if we're after a "/" and expecting size
  let colorFound = false; // Track if we've already found a color

  while (i < tokens.length) {
    const token = tokens[i];

    // Skip spaces
    if (token === " ") {
      i++;
      continue;
    }

    // Skip "/" separator
    if (token === "/") {
      expectingSize = true;
      i++;
      continue;
    }

    // If we're expecting size after "/", parse size values
    if (expectingSize) {
      if (isNumericValue(token) || isSizeKeyword(token)) {
        // Collect all size tokens starting with current token
        const sizeTokens = [token]; // Start with current token
        i++; // Move to next token

        while (i < tokens.length && tokens[i] !== "/") {
          const currentToken = tokens[i];
          // Skip spaces
          if (currentToken === " ") {
            i++;
            continue;
          }
          // Check if it's a size/numeric value
          if (isNumericValue(currentToken) || isSizeKeyword(currentToken)) {
            sizeTokens.push(currentToken);
            i++;
          } else {
            // Hit a non-size value, stop collecting
            break;
          }
        }

        backgroundObj.size = sizeTokens.join(" ");
        expectingSize = false;
        continue; // Don't increment i since we're already positioned correctly
      } else {
        expectingSize = false; // Invalid size, continue with normal parsing
      }
    }

    // Check for colors early (can appear at the beginning or end)
    if (!colorFound && isSimpleColor(token)) {
      const normalizedColor = parseStyle(token, "backgroundColor", element);
      backgroundObj.color = normalizedColor;
      colorFound = true;
    }
    // Check for image functions (gradients, url) - can appear early
    else if (isImageFunction(token)) {
      const parsedImage = parseCSSImage(token, element);
      backgroundObj.image = parsedImage;
    }
    // Check for position values (appear before size, after image)
    else if (
      isPositionValue(token) ||
      (isNumericValue(token) && !expectingSize)
    ) {
      // Collect position tokens until we hit a "/" or non-position value
      const positionTokens = [token]; // Start with current token
      i++; // Move to next token

      while (i < tokens.length && tokens[i] !== "/") {
        const currentToken = tokens[i];
        // Skip spaces
        if (currentToken === " ") {
          i++;
          continue;
        }
        // Check if it's a position/numeric value
        if (isPositionValue(currentToken) || isNumericValue(currentToken)) {
          positionTokens.push(currentToken);
          i++;
        } else {
          // Hit a non-position value, stop collecting
          break;
        }
      }

      backgroundObj.position = positionTokens.join(" ");
      continue; // Don't increment i since we're already positioned correctly
    }
    // Check for repeat values (after position/size)
    else if (isRepeatValue(token)) {
      backgroundObj.repeat = token;
    }
    // Check for attachment values (after repeat)
    else if (isAttachmentValue(token)) {
      backgroundObj.attachment = token;
    }
    // Check for box values (origin/clip - near the end)
    else if (isBoxValue(token)) {
      // In CSS, origin comes before clip, but they can appear in either order
      if (backgroundObj.origin === undefined) {
        backgroundObj.origin = token;
      } else if (backgroundObj.clip === undefined) {
        backgroundObj.clip = token;
      }
      // If both are set, this might be a duplicate or error, but we'll take the last one
      else {
        backgroundObj.clip = token;
      }
    }

    i++;
  }

  return backgroundObj;
};

// Helper functions to identify token types
const isImageFunction = (value) => {
  return /^(?:url|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient|image|element|cross-fade)\s*\(/.test(
    value,
  );
};

const isSimpleColor = (value) => {
  if (!value || typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  // Only match if it's a single word/token without spaces (except within parentheses)
  // This prevents matching colors within complex background strings
  if (trimmed.includes(" ")) {
    // Allow spaces only within function calls like rgb(255, 0, 0)
    const functionMatch = /^[a-z]+\s*\([^)]*\)$/i.test(trimmed);
    if (!functionMatch) {
      return false;
    }
  }

  // Hex colors: #rgb, #rrggbb, #rrggbbaa
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
    return true;
  }

  // RGB/RGBA functions
  if (/^rgba?\s*\([^)]*\)$/i.test(trimmed)) {
    return true;
  }

  // HSL/HSLA functions
  if (/^hsla?\s*\([^)]*\)$/i.test(trimmed)) {
    return true;
  }

  // CSS color keywords using the imported Set
  if (cssColorKeywordSet.has(trimmed.toLowerCase())) {
    return true;
  }

  return false;
};

const isRepeatValue = (value) => {
  return [
    "repeat",
    "repeat-x",
    "repeat-y",
    "no-repeat",
    "space",
    "round",
  ].includes(value);
};

const isAttachmentValue = (value) => {
  return ["scroll", "fixed", "local"].includes(value);
};

const isPositionValue = (value) => {
  return ["left", "center", "right", "top", "bottom"].includes(value);
};

const isNumericValue = (value) => {
  return /^-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|ch|ex|cm|mm|in|pt|pc)?$/.test(
    value,
  );
};

const isSizeKeyword = (value) => {
  return ["auto", "contain", "cover"].includes(value);
};

const isBoxValue = (value) => {
  return ["border-box", "padding-box", "content-box", "text"].includes(value);
};

/**
 * Parse a CSS border value into components
 * @param {string} borderValue - CSS border value like "2px solid red"
 * @returns {Object|null} Parsed border components {width, style, color} or null if invalid
 */
const parseCSSBorder = (borderValue, element) => {
  if (!borderValue || borderValue === "none" || borderValue === "initial") {
    return null;
  }

  // Normalize whitespace and trim
  const normalizedValue = borderValue.trim().replace(/\s+/g, " ");

  // Handle transparent border case
  if (
    normalizedValue === "0px solid transparent" ||
    normalizedValue === "transparent"
  ) {
    return {
      width: 0,
      style: "solid",
      color: parseCSSColor("transparent"),
    };
  }

  // Use CSS tokenizer to split while respecting function boundaries
  const parts = tokenizeCSS(normalizedValue, {
    separators: [" "],
    respectFunctions: true,
  });

  let width = null;
  let style = null;
  let color = null;

  for (const part of parts) {
    // Check if it's a width (starts with number or has px, em, etc.)
    if (
      /^\d/.test(part) ||
      /\d+(?:px|em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|in|pt|pc)$/.test(part)
    ) {
      width = parseFloat(part) || 0;
    }
    // Check if it's a border style
    else if (borderStyleSet.has(part.toLowerCase())) {
      style = part.toLowerCase();
    }
    // Assume it's a color
    else {
      color = part;
    }
  }

  // Set defaults for missing values
  width = width ?? 0;
  style = style || "solid";

  // Parse the color properly
  if (color) {
    color = parseCSSColor(color, element);
  } else {
    color = parseCSSColor("transparent");
  }

  return {
    width,
    style,
    color,
  };
};

const borderStyleSet = new Set([
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

/**
 * Stringify border components back to a CSS border value
 * @param {Object} borderComponents - Border components {width, style, color}
 * @returns {string} CSS border value like "2px solid red"
 */
const stringifyCSSBorder = (borderComponents) => {
  if (!borderComponents) {
    return "none";
  }

  const { width, style, color } = borderComponents;

  // Handle special cases
  if (width === 0 || style === "none") {
    return "none";
  }

  // Build border string
  const parts = [];

  if (width !== undefined && width !== null) {
    parts.push(`${width}px`);
  }

  if (style) {
    parts.push(style);
  }

  if (color) {
    // Stringify the parsed color back to CSS
    const colorString = stringifyCSSColor(color);
    if (colorString && colorString !== "transparent") {
      parts.push(colorString);
    } else if (colorString === "transparent") {
      parts.push("transparent");
    }
  }

  return parts.join(" ") || "none";
};

// Convert transform object to CSS string
const stringifyCSSTransform = (transformObj, normalize) => {
  const transforms = [];
  for (const key of Object.keys(transformObj)) {
    const transformPartValue = transformObj[key];
    const normalizedTransformPartValue = normalize(
      transformPartValue,
      key,
      "css",
    );
    transforms.push(`${key}(${normalizedTransformPartValue})`);
  }
  if (transforms.length === 0) {
    return "none";
  }
  return transforms.join(" ");
};

// Parse transform CSS string into object
const parseCSSTransform = (transformString, normalize) => {
  if (!transformString || transformString === "none") {
    return {};
  }

  const transformObj = {};

  for (const { functionName, value, source } of readTransformFunctions(
    transformString,
  )) {
    // Handle matrix functions specially
    if (functionName === "matrix" || functionName === "matrix3d") {
      const matrixComponents = parseMatrixTransform(source);
      if (matrixComponents) {
        // Only add non-default values to preserve original information
        Object.assign(transformObj, matrixComponents);
      }
      // If matrix can't be parsed to simple components, skip it (keep complex transforms as-is)
      continue;
    }

    // Handle regular transform functions
    const normalizedValue = normalize(value.trim(), functionName, "js");
    if (normalizedValue !== undefined) {
      transformObj[functionName] = normalizedValue;
    }
  }

  // Return undefined if no properties were extracted (preserves original information)
  return Object.keys(transformObj).length > 0 ? transformObj : undefined;
};

// Cuts "translateX(10px) translateY(env(safe-area-inset-top))" into its
// functions. Parentheses are counted rather than matched with a regex: a
// transform value may hold calc(), env(), min()… and stopping at the first ")"
// truncates them.
const TRANSFORM_FUNCTION_START_REGEX = /(\w+)\(/g;
const readTransformFunctions = (transformString) => {
  const transformFunctions = [];
  TRANSFORM_FUNCTION_START_REGEX.lastIndex = 0;
  let match;
  while ((match = TRANSFORM_FUNCTION_START_REGEX.exec(transformString))) {
    const valueStart = match.index + match[0].length;
    let depth = 1;
    let index = valueStart;
    while (index < transformString.length && depth > 0) {
      const char = transformString[index];
      if (char === "(") {
        depth++;
      } else if (char === ")") {
        depth--;
      }
      index++;
    }
    if (depth > 0) {
      // Unbalanced: nothing reliable left to read after this point.
      break;
    }
    transformFunctions.push({
      functionName: match[1],
      value: transformString.slice(valueStart, index - 1),
      source: transformString.slice(match.index, index),
    });
    TRANSFORM_FUNCTION_START_REGEX.lastIndex = index;
  }
  return transformFunctions;
};
// Parse a matrix transform and extract simple transform components when possible
const parseMatrixTransform = (matrixString) => {
  // Match matrix() or matrix3d() functions
  const matrixMatch = matrixString.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!matrixMatch) {
    return null;
  }

  const values = matrixMatch[1].split(",").map((v) => parseFloat(v.trim()));

  if (matrixString.includes("matrix3d")) {
    // matrix3d(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p)
    if (values.length !== 16) {
      return null;
    }
    const [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = values;
    // Check if it's a simple 2D transform (most common case)
    if (
      c === 0 &&
      d === 0 &&
      g === 0 &&
      h === 0 &&
      i === 0 &&
      j === 0 &&
      k === 1 &&
      l === 0 &&
      o === 0 &&
      p === 1
    ) {
      // This is essentially a 2D transform
      return parseSimple2DMatrix(a, b, e, f, m, n);
    }
    return null; // Complex 3D transform
  }
  // matrix(a, b, c, d, e, f)
  if (values.length !== 6) {
    return null;
  }
  const [a, b, c, d, e, f] = values;
  return parseSimple2DMatrix(a, b, c, d, e, f);
};
// Parse a simple 2D matrix into transform components
const parseSimple2DMatrix = (a, b, c, d, e, f) => {
  const result = {};

  // Extract translation - only add if not default (0)
  if (e !== 0) {
    result.translateX = e;
  }
  if (f !== 0) {
    result.translateY = f;
  }

  // Check for identity matrix (no transform)
  if (a === 1 && b === 0 && c === 0 && d === 1) {
    return result; // Only translation
  }

  // Decompose the 2D transformation matrix
  // Based on: https://frederic-wang.fr/decomposition-of-2d-transform-matrices.html

  const det = a * d - b * c;
  // Degenerate matrix (maps to a line or point)
  if (det === 0) {
    return null;
  }

  // Extract scale and rotation
  if (c === 0) {
    // Simple case: no skew
    if (a !== 1) {
      result.scaleX = a;
    }
    if (d !== 1) {
      result.scaleY = d;
    }
    if (b !== 0) {
      const angle = Math.atan(b / a) * (180 / Math.PI);
      if (angle !== 0) {
        result.rotate = angle;
      }
    }
    return result;
  }

  // General case: decompose using QR decomposition approach
  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = det / scaleX;
  const rotation = Math.atan2(b, a) * (180 / Math.PI);
  const skewX =
    Math.atan((a * c + b * d) / (scaleX * scaleX)) * (180 / Math.PI);
  if (scaleX !== 1) {
    result.scaleX = scaleX;
  }
  if (scaleY !== 1) {
    result.scaleY = scaleY;
  }
  if (rotation !== 0) {
    result.rotate = rotation;
  }
  if (skewX !== 0) {
    result.skewX = skewX;
  }
  return result;
};

const parseCSSWillChange = (willChangeString) => {
  if (!willChangeString || typeof willChangeString !== "string") {
    return [];
  }
  if (willChangeString === "auto") {
    return "auto";
  }
  return willChangeString
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

const stringifyCSSWillChange = (willChangeArray) => {
  if (!Array.isArray(willChangeArray) || willChangeArray.length === 0) {
    return "auto";
  }
  return willChangeArray.join(", ");
};

// Properties that can use px units
const pxPropertySet = new Set([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "top",
  "left",
  "right",
  "bottom",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "outlineWidth",
  "outlineOffset",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontSize",
  // lineHeight intentionally excluded - it should remain unitless when no unit is specified
  "letterSpacing",
  "wordSpacing",
  "translateX",
  "translateY",
  "translateZ",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "gap",
  "rowGap",
  "columnGap",
]);

// Properties that need deg units
const degPropertySet = new Set([
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY",
]);

// Properties that should remain unitless
const unitlessPropertySet = new Set([
  "opacity",
  "zIndex",
  "flexGrow",
  "flexShrink",
  "order",
  "columnCount",
  "scale",
  "scaleX",
  "scaleY",
  "scaleZ",
]);

// Well-known CSS units and keywords that indicate a value already has proper formatting
const cssSizeUnitSet = new Set([
  "px",
  "em",
  "rem",
  "ex",
  "ch",
  "vw",
  "vh",
  "dvw",
  "dvh",
  "svw",
  "svh",
  "lvw",
  "lvh",
  "vmin",
  "vmax",
  "cm",
  "mm",
  "in",
  "pt",
  "pc",
  "cap",
]);
const cssUnitSet = new Set([
  ...cssSizeUnitSet,
  "%",
  // Angle units
  "deg",
  "rad",
  "grad",
  "turn",
  // Time units
  "s",
  "ms",
  // Frequency units
  "Hz",
  "kHz",
]);
// Global CSS keywords that apply to any property
const globalCSSKeywordSet = new Set([
  "auto",
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
]);
// Keywords for backgroundImage property that should NOT be wrapped in url()
// Used to prevent: background: "none" becoming background: "url(none)"
const backgroundKeywordSet = new Set([
  ...globalCSSKeywordSet,
  // Background-specific keywords
  "transparent",
  "currentColor",
]);

const colorPropertySet = new Set([
  "outlineColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "backgroundColor",
  "color",
  "textDecorationColor",
  "textEmphasisColor",
  "caretColor",
  "columnRuleColor",
  "accentColor",
  "scrollbarColor",
  "stroke",
  "fill",
]);

const getUnit = (value) => {
  for (const cssUnit of cssUnitSet) {
    if (value.endsWith(cssUnit)) {
      return cssUnit;
    }
  }
  return "";
};
const hasCSSSizeUnit = (value) => cssSizeUnitSet.has(getUnit(value));

// A single number and nothing else — the only shape a unit may be appended to.
// Everything else already says what it is: a unit ("2em"), a keyword ("auto"),
// a CSS expression ("env(safe-area-inset-top)", "calc(…)") or a list of those
// ("0 auto", "10px env(safe-area-inset-right)"). Asking "is this one number"
// covers them all at once; listing what must be left alone (keywords, then
// functions, then lists…) only ever covers what someone thought of.
const isBareNumber = (value) => {
  if (value === "") {
    return false;
  }
  return !isNaN(Number(value));
};
// The same number, carrying exactly the unit asked for, and nothing else.
const isBareNumberWithUnit = (value, unit) => {
  if (!value.endsWith(unit)) {
    return false;
  }
  return isBareNumber(value.slice(0, -unit.length));
};

// url(
// linear-gradient(
// radial-gradient(
// ...
const STARTS_WITH_CSS_IMAGE_FUNCTION_REGEX = /^[a-z-]+\(/;
// Normalize a single style value
const normalizeStyle = (
  value,
  propertyName,
  context = "js",
  element,
) => {
  if (propertyName === "transform") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSTransform(value, normalizeStyle);
      }
      // If code does transform: { translateX: "10px" }
      // we want to store { translateX: 10 }
      const transformNormalized = {};
      for (const key of Object.keys(value)) {
        const partValue = normalizeStyle(value[key], key, context, element);
        transformNormalized[key] = partValue;
      }
      return transformNormalized;
    }
    if (typeof value === "object" && value !== null) {
      // For CSS context, ensure transform is a string
      return stringifyCSSTransform(value, normalizeStyle);
    }
    return value;
  }

  if (propertyName === "willChange") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer arrays
        return parseCSSWillChange(value);
      }
      return value;
    }
    if (Array.isArray(value)) {
      // For CSS context, ensure willChange is a string
      return stringifyCSSWillChange(value);
    }
    return value;
  }

  if (propertyName === "background") {
    if (context === "js") {
      if (typeof value === "string") {
        if (isCSSKeyword(value)) {
          return value;
        }
        // For js context, prefer objects
        return parseCSSBackground(value, {
          parseStyle,
          element,
        });
      }
      // If code does background: { color: "red", image: "url(...)" }
      // we want to normalize each part
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const backgroundNormalized = {};
        for (const key of Object.keys(value)) {
          const partValue = normalizeStyle(
            value[key],
            `background${key.charAt(0).toUpperCase() + key.slice(1)}`,
            context,
            element,
          );
          backgroundNormalized[key] = partValue;
        }
        return backgroundNormalized;
      }
      return value;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // For CSS context, ensure background is a string
      return stringifyCSSBackground(value, normalizeStyle);
    }
    return value;
  }

  if (propertyName === "border") {
    if (context === "js") {
      if (typeof value === "string") {
        if (isCSSKeyword(value)) {
          return value;
        }
        // For js context, prefer objects
        return parseCSSBorder(value, element);
      }
      // If code does border: { width: 2, style: "solid", color: "red" }
      // we want to normalize each part
      if (value === null) {
        return null;
      }
      if (typeof value === "object") {
        const { width, style, color } = value;
        const borderNormalized = {
          width: normalizeStyle(width, "borderWidth", context, element),
          style: normalizeStyle(style, "borderStyle", context, element),
          color: normalizeStyle(color, "borderColor", context, element),
        };
        return borderNormalized;
      }
      return value;
    }
    if (typeof value !== "string") {
      return stringifyCSSBorder(value);
    }
    return value;
  }

  // Handle transform.* properties (e.g., "transform.translateX")
  if (propertyName.startsWith("transform.")) {
    if (context === "css") {
      console.warn(
        `normalizeStyle: magic properties like "${propertyName}" are not applicable in "css" context. Returning original value.`,
      );
      return value;
    }
    const transformProperty = propertyName.slice(10); // Remove "transform." prefix
    // If value is a CSS transform string, parse it first to extract the specific property
    if (typeof value === "string") {
      if (value === "none") {
        if (transformProperty.startsWith("scale")) {
          return 1;
        }
        // translate, rotate, skew
        return 0;
      }
      const parsedTransform = parseCSSTransform(value, normalizeStyle);
      return parsedTransform?.[transformProperty];
    }
    // If value is a transform object, extract the property directly
    if (typeof value === "object" && value !== null) {
      return value[transformProperty];
    }
    // never supposed to happen, the value given is neither string nor object
    return undefined;
  }

  if (propertyName === "backgroundImage") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer structured objects
        return parseCSSImage(value, element);
      }
      return value;
    }
    if (typeof value === "object" && value !== null) {
      // For CSS context, ensure backgroundImage is a string
      return stringifyCSSImage(value);
    }
    // Fallback: add url() wrapper if needed
    if (
      typeof value === "string" &&
      !backgroundKeywordSet.has(value) &&
      !STARTS_WITH_CSS_IMAGE_FUNCTION_REGEX.test(value)
    ) {
      return `url(${value})`;
    }
    return value;
  }

  if (propertyName === "lineHeight") {
    if (context === "js") {
      if (typeof value === "string") {
        if (isCSSFunction(value)) {
          return value;
        }
        const unit = getUnit(value);
        if (unit === "px") {
          const float = parseFloat(value);
          return float;
        }
        if (unit === "") {
          return `${value}em`;
        }
        return value;
      }
    }
    if (context === "css") {
      if (typeof value === "number") {
        // When line height is converted to a number it means
        // it was in pixels, we must restore the unit
        return `${value}px`;
      }
    }
    return value;
  }

  if (pxPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "px",
      preferedType: context === "js" ? "number" : "string",
    });
  }
  if (degPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "deg",
      preferedType: "string",
    });
  }
  if (unitlessPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "",
      preferedType: context === "js" ? "number" : "string",
    });
  }

  if (colorPropertySet.has(propertyName)) {
    if (typeof value === "string") {
      if (isCSSKeyword(value)) {
        return value;
      }
      if (isCSSFunction(value)) {
        return value;
      }
    }
    const rgba = parseCSSColor(value, element);
    if (rgba === null) {
      // parseCSSColor could not parse the value (e.g. a CSS variable or unknown keyword)
      // return as-is so the original string reaches the DOM unchanged
      return value;
    }
    if (context === "js") {
      return rgba;
    }
    return stringifyCSSColor(rgba);
  }

  return value;
};
const parseStyle = (value, propertyName, element) => {
  return normalizeStyle(value, propertyName, "js", element);
};
const stringifyStyle = (value, propertyName, element) => {
  return normalizeStyle(value, propertyName, "css", element);
};

const isCSSFunction = (value) => {
  return /^[a-z-]+\(/.test(value);
};
const isCSSKeyword = (value) => {
  return globalCSSKeywordSet.has(value);
};
const normalizeNumber = (value, { unit, propertyName, preferedType }) => {
  if (typeof value === "string") {
    value = value.trim();
    if (preferedType === "string") {
      // Everything that is not a lone number already carries its own meaning
      // and goes to the DOM untouched: "2em", "auto", "env(safe-area-inset-top)",
      // "calc(…)", "0 auto", "10px env(safe-area-inset-right)".
      if (unit && isBareNumber(value)) {
        return `${value}${unit}`;
      }
      return value;
    }
    // A number to work with, only when the value is exactly one:
    // "12px" -> 12, "0.5" -> 0.5. "10px 20px" is a list and "calc(…)" is an
    // expression — parseFloat would silently keep their first number.
    if (unit ? isBareNumberWithUnit(value, unit) : isBareNumber(value)) {
      return parseFloat(value);
    }
    return value;
  }
  if (typeof value === "number") {
    if (isNaN(value)) {
      console.warn(`NaN found for "${propertyName}"`);
    }
    if (preferedType === "number") {
      return value;
    }
    // convert to string with unit
    return `${value}${unit}`;
  }

  return value;
};

// Normalize styles for DOM application
const normalizeStyles = (styles, context = "js", mutate = false) => {
  if (!styles) {
    return mutate ? styles : {};
  }
  if (typeof styles === "string") {
    styles = parseStyleString(styles, context);
    return styles;
  }
  if (mutate) {
    for (const key of Object.keys(styles)) {
      const value = styles[key];
      styles[key] = normalizeStyle(value, key, context);
    }
    return styles;
  }
  const normalized = {};
  for (const key of Object.keys(styles)) {
    const value = styles[key];
    if (value === undefined) {
      continue;
    }
    normalized[key] = normalizeStyle(value, key, context);
  }
  return normalized;
};

/**
 * Parses a CSS style string into a style object.
 * Handles CSS properties with proper camelCase conversion.
 *
 * @param {string} styleString - CSS style string like "color: red; font-size: 14px;"
 * @returns {object} Style object with camelCase properties
 */
const parseStyleString = (styleString, context = "js") => {
  const style = {};

  if (!styleString || typeof styleString !== "string") {
    return style;
  }

  // Split by semicolon and process each declaration
  const declarations = styleString.split(";");

  for (let declaration of declarations) {
    declaration = declaration.trim();
    if (!declaration) continue;

    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;

    const property = declaration.slice(0, colonIndex).trim();
    const value = declaration.slice(colonIndex + 1).trim();

    if (property && value) {
      // CSS custom properties (starting with --) should NOT be converted to camelCase
      if (property.startsWith("--")) {
        style[property] = normalizeStyle(value, property, context);
      } else {
        // Convert kebab-case to camelCase (e.g., "font-size" -> "fontSize")
        const camelCaseProperty = property.replace(
          /-([a-z])/g,
          (match, letter) => letter.toUpperCase(),
        );
        style[camelCaseProperty] = normalizeStyle(
          value,
          camelCaseProperty,
          context,
        );
      }
    }
  }

  return style;
};

const getComputedStyle$1 = (element) => {
  return elementToOwnerWindow(element).getComputedStyle(element);
};

const getStyle = (element, name, context) => {
  const computedStyle = getComputedStyle$1(element);
  const value = isCamelCase(name)
    ? computedStyle[name]
    : computedStyle.getPropertyValue(name);
  return normalizeStyle(value, name, context, element);
};

const isCamelCase = (str) => {
  // Check if string contains lowercase letter followed by uppercase letter (camelCase pattern)
  return /[a-z][A-Z]/.test(str);
};
const setStyle = (element, name, value) => {

  const prevValue = element.style[name];
  if (prevValue) {
    element.style.setProperty(name, value);
    return () => {
      element.style.setProperty(name, prevValue);
    };
  }
  element.style.setProperty(name, value);
  return () => {
    element.style.removeProperty(name);
  };
};
const forceStyle = (element, name, value) => {
  const inlineStyleValue = element.style[name];
  if (inlineStyleValue === value) {
    return () => {};
  }
  const computedStyleValue = getStyle(element, name);
  if (computedStyleValue === value) {
    return () => {};
  }
  const restoreStyle = setStyle(element, name, value);
  return restoreStyle;
};

const createSetMany$1 = (setter) => {
  return (element, description) => {
    const cleanupCallbackSet = new Set();
    for (const name of Object.keys(description)) {
      const value = description[name];
      const restoreStyle = setter(element, name, value);
      cleanupCallbackSet.add(restoreStyle);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
  };
};

const setStyles = createSetMany$1(setStyle);
const forceStyles = createSetMany$1(forceStyle);

// Merge two style objects, handling special cases like transform
const mergeTwoStyles = (stylesA, stylesB, context = "js") => {
  if (!stylesA) {
    return normalizeStyles(stylesB, context);
  }
  if (!stylesB) {
    return normalizeStyles(stylesA, context);
  }
  const result = {};
  const aKeys = Object.keys(stylesA);
  // in case stylesB is a string we first parse it
  stylesB = normalizeStyles(stylesB, context);
  if (aKeys.length === 0) {
    return stylesB;
  }
  const bKeyToVisitSet = new Set(Object.keys(stylesB));
  for (const aKey of aKeys) {
    const bHasKey = bKeyToVisitSet.has(aKey);
    if (bHasKey) {
      bKeyToVisitSet.delete(aKey);
      result[aKey] = mergeOneStyle(stylesA[aKey], stylesB[aKey], aKey, context);
    } else {
      result[aKey] = normalizeStyle(stylesA[aKey], aKey, context);
    }
  }
  for (const bKey of bKeyToVisitSet) {
    result[bKey] = stylesB[bKey];
  }
  return result;
};

const appendStyles = (
  stylesAObject,
  stylesBNormalized,
  context = "js",
) => {
  const aKeys = Object.keys(stylesAObject);
  const bKeys = Object.keys(stylesBNormalized);
  for (const bKey of bKeys) {
    const aHasKey = aKeys.includes(bKey);
    if (aHasKey) {
      stylesAObject[bKey] = mergeOneStyle(
        stylesAObject[bKey],
        stylesBNormalized[bKey],
        bKey,
        context,
      );
    } else {
      stylesAObject[bKey] = stylesBNormalized[bKey];
    }
  }
  return stylesAObject;
};

// Merge a single style property value with an existing value
const mergeOneStyle = (
  existingValue,
  newValue,
  propertyName,
  context = "js",
) => {
  if (propertyName === "transform") {
    // Matrix parsing is now handled automatically in parseCSSTransform

    // Determine the types
    const existingIsString =
      typeof existingValue === "string" && existingValue !== "none";
    const newIsString = typeof newValue === "string" && newValue !== "none";
    const existingIsObject =
      typeof existingValue === "object" && existingValue !== null;
    const newIsObject = typeof newValue === "object" && newValue !== null;

    // Case 1: Both are objects - merge directly
    if (existingIsObject && newIsObject) {
      const merged = { ...existingValue, ...newValue };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 2: New is object, existing is string - parse existing and merge
    if (newIsObject && existingIsString) {
      const parsedExisting = parseCSSTransform(existingValue, normalizeStyle);
      const merged = { ...parsedExisting, ...newValue };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 3: New is string, existing is object - parse new and merge
    if (newIsString && existingIsObject) {
      const parsedNew = parseCSSTransform(newValue, normalizeStyle);
      const merged = { ...existingValue, ...parsedNew };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const parsedExisting = parseCSSTransform(existingValue, normalizeStyle);
      const parsedNew = parseCSSTransform(newValue, normalizeStyle);
      const merged = { ...parsedExisting, ...parsedNew };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 5: New is object, no existing or existing is none/null
    if (newIsObject) {
      return context === "css"
        ? stringifyCSSTransform(newValue, normalizeStyle)
        : newValue;
    }

    // Case 6: New is string, no existing or existing is none/null
    if (newIsString) {
      if (context === "css") {
        return newValue; // Already a string
      }
      return parseCSSTransform(newValue, normalizeStyle); // Convert to object
    }
    return newValue;
  }

  if (propertyName === "willChange") {
    const existingIsString = typeof existingValue === "string";
    const newIsString = typeof newValue === "string";
    const existingIsArray = Array.isArray(existingValue);
    const newIsArray = Array.isArray(newValue);

    // Case 1: Both are arrays - merge directly
    if (existingIsArray && newIsArray) {
      const merged = [...new Set([...existingValue, ...newValue])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 2: New is array, existing is string - parse existing and merge
    if (newIsArray && existingIsString) {
      const existingArray = parseCSSWillChange(existingValue);
      const merged = [...new Set([...existingArray, ...newValue])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 3: New is string, existing is array - parse new and merge
    if (newIsString && existingIsArray) {
      const newArray = parseCSSWillChange(newValue);
      const merged = [...new Set([...existingValue, ...newArray])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const existingArray = parseCSSWillChange(existingValue);
      const newArray = parseCSSWillChange(newValue);
      const merged = [...new Set([...existingArray, ...newArray])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 5: New is array, no existing or existing is null/undefined
    if (newIsArray) {
      if (context === "css") {
        return stringifyCSSWillChange(newValue);
      }
      return newValue;
    }

    // Case 6: New is string, no existing or existing is null/undefined
    if (newIsString) {
      if (context === "css") {
        return newValue;
      }
      const parsed = parseCSSWillChange(newValue);
      return parsed;
    }
    // Fallback: return newValue as is
    return newValue;
  }

  // For all other properties, simple replacement
  return newValue;
};

/**
 * Style Controller System
 *
 * Solves CSS style manipulation problems in JavaScript:
 *
 * ## Main problems:
 * 1. **Temporary style override**: Code wants to read current style, force another style,
 *    then restore original. With inline styles this is ugly and loses original info.
 * 2. **Multiple code parts**: When different parts of code want to touch styles simultaneously,
 *    they step on each other (rare but happens).
 * 3. **Transform composition**: CSS transforms are especially painful - you want to keep
 *    existing transforms but force specific parts (e.g., keep `rotate(45deg)` but override
 *    `translateX`). Native CSS overwrites the entire transform property.
 *
 * ## Solution:
 * Controller pattern + Web Animations API to preserve inline styles. Code that sets
 * inline styles expects to find them unchanged - we use animations for clean override:
 *
 * ```js
 * const controller = createStyleController("myFeature");
 *
 * // Smart value conversion (100 → "100px", 45 → "45deg")
 * controller.set(element, {
 *   transform: { translateX: 100, rotate: 45 }, // Individual transform properties
 *   opacity: 0.5
 * });
 *
 * // Transform objects merged intelligently
 * controller.set(element, {
 *   transform: { translateX: 50 } // Merges with existing transforms
 * });
 *
 * // Get underlying value without this controller's influence
 * const originalOpacity = controller.getUnderlyingValue(element, "opacity");
 * const originalTranslateX = controller.getUnderlyingValue(element, "transform.translateX"); // Magic dot notation!
 * const actualWidth = controller.getUnderlyingValue(element, "rect.width"); // Layout measurements
 *
 * controller.delete(element, "opacity"); // Only removes opacity, keeps transform
 * controller.clear(element); // Removes all styles from this controller only
 * controller.clearAll(); // Cleanup when done
 * ```
 *
 * **Key features:**
 * - **Transform composition**: Intelligently merges transform components instead of overwriting
 * - **Magic properties**: Access transform components with dot notation (e.g., "transform.translateX")
 * - **Layout measurements**: Access actual rendered dimensions with rect.* (e.g., "rect.width")
 * - **getUnderlyingValue()**: Read the "natural" value without this controller's influence
 * - **Smart units**: Numeric values get appropriate units automatically (px, deg, unitless)
 *
 * **Transform limitations:**
 * - **3D Transforms**: Complex `matrix3d()` transforms are preserved as-is and cannot be decomposed
 *   into individual properties. Only `matrix3d()` that represent simple 2D transforms are converted
 *   to object notation. Magic properties like "transform.rotateX" work only with explicit CSS functions,
 *   not with complex 3D matrices.
 *
 * Multiple controllers can safely manage the same element without conflicts.
 */


// Global registry to track which controllers are managing each element's styles
const elementControllerSetRegistry = new WeakMap(); // element -> Set<controller>

// Top-level helpers for controller attachment tracking
const onElementControllerAdded = (element, controller) => {
  if (!elementControllerSetRegistry.has(element)) {
    elementControllerSetRegistry.set(element, new Set());
  }
  const elementControllerSet = elementControllerSetRegistry.get(element);
  elementControllerSet.add(controller);
};
const onElementControllerRemoved = (element, controller) => {
  const elementControllerSet = elementControllerSetRegistry.get(element);
  if (elementControllerSet) {
    elementControllerSet.delete(controller);

    // Clean up empty element registry
    if (elementControllerSet.size === 0) {
      elementControllerSetRegistry.delete(element);
    }
  }
};

/**
 * Creates a style controller that can safely manage CSS styles on DOM elements.
 *
 * Uses Web Animations API to override styles without touching inline styles,
 * allowing multiple controllers to work together and providing intelligent transform composition.
 *
 * @param {string} [name="anonymous"] - Debug name for the controller
 * @returns {Object} Controller with methods: set, get, delete, getUnderlyingValue, commit, clear, clearAll
 *
 * @example
 * const controller = createStyleController("myFeature");
 * controller.set(element, { opacity: 0.5, transform: { translateX: 100 } });
 * controller.getUnderlyingValue(element, "opacity"); // Read value without controller influence
 * controller.clearAll(); // Cleanup
 */
const createStyleController = (name = "anonymous") => {
  // Store element data for this controller: element -> { styles, animation }
  const elementWeakMap = new WeakMap();

  const set = (element, stylesToSet) => {
    if (!element || typeof element !== "object") {
      throw new Error("Element must be a valid DOM element");
    }
    if (!stylesToSet || typeof stylesToSet !== "object") {
      throw new Error("styles must be an object");
    }

    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      const normalizedStylesToSet = normalizeStyles(stylesToSet, "js");
      const animation = createAnimationForStyles(
        element,
        normalizedStylesToSet,
        name,
      );
      elementWeakMap.set(element, {
        styles: normalizedStylesToSet,
        animation,
      });
      onElementControllerAdded(element, controller);
      return;
    }

    const { styles, animation } = elementData;
    const mergedStyles = mergeTwoStyles(styles, stylesToSet);
    elementData.styles = mergedStyles;
    updateAnimationStyles(animation, mergedStyles);
  };

  const get = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return undefined;
    }
    const { styles } = elementData;
    if (propertyName === undefined) {
      return { ...styles };
    }
    if (propertyName.startsWith("transform.")) {
      const transformProp = propertyName.slice("transform.".length);
      return styles.transform?.[transformProp];
    }
    return styles[propertyName];
  };

  const deleteMethod = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const { styles, animation } = elementData;
    if (propertyName.startsWith("transform.")) {
      const transformProp = propertyName.slice("transform.".length);
      const transformObject = styles.transform;
      if (!transformObject) {
        return;
      }
      const hasTransformProp = Object.hasOwn(transformObject, transformProp);
      if (!hasTransformProp) {
        return;
      }
      delete transformObject[transformProp];
      if (Object.keys(transformObject).length === 0) {
        delete styles.transform;
      }
    } else {
      const hasStyle = Object.hasOwn(styles, propertyName);
      if (!hasStyle) {
        return;
      }
      delete styles[propertyName];
    }
    const isEmpty = Object.keys(styles).length === 0;
    // Clean up empty controller
    if (isEmpty) {
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
      return;
    }
    updateAnimationStyles(animation, styles);
  };

  const commit = (element) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return; // Nothing to commit on this element for this controller
    }
    const { styles, animation } = elementData;
    // Cancel our animation permanently since we're committing styles to inline
    // (Keep this BEFORE getComputedStyle to prevent computedStyle reading our animation styles)
    animation.cancel();
    // Now read the true underlying styles (without our animation influence)
    const computedStyles = getComputedStyle(element);
    // Convert controller styles to CSS and commit to inline styles
    const cssStyles = normalizeStyles(styles, "css");
    for (const [key, value] of Object.entries(cssStyles)) {
      // Merge with existing computed styles for all properties
      const existingValue = computedStyles[key];
      element.style[key] = mergeOneStyle(existingValue, value, key, "css");
    }
    // Clear this controller's styles since they're now inline
    elementWeakMap.delete(element);
    // Clean up controller from element registry
    onElementControllerRemoved(element, controller);
  };

  const clear = (element) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const { animation } = elementData;
    animation.cancel();
    elementWeakMap.delete(element);
    onElementControllerRemoved(element, controller);
  };

  const getUnderlyingValue = (element, propertyName) => {
    const elementControllerSet = elementControllerSetRegistry.get(element);

    const normalizeValueForJs = (value) => {
      // Use parseStyle to handle all property types including transform dot notation
      return parseStyle(value, propertyName, element);
    };

    const getFromOtherControllers = () => {
      if (!elementControllerSet || elementControllerSet.size <= 1) {
        return undefined;
      }

      let resultValue;
      for (const otherController of elementControllerSet) {
        if (otherController === controller) continue;
        const otherStyles = otherController.get(element);
        if (propertyName in otherStyles) {
          resultValue = mergeOneStyle(
            resultValue,
            otherStyles[propertyName],
            propertyName,
          );
        }
      }

      // Note: For CSS width/height properties, we can trust the values from other controllers
      // because we assume box-sizing: border-box. If the element used content-box,
      // the CSS width/height would differ from getBoundingClientRect() due to padding/borders,
      // but since controllers set the final rendered size, the CSS value is what matters.
      // For actual layout measurements, use rect.* properties instead.
      return normalizeValueForJs(resultValue);
    };

    const getFromDOM = () => {
      // Handle transform dot notation
      if (propertyName.startsWith("transform.")) {
        const transformValue = getComputedStyle(element).transform;
        return normalizeValueForJs(transformValue);
      }
      // For all other CSS properties, use computed styles
      const computedValue = getComputedStyle(element)[propertyName];
      return normalizeValueForJs(computedValue);
    };

    const getFromDOMLayout = () => {
      // For rect.* properties that reflect actual layout, always read from DOM
      // These represent the actual rendered dimensions, bypassing any controller influence
      if (propertyName === "rect.width") {
        return element.getBoundingClientRect().width;
      }
      if (propertyName === "rect.height") {
        return element.getBoundingClientRect().height;
      }
      if (propertyName === "rect.left") {
        return element.getBoundingClientRect().left;
      }
      if (propertyName === "rect.top") {
        return element.getBoundingClientRect().top;
      }
      if (propertyName === "rect.right") {
        return element.getBoundingClientRect().right;
      }
      if (propertyName === "rect.bottom") {
        return element.getBoundingClientRect().bottom;
      }
      return undefined;
    };

    const getWhileDisablingThisController = (fn) => {
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        return fn();
      }
      const { styles, animation } = elementData;
      // Temporarily cancel our animation to read underlying value
      animation.cancel();
      const underlyingValue = fn();
      // Restore our animation
      elementData.animation = createAnimationForStyles(element, styles, name);
      return underlyingValue;
    };

    if (typeof propertyName === "function") {
      return getWhileDisablingThisController(propertyName);
    }

    // Handle computed layout properties (rect.*) - always read from DOM, bypass controllers
    if (propertyName.startsWith("rect.")) {
      return getWhileDisablingThisController(getFromDOMLayout);
    }
    if (!elementControllerSet || !elementControllerSet.has(controller)) {
      // This controller is not applied, just read current value
      return getFromDOM();
    }
    // Check if other controllers would provide this style
    const valueFromOtherControllers = getFromOtherControllers();
    if (valueFromOtherControllers !== undefined) {
      return valueFromOtherControllers;
    }
    return getWhileDisablingThisController(getFromDOM);
  };

  const clearAll = () => {
    // Remove this controller from all elements and clean up animations
    for (const [
      element,
      elementControllerSet,
    ] of elementControllerSetRegistry) {
      if (!elementControllerSet.has(controller)) {
        continue;
      }
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        continue;
      }
      const { animation } = elementData;
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
    }
  };
  const controller = {
    name,
    set,
    get,
    delete: deleteMethod,
    getUnderlyingValue,
    commit,
    clear,
    clearAll,
  };

  return controller;
};

const getStyleForKeyframe = (styles) => {
  const cssStyles = normalizeStyles(styles, "css");
  return cssStyles;
};
const createAnimationForStyles = (element, styles, id) => {
  const cssStylesToSet = getStyleForKeyframe(styles);
  const animation = element.animate([cssStylesToSet], {
    duration: 0,
    fill: "forwards",
  });
  animation.id = id; // Set a debug name for this animation
  animation.play();
  animation.pause();
  return animation; // Return the created animation
};

const updateAnimationStyles = (animation, styles) => {
  const cssStyles = getStyleForKeyframe(styles);
  animation.effect.setKeyframes([cssStyles]);
  animation.play();
  animation.pause();
};

const dormantStyleController = createStyleController("dormant");
const getOpacity = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "opacity");
};
const getTranslateX = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(
    element,
    "transform.translateX",
  );
};
const getTranslateY = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(
    element,
    "transform.translateY",
  );
};
const getWidth$1 = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "rect.width");
};
const getHeight$1 = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "rect.height");
};
const getBorderRadius = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "borderRadius");
};
const getBorder = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "border");
};
const getBackground = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "background");
};
const getBackgroundColor = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "backgroundColor");
};

// Register the style isolator custom element once
let persistentStyleIsolator = null;
const getNaviStyleIsolator = () => {
  if (persistentStyleIsolator) {
    return persistentStyleIsolator;
  }

  class StyleIsolator extends HTMLElement {
    constructor() {
      super();

      // Create shadow DOM to isolate from external CSS
      const shadow = this.attachShadow({ mode: "closed" });

      shadow.innerHTML = `
        <style>
          :host {
            all: initial;
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            opacity: ${0};
            visibility: ${"hidden"};
            pointer-events: none;
          }
          * {
            all: revert;
          }
        </style>
        <div id="unstyled_element_slot"></div>
      `;

      this.unstyledElementSlot = shadow.querySelector("#unstyled_element_slot");
    }

    getIsolatedStyles(element, context = "js") {
      {
        this.unstyledElementSlot.innerHTML = "";
      }
      const unstyledElement = element.cloneNode(true);
      this.unstyledElementSlot.appendChild(unstyledElement);

      // Get computed styles of the actual element inside the shadow DOM
      const computedStyles = getComputedStyle(unstyledElement);
      // Create a copy of the styles since the original will be invalidated when element is removed
      const stylesCopy = {};
      for (let i = 0; i < computedStyles.length; i++) {
        const property = computedStyles[i];
        stylesCopy[property] = normalizeStyle(
          computedStyles.getPropertyValue(property),
          property,
          context,
        );
      }

      return stylesCopy;
    }
  }

  if (!customElements.get("navi-style-isolator")) {
    customElements.define("navi-style-isolator", StyleIsolator);
  }
  // Create and add the persistent element to the document
  persistentStyleIsolator = document.createElement("navi-style-isolator");
  document.body.appendChild(persistentStyleIsolator);
  return persistentStyleIsolator;
};

const stylesCache = new Map();
/**
 * Gets the default browser styles for an HTML element by creating an isolated custom element
 * @param {string|Element} input - CSS selector (e.g., 'input[type="text"]'), HTML source (e.g., '<button>'), or DOM element
 * @param {string} context - Output format: "js" for JS object (default) or "css" for CSS string
 * @returns {Object|string} Computed styles as JS object or CSS string
 */
const getDefaultStyles = (input, context = "js") => {
  let element;
  let cacheKey;

  // Determine input type and create element accordingly
  if (typeof input === "string") {
    if (input[0] === "<") {
      // HTML source
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = input;
      element = tempDiv.firstElementChild;
      if (!element) {
        throw new Error(`Invalid HTML source: ${input}`);
      }
      cacheKey = `${input}:${context}`;
    } else {
      // CSS selector
      element = createElementFromSelector(input);
      cacheKey = `${input}:${context}`;
    }
  } else if (input instanceof Element) {
    // DOM element
    element = input;
    cacheKey = `${input.outerHTML}:${context}`;
  } else {
    throw new Error(
      "Input must be a CSS selector, HTML source, or DOM element",
    );
  }

  // Check cache first
  if (stylesCache.has(cacheKey)) {
    return stylesCache.get(cacheKey);
  }

  // Get the persistent style isolator element
  const naviStyleIsolator = getNaviStyleIsolator();
  const defaultStyles = naviStyleIsolator.getIsolatedStyles(element, context);

  // Cache the result
  stylesCache.set(cacheKey, defaultStyles);

  return defaultStyles;
};

/**
 * Creates an HTML element from a CSS selector
 * @param {string} selector - CSS selector (e.g., 'input[type="text"]', 'button', 'a[href="#"]')
 * @returns {Element} DOM element
 */
const createElementFromSelector = (selector) => {
  // Parse the selector to extract tag name and attributes
  const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!tagMatch) {
    throw new Error(`Invalid selector: ${selector}`);
  }

  const tagName = tagMatch[1].toLowerCase();
  const element = document.createElement(tagName);

  // Extract and apply attributes from selector
  const attributeRegex = /\[([^=\]]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
  let attributeMatch;

  while ((attributeMatch = attributeRegex.exec(selector)) !== null) {
    const attrName = attributeMatch[1];
    const attrValue =
      attributeMatch[2] || attributeMatch[3] || attributeMatch[4] || "";
    element.setAttribute(attrName, attrValue);
  }

  return element;
};

const addAttributeEffect = (attributeName, effect) => {
  const cleanupWeakMap = new WeakMap();
  const applyEffect = (element) => {
    const cleanup = effect(element);
    cleanupWeakMap.set(
      element,
      typeof cleanup === "function" ? cleanup : () => {},
    );
  };

  const cleanupEffect = (element) => {
    const cleanup = cleanupWeakMap.get(element);
    if (cleanup) {
      cleanup();
      cleanupWeakMap.delete(element);
    }
  };

  const checkElement = (element) => {
    if (element.hasAttribute(attributeName)) {
      applyEffect(element);
    }
    const elementWithAttributeCollection = element.querySelectorAll(
      `[${attributeName}]`,
    );
    for (const elementWithAttribute of elementWithAttributeCollection) {
      applyEffect(elementWithAttribute);
    }
  };

  checkElement(document.body);
  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          checkElement(addedNode);
        }

        for (const removedNode of mutation.removedNodes) {
          if (removedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }

          // Clean up the removed node itself if it had the attribute
          if (
            removedNode.hasAttribute &&
            removedNode.hasAttribute(attributeName)
          ) {
            cleanupEffect(removedNode);
          }

          // Clean up any children of the removed node that had the attribute
          if (removedNode.querySelectorAll) {
            const elementsWithAttribute = removedNode.querySelectorAll(
              `[${attributeName}]`,
            );
            for (const element of elementsWithAttribute) {
              cleanupEffect(element);
            }
          }
        }
      }
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === attributeName
      ) {
        const element = mutation.target;
        if (element.hasAttribute(attributeName)) {
          applyEffect(element);
        } else {
          cleanupEffect(element);
        }
      }
    }
  });
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [attributeName],
  });

  return () => {
    mutationObserver.disconnect();
    for (const cleanup of cleanupWeakMap.values()) {
      cleanup();
    }
    cleanupWeakMap.clear();
  };
};

const setAttribute = (element, name, value) => {
  if (element.hasAttribute(name)) {
    const prevValue = element.getAttribute(name);
    element.setAttribute(name, value);
    return () => {
      element.setAttribute(name, prevValue);
    };
  }
  element.setAttribute(name, value);
  return () => {
    element.removeAttribute(name);
  };
};

const createSetMany = (setter) => {
  return (element, description) => {
    const cleanupCallbackSet = new Set();
    for (const name of Object.keys(description)) {
      const value = description[name];
      const restoreStyle = setter(element, name, value);
      cleanupCallbackSet.add(restoreStyle);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
  };
};

const setAttributes = createSetMany(setAttribute);

const isSameColor = (color1, color2) => {
  if (color1 === color2) {
    return true;
  }
  const color1String = String(parseCSSColor(color1));
  const color2String = String(parseCSSColor(color2));
  return color1String === color2String;
};

/**
 * Returns `"white"` or `"black"`, whichever provides better contrast against
 * the given background color, using OKLCH lightness (perceptually uniform).
 *
 * Uses a threshold of 0.5 on the OKLCH L axis (0–1 scale).
 * Colors with L > threshold are considered light → return "black".
 * Colors with L ≤ threshold are considered dark → return "white".
 *
 * @param {string} backgroundColor - CSS color value (hex, rgb, hsl, CSS variable, …)
 * @param {Element} [element] - DOM element used to resolve CSS variables / computed styles
 * @param {number} [lightnessThreshold=0.5] - OKLCH L threshold (0–1). Below → "white", above → "black".
 * @returns {"white"|"black"}
 * @example
 * contrastColor("#1a202c")    // "white"  (dark background)
 * contrastColor("#f5f5f5")    // "black"  (light background)
 * contrastColor("#e91e8c")    // "white"  (vivid pink, perceptually dark)
 */
const contrastColor = (
  backgroundColor,
  element,
  lightnessThreshold = 0.5,
) => {
  const resolvedBgColor = parseCSSColor(backgroundColor, element);
  if (!resolvedBgColor) {
    return "white";
  }
  const [r, g, b] =
    resolvedBgColor[3] === 1
      ? resolvedBgColor
      : compositeColor(resolvedBgColor, WHITE_RGBA);
  const L = rgbToOklchL(r, g, b);
  return L <= lightnessThreshold ? "white" : "black";
};

/**
 * Resolves the OKLCH lightness of a CSS color (perceptually uniform, 0–1 scale).
 *
 * @param {string} color - CSS color value (hex, rgb, hsl, CSS variable, etc.)
 * @param {Element} [element] - DOM element to resolve CSS variables against
 * @returns {number|null} OKLCH L value (0–1), or null if color cannot be resolved
 * @example
 * resolveOklchLightness("#e91e8c") // ~0.56  (vivid pink feels medium-bright)
 * resolveOklchLightness("#4476ff") // ~0.53  (blue)
 * resolveOklchLightness("#1a202c") // ~0.22  (dark background)
 */
const resolveOklchLightness = (color, element) => {
  const rgba = parseCSSColor(color, element);
  if (!rgba) {
    return null;
  }
  const [r, g, b] = rgba;
  return rgbToOklchL(r, g, b);
};

/**
 * Resolves the WCAG relative luminance of a CSS color (kept for backwards compatibility).
 * @deprecated Prefer resolveOklchLightness for perceptually uniform results.
 */
const resolveColorLuminance = (color, element) => {
  const rgba = parseCSSColor(color, element);
  if (!rgba) {
    return null;
  }
  const [r, g, b] = rgba;
  return getLuminance(r, g, b);
};

const WHITE_RGBA = [255, 255, 255, 1];

/**
 * Converts sRGB (0–255 each) to OKLCH lightness L (0–1).
 * Implements the sRGB → Linear sRGB → XYZ D65 → OKLab → L pipeline.
 */
const rgbToOklchL = (r, g, b) => {
  // sRGB → linear
  const toLinear = (c) => {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear sRGB → LMS (Oklab M1 matrix)
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Cube root
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS → OKLab L
  return 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
};

/**
 * Calculates the contrast ratio between two RGBA colors
 * Based on WCAG 2.1 specification
 * @param {Array<number>} rgba1 - [r, g, b, a] values for first color
 * @param {Array<number>} rgba2 - [r, g, b, a] values for second color
 * @param {Array<number>} [background=[255, 255, 255, 1]] - Background color to composite against when colors have transparency
 * @returns {number} Contrast ratio (1-21)
 */
const getContrastRatio = (
  rgba1,
  rgba2,
  background = [255, 255, 255, 1],
) => {
  // When colors have transparency (alpha < 1), we need to composite them
  // against a background to get their effective appearance
  const composited1 = compositeColor(rgba1, background);
  const composited2 = compositeColor(rgba2, background);

  const lum1 = getLuminance(composited1[0], composited1[1], composited1[2]);
  const lum2 = getLuminance(composited2[0], composited2[1], composited2[2]);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Composites a color with alpha over a background color
 * @param {Array<number>} foreground - [r, g, b, a] foreground color
 * @param {Array<number>} background - [r, g, b, a] background color
 * @returns {Array<number>} [r, g, b] composited color (alpha is flattened)
 */
const compositeColor = (foreground, background) => {
  const [fr, fg, fb, fa] = foreground;
  const [br, bg, bb, ba] = background;

  // No transparency: return the foreground color as-is
  if (fa === 1) {
    return [fr, fg, fb];
  }

  // Alpha compositing formula: C = αA * CA + αB * (1 - αA) * CB
  const alpha = fa + ba * (1 - fa);

  if (alpha === 0) {
    return [0, 0, 0];
  }

  const r = (fa * fr + ba * (1 - fa) * br) / alpha;
  const g = (fa * fg + ba * (1 - fa) * bg) / alpha;
  const b = (fa * fb + ba * (1 - fa) * bb) / alpha;

  return [Math.round(r), Math.round(g), Math.round(b)];
};

/**
 * Calculates the relative luminance of an RGB color
 * Based on WCAG 2.1 specification
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {number} Relative luminance (0-1)
 */
const getLuminance = (r, g, b) => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * First ancestor of `node` matching `predicate`, walking parent by parent.
 * Starts at the parent — `node` itself is never a candidate.
 *
 * @param {Node} node
 * @param {(ancestor: Node) => boolean} predicate
 * @returns {Node|null}
 */
const findAncestor = (node, predicate) => {
  let ancestor = node.parentNode;
  while (ancestor) {
    if (predicate(ancestor)) {
      return ancestor;
    }
    ancestor = ancestor.parentNode;
  }
  return null;
};

/**
 * First descendant of `rootNode` matching `fn`, in document order (depth
 * first). The walk is bounded to the subtree: `rootNode` itself is not a
 * candidate, and a root with no children yields nothing — never the root's
 * siblings.
 *
 * @param {Node} rootNode
 * @param {(node: Node, skip: () => void) => boolean} fn - Return true to stop
 *   on `node`. Call `skip()` to not descend into `node`'s children (the walk
 *   goes on with its siblings).
 * @param {object} [options]
 * @param {Node} [options.skipRoot] - A subtree to leave out entirely, itself
 *   included.
 * @returns {Node|null}
 */
const findDescendant = (rootNode, fn, { skipRoot } = {}) => {
  const iterator = createNextNodeIterator(rootNode, rootNode, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    let skipChildren = false;
    if (node === skipRoot) {
      skipChildren = true;
    } else {
      const skip = () => {
        skipChildren = true;
      };
      if (fn(node, skip)) {
        return node;
      }
    }
    ({ done, value: node } = iterator.next(skipChildren));
  }
  return null;
};

/**
 * Last descendant of `rootNode` matching `fn` in document order — the walk
 * starts at the subtree's deepest final node and moves backwards, so the
 * first match it meets is the last one the document holds.
 *
 * @param {Node} rootNode
 * @param {(node: Node) => boolean} fn
 * @param {object} [options]
 * @param {Node} [options.skipRoot] - A subtree to leave out entirely, itself
 *   included.
 * @returns {Node|null}
 */
const findLastDescendant = (rootNode, fn, { skipRoot } = {}) => {
  const deepestNode = getDeepestNode(rootNode, skipRoot);
  if (deepestNode) {
    const iterator = createPreviousNodeIterator(
      deepestNode,
      rootNode,
      skipRoot,
    );
    let { done, value: node } = iterator.next();
    while (done === false) {
      if (fn(node)) {
        return node;
      }
      ({ done, value: node } = iterator.next());
    }
  }
  return null;
};

/**
 * First node after `from` in document order matching `predicate`. Unlike
 * findDescendant this is anchored to a position, not a container: the walk
 * leaves `from`'s subtree and goes on through its siblings and its ancestors'
 * siblings, until `root`'s subtree is exhausted.
 *
 * @param {Node} from - The position to search from; not a candidate itself.
 * @param {(node: Node) => boolean} predicate
 * @param {object} [options]
 * @param {Node} [options.root] - Bounds the walk to its subtree; null walks to
 *   the end of the tree `from` belongs to.
 * @param {Node} [options.skipRoot] - A subtree to leave out entirely, itself
 *   included. A `from` inside it starts right after it.
 * @param {boolean} [options.skipChildren] - Do not look inside `from`; start
 *   at what follows it.
 * @returns {Node|null}
 */
const findAfter = (
  from,
  predicate,
  { root = null, skipRoot = null, skipChildren = false } = {},
) => {
  const iterator = createAfterNodeIterator(from, root, skipChildren, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

/**
 * First node before `from` in reverse document order matching `predicate` —
 * what findAfter is to "next", this is to "previous". A step back lands on
 * the previous sibling's DEEPEST last node (document order walked backwards),
 * not on the sibling itself.
 *
 * @param {Node} from - The position to search from; not a candidate itself.
 * @param {(node: Node) => boolean} predicate
 * @param {object} [options]
 * @param {Node} [options.root] - Bounds the walk to its subtree; null walks
 *   back to the start of the tree `from` belongs to.
 * @param {Node} [options.skipRoot] - A subtree to leave out entirely, itself
 *   included. A `from` inside it starts right before it.
 * @returns {Node|null}
 */
const findBefore = (
  from,
  predicate,
  { root = null, skipRoot = null } = {},
) => {
  const iterator = createPreviousNodeIterator(from, root, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

const getNextNode = (node, rootNode, skipChild = false, skipRoot = null) => {
  if (!skipChild) {
    const firstChild = node.firstChild;
    if (firstChild) {
      // If the first child is skipRoot or inside skipRoot, skip it
      if (
        skipRoot &&
        (firstChild === skipRoot || skipRoot.contains(firstChild))
      ) {
        // Skip this entire subtree by going to next sibling or up
        return getNextNode(node, rootNode, true, skipRoot);
      }
      return firstChild;
    }
  }

  // The traversal is bounded to rootNode's subtree: the root's own siblings
  // are not part of it. Without this, a rootNode with no children (asking
  // findDescendant about an <input>, say) steps to its next sibling and walks
  // the rest of the document from there — the parentNode guard below never
  // catches it because the walk is already outside the root.
  if (node === rootNode) {
    return null;
  }

  const nextSibling = node.nextSibling;
  if (nextSibling) {
    // If next sibling is skipRoot, skip it entirely
    if (skipRoot && nextSibling === skipRoot) {
      return getNextNode(nextSibling, rootNode, true, skipRoot);
    }
    return nextSibling;
  }

  const parentNode = node.parentNode;
  if (parentNode && parentNode !== rootNode) {
    return getNextNode(parentNode, rootNode, true, skipRoot);
  }

  return null;
};

const createNextNodeIterator = (node, rootNode, skipRoot = null) => {
  let current = node;
  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      innerSkipChildren,
      skipRoot,
    );
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const createAfterNodeIterator = (
  fromNode,
  rootNode,
  skipChildren = false,
  skipRoot = null,
) => {
  let current = fromNode;
  let childrenSkipped = false;

  // If we're inside skipRoot, we need to start searching after skipRoot entirely
  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
    childrenSkipped = true; // Mark that we've already "processed" this node
    skipChildren = true; // Force skip children to exit the skipRoot subtree
  }

  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      (skipChildren && childrenSkipped === false) || innerSkipChildren,
      skipRoot,
    );
    childrenSkipped = true;
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const getDeepestNode = (node, skipRoot = null) => {
  let deepestNode = node.lastChild;
  while (deepestNode) {
    // If we hit skipRoot or enter its subtree, stop going deeper
    if (
      skipRoot &&
      (deepestNode === skipRoot || skipRoot.contains(deepestNode))
    ) {
      // Try the previous sibling instead
      const previousSibling = deepestNode.previousSibling;
      if (previousSibling) {
        return getDeepestNode(previousSibling, skipRoot);
      }
      // If no previous sibling, return the parent (which should be safe)
      return deepestNode.parentNode === node ? null : deepestNode.parentNode;
    }

    const lastChild = deepestNode.lastChild;
    if (lastChild) {
      deepestNode = lastChild;
    } else {
      break;
    }
  }
  return deepestNode;
};

const getPreviousNode = (node, rootNode, skipRoot = null) => {
  const previousSibling = node.previousSibling;
  if (previousSibling) {
    // If previous sibling is skipRoot, skip it entirely
    if (skipRoot && previousSibling === skipRoot) {
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }

    const deepestChild = getDeepestNode(previousSibling, skipRoot);

    // Check if deepest child is inside skipRoot (shouldn't happen with updated getDeepestNode, but safe check)
    if (
      skipRoot &&
      deepestChild &&
      (deepestChild === skipRoot || skipRoot.contains(deepestChild))
    ) {
      // Skip this sibling entirely and try the next one
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }

    if (deepestChild) {
      return deepestChild;
    }
    return previousSibling;
  }
  if (node !== rootNode) {
    const parentNode = node.parentNode;
    if (parentNode && parentNode !== rootNode) {
      return parentNode;
    }
  }
  return null;
};

const createPreviousNodeIterator = (fromNode, rootNode, skipRoot = null) => {
  let current = fromNode;

  // If we're inside skipRoot, we need to start searching before skipRoot entirely
  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
  }

  const next = () => {
    const previousNode = getPreviousNode(current, rootNode, skipRoot);
    current = previousNode;
    return {
      done: Boolean(previousNode) === false,
      value: previousNode,
    };
  };
  return {
    next,
  };
};

/**
 * The click a gesture leaves behind.
 *
 * A press that turned into something else — an object carried, a screen swiped,
 * a menu opened by holding still — still ends with a `pointerup`, and the
 * browser follows that with a `click` on whatever the pointer was over. On a
 * link or a button that click means "follow me", which is not what the hand
 * asked for: the press was already answered, by the gesture.
 *
 * So it is swallowed, once, in capture on the document — before any handler an
 * element may have, and without anyone having to know which element that is.
 */

/**
 * Swallows the next click, for a gesture that has just answered the press.
 *
 * @returns {() => void} the gesture is over. The suppressor cannot be taken
 *   down with it — the click is dispatched AFTER the pointerup that ends the
 *   gesture, so it would be gone one event too early, and the drag would end on
 *   the link it started from being followed. It goes once it has swallowed a
 *   click, or at the next press if the gesture produced none: a click is always
 *   preceded by a press, so a suppressor that outlives one press can never
 *   reach the click of another.
 */
const suppressClickAfterGesture = () => {
  const suppressClick = (clickEvent) => {
    clickEvent.stopPropagation();
    clickEvent.preventDefault();
    stopSuppressing();
  };
  const stopSuppressing = () => {
    document.removeEventListener("click", suppressClick, { capture: true });
    document.removeEventListener("pointerdown", stopSuppressing, {
      capture: true,
    });
  };
  document.addEventListener("click", suppressClick, { capture: true });
  return () => {
    document.addEventListener("pointerdown", stopSuppressing, {
      capture: true,
    });
  };
};

/**
 * A press that says something by NOT moving.
 *
 * A finger landing on an element is ambiguous — it may be a tap, a scroll, a
 * swipe — and the one unambiguous signal a finger can give is staying still:
 * travel is exactly what a scroll looks like, so it cannot be the sign. This
 * owns that wait, and only that: what the press then means (an object picked
 * up, a menu opened) belongs to whoever asked for it.
 *
 * The wait also has to hold off the system's own answer to the same gesture: a
 * FINGER held long enough IS the context-menu gesture, and Android's menu (around
 * 500ms) or iOS's callout lands a tenth of a second after the press was answered
 * here. The half of that which is an event is refused below; the half that is not
 * (iOS selecting the word under the finger) is a stylesheet the caller writes on
 * its own elements — `-webkit-touch-callout: none` has to be true before the
 * finger lands, so it cannot be set from here.
 *
 * A mouse is a different matter and is left alone: its context menu comes from
 * the other button, not from this press, and refusing it would take the browser's
 * menu away from an element for no reason.
 */

/**
 * Waits for a press to be held still, then tells the caller.
 *
 * @param {PointerEvent} pressEvent The `pointerdown` that may become a hold.
 * @param {object} options
 * @param {number} [options.delay=400] How long (ms) the pointer must stay down.
 *   Kept under the system context-menu delay so the press is answered before
 *   the menu would have opened.
 * @param {number} [options.slop=8] How far (px) the pointer may drift during
 *   the wait — beyond it the finger is going somewhere, and a press answered in
 *   passing is a press nobody made.
 * @param {function} [options.onPressStart] The wait began (a cue that the press
 *   counts).
 * @param {function} [options.onPressCancel] The pointer moved or lifted before
 *   the wait was over.
 * @param {(pressEvent: PointerEvent, handle: {endPress: () => void}) => void} options.onPressHeld
 *   The wait completed. Whatever the press now means outlives this call — an
 *   object is being carried, a menu is open under the finger — so the caller
 *   owns the end of it and says when with `endPress`, which is what gives the
 *   context menu back.
 * @returns {{ cancel: () => void }}
 */
const waitForPressHeld = (
  pressEvent,
  { delay = 400, slop = 8, onPressStart, onPressCancel, onPressHeld },
) => {
  const { pointerId, clientX, clientY } = pressEvent;

  const pressCleanupCallbacks = [];
  const endPress = () => {
    for (const pressCleanupCallback of pressCleanupCallbacks) {
      pressCleanupCallback();
    }
    pressCleanupCallbacks.length = 0;
  };

  /* A FINGER held down is the system's own context-menu gesture, and the menu it
     raises lands on top of the answer this press was already given. A MOUSE is
     not: its context menu comes from the other button, has nothing to do with
     this press, and is the user asking for the browser's menu — so it is left
     alone, and only a touch press refuses it.
     The listener goes on window, in capture: what answers the press may cover the
     page (a drag backdrop, a popup), and the contextmenu event is then aimed at
     that instead of at the element pressed. */
  if (pressEvent.pointerType === "touch") {
    const preventContextMenu = (contextMenuEvent) => {
      contextMenuEvent.preventDefault();
    };
    window.addEventListener("contextmenu", preventContextMenu, true);
    pressCleanupCallbacks.push(() => {
      window.removeEventListener("contextmenu", preventContextMenu, true);
    });
  }

  const countdownCleanupCallbacks = [];
  const endCountdown = () => {
    for (const countdownCleanupCallback of countdownCleanupCallbacks) {
      countdownCleanupCallback();
    }
    countdownCleanupCallbacks.length = 0;
  };

  const timeout = setTimeout(() => {
    endCountdown();
    onPressHeld(pressEvent, { endPress });
  }, delay);
  countdownCleanupCallbacks.push(() => {
    clearTimeout(timeout);
  });

  const cancelPress = (pointerEvent) => {
    endCountdown();
    endPress();
    onPressCancel?.(pointerEvent);
  };
  const onPointerMove = (pointerMoveEvent) => {
    if (pointerMoveEvent.pointerId !== pointerId) {
      return;
    }
    const xDrift = Math.abs(pointerMoveEvent.clientX - clientX);
    const yDrift = Math.abs(pointerMoveEvent.clientY - clientY);
    if (xDrift < slop && yDrift < slop) {
      return;
    }
    // The finger is going somewhere: it is scrolling the page, or running down
    // the list. Letting the countdown survive would answer a press in passing.
    cancelPress(pointerMoveEvent);
  };
  const onPointerEnd = (pointerEndEvent) => {
    if (pointerEndEvent.pointerId !== pointerId) {
      return;
    }
    cancelPress(pointerEndEvent);
  };
  // On window rather than on the element: the finger can leave it, and the
  // element itself can be taken out of the document while the press is waiting.
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  countdownCleanupCallbacks.push(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
  });

  onPressStart?.(pressEvent);

  return {
    cancel: () => {
      endCountdown();
      endPress();
    },
  };
};

const activeElementSignal = signal(
  typeof document === "object" ? document.activeElement : undefined,
);
if (typeof document === "object") {
  document.addEventListener(
    "focus",
    () => {
      activeElementSignal.value = document.activeElement;
    },
    { capture: true },
  );
  // When clicking on document there is no "focus" event dispatched on the document
  // We can detect that with "blur" event when relatedTarget is null
  document.addEventListener(
    "blur",
    (e) => {
      if (!e.relatedTarget) {
        activeElementSignal.value = document.activeElement;
      }
    },
    { capture: true },
  );
}

const useActiveElement = () => {
  return activeElementSignal.value;
};
const addActiveElementEffect = (callback) => {
  const remove = effect(() => {
    const activeElement = activeElementSignal.value;
    callback(activeElement);
  });
  return remove;
};

/**
 * Returns whether a node is visible from a focus/keyboard-navigation perspective.
 * This intentionally ignores purely visual properties (opacity, clip, off-screen)
 * and only checks structural visibility: hidden attribute, display:none, visibility:hidden,
 * closed <details>/<dialog>/popover ancestors, and optionally aria-hidden ancestry.
 *
 * @param {Node} node
 * @param {{ excludeAriaHidden?: boolean }} [options]
 * @returns {boolean}
 */
const elementIsVisibleForFocus = (node, { excludeAriaHidden } = {}) => {
  return getFocusVisibilityInfo(node, { excludeAriaHidden }).visible;
};
const getFocusVisibilityInfo = (node, { excludeAriaHidden } = {}) => {
  if (isDocumentElement(node)) {
    return { visible: true, reason: "is document" };
  }
  if (node.hasAttribute("hidden")) {
    return { visible: false, reason: "has hidden attribute" };
  }
  if (getStyle(node, "visibility") === "hidden") {
    return { visible: false, reason: "uses visiblity: hidden" };
  }
  if (node.tagName === "INPUT" && node.type === "hidden") {
    return { visible: false, reason: "input type hidden" };
  }
  let nodeOrAncestor = node;
  while (nodeOrAncestor) {
    if (isDocumentElement(nodeOrAncestor)) {
      break;
    }
    if (
      excludeAriaHidden &&
      nodeOrAncestor.getAttribute("aria-hidden") === "true"
    ) {
      return { visible: false, reason: "inside aria-hidden element" };
    }
    if (getStyle(nodeOrAncestor, "display") === "none") {
      return { visible: false, reason: "ancestor uses display: none" };
    }
    // Check if element is inside a closed details element
    if (elementIsDetails(nodeOrAncestor) && !nodeOrAncestor.open) {
      // Special case: summary elements are visible even when their parent details is closed
      // But only if this details element is the direct parent of the summary
      if (!elementIsSummary(node) || node.parentElement !== nodeOrAncestor) {
        return { visible: false, reason: "inside closed details element" };
      }
      // Continue checking ancestors
    }
    if (elementIsDialog(nodeOrAncestor) && !nodeOrAncestor.open) {
      return { visible: false, reason: "inside closed dialog element" };
    }
    if (
      nodeOrAncestor.popover !== null &&
      nodeOrAncestor.popover !== undefined &&
      !nodeOrAncestor.matches(":popover-open")
    ) {
      return { visible: false, reason: "inside closed popover element" };
    }
    // Open popovers and open dialogs render in the top layer: they escape
    // the normal layout/stacking context of their DOM ancestors.
    // No need to check further up the tree.
    if (elementIsDialog(nodeOrAncestor) && nodeOrAncestor.open) {
      break;
    }
    if (
      nodeOrAncestor.popover !== null &&
      nodeOrAncestor.popover !== undefined &&
      nodeOrAncestor.matches(":popover-open")
    ) {
      break;
    }
    nodeOrAncestor = nodeOrAncestor.parentNode;
  }
  return { visible: true, reason: "no reason to be hidden" };
};

const elementIsVisuallyVisible = (node, options = {}) => {
  return getVisuallyVisibleInfo(node, options).visible;
};
const getVisuallyVisibleInfo = (
  node,
  { countOffscreenAsVisible = false } = {},
) => {
  // First check all the focusable visibility conditions
  const focusVisibilityInfo = getFocusVisibilityInfo(node);
  if (!focusVisibilityInfo.visible) {
    return focusVisibilityInfo;
  }

  // Additional visual visibility checks
  if (getStyle(node, "opacity") === "0") {
    return { visible: false, reason: "uses opacity: 0" };
  }

  const rect = node.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return { visible: false, reason: "has zero dimensions" };
  }

  // Check for clipping
  const clipStyle = getStyle(node, "clip");
  if (clipStyle && clipStyle !== "auto" && clipStyle.includes("rect(0")) {
    return { visible: false, reason: "clipped with clip property" };
  }

  if (node.hasAttribute("navi-visually-hidden")) {
    return { visible: false, reason: "has navi-visually-hidden attribute" };
  }

  const clipPathStyle = getStyle(node, "clip-path");
  if (clipPathStyle) {
    // inset(N%) where N >= 50 collapses the visible area to nothing
    const insetMatch = clipPathStyle.match(/^inset\((\d+)%/);
    if (insetMatch && Number(insetMatch[1]) >= 50) {
      return { visible: false, reason: "clipped with clip-path" };
    }
  }

  // Check if positioned off-screen (unless option says to count as visible)
  if (!countOffscreenAsVisible) {
    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      return { visible: false, reason: "positioned off-screen" };
    }
  }

  // Check for transform scale(0)
  const transformStyle = getStyle(node, "transform");
  if (transformStyle.scale === 0) {
    return { visible: false, reason: "scaled to zero with transform" };
  }

  return { visible: true, reason: "visually visible" };
};
const getFirstVisuallyVisibleAncestor = (node, options = {}) => {
  let ancestorCandidate = node.parentNode;
  while (ancestorCandidate) {
    const visibilityInfo = getVisuallyVisibleInfo(ancestorCandidate, options);
    if (visibilityInfo.visible) {
      return ancestorCandidate;
    }
    ancestorCandidate = ancestorCandidate.parentElement;
  }
  // This shouldn't happen in normal cases since document element is always visible
  return null;
};

/**
 * Returns whether a node can receive focus, combining structural visibility
 * (via {@link elementIsVisibleForFocus}) with interaction capability checks
 * (disabled, inert) and element-type-specific focusability rules.
 *
 * @param {Node} node
 * @param {{ excludeAriaHidden?: boolean }} [options]
 *   - `excludeAriaHidden`: when true, elements inside an `aria-hidden="true"`
 *     subtree are considered non-focusable (matching screen reader behaviour).
 * @returns {boolean}
 */
const elementIsFocusable = (node, { excludeAriaHidden } = {}) => {
  // only element node can be focused, document, textNodes etc cannot
  if (node.nodeType !== 1) {
    return false;
  }
  if (node.hasAttribute("navi-focus-delegate")) {
    return false;
  }
  if (!canInteract(node)) {
    return false;
  }
  const canFocus = (node) =>
    elementIsVisibleForFocus(node, { excludeAriaHidden });

  const nodeName = node.nodeName.toLowerCase();
  if (nodeName === "input") {
    if (node.type === "hidden") {
      return false;
    }
    return canFocus(node);
  }
  if (FOCUSABLE_NODE_NAME_SET.has(nodeName)) {
    return canFocus(node);
  }
  if (["a", "area"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("href") === false) {
      return false;
    }
    return canFocus(node);
  }
  if (["audio", "video"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("controls") === false) {
      return false;
    }
    return canFocus(node);
  }
  if (nodeName === "summary") {
    return canFocus(node);
  }
  if (node.hasAttribute("tabindex") || node.hasAttribute("tabIndex")) {
    return canFocus(node);
  }
  if (node.hasAttribute("draggable")) {
    return canFocus(node);
  }
  return false;
};
const FOCUSABLE_NODE_NAME_SET = new Set([
  "button",
  "select",
  "datalist",
  "dialog",
  "iframe",
  "textarea",
]);

const canInteract = (element) => {
  if (element.disabled) {
    return false;
  }
  // closest, not hasAttribute: inert is inherited by the whole subtree — the
  // element itself may carry nothing and still be untouchable because something
  // above it is inert (a slide waiting off screen, the page behind a modal).
  // Focusing one of those does nothing at all, silently: the browser refuses and
  // the focus stays where it was, which reads as "the popup opened on nothing".
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert
  if (element.closest("[inert]")) {
    return false;
  }
  return true;
};

/**
 * Given an element with the `navi-focus-delegate` attribute, returns the first
 * focusable ancestor that should receive focus instead.
 *
 * Elements marked with `navi-focus-delegate` opt out of being focusable
 * themselves (see {@link elementIsFocusable}) and redirect focus upward to
 * their nearest focusable ancestor.
 *
 * Returns `null` when the attribute is absent or no focusable ancestor exists.
 *
 * @param {Element} el
 * @returns {Element|null}
 */
const findFocusDelegateTarget = (el) => {
  const naviFocusDelegate = el.getAttribute("navi-focus-delegate");
  if (naviFocusDelegate === null || naviFocusDelegate === undefined) {
    return null;
  }
  if (naviFocusDelegate) {
    const delegateTarget = document.getElementById(naviFocusDelegate);
    if (delegateTarget && elementIsFocusable(delegateTarget)) {
      return delegateTarget;
    }
  }
  let ancestor = el.parentElement;
  while (ancestor) {
    if (elementIsFocusable(ancestor)) {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
};

const findFocusable = (element, { exclude } = {}) => {
  const associatedElements = getAssociatedElements(element);
  if (associatedElements) {
    for (const associatedElement of associatedElements) {
      const focusable = findFocusable(associatedElement, { exclude });
      if (focusable) {
        return focusable;
      }
    }
    return null;
  }
  const isFocusable = (node) => {
    if (!elementIsFocusable(node)) {
      return false;
    }
    if (exclude && exclude(node)) {
      return false;
    }
    return true;
  };
  if (isFocusable(element)) {
    return element;
  }
  const focusableDescendant = findDescendant(element, isFocusable);
  if (focusableDescendant) {
    // If the first focusable is an unchecked radio/checkbox, prefer the checked
    // sibling in the same group (mirrors native browser radio focus behavior
    // and gives focus to the selected item in a selectable list).
    const { tagName, type, name } = focusableDescendant;
    if (
      tagName === "INPUT" &&
      (type === "radio" || type === "checkbox") &&
      !focusableDescendant.checked &&
      name
    ) {
      const groupContainer = focusableDescendant.form || document;
      const checkedInput = groupContainer.querySelector(
        `input[type="${type}"][name="${CSS.escape(name)}"]:checked`,
      );
      if (checkedInput) {
        return checkedInput;
      }
    }
  }
  return focusableDescendant;
};

// note: keep in mind that an element with overflow: 'hidden' is scrollable
// it can be scrolled using keyboard arrows or JavaScript properties such as scrollTop, scrollLeft
// the only overflow that prevents scroll is "visible"
const isScrollable = (element, { includeHidden } = {}) => {
  if (canHaveVerticalScroll(element, { includeHidden })) {
    return true;
  }
  if (canHaveHorizontalScroll(element, { includeHidden })) {
    return true;
  }
  return false;
};

// Whether this element is what scrolls on that axis: it says it may (overflow)
// and it has somewhere to go (it overflows). Both are needed — an "auto" box
// whose content fits scrolls nothing, and `overflow-x: auto` alone makes the
// COMPUTED overflow-y auto too (CSS does not let one axis stay visible next to
// a scrolling one), so a box scrolling sideways declares a vertical scroll it
// will never do.
const canScroll = (element, axis) => {
  if (!element || element.nodeType !== 1) {
    return false;
  }
  const style = getComputedStyle(element);
  const overflow = axis === "x" ? style.overflowX : style.overflowY;
  if (overflow !== "auto" && overflow !== "scroll") {
    return false;
  }
  const scrollSize = axis === "x" ? element.scrollWidth : element.scrollHeight;
  const clientSize = axis === "x" ? element.clientWidth : element.clientHeight;
  // A pixel of slack: subpixel content rounds scrollSize up on boxes that have
  // nowhere to scroll to.
  return scrollSize - clientSize > 1;
};

const canHaveVerticalScroll = (element, { includeHidden }) => {
  const verticalOverflow = getStyle(element, "overflow-y");
  if (verticalOverflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (verticalOverflow === "hidden" || verticalOverflow === "clip") {
    return includeHidden;
  }
  const overflow = getStyle(element, "overflow");
  if (overflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true; // "auto", "scroll"
};
const canHaveHorizontalScroll = (element, { includeHidden }) => {
  const horizontalOverflow = getStyle(element, "overflow-x");
  if (horizontalOverflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (horizontalOverflow === "hidden" || horizontalOverflow === "clip") {
    return includeHidden;
  }
  const overflow = getStyle(element, "overflow");
  if (overflow === "visible") {
    if (isDocumentElement(element)) {
      // browser returns "visible" on documentElement even if it is scrollable
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true; // "auto", "scroll"
};

const getScrollingElement = (document) => {
  const { scrollingElement } = document;
  if (scrollingElement) {
    return scrollingElement;
  }

  if (isCompliant(document)) {
    return document.documentElement;
  }

  const body = document.body;
  const isFrameset = body && !/body/i.test(body.tagName);
  const possiblyScrollingElement = isFrameset ? getNextBodyElement(body) : body;

  // If `body` is itself scrollable, it is not the `scrollingElement`.
  return possiblyScrollingElement && bodyIsScrollable(possiblyScrollingElement)
    ? null
    : possiblyScrollingElement;
};

const isHidden = (element) => {
  const display = getStyle(element, "display");
  if (display === "none") {
    return false;
  }

  if (
    display === "table-row" ||
    display === "table-group" ||
    display === "table-column"
  ) {
    return getStyle(element, "visibility") !== "collapsed";
  }

  return true;
};
const isCompliant = (document) => {
  // Note: document.compatMode can be toggle at runtime by document.write
  const isStandardsMode = /^CSS1/.test(document.compatMode);
  if (isStandardsMode) {
    return testScrollCompliance(document);
  }
  return false;
};
const testScrollCompliance = (document) => {
  const iframe = document.createElement("iframe");
  iframe.style.height = "1px";
  const parentNode = document.body || document.documentElement || document;
  parentNode.appendChild(iframe);
  const iframeDocument = iframe.contentWindow.document;
  iframeDocument.write('<!DOCTYPE html><div style="height:9999em">x</div>');
  iframeDocument.close();
  const scrollComplianceResult =
    iframeDocument.documentElement.scrollHeight >
    iframeDocument.body.scrollHeight;
  iframe.parentNode.removeChild(iframe);
  return scrollComplianceResult;
};
const getNextBodyElement = (frameset) => {
  // We use this function to be correct per spec in case `document.body` is
  // a `frameset` but there exists a later `body`. Since `document.body` is
  // a `frameset`, we know the root is an `html`, and there was no `body`
  // before the `frameset`, so we just need to look at siblings after the
  // `frameset`.
  let current = frameset;
  while ((current = current.nextSibling)) {
    if (current.nodeType === 1 && isBodyElement(current)) {
      return current;
    }
  }
  return null;
};
const isBodyElement = (element) => element.ownerDocument.body === element;
const bodyIsScrollable = (body) => {
  // a body element is scrollable if body and html are scrollable and rendered
  if (!isScrollable(body)) {
    return false;
  }
  if (isHidden(body)) {
    return false;
  }

  const documentElement = body.ownerDocument.documentElement;
  if (!isScrollable(documentElement)) {
    return false;
  }
  if (isHidden(documentElement)) {
    return false;
  }

  return true;
};

/**
 * Returns the browser's default action for a keyboard event on its target element.
 *
 * Possible return values:
 * - `"activate"`     — Space/Enter triggers the element's primary action (button click, checkbox toggle, picker open…)
 * - `"form_submit"`  — Enter submits the enclosing form (single-line inputs)
 * - `"dismiss"`      — Escape closes a dialog, clears a search field, collapses a dropdown
 * - `"focus_nav"`    — key moves focus (Tab, arrow keys in a radio/checkbox group)
 * - `"value_change"` — key increments/decrements the field value (range, number, date…)
 * - `"cursor_move"`  — key moves the text cursor within the field
 * - `"type"`         — key produces or deletes text content
 * - `"scroll"`       — key would scroll the page: nothing on the element itself
 *                      claims it, so it is safe to intercept
 * - `"scroll_self"`   — the focused element scrolls ITSELF that way (it really
 *                      overflows on that axis): the key is spoken for, and
 *                      taking it would leave a scrollable region no way to be
 *                      scrolled from the keyboard
 * - `""`             — no meaningful browser default; safe to intercept freely
 */
const normalizeKeyboardKey = (rawKey) => {
  // The browser sends " " for the Space bar; map it to the friendly name "space"
  if (rawKey === " ") {
    return "space";
  }
  return rawKey.toLowerCase();
};

const getKeyboardEventDefaultAction = (keyboardEvent) => {
  const target = keyboardEvent.target;
  if (keyboardEvent.key === undefined) {
    // Happens for enter after autocomplete
    return "activate";
  }
  const key = normalizeKeyboardKey(keyboardEvent.key);

  // Nothing special occurs when the target or an ancestor is disabled/inert
  if (
    target.disabled ||
    target.closest("[disabled]") ||
    target.inert ||
    target.closest("[inert]")
  ) {
    return "";
  }
  for (const { test, keys, fallback } of DEFAULT_BEHAVIORS) {
    if (!test(target)) {
      continue;
    }
    if (Object.hasOwn(keys, key)) {
      const value = keys[key];
      const defaultActionForKey =
        typeof value === "function" ? value(keyboardEvent) : value;
      if (defaultActionForKey !== undefined) {
        return defaultActionForKey;
      }
    }
    if (fallback === undefined) {
      // This entry only handles specific keys — keep looking for other entries
      continue;
    }
    const defaultAction =
      typeof fallback === "function" ? fallback(keyboardEvent) : fallback;
    if (defaultAction !== undefined) {
      return defaultAction;
    }
  }
  return "";
};

const isTypingIntent = (e) => {
  // Modifier keys used for shortcuts: skip
  if (e.metaKey || e.ctrlKey) {
    return false;
  }
  if (!e.key) {
    // can happen when pressing enter for autocomplete for instance
    return false;
  }
  const key = normalizeKeyboardKey(e.key);
  // Single printable character — the user is typing
  if (e.key.length === 1) {
    return true;
  }
  // Editing keys that would modify the text
  if (key === "backspace" || key === "delete") {
    return true;
  }
  return false;
};

const DEFAULT_BEHAVIORS = [
  {
    test: () => true,
    keys: {
      // Tab moves focus on any element
      tab: "focus_nav",
    },
    // no fallback: only claims Tab, other keys continue to next entries
  },
  {
    test: (el) => el.matches("input[type='radio'], input[type='checkbox']"),
    keys: {
      space: (e) => {
        if (e.target.type === "radio" && e.target.checked) {
          // space on checked radio does nothing
          return "";
        }
        return "activate";
      },
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: "focus_nav",
      arrowright: "focus_nav",
      arrowup: "focus_nav",
      arrowdown: "focus_nav",
    },
  },
  {
    test: (el) =>
      el.matches(
        "input:not([type]), input[type='text'], input[type='search'], input[type='url'], input[type='email'], input[type='password'], input[type='tel']",
      ),
    keys: {
      escape: (e) => {
        if (e.target.type === "search") {
          if (e.target.readOnly) {
            return "";
          }
          return e.target.value ? "clear" : "";
        }
        return "";
      },
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: (e) => (e.target.readOnly ? "scroll" : "cursor_move"),
      arrowright: (e) => (e.target.readOnly ? "scroll" : "cursor_move"),
      arrowup: (e) => (e.target.readOnly ? "scroll" : "cursor_move"),
      arrowdown: (e) => (e.target.readOnly ? "scroll" : "cursor_move"),
      home: (e) => (e.target.readOnly ? "scroll" : "cursor_move"),
      end: (e) => (e.target.readOnly ? "scroll" : "cursor_move"),
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    test: (el) => el.matches("input[type='range']"),
    keys: {
      space: "scroll",
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: "value_change",
      arrowright: "value_change",
      arrowup: "value_change",
      arrowdown: "value_change",
      home: "value_change",
      end: "value_change",
      pageup: "value_change",
      pagedown: "value_change",
    },
  },
  {
    test: (el) => el.matches("input[type='number']"),
    keys: {
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: "cursor_move",
      arrowright: "cursor_move",
      arrowup: "value_change",
      arrowdown: "value_change",
      home: "cursor_move",
      end: "cursor_move",
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    test: (el) =>
      el.matches(
        "input[type='date'], input[type='time'], input[type='datetime-local'], input[type='month'], input[type='week']",
      ),
    keys: {
      space: "activate",
      enter: "activate",
      arrowleft: "value_change",
      arrowright: "value_change",
      arrowup: "value_change",
      arrowdown: "value_change",
    },
  },
  {
    // Color input: Space opens the color picker, Enter  too
    test: (el) => el.matches("input[type='color']"),
    keys: {
      space: "activate",
      enter: "activate",
    },
  },
  {
    // File input: Space opens the picker, Enter too
    test: (el) => el.matches("input[type='file']"),
    keys: {
      space: "activate",
      enter: "activate",
    },
  },
  {
    // Generic INPUT fallback for any remaining input types
    test: (el) => el.tagName === "INPUT",
    keys: {},
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    test: (el) =>
      el.tagName === "TEXTAREA" ||
      el.contentEditable === "true" ||
      el.isContentEditable,
    keys: {
      enter: "type",
      arrowleft: "cursor_move",
      arrowright: "cursor_move",
      arrowup: "cursor_move",
      arrowdown: "cursor_move",
      home: "cursor_move",
      end: "cursor_move",
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    // Buttons and links: Space/Enter trigger the element's default action
    test: (el) =>
      el.tagName === "BUTTON" ||
      el.tagName === "A" ||
      el.getAttribute("role") === "button",
    keys: {
      space: "activate",
      enter: "activate",
    },
  },
  {
    // details/summary: Space/Enter toggle the disclosure widget
    test: (el) => el.tagName === "DETAILS" || el.tagName === "SUMMARY",
    keys: {
      space: "activate",
      enter: "activate",
    },
  },
  {
    // SELECT: don't intercept anything while the dropdown may be open
    test: (el) => el.tagName === "SELECT",
    keys: {
      space: "activate",
      enter: "activate",
    },
  },
  {
    // Escape natively dismisses only <dialog> elements. Deliberately late in
    // the list: the focused element gets first claim on Escape, because the
    // browser resolves the close request innermost-first. A non-empty
    // <input type="search"> inside a dialog consumes the first Escape to clear
    // itself and only a second one reaches the dialog — reporting "dismiss"
    // here would let our own Escape-to-close shortcuts fire on the first press.
    test: (el) => el.tagName === "DIALOG" || Boolean(el.closest("dialog")),
    keys: {
      escape: "dismiss",
    },
  },
  {
    // An element that really scrolls — a slide's own body, a scrollable panel:
    // the browser gives it the arrows (and Home/End/PageUp/PageDown) so it can
    // be read from the keyboard, and that is not a key to take. Asked per axis
    // and per element, not from a class or an attribute: what makes it true is
    // that it overflows right now.
    test: (el) => canScroll(el, "y") || canScroll(el, "x"),
    keys: {
      arrowup: (e) => (canScroll(e.target, "y") ? "scroll_self" : undefined),
      arrowdown: (e) => (canScroll(e.target, "y") ? "scroll_self" : undefined),
      arrowleft: (e) => (canScroll(e.target, "x") ? "scroll_self" : undefined),
      arrowright: (e) => (canScroll(e.target, "x") ? "scroll_self" : undefined),
      pageup: (e) => (canScroll(e.target, "y") ? "scroll_self" : undefined),
      pagedown: (e) => (canScroll(e.target, "y") ? "scroll_self" : undefined),
      home: (e) => (canScroll(e.target, "y") ? "scroll_self" : undefined),
      end: (e) => (canScroll(e.target, "y") ? "scroll_self" : undefined),
      space: (e) => (canScroll(e.target, "y") ? "scroll_self" : undefined),
    },
    // no fallback: only these keys are claimed, everything else keeps looking
  },
  {
    // Non-interactive elements: browser scrolls on Space and arrow keys
    test: () => true,
    keys: {
      space: "scroll",
      arrowup: "scroll",
      arrowdown: "scroll",
      arrowleft: "scroll",
      arrowright: "scroll",
      pageup: "scroll",
      pagedown: "scroll",
      home: "scroll",
      end: "scroll",
    },
  },
];

// WeakMap to store focus group metadata
const focusGroupRegistry = new WeakMap();

const setFocusGroup = (element, options) => {
  focusGroupRegistry.set(element, options);
  return () => {
    focusGroupRegistry.delete(element);
  };
};
const getFocusGroup = (element) => {
  return focusGroupRegistry.get(element);
};

const createEventMarker = (symbolName) => {
  const symbol = Symbol.for(symbolName);

  const isMarked = (event) => {
    return Boolean(event[symbol]);
  };

  return {
    mark: (event) => {
      event[symbol] = true;
    },
    isMarked,
  };
};

const focusNavEventMarker = createEventMarker("focus_nav");

const preventFocusNav = (event) => {
  focusNavEventMarker.mark(event);
};

const isFocusNavMarked = (event) => {
  return focusNavEventMarker.isMarked(event);
};
const markFocusNav = (event) => {
  focusNavEventMarker.mark(event);
};

/**
 * Performs arrow-key navigation within a focus group element.
 *
 * Called on every keydown event inside the group. Decides whether the pressed
 * key should move focus to another element, and if so, which one.
 *
 * @param {KeyboardEvent} event - The keydown event.
 * @param {Element} element - The focus-group root element.
 * @param {object} [options]
 * @param {string} [options.name] - Optional group name used for ancestor delegation.
 * @param {boolean} [options.excludeAriaHidden=true] - Skip elements hidden from the accessibility tree.
 * @param {"x"|"y"|"both"} [options.direction="both"] - Which axes are active.
 *   "x" = left/right only, "y" = up/down only, "both" = all four arrows.
 * @param {"x"|"y"|"both"} [options.wrap] - Which axes loop at boundaries.
 *   Omit or pass undefined for no looping on either axis.
 * @param {string} [options.xSelector] - CSS selector that candidates must match
 *   when navigating on the x axis. Omit to allow any focusable element.
 * @param {string} [options.ySelector] - CSS selector that candidates must match
 *   when navigating on the y axis. Omit to allow any focusable element.
 * @returns {boolean} True if the event was handled (focus moved or default prevented).
 */
const performArrowNavigation = (
  event,
  element,
  {
    name,
    excludeAriaHidden,
    // Which axes are active: "x", "y", or "both" (default)
    direction = "both",
    // Which axes loop at boundaries: "x", "y", "both", or undefined (no looping)
    wrap,
    // CSS selector to restrict candidates on each axis
    xSelector,
    ySelector,
  } = {},
) => {
  const defaultAction = getKeyboardEventDefaultAction(event);
  // A focus group takes over arrow-key navigation entirely, including cases
  // where the browser would otherwise scroll (e.g. arrow keys on a <button>).
  const canIntercept =
    defaultAction === "focus_nav" ||
    defaultAction === "scroll" ||
    !defaultAction;
  if (!canIntercept) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.hasAttribute("data-focusnav") === "none") {
    // no need to prevent default here (arrow don't move focus by default in a focus group)
    // (and it would prevent scroll via keyboard that we might want here)
    return true;
  }

  const onTargetToFocus = (targetToFocus) => {
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };

  // Grid navigation: we support only TABLE element for now
  // A role="table" or an element with display: table could be used too but for now we need only TABLE support
  if (element.tagName === "TABLE") {
    const tablePredicate = (candidate) => {
      if (!candidate.matches) {
        return false;
      }
      if (candidate.getAttribute("navi-focusnav") === "ignore") {
        return false;
      }
      if (!elementIsFocusable(candidate, { excludeAriaHidden })) {
        return false;
      }
      return true;
    };
    const tableLoop = wrap === "both" || wrap === "x" || wrap === "y";
    const targetInGrid = getTargetInTableFocusGroup(event, element, {
      loop: tableLoop,
      predicate: tablePredicate,
    });
    if (!targetInGrid) {
      return false;
    }
    onTargetToFocus(targetInGrid);
    return true;
  }

  // Linear navigation: detect which axis the pressed key belongs to.
  const isVerticalKey = event.key === "ArrowUp" || event.key === "ArrowDown";
  const isHorizontalKey =
    event.key === "ArrowLeft" || event.key === "ArrowRight";
  if (!isVerticalKey && !isHorizontalKey) {
    return false;
  }

  // Check whether this axis is enabled and resolve its loop + cssSelector.
  let axisDirection;
  let axisLoop;
  let axisCssSelector;
  if (isVerticalKey) {
    if (direction !== "both" && direction !== "y") {
      return false;
    }
    axisDirection = "vertical";
    axisLoop = wrap === "both" || wrap === "y";
    axisCssSelector = ySelector;
  } else {
    if (direction !== "both" && direction !== "x") {
      return false;
    }
    axisDirection = "horizontal";
    axisLoop = wrap === "both" || wrap === "x";
    axisCssSelector = xSelector;
  }

  const predicate = (candidate) => {
    if (typeof candidate.matches !== "function") {
      // Guard against nodes without matches() (e.g. text nodes).
      return false;
    }
    if (candidate.getAttribute("navi-focusnav") === "ignore") {
      return false;
    }
    // cssSelector check first: cheaper than elementIsFocusable.
    if (axisCssSelector && !candidate.matches(axisCssSelector)) {
      return false;
    }
    if (!elementIsFocusable(candidate, { excludeAriaHidden })) {
      return false;
    }
    return true;
  };

  const targetInLinearGroup = getTargetInLinearFocusGroup(event, element, {
    direction: axisDirection,
    loop: axisLoop,
    name,
    predicate,
  });
  if (!targetInLinearGroup) {
    // We decided not to loop, but the browser may loop anyway for certain element
    // types (e.g. radio inputs cycle through their name group on arrow keys).
    // Return true when the browser would do something we explicitly chose not to
    // do, so the caller can preventDefault to enforce our decision.
    if (!axisLoop && browserWouldLoopWithoutPreventDefault(activeElement)) {
      event.preventDefault();
      markFocusNav(event);
    }
    return false;
  }
  onTargetToFocus(targetInLinearGroup);
  return true;
};

const getTargetInLinearFocusGroup = (
  event,
  element,
  { direction, loop, name, predicate },
) => {
  const activeElement = document.activeElement;

  // Check for Cmd/Ctrl + arrow keys for jumping to start/end of linear group
  const isJumpToEnd = event.metaKey || event.ctrlKey;

  if (isJumpToEnd) {
    return getJumpToEndTargetLinear(event, element, direction, predicate);
  }

  const isForward = isForwardArrow(event, direction);

  // Arrow Left/Up: move to previous focusable element in group
  backward: {
    if (!isBackwardArrow(event, direction)) {
      break backward;
    }
    const previousElement = findBefore(activeElement, predicate, {
      root: element,
    });
    if (previousElement) {
      return previousElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      name,
      predicate,
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      const lastFocusableElement = findLastDescendant(element, predicate);
      if (lastFocusableElement) {
        return lastFocusableElement;
      }
    }
    return null;
  }

  // Arrow Right/Down: move to next focusable element in group
  forward: {
    if (!isForward) {
      break forward;
    }
    const nextElement = findAfter(activeElement, predicate, {
      root: element,
    });
    if (nextElement) {
      return nextElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      name,
      predicate,
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      // No next element, wrap to first focusable in group
      const firstFocusableElement = findDescendant(element, predicate);
      if (firstFocusableElement) {
        return firstFocusableElement;
      }
    }
    return null;
  }

  return null;
};
// Find parent focus group with the same name and try delegation
const delegateArrowNavigation = (
  event,
  currentElement,
  { name, predicate },
) => {
  let ancestorElement = currentElement.parentElement;
  while (ancestorElement) {
    const ancestorFocusGroup = getFocusGroup(ancestorElement);
    if (!ancestorFocusGroup) {
      ancestorElement = ancestorElement.parentElement;
      continue;
    }

    // Check if groups should delegate to each other
    const shouldDelegate =
      name === undefined && ancestorFocusGroup.name === undefined
        ? true // Both unnamed - delegate based on ancestor relationship
        : ancestorFocusGroup.name === name; // Both have same explicit name

    if (shouldDelegate) {
      // Try navigation in parent focus group
      return getTargetInLinearFocusGroup(event, ancestorElement, {
        direction: ancestorFocusGroup.direction,
        loop: ancestorFocusGroup.loop,
        name: ancestorFocusGroup.name,
        predicate,
      });
    }
  }
  return null;
};

// Handle Cmd/Ctrl + arrow keys for linear focus groups to jump to start/end
const getJumpToEndTargetLinear = (event, element, direction, predicate) => {
  // Check if this arrow key is valid for the given direction
  if (!isForwardArrow(event, direction) && !isBackwardArrow(event, direction)) {
    return null;
  }

  if (isBackwardArrow(event, direction)) {
    // Jump to first focusable element in the group
    return findDescendant(element, predicate);
  }

  if (isForwardArrow(event, direction)) {
    // Jump to last focusable element in the group
    return findLastDescendant(element, predicate);
  }

  return null;
};

const isBackwardArrow = (event, direction = "both") => {
  const backwardKeys = {
    both: ["ArrowLeft", "ArrowUp"],
    vertical: ["ArrowUp"],
    horizontal: ["ArrowLeft"],
  };
  return backwardKeys[direction]?.includes(event.key) ?? false;
};
const isForwardArrow = (event, direction = "both") => {
  const forwardKeys = {
    both: ["ArrowRight", "ArrowDown"],
    vertical: ["ArrowDown"],
    horizontal: ["ArrowRight"],
  };
  return forwardKeys[direction]?.includes(event.key) ?? false;
};

// We decided not to loop, but the browser may loop anyway for certain element
// types (e.g. radio inputs cycle through their name group on arrow keys).
// Return true when the browser would do something we explicitly chose not to
// do, so the caller can preventDefault to enforce our decision.
const browserWouldLoopWithoutPreventDefault = (element) => {
  if (element.tagName === "INPUT" && element.type === "radio") {
    // Radio: browser cycles through same-name group on arrow keys
    return true;
  }
  return false;
};

// Handle arrow navigation inside an HTMLTableElement as a grid.
// Moves focus to adjacent cell in the direction of the arrow key.
const getTargetInTableFocusGroup = (event, table, { loop, predicate }) => {
  const arrowKey = event.key;

  // Only handle arrow keys
  if (
    arrowKey !== "ArrowRight" &&
    arrowKey !== "ArrowLeft" &&
    arrowKey !== "ArrowUp" &&
    arrowKey !== "ArrowDown"
  ) {
    return null;
  }

  const focusedElement = document.activeElement;
  const currentCell = focusedElement?.closest?.("td,th");

  // If we're not currently in a table cell, try to focus the first focusable element in the table
  if (!currentCell || !table.contains(currentCell)) {
    return findDescendant(table, predicate) || null;
  }

  // Get the current position in the table grid
  const currentRow = currentCell.parentElement; // tr element
  const allRows = Array.from(table.rows);
  const currentRowIndex = /** @type {HTMLTableRowElement} */ (currentRow)
    .rowIndex;
  const currentColumnIndex = /** @type {HTMLTableCellElement} */ (currentCell)
    .cellIndex;

  // Check for Cmd/Ctrl + arrow keys for jumping to end of row/column
  const isJumpToEnd = event.metaKey || event.ctrlKey;

  if (isJumpToEnd) {
    return getJumpToEndTarget(
      arrowKey,
      allRows,
      currentRowIndex,
      currentColumnIndex,
      predicate,
    );
  }

  // Create an iterator that will scan through cells in the arrow direction
  // until it finds one with a focusable element inside
  const candidateCells = createTableCellIterator(arrowKey, allRows, {
    startRow: currentRowIndex,
    startColumn: currentColumnIndex,
    originalColumn: currentColumnIndex, // Used to maintain column alignment for vertical moves
    loopMode: normalizeLoop(loop),
  });

  // Find the first cell that is itself focusable
  for (const candidateCell of candidateCells) {
    if (predicate(candidateCell)) {
      return candidateCell;
    }
  }

  return null; // No focusable cell found
};

// Handle Cmd/Ctrl + arrow keys to jump to the end of row/column
const getJumpToEndTarget = (
  arrowKey,
  allRows,
  currentRowIndex,
  currentColumnIndex,
  predicate,
) => {
  if (arrowKey === "ArrowRight") {
    // Jump to last focusable cell in current row
    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;

    // Start from the last cell and work backwards to find focusable
    const cells = Array.from(currentRow.cells);
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i];
      if (predicate(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowLeft") {
    // Jump to first focusable cell in current row
    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;

    const cells = Array.from(currentRow.cells);
    for (const cell of cells) {
      if (predicate(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowDown") {
    // Jump to last focusable cell in current column
    for (let rowIndex = allRows.length - 1; rowIndex >= 0; rowIndex--) {
      const row = allRows[rowIndex];
      const cell = row?.cells?.[currentColumnIndex];
      if (cell && predicate(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowUp") {
    // Jump to first focusable cell in current column
    for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
      const row = allRows[rowIndex];
      const cell = row?.cells?.[currentColumnIndex];
      if (cell && predicate(cell)) {
        return cell;
      }
    }
    return null;
  }

  return null;
};

// Create an iterator that yields table cells in the direction of arrow key movement.
// This scans through cells until it finds one with a focusable element or completes a full loop.
const createTableCellIterator = function* (
  arrowKey,
  allRows,
  { startRow, startColumn, originalColumn, loopMode },
) {
  if (allRows.length === 0) {
    return; // No rows to navigate
  }

  // Keep track of which column we should prefer for vertical movements
  // This helps maintain column alignment when moving up/down through rows of different lengths
  let preferredColumn = originalColumn;

  const normalizedLoopMode = normalizeLoop(loopMode);

  // Helper function to calculate the next position based on current position and arrow key
  const calculateNextPosition = (currentRow, currentColumn) =>
    getNextTablePosition(
      arrowKey,
      allRows,
      currentRow,
      currentColumn,
      preferredColumn,
      normalizedLoopMode,
    );

  // Start by calculating the first position to move to
  let nextPosition = calculateNextPosition(startRow, startColumn);
  if (!nextPosition) {
    return; // Cannot move in this direction (no looping enabled)
  }

  // Keep track of our actual starting position to detect when we've completed a full loop
  const actualStartingPosition = `${startRow}:${startColumn}`;

  while (true) {
    const [nextColumn, nextRow] = nextPosition; // Destructure [column, row]
    const targetRow = allRows[nextRow];
    const targetCell = targetRow?.cells?.[nextColumn];

    // Yield the cell if it exists
    if (targetCell) {
      yield targetCell;
    }

    // Update our preferred column based on movement:
    // - For horizontal moves, update to current column
    // - For vertical moves in flow mode at boundaries, advance to next/previous column
    if (arrowKey === "ArrowRight" || arrowKey === "ArrowLeft") {
      preferredColumn = nextColumn;
    } else if (arrowKey === "ArrowDown") {
      const isAtBottomRow = nextRow === allRows.length - 1;
      if (isAtBottomRow && normalizedLoopMode === "flow") {
        // Moving down from bottom row in flow mode: advance to next column
        const maxColumns = getMaxColumns(allRows);
        preferredColumn = preferredColumn + 1;
        if (preferredColumn >= maxColumns) {
          preferredColumn = 0; // Wrap to first column
        }
      }
    } else if (arrowKey === "ArrowUp") {
      const isAtTopRow = nextRow === 0;
      if (isAtTopRow && normalizedLoopMode === "flow") {
        // Moving up from top row in flow mode: go to previous column
        const maxColumns = getMaxColumns(allRows);
        if (preferredColumn === 0) {
          preferredColumn = maxColumns - 1; // Wrap to last column
        } else {
          preferredColumn = preferredColumn - 1;
        }
      }
    }

    // Calculate where to move next
    nextPosition = calculateNextPosition(nextRow, nextColumn);
    if (!nextPosition) {
      return; // Hit a boundary with no looping
    }

    // Check if we've completed a full loop by returning to our actual starting position
    const currentPositionKey = `${nextRow}:${nextColumn}`;
    if (currentPositionKey === actualStartingPosition) {
      return; // We've gone full circle back to where we started
    }
  }
};

// Normalize loop option to a mode string or false
const normalizeLoop = (loop) => {
  if (loop === true) return "wrap";
  if (loop === "wrap") return "wrap";
  if (loop === "flow") return "flow";
  return false;
};

const getMaxColumns = (rows) =>
  rows.reduce((max, r) => Math.max(max, r?.cells?.length || 0), 0);

// Calculate the next row and column position when moving in a table with arrow keys.
// Returns [column, row] for the next position, or null if movement is not possible.
const getNextTablePosition = (
  arrowKey,
  allRows,
  currentRow,
  currentColumn,
  preferredColumn, // Used for vertical movement to maintain column alignment
  loopMode,
) => {
  if (arrowKey === "ArrowRight") {
    const currentRowLength = allRows[currentRow]?.cells?.length || 0;
    const nextColumn = currentColumn + 1;

    // Can we move right within the same row?
    if (nextColumn < currentRowLength) {
      return [nextColumn, currentRow]; // [column, row]
    }

    // We're at the end of the row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: move to first cell of next row (wrap to top if at bottom)
      let nextRow = currentRow + 1;
      if (nextRow >= allRows.length) {
        nextRow = 0; // Wrap to first row
      }
      return [0, nextRow]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: stay in same row, wrap to first column
      return [0, currentRow]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowLeft") {
    const previousColumn = currentColumn - 1;

    // Can we move left within the same row?
    if (previousColumn >= 0) {
      return [previousColumn, currentRow]; // [column, row]
    }

    // We're at the beginning of the row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: move to last cell of previous row (wrap to bottom if at top)
      let previousRow = currentRow - 1;
      if (previousRow < 0) {
        previousRow = allRows.length - 1; // Wrap to last row
      }
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      const lastColumnInPreviousRow = Math.max(0, previousRowLength - 1);
      return [lastColumnInPreviousRow, previousRow]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: stay in same row, wrap to last column
      const currentRowLength = allRows[currentRow]?.cells?.length || 0;
      const lastColumnInCurrentRow = Math.max(0, currentRowLength - 1);
      return [lastColumnInCurrentRow, currentRow]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowDown") {
    const nextRow = currentRow + 1;

    // Can we move down within the table?
    if (nextRow < allRows.length) {
      const nextRowLength = allRows[nextRow]?.cells?.length || 0;
      // Try to maintain the preferred column, but clamp to row length
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, nextRowLength - 1),
      );
      return [targetColumn, nextRow]; // [column, row]
    }

    // We're at the bottom row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: advance to next column and go to top row
      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let nextColumnInFlow = currentColumn + 1;
      if (nextColumnInFlow >= maxColumns) {
        nextColumnInFlow = 0; // Wrap to first column
      }
      const topRowLength = allRows[0]?.cells?.length || 0;
      const clampedColumn = Math.min(
        nextColumnInFlow,
        Math.max(0, topRowLength - 1),
      );
      return [clampedColumn, 0]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: go to top row, maintaining preferred column
      const topRowLength = allRows[0]?.cells?.length || 0;
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, topRowLength - 1),
      );
      return [targetColumn, 0]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowUp") {
    const previousRow = currentRow - 1;

    // Can we move up within the table?
    if (previousRow >= 0) {
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      // Try to maintain the preferred column, but clamp to row length
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, previousRowLength - 1),
      );
      return [targetColumn, previousRow]; // [column, row]
    }

    // We're at the top row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: go to previous column and move to bottom row
      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let previousColumnInFlow;
      if (currentColumn === 0) {
        previousColumnInFlow = maxColumns - 1; // Wrap to last column
      } else {
        previousColumnInFlow = currentColumn - 1;
      }
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const clampedColumn = Math.min(
        previousColumnInFlow,
        Math.max(0, bottomRowLength - 1),
      );
      return [clampedColumn, bottomRowIndex]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: go to bottom row, maintaining preferred column
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, bottomRowLength - 1),
      );
      return [targetColumn, bottomRowIndex]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  // Unknown arrow key
  return null;
};

const performTabNavigation = (
  event,
  {
    rootElement = document.body,
    outsideOfElement = null,
    debug = () => {},
    excludeAriaHidden,
    // When reaching the edge of rootElement would normally wrap back
    // around inside it, escapeRoot changes that: Tab instead continues
    // past escapeRoot's *entire* subtree (not just rootElement's), landing
    // on the next/previous focusable element in the document beyond it.
    // Used by focus_trap.js when boundaryElement is a real container
    // (not document) — a trapped element nested inside a bigger container
    // (e.g. a local-layer Dialog) shouldn't just wrap on itself; Tab should
    // exit the whole container, skipping over any other focusable
    // siblings inside it (they're not part of what's actually trapped).
    escapeRoot = null,
  } = {},
) => {
  if (!isTabEvent$1(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.getAttribute("data-focusnav") === "none") {
    event.preventDefault(); // ensure tab cannot move focus
    return true;
  }
  const isForward = !event.shiftKey;
  const onTargetToFocus = (targetToFocus) => {
    debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from`,
      getElementSignature(activeElement),
      "to",
      getElementSignature(targetToFocus),
    );
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };
  const isFocusableByTab = (element) => {
    if (hasNegativeTabIndex(element)) {
      return false;
    }
    if (!elementIsFocusable(element, { excludeAriaHidden })) {
      return false;
    }
    // Native radio-group semantics: within a named radio group only ONE radio
    // is a Tab stop — the checked one, or the first focusable one when none is
    // checked. The rest are reachable with arrow keys, not Tab. Without this,
    // tabbing into a group would land on its first radio instead of its checked
    // value (e.g. tabbing between two wheels of a WheelGroup).
    if (
      element.matches?.('input[type="radio"]') &&
      element.name &&
      !radioIsGroupTabStop(element)
    ) {
      return false;
    }
    return true;
  };

  // A focus group "owns" the activeElement when activeElement is inside it.
  // From the inside, Tab should exit the group (skip its remaining children).
  // From the outside, Tab should enter the group normally (first focusable child).
  //
  // Smart mode (navi-focus-group="[role=radio]"):
  //   - activeElement directly matches the selector (IS a radio):
  //     Tab skips ALL elements in the group → exits to next focusable outside.
  //   - activeElement is inside a managed element but doesn't match (e.g. an
  //     input inside a custom radio widget): Tab navigates freely within the
  //     group, only skipping elements that directly match the managed selector.
  //
  // Strict mode (navi-focus-group with no value, or navi-focus-group-strict):
  //   Tab always exits the group regardless of where focus is inside it.
  const activeFocusGroup =
    activeElement.closest?.("[navi-focus-group]") || null;
  const activeFocusGroupManages = activeFocusGroup
    ? activeFocusGroup.getAttribute("navi-focus-group") || null
    : null;
  const activeFocusGroupIsStrict = activeFocusGroup
    ? !activeFocusGroupManages ||
      activeFocusGroup.hasAttribute("navi-focus-group-strict")
    : false;
  const activeElementIsManaged =
    activeFocusGroup && activeFocusGroupManages
      ? activeElement.matches(activeFocusGroupManages)
      : false;
  const isOwnedByActiveFocusGroup = (el) => {
    if (!activeFocusGroup || !activeFocusGroup.contains(el)) {
      return false;
    }
    if (activeFocusGroupIsStrict || activeElementIsManaged) {
      // Strict: skip everything inside the group so Tab exits.
      return true;
    }
    // Smart: only skip elements that are themselves managed items.
    return el.matches(activeFocusGroupManages);
  };

  const predicate = (candidate, skip) => {
    if (!isFocusableByTab(candidate)) {
      return false;
    }
    // Focus group roots are composite widgets.
    if (candidate.hasAttribute("navi-focus-group")) {
      if (isFocusableByTab(candidate)) {
        // Root has tabindex="0": it is the single Tab stop for the group.
        // Skip its children — arrow keys handle internal navigation.
        skip?.();
        return true;
      }
      // Root is not focusable by Tab: descend into children to allow Tab entry.
      return false;
    }
    // If candidate is inside the focus group that currently owns focus, skip
    // it — Tab should exit the group. (Going *into* a different focus group
    // is allowed: only one focus group at a time has the activeElement.)
    if (isOwnedByActiveFocusGroup(candidate)) {
      return false;
    }
    return true;
  };

  const activeElementIsRoot = activeElement === rootElement;
  forward: {
    if (!isForward) {
      break forward;
    }
    if (activeElementIsRoot) {
      const firstFocusableElement = findDescendant(activeElement, predicate, {
        skipRoot: outsideOfElement,
      });
      if (firstFocusableElement) {
        return onTargetToFocus(firstFocusableElement);
      }
      return false;
    }
    const nextFocusableElement = findAfter(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (nextFocusableElement) {
      return onTargetToFocus(nextFocusableElement);
    }
    if (escapeRoot) {
      // Skip escapeRoot's own children entirely — anything else still
      // inside it (a sibling of rootElement) isn't part of what's
      // trapped, so it must never become the next Tab stop either.
      const nextOutsideEscapeRoot = findAfter(escapeRoot, predicate, {
        skipChildren: true,
      });
      if (nextOutsideEscapeRoot) {
        return onTargetToFocus(nextOutsideEscapeRoot);
      }
      return false;
    }
    // Wrap around: go back to the first focusable element in root.
    const firstFocusableElement = findDescendant(rootElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (firstFocusableElement) {
      return onTargetToFocus(firstFocusableElement);
    }
    return false;
  }

  {
    if (activeElementIsRoot) {
      const lastFocusableElement = findLastDescendant(
        activeElement,
        predicate,
        {
          skipRoot: outsideOfElement,
        },
      );
      if (lastFocusableElement) {
        return onTargetToFocus(lastFocusableElement);
      }
      return false;
    }

    const previousFocusableElement = findBefore(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (previousFocusableElement) {
      return onTargetToFocus(previousFocusableElement);
    }
    if (escapeRoot) {
      // findBefore already searches strictly *before* escapeRoot's own
      // position (previous sibling / ancestor's previous sibling), never
      // descending into its children — exactly "outside its subtree".
      const previousOutsideEscapeRoot = findBefore(escapeRoot, predicate);
      if (previousOutsideEscapeRoot) {
        return onTargetToFocus(previousOutsideEscapeRoot);
      }
      return false;
    }
    // Wrap around: go back to the last focusable element in root.
    const lastFocusableElement = findLastDescendant(rootElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (lastFocusableElement) {
      return onTargetToFocus(lastFocusableElement);
    }
    return false;
  }
};

// Whether a radio is the single Tab stop of its native radio group (checked, or
// the first enabled radio when none is checked). Mirrors how the browser puts
// only one radio of a group in the Tab order.
const radioIsGroupTabStop = (radio) => {
  const scope = radio.form || radio.getRootNode();
  if (!scope || !scope.querySelectorAll) {
    return true;
  }
  const sameName = scope.querySelectorAll(
    `input[type="radio"][name="${CSS.escape(radio.name)}"]`,
  );
  const radioForm = radio.form || null;
  let checked = null;
  let firstEnabled = null;
  let groupSize = 0;
  for (const candidate of sameName) {
    // Radios only form one group when they share the same form owner.
    if ((candidate.form || null) !== radioForm) {
      continue;
    }
    groupSize++;
    if (candidate.disabled) {
      continue;
    }
    if (!firstEnabled) {
      firstEnabled = candidate;
    }
    if (candidate.checked && !checked) {
      checked = candidate;
    }
  }
  if (groupSize <= 1) {
    return true;
  }
  return radio === (checked || firstEnabled);
};

const isTabEvent$1 = (event) => event.key === "Tab" || event.keyCode === 9;

const hasNegativeTabIndex = (element) => {
  return (
    element.hasAttribute &&
    element.hasAttribute("tabIndex") &&
    Number(element.getAttribute("tabindex")) < 0
  );
};

/**
 * 
- https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/openui/open-ui/issues/990

 - https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md#69-grid-focusgroups
 */


/**
 * Initialises keyboard navigation for a focus group.
 *
 * Sets up two keyboard behaviours on the element:
 * - **Tab**: exits the group, moving focus to the next/previous focusable
 *   element outside the group (standard skip-group behaviour).
 * - **Arrow keys**: moves focus between focusable descendants according to
 *   the configured direction, wrapping and selector constraints.
 *
 * @param {Element} element - The focus-group root element.
 * @param {object} [options]
 * @param {boolean} [options.skipTab=true] - When true, Tab exits the group
 *   instead of moving through its children one by one.
 * @param {string} [options.name] - Optional name shared between related groups
 *   to enable delegation (focus jumps from one named group to another).
 * @param {boolean} [options.excludeAriaHidden=true] - Skip elements that are
 *   hidden from the accessibility tree (aria-hidden).
 * @param {"x"|"y"|"both"} [options.direction="both"] - Which axes are active.
 *   "x" = left/right only, "y" = up/down only, "both" = all four arrows.
 * @param {"x"|"y"|"both"} [options.wrap] - Which axes loop at boundaries.
 *   Omit or pass undefined for no looping on either axis.
 * @param {string} [options.xSelector] - CSS selector that candidates must match
 *   when navigating on the x axis. Omit to allow any focusable element.
 * @param {string} [options.ySelector] - CSS selector that candidates must match
 *   when navigating on the y axis. Omit to allow any focusable element.
 * @param {string} [options.manages] - CSS selector declaring which descendants
 *   this group "manages" for Tab navigation. When set, Tab only skips managed
 *   elements; other focusable descendants (e.g. inputs inside a radio widget)
 *   remain individually tabbable. When omitted, Tab skips the entire group.
 * @param {boolean} [options.strictTab=false] - When true AND manages is set,
 *   Tab always exits the group regardless of where focus is inside it.
 * @returns {{ cleanup: () => void }} Call cleanup() to remove all event listeners.
 */
const initFocusGroup = (
  element,
  {
    // extend = true,
    skipTab = true,
    name, // Can be undefined for implicit ancestor-descendant grouping
    excludeAriaHidden = true,
    // Which axes are active: "x", "y", or "both" (default)
    direction = "both",
    // Which axes loop at boundaries: "x", "y", "both", or undefined (no looping)
    wrap,
    // CSS selector to restrict candidates on each axis
    xSelector,
    ySelector,
    // CSS selector declaring which elements the group "manages" for Tab purposes.
    // Defaults to ySelector ?? xSelector so arrow-nav and tab-nav stay in sync.
    manages = ySelector ?? xSelector,
    strictTab = false,
  } = {},
) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const callback of cleanupCallbackSet) {
      callback();
    }
    cleanupCallbackSet.clear();
  };

  // Store focus group data in registry
  const removeFocusGroup = setFocusGroup(element, {
    direction,
    name, // Store undefined as-is for implicit grouping
  });
  cleanupCallbackSet.add(removeFocusGroup);
  element.setAttribute("navi-focus-group", manages ?? "");
  cleanupCallbackSet.add(() => {
    element.removeAttribute("navi-focus-group");
  });
  if (manages && strictTab) {
    element.setAttribute("navi-focus-group-strict", "");
    cleanupCallbackSet.add(() => {
      element.removeAttribute("navi-focus-group-strict");
    });
  }

  tab: {
    if (!skipTab) {
      break tab;
    }
    const handleTabKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      // Smart mode: when focus is inside an unmanaged element (e.g. an input
      // inside a radio widget), do NOT skip the entire group — let Tab navigate
      // freely. The predicate in performTabNavigation will still skip managed
      // items (those matching `manages`) encountered along the way.
      const activeElement = document.activeElement;
      const focusIsOnUnmanagedDescendant =
        manages &&
        !strictTab &&
        element.contains(activeElement) &&
        !activeElement.matches(manages);
      performTabNavigation(event, {
        outsideOfElement: focusIsOnUnmanagedDescendant ? null : element,
        excludeAriaHidden,
      });
    };
    // Handle Tab navigation (exit group)
    element.addEventListener("keydown", handleTabKeyDown, {
      // we must use capture: false to let chance for other part of the code
      // to call preventFocusNav
      capture: false,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleTabKeyDown, {
        capture: false,
        passive: false,
      });
    });
  }

  // Handle Arrow key navigation (within group)
  {
    const handleArrowKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      performArrowNavigation(event, element, {
        name,
        excludeAriaHidden,
        direction,
        wrap,
        xSelector,
        ySelector,
      });
    };
    element.addEventListener("keydown", handleArrowKeyDown, {
      // we must use capture: false to let chance for other part of the code
      // to call preventFocusNav
      capture: false,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleArrowKeyDown, {
        capture: false,
        passive: false,
      });
    });
  }

  return { cleanup };
};

const preventFocusNavViaKeyboard = (keyboardEvent) => {
  if (keyboardEvent.key === "Tab") {
    // prevent tab to move focus
    keyboardEvent.preventDefault();
    return true;
  }
  // ensure we won't perform our internal focus nav in focus groups
  preventFocusNav(keyboardEvent);
  return false;
};

/**
 * Traps keyboard focus and mouse clicks inside `element`.
 *
 * Once active:
 * - **Tab / Shift+Tab** cycle through focusable descendants of `element`,
 *   wrapping from last → first and first → last — *unless* `boundaryElement`
 *   is a real container (not `document`), in which case Tab escapes the
 *   whole container instead of wrapping (see `boundaryElement`'s own doc).
 *   If no focusable element exists, the default browser Tab action is
 *   suppressed so focus cannot escape.
 * - **Mouse clicks** outside `element` are only blocked when `pointerTrap`
 *   is `true`. Backdrop clicks (on `<dialog>` elements) still propagate even
 *   then, so the dialog can close itself.
 * - **Focus entering `boundaryElement` from outside it** (e.g. a `focus()`
 *   call, or Tab arriving from further out in the document) always lands on
 *   `element`'s own first focusable descendant — never on some other
 *   focusable sibling `boundaryElement` happens to also contain. Only
 *   relevant when `boundaryElement` isn't `document` (see below).
 *
 * Multiple traps can be stacked. When a new trap is activated the previous
 * one is paused; when the new trap is released the previous one resumes.
 * Traps must be released in LIFO order (the reverse of activation order).
 *
 * @param {HTMLElement} element - The root element to trap focus inside.
 * @param {object} [options]
 * @param {boolean} [options.pointerTrap=false] - When true, mouse clicks outside `element`
 *   are cancelled so the user cannot move focus away by clicking the backdrop.
 *   Backdrop clicks (target is a `<dialog>` element) only receive `preventDefault`
 *   and still propagate, allowing the dialog to react to them (e.g. close itself).
 * @param {Function} [options.debug] - Optional debug logger passed to tab navigation.
 * @param {Document|HTMLElement} [options.boundaryElement=document] - Where the
 *   mousedown/keydown/focusin listeners are attached. Defaults to `document`
 *   (a genuinely page-wide modal — the usual case, where none of the
 *   container-specific behavior below applies). Pass a specific container
 *   element instead for a trap that should only apply *within* that
 *   container: a Tab press or click occurring entirely outside it never
 *   reaches a listener attached there at all (events only bubble through
 *   their own ancestor chain), so the rest of the page keeps its normal tab
 *   order/interactions untouched. Inside the container, `element` behaves
 *   as if it were the *only* focusable thing `boundaryElement` contains:
 *   Tab reaching either edge of `element` skips over any other focusable
 *   sibling sharing the container, exiting the container entirely (not
 *   wrapping back into `element`), and focus arriving at some other
 *   focusable sibling inside the container gets redirected into `element`'s
 *   own first focusable descendant instead. Used by Dialog's own
 *   `layer="local"` renderer, which is only meant to be modal within its
 *   own positioned ancestor, not the whole document — a case where that
 *   ancestor can genuinely contain other, unrelated focusable content
 *   (e.g. a trigger button placed right next to it).
 * @returns {() => void} Cleanup function — call it to release the trap.
 */
const trapFocusInside = (
  element,
  { debug, pointerTrap = false, boundaryElement = document } = {},
) => {
  if (element.nodeType === 3) {
    console.warn("cannot trap focus inside a text node");
    return () => {};
  }

  const trappedElement = activeTraps.find(
    (activeTrap) => activeTrap.element === element,
  );
  if (trappedElement) {
    console.warn("focus already trapped inside this element");
    return () => {};
  }

  const isEventOutside = (event) => {
    if (event.target === element) {
      return false;
    }
    if (element.contains(event.target)) {
      return false;
    }
    return true;
  };

  // A real container (not document) — element must behave as the only
  // focusable thing boundaryElement contains, see this file's own doc.
  const escapeRoot = boundaryElement === document ? null : boundaryElement;

  const lock = () => {
    const onmousedown = pointerTrap
      ? (event) => {
          if (!isEventOutside(event)) {
            return;
          }
          event.preventDefault();
          // Backdrop clicks (e.g. clicking a <dialog>'s ::backdrop) must still
          // propagate so the dialog/popover can react to them (e.g. close itself).
          // A backdrop click is detected when the target is a <dialog> element —
          // the ::backdrop pseudo-element is not in the DOM, so the event target
          // becomes the dialog element itself when its content area is not hit.
          // Read through getAttribute rather than .className: on an SVG element
          // className is an SVGAnimatedString, not a string, and asking it for
          // .includes throws — which is how clicking an icon inside the trap
          // used to break. Still a substring test, because the real class names
          // are navi_dialog_backdrop / navi_popover_backdrop / ….
          const targetClass = event.target.getAttribute?.("class") || "";
          const isBackdropClick =
            event.target.tagName === "DIALOG" ||
            targetClass.includes("backdrop");
          if (!isBackdropClick) {
            event.stopImmediatePropagation();
          }
        }
      : null;

    const onkeydown = (event) => {
      if (isTabEvent(event)) {
        const handled = performTabNavigation(event, {
          rootElement: element,
          debug,
          escapeRoot,
        });
        if (!handled) {
          // No focusable target found — prevent the browser from moving focus outside the trap.
          event.preventDefault();
        }
      }
    };

    // Focus landing on some other focusable sibling boundaryElement also
    // contains (not element itself) gets redirected into element's own
    // first focusable descendant — e.g. a direct .focus() call, or Tab
    // arriving from further out in the document. Click-driven focus theft
    // is already prevented above by onmousedown (when pointerTrap is on);
    // this covers the rest (keyboard-driven entry, programmatic focus()).
    const onfocusin = escapeRoot
      ? (event) => {
          const target = event.target;
          if (target === element || element.contains(target)) {
            return;
          }
          const firstFocusable = findDescendant(element, (node) =>
            elementIsFocusable(node),
          );
          firstFocusable?.focus();
        }
      : null;

    if (onmousedown) {
      boundaryElement.addEventListener("mousedown", onmousedown, {
        capture: true,
        passive: false,
      });
    }
    boundaryElement.addEventListener("keydown", onkeydown, {
      capture: true,
      passive: false,
    });
    if (onfocusin) {
      boundaryElement.addEventListener("focusin", onfocusin);
    }

    return () => {
      if (onmousedown) {
        boundaryElement.removeEventListener("mousedown", onmousedown, {
          capture: true,
          passive: false,
        });
      }
      if (onfocusin) {
        boundaryElement.removeEventListener("focusin", onfocusin);
      }
      boundaryElement.removeEventListener("keydown", onkeydown, {
        capture: true,
        passive: false,
      });
    };
  };

  const deactivate = activate({
    // element
    lock,
  });

  const untrap = () => {
    deactivate();
  };

  return untrap;
};

const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const activeTraps = [];
const activate = ({ lock }) => {
  // unlock any trap currently activated
  let previousTrap;
  if (activeTraps.length > 0) {
    previousTrap = activeTraps[activeTraps.length - 1];
    previousTrap.unlock();
  }

  // store trap methods to lock/unlock as traps are acivated/deactivated
  const trap = { lock, unlock: lock() };
  activeTraps.push(trap);

  return () => {
    if (activeTraps.length === 0) {
      console.warn("cannot deactivate an already deactivated trap");
      return;
    }
    const lastTrap = activeTraps[activeTraps.length - 1];
    if (trap !== lastTrap) {
      // TODO: investigate this and maybe remove this requirment
      console.warn(
        "you must deactivate trap in the same order they were activated",
      );
      return;
    }
    activeTraps.pop();
    trap.unlock();
    // if any,reactivate the previous trap
    if (previousTrap) {
      previousTrap.unlock = previousTrap.lock();
    }
  };
};

// Helper to create scroll state capture/restore function for an element
const captureScrollState = (element) => {
  const scrollLeft = element.scrollLeft;
  const scrollTop = element.scrollTop;
  const scrollWidth = element.scrollWidth;
  const scrollHeight = element.scrollHeight;
  const clientWidth = element.clientWidth;
  const clientHeight = element.clientHeight;

  // Calculate scroll percentages to preserve relative position
  const scrollLeftPercent =
    scrollWidth > clientWidth ? scrollLeft / (scrollWidth - clientWidth) : 0;
  const scrollTopPercent =
    scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;

  // Return preserve function that maintains scroll position relative to content
  return () => {
    // Get current dimensions after DOM changes
    const newScrollWidth = element.scrollWidth;
    const newScrollHeight = element.scrollHeight;
    const newClientWidth = element.clientWidth;
    const newClientHeight = element.clientHeight;

    // If content dimensions changed significantly, use percentage-based positioning
    if (
      Math.abs(newScrollWidth - scrollWidth) > 1 ||
      Math.abs(newScrollHeight - scrollHeight) > 1 ||
      Math.abs(newClientWidth - clientWidth) > 1 ||
      Math.abs(newClientHeight - clientHeight) > 1
    ) {
      if (newScrollWidth > newClientWidth) {
        const newScrollLeft =
          scrollLeftPercent * (newScrollWidth - newClientWidth);
        element.scrollLeft = newScrollLeft;
      }

      if (newScrollHeight > newClientHeight) {
        const newScrollTop =
          scrollTopPercent * (newScrollHeight - newClientHeight);
        element.scrollTop = newScrollTop;
      }
    } else {
      element.scrollLeft = scrollLeft;
      element.scrollTop = scrollTop;
    }
  };
};

// https://developer.mozilla.org/en-US/docs/Glossary/Scroll_container


const { documentElement: documentElement$2 } =
  typeof document === "object" ? document : { documentElement: null };

const getScrollContainer = (arg, { includeHidden } = {}) => {
  if (typeof arg !== "object" || arg.nodeType !== 1) {
    throw new TypeError("getScrollContainer first argument must be DOM node");
  }
  const element = arg;
  if (element === document) {
    return null;
  }
  if (element === documentElement$2) {
    if (isScrollable(element, { includeHidden })) {
      return element;
    }
    return null;
  }
  if (element.hasAttribute("popover")) {
    return getScrollingElement(element.ownerDocument);
  }
  if (element.tagName === "DIALOG" && element.matches(":modal")) {
    return getScrollingElement(element.ownerDocument);
  }
  const position = getStyle(element, "position");
  if (position === "fixed") {
    return getScrollingElement(element.ownerDocument);
  }
  return (
    findScrollContainer(element, { includeHidden }) ||
    getScrollingElement(element.ownerDocument)
  );
};

const findScrollContainer = (element, { includeHidden } = {}) => {
  const position = getStyle(element, "position");
  let parent = element.parentNode;
  // Si l'élément est en position absolute, d'abord trouver le premier parent positionné
  if (position === "absolute") {
    while (parent && parent !== document) {
      if (parent === documentElement$2) {
        break; // documentElement est considéré comme positionné
      }
      const parentPosition = getStyle(parent, "position");
      if (parentPosition !== "static") {
        break; // Trouvé le premier parent positionné
      }
      parent = parent.parentNode;
    }
  }

  // Maintenant chercher le premier parent scrollable à partir du parent positionné
  while (parent) {
    if (parent === document) {
      return null;
    }
    if (isScrollable(parent, { includeHidden })) {
      return parent;
    }
    parent = parent.parentNode;
  }
  return null;
};

const getSelfAndAncestorScrolls = (element, startOnParent) => {
  let scrollX = 0;
  let scrollY = 0;
  const ancestorScrolls = [];
  const visitElement = (elementOrScrollContainer) => {
    const scrollContainer = getScrollContainer(elementOrScrollContainer);
    if (scrollContainer) {
      ancestorScrolls.push({
        element: elementOrScrollContainer,
        scrollContainer,
      });
      scrollX += scrollContainer.scrollLeft;
      scrollY += scrollContainer.scrollTop;
      if (scrollContainer === document.documentElement) {
        return;
      }
      visitElement(scrollContainer);
    }
  };
  if (startOnParent) {
    if (element === documentElement$2) ; else {
      visitElement(element.parentNode);
    }
  } else {
    visitElement(element);
  }
  ancestorScrolls.scrollX = scrollX;
  ancestorScrolls.scrollY = scrollY;
  return ancestorScrolls;
};

// https://github.com/shipshapecode/tether/blob/d6817f8c49a7a26b04c45e55589279dd1b5dd2bf/src/js/utils/parents.js#L1
const getScrollContainerSet = (element) => {
  const scrollContainerSet = new Set();
  let elementOrScrollContainer = element;
  while (true) {
    const scrollContainer = getScrollContainer(elementOrScrollContainer);
    if (!scrollContainer) {
      break;
    }
    scrollContainerSet.add(scrollContainer);
    if (scrollContainer === documentElement$2) {
      break;
    }
    elementOrScrollContainer = scrollContainer;
  }
  return scrollContainerSet;
};

/**
 * Rounds a CSS pixel value to the nearest physical pixel boundary for the current display.
 *
 * At zoom levels other than 100%, `devicePixelRatio` is not an integer (e.g. 1.25, 1.5),
 * so fractional CSS pixel values from `getBoundingClientRect()` may not align to the physical
 * pixel grid. Setting `top`/`left` to such values causes the browser to interpolate across
 * pixels, resulting in blurry rendering or misalignment with adjacent elements.
 *
 * Snapping to the physical grid ensures the value falls exactly on a pixel boundary.
 *
 * @param {number} value - A CSS pixel value (e.g. from getBoundingClientRect or scroll offset).
 * @returns {number} The nearest physical-pixel-aligned CSS pixel value.
 * @example
 * // At devicePixelRatio 1.25, snapToPixel(154.4) → 154.4 (already on grid)
 * // At devicePixelRatio 1.25, snapToPixel(154.3) → 154.4
 */
const snapToPixel = (value) => {
  return Math.round(value * devicePixelRatio) / devicePixelRatio;
};

// Round a CSS-pixel value to the nearest physical pixel boundary.
// At zoom levels other than 100%, devicePixelRatio is not an integer (e.g. 1.25, 1.5),
// so CSS pixels don't align 1:1 with physical pixels. Rounding to the physical grid
// ensures the browser can render the element without sub-pixel blurring.

const getBorderSizes = (element) => {
  const {
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    borderBottomWidth,
  } = window.getComputedStyle(element, null);

  return {
    left: snapToPixel(parseFloat(borderLeftWidth)),
    right: snapToPixel(parseFloat(borderRightWidth)),
    top: snapToPixel(parseFloat(borderTopWidth)),
    bottom: snapToPixel(parseFloat(borderBottomWidth)),
  };
};

/**
 * DOM Coordinate Systems: The Missing APIs Problem
 *
 * When positioning and moving DOM elements, we commonly need coordinate information.
 * The web platform provides getBoundingClientRect() which gives viewport-relative coordinates,
 * but this creates several challenges when working with scrollable containers:
 *
 * ## The Problem
 *
 * 1. **Basic positioning**: getBoundingClientRect() works great for viewport-relative positioning
 * 2. **Document scrolling**: When document has scroll, we add document.scrollLeft/scrollTop
 * 3. **Scroll containers**: When elements are inside scrollable containers, we need coordinates
 *    relative to that container, not the document
 *
 * ## Missing Browser APIs
 *
 * The web platform lacks essential APIs for scroll container workflows:
 * - No equivalent of getBoundingClientRect() relative to scroll container
 * - No built-in way to get element coordinates in scroll container space
 * - Manual coordinate conversion is error-prone and inconsistent
 *
 * ## This Module's Solution
 *
 * This module provides the missing coordinate APIs that work seamlessly with scroll containers:
 * - **getScrollRelativeRect()**: element rect relative to scroll container (PRIMARY API)
 * - **getMouseEventScrollRelativeRect()**: Mouse coordinates in scroll container space
 * - **convertScrollRelativeRectInto()**: Convert scroll-relative rect to element positioning coordinates
 *
 * These APIs abstract away the complexity of coordinate system conversion and provide
 * a consistent interface for element positioning regardless of scroll container depth.
 *
 * ## Primary API: getScrollRelativeRect()
 *
 * This is the main API you want - element rectangle relative to scroll container:
 *
 * ```js
 * const rect = element.getBoundingClientRect(); // viewport-relative
 * const scrollRect = getScrollRelativeRect(element, scrollContainer); // scroll-relative
 * ```
 *
 * Returns: { left, top, right, bottom, width, height, scrollLeft, scrollTop, scrollContainer, ...metadata }
 *
 * The scroll values are included so you can calculate scroll-absolute coordinates yourself:
 * ```js
 * const { left, top, scrollLeft, scrollTop } = getScrollRelativeRect(element);
 * const scrollAbsoluteLeft = left + scrollLeft;
 * const scrollAbsoluteTop = top + scrollTop;
 * ```
 *
 * ## Secondary APIs:
 *
 * - **getMouseEventScrollRelativeRect()**: Get mouse coordinates as a rect in scroll container space
 * - **convertScrollRelativeRectInto()**: Convert from scroll-relative coordinates to element positioning coordinates (for setting element.style.left/top)
 *
 * ## Coordinate System Terminology:
 *
 * - **Viewport-relative**: getBoundingClientRect() coordinates - relative to browser viewport
 * - **Scroll-relative**: Coordinates relative to scroll container (ignoring current scroll position)
 * - **Scroll-absolute**: Scroll-relative + scroll position (element's position in full scrollable content)
 * - **Element coordinates**: Coordinates for positioning elements (via element.style.left/top)
 *
 * ## Legacy Coordinate System Diagrams
 *
 * X-Axis Coordinate Systems in Web Development
 *
 * Diagram showing horizontal positioning and scrollbars:
 *
 * VIEWPORT (visible part of the document)
 * ┌───────────────────────────────────────────────┐
 * │                                               │
 * │                                               │
 * │ container.offsetLeft: 20px                    │
 * │       ┼─────────────────────────────┐         │
 * │       │                             │         │
 * │       │                             │         │
 * │       │  el.offsetLeft: 100px       │         │
 * │       │         ┼─────┐             │         │
 * │       │         │     │             │         │
 * │       │         └─────┘             │         │
 * │       │                             │         │
 * │       │ ░░░███░░░░░░░░░░░░░░░░░░░░░ │         │
 * │       └─────│───────────────────────┘         │
 * │ container.scrollLeft: 50px                    │
 * │                                               │
 * │                                               │
 * │ ░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
 * └─────────│─────────────────────────────────────┘
 *   document.scrollLeft: 200px
 *
 *
 * Left coordinate for the element:
 *
 * Document coordinates (absolute position in full document)
 * • Result: 320px
 * • Detail: container.offsetLeft + element.offsetLeft + document.scrollLeft
 *           20                +  100              + 200               = 320px
 *
 * Viewport coordinates (getBoundingClientRect().left):
 * • Result: 120px
 * • Detail: container.offsetLeft + element.offsetLeft
 *           20                +  100              = 120px
 *
 * Scroll coordinates (position within scroll container):
 * • Result: 50px
 * • Detail: element.offsetLeft - container.scrollLeft
 *           100              - 50                 = 50px
 *
 * Scroll behavior examples:
 *
 * When document scrolls (scrollLeft: 200px → 300px):
 * • Document coordinates: 320px → 420px
 * • Viewport coordinates: 120px → 120px (unchanged)
 * • Scroll coordinates: 50px → 50px (unchanged)
 *
 * When container scrolls (scrollLeft: 50px → 100px):
 * • Document coordinates: 320px → 270px
 * • Viewport coordinates: 120px → 70px
 * • Scroll coordinates: 50px → 0px
 */


const { documentElement: documentElement$1 } =
  typeof document === "object" ? document : { documentElement: null };

/**
 * Get element rectangle relative to its scroll container
 *
 * @param {Element} element - The element to get coordinates for
 * @param {Element} [scrollContainer] - Optional scroll container (auto-detected if not provided)
 * @param {object} [options] - Configuration options
 * @returns {object} { left, top, right, bottom, width, height, scrollLeft, scrollTop, scrollContainer, ...metadata }
 */
const getScrollRelativeRect = (
  element,
  scrollContainer = getScrollContainer(element),
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const {
    left: leftViewport,
    top: topViewport,
    width,
    height,
  } = element.getBoundingClientRect();

  let fromFixed = false;
  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;
  const scrollLeft = scrollContainer.scrollLeft;
  const scrollTop = scrollContainer.scrollTop;
  const scrollContainerIsDocument = scrollContainer === documentElement$1;
  const createScrollRelativeRect = (leftScrollRelative, topScrollRelative) => {
    const isStickyLeftOrHasStickyLeftAttr = Boolean(
      fromStickyLeft || fromStickyLeftAttr,
    );
    const isStickyTopOrHasStickyTopAttr = Boolean(
      fromStickyTop || fromStickyTopAttr,
    );
    return {
      left: leftScrollRelative,
      top: topScrollRelative,
      right: leftScrollRelative + width,
      bottom: topScrollRelative + height,

      // metadata
      width,
      height,
      scrollContainer,
      scrollContainerIsDocument,
      scrollLeft,
      scrollTop,
      fromFixed,
      fromStickyLeft,
      fromStickyTop,
      fromStickyLeftAttr,
      fromStickyTopAttr,
      isStickyLeftOrHasStickyLeftAttr,
      isStickyTopOrHasStickyTopAttr,
      isSticky:
        isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
    };
  };

  {
    const computedStyle = getComputedStyle(element);
    {
      const usePositionSticky = computedStyle.position === "sticky";
      if (usePositionSticky) {
        // For CSS position:sticky elements, use scrollable-relative coordinates
        const [leftScrollRelative, topScrollRelative] =
          viewportPosToScrollRelativePos(
            leftViewport,
            topViewport,
            scrollContainer,
          );
        const isStickyLeft = computedStyle.left !== "auto";
        const isStickyTop = computedStyle.top !== "auto";
        fromStickyLeft = isStickyLeft
          ? { value: parseFloat(computedStyle.left) || 0 }
          : undefined;
        fromStickyTop = isStickyTop
          ? { value: parseFloat(computedStyle.top) || 0 }
          : undefined;
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
    {
      const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
      const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
      const useStickyAttribute =
        hasStickyLeftAttribute || hasStickyTopAttribute;
      if (useStickyAttribute) {
        // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
        // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
        let [leftScrollRelative, topScrollRelative] =
          viewportPosToScrollRelativePos(
            leftViewport,
            topViewport,
            scrollContainer,
          );
        if (hasStickyLeftAttribute) {
          const leftCssValue = parseFloat(computedStyle.left) || 0;
          fromStickyLeftAttr = { value: leftCssValue };
          if (useOriginalPositionEvenIfSticky) ; else {
            const scrollLeft = scrollContainer.scrollLeft;
            const stickyPosition = scrollLeft + leftCssValue;
            const leftWithScroll = leftScrollRelative + scrollLeft;
            if (stickyPosition > leftWithScroll) {
              leftScrollRelative = leftCssValue; // Element is stuck
            }
          }
        }
        if (hasStickyTopAttribute) {
          const topCssValue = parseFloat(computedStyle.top) || 0;
          fromStickyTopAttr = { value: topCssValue };
          if (useOriginalPositionEvenIfSticky) ; else {
            const scrollTop = scrollContainer.scrollTop;
            const stickyPosition = scrollTop + topCssValue;
            const topWithScroll = topScrollRelative + scrollTop;
            if (stickyPosition > topWithScroll) {
              topScrollRelative = topCssValue; // Element is stuck
            }
          }
        }
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
  }

  // For normal elements, use scrollable-relative coordinates
  const [leftScrollRelative, topScrollRelative] =
    viewportPosToScrollRelativePos(leftViewport, topViewport, scrollContainer);
  return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
};
const viewportPosToScrollRelativePos = (
  leftViewport,
  topViewport,
  scrollContainer,
) => {
  const scrollContainerIsDocument = scrollContainer === documentElement$1;
  if (scrollContainerIsDocument) {
    return [leftViewport, topViewport];
  }
  const { left: scrollContainerLeftViewport, top: scrollContainerTopViewport } =
    scrollContainer.getBoundingClientRect();
  return [
    leftViewport - scrollContainerLeftViewport,
    topViewport - scrollContainerTopViewport,
  ];
};

// position: fixed is already viewport-relative, so no scroll offset is
// needed to place it correctly — adding one would double-count the scroll.
// position: absolute (assumed relative to the initial containing block, the
// common case for a document-relative absolutely positioned element) needs
// the current scroll offset added to convert a viewport-relative coordinate
// into one it can be set to directly. Read the element's own computed style
// rather than assuming one or the other, since callers may use either.
const getPositioningScrollOffset = (element) => {
  const isFixed = getComputedStyle(element).position === "fixed";
  if (isFixed) {
    return { scrollLeft: 0, scrollTop: 0 };
  }
  return {
    scrollLeft: documentElement$1.scrollLeft,
    scrollTop: documentElement$1.scrollTop,
  };
};

const addScrollToRect = (scrollRelativeRect) => {
  const { left, top, width, height, scrollLeft, scrollTop } =
    scrollRelativeRect;
  const leftWithScroll = left + scrollLeft;
  const topWithScroll = top + scrollTop;
  return {
    ...scrollRelativeRect,
    left: leftWithScroll,
    top: topWithScroll,
    right: leftWithScroll + width,
    bottom: topWithScroll + height,
  };
};

// https://github.com/w3c/csswg-drafts/issues/3329
// Return the portion of the element that is visible for this scoll container
const getScrollBox = (scrollContainer) => {
  if (scrollContainer === documentElement$1) {
    const { clientWidth, clientHeight } = documentElement$1;

    return {
      left: 0,
      top: 0,
      right: clientWidth,
      bottom: clientHeight,
      width: clientWidth,
      height: clientHeight,
    };
  }

  const { clientWidth, clientHeight } = scrollContainer;
  const scrollContainerBorderSizes = getBorderSizes(scrollContainer);
  const left = scrollContainerBorderSizes.left;
  const top = scrollContainerBorderSizes.top;
  const right = left + clientWidth;
  const bottom = top + clientHeight;
  return {
    left,
    top,
    right,
    bottom,
    width: clientWidth,
    height: clientHeight,
  };
};
// https://developer.mozilla.org/en-US/docs/Glossary/Scroll_container#scrollport
const getScrollport = (scrollBox, scrollContainer) => {
  const { left, top, width, height } = scrollBox;
  const leftWithScroll = left + scrollContainer.scrollLeft;
  const topWithScroll = top + scrollContainer.scrollTop;
  const rightWithScroll = leftWithScroll + width;
  const bottomWithScroll = topWithScroll + height;
  return {
    left: leftWithScroll,
    top: topWithScroll,
    right: rightWithScroll,
    bottom: bottomWithScroll,
  };
};

/**
 * Returns [verticalScrollbarWidth, horizontalScrollbarHeight] as currently
 * rendered by `scrollableElement`, in px. Returns zeros when the element has no
 * classic scrollbar: no overflow, overlay scrollbars, `scrollbar-width: none`,
 * or a `::-webkit-scrollbar { display: none }` rule.
 *
 * The measurement is taken on the element itself (its own border box versus its
 * own content box) rather than on a probe node appended inside it. A probe
 * cannot answer this question: `scrollbar-width` and `::-webkit-scrollbar` are
 * not inherited, so a probe reports the platform default scrollbar size even
 * when the element renders no scrollbar at all.
 */
const measureScrollbar = (scrollableElement) => {
  if (
    scrollableElement === document.documentElement ||
    scrollableElement === document.scrollingElement
  ) {
    // documentElement.clientWidth/Height report the viewport minus its
    // scrollbars, not this element's own box (which `max-width` can shrink), so
    // the border box to compare against is the window itself.
    return [
      snapToPixel(window.innerWidth - document.documentElement.clientWidth),
      snapToPixel(window.innerHeight - document.documentElement.clientHeight),
    ];
  }
  const { left, right, top, bottom } = getBorderSizes(scrollableElement);
  const scrollbarWidth =
    scrollableElement.offsetWidth -
    scrollableElement.clientWidth -
    left -
    right;
  const scrollbarHeight =
    scrollableElement.offsetHeight -
    scrollableElement.clientHeight -
    top -
    bottom;
  return [
    scrollbarWidth > 0 ? snapToPixel(scrollbarWidth) : 0,
    scrollbarHeight > 0 ? snapToPixel(scrollbarHeight) : 0,
  ];
};

/**
 * Prevents unwanted scrollbars during dimension transitions.
 *
 * Problem: When animating from one size to another, intermediate dimensions
 * might temporarily trigger scrollbars that shouldn't exist in the final state.
 * This creates visual flicker and layout shifts.
 *
 * Solution: Detect when intermediate animation frames would create problematic
 * scrollbars and temporarily hide overflow during the transition.
 */
const preventIntermediateScrollbar = (
  element,
  { fromWidth, toWidth, fromHeight, toHeight, onPrevent, onRestore },
) => {
  const scrollContainer = getScrollContainer(element);
  const [scrollbarWidth, scrollbarHeight] = measureScrollbar(scrollContainer);
  const scrollBox = getScrollBox(scrollContainer);
  const scrollContainerWidth = scrollBox.width + scrollbarWidth;
  const scrollContainerHeight = scrollBox.height + scrollbarHeight;

  const currentScrollbarState = getScrollbarState(fromWidth, fromHeight, {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  });
  const finalScrollbarState = getScrollbarState(toWidth, toHeight, {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  });
  if (
    currentScrollbarState.x === finalScrollbarState.x &&
    currentScrollbarState.y === finalScrollbarState.y
  ) {
    return () => {};
  }

  // Simulate worst case during transition - when both dimensions are at their maximum
  const maxWidth = Math.max(fromWidth, toWidth);
  const maxHeight = Math.max(fromHeight, toHeight);
  let availableWidth = scrollContainerWidth;
  let availableHeight = scrollContainerHeight;
  let wouldHaveXDuringTransition = maxWidth > availableWidth;
  let wouldHaveYDuringTransition = maxHeight > availableHeight;
  if (wouldHaveXDuringTransition) {
    availableHeight -= scrollbarHeight; // X scrollbar reduces available Y space
    wouldHaveYDuringTransition = maxHeight > availableHeight; // Re-check Y with reduced space
  }
  if (wouldHaveYDuringTransition) {
    availableWidth -= scrollbarWidth; // Y scrollbar reduces available X space
    wouldHaveXDuringTransition = maxWidth > availableWidth; // Re-check X with reduced space
  }
  const intermediateX = wouldHaveXDuringTransition && !finalScrollbarState.x;
  const intermediateY = wouldHaveYDuringTransition && !finalScrollbarState.y;
  if (!intermediateX && !intermediateY) {
    return () => {};
  }

  // Apply prevention
  const originalOverflowX = scrollContainer.style.overflowX;
  const originalOverflowY = scrollContainer.style.overflowY;
  if (intermediateX) {
    scrollContainer.style.overflowX = "hidden";
  }
  if (intermediateY) {
    scrollContainer.style.overflowY = "hidden";
  }
  onPrevent?.({
    x: intermediateX,
    y: intermediateY,
    scrollContainer,
  });
  return () => {
    if (intermediateX) {
      scrollContainer.style.overflowX = originalOverflowX;
    }
    if (intermediateY) {
      scrollContainer.style.overflowY = originalOverflowY;
    }
    onRestore?.({
      x: intermediateX,
      y: intermediateY,
      scrollContainer,
    });
  };
};

const getScrollbarState = (
  contentWidth,
  contentHeight,
  {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  },
) => {
  let availableWidth = scrollContainerWidth;
  let availableHeight = scrollContainerHeight;
  const contentExceedsWidth = contentWidth > availableWidth;
  const contentExceedsHeight = contentHeight > availableHeight;

  // Start with basic overflow
  let x = contentExceedsWidth;
  let y = contentExceedsHeight;
  // If Y scrollbar appears, it reduces available X space
  if (y) {
    availableWidth -= scrollbarWidth;
    // Re-check X scrollbar with reduced space
    x = contentWidth > availableWidth;
  }
  // If X scrollbar appears, it reduces available Y space
  if (x) {
    availableHeight -= scrollbarHeight;
    // Re-check Y scrollbar with reduced space
    y = contentHeight > availableHeight;
  }

  return { x, y, availableWidth, availableHeight };
};

/**
 * Scrolls el into view within a specific container only — does NOT scroll
 * any ancestor beyond that container (document, popover backdrop, etc.).
 *
 * Why not just use scrollIntoView({ container: "nearest" })?
 * It finds the nearest scrollable ancestor and stops there ONLY IF that
 * ancestor has visible scrollbar, otherwise browser walks further up,
 * potentially scrolling the document.
 * This is exactly the wrong behavior inside a popover or fixed panel.
 * scrollIntoViewScoped avoids this by targeting one container explicitly.
 *
 * Uses scrollTo() so CSS scroll-behavior:smooth on the container is respected.
 * Respects scroll-margin-* on the element.
 *
 * @param {Element} el - The element to scroll into view.
 * @param {object} options
 * @param {Element} [options.container] - The scroll container to scroll. Defaults to getScrollContainer(el).
 * @param {"start"|"center"|"end"|"nearest"} [options.block="nearest"] - Vertical alignment.
 * @param {"start"|"center"|"end"|"nearest"} [options.inline="nearest"] - Horizontal alignment.
 */
const scrollIntoViewScoped = (
  el,
  {
    container = getScrollContainer(el),
    block = "nearest",
    inline = "nearest",
  } = {},
) => {
  if (!container) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const style = getComputedStyle(el);

  const scrollMarginTop = parseFloat(style.scrollMarginTop) || 0;
  const scrollMarginBottom = parseFloat(style.scrollMarginBottom) || 0;
  const scrollMarginLeft = parseFloat(style.scrollMarginLeft) || 0;
  const scrollMarginRight = parseFloat(style.scrollMarginRight) || 0;

  const currentScrollTop = container.scrollTop;
  const currentScrollLeft = container.scrollLeft;
  const containerHeight = containerRect.height;
  const containerWidth = containerRect.width;

  // Element position relative to the container's scroll origin.
  const elTop =
    elRect.top - containerRect.top + currentScrollTop - scrollMarginTop;
  const elBottom = elTop + elRect.height + scrollMarginTop + scrollMarginBottom;
  const elLeft =
    elRect.left - containerRect.left + currentScrollLeft - scrollMarginLeft;
  const elRight = elLeft + elRect.width + scrollMarginLeft + scrollMarginRight;

  let newScrollTop = currentScrollTop;
  if (block === "start") {
    newScrollTop = elTop;
  } else if (block === "end") {
    newScrollTop = elBottom - containerHeight;
  } else if (block === "center") {
    newScrollTop = elTop + (elRect.height - containerHeight) / 2;
  } else {
    // nearest: scroll only if partially or fully out of view.
    // When the element is taller than the container, only scroll if it is
    // completely out of view — otherwise it is already as visible as possible.
    const scrollBottom = currentScrollTop + containerHeight;
    const elHeight = elBottom - elTop;
    if (elHeight <= containerHeight) {
      if (elTop < currentScrollTop) {
        newScrollTop = elTop;
      } else if (elBottom > scrollBottom) {
        newScrollTop = elBottom - containerHeight;
      }
    } else if (elBottom < currentScrollTop) {
      newScrollTop = elBottom - containerHeight;
    } else if (elTop > scrollBottom) {
      newScrollTop = elTop;
    }
  }

  let newScrollLeft = currentScrollLeft;
  if (inline === "start") {
    newScrollLeft = elLeft;
  } else if (inline === "end") {
    newScrollLeft = elRight - containerWidth;
  } else if (inline === "center") {
    newScrollLeft = elLeft + (elRect.width - containerWidth) / 2;
  } else {
    // nearest: scroll only if partially or fully out of view.
    // When the element is wider than the container, only scroll if it is
    // completely out of view — otherwise it is already as visible as possible.
    const scrollRight = currentScrollLeft + containerWidth;
    const elWidth = elRight - elLeft;
    if (elWidth <= containerWidth) {
      if (elLeft < currentScrollLeft) {
        newScrollLeft = elLeft;
      } else if (elRight > scrollRight) {
        newScrollLeft = elRight - containerWidth;
      }
    } else if (elRight < currentScrollLeft) {
      newScrollLeft = elRight - containerWidth;
    } else if (elLeft > scrollRight) {
      newScrollLeft = elLeft;
    }
  }

  container.scrollTo({
    left: newScrollLeft,
    top: newScrollTop,
  });
};

/**
 * DON'T USE THIS, use scroll-padding-top/bottom in CSS instead
 * better in every aspect
 */


/**
 * Scrolls el into view (using the native "nearest" block behavior) and then
 * corrects for any sticky element that visually covers el inside its scroll
 * container.
 *
 * After the native scroll, this function iterates the siblings of el (children
 * of el's parent) and checks whether any of them uses `position: sticky` and
 * overlaps el. The largest overlap on each side is used to nudge scrollTop:
 * - sticky-top (top !== auto): subtract overlap so el appears below the header
 * - sticky-bottom (bottom !== auto): add overlap so el appears above the footer
 *
 * If el happens to be covered on both sides at once (extremely unlikely) the
 * correction picks whichever side was covered — the result may not be perfect
 * but avoids an infinite correction loop.
 *
 * @param {Element} el - The element to scroll into view.
 */
const scrollIntoViewWithStickyAwareness = (
  el,
  { behavior, block = "nearest", inline, container } = {},
) => {
  el.scrollIntoView({ behavior, block, inline, container });
  const scrollContainer = getScrollContainer(el);
  if (!scrollContainer) {
    return;
  }
  const elRect = el.getBoundingClientRect();
  let topCover = 0;
  let bottomCover = 0;
  for (const sibling of el.parentNode.children) {
    const style = getComputedStyle(sibling);
    if (style.position !== "sticky") {
      continue;
    }
    const rect = sibling.getBoundingClientRect();
    if (style.top !== "auto") {
      // Sticky-top: covers el from above — track the largest overlap.
      const overlap = rect.bottom - elRect.top;
      if (overlap > topCover) {
        topCover = overlap;
      }
    } else if (style.bottom !== "auto") {
      // Sticky-bottom: covers el from below — track the largest overlap.
      // Only checked when top is "auto" so each element is attributed to one
      // side only; both sides are still accumulated across all children.
      const overlap = elRect.bottom - rect.top;
      if (overlap > bottomCover) {
        bottomCover = overlap;
      }
    }
    if (topCover > 0 && bottomCover > 0) {
      // Both sides already have coverage — no point checking further children.
      break;
    }
  }
  if (topCover > 0) {
    // For block="center" the element is visually centered in the full viewport.
    // A sticky header of height H shifts the available center upward by H/2,
    // so we only need to correct by half the overlap to keep the element
    // centered in the visible (uncovered) area.
    scrollContainer.scrollTop -= block === "center" ? topCover / 2 : topCover;
  }
  if (bottomCover > 0) {
    scrollContainer.scrollTop +=
      block === "center" ? bottomCover / 2 : bottomCover;
  }
};

const getPaddingSizes = (element) => {
  const { paddingLeft, paddingRight, paddingTop, paddingBottom } =
    window.getComputedStyle(element, null);

  return {
    left: snapToPixel(parseFloat(paddingLeft)),
    right: snapToPixel(parseFloat(paddingRight)),
    top: snapToPixel(parseFloat(paddingTop)),
    bottom: snapToPixel(parseFloat(paddingBottom)),
  };
};

/**
 * Prevents scrolling on all scrollable containers that are ancestors of (or
 * siblings preceding) `element`. Used when an overlay (popover, dialog) is
 * open and background scroll should be disabled.
 *
 * **Why padding instead of scrollbar-gutter?**
 * `scrollbar-gutter: stable` would be the modern, CSS-native way to reserve
 * the scrollbar lane before hiding overflow so the layout doesn't shift.
 * However it only works well when the element's design already accounts for
 * that reserved space. On arbitrary containers we can't assume that, so we
 * measure the actual scrollbar size and compensate with padding — a technique
 * that works regardless of how the element is styled.
 *
 * **What if the element already uses scrollbar-gutter?**
 * A non-"auto" `scrollbar-gutter` value signals that the element has its own
 * scrollbar-gutter strategy in place. In that case we skip the padding
 * compensation and rely on that strategy instead — adding padding on top of an
 * already-reserved gutter would double-count the space.
 *
 * @param {HTMLElement} element - The overlay element being shown. Its preceding
 *   siblings and all ancestor scroll containers will be scroll-locked.
 * @param {Object} [options]
 * @param {HTMLElement} [options.boundaryElement] - Only lock scroll containers
 *   inside this element (itself included). For an overlay confined to a local
 *   container rather than the viewport: the container's own scroll must stop,
 *   the rest of the page keeps scrolling as usual.
 * @returns {() => void} Cleanup function that restores all modified styles.
 */
const trapScrollInside = (element, { boundaryElement } = {}) => {
  const cleanupCallbackSet = new Set();

  // Collect every element to lock first (preceding scrollable siblings + all
  // ancestor scroll containers).
  const elementsToLock = [];
  let previous = element.previousSibling;
  while (previous) {
    if (previous.nodeType === 1 && isScrollable(previous)) {
      elementsToLock.push(previous);
    }
    previous = previous.previousSibling;
  }
  for (const selfOrAncestorScroll of getSelfAndAncestorScrolls(element)) {
    const { scrollContainer } = selfOrAncestorScroll;
    if (boundaryElement && !boundaryElement.contains(scrollContainer)) {
      continue;
    }
    elementsToLock.push(scrollContainer);
  }

  // Phase 1 — MEASURE. Batch every layout/style read (scrollTop, scrollbar
  // size, padding) before any style write, so the layout that showModal
  // invalidated is recomputed once rather than thrashing between each write and
  // the next read. (measureScrollbar still forces its own reflow per element via
  // its probe node — that one is inherent.)
  const plans = elementsToLock.map((el) => {
    const savedScrollTop = el.scrollTop;
    const savedScrollLeft = el.scrollLeft;
    const scrollbarGutter = getStyle(el, "scrollbar-gutter");
    if (scrollbarGutter && scrollbarGutter !== "auto") {
      // The element manages its own gutter — just hide overflow, no padding.
      return {
        el,
        savedScrollTop,
        savedScrollLeft,
        styles: { overflow: "hidden" },
      };
    }
    const [scrollbarWidth, scrollbarHeight] = measureScrollbar(el);
    const { right, bottom } = getPaddingSizes(el);
    return {
      el,
      savedScrollTop,
      savedScrollLeft,
      styles: {
        "padding-right": `${right + scrollbarWidth}px`,
        "padding-bottom": `${bottom + scrollbarHeight}px`,
        "overflow": "hidden",
      },
    };
  });

  // Phase 2 — MUTATE. All style writes together.
  for (const { el, savedScrollTop, savedScrollLeft, styles } of plans) {
    const removeScrollLockStyles = setStyles(el, styles);
    cleanupCallbackSet.add(() => {
      removeScrollLockStyles();
      el.scrollTop = savedScrollTop;
      el.scrollLeft = savedScrollLeft;
    });
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};

/**
 * Who is answering the wheel gesture happening right now.
 *
 * A wheel gesture has no beginning and no end of its own: it is a burst of
 * events that starts when the fingers move and goes on after they are gone —
 * the tail of it is the momentum the system keeps sending. And it has no target
 * either: every event is aimed at whatever happens to be under the pointer at
 * that instant. So a burst that began over one box lands on another as soon as
 * the hand drifts, or as soon as what was under it has travelled away — and
 * read box by box, ONE gesture is answered twice: a slide moves, then the box
 * around it moves too, under a hand that pushed once.
 *
 * Hence an owner. Whoever answers a burst first says so, everyone else asks
 * before answering, and the owner keeps it until the events stop coming.
 * Silence is the only end there is, which is why an owner has to say it is
 * still there on every event of its gesture — a claim nobody renews is a
 * gesture that is over.
 */

// How long a silence ends a gesture, for an owner that says nothing else: long
// enough to survive a page that is busy — the frames right after something sets
// off are the ones where the main thread has the most to do, and a silence read
// there as "the hand is gone" would cut one gesture into several.
const GESTURE_END_DELAY = 150;

let gestureOwner = null;
let gestureOnEnd = null;
let gestureEndTimeout = null;

const endGesture = () => {
  const onEnd = gestureOnEnd;
  gestureOwner = null;
  gestureOnEnd = null;
  gestureEndTimeout = null;
  onEnd?.();
};

/**
 * Is the burst going on right now somebody else's? Asked before answering a
 * wheel event: `false` means it is free, or already this one's.
 */
const wheelGestureIsTakenFrom = (candidate) =>
  gestureOwner !== null && gestureOwner !== candidate;

/**
 * Take the gesture, or say it is still going. Called on every event of it: the
 * claim lapses on its own once `delay` goes by without a word, and `onEnd` is
 * how the owner hears about that — it is the only end a wheel gesture has.
 *
 * @param {any} owner - anything that can be compared, usually the element.
 * @param {object} [options]
 * @param {() => void} [options.onEnd] - the silence was long enough.
 * @param {number} [options.delay] - how long that silence is.
 */
const claimWheelGesture = (
  owner,
  { onEnd, delay = GESTURE_END_DELAY } = {},
) => {
  if (wheelGestureIsTakenFrom(owner)) {
    return false;
  }
  gestureOwner = owner;
  gestureOnEnd = onEnd;
  clearTimeout(gestureEndTimeout);
  gestureEndTimeout = setTimeout(endGesture, delay);
  return true;
};

/**
 * Give it back before the silence does — the box is going away, the gesture was
 * handed to something else. Whoever does not own it says nothing.
 */
const releaseWheelGesture = (owner) => {
  if (gestureOwner !== owner) {
    return;
  }
  clearTimeout(gestureEndTimeout);
  endGesture();
};

/**
 * Creates intuitive scrolling behavior when scrolling over an element that needs to stay interactive
 * (we can't use pointer-events: none). Instead of scrolling the document unexpectedly,
 * finds and scrolls the appropriate scrollable container behind the overlay.
 */


const allowWheelThrough = (element, connectedElement) => {
  const isElementOrDescendant = (possibleDescendant) => {
    return (
      possibleDescendant === element || element.contains(possibleDescendant)
    );
  };
  const tryToScrollOne = (element, wheelEvent) => {
    if (element === document.documentElement) {
      // let browser handle document scrolling
      return true;
    }

    const { deltaX, deltaY } = wheelEvent;
    // we found what we want: a scrollable container behind the element
    // we try to scroll it.
    const elementCanApplyScrollDeltaX =
      deltaX && canApplyScrollDelta(element, deltaX, "x");
    const elementCanApplyScrollDeltaY =
      deltaY && canApplyScrollDelta(element, deltaY, "y");
    if (!elementCanApplyScrollDeltaX && !elementCanApplyScrollDeltaY) {
      return false;
    }
    if (!isScrollable(element)) {
      return false;
    }
    const belongsToElement = isElementOrDescendant(element);
    if (belongsToElement) {
      // let browser handle the scroll on the element itself
      return true;
    }
    wheelEvent.preventDefault();
    applyWheelScrollThrough(element, wheelEvent);
    return true;
  };

  if (connectedElement) {
    const onWheel = (wheelEvent) => {
      const connectedScrollContainer = getScrollContainer(connectedElement);
      if (connectedScrollContainer === document.documentElement) {
        // the connected scrollable parent is the document
        // there is nothing to do, browser native scroll will work as we want
        return;
      }

      const elementsBehindMouse = document.elementsFromPoint(
        wheelEvent.clientX,
        wheelEvent.clientY,
      );
      for (const elementBehindMouse of elementsBehindMouse) {
        // try to scroll element itself
        if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
          return;
        }
        const belongsToElement = isElementOrDescendant(elementBehindMouse);
        // try to scroll what is behind
        if (!belongsToElement) {
          break;
        }
      }
      // At this stage the element has no scrollable parts
      // we can try to scroll the connected scrollable parent
      tryToScrollOne(connectedScrollContainer, wheelEvent);
    };
    element.addEventListener("wheel", onWheel);
    return;
  }

  const onWheel = (wheelEvent) => {
    const elementsBehindMouse = document.elementsFromPoint(
      wheelEvent.clientX,
      wheelEvent.clientY,
    );
    for (const elementBehindMouse of elementsBehindMouse) {
      // try to scroll element itself
      if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
        return;
      }
      const belongsToElement = isElementOrDescendant(elementBehindMouse);
      if (belongsToElement) {
        // keep searching if something in our element is scrollable
        continue;
      }
      // our element is not scrollable, try to scroll the container behind the mouse
      const scrollContainer = getScrollContainer(elementBehindMouse);
      if (tryToScrollOne(scrollContainer, wheelEvent)) {
        return;
      }
    }
  };
  element.addEventListener("wheel", onWheel);
};

const canApplyScrollDelta = (element, delta, axis) => {
  const {
    clientWidth,
    clientHeight,
    scrollWidth,
    scrollHeight,
    scrollLeft,
    scrollTop,
  } = element;

  let size = axis === "x" ? clientWidth : clientHeight;
  let currentScroll = axis === "x" ? scrollLeft : scrollTop;
  let scrollEnd = axis === "x" ? scrollWidth : scrollHeight;

  if (size === scrollEnd) {
    // when scrollWidth === clientWidth, there is no scroll to apply
    return false;
  }
  if (delta < 0 && currentScroll <= 0) {
    // when scrollLeft is 0, we can't scroll to the left
    return false;
  }
  if (delta > 0 && currentScroll + size >= scrollEnd) {
    // when scrollLeft + size >= scrollWidth, we can't scroll to the right
    return false;
  }
  return true;
};

const applyWheelScrollThrough = (element, wheelEvent) => {
  wheelEvent.preventDefault();
  element.scrollBy({
    top: wheelEvent.deltaY,
    left: wheelEvent.deltaX,
    behavior: wheelEvent.deltaMode === 0 ? "auto" : "smooth", // optional tweak
  });
};

const installImportMetaCssBuild = (importMeta) => {
  const IMPORT_META_CSS_BUILD = "jsenv_import_meta_css_build";

  if (importMeta.css === IMPORT_META_CSS_BUILD) {
    return;
  }

  const stylesheetMap = new Map();
  const adopt = (url, value) => {
    const stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });
    stylesheet.replaceSync(value);
    stylesheetMap.set(url, stylesheet);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
  };
  const update = (url, value) => {
    stylesheetMap.get(url).replaceSync(value);
  };
  const remove = (url) => {
    const stylesheet = stylesheetMap.get(url);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== stylesheet,
    );
    stylesheetMap.delete(url);
  };

  const currentCssSourceMap = new Map();
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    get() {
      return IMPORT_META_CSS_BUILD;
    },
    set([value, url]) {
      if (value === undefined) {
        if (stylesheetMap.has(url)) {
          remove(url);
          currentCssSourceMap.delete(url);
        }
        return;
      }
      if (!stylesheetMap.has(url)) {
        adopt(url, value);
        currentCssSourceMap.set(url, value);
      } else if (currentCssSourceMap.get(url) !== value) {
        update(url, value);
        currentCssSourceMap.set(url, value);
      }
    },
  });
};

/**
 * Isolates user interactions to only the specified elements, making everything else non-interactive.
 *
 * This creates a controlled interaction environment where only the target elements (and their ancestors)
 * can receive user input like clicks, keyboard events, focus, etc. All other DOM elements become
 * non-interactive, preventing conflicting or unwanted interactions during critical operations
 * like drag gestures, modal dialogs, or complex UI states.
 *
 * The function uses the `inert` attribute to achieve this isolation, applying it strategically
 * to parts of the DOM tree while preserving the interactive elements and their ancestor chains.
 *
 * Example DOM structure and inert application:
 *
 * Before calling isolateInteractions:
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>
 *       <span>some content</span>
 *       <div class="modal">modal content</div>
 *       <span>more content</span>
 *     </div>
 *     <aside inert>already inert</aside>
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * After calling isolateInteractions([modal, dropdown]):
 * ```
 * <body>
 *   <header inert>...</header>  ← made inert (no active descendants)
 *   <main> ← not inert because it contains active elements
 *     <div> ← not inert because it contains .modal
 *       <span inert>some content</span> ← made inert selectively
 *       <div class="modal">modal content</div> ← stays active
 *       <span inert>more content</span> ← made inert selectively
 *     </div>
 *     <aside inert>already inert</aside>
 *     <div class="dropdown">dropdown menu</div> ← stays active
 *   </main>
 *   <footer inert>...</footer>
 * </body>
 * ```
 *
 * After calling cleanup():
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>
 *       <span>some content</span>
 *       <div class="modal">modal content</div>
 *       <span>more content</span>
 *     </div>
 *     <aside inert>already inert</aside> ← [inert] preserved
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * @param {Array<Element>} elements - Array of elements to keep interactive (non-inert)
 * @returns {Function} cleanup - Function to restore original inert states
 */
const isolateInteractions = (elements) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const toKeepInteractiveSet = new Set();
  const keepSelfAndAncestors = (el) => {
    if (toKeepInteractiveSet.has(el)) {
      return;
    }
    const associatedElements = getAssociatedElements(el);
    if (associatedElements) {
      for (const associatedElement of associatedElements) {
        keepSelfAndAncestors(associatedElement);
      }
    }

    // Add the element itself
    toKeepInteractiveSet.add(el);
    // Add all its ancestors up to document.body
    let ancestor = el.parentNode;
    while (ancestor && ancestor !== document.body) {
      toKeepInteractiveSet.add(ancestor);
      ancestor = ancestor.parentNode;
    }
  };

  // Build set of elements to keep interactive
  for (const element of elements) {
    keepSelfAndAncestors(element);
  }
  // backdrop elements are meant to control interactions happening at document level
  // and should stay interactive
  const backdropElements = document.querySelectorAll("[data-backdrop]");
  for (const backdropElement of backdropElements) {
    keepSelfAndAncestors(backdropElement);
  }

  const setInert = (el) => {
    if (toKeepInteractiveSet.has(el)) {
      // element should stay interactive
      return;
    }
    const restoreAttributes = setAttributes(el, {
      inert: "",
    });
    cleanupCallbackSet.add(() => {
      restoreAttributes();
    });
  };

  const makeElementInertSelectivelyOrCompletely = (el) => {
    // If this element should stay interactive, keep it active
    if (toKeepInteractiveSet.has(el)) {
      return;
    }

    // Since we put all ancestors in toKeepInteractiveSet, if this element
    // is not in the set, we can check if any of its direct children are.
    // If none of the direct children are in the set, then no descendants are either.
    const children = Array.from(el.children);
    const hasInteractiveChildren = children.some((child) =>
      toKeepInteractiveSet.has(child),
    );

    if (!hasInteractiveChildren) {
      // No interactive descendants, make the entire element inert
      setInert(el);
      return;
    }

    // Some children need to stay interactive, process them selectively
    for (const child of children) {
      makeElementInertSelectivelyOrCompletely(child);
    }
  };

  // Apply inert to all top-level elements that aren't in our keep-interactive set
  const bodyChildren = Array.from(document.body.children);
  for (const child of bodyChildren) {
    makeElementInertSelectivelyOrCompletely(child);
  }

  return () => {
    cleanup();
  };
};

installImportMetaCssBuild(import.meta);/**
 * Drag Gesture System
 *
 * TODO: rename moveX/moveY en juste x/y
 * puisque move c'est perturbant sachant que c'est drag + scroll
 * et que drag c'est juste la partie mouvement de la souris
 *
 * donc juste x/y ca seras surement mieux
 *
 */
const css$5 = /* css */`
  .navi_drag_gesture_backdrop {
    position: fixed;
    inset: 0;
    /* A finger dragging must not also pan the page under it. The backdrop is
       the only element the finger can be over once the gesture is running. */
    touch-action: none;
    user-select: none;
  }
  /* Chrome matches :focus-visible on a programmatic focus, so focusing what the
     gesture holds draws a ring around an object the user already has under the
     pointer — a frame blinking for the length of the gesture, saying something
     the finger knows. The ring stays whole where it earns its place: at the
     keyboard, outside any gesture.
     focus({ focusVisible: false }) would say the intent better but does not
     hold — Chrome's heuristic does not always obey the option (see
     isMatchingFocusVisible). */
  [data-drag-focus]:focus-visible {
    outline: none;
  }
`;
import.meta.css = [css$5, "@jsenv/dom/src/interaction/drag/drag_gesture.js"];

/*
 * Who asked for the capture of a pointer, last. This module is the only place
 * that ever takes one, so the answer says whether a capture that goes was HANDED
 * OVER — somebody here took it — or simply LET GO OF by the browser, which does
 * that on its own more often than the specification suggests, in the middle of a
 * gesture whose hand is still down and still moving.
 *
 * The two must not be answered the same way, and nothing in the event tells them
 * apart: `lostpointercapture` says the same thing either way.
 */
const captureHolderByPointerId = new Map();
const createDragGestureController = (options = {}) => {
  const {
    name,
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    threshold = 5,
    direction: defaultDirection = {
      x: true,
      y: true
    },
    documentInteractions = "auto",
    backdrop = true,
    backdropZIndex = 999999
  } = options;
  const dragGestureController = {
    grab: null,
    gravViaPointer: null
  };
  const grab = ({
    element,
    direction = defaultDirection,
    event = new CustomEvent("programmatic"),
    grabX = 0,
    grabY = 0,
    cursor = "grabbing",
    scrollContainer = document.documentElement,
    layoutScrollableLeft: scrollableLeftAtGrab = 0,
    layoutScrollableTop: scrollableTopAtGrab = 0
  } = {}) => {
    if (!element) {
      throw new Error("element is required");
    }
    if (!direction.x && !direction.y) {
      return null;
    }
    const [publishBeforeDrag, addBeforeDragCallback] = createPubSub();
    const [publishDrag, addDragCallback] = createPubSub();
    const [publishRelease, addReleaseCallback] = createPubSub();
    if (onDrag) {
      addDragCallback(onDrag);
    }
    if (onRelease) {
      addReleaseCallback(onRelease);
    }
    const scrollLeftAtGrab = scrollContainer.scrollLeft;
    const scrollTopAtGrab = scrollContainer.scrollTop;
    const leftAtGrab = scrollLeftAtGrab + scrollableLeftAtGrab;
    const topAtGrab = scrollTopAtGrab + scrollableTopAtGrab;
    const createLayout = (x, y) => {
      const {
        scrollLeft,
        scrollTop
      } = scrollContainer;
      const left = scrollableLeftAtGrab + x;
      const top = scrollableTopAtGrab + y;
      const scrollableLeft = left - scrollLeft;
      const scrollableTop = top - scrollTop;
      const layoutProps = {
        // Raw input coordinates (dragX - grabX + scrollContainer.scrollLeft)
        x,
        y,
        // container scrolls when layout is created
        scrollLeft,
        scrollTop,
        // Position relative to container excluding scrolls
        scrollableLeft,
        scrollableTop,
        // Position relative to container including scrolls
        left,
        top,
        // Delta since grab (number representing how much we dragged)
        xDelta: left - leftAtGrab,
        yDelta: top - topAtGrab
      };
      return layoutProps;
    };
    const grabLayout = createLayout(grabX + scrollContainer.scrollLeft, grabY + scrollContainer.scrollTop);
    const gestureInfo = {
      name,
      direction,
      started: !threshold,
      status: "grabbed",
      element,
      scrollContainer,
      grabX,
      // x grab coordinate (excluding scroll)
      grabY,
      // y grab coordinate (excluding scroll)
      grabLayout,
      leftAtGrab,
      topAtGrab,
      dragX: grabX,
      // coordinate of the last drag (excluding scroll of the scrollContainer)
      dragY: grabY,
      // coordinate of the last drag (excluding scroll of the scrollContainer)
      layout: grabLayout,
      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,
      intentGoingUp: false,
      intentGoingDown: false,
      intentGoingLeft: false,
      intentGoingRight: false,
      // How fast the pointer is going, in px/ms, signed per axis
      // (see measureVelocity)
      velocityX: 0,
      velocityY: 0,
      velocity: 0,
      // metadata about interaction sources
      grabEvent: event,
      dragEvent: null,
      releaseEvent: null,
      // The gesture ended without the hand ever letting go: the browser took
      // the touch to scroll with, another gesture took the pointer. Whoever
      // reads it must not commit anything — a release that was not asked for
      // says nothing about where things belong.
      cancelled: false
    };
    definePropertyAsReadOnly(gestureInfo, "name");
    definePropertyAsReadOnly(gestureInfo, "direction");
    definePropertyAsReadOnly(gestureInfo, "scrollContainer");
    definePropertyAsReadOnly(gestureInfo, "grabX");
    definePropertyAsReadOnly(gestureInfo, "grabY");
    definePropertyAsReadOnly(gestureInfo, "grabLayout");
    definePropertyAsReadOnly(gestureInfo, "leftAtGrab");
    definePropertyAsReadOnly(gestureInfo, "topAtGrab");
    definePropertyAsReadOnly(gestureInfo, "grabEvent");

    // Where the pointer IS is not where it is going: throwing something is a
    // matter of speed, and the gesture is the only place that sees the timing of
    // the events it receives.
    const measureVelocity = createVelocityMeter(grabX, grabY);
    document_interactions: {
      if (documentInteractions === "manual") {
        break document_interactions;
      }
      /*
      GOAL: Take control of document-level interactions during drag gestures
      
      WHY: During drag operations, we need to prevent conflicting user interactions that would:
      1. Interfere with the drag gesture (competing pointer events, focus changes)
      2. Break the visual feedback (inconsistent cursors, hover states)
      3. Cause unwanted scrolling (keyboard shortcuts, wheel events in restricted directions)
      4. Create accessibility issues (focus jumping, screen reader confusion)
       STRATEGY: Create a controlled interaction environment by:
      1. VISUAL CONTROL: Use a backdrop to unify cursor appearance and block pointer events
      2. INTERACTION ISOLATION: Make non-dragged elements inert to prevent interference
      3. FOCUS MANAGEMENT: Control focus location and prevent focus changes during drag
      4. SELECTIVE SCROLLING: Allow scrolling only in directions supported by the drag gesture
       IMPLEMENTATION:
      */

      // 1. INTERACTION ISOLATION: Make everything except the dragged element inert
      // This prevents keyboard events, pointer interactions, and screen reader navigation
      // on non-relevant elements during the drag operation
      const cleanupInert = isolateInteractions([element, ...Array.from(document.querySelectorAll("[data-droppable]"))]);
      addReleaseCallback(() => {
        cleanupInert();
      });

      // 2. VISUAL CONTROL: Backdrop for consistent cursor and pointer event blocking
      if (backdrop) {
        const backdropElement = document.createElement("div");
        backdropElement.className = "navi_drag_gesture_backdrop";
        backdropElement.ariaHidden = "true";
        backdropElement.setAttribute("data-backdrop", "");
        backdropElement.style.zIndex = backdropZIndex;
        backdropElement.style.cursor = cursor;

        // Handle wheel events on backdrop for directionally-constrained drag gestures
        // (e.g., table column resize should only allow horizontal scrolling)
        if (!direction.x || !direction.y) {
          backdropElement.onwheel = e => {
            e.preventDefault();
            const scrollX = direction.x ? e.deltaX : 0;
            const scrollY = direction.y ? e.deltaY : 0;
            scrollContainer.scrollBy({
              left: scrollX,
              top: scrollY,
              behavior: "auto"
            });
          };
        }
        document.body.appendChild(backdropElement);
        addReleaseCallback(() => {
          backdropElement.remove();
        });
      }

      // 3. FOCUS MANAGEMENT: Control and stabilize focus during drag
      const {
        activeElement
      } = document;
      const focusableElement = findFocusable(element);
      // Focus the dragged element (or document.body as fallback) to establish clear focus context
      // This also ensure any keydown event listened by the currently focused element
      // won't be available during drag
      const elementToFocus = focusableElement || document.body;
      elementToFocus.setAttribute("data-drag-focus", "");
      elementToFocus.focus({
        preventScroll: true
      });
      addReleaseCallback(() => {
        elementToFocus.removeAttribute("data-drag-focus");
        // Restore original focus on release
        activeElement.focus({
          preventScroll: true
        });
      });
      // Prevent Tab navigation entirely (focus should stay stable)
      const onkeydown = e => {
        if (e.key === "Tab") {
          e.preventDefault();
          return;
        }
      };
      document.addEventListener("keydown", onkeydown);
      addReleaseCallback(() => {
        document.removeEventListener("keydown", onkeydown);
      });

      // 4. SELECTIVE SCROLLING: Allow keyboard scrolling only in supported directions
      {
        const onDocumentKeydown = keyboardEvent => {
          // Vertical scrolling keys - prevent if vertical movement not supported
          if (keyboardEvent.key === "ArrowUp" || keyboardEvent.key === "ArrowDown" || keyboardEvent.key === " " || keyboardEvent.key === "PageUp" || keyboardEvent.key === "PageDown" || keyboardEvent.key === "Home" || keyboardEvent.key === "End") {
            if (!direction.y) {
              keyboardEvent.preventDefault();
            }
            return;
          }
          // Horizontal scrolling keys - prevent if horizontal movement not supported
          if (keyboardEvent.key === "ArrowLeft" || keyboardEvent.key === "ArrowRight") {
            if (!direction.x) {
              keyboardEvent.preventDefault();
            }
            return;
          }
        };
        document.addEventListener("keydown", onDocumentKeydown);
        addReleaseCallback(() => {
          document.removeEventListener("keydown", onDocumentKeydown);
        });
      }
    }

    // Set up scroll event handling to adjust drag position when scrolling occurs
    {
      let isHandlingScroll = false;
      const handleScroll = scrollEvent => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;
        drag(gestureInfo.dragX, gestureInfo.dragY, {
          event: scrollEvent
        });
        isHandlingScroll = false;
      };
      const scrollEventReceiver = scrollContainer === document.documentElement ? document : scrollContainer;
      scrollEventReceiver.addEventListener("scroll", handleScroll, {
        passive: true
      });
      addReleaseCallback(() => {
        scrollEventReceiver.removeEventListener("scroll", handleScroll, {
          passive: true
        });
      });
    }
    const determineDragData = ({
      dragX,
      dragY,
      dragEvent,
      isRelease = false
    }) => {
      // === ÉTAT INITIAL (au moment du grab) ===
      const {
        grabX,
        grabY,
        grabLayout
      } = gestureInfo;
      // === CE QUI EST DEMANDÉ (où on veut aller) ===
      // Calcul de la direction basé sur le mouvement précédent
      // (ne tient pas compte du mouvement final une fois les contraintes appliquées)
      // (ici on veut connaitre l'intention)
      // on va utiliser cela pour savoir vers où on scroll si nécéssaire par ex
      const currentDragX = gestureInfo.dragX;
      const currentDragY = gestureInfo.dragY;
      const isGoingLeft = dragX < currentDragX;
      const isGoingRight = dragX > currentDragX;
      const isGoingUp = dragY < currentDragY;
      const isGoingDown = dragY > currentDragY;
      const layoutXRequested = direction.x ? scrollContainer.scrollLeft + (dragX - grabX) : grabLayout.scrollLeft;
      const layoutYRequested = direction.y ? scrollContainer.scrollTop + (dragY - grabY) : grabLayout.scrollTop;
      const layoutRequested = createLayout(layoutXRequested, layoutYRequested);
      const currentLayout = gestureInfo.layout;
      let layout;
      if (layoutRequested.x === currentLayout.x && layoutRequested.y === currentLayout.y) {
        layout = currentLayout;
      } else {
        // === APPLICATION DES CONTRAINTES ===
        let layoutConstrained = layoutRequested;
        const limitLayout = (left, top) => {
          layoutConstrained = createLayout(left === undefined ? layoutConstrained.x : left - scrollableLeftAtGrab, top === undefined ? layoutConstrained.y : top - scrollableTopAtGrab);
        };
        publishBeforeDrag(layoutRequested, currentLayout, limitLayout, {
          dragEvent,
          isRelease
        });
        // === ÉTAT FINAL ===
        layout = layoutConstrained;
      }
      const dragData = {
        dragX,
        dragY,
        layout,
        isGoingLeft,
        isGoingRight,
        isGoingUp,
        isGoingDown,
        status: isRelease ? "released" : "dragging",
        dragEvent: isRelease ? gestureInfo.dragEvent : dragEvent,
        releaseEvent: isRelease ? dragEvent : null
      };
      if (isRelease) {
        return dragData;
      }
      if (!gestureInfo.started && threshold) {
        const deltaX = Math.abs(dragX - grabX);
        const deltaY = Math.abs(dragY - grabY);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return dragData;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return dragData;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return dragData;
          }
        }
        dragData.started = true;
      }
      return dragData;
    };
    const markAsStarted = () => {
      const clickSuppressionIsOver = suppressClickAfterGesture();
      addReleaseCallback(clickSuppressionIsOver);
      // Everything this gesture puts on the document is in place, and undoable,
      // BEFORE anybody is told it started: a listener may end the gesture from
      // inside this very notification — that is how a press becomes a drag (see
      // dragAfterIntent, where the gesture that measured the distance releases
      // itself the moment it is confirmed). Set up afterwards, a listener would
      // be registering its own removal with a gesture that is already over, and
      // would then outlive it: what one sees is a click swallowed long after
      // the drag it belonged to.
      dispatchPublicCustomEvent(element, "navi_drag_start", {
        gestureInfo
      });
      onDragStart?.(gestureInfo);
    };

    // Declares the gesture confirmed without waiting for the distance threshold,
    // for callers who established the intent some other way (a dedicated handle,
    // a long press).
    const start = () => {
      if (gestureInfo.started) {
        return;
      }
      gestureInfo.started = true;
      markAsStarted();
    };
    const drag = (dragX = gestureInfo.dragX,
    // Scroll container relative X coordinate
    dragY = gestureInfo.dragY,
    // Scroll container relative Y coordinate
    {
      event = new CustomEvent("programmatic"),
      isRelease = false
    } = {}) => {
      const dragData = determineDragData({
        dragX,
        dragY,
        dragEvent: event,
        isRelease
      });
      const [velocityX, velocityY] = measureVelocity(dragX, dragY);
      const startedPrevious = gestureInfo.started;
      const layoutPrevious = gestureInfo.layout;
      // previousGestureInfo = { ...gestureInfo };
      Object.assign(gestureInfo, dragData);
      gestureInfo.velocityX = velocityX;
      gestureInfo.velocityY = velocityY;
      gestureInfo.velocity = Math.hypot(velocityX, velocityY);
      if (gestureInfo.isGoingDown) {
        gestureInfo.intentGoingDown = true;
        gestureInfo.intentGoingUp = false;
      } else if (gestureInfo.isGoingUp) {
        gestureInfo.intentGoingUp = true;
        gestureInfo.intentGoingDown = false;
      }
      if (gestureInfo.isGoingRight) {
        gestureInfo.intentGoingRight = true;
        gestureInfo.intentGoingLeft = false;
      } else if (gestureInfo.isGoingLeft) {
        gestureInfo.intentGoingLeft = true;
        gestureInfo.intentGoingRight = false;
      }
      if (!startedPrevious && gestureInfo.started) {
        markAsStarted();
      }
      const someLayoutChange = gestureInfo.layout !== layoutPrevious;
      dispatchPublicCustomEvent(element, "navi_drag", {
        gestureInfo,
        someLayoutChange
      });
      publishDrag(gestureInfo,
      // we still publish drag event even when unchanged
      // because UI might need to adjust when document scrolls
      // even if nothing truly changes visually the element
      // can decide to stick to the scroll for example
      someLayoutChange);
    };
    const release = ({
      event = new CustomEvent("programmatic"),
      cancelled = event.type === "pointercancel",
      releaseX = gestureInfo.dragX,
      releaseY = gestureInfo.dragY
    } = {}) => {
      // Written before the last drag is reported, so the callbacks reading the
      // end of the gesture all see the same one.
      gestureInfo.cancelled = cancelled;
      drag(releaseX, releaseY, {
        event,
        isRelease: true
      });
      dispatchPublicCustomEvent(element, "navi_drag_release", {
        gestureInfo
      });
      publishRelease(gestureInfo);
    };
    dispatchPublicCustomEvent(element, "navi_drag_grab", {
      gestureInfo
    });
    onGrab?.(gestureInfo);
    const dragGesture = {
      gestureInfo,
      addBeforeDragCallback,
      addDragCallback,
      addReleaseCallback,
      start,
      drag,
      release
    };
    return dragGesture;
  };
  dragGestureController.grab = grab;
  const initDragByPointer = (grabEvent, dragOptions, initializer) => {
    if (!isPrimaryButtonEvent(grabEvent)) {
      return null;
    }
    const target = grabEvent.target;
    if (!target.closest) {
      // target is a text node
      return null;
    }
    const mouseEventCoords = mouseEvent => {
      const {
        clientX,
        clientY
      } = mouseEvent;
      return [clientX, clientY];
    };
    const [grabX, grabY] = mouseEventCoords(grabEvent);
    const dragGesture = dragGestureController.grab({
      grabX,
      grabY,
      event: grabEvent,
      ...dragOptions
    });
    const dragViaPointer = dragEvent => {
      const [mouseDragX, mouseDragY] = mouseEventCoords(dragEvent);
      dragGesture.drag(mouseDragX, mouseDragY, {
        event: dragEvent
      });
    };
    const releaseViaPointer = (pointerEvent, {
      cancelled
    } = {}) => {
      const [mouseReleaseX, mouseReleaseY] = mouseEventCoords(pointerEvent);
      dragGesture.release({
        event: pointerEvent,
        cancelled,
        releaseX: mouseReleaseX,
        releaseY: mouseReleaseY
      });
    };
    dragGesture.dragViaPointer = dragViaPointer;
    dragGesture.releaseViaPointer = releaseViaPointer;
    /*
     * A press that starts a drag is not a press that starts a selection: the
     * browser sees a pointer going down on text and moving, and that is its
     * own gesture — the words under the finger turn blue while the element
     * travels, and the selection outlives the release.
     *
     * Refused from the grab, before any threshold: whether the press becomes a
     * drag is decided a few pixels later, but the selection is decided at the
     * FIRST move, and by then it is too late to say no.
     *
     * `user-select: none` would say it in CSS, but it would say it to
     * everybody: the element would stop being selectable even when nobody is
     * dragging it. Here it is refused for the length of one gesture.
     */
    const preventSelectStart = selectStartEvent => {
      selectStartEvent.preventDefault();
    };
    document.addEventListener("selectstart", preventSelectStart);
    // A press also puts an end to the selection the page was already holding,
    // the way the browser's own press does: refusing selectstart keeps a new
    // selection from being made, it says nothing about the one painted before
    // — which would otherwise sit there through a gesture that has nothing to
    // do with it.
    collapseSelection();
    dragGesture.addReleaseCallback(() => {
      document.removeEventListener("selectstart", preventSelectStart);
    });
    /*
     * Refusing every selection also refuses the ones a press is entitled to
     * make: a double click selects the word under it, a triple click the
     * paragraph around it, and both are over before the pointer has gone
     * anywhere. They are made here instead, spelled out (see
     * selectWordAtPoint, selectParagraphAtPoint) rather than left to a browser
     * heuristic that cannot tell a drag from a click.
     *
     * Read from `click` rather than `dblclick`, because a triple click has no
     * event of its own: what tells the clicks apart is `detail`, the count the
     * browser keeps of how many presses landed in the same place in a row — 2
     * for a word, 3 and beyond for a paragraph (a fourth click keeps the
     * paragraph, the way the browser does).
     *
     * On the document and outliving the gesture, because the gesture is
     * already over when the second click completes: click comes after mouseup,
     * the gesture ends at pointerup. Kept installed after it fires, since the
     * click that selects a word is also the one the next click turns into a
     * paragraph; it goes when the next press installs its own — a listener
     * waiting for a click that never comes costs nothing until then.
     */
    removePendingMultiClickListener();
    const onClick = clickEvent => {
      const clickCount = clickEvent.detail;
      if (clickCount < 2) {
        return;
      }
      // A drag that happened is a gesture, not a click: the second press of a
      // double click can be the one that drags, and what it drags must not end
      // up selected too.
      if (dragGesture.gestureInfo.started) {
        return;
      }
      // Only the clicks that continue THIS press: the listener outlives the
      // gesture and the page keeps being clicked elsewhere, where the browser
      // is doing its own selecting — a second opinion there would only fight
      // it.
      const clickTarget = clickEvent.target;
      if (clickTarget !== grabEvent.target && !clickTarget.contains(grabEvent.target)) {
        return;
      }
      // Text the page says is not selectable stays not selectable: a
      // programmatic selection goes through `user-select: none` in every
      // engine — it is a rule about what the USER may start, and the browser
      // does not read it back when asked directly. Read here so that doing the
      // browser's work does not also undo what the page asked of it.
      if (!isSelectable(clickEvent.target)) {
        return;
      }
      if (clickCount === 2) {
        selectWordAtPoint(clickEvent.clientX, clickEvent.clientY);
        return;
      }
      selectParagraphAtPoint(clickEvent.clientX, clickEvent.clientY);
    };
    document.addEventListener("click", onClick);
    removePendingMultiClickListener = () => {
      removePendingMultiClickListener = NOOP;
      document.removeEventListener("click", onClick);
    };
    const cleanup = initializer({
      onMove: dragViaPointer,
      onRelease: releaseViaPointer,
      gestureInfo: dragGesture.gestureInfo,
      dragGesture
    });
    dragGesture.addReleaseCallback(() => {
      cleanup();
    });
    return dragGesture;
  };
  const grabViaPointer = (grabEvent, options) => {
    if (grabEvent.type === "pointerdown") {
      return initDragByPointer(grabEvent, options, ({
        onMove,
        onRelease,
        gestureInfo,
        dragGesture
      }) => {
        // Captured on something that will still be there at the end of the
        // gesture: the browser releases the capture when its element leaves the
        // document, and a gesture whose own effect replaces the DOM under the
        // finger would lose the pointer at its first move. Callers whose target
        // is stable have nothing to say and keep it.
        const target = options?.pointerCaptureElement || grabEvent.target;
        // The capture is ONE per pointer for the whole document: taking it is
        // taking it away from whoever had it, who is then told the exact same
        // thing it is told when its own gesture ends. So it is taken when this
        // gesture is established and not a moment earlier — for most callers
        // that is the grab itself (the intent was settled before, by a handle
        // or a long press), and for a caller that is still deciding what the
        // press means, it is whenever it says so (see capturePointer).
        let captured = false;
        dragGesture.capturePointer = () => {
          captured = true;
          // Written down before it is taken: this is the only place a capture
          // is ever taken from, so what this map says is who asked for it
          // last — which is what tells a hand-over from a capture the browser
          // dropped on its own (see onCaptureLost).
          captureHolderByPointerId.set(grabEvent.pointerId, dragGesture);
          target.setPointerCapture(grabEvent.pointerId);
        };
        if (!options?.pointerCaptureDeferred) {
          dragGesture.capturePointer();
        }
        /*
         * A touchmove left alone is the browser deciding the touch belongs to
         * it: it takes it to scroll with, and a touch it has taken is a pointer
         * stream it CANCELS — the gesture dies mid-move, the finger is still
         * down, and nothing reads it anymore.
         *
         * Refused only once the gesture is established (a `touch-action: none`
         * would take the touch from everyone who merely brushes past the
         * element), but LISTENED FOR from the grab: whether a touchmove can be
         * refused at all is decided when the touch begins, from the listeners
         * present at that moment. Registered later, the listener is handed
         * events that are already `cancelable: false` — refusing them does
         * nothing, and the reason is invisible in the code that refuses.
         *
         * On the window in capture AND on the grabbed element: a touch keeps
         * being dispatched at the node it started on, and a gesture may take
         * that node out of the document (a page that travels navigates) — from
         * then on the event never passes through the window on its way
         * anywhere.
         */
        const preventTouchScroll = touchMoveEvent => {
          if (gestureInfo.started && touchMoveEvent.cancelable) {
            touchMoveEvent.preventDefault();
          }
        };
        const grabTarget = grabEvent.target;
        window.addEventListener("touchmove", preventTouchScroll, {
          passive: false,
          capture: true
        });
        grabTarget.addEventListener("touchmove", preventTouchScroll, {
          passive: false
        });
        // Only OUR capture ending is this gesture's business:
        // lostpointercapture bubbles, so a descendant giving up its own capture
        // walks straight into this listener. That is not a rare shape — it is
        // exactly what happens when a gesture hands over to another one (a
        // press that becomes a drag releases its intermediate gesture, held on
        // the pressed element, while the real one is being held on a container
        // above it), and taken as our own it kills the new gesture one
        // millisecond after it started.
        //
        // And when it IS ours, it is a loss and never an end: the ends a
        // gesture has are the pointer going up and the pointer being
        // cancelled, both listened for below. What a loss MEANS is the
        // question, and the event does not answer it — two very different
        // things arrive as the same one:
        //
        // - it was HANDED OVER: another gesture took the pointer, or the
        //   element it was held on left the document. There is nothing to go
        //   on with, and what was being carried must go back rather than land
        //   wherever the hand happened to be.
        // - it was simply LET GO OF by the browser, with the hand still down
        //   and still moving. It happens, and not rarely: the capture is a
        //   guarantee that events keep coming to one element, and the browser
        //   drops it for reasons of its own that no code here can see. Killing
        //   the gesture for that is dropping an object mid-air — the copy
        //   vanishes, the place the hint had lit up is thrown away, and the
        //   hand is left having done nothing.
        //
        // They are told apart by who asked (see captureHolderByPointerId): a
        // capture nobody here took, on an element still in the document, was
        // let go of. The gesture does not need it — every move and the release
        // are read at the WINDOW, not at the element — so it goes on.
        const onCaptureLost = pointerEvent => {
          if (!captured || pointerEvent.target !== target) {
            return;
          }
          const handedOver = captureHolderByPointerId.get(grabEvent.pointerId) !== dragGesture;
          if (!handedOver && target.isConnected) {
            // Nobody took it and the element it was held on is still there:
            // the browser let the capture go by itself, which it does — a
            // node moved by a re-render and put straight back, a decision of
            // its own we are not told the reason for. The hand has not let go
            // of anything, so neither does the gesture: it is a guarantee that
            // was lost, not the gesture. Every move and the release are read
            // at the window (see below), so it goes on without it rather than
            // dropping what is still being carried — and the drop the hand was
            // aiming at, which the hint had already lit up, still happens.
            captured = false;
            return;
          }
          onRelease(pointerEvent, {
            cancelled: true
          });
        };
        target.addEventListener("lostpointercapture", onCaptureLost);
        target.addEventListener("pointercancel", onRelease);
        target.addEventListener("pointerup", onRelease);
        // Read from the window rather than from the element while the pointer
        // is not this gesture's: without a capture a move is delivered to
        // whatever is under the pointer, and a hand that has left the element
        // is exactly the hand this gesture is trying to make sense of. The
        // capture phase reaches the window before anything else, captured or
        // not, so there is one place to read whichever way the gesture ends up.
        const onPointerMove = pointerEvent => {
          if (pointerEvent.pointerId !== grabEvent.pointerId) {
            return;
          }
          onMove(pointerEvent);
        };
        window.addEventListener("pointermove", onPointerMove, true);
        // The end of the pointer is also listened for on the window, because
        // the end is the one event a gesture cannot afford to miss and the
        // element it is captured on is not always on its way: a pointer can
        // be delivered somewhere else entirely (a browser view transition
        // sends presses to the document root), and a cancel dispatched there
        // never passes through this element. Missed, the gesture never ends —
        // whatever it was holding stays held.
        let released = false;
        const onPointerEnd = pointerEvent => {
          if (pointerEvent.pointerId !== grabEvent.pointerId || released) {
            return;
          }
          released = true;
          onRelease(pointerEvent);
        };
        window.addEventListener("pointerup", onPointerEnd, true);
        window.addEventListener("pointercancel", onPointerEnd, true);
        return () => {
          // Listeners first, capture last: giving the pointer back is the
          // one thing here that can throw, and a gesture that fails to clean
          // up half way is worse than one that never cleaned up at all — its
          // listeners stay on the element and answer the NEXT gesture, from
          // a gesture whose pointer is long gone.
          window.removeEventListener("touchmove", preventTouchScroll, {
            capture: true
          });
          grabTarget.removeEventListener("touchmove", preventTouchScroll);
          target.removeEventListener("lostpointercapture", onCaptureLost);
          target.removeEventListener("pointercancel", onRelease);
          window.removeEventListener("pointermove", onPointerMove, true);
          target.removeEventListener("pointerup", onRelease);
          window.removeEventListener("pointerup", onPointerEnd, true);
          window.removeEventListener("pointercancel", onPointerEnd, true);
          // Only what this gesture took, and only while there is something to
          // give back: a capture on that element may be someone else's (two
          // gestures reading the same press hold the same node), and a pointer
          // that is up no longer exists — the browser has already dropped the
          // capture with it, and asking again throws ("No active pointer with
          // the given id is found") on the most ordinary release there is.
          if (captureHolderByPointerId.get(grabEvent.pointerId) === dragGesture) {
            captureHolderByPointerId.delete(grabEvent.pointerId);
          }
          if (captured && target.hasPointerCapture(grabEvent.pointerId)) {
            target.releasePointerCapture(grabEvent.pointerId);
          }
        };
      });
    }
    if (grabEvent.type === "mousedown") {
      console.warn(`Received "mousedown" event, "pointerdown" events are recommended to perform drag gestures.`);
      return initDragByPointer(grabEvent, options, ({
        onMove,
        onRelease
      }) => {
        const onPointerUp = pointerEvent => {
          // <button disabled> for example does not emit mouseup if we release mouse over it
          // -> we add "pointerup" to catch mouseup occuring on disabled element
          if (pointerEvent.pointerType === "mouse") {
            onRelease(pointerEvent);
          }
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onRelease);
        document.addEventListener("pointerup", onPointerUp);
        return () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onRelease);
          document.removeEventListener("pointerup", onPointerUp);
        };
      });
    }
    throw new Error(`Unsupported "${grabEvent.type}" evenet passed to grabViaPointer. "pointerdown" was expected.`);
  };
  dragGestureController.grabViaPointer = grabViaPointer;
  return dragGestureController;
};

// Only the primary button drags: a right click (or any secondary button) opens
// a context menu, it never grabs anything.
const isPrimaryButtonEvent = event => event.button === undefined || event.button === 0;

/*
 * Speed over the last VELOCITY_WINDOW_MS rather than between the last two
 * events: pointer events arrive irregularly, and the last one before a release
 * often repeats the previous coordinates — measured on that pair alone, every
 * throw would end at zero.
 * A pointer held still keeps producing samples at the same place, so the window
 * empties itself of movement and the speed falls back to zero on its own: put
 * down slowly is not thrown.
 */
const VELOCITY_WINDOW_MS = 100;
const createVelocityMeter = (grabX, grabY) => {
  const samples = [{
    time: performance.now(),
    x: grabX,
    y: grabY
  }];
  const measureVelocity = (x, y) => {
    const time = performance.now();
    samples.push({
      time,
      x,
      y
    });
    while (samples.length > 2 && time - samples[1].time > VELOCITY_WINDOW_MS) {
      samples.shift();
    }
    const oldestSample = samples[0];
    const elapsed = time - oldestSample.time;
    if (elapsed === 0) {
      return [0, 0];
    }
    return [(x - oldestSample.x) / elapsed, (y - oldestSample.y) / elapsed];
  };
  return measureVelocity;
};
const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName]
  });
};
const NOOP = () => {};
let removePendingMultiClickListener = NOOP;

// What a double click selects when the browser is allowed to do it itself: the
// word around the caret the click lands on.
const selectWordAtPoint = (x, y) => {
  const caretRange = createCaretRange(x, y);
  if (!caretRange) {
    return;
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(caretRange);
  // "word" is not a position a Range can be built from — it is a movement the
  // selection knows how to make, and the caret walking to both of its edges is
  // what draws the word.
  if (selection.modify) {
    selection.modify("move", "backward", "word");
    selection.modify("extend", "forward", "word");
  }
};

// What a triple click selects when the browser is allowed to do it itself: the
// paragraph around the caret the click lands on — in the DOM, the contents of
// the closest block the caret sits in.
//
// Drawn from the box tree rather than from `selection.modify("extend",
// "forward", "paragraph")`: "paragraph" is a granularity Gecko never
// implemented (it stops at word and line), so the modify route would select a
// line in Firefox and a paragraph in Chrome.
const selectParagraphAtPoint = (x, y) => {
  const caretRange = createCaretRange(x, y);
  if (!caretRange) {
    return;
  }
  const block = getClosestBlock(caretRange.startContainer);
  if (!block) {
    return;
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  const paragraphRange = document.createRange();
  paragraphRange.selectNodeContents(block);
  selection.addRange(paragraphRange);
};
const getClosestBlock = node => {
  let element = node.nodeType === 1 ? node : node.parentElement;
  while (element) {
    const {
      display
    } = window.getComputedStyle(element);
    // Everything that is not laid out as a line inside another line: the first
    // ancestor that breaks the flow is the one whose text reads as a paragraph
    // of its own.
    if (!display.startsWith("inline") && display !== "contents") {
      return element;
    }
    element = element.parentElement;
  }
  return null;
};
const createCaretRange = (x, y) => {
  if (document.caretPositionFromPoint) {
    const caretPosition = document.caretPositionFromPoint(x, y);
    if (!caretPosition) {
      return null;
    }
    const range = document.createRange();
    range.setStart(caretPosition.offsetNode, caretPosition.offset);
    range.collapse(true);
    return range;
  }
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }
  return null;
};
const isSelectable = element => {
  if (!element || element.nodeType !== 1) {
    return true;
  }
  const computedStyle = window.getComputedStyle(element);
  const userSelect = computedStyle.userSelect || computedStyle.webkitUserSelect;
  return userSelect !== "none";
};
const collapseSelection = () => {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    selection.removeAllRanges();
  }
};

installImportMetaCssBuild(import.meta);/**
 * When a press becomes a drag.
 *
 * A pointer going down on a draggable element is ambiguous — it may be a click,
 * a text selection, a scroll, or a drag — and starting the gesture right away
 * would steal all the others. This module picks which signal resolves the
 * ambiguity for the pointer at hand, and only then hands over to the real
 * gesture.
 *
 * There is one gesture, with a trigger per pointer:
 * - a dedicated handle ([data-drag-handle]) says it outright: drag on contact
 * - a mouse resolves it by distance — a mouse scrolls with its wheel, so travel
 *   can only mean drag
 * - a finger resolves it by time — travel is exactly what a scroll looks like,
 *   so the only unambiguous signal left is a finger that does NOT move
 *
 * Whichever trigger fired, it has established the intent: the gesture then
 * starts at the first pixel, without a second threshold to cross.
 *
 * WHEN A FINGER MAY TRAVEL TOO: [data-drag-on-contact].
 *
 * The wait a finger is asked for is not a rule about fingers, it is the answer to
 * an ambiguity — travel means scroll as much as it means drag, so the two have to
 * be told apart. Where nothing scrolls the ambiguity does not exist, and the wait
 * is asking the hand to prove something nothing else could have meant: inside a
 * dialog that holds the page still, a finger travelling on a piece can only be
 * carrying it.
 *
 * So the attribute says that place, not that element — put on the dialog, every
 * source inside it reads by distance like a mouse does, at the same few pixels.
 * A tap is left alone by that: a press that goes nowhere is still a press, which
 * is what a piece that is also a link or a card needs.
 *
 * It is opt-in and cannot be anything else. Nothing here can see whether the
 * surroundings scroll — a page scrolls by default, an overflow is one CSS
 * property away, and getting it wrong the wrong way means the list runs away
 * under the finger that meant to reorder it. Only the application knows it has
 * taken the scroll away.
 */

/* At module scope, and on the markers rather than on the pressed element: both
   rules below have to be true BEFORE the finger lands — a stylesheet, never a
   line of JS in the pointerdown.

   -webkit-touch-callout: iOS shows its callout (Copy / Look Up) and selects the
   text under the finger on a long press, and does not always route that through
   an event that can be refused — see preventContextMenu below for the half that
   is an event.

   touch-action: a touchmove can only be refused if the region was out of the
   compositor's fast path when the touch BEGAN (see preventTouchScroll in
   drag_gesture.js, which does the refusing). Left at `auto`, Chrome has already
   decided the touch is its own by the time a long press turns into a grab, and
   every preventDefault from then on is a "Unable to preventDefault inside
   passive event listener" intervention — on Android, a scroll that runs away
   with the object. Any explicit value other than `auto` is enough: `pan-y` still
   lets the page scroll and still makes the refusal effective — provided the
   listener that will refuse is already known too, which is markDragSource's
   half of the same rule. */
const css$4 = /* css */`
  [data-drag-handle],
  [data-drag-source] {
    -webkit-touch-callout: none;
  }
  [data-drag-handle] {
    /* A dedicated handle has nothing to share: it takes the gesture on contact. */
    touch-action: none;
  }
  [data-drag-source] {
    /* A source taken by long press must let the scroll through until the grab —
       which is exactly what the long press is there to tell apart. Zoom has
       nothing to do with the gesture and nobody should lose it by resting a
       finger on a word.

       Vertical, because that is the way the page and the lists in it go: a
       source dragged along one axis is surrounded by something scrolling along
       that same axis (a row of a list runs the way the list scrolls), and a
       source dragged both ways sits on the usual vertical page. */
    touch-action: pan-y pinch-zoom;
  }
  [data-drag-source="x"] {
    /* …and the sideways one, for the same reason read the other way. */
    touch-action: pan-x pinch-zoom;
  }
  [data-drag-on-contact] [data-drag-source],
  [data-drag-source][data-drag-on-contact] {
    /* Nothing scrolls here, so there is no pan to leave to anyone — the finger
       may travel from the first pixel. Zoom is kept: it belongs to the reader,
       not to the gesture, and two fingers are never a drag. */
    touch-action: pinch-zoom;
  }
  [data-drag-ignore] {
    -webkit-touch-callout: default;
    touch-action: auto;
  }
`;
import.meta.css = [css$4, "@jsenv/dom/src/interaction/drag/drag_after_intent.js"];

/*
 * A press that may become a drag has to be refusable before anyone knows it is
 * one. WHETHER a touchmove can be refused at all is decided when the touch
 * BEGINS, from the non-passive listeners the browser knows about at that
 * moment — and on the long press path the gesture, which is what refuses it
 * (see preventTouchScroll in drag_gesture.js), is only born once the wait is
 * over. Put down from the pointerdown it is already too late: every touchmove
 * handed over is `cancelable: false`, the refusal does nothing, and the page
 * scrolls away with the object still under the finger — until the touch is
 * taken for a scroll and the pointer stream is cancelled, which is the drag
 * dying mid-gesture, released where it stood.
 *
 * So it goes down with the element, next to the attribute the stylesheet above
 * reads: same rule, same moment. It refuses nothing itself — a press that is
 * still only a press must leave the scroll alone, which is exactly what the wait
 * is there to tell apart. Being there is the whole of it.
 *
 * On the element and not on the window, so the rest of the page keeps its
 * touches on the compositor's fast path.
 *
 * Exported because a drag does not always begin on a drag source: a copy caught
 * on its way home is pressed through the pictures of a view transition, and the
 * touch lands on the document root (see letCopyBeCaught in drag_to.js). Same
 * rule, other element — and it has to be the same function, or the listener put
 * down is not the one taken back off.
 */
const keepTouchRefusable = () => {
  // Being registered IS the whole of it — see above.
};

/**
 * Says an element is something a drag can start from, and which way that drag
 * goes.
 *
 * The axes are written in the DOM rather than kept here because they are what
 * someone ELSE reads: a box above this one that travels under the same finger
 * (a row of slides, a sheet pushed down to close it) has to know which axes are
 * already spoken for before it answers the press — the same thing a travel says
 * about itself with `data-travel-by-drag`. It is also what leaves the browser
 * the pan it may still do until the grab (see the stylesheet above).
 *
 * @param {Element} element
 * @param {"x"|"y"|"xy"} [axes="xy"]
 *   Which way the drag walks. A list reordered along its own line says `"y"`;
 *   something carried across a board, or thrown, goes both ways.
 * @returns {function} Takes the mark back off.
 */
const markDragSource = (element, axes = "xy") => {
  element.setAttribute("data-drag-source", axes);
  element.addEventListener("touchmove", keepTouchRefusable, {
    passive: false
  });
  return () => {
    element.removeAttribute("data-drag-source");
    element.removeEventListener("touchmove", keepTouchRefusable);
  };
};

/**
 * Waits for the user to mean it, then starts a drag gesture.
 *
 * @param {PointerEvent} grabEvent
 *   The `pointerdown` event that may become a drag.
 * @param {function} dragGestureInitializer
 *   Called once the intent is established; must create and return the real drag
 *   gesture (typically via `grabViaPointer(grabEvent)`). Returning a falsy value
 *   aborts the gesture.
 * @param {object} [options]
 * @param {number} [options.threshold=5]
 *   Distance (px) the pointer must travel to start a drag, when the trigger is
 *   distance-based.
 * @param {boolean|"if-touch"} [options.longPress="if-touch"]
 *   Which pointers start a drag by holding still instead of by travelling.
 *   `"if-touch"` excepts what stands inside a `[data-drag-on-contact]`, where
 *   nothing scrolls and a finger resolves by distance like a mouse.
 * @param {number} [options.longPressDelay=400]
 *   How long (ms) the pointer must stay down. Kept under the system context-menu
 *   delay so the object is picked up before the menu would have opened.
 * @param {number} [options.longPressSlop=8]
 *   How far (px) the pointer may drift during the wait before the press is
 *   abandoned — beyond it, the finger is scrolling, not holding.
 * @param {function} [options.onPressStart]
 *   The pointer went down and the wait began (a cue that the press counts).
 * @param {function} [options.onPressCancel]
 *   The pointer moved or lifted before the wait was over.
 * @param {function} [options.onPress]
 *   The wait completed and the object is now held (haptics, scale…).
 */
const dragAfterIntent = (grabEvent, dragGestureInitializer, {
  threshold = 5,
  longPress = "if-touch",
  longPressDelay = 400,
  longPressSlop = 8,
  onPressStart,
  onPressCancel,
  onPress
} = {}) => {
  if (!isPrimaryButtonEvent(grabEvent)) {
    return;
  }
  const target = grabEvent.target;
  const isDedicatedHandle = target.closest && target.closest("[data-drag-handle]");
  if (isDedicatedHandle) {
    startDragGesture(dragGestureInitializer);
    return;
  }
  const startsOnLongPress = longPress === true || longPress === "if-touch" && grabEvent.pointerType === "touch" &&
  // The wait tells a scroll from a drag, and here there is no scroll to tell
  // it from — see [data-drag-on-contact] at the top of this file.
  !(target.closest && target.closest("[data-drag-on-contact]"));
  if (startsOnLongPress) {
    dragAfterLongPress(grabEvent, dragGestureInitializer, {
      longPressDelay,
      longPressSlop,
      onPressStart,
      onPressCancel,
      onPress
    });
    return;
  }
  dragAfterDistance(grabEvent, dragGestureInitializer, threshold);
};
const startDragGesture = (dragGestureInitializer, catchUpEvent) => {
  const dragGesture = dragGestureInitializer();
  if (!dragGesture) {
    return null;
  }
  // The wait is what established the intent; a distance threshold on top of it
  // would ask the user to prove the same thing twice.
  dragGesture.start();
  if (catchUpEvent) {
    dragGesture.dragViaPointer(catchUpEvent);
  }
  return dragGesture;
};
const dragAfterDistance = (grabEvent, dragGestureInitializer, threshold) => {
  const significantDragGestureController = createDragGestureController({
    threshold,
    // allow interaction for this intermediate gesture:
    // user should still be able to scroll or interact with the document
    // only once the gesture is significant we take control
    documentInteractions: "manual",
    onDragStart: gestureInfo => {
      significantDragGesture.release(); // kill that gesture
      startDragGesture(dragGestureInitializer, gestureInfo.dragEvent);
    }
  });
  const significantDragGesture = significantDragGestureController.grabViaPointer(grabEvent, {
    element: grabEvent.target,
    // This one owns nothing: it measures a distance to find out whether there
    // is a gesture at all, and it is over the moment there is. Taking the
    // pointer for that would take it from whoever is already holding this same
    // element for a gesture of their own — and giving it back at the threshold
    // would tell them theirs is over.
    pointerCaptureDeferred: true
  });
};
const dragAfterLongPress = (grabEvent, dragGestureInitializer, {
  longPressDelay,
  longPressSlop,
  onPressStart,
  onPressCancel,
  onPress
}) => {
  /*
   * Nothing is done here to keep the touch refusable: whether it can be refused
   * at all was settled when the finger landed, from what the element already
   * carried (see markDragSource). Scrolling is then taken away by the gesture
   * itself, from the moment it starts (see preventTouchScroll in
   * drag_gesture.js) — one place refuses the touchmove, for every way a drag can
   * begin.
   */
  waitForPressHeld(grabEvent, {
    delay: longPressDelay,
    slop: longPressSlop,
    onPressStart,
    onPressCancel,
    onPressHeld: (pressEvent, {
      endPress
    }) => {
      onPress?.(pressEvent);
      const dragGesture = startDragGesture(dragGestureInitializer);
      if (!dragGesture) {
        endPress();
        return;
      }
      dragGesture.addReleaseCallback(() => {
        endPress();
      });
    }
  });
};

/**
 * The element `element` is genuinely `position: absolute`/`fixed` relative
 * to: its own nearest positioned ancestor (walking up the DOM tree), or
 * `document.documentElement` (the viewport) if none is found.
 *
 * Also aware of `element` itself being promoted to the top layer: a
 * `<dialog>` actually shown modally (`showModal()`, matches `:modal` — a
 * `.show()`'d, non-modal dialog does NOT match and is positioned like any
 * other in-flow element instead, walked up normally below), or *any*
 * `[popover]` element, always uses the initial containing block (the
 * viewport) regardless of its own `position` or DOM ancestry — walking up
 * its own parent chain (what the rest of this function does) would give
 * the wrong answer for these two specifically, since their real DOM
 * position becomes irrelevant to their own containing block the moment
 * they're actually promoted. Checked via the `popover` attribute itself,
 * not the live `:popover-open` state — unlike `<dialog>`, a `[popover]`
 * element has no "local" mode: it's always top-layer-bound once shown,
 * regardless of whether it happens to be open right this moment, so the
 * static attribute alone is enough (and correct even when called just
 * before `showPopover()` actually runs, when `:popover-open` isn't true
 * yet).
 *
 * `document.documentElement` (not `document.body`, not `null`) is this
 * function's own "no real container — use the viewport" sentinel:
 * `documentElement` is the actual initial containing block, so the walk
 * below stops there without testing its own `position` (there's nothing
 * beyond it to fall back to anyway) — unlike the previous version of this
 * function, which stopped one level too early, at `document.body`, without
 * ever testing *its* `position` either (a `position: relative` body, for
 * instance, would have been silently skipped). Returning `documentElement`
 * instead of `null` also means no special-casing is needed by callers that
 * already compare a resolved container against `document.documentElement`
 * (see e.g. visible_rect.js's own `hasRealContainer` check).
 */
const getPositionedParent = (element) => {
  const isPromotedToTopLayer =
    (element.tagName === "DIALOG" && element.matches(":modal")) ||
    element.hasAttribute("popover");
  if (isPromotedToTopLayer) {
    return document.documentElement;
  }
  let parent = element.parentElement;
  while (parent && parent !== document.documentElement) {
    const position = window.getComputedStyle(parent).position;
    if (
      position === "relative" ||
      position === "absolute" ||
      position === "fixed"
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.documentElement;
};

/**
 * Walks `element` and its ancestors (stopping at, but not including,
 * `document.documentElement`) looking for the first one whose *computed*
 * `position` is `fixed` — i.e. pinned to the viewport, ignoring document
 * scroll, regardless of what `element` itself is positioned relative to.
 *
 * @param {Element} element
 * @returns {[left: number, top: number] | null} The fixed ancestor's own
 *   viewport-relative `getBoundingClientRect()` origin, or `null` if neither
 *   `element` nor any ancestor is fixed (i.e. `element` genuinely scrolls
 *   with the document).
 */
const findSelfOrAncestorFixedPosition = (element) => {
  let current = element;
  while (true) {
    const computedStyle = window.getComputedStyle(current);
    if (computedStyle.position === "fixed") {
      const { left, top } = current.getBoundingClientRect();
      return [left, top];
    }
    current = current.parentElement;
    if (!current || current === document.documentElement) {
      break;
    }
  }
  return null;
};

/**
 * Creates a coordinate system positioner for drag operations.
 *
 * PURPOSE:
 * During a drag gesture, the system tracks mouse movement as "scrollable coordinates"
 * relative to the scroll container. This function converts those coordinates into
 * the actual CSS transform values needed to visually move an element (or a separate
 * elementToMove) to follow the mouse.
 *
 * PARAMETERS:
 * - element:          The element being grabbed / tracked for drag detection and auto-scroll.
 * - referenceElement: Optional. The element whose coordinate system defines the input space.
 *                     When provided, scrollable coords are relative to its scroll container.
 *                     Defaults to element itself.
 * - elementToMove:    Optional. A different element to apply the transform to (e.g. a clone
 *                     or a table that moves as a whole when a column is dragged).
 *                     When provided, its offsetParent is used as the positioning context.
 *
 * THE COORDINATE PIPELINE:
 *
 *   Mouse position
 *     → scrollable coords  (relative to referenceScrollContainer, scroll-independent)
 *     → positioned coords  (relative to elementToMove's offsetParent, for CSS transform)
 *
 * Two types of offsets bridge these spaces:
 *
 * 1. POSITION OFFSETS (getPositionOffsets):
 *    Compensate for the fact that positionedParent and referencePositionedParent
 *    may differ. For example, if `element` lives inside a <table> and `elementToMove`
 *    is a full table clone, their offsetParents are different elements.
 *    This offset is the spatial difference between those two positioned ancestors.
 *    Called dynamically because parents can move (e.g. overlay elements).
 *
 * 2. SCROLL OFFSETS (getScrollOffsets):
 *    Account for the scroll position of the relevant scroll container(s).
 *    The math ensures that at grab time, the transform delta is zero (element
 *    stays at its visual position), and subsequent mouse movement maps 1:1
 *    to transform change.
 *
 *    CRITICAL CASE — positionedParent outside referenceScrollContainer:
 *    When elementToMove's offsetParent is NOT inside the referenceScrollContainer
 *    (e.g. a clone appended to document.body while tracking an element inside
 *    an overflow:auto div), the scroll offset must be FROZEN at grab time.
 *    Using a live scroll value would double-move the clone during auto-scroll:
 *    the scrollable coordinate decreases (element appears to move up) AND the
 *    live scroll value increases — both applied to the same transform.
 *    Freezing the scroll at grab time cancels this out while still correctly
 *    placing the clone at the right initial position.
 *
 * KEY SCENARIOS SUPPORTED:
 * 1. Same positioned parent, same scroll container        — minimal offsets
 * 2. Different positioned parents, same scroll container  — position offset compensation
 * 3. Same positioned parent, different scroll containers  — scroll offset bridging
 * 4. Different positioned parents, different containers   — full offset compensation
 * 5. Overlay elements (data-overlay-for)                  — specialized offset path
 * 6. Fixed positioned elements                            — special scroll handling
 * 7. elementToMove outside referenceScrollContainer       — frozen scroll offset at grab
 *
 * API CONTRACT:
 * Returns [scrollableLeft, scrollableTop, convertScrollablePosition] where:
 *
 * - scrollableLeft/scrollableTop:
 *   The element's current position in the reference coordinate system at grab time.
 *   Used as the layout starting point (layoutScrollableLeft/Top) by the gesture system.
 *
 * - convertScrollablePosition(scrollableLeft, scrollableTop):
 *   Converts a scrollable coordinate (from the gesture layout) into a positioned
 *   coordinate suitable for CSS transform. The gesture system computes:
 *     topDelta = convertScrollablePosition(layout.scrollableTop) - topAtGrab
 *   and applies that as translateY. At grab time, delta = 0. As the mouse moves,
 *   delta tracks the movement exactly, regardless of scroll context differences.
 */
const createDragElementPositioner = (
  element,
  referenceElement,
  elementToMove,
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  // getPositionedParent, not raw .offsetParent — offsetParent is null for a
  // position: fixed element, and also for one promoted to the top layer
  // (e.g. a <dialog>/[popover] being dragged by its own handle), which
  // crashes the fixed-position lookup below (findSelfOrAncestorFixedPosition
  // assumes a real starting element, not null). getPositionedParent never
  // returns null (document.documentElement instead — see its own doc).
  const positionedParent = getPositionedParent(elementToMove || element);
  const scrollContainer = getScrollContainer(element);
  const [getPositionOffsets, getScrollOffsets] = createGetOffsets({
    positionedParent,
    referencePositionedParent: referenceElement
      ? getPositionedParent(referenceElement)
      : positionedParent,
    scrollContainer,
    referenceScrollContainer: referenceElement
      ? getScrollContainer(referenceElement)
      : scrollContainer,
  });

  {
    [scrollableLeft, scrollableTop] = getScrollablePosition(
      element,
      scrollContainer,
    );
    const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
    scrollableLeft += positionOffsetLeft;
    scrollableTop += positionOffsetTop;
  }
  {
    convertScrollablePosition = (
      scrollableLeftToConvert,
      scrollableTopToConvert,
    ) => {
      const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
      const [scrollOffsetLeft, scrollOffsetTop] = getScrollOffsets();

      const positionedLeftWithoutScroll =
        scrollableLeftToConvert + positionOffsetLeft;
      const positionedTopWithoutScroll =
        scrollableTopToConvert + positionOffsetTop;
      const positionedLeft = positionedLeftWithoutScroll + scrollOffsetLeft;
      const positionedTop = positionedTopWithoutScroll + scrollOffsetTop;

      return [positionedLeft, positionedTop];
    };
  }
  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};

const getScrollablePosition = (element, scrollContainer) => {
  const { left: elementViewportLeft, top: elementViewportTop } =
    element.getBoundingClientRect();
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    return [elementViewportLeft, elementViewportTop];
  }
  const { left: scrollContainerLeft, top: scrollContainerTop } =
    scrollContainer.getBoundingClientRect();
  const scrollableLeft = elementViewportLeft - scrollContainerLeft;
  const scrollableTop = elementViewportTop - scrollContainerTop;

  return [scrollableLeft, scrollableTop];
};

const createGetOffsets = ({
  positionedParent,
  referencePositionedParent,
  scrollContainer,
  referenceScrollContainer,
}) => {
  const samePositionedParent = positionedParent === referencePositionedParent;
  const getScrollOffsets = createGetScrollOffsets(
    scrollContainer,
    referenceScrollContainer,
    positionedParent,
    samePositionedParent,
  );

  if (samePositionedParent) {
    return [() => [0, 0], getScrollOffsets];
  }

  // parents are different, oh boy let's go
  // The overlay case is problematic because the overlay adjust its position to the target dynamically
  // This creates something complex to support properly.
  // When overlay is fixed we there will never be any offset
  // When overlay is absolute there is a diff relative to the scroll
  // and eventually if the overlay is positioned differently than the other parent
  if (isOverlayOf(positionedParent, referencePositionedParent)) {
    return createGetOffsetsForOverlay(
      positionedParent,
      referencePositionedParent,
      {
        scrollContainer,
        referenceScrollContainer,
        getScrollOffsets,
      },
    );
  }
  if (isOverlayOf(referencePositionedParent, positionedParent)) {
    return createGetOffsetsForOverlay(
      referencePositionedParent,
      positionedParent,
      {
        scrollContainer,
        referenceScrollContainer,
        getScrollOffsets,
      },
    );
  }
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    // Document case: getBoundingClientRect already includes document scroll effects
    // Add current scroll position to get the static offset
    const getPositionOffsetsDocumentScrolling = () => {
      const { scrollLeft: documentScrollLeft, scrollTop: documentScrollTop } =
        scrollContainer;
      const aRect = positionedParent.getBoundingClientRect();
      const bRect = referencePositionedParent.getBoundingClientRect();
      const aLeft = aRect.left;
      const aTop = aRect.top;
      const bLeft = bRect.left;
      const bTop = bRect.top;
      const aLeftDocument = documentScrollLeft + aLeft;
      const aTopDocument = documentScrollTop + aTop;
      const bLeftDocument = documentScrollLeft + bLeft;
      const bTopDocument = documentScrollTop + bTop;
      const offsetLeft = bLeftDocument - aLeftDocument;
      const offsetTop = bTopDocument - aTopDocument;
      return [offsetLeft, offsetTop];
    };
    return [getPositionOffsetsDocumentScrolling, getScrollOffsets];
  }
  // Custom scroll container case: account for container's position and scroll
  const getPositionOffsetsCustomScrollContainer = () => {
    const aRect = positionedParent.getBoundingClientRect();
    const bRect = referencePositionedParent.getBoundingClientRect();
    const aLeft = aRect.left;
    const aTop = aRect.top;
    const bLeft = bRect.left;
    const bTop = bRect.top;

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const offsetLeft =
      bLeft - aLeft + scrollContainer.scrollLeft - scrollContainerRect.left;
    const offsetTop =
      bTop - aTop + scrollContainer.scrollTop - scrollContainerRect.top;
    return [offsetLeft, offsetTop];
  };
  return [getPositionOffsetsCustomScrollContainer, getScrollOffsets];
};
const createGetOffsetsForOverlay = (
  overlay,
  overlayTarget,
  { scrollContainer, referenceScrollContainer, getScrollOffsets },
) => {
  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const referenceScrollContainerIsDocument =
    referenceScrollContainer === documentElement;

  if (getComputedStyle(overlay).position === "fixed") {
    if (referenceScrollContainerIsDocument) {
      const getPositionOffsetsFixedOverlay = () => {
        return [0, 0];
      };
      return [getPositionOffsetsFixedOverlay, getScrollOffsets];
    }
    const getPositionOffsetsFixedOverlay = () => {
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      const referenceScrollContainerRect =
        referenceScrollContainer.getBoundingClientRect();
      let offsetLeftBetweenScrollContainers =
        referenceScrollContainerRect.left - scrollContainerRect.left;
      let offsetTopBetweenScrollContainers =
        referenceScrollContainerRect.top - scrollContainerRect.top;
      if (scrollContainerIsDocument) {
        offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
        offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
      }
      return [
        -offsetLeftBetweenScrollContainers,
        -offsetTopBetweenScrollContainers,
      ];
    };
    return [getPositionOffsetsFixedOverlay, getScrollOffsets];
  }

  const getPositionOffsetsOverlay = () => {
    if (sameScrollContainer) {
      const overlayRect = overlay.getBoundingClientRect();
      const overlayTargetRect = overlayTarget.getBoundingClientRect();
      const overlayLeft = overlayRect.left;
      const overlayTop = overlayRect.top;
      let overlayTargetLeft = overlayTargetRect.left;
      let overlayTargetTop = overlayTargetRect.top;
      if (scrollContainerIsDocument) {
        overlayTargetLeft += scrollContainer.scrollLeft;
        overlayTargetTop += scrollContainer.scrollTop;
      }
      const offsetLeftBetweenTargetAndOverlay = overlayTargetLeft - overlayLeft;
      const offsetTopBetweenTargetAndOverlay = overlayTargetTop - overlayTop;
      return [
        -scrollContainer.scrollLeft + offsetLeftBetweenTargetAndOverlay,
        -scrollContainer.scrollTop + offsetTopBetweenTargetAndOverlay,
      ];
    }

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();
    let scrollContainerLeft = scrollContainerRect.left;
    let scrollContainerTop = scrollContainerRect.top;
    let referenceScrollContainerLeft = referenceScrollContainerRect.left;
    let referenceScrollContainerTop = referenceScrollContainerRect.top;
    if (scrollContainerIsDocument) {
      scrollContainerLeft += scrollContainer.scrollLeft;
      scrollContainerTop += scrollContainer.scrollTop;
    }
    const offsetLeftBetweenScrollContainers =
      referenceScrollContainerLeft - scrollContainerLeft;
    const offsetTopBetweenScrollContainers =
      referenceScrollContainerTop - scrollContainerTop;
    return [
      -offsetLeftBetweenScrollContainers - referenceScrollContainer.scrollLeft,
      -offsetTopBetweenScrollContainers - referenceScrollContainer.scrollTop,
    ];
  };
  const getScrollOffsetsOverlay = () => {
    if (sameScrollContainer) {
      return [scrollContainer.scrollLeft, scrollContainer.scrollTop];
    }

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();
    let offsetLeftBetweenScrollContainers =
      referenceScrollContainerRect.left - scrollContainerRect.left;
    let offsetTopBetweenScrollContainers =
      referenceScrollContainerRect.top - scrollContainerRect.top;
    if (scrollContainerIsDocument) {
      offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
      offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
    }

    return [
      referenceScrollContainer.scrollLeft + offsetLeftBetweenScrollContainers,
      referenceScrollContainer.scrollTop + offsetTopBetweenScrollContainers,
    ];
  };
  return [getPositionOffsetsOverlay, getScrollOffsetsOverlay];
};
const isOverlayOf = (element, potentialTarget) => {
  const overlayForAttribute = element.getAttribute("data-overlay-for");
  if (!overlayForAttribute) {
    return false;
  }
  const overlayTarget = document.querySelector(`#${overlayForAttribute}`);
  if (!overlayTarget) {
    return false;
  }
  if (overlayTarget === potentialTarget) {
    return true;
  }
  const overlayTargetPositionedParent = getPositionedParent(overlayTarget);
  if (overlayTargetPositionedParent === potentialTarget) {
    return true;
  }
  return false;
};

const { documentElement } =
  typeof document === "object" ? document : { documentElement: null };

const createGetScrollOffsets = (
  scrollContainer,
  referenceScrollContainer,
  positionedParent,
  samePositionedParent,
) => {
  const getGetScrollOffsetsSameContainer = () => {
    const scrollContainerIsDocument = scrollContainer === documentElement;
    // I don't really get why we have to add scrollLeft (scrollLeft at grab)
    // to properly position the element in this scenario
    // It happens since we use translateX to position the element
    // Or maybe since something else. In any case it works
    const { scrollLeft, scrollTop } = samePositionedParent
      ? { scrollLeft: 0, scrollTop: 0 }
      : referenceScrollContainer;
    if (scrollContainerIsDocument) {
      const fixedPosition = findSelfOrAncestorFixedPosition(positionedParent);
      if (fixedPosition) {
        const getScrollOffsetsFixed = () => {
          const leftScrollToAdd = scrollLeft + fixedPosition[0];
          const topScrollToAdd = scrollTop + fixedPosition[1];
          return [leftScrollToAdd, topScrollToAdd];
        };
        return getScrollOffsetsFixed;
      }
    }
    const positionedParentIsInsideScrollContainer =
      referenceScrollContainer === documentElement ||
      referenceScrollContainer.contains(positionedParent);
    if (!positionedParentIsInsideScrollContainer) {
      // positionedParent is outside the scroll container (e.g. clone in document.body
      // while tracking an element inside a custom scroll container).
      // We must add the scroll at grab time as a frozen offset so that:
      // - initial topDelta = 0 (clone starts at correct position)
      // - auto-scroll doesn't double-move the clone (scroll changes cancel out in layout)
      const scrollLeftAtGrab = referenceScrollContainer.scrollLeft;
      const scrollTopAtGrab = referenceScrollContainer.scrollTop;
      return () => [scrollLeft + scrollLeftAtGrab, scrollTop + scrollTopAtGrab];
    }
    const getScrollOffsets = () => {
      const leftScrollToAdd = scrollLeft + referenceScrollContainer.scrollLeft;
      const topScrollToAdd = scrollTop + referenceScrollContainer.scrollTop;
      return [leftScrollToAdd, topScrollToAdd];
    };
    return getScrollOffsets;
  };

  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const getScrollOffsetsSameContainer = getGetScrollOffsetsSameContainer();
  if (sameScrollContainer) {
    return getScrollOffsetsSameContainer;
  }
  const getScrollOffsetsDifferentContainers = () => {
    const [scrollLeftToAdd, scrollTopToAdd] = getScrollOffsetsSameContainer();
    const rect = scrollContainer.getBoundingClientRect();
    const referenceRect = referenceScrollContainer.getBoundingClientRect();
    const leftDiff = referenceRect.left - rect.left;
    const topDiff = referenceRect.top - rect.top;
    return [scrollLeftToAdd + leftDiff, scrollTopToAdd + topDiff];
  };
  return getScrollOffsetsDifferentContainers;
};
const getDragCoordinates = (
  element,
  scrollContainer = getScrollContainer(element),
) => {
  const [scrollableLeft, scrollableTop] = getScrollablePosition(
    element,
    scrollContainer,
  );
  const { scrollLeft, scrollTop } = scrollContainer;
  const leftRelativeToScrollContainer = scrollableLeft + scrollLeft;
  const topRelativeToScrollContainer = scrollableTop + scrollTop;
  return [leftRelativeToScrollContainer, topRelativeToScrollContainer];
};

installImportMetaCssBuild(import.meta);const css$3 = /* css */`
  .navi_constraint_feedback_line {
    position: fixed;
    z-index: 9998;
    border-top: 2px dotted rgba(59, 130, 246, 0.7);
    visibility: hidden;
    transform-origin: left center;
    transition: opacity 0.15s ease;
    pointer-events: none;
  }

  .navi_constraint_feedback_line[data-visible] {
    visibility: visible;
  }
`;
const setupConstraintFeedbackLine = () => {
  import.meta.css = [css$3, "@jsenv/dom/src/interaction/drag/constraint_feedback_line.js"];
  const constraintFeedbackLine = createConstraintFeedbackLine();

  // Track last known mouse position for constraint feedback line during scroll
  let lastMouseX = null;
  let lastMouseY = null;

  // Internal function to update constraint feedback line
  const onDrag = gestureInfo => {
    const {
      grabEvent,
      dragEvent
    } = gestureInfo;
    if (grabEvent.type === "programmatic" ||
    // dragEvent can be null when only mousedown without yet any mousemove
    !dragEvent || dragEvent.type === "programmatic") {
      // programmatic drag
      return;
    }
    const mouseX = dragEvent.clientX;
    const mouseY = dragEvent.clientY;
    // Use last known position if current position not available (e.g., during scroll)
    const effectiveMouseX = mouseX !== null ? mouseX : lastMouseX;
    const effectiveMouseY = mouseY !== null ? mouseY : lastMouseY;
    if (effectiveMouseX === null || effectiveMouseY === null) {
      return;
    }

    // Store current mouse position for potential use during scroll
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    const grabClientX = grabEvent.clientX;
    const grabClientY = grabEvent.clientY;

    // Calculate distance between mouse and current grab point
    const deltaX = effectiveMouseX - grabClientX;
    const deltaY = effectiveMouseY - grabClientY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    // Show line only when distance is significant (> 20px threshold)
    const threshold = 20;
    if (distance <= threshold) {
      constraintFeedbackLine.style.opacity = "";
      constraintFeedbackLine.removeAttribute("data-visible");
      return;
    }

    // Calculate angle and position
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    // Position line at current grab point (follows element movement)
    constraintFeedbackLine.style.left = `${grabClientX}px`;
    constraintFeedbackLine.style.top = `${grabClientY}px`;
    constraintFeedbackLine.style.width = `${distance}px`;
    constraintFeedbackLine.style.transform = `rotate(${angle}deg)`;
    // Fade in based on distance (more visible as distance increases)
    const maxOpacity = 0.8;
    const opacityFactor = Math.min((distance - threshold) / 100, 1);
    constraintFeedbackLine.style.opacity = `${maxOpacity * opacityFactor}`;
    constraintFeedbackLine.setAttribute("data-visible", "");
  };
  return {
    onDrag,
    onRelease: () => {
      constraintFeedbackLine.remove();
    }
  };
};
const createConstraintFeedbackLine = () => {
  const line = document.createElement("div");
  line.className = "navi_constraint_feedback_line";
  line.title = "Constraint feedback - shows distance between mouse and moving grab point";
  document.body.appendChild(line);
  return line;
};

installImportMetaCssBuild(import.meta);// Keep visual markers (debug markers, obstacle markers, constraint feedback line) in DOM after drag ends
const MARKER_SIZE = 12;
let currentDebugMarkers = [];
let currentConstraintMarkers = [];
let currentReferenceElementMarker = null;
let currentElementMarker = null;
const css$2 = /* css */`
  .navi_debug_markers_container {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 999998;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    overflow: hidden;
    --marker-size: ${MARKER_SIZE}px;
  }

  .navi_debug_marker {
    position: absolute;
    pointer-events: none;
  }

  /* Markers based on side rather than orientation */
  .navi_debug_marker[data-left],
  .navi_debug_marker[data-right] {
    width: var(--marker-size);
    height: 100vh;
  }

  .navi_debug_marker[data-top],
  .navi_debug_marker[data-bottom] {
    width: 100vw;
    height: var(--marker-size);
  }

  /* Gradient directions based on side, using CSS custom properties for color */
  .navi_debug_marker[data-left] {
    background: linear-gradient(
      to right,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-right] {
    background: linear-gradient(
      to left,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-top] {
    background: linear-gradient(
      to bottom,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-bottom] {
    background: linear-gradient(
      to top,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker_label {
    position: absolute;
    padding: 2px 6px;
    color: rgb(from var(--marker-color) r g b / 1);
    font-weight: bold;
    font-size: 12px;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid;
    border-color: rgb(from var(--marker-color) r g b / 1);
    border-radius: 3px;
    pointer-events: none;
  }

  /* Label positioning based on side data attributes */

  /* Left side markers - vertical with 90° rotation */
  .navi_debug_marker[data-left] .navi_debug_marker_label {
    top: 20px;
    left: 10px;
    transform: rotate(90deg);
    transform-origin: left center;
  }

  /* Right side markers - vertical with -90° rotation */
  .navi_debug_marker[data-right] .navi_debug_marker_label {
    top: 20px;
    right: 10px;
    left: auto;
    transform: rotate(-90deg);
    transform-origin: right center;
  }

  /* Top side markers - horizontal, label on the line */
  .navi_debug_marker[data-top] .navi_debug_marker_label {
    top: 0px;
    left: 20px;
  }

  /* Bottom side markers - horizontal, label on the line */
  .navi_debug_marker[data-bottom] .navi_debug_marker_label {
    top: auto;
    bottom: 0px;
    left: 20px;
  }

  .navi_obstacle_marker {
    position: absolute;
    z-index: 9999;
    background-color: orange;
    opacity: 0.6;
    pointer-events: none;
  }

  .navi_obstacle_marker_label {
    position: absolute;
    top: 50%;
    left: 50%;
    color: white;
    font-weight: bold;
    font-size: 12px;
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .navi_element_marker {
    position: absolute;
    z-index: 9997;
    background-color: var(--element-color-alpha, rgba(255, 0, 150, 0.3));
    border: 2px solid var(--element-color, rgb(255, 0, 150));
    opacity: 0.9;
    pointer-events: none;
  }

  .navi_element_marker_label {
    position: absolute;
    top: -25px;
    right: 0;
    padding: 2px 6px;
    color: var(--element-color, rgb(255, 0, 150));
    font-weight: bold;
    font-size: 11px;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid var(--element-color, rgb(255, 0, 150));
    border-radius: 3px;
    pointer-events: none;
  }

  .navi_reference_element_marker {
    position: absolute;
    z-index: 9998;
    background-color: rgba(0, 150, 255, 0.3);
    border: 2px dashed rgba(0, 150, 255, 0.7);
    opacity: 0.8;
    pointer-events: none;
  }

  .navi_reference_element_marker_label {
    position: absolute;
    top: -25px;
    left: 0;
    padding: 2px 6px;
    color: rgba(0, 150, 255, 1);
    font-weight: bold;
    font-size: 11px;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 150, 255, 0.7);
    border-radius: 3px;
    pointer-events: none;
  }
`;
const setupDragDebugMarkers = (dragGesture, {
  referenceElement
}) => {
  import.meta.css = [css$2, "@jsenv/dom/src/interaction/drag/drag_debug_markers.js"];

  // Clean up any existing persistent markers from previous drag gestures
  {
    // Remove any existing markers from previous gestures
    const container = document.getElementById("navi_debug_markers_container");
    if (container) {
      container.innerHTML = ""; // Clear all markers efficiently
    }
  }
  const {
    direction,
    scrollContainer
  } = dragGesture.gestureInfo;
  return {
    onConstraints: (constraints, {
      left,
      top,
      right,
      bottom,
      autoScrollArea
    }) => {
      // Schedule removal of previous markers if they exist
      const previousDebugMarkers = [...currentDebugMarkers];
      const previousConstraintMarkers = [...currentConstraintMarkers];
      const previousReferenceElementMarker = currentReferenceElementMarker;
      const previousElementMarker = currentElementMarker;
      if (previousDebugMarkers.length > 0 || previousConstraintMarkers.length > 0 || previousReferenceElementMarker || previousElementMarker) {
        setTimeout(() => {
          previousDebugMarkers.forEach(marker => marker.remove());
          previousConstraintMarkers.forEach(marker => marker.remove());
          if (previousReferenceElementMarker) {
            previousReferenceElementMarker.remove();
          }
          if (previousElementMarker) {
            previousElementMarker.remove();
          }
        }, 100);
      }

      // Clear current marker arrays
      currentDebugMarkers.length = 0;
      currentConstraintMarkers.length = 0;
      currentReferenceElementMarker = null;
      currentElementMarker = null;

      // Create element marker (always show the dragged element)
      // When there's a reference element, show it as "Dragged Element"
      // When there's no reference element, show it as "Element"
      const elementLabel = referenceElement ? "Dragged Element" : "Element";
      const elementColor = referenceElement ? "255, 0, 150" : "0, 200, 0"; // Pink when with reference, green when standalone

      currentElementMarker = createElementMarker({
        left,
        top,
        right,
        bottom,
        scrollContainer,
        label: elementLabel,
        color: elementColor
      });

      // Create reference element marker if reference element exists
      if (referenceElement) {
        currentReferenceElementMarker = createReferenceElementMarker({
          left,
          top,
          right,
          bottom,
          scrollContainer
        });
      }

      // Collect all markers to be created, then merge duplicates
      const markersToCreate = [];
      {
        if (direction.x) {
          markersToCreate.push({
            name: autoScrollArea.paddingLeft ? `autoscroll.left + padding(${autoScrollArea.paddingLeft})` : "autoscroll.left",
            x: autoScrollArea.left,
            y: 0,
            color: "0 128 0",
            // green
            side: "left"
          });
          markersToCreate.push({
            name: autoScrollArea.paddingRight ? `autoscroll.right + padding(${autoScrollArea.paddingRight})` : "autoscroll.right",
            x: autoScrollArea.right,
            y: 0,
            color: "0 128 0",
            // green
            side: "right"
          });
        }
        if (direction.y) {
          markersToCreate.push({
            name: autoScrollArea.paddingTop ? `autoscroll.top + padding(${autoScrollArea.paddingTop})` : "autoscroll.top",
            x: 0,
            y: autoScrollArea.top,
            color: "255 0 0",
            // red
            side: "top"
          });
          markersToCreate.push({
            name: autoScrollArea.paddingBottom ? `autoscroll.bottom + padding(${autoScrollArea.paddingBottom})` : "autoscroll.bottom",
            x: 0,
            y: autoScrollArea.bottom,
            color: "255 165 0",
            // orange
            side: "bottom"
          });
        }
      }

      // Process each constraint individually to preserve names
      for (const constraint of constraints) {
        if (constraint.type === "bounds") {
          const {
            bounds
          } = constraint;

          // Create individual markers for each bound with constraint name
          if (direction.x) {
            if (bounds.left !== undefined) {
              markersToCreate.push({
                name: `${constraint.name}.left`,
                x: bounds.left,
                y: 0,
                color: "128 0 128",
                // purple
                side: "left"
              });
            }
            if (bounds.right !== undefined) {
              // For visual clarity, show rightBound at the right edge of the element
              // when element is positioned at rightBound (not the left edge position)
              markersToCreate.push({
                name: `${constraint.name}.right`,
                x: bounds.right,
                y: 0,
                color: "128 0 128",
                // purple
                side: "right"
              });
            }
          }
          if (direction.y) {
            if (bounds.top !== undefined) {
              markersToCreate.push({
                name: `${constraint.name}.top`,
                x: 0,
                y: bounds.top,
                color: "128 0 128",
                // purple
                side: "top"
              });
            }
            if (bounds.bottom !== undefined) {
              // For visual clarity, show bottomBound at the bottom edge of the element
              // when element is positioned at bottomBound (not the left edge position)
              markersToCreate.push({
                name: `${constraint.name}.bottom`,
                x: 0,
                y: bounds.bottom,
                color: "128 0 128",
                // purple
                side: "bottom"
              });
            }
          }
        } else if (constraint.type === "obstacle") {
          const obstacleMarker = createObstacleMarker(constraint, scrollContainer);
          currentConstraintMarkers.push(obstacleMarker);
        }
      }

      // Create markers with merging for overlapping positions
      const createdMarkers = createMergedMarkers(markersToCreate, scrollContainer);
      currentDebugMarkers.push(...createdMarkers.filter(m => m.type !== "constraint"));
      currentConstraintMarkers.push(...createdMarkers.filter(m => m.type === "constraint"));
    },
    onRelease: () => {
      {
        return;
      }
    }
  };
};

// Ensure markers container exists and return it
const getMarkersContainer = () => {
  let container = document.getElementById("navi_debug_markers_container");
  if (!container) {
    container = document.createElement("div");
    container.id = "navi_debug_markers_container";
    container.className = "navi_debug_markers_container";
    document.body.appendChild(container);
  }
  return container;
};

// Convert document-relative coordinates to viewport coordinates for marker positioning
// Takes the scroll container into account for proper positioning relative to the container
const getDebugMarkerPos = (x, y, scrollContainer, side = null) => {
  const {
    documentElement
  } = document;
  const leftWithoutScroll = x - scrollContainer.scrollLeft;
  const topWithoutScroll = y - scrollContainer.scrollTop;
  let baseX;
  let baseY;
  if (scrollContainer === documentElement) {
    // our markers are injected into the document so we have the right coordinates already
    // and we remove scroll because our markers are in a fixed position ancestor (to ensure they cannot influence scrollbars)
    baseX = leftWithoutScroll;
    baseY = topWithoutScroll;
  } else {
    // we need to remove the scroll of the container?
    // not sure I think here we might want to keep the scroll container scroll
    // and that's it
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    baseX = scrollContainerRect.left + leftWithoutScroll;
    baseY = scrollContainerRect.top + topWithoutScroll;
  }

  // Apply side-specific logic for extending markers across viewport
  if (side === "left" || side === "right") {
    // Vertical markers: x should stay fixed in viewport, y can extend
    return [baseX, 0]; // y=0 to start from top of viewport
  }
  if (side === "top" || side === "bottom") {
    // Horizontal markers: y should stay fixed in viewport, x can extend
    return [0, baseY]; // x=0 to start from left of viewport
  }

  // For obstacles and other markers: use converted coordinates directly
  return [baseX, baseY];
};
const createMergedMarkers = (markersToCreate, scrollContainer) => {
  const mergedMarkers = [];
  const positionMap = new Map();

  // Group markers by position and side
  for (const marker of markersToCreate) {
    const key = `${marker.x},${marker.y},${marker.side}`;
    if (!positionMap.has(key)) {
      positionMap.set(key, []);
    }
    positionMap.get(key).push(marker);
  }

  // Create markers with merged labels for overlapping positions
  for (const [, markers] of positionMap) {
    if (markers.length === 1) {
      // Single marker - create as normal
      const marker = markers[0];
      const domMarker = createDebugMarker(marker, scrollContainer);
      domMarker.type = marker.name.includes("Bound") ? "constraint" : "visible";
      mergedMarkers.push(domMarker);
    } else {
      // Multiple markers at same position - merge labels
      const firstMarker = markers[0];
      const combinedName = markers.map(m => m.name).join(" + ");

      // Use the first marker's color, or mix colors if needed
      const domMarker = createDebugMarker({
        ...firstMarker,
        name: combinedName
      }, scrollContainer);
      domMarker.type = markers.some(m => m.name.includes("Bound")) ? "constraint" : "visible";
      mergedMarkers.push(domMarker);
    }
  }
  return mergedMarkers;
};
const createDebugMarker = ({
  name,
  x,
  y,
  color = "255 0 0",
  side
}, scrollContainer) => {
  // Convert coordinates from document-relative to viewport
  const [viewportX, viewportY] = getDebugMarkerPos(x, y, scrollContainer, side);
  const marker = document.createElement("div");
  marker.className = `navi_debug_marker`;
  marker.setAttribute(`data-${side}`, "");
  // Set the color as a CSS custom property
  marker.style.setProperty("--marker-color", `rgb(${color})`);
  // Position markers exactly at the boundary coordinates
  marker.style.left = side === "right" ? `${viewportX - MARKER_SIZE}px` : `${viewportX}px`;
  marker.style.top = side === "bottom" ? `${viewportY - MARKER_SIZE}px` : `${viewportY}px`;
  marker.title = name;

  // Add label
  const label = document.createElement("div");
  label.className = `navi_debug_marker_label`;
  label.textContent = name;
  marker.appendChild(label);
  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};
const createObstacleMarker = (obstacleObj, scrollContainer) => {
  const width = obstacleObj.bounds.right - obstacleObj.bounds.left;
  const height = obstacleObj.bounds.bottom - obstacleObj.bounds.top;

  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(obstacleObj.bounds.left, obstacleObj.bounds.top, scrollContainer, "obstacle");
  const marker = document.createElement("div");
  marker.className = "navi_obstacle_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = obstacleObj.name;

  // Add label
  const label = document.createElement("div");
  label.className = "navi_obstacle_marker_label";
  label.textContent = obstacleObj.name;
  marker.appendChild(label);
  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};
const createElementMarker = ({
  left,
  top,
  right,
  bottom,
  scrollContainer,
  label = "Element",
  color = "0, 200, 0" // Default green color
}) => {
  const width = right - left;
  const height = bottom - top;
  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(left, top, scrollContainer, "element");
  const marker = document.createElement("div");
  marker.className = "navi_element_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = label;

  // Set the color as CSS custom properties
  marker.style.setProperty("--element-color", `rgb(${color})`);
  marker.style.setProperty("--element-color-alpha", `rgba(${color}, 0.3)`);

  // Add label
  const labelEl = document.createElement("div");
  labelEl.className = "navi_element_marker_label";
  labelEl.textContent = label;
  marker.appendChild(labelEl);
  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};
const createReferenceElementMarker = ({
  left,
  top,
  right,
  bottom,
  scrollContainer
}) => {
  const width = right - left;
  const height = bottom - top;
  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(left, top, scrollContainer, "reference");
  const marker = document.createElement("div");
  marker.className = "navi_reference_element_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = "Reference Element";

  // Add label
  const label = document.createElement("div");
  label.className = "navi_reference_element_marker_label";
  label.textContent = "Reference Element";
  marker.appendChild(label);
  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};

const initDragConstraints = (
  dragGesture,
  {
    areaConstraint,
    obstaclesContainer,
    obstacleAttributeName,
    showConstraintFeedbackLine,
    showDebugMarkers,
    referenceElement,
  },
) => {
  const dragGestureName = dragGesture.gestureInfo.name;
  const direction = dragGesture.gestureInfo.direction;
  const scrollContainer = dragGesture.gestureInfo.scrollContainer;
  const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
  const topAtGrab = dragGesture.gestureInfo.topAtGrab;

  const constraintFunctions = [];
  const addConstraint = (constraint) => {
    constraintFunctions.push(constraint);
  };

  if (showConstraintFeedbackLine) {
    const constraintFeedbackLine = setupConstraintFeedbackLine();
    dragGesture.addDragCallback((gestureInfo) => {
      constraintFeedbackLine.onDrag(gestureInfo);
    });
    dragGesture.addReleaseCallback(() => {
      constraintFeedbackLine.onRelease();
    });
  }
  let dragDebugMarkers;
  if (showDebugMarkers) {
    dragDebugMarkers = setupDragDebugMarkers(dragGesture, {
      referenceElement,
    });
    dragGesture.addReleaseCallback(() => {
      dragDebugMarkers.onRelease();
    });
  }

  {
    const areaConstraintFunction = createAreaConstraint(areaConstraint, {
      scrollContainer,
    });
    if (areaConstraintFunction) {
      addConstraint(areaConstraintFunction);
    }
  }
  obstacles: {
    if (!obstacleAttributeName || !obstaclesContainer) {
      break obstacles;
    }
    const obstacleConstraintFunctions =
      createObstacleConstraintsFromQuerySelector(obstaclesContainer, {
        obstacleAttributeName,
        gestureInfo: dragGesture.gestureInfo,
        isDraggedElementSticky: false,
        // isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
      });
    for (const obstacleConstraintFunction of obstacleConstraintFunctions) {
      addConstraint(obstacleConstraintFunction);
    }
  }

  const applyConstraints = (
    layoutRequested,
    currentLayout,
    limitLayout,
    {
      elementWidth,
      elementHeight,
      scrollArea,
      scrollport,
      hasCrossedScrollportLeftOnce,
      hasCrossedScrollportTopOnce,
      autoScrollArea,
      dragEvent,
    },
  ) => {
    if (constraintFunctions.length === 0) {
      return;
    }

    const elementCurrentLeft = currentLayout.left;
    const elementCurrentTop = currentLayout.top;
    const elementLeftRequested = layoutRequested.left;
    const elementTopRequested = layoutRequested.top;
    let elementLeft = elementLeftRequested;
    let elementTop = elementTopRequested;

    const constraintInitParams = {
      leftAtGrab,
      topAtGrab,
      left: elementCurrentLeft,
      top: elementCurrentTop,
      right: elementCurrentLeft + elementWidth,
      bottom: elementCurrentTop + elementHeight,
      width: elementWidth,
      height: elementHeight,
      scrollContainer,
      scrollArea,
      scrollport,
      autoScrollArea,
      dragGestureName,
      dragEvent,
    };
    const constraints = constraintFunctions.map((fn) =>
      fn(constraintInitParams),
    );

    const logConstraintEnforcement = (axis, constraint) => {
      if (constraint.type === "bounds") {
        return;
      }
      if (constraint.type === "obstacle") {
        return;
      }
      const requested =
        axis === "x" ? elementLeftRequested : elementTopRequested;
      const constrained = axis === "x" ? elementLeft : elementTop;
      const action = constrained > requested ? "increased" : "capped";
      const property = axis === "x" ? "left" : "top";
      console.debug(
        `Drag by ${dragEvent.type}: ${property} ${action} from ${requested.toFixed(2)} to ${constrained.toFixed(2)} by ${constraint.type}:${constraint.name}`,
        constraint.element,
      );
    };

    // Apply each constraint in sequence, accumulating their effects
    // This allows multiple constraints to work together (e.g., bounds + obstacles)
    for (const constraint of constraints) {
      const result = constraint.apply({
        // each constraint works with scroll included coordinates
        // and coordinates we provide here includes the scroll of the container
        left: elementLeft,
        top: elementTop,
        right: elementLeft + elementWidth,
        bottom: elementTop + elementHeight,
        width: elementWidth,
        height: elementHeight,
        currentLeft: elementCurrentLeft,
        currentTop: elementCurrentTop,
        scrollport,
        hasCrossedScrollportLeftOnce,
        hasCrossedScrollportTopOnce,
      });
      if (!result) {
        continue;
      }
      const [elementLeftConstrained, elementTopConstrained] = result;
      if (direction.x && elementLeftConstrained !== elementLeft) {
        elementLeft = elementLeftConstrained;
        logConstraintEnforcement("x", constraint);
      }
      if (direction.y && elementTopConstrained !== elementTop) {
        elementTop = elementTopConstrained;
        logConstraintEnforcement("y", constraint);
      }
    }

    if (dragDebugMarkers) {
      dragDebugMarkers.onConstraints(constraints, {
        left: elementLeft,
        top: elementTop,
        right: elementLeft + elementWidth,
        bottom: elementTop + elementHeight,
        elementWidth,
        elementHeight,
        scrollport,
        autoScrollArea,
      });
    }

    const leftModified = elementLeft !== elementLeftRequested;
    const topModified = elementTop !== elementTopRequested;
    if (!leftModified && !topModified) {
      return;
    }

    limitLayout(elementLeft, elementTop);
  };

  return { applyConstraints };
};

const createAreaConstraint = (areaConstraint, { scrollContainer }) => {
  if (!areaConstraint || areaConstraint === "none") {
    return null;
  }
  if (areaConstraint === "scrollport") {
    const scrollportConstraintFunction = ({ scrollport }) => {
      return createBoundConstraint(scrollport, {
        element: scrollContainer,
        name: "scrollport",
      });
    };
    return scrollportConstraintFunction;
  }
  if (areaConstraint === "scroll") {
    const scrollAreaConstraintFunction = ({ scrollArea }) => {
      return createBoundConstraint(scrollArea, {
        element: scrollContainer,
        name: "scroll_area",
      });
    };
    return scrollAreaConstraintFunction;
  }
  if (typeof areaConstraint === "function") {
    const dynamicAreaConstraintFunction = (params) => {
      const bounds = areaConstraint(params);
      return createBoundConstraint(bounds, {
        name: "dynamic_area",
      });
    };
    return dynamicAreaConstraintFunction;
  }
  if (typeof areaConstraint === "object") {
    const { left, top, right, bottom } = areaConstraint;
    const turnSidePropertyInToGetter = (value, side) => {
      if (value === "scrollport") {
        return ({ scrollport }) => scrollport[side];
      }
      if (value === "scroll") {
        return ({ scrollArea }) => scrollArea[side];
      }
      if (typeof value === "function") {
        return value;
      }
      if (value === undefined) {
        // defaults to scrollport
        return ({ scrollport }) => scrollport[side];
      }
      return () => value;
    };
    const getLeft = turnSidePropertyInToGetter(left, "left");
    const getRight = turnSidePropertyInToGetter(right, "right");
    const getTop = turnSidePropertyInToGetter(top, "top");
    const getBottom = turnSidePropertyInToGetter(bottom, "bottom");

    const dynamicAreaConstraintFunction = (params) => {
      const bounds = {
        left: getLeft(params),
        right: getRight(params),
        top: getTop(params),
        bottom: getBottom(params),
      };
      return createBoundConstraint(bounds, {
        name: "dynamic_area",
      });
    };
    return dynamicAreaConstraintFunction;
  }
  console.warn(
    `Unknown areaConstraint value: ${areaConstraint}. Expected "scrollport", "scroll", "none", an object with boundary definitions, or a function returning boundary definitions.`,
  );
  return null;
};

const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { obstacleAttributeName, gestureInfo, isDraggedElementSticky = false },
) => {
  const dragGestureName = gestureInfo.name;
  const obstacles = scrollableElement.querySelectorAll(
    `[${obstacleAttributeName}]`,
  );
  const obstacleConstraintFunctions = [];
  for (const obstacle of obstacles) {
    if (obstacle.closest("[data-drag-ignore]")) {
      continue;
    }
    if (dragGestureName) {
      const obstacleAttributeValue = obstacle.getAttribute(
        obstacleAttributeName,
      );
      if (obstacleAttributeValue) {
        const obstacleNames = obstacleAttributeValue.split(",");
        const found = obstacleNames.some(
          (obstacleName) =>
            obstacleName.trim().toLowerCase() === dragGestureName.toLowerCase(),
        );
        if (!found) {
          continue;
        }
      }
    }

    obstacleConstraintFunctions.push(
      ({ hasCrossedVisibleAreaLeftOnce, hasCrossedVisibleAreaTopOnce }) => {
        // Only apply the "before crossing visible area" logic when dragging sticky elements
        // Non-sticky elements should be able to cross sticky obstacles while stuck regardless of visible area crossing
        const useOriginalPositionEvenIfSticky = isDraggedElementSticky
          ? !hasCrossedVisibleAreaLeftOnce && !hasCrossedVisibleAreaTopOnce
          : true;

        const obstacleScrollRelativeRect = getScrollRelativeRect(
          obstacle,
          scrollableElement,
          {
            useOriginalPositionEvenIfSticky,
          },
        );
        let obstacleBounds;
        if (
          useOriginalPositionEvenIfSticky &&
          obstacleScrollRelativeRect.isSticky
        ) {
          obstacleBounds = obstacleScrollRelativeRect;
        } else {
          obstacleBounds = addScrollToRect(obstacleScrollRelativeRect);
        }

        // obstacleBounds are already in scrollable-relative coordinates, no conversion needed
        const obstacleObject = createObstacleContraint(obstacleBounds, {
          name: `${obstacleBounds.isSticky ? "sticky " : ""}obstacle (${getElementSignature(obstacle)})`,
          element: obstacle,
        });
        return obstacleObject;
      },
    );
  }
  return obstacleConstraintFunctions;
};

const createBoundConstraint = (bounds, { name, element } = {}) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;

  const apply = ({ left, top, right, bottom, width, height }) => {
    let leftConstrained = left;
    let topConstrained = top;
    // Left boundary: element's left edge should not go before leftBound
    if (leftBound !== undefined && left < leftBound) {
      leftConstrained = leftBound;
    }
    // Right boundary: element's right edge should not go past rightBound
    if (rightBound !== undefined && right > rightBound) {
      leftConstrained = rightBound - width;
    }
    // Top boundary: element's top edge should not go before topBound
    if (topBound !== undefined && top < topBound) {
      topConstrained = topBound;
    }
    // Bottom boundary: element's bottom edge should not go past bottomBound
    if (bottomBound !== undefined && bottom > bottomBound) {
      topConstrained = bottomBound - height;
    }
    return [leftConstrained, topConstrained];
  };

  return {
    type: "bounds",
    name,
    apply,
    element,
    bounds,
  };
};
const createObstacleContraint = (bounds, { element, name }) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;
  const leftBoundRounded = roundForConstraints(leftBound);
  const rightBoundRounded = roundForConstraints(rightBound);
  const topBoundRounded = roundForConstraints(topBound);
  const bottomBoundRounded = roundForConstraints(bottomBound);

  const apply = ({
    left,
    top,
    right,
    bottom,
    width,
    height,
    currentLeft,
    currentTop,
  }) => {
    // Simple collision detection: check where element is and prevent movement into obstacle
    {
      // Determine current position relative to obstacle
      const currentLeftRounded = roundForConstraints(currentLeft);
      const currentRightRounded = roundForConstraints(currentLeft + width);
      const currentTopRounded = roundForConstraints(currentTop);
      const currentBottomRounded = roundForConstraints(currentTop + height);
      const isOnTheLeft = currentRightRounded <= leftBoundRounded;
      const isOnTheRight = currentLeftRounded >= rightBoundRounded;
      const isAbove = currentBottomRounded <= topBoundRounded;
      const isBelow = currentTopRounded >= bottomBoundRounded;

      // If element is on the left, apply X constraint to prevent moving right into obstacle
      if (isOnTheLeft) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const maxLeft = leftBound - width;
          if (left > maxLeft) {
            return [maxLeft, top];
          }
        }
      }
      // If element is on the right, apply X constraint to prevent moving left into obstacle
      else if (isOnTheRight) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const minLeft = rightBound;
          if (left < minLeft) {
            return [minLeft, top];
          }
        }
      }
      // If element is above, apply Y constraint to prevent moving down into obstacle
      else if (isAbove) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const maxTop = topBound - height;
          if (top > maxTop) {
            return [left, maxTop];
          }
        }
      }
      // If element is below, apply Y constraint to prevent moving up into obstacle
      else if (isBelow) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const minTop = bottomBound;
          if (top < minTop) {
            return [left, minTop];
          }
        }
      }
    }

    // Element is overlapping with obstacle - push it out in the direction of least resistance
    // Calculate distances to push element out in each direction
    const distanceToLeft = right - leftBound; // Distance to push left
    const distanceToRight = rightBound - left; // Distance to push right
    const distanceToTop = bottom - topBound; // Distance to push up
    const distanceToBottom = bottomBound - top; // Distance to push down
    // Find the minimum distance (direction of least resistance)
    const minDistance = Math.min(
      distanceToLeft,
      distanceToRight,
      distanceToTop,
      distanceToBottom,
    );
    if (minDistance === distanceToLeft) {
      // Push left: element should not go past leftBound - elementWidth
      const maxLeft = leftBound - width;
      if (left > maxLeft) {
        return [maxLeft, top];
      }
    } else if (minDistance === distanceToRight) {
      // Push right: element should not go before rightBound
      const minLeft = rightBound;
      if (left < minLeft) {
        return [minLeft, top];
      }
    } else if (minDistance === distanceToTop) {
      // Push up: element should not go past topBound - elementHeight
      const maxTop = topBound - height;
      if (top > maxTop) {
        return [left, maxTop];
      }
    } else if (minDistance === distanceToBottom) {
      // Push down: element should not go before bottomBound
      const minTop = bottomBound;
      if (top < minTop) {
        return [left, minTop];
      }
    }

    return null;
  };

  return {
    type: "obstacle",
    name,
    apply,
    element,
    bounds,
  };
};

/**
 * Rounds coordinates to prevent floating point precision issues in constraint calculations.
 *
 * This is critical for obstacle detection because:
 * 1. Boundary detection relies on precise comparisons (e.g., elementRight <= obstacleLeft)
 * 2. Floating point arithmetic can produce values like 149.99999999 instead of 150
 * 3. This causes incorrect boundary classifications (element appears "on left" when it should be "overlapping")
 *
 * Scroll events are more susceptible to this issue because:
 * - Mouse events use integer pixel coordinates from the DOM (e.g., clientX: 150)
 * - Scroll events use element.scrollLeft which can have sub-pixel values from CSS transforms, zoom, etc.
 * - Scroll compensation calculations (scrollDelta * ratios) amplify floating point errors
 * - Multiple scroll events accumulate these errors over time
 *
 * Using 2-decimal precision maintains smooth sub-pixel positioning while ensuring
 * reliable boundary detection for constraint systems.
 */
const roundForConstraints = (value) => {
  return Math.round(value * 100) / 100;
};

/**
 * Detects the drop target based on what element is actually under the mouse cursor.
 * Uses document.elementsFromPoint() to respect visual stacking order naturally,
 * and falls back on the rectangles alone when the hit test cannot answer — which
 * is not only "over nothing": during a view transition the browser hands back the
 * root for every point of the page (see findTargetByGeometry).
 *
 * @param {Object} gestureInfo - Gesture information
 * @param {Element[]} targetElements - Array of potential drop target elements
 * @param {object} [options]
 * @param {Element} [options.dragElement] - The element being dragged. When provided and
 *   `fallbackToEdge` is true, used to compute the fallback rect.
 * @param {boolean} [options.fallbackToEdge=false] - When true and the drag element does
 *   not intersect any target, falls back to the first item (if above all items) or the
 *   last item (if below all items) so there is always a valid drop target at list edges.
 * @returns {Object|null} Drop target info with elementSide or null if no valid target found
 */
const getDropTargetInfo = (
  gestureInfo,
  targetElements,
  { fallbackToEdge = false } = {},
) => {
  const dragElement = gestureInfo.elementImpacted || gestureInfo.element;
  const dragElementRect = dragElement.getBoundingClientRect();
  const intersectingTargets = [];
  let someTargetIsCol;
  let someTargetIsTr;
  for (const targetElement of targetElements) {
    const targetRect = targetElement.getBoundingClientRect();
    if (!rectangleAreIntersecting(dragElementRect, targetRect)) {
      continue;
    }
    if (!someTargetIsCol && targetElement.tagName === "COL") {
      someTargetIsCol = true;
    }
    if (!someTargetIsTr && targetElement.tagName === "TR") {
      someTargetIsTr = true;
    }
    intersectingTargets.push(targetElement);
  }

  if (intersectingTargets.length === 0) {
    if (fallbackToEdge) {
      const dragElement = gestureInfo.elementImpacted || gestureInfo.element;
      const dragElementRect = dragElement.getBoundingClientRect();
      const firstItem = targetElements[0];
      const lastItem = targetElements[targetElements.length - 1];
      if (
        firstItem &&
        dragElementRect.bottom < firstItem.getBoundingClientRect().top
      ) {
        // Drag element is above all items → treat as hovering the first item from the top.
        return {
          element: firstItem,
          elementSide: { x: "start", y: "start" },
          index: 0,
          intersectingIndex: 0,
          intersecting: [firstItem],
        };
      }
      if (
        lastItem &&
        dragElementRect.top > lastItem.getBoundingClientRect().bottom
      ) {
        // Drag element is below all items → treat as hovering the last item from the bottom.
        return {
          element: lastItem,
          elementSide: { x: "start", y: "end" },
          index: targetElements.length - 1,
          intersectingIndex: 0,
          intersecting: [lastItem],
        };
      }
    }
    return null;
  }

  const dragElementCenterX = dragElementRect.left + dragElementRect.width / 2;
  const dragElementCenterY = dragElementRect.top + dragElementRect.height / 2;
  // Clamp coordinates to viewport to avoid issues with elementsFromPoint
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const clientX =
    dragElementCenterX < 0
      ? 0
      : dragElementCenterX > viewportWidth
        ? viewportWidth - 1
        : dragElementCenterX;
  const clientY =
    dragElementCenterY < 0
      ? 0
      : dragElementCenterY > viewportHeight
        ? viewportHeight - 1
        : dragElementCenterY;

  // Find the first target element in the stack (topmost visible target)
  const elementsUnderDragElement = document.elementsFromPoint(clientX, clientY);
  let targetElement = null;
  let targetIndex = -1;
  let intersectingIndex = -1;
  for (const element of elementsUnderDragElement) {
    // First, check if the element itself is a target
    const directIndex = intersectingTargets.indexOf(element);
    if (directIndex !== -1) {
      targetElement = element;
      intersectingIndex = directIndex;
      break;
    }
    // Special case: if element is <td> or <th> and not in targets,
    // try to find its corresponding <col> element
    if (!isTableCell(element)) {
      continue;
    }
    try_col: {
      if (!someTargetIsCol) {
        break try_col;
      }
      const tableCellCol = findTableCellCol(element);
      if (!tableCellCol) {
        break try_col;
      }
      const colIndex = intersectingTargets.indexOf(tableCellCol);
      if (colIndex === -1) {
        break try_col;
      }
      targetElement = tableCellCol;
      intersectingIndex = colIndex;
      break;
    }
    try_tr: {
      if (!someTargetIsTr) {
        break try_tr;
      }
      const tableRow = element.closest("tr");
      const rowIndex = targetElements.indexOf(tableRow);
      if (rowIndex === -1) {
        break try_tr;
      }
      targetElement = tableRow;
      intersectingIndex = intersectingTargets.indexOf(tableRow);
      break;
    }
  }
  if (!targetElement) {
    // Nothing in the stack answered. The point may be over no target at all —
    // and it may also be over one the hit test cannot see: a view transition
    // covers the page with its pictures, and from then on every point of the
    // document reads as the root, whatever is really under it. Taking the first
    // of the overlapped targets then means taking the first one in DOM ORDER,
    // which has nothing to do with where the hand is: a piece carried onto the
    // place next door comes back down on the place it left, and the hint says so
    // by lighting up the wrong one.
    //
    // Geometry is what is left, and it is the reading the eye makes anyway: the
    // place the middle of the carried thing is IN, or — the middle being over a
    // gap — the one it covers most of.
    targetElement = findTargetByGeometry(intersectingTargets, dragElementRect);
    intersectingIndex = intersectingTargets.indexOf(targetElement);
  }
  targetIndex = targetElements.indexOf(targetElement);

  // Determine position within the target for both axes.
  //
  // Use the leading edge of the dragged element (in the direction of movement)
  // compared against the target's center:
  //   - Dragging down: "after" as soon as the bottom crosses the target center.
  //   - Dragging up:   "before" as soon as the top crosses the target center.
  //   - Not moving: center-vs-center fallback.
  //
  // This gives consistent, predictable thresholds regardless of element size.
  const targetRect = targetElement.getBoundingClientRect();
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const { intentGoingDown, intentGoingUp, intentGoingRight, intentGoingLeft } =
    gestureInfo;
  let sideY;
  if (intentGoingDown) {
    sideY = dragElementRect.bottom > targetCenterY ? "end" : "start";
  } else if (intentGoingUp) {
    sideY = dragElementRect.top < targetCenterY ? "start" : "end";
  } else {
    sideY = dragElementCenterY < targetCenterY ? "start" : "end";
  }
  let sideX;
  if (intentGoingRight) {
    sideX = dragElementRect.right > targetCenterX ? "end" : "start";
  } else if (intentGoingLeft) {
    sideX = dragElementRect.left < targetCenterX ? "start" : "end";
  } else {
    sideX = dragElementCenterX < targetCenterX ? "start" : "end";
  }
  const result = {
    // NOTE: avoid relying on `index` in application code. The targetElements
    // array may be dynamically filtered (e.g. excluding the grabbed element),
    // making this index inconsistent with the full list. Use `element` instead
    // and look up its position yourself from your own data source.
    index: targetIndex,
    element: targetElement,
    elementSide: {
      x: sideX,
      y: sideY,
    },
    // Index within the intersecting subset — could be useful to know how many
    // elements were overlapping, but rarely needed in practice
    intersectingIndex,
    intersecting: intersectingTargets,
  };
  return result;
};

/**
 * Which of the overlapped targets the carried thing is on, said with rectangles
 * alone: the one holding its centre, or the one it covers the most of. Used when
 * the hit test cannot answer (see its caller).
 */
const findTargetByGeometry = (targetElements, dragElementRect) => {
  const dragCenterX = dragElementRect.left + dragElementRect.width / 2;
  const dragCenterY = dragElementRect.top + dragElementRect.height / 2;
  let bestElement = null;
  let bestOverlapArea = -1;
  for (const targetElement of targetElements) {
    const targetRect = targetElement.getBoundingClientRect();
    if (
      dragCenterX >= targetRect.left &&
      dragCenterX <= targetRect.right &&
      dragCenterY >= targetRect.top &&
      dragCenterY <= targetRect.bottom
    ) {
      return targetElement;
    }
    const overlapWidth =
      Math.min(targetRect.right, dragElementRect.right) -
      Math.max(targetRect.left, dragElementRect.left);
    const overlapHeight =
      Math.min(targetRect.bottom, dragElementRect.bottom) -
      Math.max(targetRect.top, dragElementRect.top);
    const overlapArea = overlapWidth * overlapHeight;
    if (overlapArea > bestOverlapArea) {
      bestOverlapArea = overlapArea;
      bestElement = targetElement;
    }
  }
  return bestElement;
};

const rectangleAreIntersecting = (r1, r2) => {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top > r1.bottom ||
    r2.bottom < r1.top
  );
};

const isTableCell = (el) => {
  return el.tagName === "TD" || el.tagName === "TH";
};

/**
 * Find the corresponding <col> element for a given <td> or <th> cell
 * @param {Element} cellElement - The <td> or <th> element
 * @param {Element[]} targetColElements - Array of <col> elements to search in
 * @returns {Element|null} The corresponding <col> element or null if not found
 */
const findTableCellCol = (cellElement) => {
  const table = cellElement.closest("table");
  const colgroup = table.querySelector("colgroup");
  if (!colgroup) {
    return null;
  }
  const cols = colgroup.querySelectorAll("col");
  const columnIndex = cellElement.cellIndex;
  const correspondingCol = cols[columnIndex];
  return correspondingCol;
};

const applyStickyFrontiersToAutoScrollArea = (
  autoScrollArea,
  { direction, scrollContainer, dragName },
) => {
  let { left, right, top, bottom } = autoScrollArea;

  if (direction.x) {
    const horizontalStickyFrontiers = createStickyFrontierOnAxis(
      scrollContainer,
      {
        name: dragName,
        scrollContainer,
        primarySide: "left",
        oppositeSide: "right",
      },
    );
    for (const horizontalStickyFrontier of horizontalStickyFrontiers) {
      const { side, bounds, element } = horizontalStickyFrontier;
      if (side === "left") {
        if (bounds.right <= left) {
          continue;
        }
        left = bounds.right;
        continue;
      }
      // right
      if (bounds.left >= right) {
        continue;
      }
      right = bounds.left;
      continue;
    }
  }

  if (direction.y) {
    const verticalStickyFrontiers = createStickyFrontierOnAxis(
      scrollContainer,
      {
        name: dragName,
        scrollContainer,
        primarySide: "top",
        oppositeSide: "bottom",
      },
    );
    for (const verticalStickyFrontier of verticalStickyFrontiers) {
      const { side, bounds, element } = verticalStickyFrontier;

      // Frontier acts as a top barrier - constrains from the bottom edge of the frontier
      if (side === "top") {
        if (bounds.bottom <= top) {
          continue;
        }
        top = bounds.bottom;
        continue;
      }

      // Frontier acts as a bottom barrier - constrains from the top edge of the frontier
      if (bounds.top >= bottom) {
        continue;
      }
      bottom = bounds.top;
      continue;
    }
  }

  return { left, right, top, bottom };
};

const createStickyFrontierOnAxis = (
  element,
  { name, scrollContainer, primarySide, oppositeSide },
) => {
  const primaryAttrName = `data-drag-sticky-${primarySide}-frontier`;
  const oppositeAttrName = `data-drag-sticky-${oppositeSide}-frontier`;
  const frontiers = element.querySelectorAll(
    `[${primaryAttrName}], [${oppositeAttrName}]`,
  );
  const matchingStickyFrontiers = [];
  for (const frontier of frontiers) {
    if (frontier.closest("[data-drag-ignore]")) {
      continue;
    }
    const hasPrimary = frontier.hasAttribute(primaryAttrName);
    const hasOpposite = frontier.hasAttribute(oppositeAttrName);
    // Check if element has both sides (invalid)
    if (hasPrimary && hasOpposite) {
      const elementSignature = getElementSignature(frontier);
      console.warn(
        `Sticky frontier element (${elementSignature}) has both ${primarySide} and ${oppositeSide} attributes. 
  A sticky frontier should only have one side attribute.`,
      );
      continue;
    }
    const attrName = hasPrimary ? primaryAttrName : oppositeAttrName;
    const attributeValue = frontier.getAttribute(attrName);
    if (attributeValue && name) {
      const frontierNames = attributeValue.split(",");
      const isMatching = frontierNames.some(
        (frontierName) =>
          frontierName.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!isMatching) {
        continue;
      }
    }
    const frontierBounds = getScrollRelativeRect(frontier, scrollContainer);
    const stickyFrontierObject = {
      type: "sticky-frontier",
      element: frontier,
      side: hasPrimary ? primarySide : oppositeSide,
      bounds: frontierBounds,
      name: `sticky_frontier_${hasPrimary ? primarySide : oppositeSide} (${getElementSignature(frontier)})`,
    };
    matchingStickyFrontiers.push(stickyFrontierObject);
  }
  return matchingStickyFrontiers;
};

installImportMetaCssBuild(import.meta);/**
 * A drag, and what it is FOR.
 *
 * What a hand does is always the same — pick the thing up, carry it, let go — so
 * the gesture is not what distinguishes these. What distinguishes them is the
 * outcome the caller asked for, and that is what `startDragTo` takes:
 *
 * - **move**: it stays where it was put. The element ITSELF travels and keeps the
 *   place the hand gave it.
 * - **reorder**: it takes a place in a list. A COPY travels while the original
 *   keeps its place in the layout, which is what makes the gesture possible at
 *   all — nothing else moves while the hand looks for a place, so there is a
 *   stable row of items to look between.
 * - **toss**: it is gotten rid of. The same copy, for the opposite reason: the
 *   original stays until the answer says it is really gone.
 * - **land**: it comes down ON something. Also a copy, and the closest to
 *   `reorder` — the difference is what a target IS: a row of a list is a place
 *   BETWEEN two others, whereas a square of a board is a place of its own, which
 *   may already be taken. So nothing is inserted and nothing is a no-op: the
 *   answer is "this one came down on that one", and what that means (take the
 *   place, swap the two, refuse) is the caller's.
 *
 * The caller lists which outcomes ITS element can answer, and only the machinery
 * those need runs: no copy for a move, no drop hint for something that can only be
 * thrown away, no landing looked for where nothing lands. `reorder` and `toss`
 * combine (dropped on a row, or thrown off the screen); `move` and `reorder` cannot
 * both be true of one release, and the caller is the one who must not ask for both.
 *
 * `createDragToMoveGestureController` below is the layer under all of that — the
 * translation, the auto-scroll, the constraints — and stays usable on its own for
 * anything that is none of the three (a table column being dragged, a sticky
 * frontier being moved).
 */
const dragStyleController = createStyleController("drag_to_move");

// How long the copy takes to leave the screen, and to come back. Written into the
// CSS below from here: the flight has to be waited for, and a duration living only
// in a stylesheet is a timing JS cannot read reliably.
const TOSS_DURATION_MS = 320;
// Far enough to be off any screen, in the direction the hand was going.
const TOSS_DISTANCE = 900;
const css$1 = /* css */`
  /* IT COSTS THE LIST NOTHING: the hint lands on the edge of a row, which for
     the last one is the very bottom of the scroll area — a line taking up room
     there would push the scrollable area a few pixels further and make a
     scrollbar appear (or hide the hint under it) exactly when one is trying to
     drop at the end. Being fixed is what avoids it: a fixed box has the
     viewport as containing block, so it is left out of the scrollable overflow
     of every ancestor and can overhang the list freely. Same for the clone it
     accompanies. */
  .navi_drop_hint {
    /* A popover, so it lands in the top layer: no z-index to bid against the
       page, and nothing it can be hidden behind. Shown BEFORE the clone, which
       is what puts the clone above it — the top layer stacks in the order
       things are shown, and the item being carried should pass over the line
       rather than under it. The UA styles for [popover] have to be undone:
       inset:0, margin:auto, a border and a background of its own. */
    position: fixed;
    inset: auto;
    top: var(--drop-hint-y);
    left: calc(var(--drop-target-left) + var(--drop-hint-margin-x, 0px));
    display: none;
    box-sizing: border-box;
    width: calc(var(--drop-target-width) - 2 * var(--drop-hint-margin-x, 0px));
    height: var(--drop-hint-size, 3px);
    margin: 0;
    padding: 0;
    color: inherit;
    background: var(--drop-hint-background-color, #4476ff);
    border: none;
    border-radius: var(--drop-hint-border-radius, 2px);
    transform: translateY(-50%);
    pointer-events: none;
    overflow: visible;
  }
  .navi_drop_hint[data-drop-edge]:popover-open {
    display: block;
  }
  .navi_drop_hint[data-drop-edge="top"] {
    --drop-hint-y: calc(
      var(--drop-target-top) - var(--drop-hint-margin-y, 0px)
    );
  }
  .navi_drop_hint[data-drop-edge="bottom"] {
    --drop-hint-y: calc(
      var(--drop-target-bottom) + var(--drop-hint-margin-y, 0px)
    );
  }
  /* A chevron at each end, pointing in: the line alone is easy to lose against
     a list of borders and separators, two arrows read as "here" at a glance
     (same idea as the table's column drop preview). They overhang the line,
     which costs nothing to a box left out of the scrollable area — and the more
     they stick out, the easier they are to spot. */
  .navi_drop_hint_cap {
    position: absolute;
    top: 50%;
    display: flex;
    color: var(--drop-hint-background-color, #4476ff);
    translate: 0 -50%;
  }
  .navi_drop_hint_cap svg {
    width: var(--drop-hint-arrow-size, 11px);
    height: var(--drop-hint-arrow-size, 11px);
  }
  .navi_drop_hint_cap[data-side="start"] {
    left: calc(-1 * var(--drop-hint-arrow-size, 11px));
    rotate: -90deg;
  }
  .navi_drop_hint_cap[data-side="end"] {
    right: calc(-1 * var(--drop-hint-arrow-size, 11px));
    rotate: 90deg;
  }

  /* WHERE IT LANDS, when landing is ON a thing rather than between two: the
     place itself is lit up, because there is no gap to draw a line in. Fixed
     and in the top layer for the same reasons as the line above. */
  .navi_drop_surface {
    position: fixed;
    inset: auto;
    top: var(--drop-target-top);
    left: var(--drop-target-left);
    display: none;
    box-sizing: border-box;
    width: var(--drop-target-width);
    height: var(--drop-target-height);
    margin: 0;
    padding: 0;
    color: inherit;
    background: var(--drop-surface-background-color, rgba(68, 118, 255, 0.16));
    border: var(--drop-surface-border-width, 2px) solid
      var(--drop-surface-border-color, #4476ff);
    border-radius: var(--drop-surface-border-radius, 6px);
    pointer-events: none;
    overflow: visible;
  }
  .navi_drop_surface[data-drop-over]:popover-open {
    display: block;
  }

  /* WHO CAN START A DRAG, said in the cursor.
     A handle exists only to drag, so it shows the hand. A source does not, and
     the gesture must not claim its cursor: it drags only once the intent shows
     (a few pixels of travel, or a long press), a plain click on it stays a
     click, and it is usually something else FIRST — a link, a card one opens.
     The cursor says what the element is, and a hand insisting on the one thing
     it can also be would talk over that. So it is left alone — default, and not
     an I-beam, because dragging across the text does not select it (the gesture
     takes the pointer; see the selectstart refused in drag_gesture.js) — and
     whoever puts the drag there asks for the hand when a grab really is the
     first thing the element offers.
     An opted-out area keeps both its cursor and its selection, and never starts
     a drag (see the check in startDragTo).
     Controls inside a source keep their own cursor: cursor is inherited, and
     anything setting its own (a button's pointer) wins on itself.
     Only the resting cursor is set here: what it becomes once a drag is under
     way belongs to the gesture (see the backdrop in drag_gesture.js), the only
     thing that knows a drag actually started. */
  [data-drag-handle] {
    cursor: grab;
  }
  [data-drag-source] {
    cursor: default;
  }
  [data-drag-ignore] {
    cursor: auto;
  }

  [navi-drag-clone-source] {
    visibility: hidden;
  }

  [navi-drag-clone-wrapper] {
    /* Also a popover (see .navi_drop_hint): in the top layer it is over the
       page whatever the page's own stacking is, and the coordinates it is
       given are viewport ones — which is what the pointer carrying it works
       in. Same UA-style reset as the hint. */
    position: fixed;
    inset: auto;
    top: var(--clone-top);
    left: var(--clone-left);
    box-sizing: border-box;
    width: var(--clone-width);
    height: var(--clone-height);
    margin: 0;
    padding: 0;
    color: inherit;
    background: transparent;
    border: none;
    /* Carries the chain down to the copy, for an item whose own radius is an
       "inherit" from the list around it. */
    border-radius: inherit;
    opacity: 0.95;
    pointer-events: none;
    /* Nothing in a copy being carried by a pointer is text to select: the
       selection belongs to the original, which is still in the page. This is the
       one place the rule is unconditional — an element that can be dragged is
       usually selectable too (a link is both), and forcing it there would take
       away a selection made from outside the element.  */
    user-select: none;
    overflow: visible;
  }

  /* On its way home and still the object: the hand can reach for it there, so
     there it takes the pointer — which it must not do at any other moment of the
     gesture, or it would hide what it is being dropped on. */
  [navi-drag-clone-wrapper][data-catchable] {
    pointer-events: auto;
  }

  /* …and a FINGER reaching for it does not land on it: the pictures of the
     transition cover the page, so as far as the browser is concerned the touch
     began on the document root. What a touch may do is decided there and at that
     moment, so the root says it for as long as the copy can be caught — the pan
     is ours (nothing should scroll while something is landing), zoom stays the
     reader's. Half of a pair: without the non-passive listener put down at the
     same moment (see letCopyBeCaught) every touchmove arrives already
     non-cancelable and refusing it does nothing. */
  [data-drag-catchable] {
    touch-action: pinch-zoom;
  }

  /* Ce qui a été lancé: il continue dans la direction du geste jusqu'à sortir de
     l'écran, et revient par le même chemin si la réponse refuse. */
  [navi-drag-clone-wrapper][data-tossed] {
    transition:
      translate ${TOSS_DURATION_MS}ms ease-out,
      opacity ${TOSS_DURATION_MS}ms ease-out;
  }
  [navi-drag-clone-wrapper][data-tossed="away"] {
    opacity: 0;
  }

  [navi-drag-clone] {
    /* Cast by the copy itself rather than by the box around it, so it takes the
       shape of the thing — a rounded row throws a rounded shadow. Its value is a
       var read on the copy, which IS the dragged element: what being carried
       looks like belongs to whoever owns the thing — a row lifted off a list
       wants this shadow, a sheet of paper leaving a board wants none, and its
       shade is a theme's business either way. */
    box-shadow: var(--drag-clone-shadow, 0 12px 28px rgba(0, 0, 0, 0.22));
    transform: scale(var(--drag-clone-scale, 1.03));
    transform-origin: var(--drag-origin);
    transition:
      transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.15s ease;
  }

  @starting-style {
    [navi-drag-clone] {
      box-shadow: none;
      transform: scale(1);
    }
  }
`;
// At module scope, not inside startDragTo: the cursor rules above say who
// can start a drag, and they have to be true BEFORE anyone drags anything.
import.meta.css = [css$1, "@jsenv/dom/src/interaction/drag/drag_to.js"];

/**
 * Starts a drag-to-reorder interaction on a list item.
 *
 * Handles the full reorder UX:
 * - Activates only once the intent is established — a short movement with a mouse, a long
 *   press with a finger (see `dragAfterIntent`), so that neither a click nor a scroll
 *   reorders anything by accident.
 * - Clones the grabbed element and moves the clone while the original stays hidden in place
 *   (keeps the layout intact so other items don't shift during the drag).
 * - The clone and the drop-hint live in the dragged element's own parent, so the CSS vars
 *   that dress them (`--drag-clone-shadow`, `--drop-hint-size`, …) reach them by plain
 *   inheritance, and so do the rules the list writes for its items.
 * - Shows a drop-hint line indicating where the item will land.
 * - Drop-target detection is intersection-based: the clone's bounding rect is compared
 *   against every item that matches `itemSelector` in the scroll container.
 * - No-ops are filtered: releasing on the grabbed element itself, or in a position that
 *   would leave it at exactly the same index, never triggers `onReorder`.
 * - On a valid drop, the clone animates to the drop position via the View Transitions API,
 *   `onReorder` is called inside the transition callback so the DOM update and the animation
 *   are captured together, then the clone is removed.
 * - On a cancelled drop (pointer released with no valid target), the clone is removed
 *   immediately without calling `onReorder`.
 *
 * IDs are used as the bridge between DOM elements and JS state because:
 * - Not all DOM elements matching `itemSelector` may be valid drop targets
 *   (holes in the structure), so DOM indices don't reliably map to state indices.
 * - Virtual lists render fewer DOM nodes than the total item count, so
 *   DOM-index-based counting would be wrong.
 *
 * Any option not listed below is forwarded to `createDragToMoveGestureController`
 * (`areaConstraint`, `autoScrollAreaPadding`, `stickyFrontiers`…), except
 * `releasePositionEffect`, always `"manual"` here: what moves is the clone, and it
 * is removed on release, so there is no position to commit or cancel.
 *
 * @param {PointerEvent} event
 *   The `pointerdown` event that may become a reorder.
 * @param {object} options
 * @param {Element} [options.draggedElement=event.currentTarget]
 *   The list item to drag.
 * @param {Element} [options.containerElement=draggedElement.parentElement]
 *   Element searched with `itemSelector` to find the items to drop between.
 * @param {string} [options.itemSelector]
 *   CSS selector that matches all list items inside `containerElement`.
 *   Used for drop-target detection and no-op filtering. Left out, nothing is a
 *   drop target: no hint is drawn and no reorder can be answered — which is what
 *   a drag that only ever throws the thing away asks for.
 * @param {function} options.getItemId
 *   Returns the stable ID for a given DOM element.
 *   Signature: `getItemId(element) → id`.
 * @param {function} options.onReorder
 *   Called when the user drops the item in a new position.
 *   Signature: `onReorder(fromId, toId, syncCloneWithDropTarget)`.
 *   - `fromId`: stable ID of the dragged item.
 *   - `toId`: stable ID of the item to insert before, or `null` to append at the end.
 *   - `syncCloneWithDropTarget`: call it synchronously inside a
 *     `document.startViewTransition` callback, next to the DOM mutation, so the
 *     clone is captured at its landing position.
 * @param {(detail: {gestureInfo: object, dropTarget: Element|null}) => "reorder"|"toss"|"cancel"} [options.resolveDrop]
 *   What THIS release means, when the answer is not simply "a target was found or
 *   not": the same grab can be meant to reorder or to get rid of the thing, and
 *   only the caller knows which — far and fast is a throw, over a row is a move.
 *   Left out, a drop target reorders and anything else is cancelled.
 * @param {(detail: {gestureInfo: object}) => Promise|void} [options.onToss]
 *   The release was a throw. The clone leaves the screen the way it was thrown
 *   while this runs; it comes back if the promise rejects, because the thing still
 *   exists and the screen has to say so.
 * @param {object} [options.direction={ x: false, y: true }]
 *   Axes along which dragging is allowed. Passed to `createDragToMoveGestureController`.
 * @param {number} [options.threshold=5]
 *   Distance (px) a mouse must travel before the press becomes a drag.
 * @param {boolean|"if-touch"} [options.longPress="if-touch"]
 *   Which pointers start the drag by holding still instead of by travelling.
 * @param {number} [options.longPressDelay=400]
 *   How long (ms) such a pointer must stay down.
 * @param {number} [options.longPressSlop=8]
 *   How far (px) it may drift during that wait before the press is abandoned.
 * @param {function} [options.onPressStart]
 *   The pointer went down and the wait began (a cue that the press counts).
 * @param {function} [options.onPressCancel]
 *   The pointer moved or lifted before the wait was over.
 * @param {function} [options.onPress]
 *   The wait completed and the item is now held (haptics, scale…).
 */

/**
 * Creates a gesture controller that moves elements via drag.
 *
 * Wraps `createDragGestureController` and adds:
 * - Element translation via CSS transform (translate only; other existing transforms are preserved)
 * - Auto-scroll while dragging near scroll-container edges
 * - Constraints (area boundaries, obstacle elements)
 *
 * The returned controller exposes a `grab(options)` / `grabViaPointer(event, options)` method.
 * Key grab options:
 * - `element`: the element whose position drives layout calculations (scroll-container detection,
 *   constraints, auto-scroll). Sets `data-grabbed` during the drag.
 * - `referenceElement`: optional sticky-frontier / obstacle reference, defaults to `element`.
 * - `elementToMove`: optional different element to actually translate (e.g. a drag clone).
 *   If omitted, `element` is translated. The translate is read from `dragStyleController`
 *   at grab time so any pre-existing translate is accumulated rather than reset.
 *
 * A `transform` already on the moved element (rotate, scale…) is preserved and does
 * not disturb the movement. `rotate` and `scale` set as individual CSS properties do:
 * they apply outside `transform`, where nothing the gesture writes can reach them —
 * put those on a child element instead (a warning says so in dev).
 *
 * @param {object} [options]
 * @param {boolean} [options.stickyFrontiers=true]
 *   Shrinks the auto-scroll area at sticky boundaries (elements with `data-sticky-left` /
 *   `data-sticky-top`).
 * @param {number} [options.autoScrollAreaPadding=0]
 *   Extra padding (px) subtracted from each edge of the auto-scroll trigger area.
 * @param {string|object|function} [options.areaConstraint="scroll"]
 *   Constrains where the element can be dragged.
 *   `"scroll"` — bounded by the full scroll area.
 *   `"scrollport"` — bounded by the visible viewport of the scroll container.
 *   `"none"` — no area constraint.
 *   `{left, top, right, bottom}` — fixed bounds (values may be functions receiving context).
 *   `function` — called each drag frame, must return a `{left,top,right,bottom}` object.
 * @param {Element} [options.obstaclesContainer]
 *   Container to look for obstacle elements in. Defaults to the scroll container.
 * @param {string} [options.obstacleAttributeName="data-drag-obstacle"]
 *   Attribute that marks obstacle elements.
 * @param {boolean} [options.showConstraintFeedbackLine=false]
 *   Renders a visual line when the pointer deviates from the element due to constraints.
 * @param {boolean} [options.showDebugMarkers=false]
 *   Renders debug markers for constraint regions.
 * @param {"commit"|"cancel"|"cancel-animated"|"manual"} [options.releasePositionEffect="commit"]
 *   Controls what happens to the translated position on release.
 *   - `"commit"`: bakes the translate into inline styles so the element stays put (default).
 *   - `"cancel"`: discards the translate so the element snaps back to its original position.
 *   - `"cancel-animated"`: same, travelling back to it over `cancelAnimationDuration`.
 *   - `"manual"`: does nothing — the caller is responsible for clearing or committing
 *     the transform via `dragStyleController`.
 * @param {number} [options.cancelAnimationDuration=200]
 *   Duration (ms) of the way back for `"cancel-animated"`.
 * @param {string} [options.cancelAnimationEasing="ease-out"]
 *   Easing of the way back for `"cancel-animated"`.
 * @returns {object} Drag gesture controller with augmented `grab()` / `grabViaPointer()` methods.
 *
 * `gestureInfo` gains `cancelPosition()`, `commitPosition()` and
 * `cancelPositionAnimated({duration, easing})` — the last returns the `Animation`
 * playing the way back (`null` when the element was already home), so a caller
 * on `"manual"` can decide between thrown and put back, and still await the
 * landing.
 */
const createDragToMoveGestureController = ({
  stickyFrontiers = true,
  autoScrollAreaPadding = 0,
  areaConstraint = "scroll",
  obstaclesContainer,
  obstacleAttributeName = "data-drag-obstacle",
  showConstraintFeedbackLine = false,
  showDebugMarkers = false,
  releasePositionEffect = "commit",
  cancelAnimationDuration = 200,
  cancelAnimationEasing = "ease-out",
  ...options
} = {}) => {
  const initGrabToMoveElement = (dragGesture, {
    element,
    referenceElement,
    elementToMove,
    convertScrollablePosition
  }) => {
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;
    const direction = dragGesture.gestureInfo.direction;
    // elementImpacted is either an externally provided elementToMove (e.g. a drag clone)
    const elementImpacted = elementToMove || element;
    // elementImpacted is either an externally provided elementToMove
    // (e.g. a drag clone passed by the caller) or the element itself.
    // Capture any pre-existing translate so we can accumulate on top of it
    // rather than resetting it to zero on the first drag event.
    const transformAtGrab = dragStyleController.getUnderlyingValue(elementImpacted, "transform");
    const translateXAtGrab = transformAtGrab.translateX;
    const translateYAtGrab = transformAtGrab.translateY;
    const cancelPosition = () => {
      dragStyleController.clear(elementImpacted);
    };
    // Reading the transform on either side of the clear is what lets this work
    // without knowing anything about the element: how it looked while held and
    // how it looks once let go are both just computed transforms, and the
    // animation has only to bridge the two.
    const cancelPositionAnimated = ({
      duration = cancelAnimationDuration,
      easing = cancelAnimationEasing
    } = {}) => {
      const transformWhileHeld = getComputedStyle(elementImpacted).transform;
      cancelPosition();
      const transformAtRest = getComputedStyle(elementImpacted).transform;
      if (transformWhileHeld === transformAtRest) {
        return null;
      }
      // No fill: the element already sits at its resting transform, the
      // animation only replays the way back to it.
      return elementImpacted.animate([{
        transform: transformWhileHeld
      }, {
        transform: transformAtRest
      }], {
        duration,
        easing
      });
    };
    const commitPosition = () => {
      dragStyleController.commit(elementImpacted);
    };
    dragGesture.gestureInfo.cancelPosition = cancelPosition;
    dragGesture.gestureInfo.cancelPositionAnimated = cancelPositionAnimated;
    dragGesture.gestureInfo.commitPosition = commitPosition;
    dragGesture.addReleaseCallback(() => {
      if (releasePositionEffect === "cancel") {
        cancelPosition();
      } else if (releasePositionEffect === "cancel-animated") {
        cancelPositionAnimated();
      } else if (releasePositionEffect === "commit") {
        commitPosition();
      }
      // "manual": caller handles cleanup, do nothing.
    });
    let elementWidth;
    let elementHeight;
    {
      const updateElementDimension = () => {
        const elementRect = element.getBoundingClientRect();
        elementWidth = elementRect.width;
        elementHeight = elementRect.height;
      };
      updateElementDimension();
      dragGesture.addBeforeDragCallback(updateElementDimension);
    }
    let scrollArea;
    {
      // Snapshot at grab time so that DOM mutations during dragging
      // (e.g. items shifting) don't change the scrollable boundary mid-drag.
      scrollArea = {
        left: 0,
        top: 0,
        right: scrollContainer.scrollWidth,
        bottom: scrollContainer.scrollHeight
      };
    }
    let scrollport;
    let autoScrollArea;
    {
      // scrollBox is the fixed bounding rect of the scroll container viewport.
      // scrollport is recomputed before each drag event to account for scrolling.
      const scrollBox = getScrollBox(scrollContainer);
      const updateScrollportAndAutoScrollArea = () => {
        scrollport = getScrollport(scrollBox, scrollContainer);
        autoScrollArea = scrollport;
        if (stickyFrontiers) {
          autoScrollArea = applyStickyFrontiersToAutoScrollArea(autoScrollArea, {
            scrollContainer,
            direction
            // dragGestureName,
          });
        }
        if (autoScrollAreaPadding > 0) {
          autoScrollArea = {
            paddingLeft: autoScrollAreaPadding,
            paddingTop: autoScrollAreaPadding,
            paddingRight: autoScrollAreaPadding,
            paddingBottom: autoScrollAreaPadding,
            left: autoScrollArea.left + autoScrollAreaPadding,
            top: autoScrollArea.top + autoScrollAreaPadding,
            right: autoScrollArea.right - autoScrollAreaPadding,
            bottom: autoScrollArea.bottom - autoScrollAreaPadding
          };
        }
      };
      updateScrollportAndAutoScrollArea();
      dragGesture.addBeforeDragCallback(updateScrollportAndAutoScrollArea);
    }

    // Set up dragging attribute
    element.setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      element.removeAttribute("data-grabbed");
    });

    // Will be used for dynamic constraints on sticky elements
    let hasCrossedScrollportLeftOnce = false;
    let hasCrossedScrollportTopOnce = false;
    const dragConstraints = initDragConstraints(dragGesture, {
      areaConstraint,
      obstaclesContainer: obstaclesContainer || scrollContainer,
      obstacleAttributeName,
      showConstraintFeedbackLine,
      showDebugMarkers,
      referenceElement
    });
    dragGesture.addBeforeDragCallback((layoutRequested, currentLayout, limitLayout, {
      dragEvent
    }) => {
      dragConstraints.applyConstraints(layoutRequested, currentLayout, limitLayout, {
        elementWidth,
        elementHeight,
        scrollArea,
        scrollport,
        hasCrossedScrollportLeftOnce,
        hasCrossedScrollportTopOnce,
        autoScrollArea,
        dragEvent
      });
    });
    const dragToMove = gestureInfo => {
      const {
        isGoingDown,
        isGoingUp,
        isGoingLeft,
        isGoingRight,
        layout
      } = gestureInfo;
      const left = layout.left;
      const top = layout.top;
      const right = left + elementWidth;
      const bottom = top + elementHeight;
      {
        hasCrossedScrollportLeftOnce = hasCrossedScrollportLeftOnce || left < scrollport.left;
        hasCrossedScrollportTopOnce = hasCrossedScrollportTopOnce || top < scrollport.top;
        const getScrollMove = axis => {
          const isGoingPositive = axis === "x" ? isGoingRight : isGoingDown;
          if (isGoingPositive) {
            const elementEnd = axis === "x" ? right : bottom;
            const autoScrollAreaEnd = axis === "x" ? autoScrollArea.right : autoScrollArea.bottom;
            if (elementEnd <= autoScrollAreaEnd) {
              return 0;
            }
            const scrollAmountNeeded = elementEnd - autoScrollAreaEnd;
            return scrollAmountNeeded;
          }
          const isGoingNegative = axis === "x" ? isGoingLeft : isGoingUp;
          if (!isGoingNegative) {
            return 0;
          }
          const referenceOrEl = referenceElement || element;
          const canAutoScrollNegative = axis === "x" ? !referenceOrEl.hasAttribute("data-sticky-left") || hasCrossedScrollportLeftOnce : !referenceOrEl.hasAttribute("data-sticky-top") || hasCrossedScrollportTopOnce;
          if (!canAutoScrollNegative) {
            return 0;
          }
          const elementStart = axis === "x" ? left : top;
          const autoScrollAreaStart = axis === "x" ? autoScrollArea.left : autoScrollArea.top;
          if (elementStart >= autoScrollAreaStart) {
            return 0;
          }
          const scrollAmountNeeded = autoScrollAreaStart - elementStart;
          return -scrollAmountNeeded;
        };
        let scrollLeftTarget;
        let scrollTopTarget;
        if (direction.x) {
          const containerScrollLeftMove = getScrollMove("x");
          if (containerScrollLeftMove) {
            scrollLeftTarget = scrollContainer.scrollLeft + containerScrollLeftMove;
          }
        }
        if (direction.y) {
          const containerScrollTopMove = getScrollMove("y");
          if (containerScrollTopMove) {
            scrollTopTarget = scrollContainer.scrollTop + containerScrollTopMove;
          }
        }
        // now we know what to do, do it
        if (scrollLeftTarget !== undefined) {
          scrollContainer.scrollLeft = scrollLeftTarget;
        }
        if (scrollTopTarget !== undefined) {
          scrollContainer.scrollTop = scrollTopTarget;
        }
      }
      {
        const {
          scrollableLeft,
          scrollableTop
        } = layout;
        const [positionedLeft, positionedTop] = convertScrollablePosition(scrollableLeft, scrollableTop);
        // Build the transform to apply, preserving any transforms that were
        // already on the element before the grab (e.g. rotate from another
        // controller), and accumulating from the pre-grab translate baseline.
        // The translate keys are seeded HERE, before the spread, and not merely
        // assigned below: a transform object is serialized in key order, and in a
        // transform list every function transforms the frame of the ones after it.
        // A translate written after a rotate or a scale therefore travels rotated
        // and scaled — the element drifts away from the pointer, proportionally to
        // the distance covered. Dragging moves things on screen, so its translate
        // has to come first, whatever else the element carries. The spread still
        // wins on the value when the element already had a translate of its own.
        const transform = {
          translateX: 0,
          translateY: 0,
          ...transformAtGrab
        };
        if (direction.x) {
          const leftTarget = positionedLeft;
          const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
          const leftDelta = leftTarget - leftAtGrab;
          const translateX = translateXAtGrab ? translateXAtGrab + leftDelta : leftDelta;
          transform.translateX = translateX;
        }
        if (direction.y) {
          const topTarget = positionedTop;
          const topAtGrab = dragGesture.gestureInfo.topAtGrab;
          const topDelta = topTarget - topAtGrab;
          const translateY = translateYAtGrab ? translateYAtGrab + topDelta : topDelta;
          transform.translateY = translateY;
        }
        dragStyleController.set(elementImpacted, {
          transform
        });
      }
    };
    dragGesture.addDragCallback(dragToMove);
  };
  const dragGestureController = createDragGestureController(options);
  const grab = dragGestureController.grab;
  dragGestureController.grab = ({
    element,
    referenceElement,
    elementToMove,
    event,
    ...rest
  } = {}) => {
    const scrollContainer = getScrollContainer(referenceElement || element);
    const [elementScrollableLeft, elementScrollableTop, convertScrollablePosition] = createDragElementPositioner(element, referenceElement, elementToMove);
    const dragGesture = grab({
      element,
      scrollContainer,
      layoutScrollableLeft: elementScrollableLeft,
      layoutScrollableTop: elementScrollableTop,
      event,
      ...rest
    });
    initGrabToMoveElement(dragGesture, {
      element,
      referenceElement,
      elementToMove,
      convertScrollablePosition
    });
    return dragGesture;
  };
  return dragGestureController;
};

/**
 * Starts a drag, for one or more of the outcomes listed.
 *
 * @param {PointerEvent} event The `pointerdown` that may become a drag.
 * @param {("move"|"reorder"|"toss"|"land")[]} effects
 *   What letting go of this element can mean. `reorder`, `toss` and `land` carry a
 *   copy; `move` carries the element itself. Asking for `move` and `reorder`
 *   together is asking one release to mean two things, and so is asking for
 *   `reorder` and `land`.
 * @param {object} [options]
 * @param {Element} [options.draggedElement=event.currentTarget]
 * @param {(detail: {gestureInfo: object, x: number, y: number}) => Promise|void} [options.onMove]
 *   It was put somewhere. The position is already committed when this runs — the
 *   hand let go of it there — and travels back if the promise rejects.
 * @param {Element} [options.containerElement=draggedElement.parentElement]
 *   Searched with `itemSelector` for the items to drop between.
 * @param {string} [options.itemSelector] What matches the items of the list.
 * @param {function} [options.getItemId] `getItemId(element) → id`.
 * @param {function} [options.onReorder]
 *   `onReorder(fromId, toId, syncCloneWithDropTarget)` — see its own note below.
 * @param {(detail: {gestureInfo: object}) => Promise|void} [options.onToss]
 *   It was thrown away. The copy leaves the screen while this runs and comes back
 *   if the promise rejects, because the thing still exists and the screen has to
 *   say so.
 * @param {function} [options.onLand]
 *   `onLand(fromId, toId, syncCloneWithDropTarget)` — it came down on `toId`, which
 *   is an element and never null: nothing under the copy is a cancelled release.
 *   The copy is held until what comes back settles, exactly like `onReorder`.
 *   `syncCloneWithDropTarget` takes an element when the place is not the shape of
 *   what stands on it: the copy then takes THAT box instead of the target's.
 * @param {number} [options.tossDistance=110] How far a throw goes, in px.
 * @param {number} [options.tossSpeed=0.45] And how fast, in px/ms. BOTH are asked
 *   for: one without the other is moving the thing while hesitating, and nothing is
 *   thrown away on a hesitation.
 *
 * Everything else is forwarded to `createDragToMoveGestureController`
 * (`areaConstraint`, `autoScrollAreaPadding`, `direction`…) and to `dragAfterIntent`
 * (`threshold`, `longPress`, `longPressDelay`, `longPressSlop`, `onPressStart`,
 * `onPressCancel`, `onPress`).
 *
 * About `onReorder`:
 * - `fromId`: id of the item that moved.
 * - `toId`: id of the item to insert before, or `null` to append at the end.
 * - `syncCloneWithDropTarget`: call it synchronously inside a
 *   `document.startViewTransition` callback, next to the DOM mutation, so the copy
 *   is captured at its landing position.
 * The gesture holds its copy until what `onReorder` returns settles, so returning
 * the transition is what makes the landing continuous.
 */
const startDragTo = (event, effects, {
  draggedElement = event.currentTarget,
  ...options
} = {}) => {
  // An area that opted out of dragging (a text one wants to select, a control that
  // owns the gesture): the press there is none of our business.
  if (event.target.closest && event.target.closest("[data-drag-ignore]")) {
    return undefined;
  }
  // A secondary button (right click and friends) is a context menu, not a grab.
  if (!isPrimaryButtonEvent(event)) {
    return undefined;
  }
  const canReorder = effects.includes("reorder");
  const canToss = effects.includes("toss");
  const canLand = effects.includes("land");
  if (canReorder || canToss || canLand) {
    return startDragToCarryCopy(event, {
      draggedElement,
      canReorder,
      canToss,
      canLand,
      ...options
    });
  }
  return startDragToMoveElement(event, {
    draggedElement,
    ...options
  });
};

/**
 * The element ITSELF is carried, and keeps the place the hand gave it.
 *
 * No copy, unlike the two others: what is being moved is the thing and not a
 * stand-in for it, so there is nothing to put back and nothing to reveal.
 */
const startDragToMoveElement = (event, {
  draggedElement,
  onMove,
  threshold,
  longPress,
  longPressDelay,
  longPressSlop,
  onPressStart,
  onPressCancel,
  onPress,
  ...options
}) => {
  event.preventDefault();
  return dragAfterIntent(event, () => {
    const gestureController = createDragToMoveGestureController({
      releasePositionEffect: "manual",
      ...options
    });
    const dragGesture = gestureController.grabViaPointer(event, {
      element: draggedElement
    });
    if (!dragGesture) {
      return null;
    }
    dragGesture.addReleaseCallback(async gestureInfo => {
      const {
        xDelta,
        yDelta
      } = gestureInfo.layout;
      if (!xDelta && !yDelta) {
        // Picked up and put back down: nothing moved, so nobody is told.
        gestureInfo.cancelPosition();
        return;
      }
      // Committed before the answer rather than after: the hand let go of it
      // there, and a thing that snaps home while a request is in flight says the
      // gesture was not understood.
      gestureInfo.commitPosition();
      try {
        await onMove?.({
          gestureInfo,
          x: xDelta,
          y: yDelta
        });
      } catch {
        gestureInfo.cancelPositionAnimated();
      }
    });
    return dragGesture;
  }, {
    threshold,
    longPress,
    longPressDelay,
    longPressSlop,
    onPressStart,
    onPressCancel,
    onPress
  });
};

// Far and fast, both at once: one without the other is moving the thing while
// hesitating, and nothing is thrown away on a hesitation — it comes back.
const TOSS_DISTANCE_TO_COMMIT = 110;
const TOSS_SPEED_TO_COMMIT = 0.45;
const resolveDropMeaning = ({
  gestureInfo,
  hasDropTarget,
  canReorder,
  canToss,
  canLand,
  tossDistance = TOSS_DISTANCE_TO_COMMIT,
  tossSpeed = TOSS_SPEED_TO_COMMIT
}) => {
  if (gestureInfo.cancelled) {
    // Nobody let go of anything: the gesture was taken away mid-air (the
    // pointer cancelled, another gesture taking it). Where the thing happened
    // to be at that moment is not a place it was put.
    return "cancel";
  }
  if (canToss) {
    const {
      xDelta,
      yDelta
    } = gestureInfo.layout;
    const distance = Math.hypot(xDelta, yDelta);
    if (distance > tossDistance && gestureInfo.velocity > tossSpeed) {
      return "toss";
    }
  }
  if (hasDropTarget) {
    if (canLand) {
      return "land";
    }
    if (canReorder) {
      return "reorder";
    }
  }
  return "cancel";
};

/**
 * A COPY of the element is carried, and the original keeps its place in the
 * layout — which is what makes a reorder possible at all: nothing else moves
 * while the hand looks for a place, so there is a stable row of items to look
 * between. A landing on a place of a board is the same, and a throw uses that copy
 * for the opposite reason: the original stays until the answer says it is really
 * gone.
 */
const startDragToCarryCopy = (event, {
  draggedElement,
  canReorder,
  canToss,
  canLand,
  // Something that can be thrown away has to be able to LEAVE. The default of
  // the layer below keeps what is dragged inside its scroll area, which is right
  // for a reorder (a row belongs to its list) and makes a throw impossible — the
  // copy hits the edge of the list and no distance is ever covered, so no throw
  // ever happens and no sideways movement is even visible.
  // Destructured with the default here rather than written at the call below: a
  // caller passing `areaConstraint: undefined` (which is what saying nothing
  // through an options object looks like) would otherwise put the layer below
  // back on its own default and undo this.
  areaConstraint = canToss ? "none" : undefined,
  containerElement = draggedElement.parentElement,
  itemSelector,
  getItemId,
  onReorder,
  onLand,
  onToss,
  tossDistance,
  tossSpeed,
  // A list runs one way and reordering walks it; a board has places all around,
  // so something landing on one of them goes wherever the hand takes it.
  direction = canLand ? {
    x: true,
    y: true
  } : {
    x: false,
    y: true
  },
  threshold,
  longPress,
  longPressDelay,
  longPressSlop,
  onPressStart,
  onPressCancel,
  onPress,
  ...options
}) => {
  // An area that opted out of dragging (a text one wants to select, a control
  // that owns the gesture): the press there is none of our business.
  if (event.target.closest && event.target.closest("[data-drag-ignore]")) {
    return undefined;
  }
  // A secondary button (right click and friends) is a context menu, not a grab.
  if (!isPrimaryButtonEvent(event)) {
    return undefined;
  }
  // One press, one carry — and the same carry over again when the hand comes back
  // for the copy while it is still flying home (see settleCloneBack). Nothing is
  // made twice in that case: it is the same copy, taken in hand again where it
  // had got to.
  const startCarry = (pointerEvent, cloneWrapperCaught, onCarryStart) => {
    pointerEvent.preventDefault();
    return dragAfterIntent(pointerEvent, () => {
      // Here and nowhere else is where a press has turned into a carry — the
      // one moment both ways in (a finger held still, a mouse travelled)
      // agree on.
      onCarryStart?.();
      const cloneWrapper = cloneWrapperCaught || createDragClone(draggedElement, pointerEvent);
      if (cloneWrapperCaught) {
        liftDragClone(cloneWrapperCaught, pointerEvent);
      }
      draggedElement.setAttribute("navi-drag-clone-source", "");
      const gestureController = createDragToMoveGestureController({
        direction,
        releasePositionEffect: "manual",
        areaConstraint,
        ...options
      });
      const dragGesture = gestureController.grabViaPointer(pointerEvent, {
        element: draggedElement,
        elementToMove: cloneWrapper
      });
      // getDropTargetInfo uses gestureInfo.elementImpacted to compute the dragged rect.
      // Point it at the clone so drop detection tracks the clone's current position.
      dragGesture.gestureInfo.elementImpacted = cloneWrapper;

      // No place to land, no hint: an element that can only be thrown away has
      // nowhere to be put. What the hint LOOKS like follows what a place is here —
      // a line in the gap between two items, or the place itself lit up.
      const dropHintEl = canLand ? createDropSurface() : canReorder ? createDropHint() : null;
      if (dropHintEl) {
        // In the container it draws into, which is where its own vars are set: the
        // shape of a drop hint is a property of the list or board it belongs to,
        // and reading it from there is inheritance rather than a hand-off.
        draggedElement.parentElement.appendChild(dropHintEl);
      }
      // The hint first, the clone second: that order is what stacks them in the
      // top layer. A copy taken back in hand is already up there, and the hint
      // just went above it — shown again it returns to the top, where what the
      // hand carries belongs.
      dropHintEl?.showPopover();
      if (cloneWrapperCaught) {
        cloneWrapper.hidePopover();
      }
      cloneWrapper.showPopover();

      // currentBeforeElement: element before which the grabbed item will be inserted (null = end)
      // currentReleaseElement: the actual hovered drop target — used to snap the clone on release
      let currentBeforeElement;
      let currentReleaseElement;
      const clearDropHintDOM = () => {
        if (!dropHintEl) {
          return;
        }
        dropHintEl.removeAttribute("data-drop-edge");
        dropHintEl.removeAttribute("data-drop-over");
        dropHintEl.style.removeProperty("--drop-target-top");
        dropHintEl.style.removeProperty("--drop-target-bottom");
        dropHintEl.style.removeProperty("--drop-target-left");
        dropHintEl.style.removeProperty("--drop-target-width");
        dropHintEl.style.removeProperty("--drop-target-height");
      };
      const clearDropHint = () => {
        currentBeforeElement = undefined;
        currentReleaseElement = undefined;
        clearDropHintDOM();
      };
      dragGesture.addDragCallback(gestureInfo => {
        if (!dropHintEl) {
          return;
        }
        const allItems = [];
        const items = [];
        for (const el of containerElement.querySelectorAll(itemSelector)) {
          allItems.push(el);
          if (el !== draggedElement) {
            items.push(el);
          }
        }
        const dropTargetInfo = getDropTargetInfo(gestureInfo, items, {
          // The edges of a LIST: above the first row means the top of it, below
          // the last one means the end of it. A board has no such reading — away
          // from every place is away from every place.
          fallbackToEdge: !canLand
        });
        gestureInfo.dropTargetInfo = dropTargetInfo || null;
        if (!dropTargetInfo) {
          clearDropHint();
          return;
        }
        if (canLand) {
          // The whole element is the target, so which of its edges the copy came
          // in by says nothing: there is no gap to be on one side of.
          const dropElement = dropTargetInfo.element;
          if (dropElement === currentReleaseElement) {
            return;
          }
          currentReleaseElement = dropElement;
          const dropRect = dropElement.getBoundingClientRect();
          dropHintEl.setAttribute("data-drop-over", "");
          dropHintEl.style.setProperty("--drop-target-top", `${dropRect.top}px`);
          dropHintEl.style.setProperty("--drop-target-left", `${dropRect.left}px`);
          dropHintEl.style.setProperty("--drop-target-width", `${dropRect.width}px`);
          dropHintEl.style.setProperty("--drop-target-height", `${dropRect.height}px`);
          return;
        }
        // Convert {element, edge} to a beforeElement using the items array
        // (not nextElementSibling, which breaks if non-item elements exist between items).
        //   edge "start" → insert before the hovered element
        //   edge "end"   → insert before the next item (null = append at end)
        const edge = dropTargetInfo.elementSide.y;
        const hoveredIndex = items.indexOf(dropTargetInfo.element);
        const beforeElement = edge === "start" ? dropTargetInfo.element : items[hoveredIndex + 1] ?? null;
        // Detect no-op: result would leave the grabbed element in the same position.
        const elementIndex = allItems.indexOf(draggedElement);
        const elementNextItem = allItems[elementIndex + 1] ?? null;
        const isNoop = beforeElement === elementNextItem;
        if (isNoop) {
          clearDropHint();
          return;
        }
        // Early return if nothing changed.
        const releaseElement = dropTargetInfo.element;
        if (beforeElement === currentBeforeElement && releaseElement === currentReleaseElement) {
          return;
        }
        currentBeforeElement = beforeElement;
        currentReleaseElement = releaseElement;
        // Update drop hint CSS vars.
        // beforeElement = null → insert at end (hint after last item)
        // beforeElement = X    → insert before X (hint at top edge of X)
        const anchorEl = beforeElement || items[items.length - 1];
        const anchorEdge = beforeElement !== null ? "top" : "bottom";
        // Viewport coordinates, straight from the anchor row: the hint is fixed
        // in the page (see its CSS), so there is no container box to be relative
        // to and no scroll offset to add back.
        const anchorRect = anchorEl.getBoundingClientRect();
        dropHintEl.setAttribute("data-drop-edge", anchorEdge);
        dropHintEl.style.setProperty("--drop-target-top", `${anchorRect.top}px`);
        dropHintEl.style.setProperty("--drop-target-bottom", `${anchorRect.bottom}px`);
        dropHintEl.style.setProperty("--drop-target-left", `${anchorRect.left}px`);
        dropHintEl.style.setProperty("--drop-target-width", `${anchorRect.width}px`);
      });
      dragGesture.addReleaseCallback(async gestureInfo => {
        clearDropHintDOM();
        dropHintEl?.remove();

        // What THIS release means, from what the element said it can answer. A
        // throw is asked about first: it is the more insistent of the two, and a
        // hand that sent the thing across the screen has not asked for it to swap
        // places with whatever it happened to fly over.
        const hasDropTarget = canLand ? currentReleaseElement !== undefined : currentBeforeElement !== undefined;
        const dropMeans = resolveDropMeaning({
          gestureInfo,
          hasDropTarget,
          canReorder,
          canToss,
          canLand,
          tossDistance,
          tossSpeed
        });

        // Let go of and still on the screen: from here until it is taken away
        // the copy can be taken back in hand (see letCopyBeCaught).
        const copyLetGoOf = letCopyBeCaught(cloneWrapper, (pointerDownEvent, whenCarried) => startCarry(pointerDownEvent, cloneWrapper, whenCarried));

        // The copy stops where the hand left it, and the answer is given a way to
        // take it the rest of the way — synchronously, inside a view transition, so
        // it is captured where it lands rather than where it was let go of.
        const landCopyOn = async (targetElement, answer) => {
          const clone = cloneWrapper.firstElementChild;
          // Bake the current visual position (transform included) into the CSS vars
          // so the copy stays where the user released it when the transform goes.
          setCloneViewportRect(cloneWrapper, cloneWrapper);
          gestureInfo.cancelPosition();
          // Where the copy comes down is not always the thing it came down ON: a
          // place of a board can be larger than what stands on it, and the copy
          // has to keep its own size and land where the item will be. Said with
          // an element, because the caller has one — the piece already standing
          // there, the empty slot waiting.
          const syncCloneWithDropTarget = (landingElement = targetElement) => {
            setCloneViewportRect(cloneWrapper, landingElement);
            // Removing this attr drops the CSS scale, so the browser captures the
            // copy at scale 1 as the "new" state.
            clone.removeAttribute("navi-drag-clone");
          };
          await answer(syncCloneWithDropTarget);
        };
        if (dropMeans === "toss") {
          // Bake the position the hand left it at, so the flight starts from
          // there rather than from where the clone was declared.
          setCloneViewportRect(cloneWrapper, cloneWrapper);
          gestureInfo.cancelPosition();
          const gone = await tossCloneAway(cloneWrapper, gestureInfo, onToss);
          if (!gone) {
            // It still exists, so the screen has to say so: the copy comes back
            // over the original, and taking it away then reveals the row in
            // place.
            await settleCloneBack(cloneWrapper, draggedElement);
          }
        } else if (dropMeans === "land") {
          await landCopyOn(currentReleaseElement, syncCloneWithDropTarget => onLand(getItemId(draggedElement), getItemId(currentReleaseElement), syncCloneWithDropTarget));
        } else if (dropMeans === "reorder") {
          await landCopyOn(currentReleaseElement, syncCloneWithDropTarget => onReorder(getItemId(draggedElement), currentBeforeElement ? getItemId(currentBeforeElement) : null, syncCloneWithDropTarget));
        }
        if (await copyLetGoOf.settled()) {
          // In a hand again: the copy, and the place kept for it, are the new
          // gesture's — this one has nothing left to take away.
          return;
        }
        draggedElement.removeAttribute("navi-drag-clone-source");
        cloneWrapper.remove();
      });
      return dragGesture;
    }, {
      threshold,
      // A copy caught on its way home is not an ambiguous press: the hand
      // reached for something moving, and the press was already matched
      // against the copy's own box before it got here. The wait a finger is
      // asked for elsewhere tells a scroll from a drag, and there is no scroll
      // to tell it from — the copy covers that spot from the top layer. Asked
      // for anyway it cannot even be answered: the wait is about as long as the
      // journey, so the thing is home before the proof is done, while a mouse
      // takes it in five pixels.
      longPress: cloneWrapperCaught ? false : longPress,
      longPressDelay,
      longPressSlop,
      onPressStart,
      onPressCancel,
      onPress
    });
  };
  return startCarry(event);
};

// Viewport coordinates, as getBoundingClientRect gives them: the clone is a
// fixed-position popover, so that is the space it lives in — and the one the
// pointer dragging it works in too.
const setCloneViewportRect = (cloneWrapper, el) => {
  const rect = el.getBoundingClientRect();
  cloneWrapper.style.setProperty("--clone-top", `${rect.top}px`);
  cloneWrapper.style.setProperty("--clone-left", `${rect.left}px`);
  cloneWrapper.style.setProperty("--clone-width", `${rect.width}px`);
  cloneWrapper.style.setProperty("--clone-height", `${rect.height}px`);
};

// Creates the two-layer clone structure used for drag-to-reorder.
//
// Layer 1 — wrapper (navi-drag-clone-wrapper):
//   Positioned absolutely via --clone-top/--clone-left CSS vars.
//   Carries the box-shadow and size. Moved every drag frame via dragStyleController.
//   Has a view-transition-name so the View Transitions API can animate it on release.
//
// Layer 2 — inner clone (navi-drag-clone):
//   A deep clone of the grabbed element.
//   Applies transform: scale(1.15) via the CSS rule for [navi-drag-clone],
//   giving the "lifted" feel. The transform-origin is set to the grab point
//   so the element expands naturally from where the user clicked.
//   On release, the `navi-drag-clone` attribute is removed inside
//   startViewTransition to drop the scale back to 1 as the "new" state.

// The chevron is the one the table's column drop preview uses, rotated by the
// CSS above so each cap points into the line.
const dropHintTemplate = /* html */`
  <div
    class="navi_drop_hint"
    popover="manual"
  >
    <span class="navi_drop_hint_cap" data-side="start">
      <svg fill="currentColor" viewBox="0 0 30.727 30.727">
        <path
          d="M29.994,10.183L15.363,24.812L0.733,10.184c-0.977-0.978-0.977-2.561,0-3.536c0.977-0.977,2.559-0.976,3.536,0l11.095,11.093L26.461,6.647c0.977-0.976,2.559-0.976,3.535,0C30.971,7.624,30.971,9.206,29.994,10.183z"
        />
      </svg>
    </span>
    <span class="navi_drop_hint_cap" data-side="end">
      <svg fill="currentColor" viewBox="0 0 30.727 30.727">
        <path
          d="M29.994,10.183L15.363,24.812L0.733,10.184c-0.977-0.978-0.977-2.561,0-3.536c0.977-0.977,2.559-0.976,3.536,0l11.095,11.093L26.461,6.647c0.977-0.976,2.559-0.976,3.535,0C30.971,7.624,30.971,9.206,29.994,10.183z"
        />
      </svg>
    </span>
  </div>
`;
const createDropHint = () => {
  const div = document.createElement("div");
  div.innerHTML = dropHintTemplate.trim();
  return div.firstElementChild;
};
const createDropSurface = () => {
  const div = document.createElement("div");
  div.className = "navi_drop_surface";
  // Manual, like the copy it accompanies: it is opened and closed with the drag
  // and must survive an Escape or a click elsewhere.
  div.setAttribute("popover", "manual");
  return div;
};

/**
 * The copy leaves the screen the way it was thrown, and the caller says what that
 * meant. Resolves true when it is really gone.
 *
 * The answer is asked for WHILE it flies rather than after: the thing is already
 * far away by the time the request lands, which is the whole point of a gesture
 * that means "get rid of this" — nobody waits to watch it go.
 */
const tossCloneAway = async (cloneWrapper, gestureInfo, onToss) => {
  const {
    xDelta,
    yDelta
  } = gestureInfo.layout;
  const distance = Math.hypot(xDelta, yDelta) || 1;
  cloneWrapper.dataset.tossed = "away";
  cloneWrapper.style.translate = `${xDelta / distance * TOSS_DISTANCE}px ${yDelta / distance * TOSS_DISTANCE}px`;
  try {
    await onToss?.({
      gestureInfo
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * It comes back where it came from, and only then is taken away — which is what
 * makes the original reappear in place rather than blink back into it.
 *
 * Flown home on `translate` rather than by rewriting the position vars: the vars
 * hold where the hand let go, the transition is on translate, and moving the vars
 * would put the copy there instantly instead of taking it there.
 */
const settleCloneBack = (cloneWrapper, sourceElement) => {
  const sourceRect = sourceElement.getBoundingClientRect();
  const releaseLeft = parseFloat(cloneWrapper.style.getPropertyValue("--clone-left"));
  const releaseTop = parseFloat(cloneWrapper.style.getPropertyValue("--clone-top"));
  cloneWrapper.dataset.tossed = "back";
  cloneWrapper.style.translate = `${sourceRect.left - releaseLeft}px ${sourceRect.top - releaseTop}px`;
  return new Promise(resolve => {
    setTimeout(resolve, TOSS_DURATION_MS);
  });
};

/**
 * The copy is let go of, and it is still there: flying home, coming down on a
 * place, waiting on an answer. It is still the object for all that time — a hand
 * reaching for it there is reaching for the thing, and the answer is to give it
 * back.
 *
 * Left alone the press finds nothing: the copy does not take the pointer (it must
 * not, while it is carried, or it would hide what it is being dropped on) and the
 * original is hidden underneath it. The press falls through to the page, which
 * answers a held finger with the system context menu — on the very gesture that
 * meant "I am taking it back". So the copy takes the pointer for exactly this
 * stretch of the gesture, and for no other.
 *
 * It is not stopped where it is caught: it finishes what it was doing under the
 * hand and is picked up from wherever it got to, which is where it visibly is —
 * a press has to be held a moment before it counts as a carry, about as long as
 * these journeys last. What catching it does change is that the copy is not taken
 * away while a hand is on it: `settled()` waits the press out, so a carry has the
 * time to be born.
 *
 * THE PRESS IS READ AT THE DOCUMENT, and the copy's own box is only the shape it
 * is matched against. A press landing on it does not always reach it: an answer
 * that runs a view transition (which is the usual answer — it is what makes a
 * landing continuous) has the browser cover the page with its pictures, and every
 * press then goes to the document root whatever those pictures are told about
 * pointer events. Read from the document and matched against the box, it is
 * caught either way. Same reason, same shape as the box of travelling pages
 * (see route_travel.jsx in navi).
 *
 * @returns {{settled: function}} `settled()` resolves to whether the copy was
 * taken back in hand — and then it belongs to the new gesture, not to this one.
 */
const letCopyBeCaught = (cloneWrapper, carryAgain) => {
  let caught = false;
  let pressIsOver = Promise.resolve();
  const onPointerDown = pointerDownEvent => {
    const {
      left,
      right,
      top,
      bottom
    } = cloneWrapper.getBoundingClientRect();
    const {
      clientX,
      clientY
    } = pointerDownEvent;
    if (clientX < left || clientX > right || clientY < top || clientY > bottom) {
      // Somewhere else on the page: this press is not about the copy.
      return;
    }
    let pressIsOverResolve;
    pressIsOver = new Promise(resolve => {
      pressIsOverResolve = resolve;
    });
    const onPointerEnd = () => {
      window.removeEventListener("pointerup", onPointerEnd, true);
      window.removeEventListener("pointercancel", onPointerEnd, true);
      pressIsOverResolve();
    };
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);
    carryAgain(pointerDownEvent, () => {
      caught = true;
      onPointerEnd();
    });
  };
  // The attribute is what gives the copy the pointer (see the stylesheet): read
  // at the document or not, a press meant for the copy must land ON it, so the
  // gesture holds what it grabbed rather than whatever was behind.
  cloneWrapper.setAttribute("data-catchable", "");
  document.addEventListener("pointerdown", onPointerDown, true);
  // The touch half of the same reach, said on the root because that is where a
  // finger pressing through the pictures lands (see the stylesheet). Both go
  // down before the copy sets off, since what a touch may do is settled when it
  // begins: put down later, the press is still read, the carry still starts, and
  // the browser cancels the pointer one move afterwards — a copy that cannot be
  // caught with a finger and can with a mouse.
  const root = document.documentElement;
  root.setAttribute("data-drag-catchable", "");
  root.addEventListener("touchmove", keepTouchRefusable, {
    passive: false
  });
  return {
    settled: async () => {
      // A hand that lets go and presses again while the copy is still there is
      // one more press to wait out, not a press that was already over.
      let awaited;
      while (awaited !== pressIsOver) {
        awaited = pressIsOver;
        await awaited;
      }
      cloneWrapper.removeAttribute("data-catchable");
      document.removeEventListener("pointerdown", onPointerDown, true);
      root.removeAttribute("data-drag-catchable");
      root.removeEventListener("touchmove", keepTouchRefusable);
      return caught;
    }
  };
};

// What a copy is given when it is picked up: the point it lifts FROM, and the
// lift itself. Both are lost by a copy that has already been let go of — a
// landing drops the lift (see syncCloneWithDropTarget) and the hand catching it
// again is somewhere else on it — so taking one back hands it both again.
const liftDragClone = (cloneWrapper, pointerEvent) => {
  const rect = cloneWrapper.getBoundingClientRect();
  cloneWrapper.style.setProperty("--drag-origin", `${pointerEvent.clientX - rect.left}px ${pointerEvent.clientY - rect.top}px`);
  cloneWrapper.firstElementChild.setAttribute("navi-drag-clone", "");
};
const createDragClone = (element, pointerEvent) => {
  const rect = element.getBoundingClientRect();
  const wrapper = document.createElement("div");
  wrapper.setAttribute("navi-drag-clone-wrapper", "");
  // A copy can be caught on its way home (see settleCloneBack), which is a press
  // that may become a drag — so it carries what such a press needs, and it
  // carries it from the moment it exists: what a touch may do is decided when the
  // touch begins, and by then this has to have been true for a while.
  markDragSource(wrapper);
  // Manual: it is opened and closed with the drag, and must survive an Escape
  // or a click elsewhere (light dismiss would take it away mid-gesture).
  wrapper.setAttribute("popover", "manual");
  wrapper.viewTransitionName = "navi-drag-clone-wrapper";
  setCloneViewportRect(wrapper, element);
  // Grab point within the element — used as transform-origin so the
  // scale(1.15) expands from where the user clicked, not the element center.
  // These offsets are element-relative so viewport coords are correct here.
  wrapper.style.setProperty("--drag-origin", `${pointerEvent.clientX - rect.left}px ${pointerEvent.clientY - rect.top}px`);
  const elementClone = element.cloneNode(true);
  // A deep copy copies the ids too, and two elements answering to one id is a
  // document that lies: getElementById picks whichever comes first, an anchor
  // resolves to the wrong one, a view-transition-name is claimed twice and the
  // transition is dropped. The copy is a picture of the thing, not another one of
  // it — so it answers to no name at all.
  elementClone.removeAttribute("id");
  for (const descendantWithId of elementClone.querySelectorAll("[id]")) {
    descendantWithId.removeAttribute("id");
  }
  elementClone.setAttribute("navi-drag-clone", "");
  // What is held is the copy, so it is the copy that must LOOK held: the caller
  // dresses `[data-grabbed]` on its own element once, and the copy is that element.
  // (The original wears it too, but it is hidden — see navi-drag-clone-source.)
  elementClone.setAttribute("data-grabbed", "");
  elementClone.style.viewTransitionName = "navi-drag-clone";
  wrapper.appendChild(elementClone);
  // Beside the thing it copies, so it stands where that thing stands: every
  // inherited value and every custom property the original reads, the copy reads
  // too, and a rule written for an item in this list finds the copy as well. The
  // top layer is what lets it stay there — a popover is painted above the page
  // whatever its depth in the tree, and being fixed keeps it out of the
  // scrollable overflow of the list it sits in.
  element.parentElement.appendChild(wrapper);
  return wrapper;
};

const startDragToResizeGesture = (
  pointerdownEvent,
  { onDragStart, onDrag, onRelease, ...options },
) => {
  const target = pointerdownEvent.target;
  if (!target.closest) {
    return null;
  }
  const elementWithDataResizeHandle = target.closest("[data-resize-handle]");
  if (!elementWithDataResizeHandle) {
    return null;
  }
  let elementToResize;
  const dataResizeHandle =
    elementWithDataResizeHandle.getAttribute("data-resize-handle");
  if (!dataResizeHandle || dataResizeHandle === "true") {
    elementToResize = elementWithDataResizeHandle.closest("[data-resize]");
  } else {
    elementToResize = document.querySelector(`#${dataResizeHandle}`);
  }
  if (!elementToResize) {
    console.warn("No element to resize found");
    return null;
  }
  // inspired by https://developer.mozilla.org/en-US/docs/Web/CSS/resize
  // "horizontal", "vertical", "both"
  const resizeDirection = getResizeDirection(elementToResize);
  if (!resizeDirection.x && !resizeDirection.y) {
    return null;
  }

  const dragToResizeGestureController = createDragGestureController({
    onDragStart: (...args) => {
      onDragStart?.(...args);
    },
    onDrag,
    onRelease: (...args) => {
      elementWithDataResizeHandle.removeAttribute("data-active");
      onRelease?.(...args);
    },
  });
  elementWithDataResizeHandle.setAttribute("data-active", "");
  const dragToResizeGesture = dragToResizeGestureController.grabViaPointer(
    pointerdownEvent,
    {
      element: elementToResize,
      direction: resizeDirection,
      cursor:
        resizeDirection.x && resizeDirection.y
          ? "nwse-resize"
          : resizeDirection.x
            ? "ew-resize"
            : "ns-resize",
      ...options,
    },
  );
  return dragToResizeGesture;
};

const getResizeDirection = (element) => {
  const direction = element.getAttribute("data-resize");
  const x = direction === "horizontal" || direction === "both";
  const y = direction === "vertical" || direction === "both";
  return { x, y };
};

installImportMetaCssBuild(import.meta);/**
 * What a drag means when it TRAVELS: a whole screen pushed aside to bring in the
 * next one — slides inside one box, pages that are URLs.
 *
 * The pointer itself is not read here: reading a press, waiting for it to become
 * a gesture, capturing it, measuring how fast it goes, swallowing the click it
 * would have made is one gesture system for the whole codebase
 * (@jsenv/dom's drag_gesture + drag_after_intent), and this asks it for the
 * plain version — nothing carried, so no backdrop over the page, nothing made
 * inert, no focus taken: a screen slides and the page keeps its scrolling and
 * its keyboard.
 *
 * What IS here is everything that makes a travel a travel rather than a
 * carry — and it is policy, not plumbing:
 * - the axis is LOCKED by the first movement, instead of being constrained
 *   ahead of time;
 * - a press becomes a gesture by distance for every pointer, finger included:
 *   a swipe is a travel, and asking a finger to hold still first (the rule for
 *   picking an object up) would mean waiting before being allowed to swipe;
 * - what travels walks ONE BOX, resists past its ends, and is measured from
 *   where the finger is once it gets there — unless the caller has another box
 *   to offer at that edge, and then the gesture walks on into it;
 * - letting go is a question with an answer: a third of a box, or a flick.
 *
 * What is NOT here is geometry: how big a box is, what lies one step that way,
 * what to paint while the finger moves. The caller knows those and nothing else
 * does — this reads the gesture and calls back.
 *
 * Who owns a gesture is decided in three places, and all three are read here:
 * - what says so itself, with [data-no-drag-travel] or by being a field — a
 *   component that reads the pointer marks itself, because the container it
 *   ends up in cannot know what it is;
 * - a scroller between the pointer and the box with room left that way, which
 *   keeps the gesture until it has none;
 * - another box that travels, between the pointer and this one: the innermost
 *   one walks the axis it walks, and leaves the others whatever axis it does
 *   not (see axesLeftBy).
 */

// While a pointer is on something that travels: said on the document, because
// what has to be told is the document.
const GESTURE_ATTRIBUTE = "data-drag-travel-gesture";

// …and while one is actually travelling something, which is a later moment and
// takes more away (see the CSS).
const WALKING_ATTRIBUTE = "data-drag-travel-walking";
import.meta.css = [/* css */`
  :root[${GESTURE_ATTRIBUTE}] {
    /* The bounce the browser plays when a gesture reaches the end of a page —
       and the swipe that goes back in history with it. Both are the browser
       answering a gesture that is already answered, here, by what the finger is
       dragging: the page rocks under a travel that is doing its own moving, and
       one gesture is seen twice. From the press, because the browser starts
       answering from the press — waiting for the first pixel that travels would
       let it happen once, every time. Only while a finger is down, so a page
       that bounces the rest of the time goes on bouncing. */
    overscroll-behavior: none;
  }
  /* …and nothing inside a travelling box hands its leftovers to what is above
     it: a list that reaches its end passes what is left of the gesture up the
     chain, and the page moves behind a travel that is being dragged.

     Written ONCE AND FOR ALL rather than while a finger is down, unlike
     everything else here: a browser decides what a gesture may do when the
     gesture BEGINS — at the touchstart, at the first wheel event — and a
     property written after that decision arrives too late for the gesture it
     was meant for. That is what "most of the time it does not move, sometimes
     it does" is made of.

     On the axis the box travels on, and that one only: the other axis is the
     content's own scrolling and is left alone. Containing does not stop it from
     scrolling anyway — it stops it from spilling over.

     !important because this is not a preference: a box that travels cannot let
     the page travel with it, and the rule has to win over whatever an
     application says about its own scrollers.

     Said on the box, where it is a statement about the box and not about what
     it happens to hold — and read only where a browser asks the box at all:
     one that CLIPS is asked (it is a scroll container, which is what "asked"
     means to a browser), one that does not is walked past. A box that travels
     usually clips, because moving something in and out of a box is what
     clipping is for. One that does not still travels — what an inner scroller
     has left over reaches the page there, and the rule below says why that is
     the lesser of the two prices. An application that knows which of ITS
     elements scroll can contain those itself, on the element every engine
     reads; nothing in here can know that from a stylesheet. */
  [data-drag-travel*="x"] {
    overscroll-behavior-x: contain !important;
  }
  [data-drag-travel*="y"] {
    overscroll-behavior-y: contain !important;
  }
  /* The scrollers a browser makes on its own, wherever they are inside the box:
     a textarea and a list of options scroll their own content by nature, and
     nobody had to say so for them — no stylesheet declared them, so nothing
     else here can find them, and they would hand what is left of a gesture to
     the page like any undeclared scroller does.

     Named rather than found, because being native is exactly what makes them
     nameable. An input is NOT in the list: it is the one form control that has
     nothing to scroll on the axis anything travels on, and containing it is how
     a row-wide invisible checkbox becomes a hole under the wheel.

     A textarea with nothing in it, or a list of options short enough to fit, is
     contained too — a browser cannot be asked "only if it scrolls". On Blink
     that costs a wheel over an empty textarea, which then moves nothing rather
     than the list around it; elsewhere the engine already only asks what
     scrolls. Worth the page not moving behind a travel. */
  [data-drag-travel*="x"] :is(textarea, select[multiple], select[size]) {
    overscroll-behavior-x: contain !important;
  }
  [data-drag-travel*="y"] :is(textarea, select[multiple], select[size]) {
    overscroll-behavior-y: contain !important;
  }
  /* The same thing said again to everything inside — and only where saying it
     is what works.

     Two readings of "contain" are out there, and the rule above lands in only
     one of them. Blink walks EVERY scroll container between the pointer and the
     page and asks each one whether the gesture may go past it, whether or not
     it had anything to scroll: the box above is asked, and containing it is the
     whole answer. Gecko and WebKit ask only the ones that actually scroll: the
     box is skipped (it travels, it does not scroll), and what is left of a
     list's gesture reaches the page unless the LIST itself was told — which is
     what this does, to everything, because which descendant scrolls is not
     something a stylesheet can know.

     Not said to Blink, where it is not needed and does harm: an element that
     clips is a scroll container to a browser (a line of text with an ellipsis,
     a rounded card, an invisible checkbox covering a row), and Blink asking one
     of those with nothing to scroll gets "no further" for an answer — the wheel
     stops there and the list right above it never moves. A dead zone under the
     pointer, wherever something inside the box happens to clip.

     Blink is told apart by a property only it has, rather than by reading a user
     agent: the split above is between engines, and -webkit-app-region is one of
     the few things that names one. */
  @supports not (-webkit-app-region: none) {
    [data-drag-travel*="x"] * {
      overscroll-behavior-x: contain !important;
    }
    [data-drag-travel*="y"] * {
      overscroll-behavior-y: contain !important;
    }
  }
`, "@jsenv/dom/src/interaction/drag/drag_to_travel.js"];

// How far a pointer goes before it is a travel rather than a click: below this
// a press that wandered a pixel is still a press, and nothing budges.
const DRAG_START_THRESHOLD = 10;
// How much of a box has to be pulled for letting go to carry on rather than put
// things back, when the caller does not say. Under half, because a gesture that
// has clearly begun is an intention: asking for the box to be dragged all the
// way across turns a travel into work.
const DRAG_COMMIT_RATIO = 0.3;
// A flick travels whatever the distance: the hand said "away" quickly, which is
// the whole gesture — px/ms of pointer, and a few pixels to tell it from a tap
// that shook.
const DRAG_FLICK_VELOCITY = 0.4;
const DRAG_FLICK_DISTANCE = 8;
// Pulling towards nothing: what travels follows at a fraction of the finger, so
// the gesture is answered (something moves) while saying there is nothing that
// way. Let go and it comes back — a wall one can lean on, never walk through.
const DRAG_RESISTANCE = 0.3;

// What a drag must not start on: something that reads the pointer itself, whole,
// with no axis left to share. A button or a link is not in the list — dragging
// from one travels, and the click it would have made is swallowed on the way
// out. A drag SOURCE is not either: it says which way it goes and only takes
// that (see DRAG_SOURCE_AXES_ATTRIBUTE) — but a dedicated handle is, being a
// place whose only purpose is to be taken hold of, from the first pixel.
const DRAG_EXCLUDED_SELECTOR = ["input", "textarea", "select", '[contenteditable=""]', '[contenteditable="true"]', "[data-drag-handle]", "[data-no-drag-travel]"].join(",");

// Which axes a box travels on, one attribute per gesture, said in the DOM by
// whoever owns the box: it is what a box ABOVE another reads to know the
// gesture is not its own, and the DOM is the only place where that is knowable
// from the outside.
const DRAG_AXES_ATTRIBUTE = "data-travel-by-drag";
const WHEEL_AXES_ATTRIBUTE = "data-travel-by-wheel";
// The same thing said by something that is PICKED UP rather than travelled: a
// row taken out of a list, a card carried across a board (see markDragSource).
// It holds the pointer from the press exactly as a nested travel does, so it is
// read exactly as one — a list reordered along its own line takes the axis it
// runs on and leaves the other to whoever is above.
const DRAG_SOURCE_AXES_ATTRIBUTE = "data-drag-source";

// A surface the browser paints in the top layer: it is still a DOM descendant
// of whatever it was written in, and it is nowhere near it on screen — it
// covers everything. So a gesture that happened on it is not the gesture of any
// box it merely sits on top of, and every walk up the tree from the pointer
// ends here: the boxes above are behind, and behind is not under the finger.
const TOP_LAYER_SELECTOR = [":popover-open", "dialog:modal", ":fullscreen"].join(",");
const isTopLayer = element => {
  return element.matches(TOP_LAYER_SELECTOR);
};

/**
 * What is left for this box of the axes it travels, once the boxes it CONTAINS
 * have taken theirs: a row of slides inside a page that walks between pages, a
 * carousel inside a carousel. Both get the same press (it bubbles), both answer
 * the same finger, and the one under it is the one the hand is pointing at — so
 * the innermost takes the axes it walks, and what it does not walk is left to
 * whoever is above: a row swiped sideways inside a column of screens keeps the
 * sideways gesture, and the column still answers a finger going down.
 *
 * Read at the press and nowhere else, because that is the only moment where the
 * order is still ours: from the first pixel the gesture is held by whoever asked
 * the browser for the pointer LAST, which is the outermost box — the wrong one,
 * and past that point the inner one stops being told anything. So the box that
 * does not own the gesture must never ask for it.
 *
 * A box lifted into the top layer on the way up takes everything: a popover or a
 * modal dialog is written inside a slide and painted over the whole screen, so
 * the slides are nowhere near the finger and none of the axes are left.
 */
const axesLeftBy = (axes, fromElement, stopElement, attribute) => {
  if (!stopElement.contains(fromElement)) {
    // Not a press that came up through this box: a browser view transition
    // delivers one to the document root instead, and the caller hands it over
    // by hand. Nothing was walked past, so nothing was taken.
    return axes;
  }
  let left = axes;
  let element = fromElement;
  while (element && element !== stopElement && element.nodeType === 1) {
    if (isTopLayer(element)) {
      // The gesture happened on a surface painted over this box, not in it:
      // there is nothing left of it here, whatever axes are still unclaimed.
      return "";
    }
    const taken = element.getAttribute(attribute);
    if (taken) {
      let rest = "";
      for (const axis of left) {
        if (!taken.includes(axis)) {
          rest += axis;
        }
      }
      left = rest;
      if (!left) {
        return "";
      }
    }
    element = element.parentElement;
  }
  return left;
};

/**
 * A scroller between the pointer and the box it is in, with room left the way
 * the gesture goes: it gets the gesture, and nothing travels — dragging a row
 * that scrolls sideways scrolls that row, and only a row with nowhere left to
 * go hands the travel over.
 */
const scrollRoomTowards = (fromElement, stopElement, axis, sign) => {
  let element = fromElement;
  while (element && element !== stopElement && element.nodeType === 1) {
    if (isTopLayer(element)) {
      // A scroller above a top-layer surface is painted behind it: whatever
      // room it has left is not room the finger is asking for.
      return false;
    }
    const size = axis === "x" ? element.clientWidth : element.clientHeight;
    const scrollSize = axis === "x" ? element.scrollWidth : element.scrollHeight;
    if (scrollSize > size + 1) {
      const {
        overflowX,
        overflowY
      } = getComputedStyle(element);
      const overflow = axis === "x" ? overflowX : overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        const position = axis === "x" ? element.scrollLeft : element.scrollTop;
        // Dragging the content one way reveals what is on the other side of
        // it: to the right means going back up the scroll.
        const room = sign > 0 ? position : scrollSize - size - position;
        if (room > 1) {
          return true;
        }
      }
    }
    element = element.parentElement;
  }
  return false;
};

// A gesture is over: does it carry on, or does everything go back? The distance
// pulled says it, and the speed says it too — a short flick means "away" as
// clearly as half a box does.
const travelsAfter = ({
  pulled,
  slack,
  size,
  velocity,
  towardsSomething,
  commitRatio
}) => {
  if (!towardsSomething) {
    return false;
  }
  // Caught in flight and let go of again without a word: what was on its way
  // carries on. Answered on the distance alone, a travel a hand merely touched
  // is undone BY the touch — it was stopped where it stood, and where it stood
  // is not far enough to count as an intention. Nobody asked it to stop; it was
  // asked to wait.
  if (slack && Math.abs(pulled - slack) < DRAG_START_THRESHOLD) {
    return true;
  }
  const sign = pulled > 0 ? 1 : -1;
  const goingFast = Math.abs(velocity) > DRAG_FLICK_VELOCITY;
  // A hand that is still moving says where it is going, and it says it about
  // BOTH answers. Going away from what it was bringing in is "put it back",
  // whatever the distance already covered — which is the whole of what one asks
  // for when catching something in flight and throwing it back the other way.
  // Without this the picture alone decides, and a screen caught at two thirds
  // and thrown back still arrives: the gesture was read as the place it was let
  // go of rather than as a movement.
  if (goingFast && Math.sign(velocity) !== sign) {
    return false;
  }
  // …and going towards it travels whatever the distance: the hand said "away"
  // quickly, which is the whole gesture.
  const flicked = goingFast && Math.abs(pulled) > DRAG_FLICK_DISTANCE;
  return flicked || Math.abs(pulled) > size * commitRatio;
};

/**
 * Read a press, and tell the caller what the hand is doing with it.
 *
 * Called on pointerdown; returns a handle to stop the gesture, or null when the
 * press is not one this can be about (a right click, something that reads the
 * pointer itself).
 *
 * The gesture has no shape until the finger says which way it goes: `onStart`
 * is what turns a press into a travel, and it is asked at that moment rather
 * than when the finger landed, because whatever was moving then may have
 * arrived since.
 *
 * @param {PointerEvent} pointerDownEvent
 * @param {object} options
 * @param {Element} options.element - the box the gesture is about, and what the
 *   pointer is captured on: it outlives whatever the caller does about the
 *   travel, which the element under the finger may not.
 * @param {"x"|"y"|"xy"} [options.axes="xy"] - which ways this box can travel. A
 *   finger leaning on any other axis is given up on at once, whole, so whatever
 *   else wants it (a scroller, the page) gets it whole. An axis a box NESTED in
 *   this one travels is not one of them: it is that box's, and this call
 *   returns null when nothing is left (see axesLeftBy). Say so in the DOM with
 *   [data-travel-by-drag] for the boxes above to read.
 * @param {false|"x"|"y"} [options.immediate=false] - the axis this press is
 *   already on, for a press that landed on something moving: the gesture is
 *   then read from its first pixel instead of waiting for an intent, and every
 *   pixel since the grab is owed to the hand. The axis comes from the caller
 *   rather than from the movement, because there is nothing to decide — what
 *   was caught is travelling on one already.
 * @param {number} [options.commitRatio=0.3] - what fraction of the box has to
 *   be pulled for letting go to carry on rather than put things back. A
 *   fraction and never a distance, so the same gesture asks for the same thing
 *   on a phone and on a wide screen. Speed still answers on its own (see
 *   travelsAfter), whatever this says.
 * @param {(detail: {axis: string, sign: number, target: Element, event: PointerEvent}) => false|{size: number, slack?: number, travelBack?: boolean, travelOn?: boolean}} options.onStart
 *   - the finger has picked its axis. Answer `false` to give the gesture up, or
 *   with the geometry it walks: `size` (one box along that axis), `slack` (how
 *   far the box already sits from its resting place, for a travel grabbed
 *   mid-flight) and whether there is anywhere to go each way — `travelBack`
 *   towards the start of the axis, `travelOn` towards its end. A direction with
 *   nothing there is not refused, it resists.
 * @param {(detail: {axis: string, pulled: number, size: number, progress: number, event: PointerEvent}) => void} options.onPull
 *   - the finger has moved. `pulled` is in px from the resting place, `progress`
 *   the same as a fraction of the box, signed the same way.
 * @param {(detail: {axis: string, sign: number, event: PointerEvent}) => false|{size: number, travelBack?: boolean, travelOn?: boolean}} [options.onEdge]
 *   - the hand has reached an end of the box it holds and keeps going: `sign`
 *   says which one — the far edge, a box walked whole, or its start, a box
 *   walked back to where it began. Answer with the geometry of the box that
 *   lies that way to hand the gesture over to it: the pixels past the end
 *   become its first ones, so nothing is spent twice and the hand feels one
 *   continuous movement. Answer `false` (or leave it out) for a wall — the
 *   gesture stays on the box it has and leans on it.
 * @param {(detail: {axis: string, pulled: number, size: number, sign: number, travels: boolean, cancelled: boolean, event: PointerEvent}) => void} options.onEnd
 *   - the finger is off. `travels` is the gesture's answer: carry on to what was
 *   being pulled in, or put things back.
 * @param {() => void} [options.onGiveUp] - the press is over without ever
 *   becoming a travel: it stayed still, leaned the wrong way, or `onStart`
 *   refused it. Nothing was painted and nothing has to be put back — this is
 *   only so the caller can forget the gesture it is holding.
 */
const startDragToTravel = (pointerDownEvent, {
  element,
  axes = "xy",
  immediate = false,
  commitRatio = DRAG_COMMIT_RATIO,
  onStart,
  onPull,
  onEnd,
  onEdge = () => false,
  onGiveUp = () => {}
}) => {
  const target = pointerDownEvent.target;
  if (!target.closest || target.closest(DRAG_EXCLUDED_SELECTOR)) {
    return null;
  }
  // A box between the finger and this one that travels the same way, and then
  // anything between them that is picked up and carried the same way: the
  // gesture is theirs, and this one is left with the axes none of them walks —
  // none at all, most of the time, and then there is no gesture here to read.
  const axesLeftByTravels = axesLeftBy(axes, target, element, DRAG_AXES_ATTRIBUTE);
  const axesLeft = axesLeftByTravels && axesLeftBy(axesLeftByTravels, target, element, DRAG_SOURCE_AXES_ATTRIBUTE);
  if (!axesLeft) {
    return null;
  }
  // What was caught in flight travels on an axis of its own, and it is not up
  // for decision: a box below has taken that axis, so what this press caught it
  // cannot carry on either.
  if (immediate && !axesLeft.includes(immediate)) {
    return null;
  }

  // The travel in hand: null until the finger has picked an axis and the caller
  // has accepted it.
  let travel = null;
  let dragGesture = null;
  let over = false;
  const finish = () => {
    if (over) {
      return;
    }
    over = true;
    document.documentElement.removeAttribute(GESTURE_ATTRIBUTE);
    document.documentElement.removeAttribute(WALKING_ATTRIBUTE);
    window.removeEventListener("pointerup", onPressOver);
    window.removeEventListener("pointercancel", onPressOver);
  };
  // A press that never became a travel: the intent never resolved, or the axis
  // it leaned on is not one this box walks. Nothing was painted and nothing has
  // to be put back — the caller is only told so it can forget the gesture.
  const onPressOver = pointerEvent => {
    if (pointerEvent.pointerId !== pointerDownEvent.pointerId || travel) {
      return;
    }
    finish();
    onGiveUp();
  };
  const giveUp = () => {
    finish();
    dragGesture?.release();
    onGiveUp();
  };

  // Where the picture stands, from what the gesture reports: the distance the
  // pointer has covered along the axis, less the pixels spent deciding — what
  // travels starts moving from where the finger is at that moment rather than
  // jumping the threshold it just crossed.
  // How far the POINTER has come along an axis. The raw distance, not the
  // layout the gesture computes for something being carried: nothing is being
  // carried here, and a scroll happening meanwhile must not read as a finger
  // that moved.
  const coveredOn = (axis, gestureInfo) => axis === "x" ? gestureInfo.dragX - gestureInfo.grabX : gestureInfo.dragY - gestureInfo.grabY;
  const pullOf = gestureInfo => {
    const covered = coveredOn(travel.axis, gestureInfo);
    return travel.slack + (covered - travel.origin);
  };

  // Another box under the same hand, at either end of the one it holds. The
  // distance already covered on that side becomes the new box's own, measured
  // from where the finger IS: nothing is spent twice, and the gesture is one
  // movement rather than a wall the hand had to let go of to cross.
  // Returns where the new box stands, or null when there is nothing that way.
  const relayTo = (sign, distance, gestureInfo) => {
    const next = onEdge({
      axis: travel.axis,
      sign,
      event: gestureInfo.dragEvent
    });
    if (!next || !next.size) {
      return null;
    }
    travel.size = next.size;
    travel.travelBack = Boolean(next.travelBack);
    travel.travelOn = Boolean(next.travelOn);
    travel.slack = 0;
    let pulled = distance;
    if (pulled > next.size) {
      pulled = next.size;
    } else if (pulled < -next.size) {
      pulled = -next.size;
    }
    travel.origin = coveredOn(travel.axis, gestureInfo) - pulled;
    return pulled;
  };
  const controller = createDragGestureController({
    // The threshold is left at its default and never crossed: what says this
    // press has become a gesture is the intent module below, which calls
    // start() itself. Zero here would mean "started from the grab", and a
    // gesture that starts on its own is never STARTED — the moment that
    // installs the click it must swallow and the touch it must refuse would
    // never come.
    // Nothing is being carried: the page keeps its focus, its scrolling and its
    // cursor while a screen slides under the finger. That is the whole
    // difference with a drag that moves an object, and it is one option.
    documentInteractions: "manual",
    onDragStart: () => {
      document.documentElement.setAttribute(GESTURE_ATTRIBUTE, "");
    },
    onDrag: gestureInfo => {
      // Releasing a gesture reports one last move, so giving one up would come
      // back through here and give it up again, forever.
      if (over) {
        return;
      }
      if (!travel) {
        let axis;
        if (immediate) {
          // The axis is not up for decision: what this press caught is already
          // travelling on one, and the caller said which. The first pixel of a
          // hand landing on something moving is a tremor as often as it is a
          // direction — read as a lean across the axis, it gives the gesture up
          // and lets go of what was caught, under a finger that has not asked
          // for anything yet.
          axis = immediate;
        } else {
          // ONE axis, decided by the first movement reported and never
          // revisited: a diagonal would ask for two travels at once and only
          // one thing can arrive.
          const reachX = Math.abs(coveredOn("x", gestureInfo));
          const reachY = Math.abs(coveredOn("y", gestureInfo));
          if (!reachX && !reachY) {
            return;
          }
          axis = reachX >= reachY ? "x" : "y";
          if (!axesLeft.includes(axis)) {
            giveUp();
            return;
          }
        }
        const covered = coveredOn(axis, gestureInfo);
        if (!covered) {
          // Nothing said on that axis yet: a grab without a movement, or one
          // straight across it. There is no gesture in that and nothing to give
          // up on either — whatever the caller caught at the press stays
          // caught, and the next report will say.
          if (immediate) {
            return;
          }
          giveUp();
          return;
        }
        const sign = Math.sign(covered);
        const started = onStart({
          axis,
          sign,
          target,
          event: gestureInfo.dragEvent
        });
        if (!started || !started.size) {
          giveUp();
          return;
        }
        travel = {
          axis,
          size: started.size,
          travelBack: Boolean(started.travelBack),
          travelOn: Boolean(started.travelOn),
          slack: started.slack || 0,
          // The pixels spent deciding the axis are not pulled back — what
          // travels sets off from where the finger is at that moment rather
          // than jumping the threshold it just crossed. Except when the intent
          // was established before the press (see immediate): there was no
          // threshold to cross, so every pixel since the grab is the hand's and
          // is owed to it.
          origin: immediate ? 0 : covered,
          pulled: started.slack || 0
        };
        document.documentElement.setAttribute(WALKING_ATTRIBUTE, axis);
        // The travel exists: from here the pointer is this box's, and it is
        // followed wherever it goes.
        dragGesture.capturePointer();
      }
      const {
        axis
      } = travel;
      let pulled = pullOf(gestureInfo);
      // Which side is being pulled in: dragging to the right brings in what is
      // on the left, which is what comes BEFORE.
      let towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
      // Past the start of the box in hand, and the caller has a box that way:
      // the hand is not leaning on a wall, it is walking into the next one
      // backwards. Asked before the resistance, so what it is handed is the
      // hand's own distance rather than a damped one.
      if (!towardsSomething && pulled) {
        const relayed = relayTo(pulled > 0 ? 1 : -1, pulled, gestureInfo);
        if (relayed !== null) {
          pulled = relayed;
          towardsSomething = true;
        }
      }
      let size = travel.size;
      if (!towardsSomething) {
        pulled *= DRAG_RESISTANCE;
      }
      if (pulled > size || pulled < -size) {
        const sign = pulled > 0 ? 1 : -1;
        // How far past the edge the hand has gone. Its own number, because it
        // is what the next box is owed if there is one.
        const overshoot = pulled - sign * size;
        pulled = sign * size;
        if (towardsSomething) {
          // A box walked whole, and the finger still going: the caller may have
          // another one to put under it. Then the gesture WALKS ON — the pixels
          // past the edge are its first ones, so the hand feels one movement
          // and not a wall it had to let go of to cross.
          const relayed = relayTo(sign, overshoot, gestureInfo);
          if (relayed === null) {
            // A box travels one box, and the hand can go further than that.
            // Those extra pixels are not owed back: the gesture is measured
            // from where the finger IS once it has reached the end, so turning
            // around moves the picture at once instead of first walking back
            // over the distance the hand went too far.
            travel.origin = coveredOn(axis, gestureInfo) - (pulled - travel.slack);
          } else {
            pulled = relayed;
            size = travel.size;
          }
        }
      }
      travel.pulled = pulled;
      onPull({
        axis,
        pulled,
        size,
        progress: pulled / size,
        event: gestureInfo.dragEvent
      });
    },
    onRelease: gestureInfo => {
      if (over || !travel) {
        return;
      }
      finish();
      const {
        axis,
        size,
        pulled,
        slack
      } = travel;
      const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
      const velocity = axis === "x" ? gestureInfo.velocityX : gestureInfo.velocityY;
      // A gesture taken away rather than let go of (the browser scrolling
      // something else, a call coming in, another gesture taking the pointer)
      // said nothing: things go back.
      const releaseEvent = gestureInfo.releaseEvent || gestureInfo.dragEvent;
      const {
        cancelled
      } = gestureInfo;
      onEnd({
        axis,
        pulled,
        size,
        sign: pulled > 0 ? 1 : -1,
        travels: !cancelled && travelsAfter({
          pulled,
          slack,
          size,
          velocity,
          towardsSomething,
          commitRatio
        }),
        cancelled,
        event: releaseEvent
      });
    }
  });

  // When a press becomes a gesture, and by which rule. A travel is a swipe, so
  // the rule is the distance for EVERY pointer: the long press a finger is
  // asked for elsewhere says "pick this up and carry it", and asking for it
  // here would mean holding still before being allowed to swipe.
  const grab = () => {
    dragGesture = controller.grabViaPointer(pointerDownEvent, {
      element,
      // The box, not what the finger landed on: the caller's answer to this
      // gesture may take that away (a page that travels navigates, and the
      // router unmounts the page being left), and a capture whose element
      // leaves the document is a capture the browser drops.
      pointerCaptureElement: element,
      // A travel is established in two steps, and the pointer is only owned
      // after the second: the distance below says the press is not a click, and
      // the first move says which axis it leans on — which this box may not
      // walk, or the caller may refuse. Taken at the first step, the capture
      // would be taken away from whoever else is reading the same press for
      // gestures that give themselves up one event later. It is claimed once
      // the travel exists, in onDrag below.
      pointerCaptureDeferred: true
    });
    return dragGesture;
  };
  if (immediate) {
    // Already in the gesture: what this press landed on was moving, and a hand
    // that reaches for something in motion has said what it wants by reaching.
    // Asking it to prove it over ten pixels is asking twice — and over those
    // pixels the thing it is holding answers to nobody.
    grab()?.start();
  } else {
    dragAfterIntent(pointerDownEvent, grab, {
      longPress: false,
      threshold: DRAG_START_THRESHOLD
    });
  }
  window.addEventListener("pointerup", onPressOver);
  window.addEventListener("pointercancel", onPressOver);
  return {
    stop: () => {
      finish();
      dragGesture?.release();
    }
  };
};

// What each screen AFTER the first costs inside one gesture. Deliberately
// steep: reconstructing "how much did that flick mean" from a stream nobody
// agrees on is guesswork, and a guess that overshoots leaves someone three
// screens from where they were with no idea how they got there. Under-shooting
// costs one more push. So the door is open for a gesture that insists, and shut
// the rest of the time.
const WHEEL_NEXT_STEP_DELTA = 600;
// A stream that keeps getting weaker is momentum, not a hand: the system goes
// on sending long after the fingers are gone. Counted, one flick becomes five
// slides. Two events in a row are asked for rather than one, because a hand
// wavers and momentum does not.
const WHEEL_FADE_RUN = 2;

/**
 * A travel asked for with a wheel, and it asks for a WHOLE ONE.
 *
 * Two fingers swiping sideways on a trackpad, a mouse pushed sideways: the
 * browser sends `wheel` events and, left alone, answers them itself by
 * scrolling the page, bouncing it, or going back in history. Answering them
 * here is what stops that — a gesture is either ours or the browser's, and half
 * of each is what makes a page rock under a travel that is already moving.
 *
 * Read as STEPS and not as a distance, which is where this parts company with a
 * press: a hand on the box holds a screen and says where to put it, so it is
 * owed every pixel; a wheel points at the next screen and says "that one". What
 * travels is a row of slides, not a long strip one stops in the middle of, so
 * one push moves one slide — and the travel that follows plays at its own pace,
 * exactly as it would from a tab pressed or an arrow key.
 *
 * A gesture therefore moves ONE screen the moment it begins, on its first event
 * and whatever that event is worth: a hand that moved and saw nothing happen
 * does not wait, it pushes harder. Everything a threshold there would have
 * bought is bought instead by what the SECOND screen costs, which is a lot —
 * "how much did that flick mean" cannot be reconstructed from a stream nobody
 * agrees on, and a guess that overshoots leaves someone three screens away with
 * no idea how they got there. Under-shooting costs one more push, so that is
 * the side to be wrong on.
 *
 * A burst has no target either — every event lands on whatever is under the
 * pointer at that instant — so it is CLAIMED at its first event and answered to
 * the end wherever the pointer wanders (see wheel_gesture.js). Without that, a
 * hand pushing a nested carousel and drifting off it walks a slide, then walks
 * the box around it, on one push.
 *
 * The rest of the stream is mostly momentum, still arriving with the fingers
 * gone, and it must not be counted. What gives it away is that momentum only
 * ever WEAKENS: a stream that keeps shrinking is a push already answered, and a
 * number that grows again is a hand asking for more.
 *
 * @param {Element} element
 * @param {object} options
 * @param {"x"|"y"|"xy"} [options.axes="xy"] - which ways this box can travel.
 *   The other one is the content's own scrolling and is left alone, and an axis
 *   a box NESTED in this one travels is that box's (see axesLeftBy). Say so in
 *   the DOM with [data-travel-by-wheel] for the boxes above to read.
 * @param {(detail: {axis: string, sign: number, event: WheelEvent}) => void} options.onStep
 *   - one push, one screen. `sign` is positive towards the start of the axis,
 *   which brings in what comes BEFORE — a wheel says how far the CONTENT
 *   scrolls, and pushing content to the right reveals its left.
 * @returns {() => void} stop listening.
 */
const watchWheelTravel = (element, {
  axes = "xy",
  onStep
}) => {
  let gesture = null;
  const forgetGesture = () => {
    gesture = null;
    document.documentElement.removeAttribute(GESTURE_ATTRIBUTE);
    document.documentElement.removeAttribute(WALKING_ATTRIBUTE);
  };

  // Where the hand thinks it is pushing. Not "what the event landed on":
  // while a view transition is playing, the browser delivers the wheel to the
  // document root rather than to the box under the pointer, whatever the
  // pseudo-elements are told about pointer-events. Heard on the box alone, a
  // gesture that sets a travel off loses every event after the first — and the
  // page scrolls behind the travel with everything that was not taken.
  const isOverElement = wheelEvent => {
    const {
      target
    } = wheelEvent;
    if (element.contains(target)) {
      return true;
    }
    // Something the box is INSIDE, which is what a wheel lands on while a view
    // transition has taken the box's rendering away: the hit falls through to
    // the nearest ancestor still being painted. That is the only case worth
    // measuring for, and asking it this way round costs a walk up the tree
    // rather than a layout read — a page can hold many travelling boxes, and
    // every one of them would otherwise measure itself on every wheel event
    // anywhere.
    if (!target.contains(element)) {
      return false;
    }
    const {
      left,
      right,
      top,
      bottom
    } = element.getBoundingClientRect();
    const {
      clientX,
      clientY
    } = wheelEvent;
    return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
  };
  const onWheel = wheelEvent => {
    // The burst is already somebody else's — the box inside this one, a wheel
    // picker, whoever answered its first event. It is theirs to the end of it,
    // wherever the pointer has drifted since (see wheel_gesture.js).
    if (wheelGestureIsTakenFrom(element)) {
      return;
    }
    const axis = Math.abs(wheelEvent.deltaX) > Math.abs(wheelEvent.deltaY) ? "x" : "y";
    const delta = axis === "x" ? wheelEvent.deltaX : wheelEvent.deltaY;
    if (!delta) {
      return;
    }
    // Which way the screens go, said backwards: a wheel says how far the
    // CONTENT scrolls, and pushing content to the left brings in what is on the
    // right.
    const sign = delta > 0 ? -1 : 1;
    if (!gesture) {
      // Where the hand is pushing, asked at the START of a burst and never
      // again: from there on the gesture is this box's, and a pointer that has
      // wandered off it says nothing about what the hand is pushing.
      if (!isOverElement(wheelEvent)) {
        return;
      }
      if (!axes.includes(axis)) {
        // The other axis: the content's own scrolling, left whole to whatever
        // wants it.
        return;
      }
      // Who owns it, asked once for the gesture rather than for every event of
      // it — the same claims a press is read against (see the top of this
      // file), and all of them are answered by giving the gesture up whole:
      // nothing is prevented and the browser scrolls as it would have.
      const {
        target
      } = wheelEvent;
      if (target.closest && target.closest(DRAG_EXCLUDED_SELECTOR) || scrollRoomTowards(target, element, axis, sign) ||
      // …plus the third: a box below this one that travels on this axis. Its
      // watcher hears the same wheel event this one does — they all listen at
      // the document — so without this both step, and one push moves two
      // things.
      !axesLeftBy(axis, target, element, WHEEL_AXES_ATTRIBUTE)) {
        return;
      }
      gesture = {
        axis,
        sign,
        pushed: 0,
        lastMagnitude: 0,
        fadeRun: 0,
        stepped: false
      };
      document.documentElement.setAttribute(GESTURE_ATTRIBUTE, "");
      document.documentElement.setAttribute(WALKING_ATTRIBUTE, axis);
    }
    // Ours from here, on both axes: what the browser would do with the leftover
    // — scroll the page behind the box, bounce it, go back in history — is one
    // gesture answered twice.
    wheelEvent.preventDefault();
    // …and said on every event of it, because a claim nobody renews is a
    // gesture that is over: silence is the only end a wheel has.
    claimWheelGesture(element, {
      onEnd: forgetGesture
    });
    if (axis !== gesture.axis) {
      // The other axis mid-gesture: a hand is never perfectly straight, and the
      // axis was decided when the gesture set off.
      return;
    }
    if (sign !== gesture.sign) {
      // Turned around: what was adding up was going the other way.
      gesture.sign = sign;
      gesture.pushed = 0;
      gesture.lastMagnitude = 0;
      gesture.fadeRun = 0;
      gesture.stepped = false;
    }
    if (!gesture.stepped) {
      // The first event of a gesture moves a screen, whatever it is worth —
      // a pixel is a hand that moved, and a hand that moved and saw nothing
      // happen pushes harder rather than waiting. Everything a threshold could
      // buy here is bought by what a screen AFTER this one costs.
      gesture.stepped = true;
      onStep({
        axis: gesture.axis,
        sign: gesture.sign,
        event: wheelEvent
      });
      return;
    }
    const magnitude = Math.abs(delta);
    if (magnitude < gesture.lastMagnitude) {
      gesture.fadeRun += 1;
    } else if (magnitude > gesture.lastMagnitude) {
      // Back up again — a hand asking for more. Momentum never does this.
      gesture.fadeRun = 0;
    }
    gesture.lastMagnitude = magnitude;
    if (gesture.fadeRun >= WHEEL_FADE_RUN) {
      return;
    }
    gesture.pushed += magnitude;
    if (gesture.pushed < WHEEL_NEXT_STEP_DELTA) {
      return;
    }
    gesture.pushed = 0;
    onStep({
      axis: gesture.axis,
      sign: gesture.sign,
      event: wheelEvent
    });
  };
  document.addEventListener("wheel", onWheel, {
    passive: false,
    capture: true
  });
  return () => {
    document.removeEventListener("wheel", onWheel, {
      capture: true
    });
    // Handed back rather than left to lapse: a box that is gone must not hold a
    // gesture the boxes still there are asking about.
    releaseWheelGesture(element);
    forgetGesture();
  };
};

// Shared by navi's own use_displayed_layout_effect.js (rich "navi_displayed"
// CustomEvent, open transitions only) and visible_rect.js (needs both
// directions: hide when a container closes, recheck when it reopens) — the
// selector/open-detection/timing primitives are identical for both, only
// what each does with a transition differs.
const OPENABLE_SELECTOR = "dialog, details, [popover], [aria-expanded]";

// An element that IS openable is closed in exactly the same way an element
// inside one is — which matters for anything positioned against it, e.g. a
// callout anchored to a dialog rather than to a field inside it. Same selector
// as the walk up: whatever counts as openable above counts as openable here,
// custom [aria-expanded] nodes included.
const selfOrClosestOpenableAncestor = (element) => {
  if (element.matches?.(OPENABLE_SELECTOR)) {
    return element;
  }
  return closestOpenableAncestor(element);
};

const closestOpenableAncestor = (element) => {
  const parentElement = element.parentElement;
  if (!parentElement) {
    return null;
  }
  if (!parentElement.closest) {
    return null;
  }
  return parentElement.closest(OPENABLE_SELECTOR);
};

const isAncestorOpen = (ancestor) => {
  if (ancestor.tagName === "DIALOG" || ancestor.hasAttribute("popover")) {
    return ancestor.matches(":popover-open, [open]");
  }
  if (ancestor.tagName === "DETAILS") {
    return ancestor.open;
  }
  if (ancestor.hasAttribute("aria-expanded")) {
    return ancestor.getAttribute("aria-expanded") === "true";
  }
  return true;
};

const getAncestorOpenType = (ancestor) => {
  if (ancestor === document) {
    return "document";
  }
  if (ancestor.tagName === "DIALOG") {
    return "dialog";
  }
  if (ancestor.hasAttribute("popover")) {
    return "popover";
  }
  if (ancestor.tagName === "DETAILS") {
    return "details";
  }
  if (ancestor.hasAttribute("aria-expanded")) {
    return `${ancestor.tagName}[aria-expanded]`;
  }
  return `${ancestor.tagName}`;
};

/**
 * Notifies `callback({ isOpen, ancestor, ancestorType, toggleEvent })` the
 * moment `ancestor`'s open state changes, in either direction — timed to
 * land strictly before the browser's next paint, so a caller reacting to it
 * (measurement, visibility tracking, layout) never flashes the stale state
 * first. Plain object, not a CustomEvent — there's no real DOM event behind
 * most of these transitions (see `toggleEvent` below), so wrapping the info
 * in one would mostly be manufacturing a fake event for no benefit.
 *
 * We deliberately do NOT use the native `toggle` event as the primary
 * signal, even though every <dialog>/<details>/[popover] fires one: per the
 * WHATWG spec it's dispatched via a *queued task* ("queue a popover toggle
 * event task"), not synchronously and not as a microtask. The element's
 * shown state itself (showPopover()/showModal()) still flips synchronously,
 * so the browser can — and does — paint it in its default, uncorrected
 * state before that queued task ever runs. Relying on `toggle` alone means
 * a reaction to it always arrives one paint late.
 *
 * Instead we watch `open`/`aria-expanded` via MutationObserver:
 *   - <dialog>/<details> reflect `open` themselves, natively, synchronously.
 *   - navi's own Popover.jsx sets `aria-expanded` synchronously in the same
 *     call stack as showPopover() (see popover.jsx's own aria-expanded
 *     comments) — not part of any web standard, just that library's own
 *     convention, but reliable for anything built through it.
 * MutationObserver callbacks run as a microtask, strictly before paint —
 * exactly the timing needed, no ambiguity. `toggleEvent` is `undefined` on
 * this path (there's no native event to report — a mutation record isn't
 * one).
 *
 * The `toggle` listener is kept as a fallback, attached ONLY where the
 * MutationObserver above has no chance of ever firing: a bare [popover]
 * element with no `aria-expanded` of its own — i.e. one not built through
 * navi's own Popover.jsx (the only thing that reliably sets it). That's the
 * one case with no other synchronously-observable signal at all. It still
 * arrives a paint late, but a late correction beats none. `toggleEvent` is
 * the real `toggle` event on this path.
 *
 * @param {Element} ancestor
 * @param {(info: { isOpen: boolean, ancestor: Element, ancestorType: string, toggleEvent: Event | undefined }) => void} callback
 * @returns {() => void} cleanup — removes the observer/listener
 */
const observeAncestorOpenState = (ancestor, callback) => {
  const ancestorType = getAncestorOpenType(ancestor);
  const needsToggleFallback =
    ancestor.hasAttribute("popover") && !ancestor.hasAttribute("aria-expanded");
  if (needsToggleFallback) {
    const onToggle = (toggleEvent) => {
      callback({
        isOpen: isAncestorOpen(ancestor),
        ancestor,
        ancestorType,
        toggleEvent,
      });
    };
    ancestor.addEventListener("toggle", onToggle);
    return () => {
      ancestor.removeEventListener("toggle", onToggle);
    };
  }

  // Edge-triggered on purpose: some consumers (e.g. Popover.jsx) set
  // aria-expanded both imperatively (in their own openEffect, for precise
  // ordering relative to forced reflows/transitions) AND declaratively via a
  // JSX prop derived from the same open state — the latter is a deliberate
  // "always reflect current truth" prop, but Preact diffs against its own
  // previous *rendered* value, not the live DOM, so any later re-render that
  // happens to occur while already open re-applies the same "true" value as
  // a genuinely new attribute mutation. Tracking wasOpen here collapses that
  // redundant open→open (or close→close) mutation instead of notifying
  // callback a second time for the same state.
  let wasOpen = isAncestorOpen(ancestor);
  const observer = new MutationObserver(() => {
    const isOpen = isAncestorOpen(ancestor);
    if (isOpen === wasOpen) {
      return;
    }
    wasOpen = isOpen;
    callback({
      isOpen,
      ancestor,
      ancestorType,
      toggleEvent: undefined,
    });
  });
  observer.observe(ancestor, {
    attributes: true,
    attributeFilter: ["open", "aria-expanded"],
  });
  return () => {
    observer.disconnect();
  };
};

const onAncestorReopen = (el, callback) => {
  const nearestOpenableAncestor = closestOpenableAncestor(el);
  if (!nearestOpenableAncestor) {
    return () => {};
  }
  return observeAncestorOpenState(nearestOpenableAncestor, ({ isOpen }) => {
    if (!isOpen) {
      return;
    }
    callback();
  });
};

const getHeight = (element) => {
  const { height } = element.getBoundingClientRect();
  return height;
};

const getWidth = (element) => {
  const { width } = element.getBoundingClientRect();
  return width;
};

installImportMetaCssBuild(import.meta);/**
 * Position Sticky Polyfill
 *
 * This module provides a workaround for position:sticky limitations when used with
 * overflow:auto/hidden parent elements (see https://github.com/w3c/csswg-drafts/issues/865).
 *
 * How it works:
 * 1. Creates a placeholder clone of the sticky element to maintain document flow
 * 2. Positions the real element using fixed positioning relative to viewport
 * 3. Adjusts position on scroll to emulate position:sticky behavior
 * 4. Handles parent boundary detection to keep element within its container
 * 5. Updates dimensions on resize and DOM changes
 *
 * Usage:
 * ```
 * const cleanup = initPositionSticky(element);
 * // Later when no longer needed
 * cleanup();
 * ```
 *
 * The element should have a CSS "top" value specified (e.g., top: 10px).
 */
const css = /* css */`
  [data-position-sticky-placeholder] {
    position: static !important;
    width: auto !important;
    height: auto !important;
    opacity: 0 !important;
  }
`;
const initPositionSticky = element => {
  import.meta.css = [css, "@jsenv/dom/src/position/position_sticky.js"];
  const computedStyle = getComputedStyle(element);
  const topCssValue = computedStyle.top;
  const top = parseFloat(topCssValue);
  const leftCssValue = computedStyle.left;
  const left = parseFloat(leftCssValue);
  const hasTop = !isNaN(top);
  const hasLeft = !isNaN(left);
  if (!hasTop && !hasLeft) {
    return () => {}; // Early return if no valid top or left value
  }

  // Skip polyfill if native position:sticky would work (no overflow:auto/hidden parents)
  const scrollContainerSet = getScrollContainerSet(element);
  // Determine per-axis whether an intermediate container blocks native sticky.
  // Native sticky fails only when there is a scroll container between the element
  // and the document with overflow set on that axis.
  let xScrollContainer = null; // first intermediate container blocking horizontal sticky
  let yScrollContainer = null; // first intermediate container blocking vertical sticky
  for (const scrollContainer of scrollContainerSet) {
    if (scrollContainer === document.documentElement) {
      break;
    }
    const style = getComputedStyle(scrollContainer);
    if (xScrollContainer === null && (style.overflowX === "auto" || style.overflowX === "hidden" || style.overflowX === "scroll")) {
      xScrollContainer = scrollContainer;
    }
    if (yScrollContainer === null && (style.overflowY === "auto" || style.overflowY === "hidden" || style.overflowY === "scroll")) {
      yScrollContainer = scrollContainer;
    }
  }
  const needsPolyfillX = hasLeft && xScrollContainer !== null;
  const needsPolyfillY = hasTop && yScrollContainer !== null;
  if (!needsPolyfillX && !needsPolyfillY) {
    return () => {}; // Native sticky will work fine on both axes
  }
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  const parentElement = element.parentElement;
  const createPlaceholderClone = () => {
    const clone = element.cloneNode(true);
    clone.setAttribute("data-position-sticky-placeholder", "");
    clone.removeAttribute("data-sticky");
    return clone;
  };
  let placeholder = createPlaceholderClone();
  parentElement.insertBefore(placeholder, element);
  cleanupCallbackSet.add(() => {
    placeholder.remove();
  });
  let width = getWidth(element);
  let height = getHeight(element);
  const updateSize = () => {
    const newPlaceholder = createPlaceholderClone();
    parentElement.replaceChild(newPlaceholder, placeholder);
    placeholder = newPlaceholder;
    width = getWidth(placeholder);
    height = getHeight(placeholder);
    updatePosition();
  };
  const updatePosition = () => {
    // Ensure placeholder dimensions match element
    setStyles(placeholder, {
      width: `${width}px`,
      height: `${height}px`
    });
    const placeholderRect = placeholder.getBoundingClientRect();
    const parentRect = parentElement.getBoundingClientRect();

    // The CSS `top`/`left` values are offsets from the scroll container's edge.
    // getBoundingClientRect() always returns viewport coordinates (already accounting
    // for scroll position of all ancestors), so to convert the CSS offset to a
    // viewport threshold we add the scroll container's own viewport position.
    //
    // Example: main starts at viewport x=250, left=0 → leftThreshold=250.
    // After scrolling main 670px: placeholderRect.left = 250-670 = -420.
    // -420 <= 250 → stuck → element.style.left = 250px (main's left edge). ✓
    //
    // If no intermediate scroll container exists, use 0 (document/viewport edge).
    const yContainerRect = yScrollContainer ? yScrollContainer.getBoundingClientRect() : {
      top: 0
    };
    const xContainerRect = xScrollContainer ? xScrollContainer.getBoundingClientRect() : {
      left: 0
    };
    const topThreshold = yContainerRect.top + top;
    const leftThreshold = xContainerRect.left + left;

    // ── Vertical (top) ──────────────────────────────────────────────────────
    let topPosition;
    let isStuckVertically = false;
    if (hasTop) {
      if (placeholderRect.top <= topThreshold) {
        topPosition = topThreshold;
        isStuckVertically = true;
        // Don't go beyond parent's bottom boundary
        const parentBottom = parentRect.bottom;
        const elementBottom = topThreshold + height;
        if (elementBottom > parentBottom) {
          topPosition = parentBottom - height;
        }
      } else {
        topPosition = placeholderRect.top;
      }
    } else {
      topPosition = placeholderRect.top;
    }

    // ── Horizontal (left) ───────────────────────────────────────────────────
    let leftPosition;
    let isStuckHorizontally = false;
    if (hasLeft) {
      if (placeholderRect.left <= leftThreshold) {
        leftPosition = leftThreshold;
        isStuckHorizontally = true;
        // Don't go beyond parent's right boundary
        const parentRight = parentRect.right;
        const elementRight = leftThreshold + width;
        if (elementRight > parentRight) {
          leftPosition = parentRight - width;
        }
      } else {
        leftPosition = placeholderRect.left;
      }
    } else {
      leftPosition = placeholderRect.left;
    }
    element.style.top = `${topPosition}px`;
    element.style.left = `${Math.round(leftPosition)}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;

    // Set attribute for potential styling
    if (isStuckVertically || isStuckHorizontally) {
      element.setAttribute("data-sticky", "");
    } else {
      element.removeAttribute("data-sticky");
    }
  };
  {
    const restorePositionStyle = forceStyles(element, {
      "position": "fixed",
      "z-index": 1,
      "will-change": "transform" // Hint for hardware acceleration
    });
    cleanupCallbackSet.add(restorePositionStyle);
  }
  updatePosition();
  {
    const handleScroll = () => {
      updatePosition();
    };

    // Listen on all scroll containers (including document) since the element
    // uses position:fixed and any ancestor scroll changes its apparent position.
    const listenTargets = new Set(scrollContainerSet);
    listenTargets.add(document.documentElement);
    for (const scrollTarget of listenTargets) {
      scrollTarget.addEventListener("scroll", handleScroll, {
        passive: true
      });
      cleanupCallbackSet.add(() => {
        scrollTarget.removeEventListener("scroll", handleScroll, {
          passive: true
        });
      });
    }
  }
  {
    let animationFrame = null;
    const resizeObserver = new ResizeObserver(() => {
      if (animationFrame !== null) {
        return;
      }
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        updateSize();
      });
    });
    resizeObserver.observe(parentElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    });
  }
  {
    const mutationObserver = new MutationObserver(() => {
      updateSize();
    });
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }
  return cleanup;
};

const stickyAsRelativeCoords = (
  element,
  referenceElement,
  { scrollContainer = getScrollContainer(element) } = {},
) => {
  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasTopStickyAttribute = element.hasAttribute("data-sticky-top");
  if (!hasStickyLeftAttribute && !hasTopStickyAttribute) {
    return null;
  }
  const elementRect = element.getBoundingClientRect();
  const referenceElementRect = referenceElement.getBoundingClientRect();
  const computedStyle = getComputedStyle(element);
  const isDocumentScrolling = scrollContainer === document.documentElement;

  let leftPosition;
  let topPosition;
  if (isDocumentScrolling) {
    // For document scrolling: check if element is currently stuck and calculate offset

    if (hasStickyLeftAttribute) {
      const cssLeftValue = parseFloat(computedStyle.left) || 0;
      const isStuckLeft = elementRect.left <= cssLeftValue;
      if (isStuckLeft) {
        const elementOffsetRelative =
          elementRect.left - referenceElementRect.left;
        leftPosition = elementOffsetRelative - cssLeftValue;
      } else {
        leftPosition = 0;
      }
    }
    if (hasTopStickyAttribute) {
      const cssTopValue = parseFloat(computedStyle.top) || 0;
      const isStuckTop = elementRect.top <= cssTopValue;
      if (isStuckTop) {
        const elementOffsetRelative =
          elementRect.top - referenceElementRect.top;
        topPosition = elementOffsetRelative - cssTopValue;
      } else {
        topPosition = 0;
      }
    }
    return [leftPosition, topPosition];
  }

  // For container scrolling: check if element is currently stuck and calculate offset
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  if (hasStickyLeftAttribute) {
    const cssLeftValue = parseFloat(computedStyle.left) || 0;
    // Check if element is stuck to the left edge of the scrollable container
    const isStuckLeft =
      elementRect.left <= scrollContainerRect.left + cssLeftValue;
    if (isStuckLeft) {
      // Element is stuck - calculate its offset relative to reference element
      const elementOffsetRelative =
        elementRect.left - referenceElementRect.left;
      leftPosition = elementOffsetRelative - cssLeftValue;
    } else {
      // Element is not stuck - behaves like position: relative with no offset
      leftPosition = 0;
    }
  }
  if (hasTopStickyAttribute) {
    const cssTopValue = parseFloat(computedStyle.top) || 0;
    // Check if element is stuck to the top edge of the scrollable container
    const isStuckTop = elementRect.top <= scrollContainerRect.top + cssTopValue;
    if (isStuckTop) {
      // Element is stuck - calculate its offset relative to reference element
      const elementOffsetRelative = elementRect.top - referenceElementRect.top;
      topPosition = elementOffsetRelative - cssTopValue;
    } else {
      // Element is not stuck - behaves like position: relative with no offset
      topPosition = 0;
    }
  }
  return [leftPosition, topPosition];
};

/**
 * The on-screen keyboard, when the app takes it over.
 *
 * By default a mobile browser answers the keyboard by shrinking the VISUAL
 * viewport, and everything sized against that viewport follows for free —
 * which is what the whole positioning layer here already relies on (see
 * pickPositionRelativeTo's own visualViewport reads). The VirtualKeyboard API
 * (Chromium only — no Firefox, no Safari) offers the other deal:
 * `overlaysContent = true` and the keyboard stops resizing anything, painting
 * over the page instead, while its geometry becomes readable — `boundingRect`
 * and a `geometrychange` event here, `env(keyboard-inset-*)` in CSS.
 *
 * That deal has to be taken whole: the instant the viewport stops shrinking,
 * whoever was sizing against it is sizing against a rectangle the keyboard now
 * covers. So this module answers ONE question — how many pixels at the bottom
 * of the visual viewport the keyboard covers — and the positioning layer
 * subtracts it. The answer is 0 in every other case (unsupported, never opted
 * in, keyboard closed), which is exactly what makes the two paths one path:
 * where the browser shrinks the viewport itself, there is nothing left to
 * subtract.
 *
 * Why take the deal at all, then, if the outcome is meant to match? Because a
 * resizing viewport is a resize of EVERYTHING, whether or not it had anything
 * to do with the field being typed into — the page reflows, fixed bars move,
 * and a mobile browser fires that resize transiently as focus goes from one
 * input to the next. Overlaying leaves the layout alone and hands over a
 * number instead. So navi takes it by default (see its own index.js) and only
 * offers a way back out, for an app whose own layout was built around the
 * viewport shrinking.
 */

const virtualKeyboard = window.navigator.virtualKeyboard;

/**
 * Whether the keyboard overlays the content instead of resizing the viewport.
 * Returns whether it applies at all — false means the browser has no
 * VirtualKeyboard API and keeps shrinking the visual viewport, which is the
 * behavior everything here already follows, so there is nothing to report to
 * the caller beyond "not this way".
 */
const setVirtualKeyboardOverlaysContent = (value) => {
  if (!virtualKeyboard) {
    return false;
  }
  virtualKeyboard.overlaysContent = value;
  return true;
};

/**
 * How many pixels at the bottom of the visual viewport the keyboard currently
 * covers — 0 unless the app opted in above AND the keyboard is up.
 *
 * `boundingRect` is all-zero when the keyboard is hidden, and also while
 * `overlaysContent` is false: a keyboard that resized the viewport covers
 * nothing that is left of it, so the zero is the right answer rather than a
 * missing one.
 */
const getVirtualKeyboardOverlayHeight = () => {
  if (!virtualKeyboard) {
    return 0;
  }
  const { height } = virtualKeyboard.boundingRect;
  return height > 0 ? height : 0;
};

/**
 * Calls `callback` whenever the keyboard shows, hides or resizes. Returns an
 * unsubscribe function; a no-op (never calls back) without support.
 *
 * Undebounced on purpose, unlike window/visualViewport resize
 * (window_size.js): "geometrychange" is not the transient storm those are —
 * it fires on the keyboard itself changing, not on the layout reacting to it,
 * which is the whole point of overlaying.
 */
const subscribeVirtualKeyboardGeometryChange = (callback) => {
  if (!virtualKeyboard) {
    return () => {};
  }
  virtualKeyboard.addEventListener("geometrychange", callback);
  return () => {
    virtualKeyboard.removeEventListener("geometrychange", callback);
  };
};

// Both "resize" sources fire transiently on mobile (keyboard/UI chrome
// briefly shifting when focus moves between inputs) — debounced so
// consumers skip that in-between state. One shared timer per source (not
// one per subscriber) so everything settles on the same tick.
const RESIZE_SETTLE_MS = 100;

// Set while a visualViewport resize is debouncing, cleared once it settles —
// read by the window resize listener below.
let visualViewportResizePending = false;

const [publishVisualViewportResize, subscribeVisualViewportResizeSettled] =
  createPubSub();
const [publishWindowResize, subscribeWindowResizeSettled] = createPubSub();

let visualViewportResizeTimeoutId;
const scheduleVisualViewportResize = (event) => {
  visualViewportResizePending = true;
  clearTimeout(visualViewportResizeTimeoutId);
  visualViewportResizeTimeoutId = setTimeout(() => {
    visualViewportResizePending = false;
    publishVisualViewportResize(event);
  }, RESIZE_SETTLE_MS);
};
if (window.visualViewport) {
  window.visualViewport.addEventListener(
    "resize",
    scheduleVisualViewportResize,
  );
}
// The same event, said differently: where the keyboard overlays the content
// (virtual_keyboard.js) there is no visualViewport resize at all when it
// opens — the room left to place anything in changed
// all the same, and every consumer here asks the same question either way
// (getVisibleViewportRect in visible_rect.js already subtracts it). Through
// the same debounce, and for the same reason: going straight from one input
// to the next hides and re-shows the keyboard.
subscribeVirtualKeyboardGeometryChange(scheduleVisualViewportResize);

let windowResizeTimeoutId;
window.addEventListener("resize", (event) => {
  clearTimeout(windowResizeTimeoutId);
  // Mobile browsers appear to dispatch visualViewport resize, then window
  // resize, then visualViewport resize again for the same keyboard/UI-chrome
  // shift — debounce the same way only when it looks like part of that
  // sequence (a visualViewport resize is already pending); otherwise react
  // immediately, so a genuine window resize isn't delayed for nothing.
  if (!visualViewportResizePending) {
    publishWindowResize(event);
    return;
  }
  windowResizeTimeoutId = setTimeout(() => {
    publishWindowResize(event);
  }, RESIZE_SETTLE_MS);
});

/**
 * The part of the viewport something can actually be placed in.
 *
 * visualViewport, not the layout viewport: only the visual one shrinks when
 * the on-screen keyboard opens (where the browser is the one shrinking it —
 * see below). Its offsetLeft/Top matter too, for pinch-zoom/pan.
 *
 * document.documentElement.clientWidth/Height is the fallback without
 * visualViewport support — the layout viewport net of any classic scrollbar,
 * which is what visualViewport itself reports, unlike window.innerWidth/Height
 * which counts the scrollbar in. Both readings existed here, one per call
 * site, for no reason anyone stated; they only ever differed by that scrollbar
 * and only on browsers with no visualViewport at all.
 *
 * The keyboard is then subtracted rather than assumed to have already shrunk
 * the viewport: with `overlaysContent` (virtual_keyboard.js, navi turns it on)
 * the viewport stays full height and the keyboard is painted over its bottom.
 * Zero everywhere else, the browser having done the subtraction itself.
 */
const getVisibleViewportRect = () => {
  const visualViewport = window.visualViewport;
  const documentElement = document.documentElement;
  const height = visualViewport
    ? visualViewport.height
    : documentElement.clientHeight;
  return {
    left: visualViewport ? visualViewport.offsetLeft : 0,
    top: visualViewport ? visualViewport.offsetTop : 0,
    width: visualViewport ? visualViewport.width : documentElement.clientWidth,
    height: Math.max(0, height - getVirtualKeyboardOverlayHeight()),
  };
};

// Minimum fraction of element width/height that must be visible on the preferred side
// before flipping to the opposite side. Prevents flickering near the flip threshold.
const MIN_CONTENT_VISIBILITY_RATIO = 0.6;

/**
 * Tracks how much of an element is visible within its scrollable parent and within the
 * document viewport. Calls update() on initialization and whenever visibility changes
 * (scroll, resize, intersection changes, ancestor open/close).
 *
 * @param {HTMLElement} element - The element to observe.
 * @param {function(visibleRect: VisibleRect, info: VisibleRectInfo): void} update - Called on every visibility change.
 *
 * @typedef {Object} VisibleRect
 * @property {number} left   - Left edge of the visible area, document-relative (px).
 * @property {number} top    - Top edge of the visible area, document-relative (px).
 * @property {number} right  - Right edge of the visible area, document-relative (px).
 * @property {number} bottom - Bottom edge of the visible area, document-relative (px).
 * @property {number} width  - Width of the visible area (px).
 * @property {number} height - Height of the visible area (px).
 * @property {number} visibilityRatio - Fraction of the element's area truly visible on screen (0–1).
 *   For document scroll containers: viewport-clipped fraction.
 *   For custom containers: fraction clipped by both the container and the viewport.
 *   Is 0 when ancestorClosed is true.
 *
 * @typedef {Object} VisibleRectInfo
 * @property {Event}   event                 - The DOM event (or CustomEvent) that triggered the check.
 * @property {number}  width                 - Raw getBoundingClientRect() width of the element.
 * @property {number}  height                - Raw getBoundingClientRect() height of the element.
 * @property {boolean} ancestorClosed        - True when a popover, dialog, or details ancestor is
 *   currently closed so the element is not rendered. All visibleRect values are 0 in that case.
 *   update() is called immediately on ancestor close and again (with false) on reopen.
 *
 * update() is called:
 *   - Once synchronously on initialization (event.type = "initialization")
 *   - On document/container scroll, window resize, element resize, intersection changes, touch move
 *   - Immediately when an ancestor popover/dialog/details opens or closes
 *   - Immediately when an ancestor popover/dialog starts or stops repositioning itself
 *
 * A bit like https://tetherjs.dev/ but different
 */
// The event type observeSize() reports with — recognized by check() as "the
// change is in another element, not in the tracked rect".
// Exported: a caller that resized the element itself (a callout whose message
// just changed, say) has to re-check with this rather than with nothing — its
// own rect may not have moved at all, and the dedup would drop the check.
const ELEMENT_SIZE_CHANGE = "observed_element_size_change";

const visibleRectEffect = (
  element,
  update,
  {
    event: initialEvent = new CustomEvent("initialization"),
    skipElementResize,
  } = {},
) => {
  const [teardown, addTeardown] = createPubSub();
  // getScrollContainer(document.documentElement) returns null specifically
  // when the document itself has no overflow to scroll (e.g. a small
  // dialog/popover on an otherwise short page) — document.documentElement
  // is still a perfectly valid fallback in that case (scrollLeft/scrollTop
  // are just 0), so this never needs to crash the way a bare
  // `getScrollContainer(element)` result would below.
  const scrollContainer =
    getScrollContainer(element) ?? document.documentElement;
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  let lastMeasuredWidth;
  let lastMeasuredHeight;
  let ancestorClosedCount = 0;
  // Every ResizeObserver this effect owns (its own element-resize watcher
  // below, plus one per observeSize() call) unobserves itself the moment an
  // ancestor closes, reobserving once it reopens (see on_ancestor_events) —
  // closing a dialog/popover containing several watched elements can make
  // them all collapse to zero size in the same reflow, which is what trips
  // the browser's "ResizeObserver loop completed with undelivered
  // notifications" warning. Proactively unobserving avoids generating those
  // notifications instead of just reacting differently to them.
  // Set while an ancestor is itself mid-repositioning — on_ancestor_events'
  // own onNaviPositionTransition already drives this element's position
  // every frame for that duration, more accurately than the direct
  // window/visualViewport resize reaction below (on_resize) could. Gates
  // that reaction so it doesn't also fire mid-transition and animate its
  // own competing move toward a target computed from the anchor's still
  // mid-flight rect, racing the frame-by-frame follow loop.
  let ancestorRepositioningCount = 0;
  // check() runs on every scroll/resize/frame of an ancestor's own
  // transition, but plenty of those land on an identical result — skip
  // calling update() again when neither snapshot changed. Two snapshots,
  // not one, because pickPositionRelativeTo depends on both separately:
  //   - lastVisibleRect: left/top/width/height, plus visibilityRatio (which
  //     can change on its own — see its own ratio formula further down —
  //     without any of the other four moving).
  //   - lastViewportRect: not part of visibleRect at all, but an on-screen
  //     keyboard opening/closing can shrink the viewport without moving
  //     this element's own visibleRect by a single pixel, and
  //     pickPositionRelativeTo's available space depends on it too.
  let lastVisibleRect = null;
  let lastViewportRect = null;
  let resizeWatchingPaused = false;
  const [publishResizeWatchingPausedChange, onResizeWatchingPausedChange] =
    createPubSub();
  const pauseResizeWatching = () => {
    if (resizeWatchingPaused) {
      return;
    }
    resizeWatchingPaused = true;
    publishResizeWatchingPausedChange(true);
  };
  const resumeResizeWatching = () => {
    if (!resizeWatchingPaused) {
      return;
    }
    resizeWatchingPaused = false;
    publishResizeWatchingPausedChange(false);
  };
  // Only so the reads below have something to read: a caller that describes
  // nothing gets no special treatment, it goes through the same dedup as any
  // other check. A caller that needs the dedup bypassed says so by passing the
  // event that means it (ELEMENT_SIZE_CHANGE).
  const UNSET_EVENT = { type: "unset" };
  const check = (event = UNSET_EVENT) => {

    // Computed here regardless of scroll container (not just where the
    // non-document branch below needs it) because a keyboard opening can
    // change pickPositionRelativeTo's available space without moving this
    // element's own visibleRect at all — see viewportRectChanged further
    // down.
    const {
      left: viewportOffsetLeft,
      top: viewportOffsetTop,
      width: viewportWidth,
      height: viewportHeight,
    } = getVisibleViewportRect();

    // 1. Calculate element position relative to scrollable parent
    const { scrollLeft, scrollTop } = scrollContainer;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;

    // Get element position relative to its scrollable parent
    let elementAbsoluteLeft;
    let elementAbsoluteTop;
    if (scrollContainerIsDocument) {
      // For document scrolling, use offsetLeft/offsetTop relative to document
      const rect = element.getBoundingClientRect();
      elementAbsoluteLeft = rect.left + scrollLeft;
      elementAbsoluteTop = rect.top + scrollTop;
    } else {
      // For custom container, get position relative to the container
      const elementRect = element.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      elementAbsoluteLeft =
        elementRect.left - scrollContainerRect.left + scrollLeft;
      elementAbsoluteTop =
        elementRect.top - scrollContainerRect.top + scrollTop;
    }

    const leftVisible =
      visibleAreaLeft < elementAbsoluteLeft
        ? elementAbsoluteLeft - visibleAreaLeft
        : 0;
    const topVisible =
      visibleAreaTop < elementAbsoluteTop
        ? elementAbsoluteTop - visibleAreaTop
        : 0;
    // Convert to overlay coordinates (adjust for custom scrollable container)
    let overlayLeft = leftVisible;
    let overlayTop = topVisible;
    if (!scrollContainerIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollContainer.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }

    // 2. Calculate element visible width/height
    const { width, height } = element.getBoundingClientRect();
    lastMeasuredWidth = width;
    lastMeasuredHeight = height;
    const visibleAreaWidth = scrollContainer.clientWidth;
    const visibleAreaHeight = scrollContainer.clientHeight;
    const visibleAreaRight = visibleAreaLeft + visibleAreaWidth;
    const visibleAreaBottom = visibleAreaTop + visibleAreaHeight;
    // 2.1 Calculate visible width
    let widthVisible;
    {
      const maxVisibleWidth = visibleAreaWidth - leftVisible;
      const elementAbsoluteRight = elementAbsoluteLeft + width;
      const elementLeftIsVisible = elementAbsoluteLeft >= visibleAreaLeft;
      const elementRightIsVisible = elementAbsoluteRight <= visibleAreaRight;
      if (elementLeftIsVisible && elementRightIsVisible) {
        // Element fully visible horizontally
        widthVisible = width;
      } else if (elementLeftIsVisible && !elementRightIsVisible) {
        // Element left is visible, right is cut off
        widthVisible = visibleAreaRight - elementAbsoluteLeft;
      } else if (!elementLeftIsVisible && elementRightIsVisible) {
        // Element left is cut off, right is visible
        widthVisible = elementAbsoluteRight - visibleAreaLeft;
      } else {
        // Element spans beyond both sides, show only visible area portion
        widthVisible = maxVisibleWidth;
      }
    }
    // 2.2 Calculate visible height
    let heightVisible;
    {
      const maxVisibleHeight = visibleAreaHeight - topVisible;
      const elementAbsoluteBottom = elementAbsoluteTop + height;
      const elementTopIsVisible = elementAbsoluteTop >= visibleAreaTop;
      const elementBottomIsVisible = elementAbsoluteBottom <= visibleAreaBottom;
      if (elementTopIsVisible && elementBottomIsVisible) {
        // Element fully visible vertically
        heightVisible = height;
      } else if (elementTopIsVisible && !elementBottomIsVisible) {
        // Element top is visible, bottom is cut off
        heightVisible = visibleAreaBottom - elementAbsoluteTop;
      } else if (!elementTopIsVisible && elementBottomIsVisible) {
        // Element top is cut off, bottom is visible
        heightVisible = elementAbsoluteBottom - visibleAreaTop;
      } else {
        // Element spans beyond both sides, show only visible area portion
        heightVisible = maxVisibleHeight;
      }
    }

    // Calculate visibilityRatio: fraction of element area truly visible on screen.
    // For custom containers we intersect the container-clipped visible size (widthVisible x
    // heightVisible) with the viewport bounds, so an element scrolled out of its container
    // correctly reports 0 rather than the raw viewport intersection of its bounding rect.
    let visibilityRatio;
    if (scrollContainerIsDocument) {
      visibilityRatio = (widthVisible * heightVisible) / (width * height);
    } else {
      // widthVisible/heightVisible are already clipped to the scroll
      // container. Now clip their viewport-relative counterparts against
      // the viewport (viewportWidth/Height/OffsetLeft/OffsetTop computed
      // once, at the top of check() — see their own comment there).
      // Container-clipped visible rect in viewport coordinates
      const visibleLeft = overlayLeft;
      const visibleTop = overlayTop;
      const visibleRight = overlayLeft + widthVisible;
      const visibleBottom = overlayTop + heightVisible;
      // Intersect with viewport
      const clippedLeft =
        visibleLeft < viewportOffsetLeft ? viewportOffsetLeft : visibleLeft;
      const clippedTop =
        visibleTop < viewportOffsetTop ? viewportOffsetTop : visibleTop;
      const viewportRight = viewportOffsetLeft + viewportWidth;
      const viewportBottom = viewportOffsetTop + viewportHeight;
      const clippedRight =
        visibleRight > viewportRight ? viewportRight : visibleRight;
      const clippedBottom =
        visibleBottom > viewportBottom ? viewportBottom : visibleBottom;
      const clippedWidth =
        clippedRight > clippedLeft ? clippedRight - clippedLeft : 0;
      const clippedHeight =
        clippedBottom > clippedTop ? clippedBottom - clippedTop : 0;
      visibilityRatio = (clippedWidth * clippedHeight) / (width * height);
    }

    const visibleRect = {
      left: overlayLeft,
      top: overlayTop,
      right: overlayLeft + widthVisible,
      bottom: overlayTop + heightVisible,
      width: widthVisible,
      height: heightVisible,
      visibilityRatio,
    };
    // Not part of visibleRect itself, tracked only so viewportRectChanged
    // below can catch a keyboard opening/closing even when it doesn't move
    // this element's own visibleRect.
    const viewportRect = {
      viewportWidth,
      viewportHeight,
      viewportOffsetLeft,
      viewportOffsetTop,
    };
    const notify = (reason) => {
      update(visibleRect, {
        event,
        width,
        height,
        ancestorClosed: ancestorClosedCount > 0,
      });
    };

    // An observeSize() delivery reports a size change in some *other*
    // element — this one's own rect and the viewport are both typically
    // untouched by it, so the dedup below would skip every single one,
    // defeating the whole point of observeSize (a popover reconsidering its
    // placement once its own content shrinks/grows, a callout re-measuring
    // against its message body).
    if (event.type === ELEMENT_SIZE_CHANGE) {
      lastVisibleRect = visibleRect;
      lastViewportRect = viewportRect;
      notify();
      return;
    }
    const visibleRectChanged =
      !lastVisibleRect ||
      lastVisibleRect.left !== visibleRect.left ||
      lastVisibleRect.top !== visibleRect.top ||
      lastVisibleRect.width !== visibleRect.width ||
      lastVisibleRect.height !== visibleRect.height ||
      lastVisibleRect.visibilityRatio !== visibleRect.visibilityRatio;
    if (visibleRectChanged) {
      lastVisibleRect = visibleRect;
      lastViewportRect = viewportRect;
      notify();
      return;
    }
    const viewportRectChanged =
      !lastViewportRect ||
      lastViewportRect.viewportWidth !== viewportRect.viewportWidth ||
      lastViewportRect.viewportHeight !== viewportRect.viewportHeight ||
      lastViewportRect.viewportOffsetLeft !== viewportRect.viewportOffsetLeft ||
      lastViewportRect.viewportOffsetTop !== viewportRect.viewportOffsetTop;
    if (viewportRectChanged) {
      lastVisibleRect = visibleRect;
      lastViewportRect = viewportRect;
      notify();
      return;
    }
  };

  check(initialEvent);

  const [publishBeforeAutoCheck, onBeforeAutoCheck] = createPubSub();
  const autoCheck = (event) => {
    const beforeCheckResults = publishBeforeAutoCheck(event);
    check(event);
    for (const beforeCheckResult of beforeCheckResults) {
      if (typeof beforeCheckResult === "function") {
        beforeCheckResult();
      }
    }
  };
  {
    // let rafId = null;
    // const scheduleCheck = (reason) => {
    //   cancelAnimationFrame(rafId);
    //   rafId = requestAnimationFrame(() => {
    //     autoCheck(reason);
    //   });
    // };
    // addTeardown(() => {
    //   cancelAnimationFrame(rafId);
    // });

    {
      // If scrollable parent is not document, also listen to document scroll
      // to update UI position when the scrollable parent moves in viewport
      const onDocumentScroll = (e) => {
        autoCheck(e);
      };
      document.addEventListener("scroll", onDocumentScroll, {
        passive: true,
      });
      addTeardown(() => {
        document.removeEventListener("scroll", onDocumentScroll, {
          passive: true,
        });
      });
      if (!scrollContainerIsDocument) {
        const onScroll = (e) => {
          autoCheck(e);
        };
        scrollContainer.addEventListener("scroll", onScroll, {
          passive: true,
        });
        addTeardown(() => {
          scrollContainer.removeEventListener("scroll", onScroll, {
            passive: true,
          });
        });
      }
    }
    {
      // visualViewport scroll fires when the visual viewport pans independently
      // of the layout viewport (e.g. during pinch-zoom). This is distinct from
      // document scroll and must be observed separately.
      if (window.visualViewport) {
        const onVisualViewportScroll = (e) => {
          autoCheck(e);
        };
        window.visualViewport.addEventListener(
          "scroll",
          onVisualViewportScroll,
        );
        addTeardown(() => {
          window.visualViewport.removeEventListener(
            "scroll",
            onVisualViewportScroll,
          );
        });
      }
    }
    {
      // See window_size.js's own module comment for why both of these go
      // through their shared debounce instead of each keeping its own timer.
      const onWindowOrViewportResize = (event) => {
        // An ancestor's own navi_position_transition follow loop (see
        // on_ancestor_events below) is already re-checking this element's
        // position every frame, tracking the ancestor's live in-flight
        // position — more accurately than this debounced, ~100ms-after-the-
        // fact check could. Reacting here too would race it: a real
        // "resize" event makes shouldTransition true, so this would animate
        // its own competing move toward a target computed from the
        // anchor's current (still mid-flight) rect.
        if (ancestorRepositioningCount > 0) {
          return;
        }
        autoCheck(event);
      };
      addTeardown(
        subscribeVisualViewportResizeSettled(onWindowOrViewportResize),
      );
      addTeardown(subscribeWindowResizeSettled(onWindowOrViewportResize));
    }
    on_element_resize: {
      if (skipElementResize) {
        break on_element_resize;
      }

      let isFirst = true;
      let handlingResize = false;
      const resizeObserver = new ResizeObserver(() => {
        if (isFirst) {
          isFirst = false;
          return;
        }
        if (handlingResize) {
          return;
        }
        // we use directly the result of getBoundingClientRect() instead of the resizeEntry.contentRect or resizeEntry.borderBoxSize
        // so that:
        // - We can compare the dimensions measure in the last check and the current one
        // - We don't have to check element boz-sizing to know what to compare
        // - resizeEntry.borderBoxSize browser support is not that great
        const { width, height } = element.getBoundingClientRect();
        const widthDiff = Math.abs(width - lastMeasuredWidth);
        const heightDiff = Math.abs(height - lastMeasuredHeight);
        if (widthDiff === 0 && heightDiff === 0) {
          return;
        }
        handlingResize = true;
        autoCheck(
          new CustomEvent("element_size_change", { detail: { width, height } }),
        );
        handlingResize = false;
      });
      resizeObserver.observe(element);
      const unsubscribeResizeWatchingPausedChange =
        onResizeWatchingPausedChange((paused) => {
          if (paused) {
            resizeObserver.unobserve(element);
          } else {
            resizeObserver.observe(element);
          }
        });
      // Temporarily disconnect ResizeObserver to prevent feedback loops eventually caused by update function
      onBeforeAutoCheck(() => {
        resizeObserver.unobserve(element);
        return () => {
          // Not reobserved at all while an ancestor is closed (see
          // pauseResizeWatching/resumeResizeWatching above) — resumeResizeWatching's
          // own publish is what reobserves once it reopens instead.
          if (!resizeWatchingPaused) {
            // This triggers a new call to the resive observer that will be ignored thanks to
            // the widthDiff/heightDiff early return
            resizeObserver.observe(element);
          }
        };
      });
      addTeardown(() => {
        unsubscribeResizeWatchingPausedChange();
        resizeObserver.disconnect();
      });
    }
    {
      const documentIntersectionObserver = new IntersectionObserver(
        () => {
          autoCheck(
            new CustomEvent("element_intersection_with_document_change"),
          );
        },
        {
          root: null,
          rootMargin: "0px",
          threshold: [0, 0.1, 0.9, 1],
        },
      );
      documentIntersectionObserver.observe(element);
      addTeardown(() => {
        documentIntersectionObserver.disconnect();
      });
      if (!scrollContainerIsDocument) {
        const scrollIntersectionObserver = new IntersectionObserver(
          () => {
            autoCheck(
              new CustomEvent("element_intersection_with_scroll_change"),
            );
          },
          {
            root: scrollContainer,
            rootMargin: "0px",
            threshold: [0, 0, 1, 0.9, 1],
          },
        );
        scrollIntersectionObserver.observe(element);
        addTeardown(() => {
          scrollIntersectionObserver.disconnect();
        });
      }
    }
    {
      const onWindowTouchMove = (e) => {
        autoCheck(e);
      };
      window.addEventListener("touchmove", onWindowTouchMove, {
        passive: true,
      });
      addTeardown(() => {
        window.removeEventListener("touchmove", onWindowTouchMove, {
          passive: true,
        });
      });
    }
    {
      // Self-inclusive on the first step only: `element` can itself be the
      // dialog/popover that closes (a callout anchored to a dialog rather than
      // to a field inside it), and its own close hides it just as much as an
      // ancestor's would. The walk up below starts from parentElement, so the
      // chain still advances.
      let currentOpenableAncestor = selfOrClosestOpenableAncestor(element);
      while (currentOpenableAncestor) {
        const openableAncestor = currentOpenableAncestor;
        if (!isAncestorOpen(openableAncestor)) {
          ancestorClosedCount++;
          pauseResizeWatching();
        }
        const removeOpenStateObserver = observeAncestorOpenState(
          openableAncestor,
          // eslint-disable-next-line no-loop-func
          ({ isOpen, toggleEvent }) => {
            if (!isOpen) {
              ancestorClosedCount++;
              pauseResizeWatching();
              // Invalidates check()'s own "did anything actually change"
              // caches — without this, reopening onto the exact same
              // geometry/viewport as before closing would look unchanged to
              // check() and it would skip calling update() again, leaving a
              // consumer stuck showing this closed/zeroed state.
              lastVisibleRect = null;
              lastViewportRect = null;
              update(
                {
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 0,
                  height: 0,
                  visibilityRatio: 0,
                },
                {
                  event: toggleEvent ?? new CustomEvent("ancestor_close"),
                  width: 0,
                  height: 0,
                  ancestorClosed: true,
                },
              );
              return;
            }
            if (ancestorClosedCount > 0) {
              ancestorClosedCount--;
            }
            if (ancestorClosedCount === 0) {
              resumeResizeWatching();
              check(toggleEvent ?? new CustomEvent("ancestor_open"));
            }
          },
        );

        const onNaviPositionChange = (e) => {
          autoCheck(e);
        };
        openableAncestor.addEventListener(
          "navi_position_change",
          onNaviPositionChange,
        );
        // Dispatched by applyNewPosition's own notifyPositionTransition
        // around this ancestor's own left/top animation (distinct from
        // navi_position_change, fired once with the final target, not per
        // frame). The anchor this element is positioned against may live
        // inside that ancestor and be moving right now — rather than hiding
        // for the duration (an opacity flicker once it settles reads worse
        // than a slightly-behind position), autoCheck() every frame for as
        // long as the animation runs, so this element stays in lockstep.
        // autoCheck, not check directly, so this element's own
        // ResizeObserver(s) stay unobserved for the loop's duration too —
        // repositioning every frame can itself cause reflows. e.detail.onEnd
        // stops the loop and settles on one final check once it ends.
        let positionTransitionRafId = null;
        let isTrackingPositionTransition = false;
        // ancestorRepositioningCount is intentionally shared across every
        // ancestor level (declared once, outside this loop) — it's a
        // single "is this element's position currently being driven by
        // some ancestor's transition" flag for the element itself, not
        // per-ancestor state.
        // eslint-disable-next-line no-loop-func
        const onNaviPositionTransition = (e) => {
          cancelAnimationFrame(positionTransitionRafId);
          if (!isTrackingPositionTransition) {
            isTrackingPositionTransition = true;
            ancestorRepositioningCount++;
          }
          const loop = () => {
            autoCheck(e);
            positionTransitionRafId = requestAnimationFrame(loop);
          };
          loop();
          e.detail.onEnd(() => {
            cancelAnimationFrame(positionTransitionRafId);
            if (isTrackingPositionTransition) {
              isTrackingPositionTransition = false;
              ancestorRepositioningCount--;
            }
            autoCheck(e);
          });
        };
        openableAncestor.addEventListener(
          "navi_position_transition",
          onNaviPositionTransition,
        );
        addTeardown(() => {
          removeOpenStateObserver();
          cancelAnimationFrame(positionTransitionRafId);
          openableAncestor.removeEventListener(
            "navi_position_change",
            onNaviPositionChange,
          );
          openableAncestor.removeEventListener(
            "navi_position_transition",
            onNaviPositionTransition,
          );
        });
        currentOpenableAncestor = closestOpenableAncestor(
          currentOpenableAncestor,
        );
      }
    }
  }

  // Re-checks whenever `elementToObserve` (some other element than the one
  // this effect tracks — e.g. a popover/callout's own content) changes size,
  // not just when `element` itself is scrolled/resized/re-anchored. Useful
  // when the tracked element's *position* depends on a size that lives
  // elsewhere (a callout re-measuring itself against its message body, a
  // popover reconsidering "top" vs "bottom" once its own content grows).
  // Can be called more than once, once per element worth watching.
  const observeSize = (elementToObserve) => {
    let lastWidth;
    let lastHeight;
    // Set right before a deferred check() runs, read right after — see
    // below for why a pending frame needs to be cancelable.
    let pendingFrame = null;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const { width, height } = entry.contentRect;
      // Debounce tiny changes that are likely sub-pixel rounding.
      if (lastWidth !== undefined) {
        const widthDiff = Math.abs(width - lastWidth);
        const heightDiff = Math.abs(height - lastHeight);
        const threshold = 1;
        if (widthDiff < threshold && heightDiff < threshold) {
          return;
        }
      }
      lastWidth = width;
      lastHeight = height;
      // Deferred to the next frame rather than calling check() here
      // directly: check() (via update()) commonly mutates
      // elementToObserve's own size again as a side effect of repositioning
      // it (e.g. a popover clearing then re-setting its own max-height
      // while reconsidering "top" vs "bottom" once it no longer fits where
      // it was) — when elementToObserve is the very element this observer
      // watches (a popover watching its own content, not some other
      // element), doing that synchronously from inside this callback is a
      // same-frame observer-triggers-itself loop, which the browser detects
      // and reports as "ResizeObserver loop completed with undelivered
      // notifications." The debounce above only guards against oscillation
      // across separate ResizeObserver deliveries — it does nothing for
      // this single legitimate resize-causes-a-reposition-causes-another-
      // resize step, since each individual size change here is real, not
      // sub-pixel noise. Deferring one frame breaks the synchronous chain:
      // by the time the reposition runs, this callback has already
      // returned, so any size change it causes is observed as a fresh,
      // later delivery instead of a nested one. Cancels/replaces any
      // still-pending frame from an earlier, superseded delivery, so only
      // the latest size ever actually gets checked.
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
      }
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        check(
          new CustomEvent(ELEMENT_SIZE_CHANGE, {
            detail: { width, height },
          }),
        );
      });
    });
    resizeObserver.observe(elementToObserve);
    // An ancestor may already be closed by the time a consumer calls
    // observeSize (e.g. Callout's own observeSize(calloutMessageElement)
    // call happens after visibleRectEffect itself returns) — keep this new
    // observer consistent with that already-paused state instead of
    // observing it only to immediately generate a closed-container
    // notification.
    if (resizeWatchingPaused) {
      resizeObserver.unobserve(elementToObserve);
    }
    const unsubscribeResizeWatchingPausedChange = onResizeWatchingPausedChange(
      (paused) => {
        if (paused) {
          resizeObserver.unobserve(elementToObserve);
        } else {
          resizeObserver.observe(elementToObserve);
        }
      },
    );
    const cleanupAutoCheck = onBeforeAutoCheck(() => {
      resizeObserver.unobserve(elementToObserve);
      return () => {
        // Not reobserved at all while an ancestor is closed (see
        // pauseResizeWatching/resumeResizeWatching) — resumeResizeWatching's
        // own publish is what reobserves once it reopens instead.
        if (!resizeWatchingPaused) {
          resizeObserver.observe(elementToObserve);
        }
      };
    });
    addTeardown(() => {
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
      }
      unsubscribeResizeWatchingPausedChange();
      resizeObserver.disconnect();
    });
    return () => {
      cleanupAutoCheck();
      unsubscribeResizeWatchingPausedChange();
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
      }
      resizeObserver.disconnect();
    };
  };

  return {
    check,
    onBeforeAutoCheck,
    observeSize,
    disconnect: () => {
      teardown();
    },
  };
};

/**
 * The `positionArea` grammar `pickPositionRelativeTo` accepts (also reused
 * as-is by `@jsenv/navi`'s Popover/Dialog/Callout): a single compass token
 * (loosely inspired by CSS `position-area`'s own naming), optionally wrapped
 * in `inset(...)` when the element should overlap the anchor instead of
 * sitting fully to one side of it. Resolves internally to a { y, x } pair —
 * y: top/inset-top/center/inset-bottom/bottom, x: left/inset-left/center/
 * inset-right/right — the same vocabulary the rest of this file's
 * positioning math (spaceFor, oppositeX/Y, etc.) actually operates on: a
 * bare `top`/`bottom`/`left`/`right` means outside the anchor (no overlap on
 * that axis), `inset-*` means flush against/overlapping it.
 *
 * Outside the anchor (bare token — element placed fully to one side, no
 * overlap on that side's axis):
 *
 *   top-left     top-start   top   top-end     top-right
 *   right-start                    right                  right-end
 *   bottom-right bottom-end  bottom bottom-start bottom-left
 *   left-end                       left                   left-start
 *
 * A corner token fixes one axis outside (top/bottom/left/right) and the
 * other the same way (a true corner, no cross-axis overlap at all).
 * "-start"/"-end" keep one axis outside but align the cross axis flush with
 * the anchor's near/far edge instead (`top-start` is above the anchor,
 * left-edges flush). The bare direction word centers the cross axis on the
 * anchor.
 *
 * Overlapping the anchor (wrapped in `inset(...)`, the classic 3×3 grid):
 *
 *   inset(top-left)     inset(top)    inset(top-right)
 *   inset(left)          center       inset(right)
 *   inset(bottom-left)  inset(bottom) inset(bottom-right)
 *
 * `center` and `inset(center)` are equivalent aliases for dead-center.
 */
const OUTSIDE_POSITION_AREA_TOKENS = {
  "top-left": { y: "top", x: "left" },
  "top-start": { y: "top", x: "inset-left" },
  "top": { y: "top", x: "center" },
  "top-end": { y: "top", x: "inset-right" },
  "top-right": { y: "top", x: "right" },

  "right-start": { y: "inset-top", x: "right" },
  "right": { y: "center", x: "right" },
  "right-end": { y: "inset-bottom", x: "right" },

  "bottom-right": { y: "bottom", x: "right" },
  "bottom-end": { y: "bottom", x: "inset-right" },
  "bottom": { y: "bottom", x: "center" },
  "bottom-start": { y: "bottom", x: "inset-left" },
  "bottom-left": { y: "bottom", x: "left" },

  "left-end": { y: "inset-bottom", x: "left" },
  "left": { y: "center", x: "left" },
  "left-start": { y: "inset-top", x: "left" },

  "center": { y: "center", x: "center" },
};
const INSET_POSITION_AREA_TOKENS = {
  "top-left": { y: "inset-top", x: "inset-left" },
  "top": { y: "inset-top", x: "center" },
  "top-right": { y: "inset-top", x: "inset-right" },

  "right": { y: "center", x: "inset-right" },

  "bottom-right": { y: "inset-bottom", x: "inset-right" },
  "bottom": { y: "inset-bottom", x: "center" },
  "bottom-left": { y: "inset-bottom", x: "inset-left" },

  "left": { y: "center", x: "inset-left" },

  "center": { y: "center", x: "center" },
};
const INSET_TOKEN_RE = /^inset\(\s*([a-z-]+)\s*\)$/;

/**
 * Parses a positionArea string into a { y, x } pair, or null if it's not a
 * recognized token.
 */
const parsePositionArea = (value) => {
  const insetMatch = INSET_TOKEN_RE.exec(value);
  if (insetMatch) {
    const parsed = INSET_POSITION_AREA_TOKENS[insetMatch[1]];
    return parsed ? { ...parsed } : null;
  }
  const parsed = OUTSIDE_POSITION_AREA_TOKENS[value];
  return parsed ? { ...parsed } : null;
};

/**
 * Collapses a bare position value ("top"/"bottom"/"left"/"right") to its
 * "inset-*" equivalent — "inset-*"/"center" values pass through unchanged.
 * Only used by pickPositionRelativeTo's own no-anchor (container-docked)
 * mode — see its own doc for why.
 */
const toContainerAlignedPosition = (value) => {
  if (value === "top") {
    return "inset-top";
  }
  if (value === "bottom") {
    return "inset-bottom";
  }
  if (value === "left") {
    return "inset-left";
  }
  if (value === "right") {
    return "inset-right";
  }
  return value;
};

/**
 * Places element relative to anchor with independent control of horizontal and vertical axes.
 *
 * `positionArea` (see its own doc above `parsePositionArea`) is a single
 * compass token that resolves to a { y, x } pair internally:
 *
 * Horizontal (x) axis:
 *   "left"        element.right  = anchor.left   (sits entirely to the left of anchor)
 *   "inset-left"  element.left   = anchor.left   (left edges aligned, overlapping)
 *   "center"      element centered horizontally over anchor
 *   "inset-right" element.right  = anchor.right  (right edges aligned, overlapping)
 *   "right"       element.left   = anchor.right  (sits entirely to the right of anchor)
 *
 * Vertical (y) axis:
 *   "top"          element.bottom = anchor.top    (sits above, no overlap)
 *   "inset-top"    element.top    = anchor.top    (top edges aligned, overlapping)
 *   "center"       element centered vertically over anchor
 *   "inset-bottom" element.bottom = anchor.bottom (bottom edges aligned, overlapping)
 *   "bottom"       element.top    = anchor.bottom (sits below, no overlap)
 *
 * The resolved x/y attempt the requested placement and automatically flip to the
 * logical opposite when the element does not fit in the viewport:
 *   top ↔ bottom,   inset-top ↔ inset-bottom,   left ↔ right,   inset-left ↔ inset-right
 *
 * `positionAreaFixed` skips the fit check entirely on both axes.
 *
 * The resolved X and Y are persisted as data-position-x-current / data-position-y-current
 * on the element so subsequent calls start from the last resolved position (avoids
 * flickering when the element is near the flip threshold) and so other CSS/JS can read
 * "which side is this on right now" — including for a fixed axis, even though a fixed
 * axis never reads the attribute back itself (`positionAreaFixed` always wins).
 *
 * @param {HTMLElement} element - The element to position (position: absolute or
 *   fixed — detected from its own computed style, see the scroll offset comment below)
 * @param {HTMLElement} [anchor] - The anchor element to position against. Omit (or pass
 *   `null`/`undefined`) when there's no real anchor to dock `element` against a *container*
 *   instead — see `container` below; in that mode, "top"/"bottom"/"left"/"right" are
 *   collapsed to their "inset-*" equivalent internally (docking has no "float away with
 *   a gap" concept the way a real anchor does) and x/y always behave as if
 *   `positionAreaFixed` were set (a docked edge/corner never flips to the other side —
 *   there's no "other side" of a container the way there is of a real anchor).
 * @param {object} [options]
 * @param {string} [options.positionArea="bottom"] - Preferred placement, with viewport
 *   fallback — see `parsePositionArea`'s own doc for the full token grammar (a single
 *   compass token, optionally `inset(...)`-wrapped).
 * @param {string} [options.positionAreaFixed] - Forces this placement, skipping the
 *   fit-check on both axes. Same grammar as `positionArea`.
 * @param {string} [options.positionAreaWhenAnchorIsInvalid="center"] - `positionArea`
 *   used instead, as a plain no-anchor dock, whenever the anchor is too big to leave
 *   room on the axis `positionArea` places it outside of. `hasValidAnchor` in the return
 *   value reports which way it went.
 * @param {Event|CustomEvent} [options.event] - The event that triggered this particular
 *   reposition (a scroll/resize/etc. handler simply forwarding whatever it was itself
 *   called with) — purely informational, never changes the computed `left`/`top`
 *   themselves, only `shouldTransition` in the return value (see `applyNewPosition`'s
 *   own doc for how that's meant to be used).
 * @param {number} [options.alignToContainerEdgeWhenAnchorNearEdge=0] - When centering
 *   (positionArea's x is "center") an element wider than its anchor, snap to the available area's own
 *   left edge (the page viewport normally, or the container's edge — see `container` below —
 *   whenever there's no real `anchor`) instead of centering, once the anchor is within this
 *   many px of that same edge — avoids the (wider) element overflowing past it. 0 disables
 *   the snap entirely.
 * @param {number} [options.minLeft=0] - Minimum left coordinate (document-relative).
 * @param {HTMLElement|null} [options.container] - The container `element` is genuinely
 *   `position: absolute` relative to (its own containing block) — decoupled from whether
 *   there's a real `anchor`, since `element` can be container-relative either way (e.g. the
 *   custom renderer in popover.jsx, always relative to its own positioned ancestor whether
 *   or not it also has a real anchor). Whenever not explicitly given, this is always
 *   resolved automatically via `getPositionedParent(element)` instead — regardless of
 *   `hasValidAnchor` — so a caller that never thinks about `container` at all still gets the
 *   right behavior on its own: `document.documentElement` from `getPositionedParent` (an
 *   `element` promoted to the top layer — a `[popover]` while shown, or a `<dialog>` while
 *   actually modal — or one with no positioned ancestor at all, e.g. Callout's own element)
 *   falls back to the traditional document-relative path below, exactly as if `container`
 *   genuinely didn't apply; anything else `getPositionedParent` finds (a real positioned
 *   ancestor) is used the same way an explicit `container` would be. A container that
 *   resolves to `document.documentElement` (the viewport) produces identical output to the
 *   plain document-relative path either way, since the document's own scroll and the
 *   viewport's own origin already coincide with what this generically computes for any other
 *   container element. When there's a real container (explicit or resolved) either way: the final
 *   `left`/`top` (and the returned `anchorLeft/Top/Right/Bottom`) are expressed relative to
 *   its own padding-box origin plus its own scroll, instead of the document's — `element`'s
 *   own computed `position` is *not* consulted in that case, unlike the traditional path.
 *   When `anchor` is also omitted (no real anchor at all), the container additionally
 *   becomes what's positioned against, and the boundary clamp uses its own (padding-box)
 *   edges instead of the page viewport's, on both axes (the Y axis otherwise has no such
 *   clamp at all — see the clamp's own comment) — that part *is* gated on `hasValidAnchor`,
 *   unlike the coordinate-space conversion itself.
 * @returns {{ hasValidAnchor, shouldTransition, positionX, positionY, left, top, width, height, anchorLeft, anchorTop, anchorRight, anchorBottom, spaceLeft, spaceRight, spaceAbove, spaceBelow, containerWidthAvailable, containerHeightAvailable }}
 */
const pickPositionRelativeTo = (
  element,
  anchor,
  {
    positionArea = "bottom",
    positionAreaFixed,
    positionAreaWhenAnchorIsInvalid = "center",
    event,
    alignToContainerEdgeWhenAnchorNearEdge = 0,
    minLeft = 0,
    marginWithAnchor = 0,
    alignToAnchorBox = "border-box",
    marginWithContainer = 0,
    container,
  } = {},
) => {
  // Needed before hasValidAnchor below.
  const {
    left: viewportLeft,
    top: viewportTop,
    width: viewportWidth,
    height: viewportHeight,
  } = getVisibleViewportRect();

  // Resolved early: everything below that would otherwise reach for
  // viewportLeft/Top/Width/Height instead uses these, so a "local" popover
  // never gets offered more room (anchor-too-big check, flip decisions,
  // clamp) than its own container — resolvedContainer's own padding-box
  // edges when there is one — actually has.
  // Always a real element now (never null/undefined) — getPositionedParent
  // itself never returns anything falsy, document.documentElement (the
  // viewport) included.
  const resolvedContainer = container ?? getPositionedParent(element);
  const hasRealContainer = resolvedContainer !== document.documentElement;
  const containerRect = hasRealContainer
    ? resolvedContainer.getBoundingClientRect()
    : null;
  const containerBorders = hasRealContainer
    ? getBorderSizes(resolvedContainer)
    : { left: 0, top: 0, right: 0, bottom: 0 };
  const availableLeft = hasRealContainer
    ? snapToPixel(containerRect.left) + containerBorders.left
    : viewportLeft;
  const availableTop = hasRealContainer
    ? snapToPixel(containerRect.top) + containerBorders.top
    : viewportTop;
  const availableRight = hasRealContainer
    ? snapToPixel(containerRect.right) - containerBorders.right
    : viewportLeft + viewportWidth;
  const availableBottom = hasRealContainer
    ? snapToPixel(containerRect.bottom) - containerBorders.bottom
    : viewportTop + viewportHeight;
  const availableWidth = availableRight - availableLeft;
  const availableHeight = availableBottom - availableTop;

  // Rejected only on the axis positionArea actually places `element`
  // outside of ("left"/"right" or "top"/"bottom") — that's the only axis
  // where the anchor's own size eats into the room available. Docks via
  // positionAreaWhenAnchorIsInvalid instead of `positionArea` once rejected.
  const requestedPositionArea = parsePositionArea(positionArea);
  const anchorRejected =
    Boolean(anchor) &&
    (() => {
      const rect = anchor.getBoundingClientRect();
      const { x, y } = requestedPositionArea ?? {};
      if (
        (y === "top" || y === "bottom") &&
        rect.height > availableHeight - 50
      ) {
        return true;
      }
      if ((x === "left" || x === "right") && rect.width > availableWidth - 50) {
        return true;
      }
      return false;
    })();
  const hasValidAnchor = Boolean(anchor) && !anchorRejected;
  const effectivePositionArea = anchorRejected
    ? positionAreaWhenAnchorIsInvalid
    : positionArea;

  const parsedPositionArea = parsePositionArea(effectivePositionArea);
  if (!parsedPositionArea) {
    console.warn(
      `pickPositionRelativeTo: invalid positionArea="${effectivePositionArea}"`,
    );
  }
  let positionX = parsedPositionArea ? parsedPositionArea.x : "center";
  let positionY = parsedPositionArea ? parsedPositionArea.y : "bottom";
  let positionXFixed;
  let positionYFixed;
  if (positionAreaFixed) {
    const parsedPositionAreaFixed = parsePositionArea(positionAreaFixed);
    if (!parsedPositionAreaFixed) {
      console.warn(
        `pickPositionRelativeTo: invalid positionAreaFixed="${positionAreaFixed}"`,
      );
    } else {
      positionXFixed = parsedPositionAreaFixed.x;
      positionYFixed = parsedPositionAreaFixed.y;
    }
  }
  // No real anchor (or a rejected one): dock against a container instead.
  if (!hasValidAnchor) {
    positionX = toContainerAlignedPosition(positionX);
    positionY = toContainerAlignedPosition(positionY);
    positionXFixed = positionX;
    positionYFixed = positionY;
  }
  // resolvedContainer was already resolved above. document.documentElement
  // from getPositionedParent (a popover/dialog element, e.g. Callout's own,
  // or one with no positioned ancestor at all) falls through to the
  // traditional document-relative path below all the same, so an existing
  // caller that never thinks about `container` at all keeps behaving
  // exactly as before.
  const effectiveAnchor = hasValidAnchor ? anchor : resolvedContainer;
  // document.documentElement is used as a sentinel "the viewport" value: an
  // anchorless popup should center/place itself against the visual
  // viewport, not against <html>'s own box — which, unlike the viewport,
  // grows with document content and can be far taller than what's on
  // screen (its top is also negative once the page is scrolled). Using the
  // viewport rect here fixes that; the scroll offset is still applied
  // below like any other case (see getPositioningScrollOffset).
  const anchorIsViewport = effectiveAnchor === document.documentElement;
  // Get viewport-relative positions
  const anchorRect = anchorIsViewport
    ? {
        left: viewportLeft,
        top: viewportTop,
        right: viewportLeft + viewportWidth,
        bottom: viewportTop + viewportHeight,
      }
    : effectiveAnchor.getBoundingClientRect();
  const anchorLeft = snapToPixel(anchorRect.left);
  const anchorTop = snapToPixel(anchorRect.top);
  const anchorRight = snapToPixel(anchorRect.right);
  const anchorBottom = snapToPixel(anchorRect.bottom);
  // Horizontal clamp bounds — see availableLeft/availableRight above.
  const clampLeftBound = availableLeft;
  const clampRightBound = availableRight;
  // offsetWidth/offsetHeight (layout box), not getBoundingClientRect() (the
  // painted/transformed box): the element being positioned may have an
  // active CSS `scale`/`translate` transform mid-animation (e.g. a popover
  // using animation="scale"/"grow", still at its @starting-style value the
  // instant it's first shown) — getBoundingClientRect() would then report
  // its *shrunk* transformed size, throwing off any math that centers/fits
  // against the element's own dimensions.
  const elementWidth = element.offsetWidth;
  const elementHeight = element.offsetHeight;
  const anchorWidth = anchorRight - anchorLeft;
  const anchorHeight = anchorBottom - anchorTop;

  // alignToAnchorBox controls whether the element aligns to the anchor's border-box (outer edge)
  // or content-box (inner content area, ignoring padding and border).
  // content-box lets the arrow point into the content area instead of the outer edge.
  // Insets are directional: top/bottom for Y-axis, left/right for X-axis.
  // When positioning above, only the top inset applies (content-box top edge).
  // When positioning below, only the bottom inset applies (content-box bottom edge).
  let insetTop = 0;
  let insetBottom = 0;
  let insetLeft = 0;
  let insetRight = 0;
  if (alignToAnchorBox === "content-box") {
    const anchorBorderSizes = getBorderSizes(effectiveAnchor);
    const anchorPaddingSizes = getPaddingSizes(effectiveAnchor);
    insetTop = anchorBorderSizes.top + anchorPaddingSizes.top;
    insetBottom = anchorBorderSizes.bottom + anchorPaddingSizes.bottom;
    insetLeft = anchorBorderSizes.left + anchorPaddingSizes.left;
    insetRight = anchorBorderSizes.right + anchorPaddingSizes.right;
  }
  const spaceAbove = anchorTop + insetTop - availableTop;
  const spaceBelow = availableBottom - anchorBottom + insetBottom;
  const effectiveAnchorLeft = anchorLeft + insetLeft;
  const effectiveAnchorRight = anchorRight - insetRight;
  const spaceLeft = anchorLeft + insetLeft - availableLeft;
  const spaceRight = availableRight - anchorRight + insetRight;

  // Resolve active X and Y, and whether each is fixed (no flip fallback)
  let activeX;
  let activeY;
  const xIsFixed = Boolean(positionXFixed);
  const yIsFixed = Boolean(positionYFixed);
  const hasStoredY = Boolean(element.getAttribute("data-position-y-current"));
  const hasStoredX = Boolean(element.getAttribute("data-position-x-current"));
  if (xIsFixed) {
    activeX = positionXFixed;
  } else {
    const storedX = element.getAttribute("data-position-x-current");
    activeX = storedX ?? positionX;
  }
  if (yIsFixed) {
    activeY = positionYFixed;
  } else {
    const storedY = element.getAttribute("data-position-y-current");
    activeY = storedY ?? positionY;
  }

  // Resolve final Y
  let finalY;
  {
    const oppositeY = {
      "top": "bottom",
      "bottom": "top",
      "inset-top": "inset-bottom",
      "inset-bottom": "inset-top",
    };
    // Compute effective space for a given Y value
    const spaceFor = (y) => {
      if (y === "top") {
        return spaceAbove - marginWithAnchor - marginWithContainer;
      }
      if (y === "inset-bottom") {
        return spaceAbove + anchorHeight - marginWithContainer;
      }
      if (y === "bottom") {
        return spaceBelow - marginWithAnchor - marginWithContainer;
      }
      if (y === "inset-top") {
        return spaceBelow + anchorHeight - marginWithContainer;
      }
      return Infinity; // center
    };
    if (yIsFixed || activeY === "center") {
      finalY = activeY;
    } else if (!hasStoredY) {
      // Never positioned before — pick the best side from scratch.
      const preferred = positionY;
      const opposite = oppositeY[preferred];
      const preferredFits = spaceFor(preferred) >= elementHeight;
      const oppositeFits = spaceFor(opposite) >= elementHeight;
      if (preferredFits) {
        // Preferred fits completely — use it (even if opposite also fits)
        finalY = preferred;
      } else if (oppositeFits) {
        // Only opposite fits completely — flip
        finalY = opposite;
      } else {
        // Neither fits completely — use whichever meets the minimum ratio
        const preferredMeetsRatio =
          spaceFor(preferred) / elementHeight >= MIN_CONTENT_VISIBILITY_RATIO;
        finalY = preferredMeetsRatio ? preferred : opposite;
      }
    } else {
      // Previously positioned — stay as long as current side meets minimum ratio
      const currentFitsEnough =
        spaceFor(activeY) / elementHeight >= MIN_CONTENT_VISIBILITY_RATIO;
      if (currentFitsEnough) {
        finalY = activeY;
      } else {
        // Only flip if the opposite side has more space — avoids oscillation
        // when neither side has enough room (both fail the ratio).
        const opposite = oppositeY[activeY];
        const oppositeHasMoreSpace = spaceFor(opposite) > spaceFor(activeY);
        finalY = oppositeHasMoreSpace ? opposite : activeY;
      }
    }
  }

  // Resolve final X
  let finalX;
  {
    const oppositeX = {
      "left": "right",
      "right": "left",
      "inset-left": "inset-right",
      "inset-right": "inset-left",
    };
    // Compute effective space for a given X value
    const spaceFor = (x) => {
      if (x === "left") {
        return spaceLeft - marginWithAnchor - marginWithContainer;
      }
      if (x === "inset-left") {
        return availableRight - anchorLeft - marginWithContainer;
      }
      if (x === "inset-right") {
        return anchorRight - availableLeft - marginWithContainer;
      }
      if (x === "right") {
        return spaceRight - marginWithAnchor - marginWithContainer;
      }
      return Infinity; // center
    };
    if (xIsFixed || activeX === "center") {
      finalX = activeX;
    } else if (!hasStoredX) {
      // Never positioned before — pick the best side from scratch.
      const preferred = positionX;
      const opposite = oppositeX[preferred];
      const preferredFits = spaceFor(preferred) >= elementWidth;
      const oppositeFits = spaceFor(opposite) >= elementWidth;
      if (preferredFits) {
        finalX = preferred;
      } else if (oppositeFits) {
        finalX = opposite;
      } else {
        const preferredMeetsRatio =
          spaceFor(preferred) / elementWidth >= MIN_CONTENT_VISIBILITY_RATIO;
        finalX = preferredMeetsRatio ? preferred : opposite;
      }
    } else {
      // Previously positioned — stay as long as current side meets minimum ratio
      const currentFitsEnough =
        spaceFor(activeX) / elementWidth >= MIN_CONTENT_VISIBILITY_RATIO;
      if (currentFitsEnough) {
        finalX = activeX;
      } else {
        // Only flip if the opposite side has more space — avoids oscillation
        // when neither side has enough room (both fail the ratio). Mirrors
        // the Y-axis branch above; missing here was the actual cause of a
        // real left/right flicker on a narrow viewport (neither side ever
        // "fits enough", so this branch ran on every reposition).
        const opposite = oppositeX[activeX];
        const oppositeHasMoreSpace = spaceFor(opposite) > spaceFor(activeX);
        finalX = oppositeHasMoreSpace ? opposite : activeX;
      }
    }
  }

  // Calculate horizontal position (viewport-relative)
  let elementPositionLeft;
  {
    if (finalX === "left") {
      elementPositionLeft =
        effectiveAnchorLeft - elementWidth - marginWithAnchor;
    } else if (finalX === "inset-left") {
      elementPositionLeft = effectiveAnchorLeft;
    } else if (finalX === "center") {
      // Complex logic handles wide anchors and container-edge snapping
      const anchorIsWiderThanAvailable = anchorWidth > availableWidth;
      if (anchorIsWiderThanAvailable) {
        const anchorLeftIsVisible = effectiveAnchorLeft >= availableLeft;
        const anchorRightIsVisible = effectiveAnchorRight <= availableRight;
        if (!anchorLeftIsVisible && anchorRightIsVisible) {
          const availableCenter = availableLeft + availableWidth / 2;
          const distanceFromRightEdge = availableRight - effectiveAnchorRight;
          elementPositionLeft =
            availableCenter - distanceFromRightEdge / 2 - elementWidth / 2;
        } else if (anchorLeftIsVisible && !anchorRightIsVisible) {
          const availableCenter = availableLeft + availableWidth / 2;
          const distanceFromLeftEdge = availableLeft - effectiveAnchorLeft;
          elementPositionLeft =
            availableCenter - distanceFromLeftEdge / 2 - elementWidth / 2;
        } else {
          elementPositionLeft =
            availableLeft + availableWidth / 2 - elementWidth / 2;
        }
      } else {
        elementPositionLeft =
          effectiveAnchorLeft +
          (effectiveAnchorRight - effectiveAnchorLeft) / 2 -
          elementWidth / 2;
        if (alignToContainerEdgeWhenAnchorNearEdge) {
          const effectiveAnchorWidth =
            effectiveAnchorRight - effectiveAnchorLeft;
          const elementIsWiderThanAnchor = elementWidth > effectiveAnchorWidth;
          const anchorIsNearContainerEdge =
            effectiveAnchorLeft - clampLeftBound <
            alignToContainerEdgeWhenAnchorNearEdge;
          if (elementIsWiderThanAnchor && anchorIsNearContainerEdge) {
            elementPositionLeft = clampLeftBound + minLeft;
          }
        }
      }
    } else if (finalX === "inset-right") {
      elementPositionLeft = effectiveAnchorRight - elementWidth;
    } else {
      // "right"
      elementPositionLeft = effectiveAnchorRight + marginWithAnchor;
    }
    // Constrain horizontal position to the available area's boundaries
    // (with marginWithContainer margin).
    if (elementPositionLeft < clampLeftBound + marginWithContainer) {
      elementPositionLeft = clampLeftBound + marginWithContainer;
    } else if (
      elementPositionLeft + elementWidth >
      clampRightBound - marginWithContainer
    ) {
      elementPositionLeft =
        clampRightBound - marginWithContainer - elementWidth;
    }
  }

  // Calculate vertical position (viewport-relative)
  let elementPositionTop;
  {
    if (finalY === "top") {
      // top is always anchorTop + insetTop - elementHeight - marginWithAnchor — max-height truncates if needed.
      const idealTop = anchorTop + insetTop - elementHeight - marginWithAnchor;
      elementPositionTop =
        idealTop < marginWithContainer ? marginWithContainer : idealTop;
    } else if (finalY === "inset-bottom") {
      const idealTop = anchorBottom - elementHeight;
      elementPositionTop =
        idealTop < marginWithContainer ? marginWithContainer : idealTop;
    } else if (finalY === "center") {
      elementPositionTop = anchorTop + anchorHeight / 2 - elementHeight / 2;
    } else if (finalY === "inset-top") {
      const idealTop = anchorTop;
      elementPositionTop =
        idealTop % 1 === 0 ? idealTop : Math.floor(idealTop) + 1;
    } else {
      // "bottom"
      // top is always anchorBottom - insetBottom + marginWithAnchor — max-height (via --container-position-remaining-height) truncates
      // the element height so it doesn't overflow the viewport bottom.
      const idealTop = anchorBottom - insetBottom + marginWithAnchor;
      elementPositionTop =
        idealTop % 1 === 0 ? idealTop : Math.floor(idealTop) + 1;
    }
    // Unlike the horizontal clamp above, there's normally no universal
    // vertical boundary clamp at all — "top"/"bottom" already clamp their
    // own idealTop inline, "inset-*"/"center" don't, and changing that
    // for every existing consumer (real-anchor "bottom" near the viewport
    // bottom relies on --container-position-remaining-height/max-height truncation instead of
    // repositioning) is out of scope here. Scoped strictly to the no-anchor
    // (container-docked) case, where it's new and safe: a container is
    // always meant to be respected on both axes.
    if (!hasValidAnchor) {
      if (elementPositionTop < availableTop + marginWithContainer) {
        elementPositionTop = availableTop + marginWithContainer;
      } else if (
        elementPositionTop + elementHeight >
        availableBottom - marginWithContainer
      ) {
        elementPositionTop =
          availableBottom - marginWithContainer - elementHeight;
      }
    }
  }

  // Persist resolved X/Y so subsequent calls start from here (avoids
  // flickering) — and so CSS consumers (e.g. Popover's "clip" animation,
  // which reads data-position-y-current to pick which edge to reveal from)
  // can rely on it always reflecting the current side, fixed or not. A fixed
  // axis is never read back from this attribute (xIsFixed/yIsFixed always
  // wins over the stored value above), so persisting it here is purely for
  // those outside readers, not for this function's own flip logic.
  element.setAttribute("data-position-x-current", finalX);
  element.setAttribute("data-position-y-current", finalY);

  // Convert the viewport-relative math above into whatever coordinate space
  // `element.style.top/left` actually needs. This is decided independently
  // of whether there's a real anchor: `element` might be `position:
  // absolute` relative to some container regardless (e.g. the custom
  // renderer in popover.jsx, which is always relative to its own
  // positioned ancestor whether or not it also has a real anchor) — that's
  // what `resolvedContainer` (explicit or auto-resolved above) communicates
  // even when `anchor` is also given. The container to convert into is
  // `resolvedContainer` when there's a real anchor, or (in the no-anchor
  // case) `effectiveAnchor` itself, since there the container *is* what's
  // being positioned against.
  const coordinateContainer = hasValidAnchor
    ? resolvedContainer
    : effectiveAnchor;
  let scrollLeft;
  let scrollTop;
  if (coordinateContainer && coordinateContainer !== document.documentElement) {
    // Reuse anchorRect/containerBorders when the coordinate container is
    // the same element already measured above (the no-anchor case);
    // otherwise (a real anchor positioned within a *different*, explicitly
    // given container) measure the container separately — the anchor's own
    // rect only matters for the positioning math above, not for this.
    const isSameAsEffectiveAnchor = coordinateContainer === effectiveAnchor;
    const coordinateRect = isSameAsEffectiveAnchor
      ? anchorRect
      : coordinateContainer.getBoundingClientRect();
    const coordinateBorders = isSameAsEffectiveAnchor
      ? containerBorders
      : getBorderSizes(coordinateContainer);
    scrollLeft =
      -coordinateRect.left -
      coordinateBorders.left +
      coordinateContainer.scrollLeft;
    scrollTop =
      -coordinateRect.top -
      coordinateBorders.top +
      coordinateContainer.scrollTop;
  } else {
    // No container to convert into (a plain real anchor, the common case
    // for Callout/Picker/Popover's own via-attribute renderer), or the
    // container is the viewport itself (Popover's via-attribute renderer
    // when docked, no real anchor) — either way, `element`'s own computed
    // `position` (fixed vs absolute, detected dynamically) decides whether
    // any scroll offset applies at all: none for position: fixed (already
    // viewport-relative — adding scroll would double-count it), the
    // document's own scroll for position: absolute (relative to the
    // initial containing block, i.e. document-relative) — including when
    // docked to the viewport, so the result lands at the visual center of
    // the viewport at its current scroll position.
    ({ scrollLeft, scrollTop } = getPositioningScrollOffset(element));
  }
  // visibleRectEffect recomputes this on every scroll tick, which is what
  // keeps it looking anchored as the page (or the container) scrolls
  // either way.
  const elementDocumentLeft = snapToPixel(elementPositionLeft + scrollLeft);
  const elementDocumentTop = snapToPixel(elementPositionTop + scrollTop);
  const anchorDocumentLeft = anchorLeft + scrollLeft;
  const anchorDocumentTop = anchorTop + scrollTop;
  const anchorDocumentRight = anchorRight + scrollLeft;
  const anchorDocumentBottom = anchorBottom + scrollTop;

  // For overlap variants the element starts at the anchor edge (not past it),
  // so the usable space includes the anchor dimension.
  // marginWithAnchor (gap between anchor and element) and marginWithContainer are subtracted
  // so callers get the net usable space directly.
  const containerWidthAvailable = availableWidth - 2 * marginWithContainer;
  const containerHeightAvailable = availableHeight - 2 * marginWithContainer;
  // Docked to a container (no real anchor): the element is kept inside the
  // container's margin on BOTH sides — that is what the !hasValidAnchor clamp
  // above enforces — so what it has to work with is the container net of both.
  // The anchor-relative formulas below count the margin once, which is right
  // when the space really is bounded by the anchor on the other side, and
  // wrong here: it would let the far edge grow flush against the container.
  const effectiveSpaceAbove = !hasValidAnchor
    ? containerHeightAvailable
    : (finalY === "inset-bottom" ? spaceAbove + anchorHeight : spaceAbove) -
      (finalY === "top" ? marginWithAnchor : 0) -
      marginWithContainer;
  const effectiveSpaceBelow = !hasValidAnchor
    ? containerHeightAvailable
    : (finalY === "inset-top" ? spaceBelow + anchorHeight : spaceBelow) -
      (finalY === "bottom" ? marginWithAnchor : 0) -
      marginWithContainer;
  const effectiveSpaceLeft = !hasValidAnchor
    ? containerWidthAvailable
    : (finalX === "inset-right" ? spaceLeft + anchorWidth : spaceLeft) -
      (finalX === "left" ? marginWithAnchor : 0) -
      marginWithContainer;
  const effectiveSpaceRight = !hasValidAnchor
    ? containerWidthAvailable
    : (finalX === "inset-left" ? spaceRight + anchorWidth : spaceRight) -
      (finalX === "right" ? marginWithAnchor : 0) -
      marginWithContainer;

  return {
    // Whether a real anchor actually ended up used — false when there's no
    // `anchor`, or it was rejected as too big.
    hasValidAnchor,
    // True only when `event` is a "resize" — see applyNewPosition's own
    // doc for why only resize-triggered repositions are meant to animate.
    shouldTransition: event?.type === "resize",
    positionX: finalX,
    positionY: finalY,
    left: elementDocumentLeft,
    top: elementDocumentTop,
    width: elementWidth,
    height: elementHeight,
    anchorLeft: anchorDocumentLeft,
    anchorTop: anchorDocumentTop,
    anchorRight: anchorDocumentRight,
    anchorBottom: anchorDocumentBottom,
    spaceLeft: effectiveSpaceLeft,
    spaceRight: effectiveSpaceRight,
    spaceAbove: effectiveSpaceAbove,
    spaceBelow: effectiveSpaceBelow,
    // What a centered axis has to work with: the whole container, net of the
    // margin kept on both sides. spaceLeft/spaceRight can't answer that — they
    // are measured from the anchor, which for a container-docked element is
    // the container itself, so they collapse to -marginWithContainer.
    containerWidthAvailable,
    containerHeightAvailable,
  };
};

// Per-element bookkeeping for the currently in-flight, self-driven position
// transition, if any — see notifyPositionTransition's own doc for why this
// is animation-driven rather than listening for the browser's own
// transitionrun/transitionend: element -> { animation, endCallbacks }.
const pendingPositionTransitions = new WeakMap();

// Reads `cssVarName` off `element` (getComputedStyle, so it's whatever the
// cascade resolves to — a consumer can set it inline, in its own CSS rule,
// or not at all) and converts it to milliseconds: "0.25s" -> 250, "250ms" ->
// 250. Falls back to `fallbackMs` when unset/empty/unparsable, so a caller
// never has to declare the CSS var itself just to get a sane default
// duration — it only needs to when it actually wants to override it.
const parseTransitionDurationMs = (element, cssVarName, fallbackMs) => {
  const trimmed = getStyle(element, cssVarName).trim();
  if (!trimmed) {
    return fallbackMs;
  }
  if (trimmed.endsWith("ms")) {
    return parseFloat(trimmed);
  }
  if (trimmed.endsWith("s")) {
    return parseFloat(trimmed) * 1000;
  }
  const parsed = parseFloat(trimmed);
  return Number.isNaN(parsed) ? fallbackMs : parsed;
};

/**
 * Dispatches a single "navi_position_transition" event on `element`,
 * self-driven rather than confirmed by the browser's own `transitionrun` —
 * `applyNewPosition` calls this exactly when it knows it just started a
 * left/top `animation`, so there's nothing to wait for. transitionrun was
 * tried first and dropped: it reacts to *any* transition sharing the
 * element (a scale/opacity entrance would wrongly hide a descendant too),
 * and filtering by `propertyName` is unreliable (observed firing for "top"
 * instead of "left" in practice, despite the transition-property order).
 * A dedicated `Animation` sidesteps both.
 *
 * A descendant anchored inside `element` (see on_ancestor_events)
 * re-checks its own position every frame for as long as this animation
 * runs, instead of showing a stale position. `event.detail.onEnd(callback)`
 * is how it learns when the animation actually ends.
 *
 * A second reposition landing mid-animation cancels the pending one and
 * flushes its own registered callbacks immediately (same spirit as a real
 * `transitioncancel`), so nothing is left waiting on a superseded `onEnd`.
 *
 * `commitStyles()` below isn't what makes the final position correct —
 * `applyNewPosition` already sets the specified `left`/`top` before this
 * animation starts, so it takes back over once the active duration elapses
 * regardless. It just makes that explicit instead of relying on `fill:
 * "none"` timing, and drops the finished Animation instead of leaving it.
 */
const notifyPositionTransition = (element, animation) => {
  const pending = pendingPositionTransitions.get(element);
  if (pending) {
    pending.animation.cancel();
    for (const callback of pending.endCallbacks) {
      callback();
    }
  }
  const endCallbacks = [];
  dispatchCustomEvent(element, "navi_position_transition", {
    onEnd: (callback) => {
      endCallbacks.push(callback);
    },
  });
  const current = { animation, endCallbacks };
  pendingPositionTransitions.set(element, current);
  animation.finished
    .then(() => {
      if (pendingPositionTransitions.get(element) === current) {
        pendingPositionTransitions.delete(element);
      }
      try {
        animation.commitStyles();
      } catch {
        // Element no longer rendered (removed/hidden mid-animation) —
        // nothing to commit to, and left/top were already final anyway.
      }
      animation.cancel();
      for (const callback of endCallbacks) {
        callback();
      }
    })
    .catch(() => {
      // Cancelled by a subsequent reposition — already flushed above.
    });
};

/**
 * Applies a `pickPositionRelativeTo` result to `element`. `left`/`top` are
 * set instantly (a scroll-triggered reposition should never lag its
 * target); when `shouldTransition` is set (a resize-triggered reposition),
 * the visual move is played out via `element.animate()` instead — kept
 * independent of Popover/Dialog/Callout's own opacity/scale/display CSS
 * transition on the same element, so neither can clobber the other (see
 * notifyPositionTransition's own doc for why a dedicated Animation over a
 * CSS one). Duration comes from `--popup-position-transition-duration`
 * (parseTransitionDurationMs), falling back to 180ms unset.
 * Dispatches navi_position_transition when it starts such an animation, and
 * navi_position_change unconditionally — every caller (Dialog, Popover,
 * Callout) wants both, so a descendant anchored inside `element` can always
 * recheck its own position whenever `element` moves.
 */
const applyNewPosition = (
  element,
  {
    left,
    top,
    shouldTransition,
    positionX,
    positionY,
    spaceLeft,
    spaceRight,
    spaceAbove,
    spaceBelow,
    containerWidthAvailable,
    containerHeightAvailable,
  },
) => {
  // A centered axis is published too, from the container's own extent: leaving
  // the property unset lets the consumer's size cap fall back to its viewport
  // default, which overflows any container smaller than the viewport (a
  // dialog/popover confined to a positioned ancestor). It stays a "remaining
  // space" either way — docked: what is left on that side, centered: the whole
  // container minus its margins.
  if (positionY === "top" || positionY === "inset-bottom") {
    element.style.setProperty(
      "--container-position-remaining-height",
      `${spaceAbove}px`,
    );
  } else if (positionY === "bottom" || positionY === "inset-top") {
    element.style.setProperty(
      "--container-position-remaining-height",
      `${spaceBelow}px`,
    );
  } else if (containerHeightAvailable === undefined) {
    element.style.removeProperty("--container-position-remaining-height");
  } else {
    element.style.setProperty(
      "--container-position-remaining-height",
      `${containerHeightAvailable}px`,
    );
  }
  if (positionX === "left" || positionX === "inset-right") {
    element.style.setProperty(
      "--container-position-remaining-width",
      `${spaceLeft}px`,
    );
  } else if (positionX === "right" || positionX === "inset-left") {
    element.style.setProperty(
      "--container-position-remaining-width",
      `${spaceRight}px`,
    );
  } else if (containerWidthAvailable === undefined) {
    element.style.removeProperty("--container-position-remaining-width");
  } else {
    element.style.setProperty(
      "--container-position-remaining-width",
      `${containerWidthAvailable}px`,
    );
  }

  // A single implicit keyframe turned out not to work here: the WAAPI
  // "neutral" start keyframe isn't frozen at `animate()` call time, it's
  // resolved from the underlying value when the animation is first
  // *sampled* (the next frame) — by then `element.style.left`/`top` below
  // has already been overwritten with the new target, so start === end and
  // nothing visibly moves (observed as the dialog just jumping). Reading
  // the previous value ourselves, before overwriting it, and passing both
  // keyframes explicitly sidesteps that entirely.
  const previousLeft = parseFloat(element.style.left) || left;
  const previousTop = parseFloat(element.style.top) || top;
  if (shouldTransition) {
    const animation = element.animate(
      [
        { left: `${previousLeft}px`, top: `${previousTop}px` },
        { left: `${left}px`, top: `${top}px` },
      ],
      {
        duration: parseTransitionDurationMs(
          element,
          "--popup-position-transition-duration",
          250,
        ),
        easing: "ease",
      },
    );
    notifyPositionTransition(element, animation);
  }
  // The specified `left`/`top` are set to their final target right away,
  // regardless of `shouldTransition` — the animation above only plays the
  // visual move from the old position, it never becomes the actual
  // specified style (see notifyPositionTransition's own commitStyles for
  // why that matters once it ends).
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  dispatchCustomEvent(element, "navi_position_change");
};

const [publishDebugger, subscribeDebugger] = createPubSub();

const notifyDebuggerStart = () => {
  const results = publishDebugger();
  const notifyDebuggerEnd = () => {
    for (const result of results) {
      if (typeof result === "function") {
        result();
      }
    }
  };
  return notifyDebuggerEnd;
};

const EASING = {
  LINEAR: (x) => x,
  EASE: (x) => {
    return cubicBezier(x, 0.25, 0.1, 0.25, 1.0);
  },
  EASE_IN: (x) => {
    return cubicBezier(x, 0.42, 0, 1.0, 1.0);
  },
  EASE_OUT: (x) => {
    return cubicBezier(x, 0, 0, 0.58, 1.0);
  },
  EASE_IN_OUT: (x) => {
    return cubicBezier(x, 0.42, 0, 0.58, 1.0);
  },
  EASE_IN_OUT_CUBIC: (x) => {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
  EASE_IN_EXPO: (x) => {
    return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
  },
  EASE_OUT_EXPO: (x) => {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  },
  EASE_OUT_ELASTIC: (x) => {
    const c4 = (2 * Math.PI) / 3;
    if (x === 0) {
      return 0;
    }
    if (x === 1) {
      return 1;
    }
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  },
  EASE_OUT_CUBIC: (x) => {
    return 1 - Math.pow(1 - x, 3);
  },
};

const cubicBezier = (t, initial, p1, p2, final) => {
  return (
    (1 - t) * (1 - t) * (1 - t) * initial +
    3 * (1 - t) * (1 - t) * t * p1 +
    3 * (1 - t) * t * t * p2 +
    t * t * t * final
  );
};

const getTimelineCurrentTime = () => {
  return document.timeline.currentTime;
};

const visualCallbackSet = new Set();
const backgroundCallbackSet = new Set();
const addOnTimeline = (callback, isVisual) => {
  if (isVisual) {
    visualCallbackSet.add(callback);
  } else {
    backgroundCallbackSet.add(callback);
  }
};
const removeFromTimeline = (callback, isVisual) => {
  if (isVisual) {
    visualCallbackSet.delete(callback);
  } else {
    backgroundCallbackSet.delete(callback);
  }
};

// We need setTimeout to animate things like volume because requestAnimationFrame would be killed when tab is not visible
// while we might want to fadeout volumn when leaving the page for instance
const createBackgroundUpdateLoop = () => {
  let timeout;
  const update = () => {
    for (const backgroundCallback of backgroundCallbackSet) {
      backgroundCallback();
    }
    timeout = setTimeout(update, 16); // roughly 60fps
  };
  return {
    start: () => {
      timeout = setTimeout(update, 16);
    },
    stop: () => {
      clearTimeout(timeout);
    },
  };
};
// For visual things we use animation frame which is more performant and made for this
const createAnimationFrameLoop = () => {
  let animationFrame = null;
  const update = () => {
    for (const visualCallback of visualCallbackSet) {
      visualCallback();
    }
    animationFrame = requestAnimationFrame(update);
  };
  return {
    start: () => {
      animationFrame = requestAnimationFrame(update);
    },
    stop: () => {
      cancelAnimationFrame(animationFrame);
    },
  };
};
const backgroundUpdateLoop = createBackgroundUpdateLoop();
const animationUpdateLoop = createAnimationFrameLoop();

let timelineIsRunning = false;
const startTimeline = () => {
  if (timelineIsRunning) {
    return;
  }
  timelineIsRunning = true;
  backgroundUpdateLoop.start();
  animationUpdateLoop.start();
};
if (typeof document === "object") {
  startTimeline();
}

// Default lifecycle methods that do nothing
const LIFECYCLE_DEFAULT = {
  setup: () => {},
  pause: () => {},
  cancel: () => {},
  finish: () => {},
  updateTarget: () => {},
};

const transitionPausedByBreakpointWeakSet = createIterableWeakSet();
const onTransitionPausedByBreakpoint = (transition) => {
  transitionPausedByBreakpointWeakSet.add(transition);
  transition.channels.finish.add(cleanupTransitionPausedByBreakpoint);
  transition.channels.cancel.add(cleanupTransitionPausedByBreakpoint);
};
const cleanupTransitionPausedByBreakpoint = (transition) => {
  transitionPausedByBreakpointWeakSet.delete(transition);
};
if (typeof window !== "undefined") {
  window.resumeTransitions = () => {
    for (const transition of transitionPausedByBreakpointWeakSet) {
      transition.play();
    }
  };
}

const combineTwoLifecycle = (lifecycleA, lifecycleB) => {
  if (!lifecycleA && !lifecycleB) {
    return LIFECYCLE_DEFAULT;
  }
  if (!lifecycleB) {
    return lifecycleA;
  }
  if (!lifecycleA) {
    return lifecycleB;
  }

  return {
    setup: (transition) => {
      const resultA = lifecycleA.setup?.(transition) || {};
      const resultB = lifecycleB.setup?.(transition) || {};
      return {
        from: resultA.from ?? resultB.from,
        update: (transition) => {
          resultA.update?.(transition);
          resultB.update?.(transition);
        },
        restore: () => {
          resultA.restore?.();
          resultB.restore?.();
        },
        teardown: () => {
          resultA.teardown?.();
          resultB.teardown?.();
        },
      };
    },
    pause: (transition) => {
      const resumeA = lifecycleA.pause?.(transition);
      const resumeB = lifecycleB.pause?.(transition);
      return () => {
        resumeA?.();
        resumeB?.();
      };
    },
    cancel: (transition) => {
      lifecycleA.cancel?.(transition);
      lifecycleB.cancel?.(transition);
    },
    finish: (transition) => {
      lifecycleA.finish?.(transition);
      lifecycleB.finish?.(transition);
    },
    updateTarget: (transition) => {
      lifecycleA.updateTarget?.(transition);
      lifecycleB.updateTarget?.(transition);
    },
  };
};

/**
 * Lifecycle object for managing transition behavior and DOM updates.
 *
 * The lifecycle pattern provides hooks for different transition phases:
 *
 * @typedef {Object} TransitionLifecycle
 * @property {Function} [setup] - Called when transition starts. Should return an object with:
 *   @property {number}   [from] - Override the transition's from value if transition.from is undefined
 *   @property {Function} [update] - Called on each frame with (transition) - handles DOM updates
 *   @property {Function} [restore] - Called when transition is cancelled - should reset DOM to original state
 *   @property {Function} [teardown] - Called when transition finishes or is cancelled - cleanup resources
 * @property {Function} [pause] - Called when transition is paused. Should return a resume function
 * @property {Function} [cancel] - Called when transition is cancelled
 * @property {Function} [finish] - Called when transition finishes naturally
 * @property {Function} [reverse] - Called when transition direction is reversed
 * @property {Function} [updateTarget] - Called when transition target is updated mid-flight
 *
 * @example
 * // Basic DOM animation lifecycle
 * const lifecycle = {
 *   setup: (transition) => {
 *     const element = document.getElementById('myElement');
 *     const originalWidth = element.style.width;
 *
 *     return {
 *       from: element.offsetWidth, // Override from value with current DOM state
 *       update: (transition) => {
 *         // Apply transition value to DOM on each frame
 *         element.style.width = `${transition.value}px`;
 *       },
 *       restore: () => {
 *         // Reset DOM when cancelled
 *         element.style.width = originalWidth;
 *       },
 *       teardown: () => {
 *         // Cleanup when done (remove temp styles, event listeners, etc.)
 *         element.style.width = '';
 *       }
 *     };
 *   },
 *   pause: (transition) => {
 *     // Handle pause logic if needed
 *     return () => {
 *       // Resume logic
 *     };
 *   }
 * };
 */
const createTransition = ({
  constructor,
  key,
  from,
  to,
  easing = EASING.EASE_OUT,
  startProgress = 0, // Progress to start from (0-1)
  baseLifecycle,
  onUpdate,
  onFinish,
  onPause,
  minDiff,
  debugQuarterBreakpoints = false, // Shorthand for debugBreakpoints: [0.25, 0.75]
  debugBreakpoints = debugQuarterBreakpoints ? [0.25, 0.75] : [], // Array of progress values (0-1) where debugger should trigger
  pauseBreakpoints = [],
  warnOnSmallDifferences = false,
  ...rest
} = {}) => {
  const [updateCallbacks, executeUpdateCallbacks] = createCallbackController();
  const [cancelCallbacks, executeCancelCallbacks] = createCallbackController();
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const channels = {
    update: updateCallbacks,
    cancel: cancelCallbacks,
    finish: finishCallbacks,
  };

  const lifecycle = combineTwoLifecycle(baseLifecycle, rest.lifecycle);
  let breakpointMap;

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let isFirstUpdate = false;
  let resume;
  let executionLifecycle = null;

  const start = () => {
    isFirstUpdate = true;
    playState = "running";

    executionLifecycle = lifecycle.setup?.(transition) || {};

    // Allow setup to override from value if transition.from is undefined
    if (
      transition.from === undefined &&
      executionLifecycle.from !== undefined
    ) {
      transition.from = executionLifecycle.from;
    }

    if (warnOnSmallDifferences) {
      const diff = Math.abs(transition.to - transition.from);
      if (diff === 0) {
        console.warn(
          `${constructor.name} transition has identical from and to values (${transition.from}). This transition will have no effect.`,
        );
      } else if (typeof minDiff === "number" && diff < minDiff) {
        console.warn(
          `${constructor.name} transition difference is very small (${diff}). Consider if this transition is necessary (minimum threshold: ${minDiff}).`,
        );
      }
    }
    transition.update(transition.startProgress);
  };

  const transition = {
    constructor,
    key,
    from,
    to,
    progress: startProgress,
    startProgress,
    easedProgress: easing ? easing(startProgress) : startProgress,
    easing,
    value: from,
    timing: "",
    channels,
    get playState() {
      return playState;
    },

    play: () => {
      if (playState === "idle") {
        transition.value = transition.from;
        transition.timing = "";
        transition.progress = transition.startProgress;
        breakpointMap = new Map();
        for (const debugBreakpoint of debugBreakpoints) {
          breakpointMap.set(debugBreakpoint, "debug");
        }
        for (const pauseBreakpoint of pauseBreakpoints) {
          breakpointMap.set(pauseBreakpoint, "pause");
        }
        start();
        return;
      }
      if (playState === "running") {
        console.warn("transition already running");
        return;
      }
      if (playState === "paused") {
        playState = "running";
        resume();
        return;
      }
      // "finished"
      start();
    },

    update: (inputProgress) => {
      if (playState === "idle") {
        console.warn("Cannot update transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update a finished transition");
        return;
      }
      let progress;
      if (startProgress) {
        // Apply start progress offset - transition runs from startProgress to 1
        // Progress represents a ratio (0-1), so we can't just add ratios together
        // Instead, we need to map inputProgress to the remaining progress range (1 - startProgress)
        // This could also exceed 1 if we used simple addition, but that's just a symptom of the conceptual error
        // Example: startProgress=0.3, inputProgress=0.5 → 0.3 + 0.5*(1-0.3) = 0.65
        progress = startProgress + inputProgress * (1 - startProgress);
      } else {
        progress = inputProgress;
      }
      transition.progress = progress;

      const easedProgress = easing ? easing(progress) : progress;
      transition.easedProgress = easedProgress;

      const value = interpolate(transition, transition.from, transition.to);
      transition.value = value;

      transition.timing =
        progress === 1 ? "end" : isFirstUpdate ? "start" : "progress";
      isFirstUpdate = false;
      executionLifecycle.update?.(transition);
      executeUpdateCallbacks(transition);
      onUpdate?.(transition);

      for (const [breakpoint, effect] of breakpointMap) {
        if (progress >= breakpoint) {
          breakpointMap.delete(breakpoint);
          if (effect === "debug") {
            console.log(
              `Debug breakpoint hit at ${(breakpoint * 100).toFixed(1)}% progress`,
            );
            const notifyDebuggerEnd = notifyDebuggerStart();
            notifyDebuggerEnd();
          }
          if (effect === "pause") {
            transition.pause();
            onTransitionPausedByBreakpoint(transition);
          }
        }
      }
    },

    pause: () => {
      if (playState === "paused") {
        console.warn("transition already paused");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot pause a finished transition");
        return;
      }
      playState = "paused";

      // Let the transition handle its own pause logic
      resume = lifecycle.pause?.(transition);
      onPause?.(transition);
    },

    cancel: () => {
      if (executionLifecycle) {
        lifecycle.cancel?.(transition);
        executionLifecycle.teardown?.();
        executionLifecycle.restore?.();
      }
      resume = null;
      playState = "idle";
      executeCancelCallbacks(transition);
    },

    finish: () => {
      if (playState === "idle") {
        console.warn("Cannot finish a transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("transition already finished");
        return;
      }
      // "running" or "paused"
      lifecycle.finish?.(transition);
      executionLifecycle.teardown?.();
      resume = null;
      playState = "finished";
      executeFinishCallbacks(transition);
      onFinish?.(transition);
    },

    reverse: () => {
      if (playState === "idle") {
        console.warn("Cannot reverse a transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot reverse a finished transition");
        return;
      }

      // Simply swap from and to values to reverse direction
      const originalFrom = transition.from;
      const originalTo = transition.to;

      transition.from = originalTo;
      transition.to = originalFrom;

      // Let the transition handle its own reverse logic (if any)
      lifecycle.reverse?.(transition);
    },

    updateTarget: (newTarget) => {
      if (
        typeof newTarget !== "number" ||
        isNaN(newTarget) ||
        !isFinite(newTarget)
      ) {
        throw new Error(
          `updateTarget: newTarget must be a finite number, got ${newTarget}`,
        );
      }
      if (playState === "idle") {
        console.warn("Cannot update target of idle transition");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update target of finished transition");
        return;
      }
      const currentValue = transition.value;
      transition.from = currentValue;
      transition.to = newTarget;

      // Let the transition handle its own target update logic
      lifecycle.updateTarget?.(transition);
    },

    ...rest,
  };

  return transition;
};

const interpolate = (transition, from, to) => {
  const { easedProgress } = transition;
  return applyRatioToDiff(from, to, easedProgress);
};
const applyRatioToDiff = (from, to, ratio) => {
  if (ratio === 0) {
    return from;
  }
  if (ratio === 1) {
    return to;
  }
  return from + (to - from) * ratio;
};

/**
 * Creates a timeline-managed transition that automatically handles animation timing
 * and integrates with the global animation timeline.
 *
 * @param {Object} options - Configuration options for the transition
 * @param {boolean} [options.isVisual] - Whether this is a visual transition (affects timeline priority)
 * @param {number} options.duration - Duration of the transition in milliseconds
 * @param {number} [options.fps=60] - Target frames per second for the animation
 * @param {Function} [options.easing=EASING.EASE_OUT] - Easing function to apply to progress
 * @param {Object} [options.lifecycle] - Lifecycle methods for the transition
 * @param {number} [options.startProgress=0] - Progress value to start from (0-1)
 * @param {number[]} [options.debugBreakpoints=[]] - Array of progress values (0-1) where debugger should trigger
 * @param {boolean} [options.debugQuarterBreakpoints=false] - If true and debugBreakpoints is empty, sets breakpoints at 0.25 and 0.75
 * @param {*} [...options] - Additional options passed to createTransition
 * @returns {Object} Timeline transition object with play(), pause(), cancel(), finish() methods
 */
// Timeline-managed transition that adds/removes itself from the animation timeline
const createTimelineTransition = ({
  isVisual,
  duration,
  fps = 60,
  easing = EASING.EASE_OUT,
  ...options
}) => {
  if (typeof duration !== "number" || duration <= 0) {
    throw new Error(
      `Invalid duration: ${duration}. Duration must be a positive number.`,
    );
  }

  let lastUpdateTime = -1;
  const timeChangeCallback = () => {
    const timelineCurrentTime = getTimelineCurrentTime();

    {
      const SUSPICIOUS_FRAME_DURATION_MS = 4000;
      // Detect frozen code (debugger, long pause) early
      // (not needed that much since introduce of debugBreakpoints option)
      const timeSinceLastUpdate =
        lastUpdateTime === -1
          ? timelineCurrentTime - transition.baseTime
          : timelineCurrentTime - lastUpdateTime;
      if (timeSinceLastUpdate > SUSPICIOUS_FRAME_DURATION_MS) {
        // Code was frozen for more than SUSPICIOUS_FRAME_DURATION (e.g. debugger)
        // Adjust baseTime to compensate for the freeze and update timing for next frame
        const freezeDuration = timeSinceLastUpdate - transition.frameDuration;
        transition.baseTime += freezeDuration;
        lastUpdateTime = timelineCurrentTime;
        return;
      }
    }

    const msElapsedSinceStart = timelineCurrentTime - transition.baseTime;
    const msRemaining = transition.duration - msElapsedSinceStart;

    if (
      // we reach the end, round progress to 1
      msRemaining < 0 ||
      // we are very close from the end, round progress to 1
      msRemaining <= transition.frameDuration
    ) {
      transition.frameRemainingCount = 0;
      transition.update(1);
      transition.finish();
      return;
    }

    if (lastUpdateTime === -1) ; else {
      const timeSinceLastUpdate = timelineCurrentTime - lastUpdateTime;

      // Allow rendering if we're within 3ms of the target frame duration
      // This prevents choppy animations when browser timing is slightly off
      const frameTimeTolerance = 3; // ms
      const targetFrameTime = transition.frameDuration - frameTimeTolerance;

      // Skip update only if we're significantly early
      if (timeSinceLastUpdate < targetFrameTime) {
        return;
      }
    }
    lastUpdateTime = timelineCurrentTime;
    transition.frameRemainingCount = Math.ceil(
      msRemaining / transition.frameDuration,
    );
    const progress = msElapsedSinceStart / transition.duration;
    transition.update(progress > 1 ? 1 : progress);
  };
  const onTimelineNeeded = () => {
    addOnTimeline(timeChangeCallback, isVisual);
  };
  const onTimelineNotNeeded = () => {
    removeFromTimeline(timeChangeCallback, isVisual);
  };

  const transition = createTransition({
    ...options,
    startTime: null,
    baseTime: null,
    duration,
    easing,
    fps,
    get frameDuration() {
      return 1000 / fps;
    },
    frameRemainingCount: 0,
    baseLifecycle: {
      setup: (transition) => {
        // Handle timeline management
        lastUpdateTime = -1;
        transition.baseTime = transition.startTime = getTimelineCurrentTime();
        // Calculate remaining frames based on remaining progress
        const remainingProgress = 1 - transition.progress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
        onTimelineNeeded();
        const unsubscribeDebugger = subscribeDebugger(() => {
          transition.pause();
          return () => {
            // if we play() right after debugger
            // document.timeline.currentTime is still the same
            // and we can't adjust to the time ellapsed in the debugger session
            // we need to wait for the next js loop to have an updated
            // document.timeline.currentTime that takes into account the time spent in the debugger
            requestAnimationFrame(transition.play);
          };
        });
        return {
          teardown: () => {
            unsubscribeDebugger();
          },
        };
      },
      pause: (transition) => {
        const pauseTime = getTimelineCurrentTime();
        onTimelineNotNeeded();
        return () => {
          const pausedDuration = getTimelineCurrentTime() - pauseTime;
          transition.baseTime += pausedDuration;
          // Only adjust lastUpdateTime if it was set (not -1)
          if (lastUpdateTime !== -1) {
            lastUpdateTime += pausedDuration;
          }
          onTimelineNeeded();
        };
      },
      updateTarget: (transition) => {
        transition.baseTime = getTimelineCurrentTime();
        // Don't reset lastUpdateTime - we want visual continuity for smooth target updates
        // Recalculate remaining frames from current progress
        const remainingProgress = 1 - transition.progress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
      },
      cancel: () => {
        onTimelineNotNeeded();
      },
      finish: () => {
        onTimelineNotNeeded();
      },
    },
  });
  return transition;
};

const createCallbackController = () => {
  const callbackSet = new Set();
  const execute = (...args) => {
    for (const callback of callbackSet) {
      callback(...args);
    }
  };
  const callbacks = {
    add: (callback) => {
      if (typeof callback !== "function") {
        throw new TypeError("Callback must be a function");
      }
      callbackSet.add(callback);
      return () => {
        callbackSet.delete(callback);
      };
    },
  };
  return [callbacks, execute];
};

/**
 * Creates an interface that manages ongoing transitions
 * and handles target updates automatically
 */
const createGroupTransitionController = (groupTransitionOptions) => {
  // Track all active transitions for cancellation and matching
  const activeTransitions = new Set();

  return {
    /**
     * Control multiple transitions simultaneously
     * Automatically handles updateTarget for transitions that match constructor + targetKey
     * @param {Array} transitions - Array of transition objects with constructor and targetKey properties
     * @param {Object} options - Transition options
     * @param {Function} options.onChange - Called with (changeEntries, isLast) during transition
     * @param {Function} options.onFinish - Called when all transitions complete
     * @param {Function} options.onCancel - Called when transitions are cancelled
     * @returns {Object} Playback controller with play(), pause(), cancel(), etc.
     */
    update: (transitions, options = {}) => {
      const { onChange, onCancel, onFinish } = options;

      if (transitions.length === 0) {
        // No transitions to animate, call onFinish immediately
        if (onFinish) {
          onFinish([]);
        }
        return {
          play: () => {},
          pause: () => {},
          cancel: () => {},
          finish: () => {},
          playState: "idle",
          channels: {
            update: { add: () => {} },
            cancel: { add: () => {} },
            finish: { add: () => {} },
          },
        };
      }

      const newTransitions = [];
      const updatedTransitions = [];

      // Separate transitions into new vs updates to existing ones
      for (const transition of transitions) {
        // Look for existing transition with same constructor and targetKey
        let existingTransition = null;
        for (const transitionCandidate of activeTransitions) {
          if (
            transitionCandidate.constructor === transition.constructor &&
            transitionCandidate.key === transition.key
          ) {
            existingTransition = transitionCandidate;
            break;
          }
        }

        if (existingTransition && existingTransition.playState === "running") {
          // Update the existing transition's target if it supports updateTarget
          if (existingTransition.updateTarget) {
            existingTransition.updateTarget(transition.to);
          }
          updatedTransitions.push(existingTransition);
        } else {
          // Track this new transition
          activeTransitions.add(transition);
          // Clean up tracking when transition finishes
          transition.channels.finish.add(() => {
            activeTransitions.delete(transition);
          });

          newTransitions.push(transition);
        }
      }

      // If we only have updated transitions (no new ones), return a minimal controller
      if (newTransitions.length === 0) {
        return {
          play: () => {}, // Already playing
          pause: () =>
            updatedTransitions.forEach((transition) => transition.pause()),
          cancel: () =>
            updatedTransitions.forEach((transition) => transition.cancel()),
          finish: () =>
            updatedTransitions.forEach((transition) => transition.finish()),
          reverse: () =>
            updatedTransitions.forEach((transition) => transition.reverse()),
          playState: "running", // All are already running
          channels: {
            update: { add: () => {} }, // Update tracking already set up
            cancel: { add: () => {} },
            finish: { add: () => {} },
          },
        };
      }

      // Create group transition to coordinate new transitions only
      const groupTransition = createGroupTransition(
        newTransitions,
        groupTransitionOptions,
      );

      // Add unified update tracking for ALL transitions (new + updated)
      if (onChange) {
        groupTransition.channels.update.add((transition) => {
          // Build change entries for current state of ALL transitions
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );

          const isLast = transition.value >= 1; // isLast = value >= 1 (since group tracks 0-1)
          onChange(changeEntries, isLast);
        });
      }

      if (onCancel) {
        groupTransition.channels.cancel.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );
          onCancel(changeEntries);
        });
      }

      // Add finish tracking
      if (onFinish) {
        groupTransition.channels.finish.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );
          onFinish(changeEntries);
        });
      }

      return groupTransition;
    },

    /**
     * Cancel all ongoing transitions managed by this controller
     */
    cancel: () => {
      // Cancel all active transitions
      for (const transition of activeTransitions) {
        if (
          transition.playState === "running" ||
          transition.playState === "paused"
        ) {
          transition.cancel();
        }
      }
      // Clear the sets - the finish callbacks will handle individual cleanup
      activeTransitions.clear();
    },
  };
};

// transition that manages multiple transitions
const createGroupTransition = (transitionArray, options = {}) => {
  let childCount = transitionArray.length;
  // duration is infered from the longest child transition
  let duration = 0;
  for (const childTransition of transitionArray) {
    if (childTransition.duration > duration) {
      duration = childTransition.duration;
    }
  }

  const groupTransition = createTransition({
    ...options,
    constructor: createGroupTransition,
    from: 0,
    to: 1,
    duration,
    baseLifecycle: {
      setup: (transition) => {
        let finishedCount = 0;

        const [cleanup, addCleanup] = createPubSub();

        for (const childTransition of transitionArray) {
          const removeFinishListener = childTransition.channels.finish.add(
            // eslint-disable-next-line no-loop-func
            () => {
              finishedCount++;
              const allFinished = finishedCount === childCount;
              if (allFinished) {
                transition.finish();
              }
            },
          );
          addCleanup(removeFinishListener);
          childTransition.play();

          const removeUpdateListener = childTransition.channels.update.add(
            () => {
              // Calculate average progress (handle undefined progress)
              let totalProgress = 0;
              let progressCount = 0;
              for (const t of transitionArray) {
                if (typeof t.progress === "number") {
                  totalProgress += t.progress;
                  progressCount++;
                }
              }
              const averageProgress =
                progressCount > 0 ? totalProgress / progressCount : 0;
              transition.update(averageProgress);
            },
          );
          addCleanup(removeUpdateListener);
        }

        return {
          teardown: cleanup,
        };
      },
      pause: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState === "running") {
            childTransition.pause();
          }
        }
        return () => {
          for (const childTransition of transitionArray) {
            if (childTransition.playState === "paused") {
              childTransition.play();
            }
          }
        };
      },
      cancel: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState !== "idle") {
            childTransition.cancel();
          }
        }
      },
      finish: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState === "idle") {
            // child transition got canceled, keep it canceled
            continue;
          }
          if (childTransition.playState !== "finished") {
            childTransition.finish();
          }
        }
      },
      reverse: () => {
        for (const childTransition of transitionArray) {
          if (
            childTransition.playState === "running" ||
            childTransition.playState === "paused"
          ) {
            childTransition.reverse();
          }
        }
      },
    },
  });
  return groupTransition;
};

// Helper function to prepare color transition pairs, handling edge cases
const prepareRGBATransitionPair = (fromColor, toColor) => {
  const fromUnset = !fromColor;
  const toUnset = !toColor;

  // Both unset - no transition needed
  if (fromUnset && toUnset) {
    return null;
  }
  // Handle unset cases by using transparent versions
  if (fromUnset) {
    const toFullyTransparent = updateRGBA(toColor, { a: 0 });
    return [toFullyTransparent, toColor];
  }
  if (toUnset) {
    const fromFullyTransparent = updateRGBA(fromColor, { a: 0 });
    return [fromColor, fromFullyTransparent];
  }
  // Handle fully transparent cases
  const fromFullyTransparent = fromColor[3] === 0;
  const toFullyTransparent = toColor[3] === 0;
  if (fromFullyTransparent && toFullyTransparent) {
    return [fromColor, toColor];
  }
  if (fromFullyTransparent) {
    const toFullTransparent = updateRGBA(toColor, { a: 0 });
    return [toFullTransparent, toColor];
  }
  if (toFullyTransparent) {
    const fromFullyTransparent = updateRGBA(fromColor, { a: 0 });
    return [fromColor, fromFullyTransparent];
  }
  return [fromColor, toColor];
};
const interpolateRGBA = (transition, fromRGBA, toRGBA) => {
  const [rFrom, gFrom, bFrom, aFrom] = fromRGBA;
  const [rTo, gTo, bTo, aTo] = toRGBA;
  const r = interpolate(transition, rFrom, rTo);
  const g = interpolate(transition, gFrom, gTo);
  const b = interpolate(transition, bFrom, bTo);
  const a = interpolate(transition, aFrom, aTo);
  return [r, g, b, a];
};

const getBackgroundColorAndImageInterpolation = (
  fromBackground,
  toBackground,
) => {
  const fromBackgroundColor = fromBackground.color;
  const toBackgroundColor = toBackground.color;
  const fromBackgroundImage = fromBackground.image;
  const toBackgroundImage = toBackground.image;
  const fromHasImage = Boolean(fromBackgroundImage);
  const toHasImage = Boolean(toBackgroundImage);
  const fromHasGradient = fromHasImage && isGradientObject(fromBackgroundImage);
  const toHasGradient = toHasImage && isGradientObject(toBackgroundImage);
  const getInterpolateBackgroundColor = () => {
    const backgroundColorRgbaPair = prepareRGBATransitionPair(
      fromBackgroundColor,
      toBackgroundColor,
    );
    if (!backgroundColorRgbaPair) {
      return toBackgroundColor;
    }
    const [fromRGBA, toRGBA] = backgroundColorRgbaPair;
    return (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRGBA, toRGBA);
      return rgbaInterpolated;
    };
  };

  // color to color
  if (!fromHasImage && !toHasImage) {
    return {
      color: getInterpolateBackgroundColor(),
    };
  }
  // gradient to color
  if (fromHasGradient && !toHasImage && toBackgroundColor) {
    if (!gradientHasColors(fromBackgroundImage)) {
      return { color: toBackgroundColor };
    }
    return {
      image: (transition) => {
        if (transition.value === 1) {
          return undefined;
        }
        const interpolatedColors = fromBackgroundImage.colors.map(
          (colorStop) => {
            return interpolateColorStopToColor(
              transition,
              colorStop,
              toBackgroundColor,
            );
          },
        );
        return { ...fromBackgroundImage, colors: interpolatedColors };
      },
      color: (transition) => {
        if (transition.value < 1) {
          return undefined;
        }
        return toBackgroundColor;
      },
    };
  }
  // color to gradient
  if (!fromHasImage && fromBackgroundColor && toHasGradient) {
    if (!gradientHasColors(toBackgroundImage)) {
      return { image: toBackgroundImage };
    }
    return {
      image: (transition) => {
        const interpolatedColors = toBackgroundImage.colors.map((colorStop) => {
          return interpolateColorToColorStop(
            transition,
            fromBackgroundColor,
            colorStop,
          );
        });
        return {
          ...toBackgroundImage,
          colors: interpolatedColors,
        };
      },
    };
  }
  // gradient to gradient
  if (fromHasGradient && toHasGradient) {
    if (
      !gradientHasColors(fromBackgroundImage) ||
      !gradientHasColors(toBackgroundImage)
    ) {
      // Unsupported cross-gradient transition - fall back to instant change
      return { image: toBackgroundImage };
    }
    const fromGradientType = fromBackgroundImage.type;
    const toGradientType = toBackgroundImage.type;
    const isSameGradientType = fromGradientType === toGradientType;
    const fromColors = fromBackgroundImage.colors;
    const toColors = toBackgroundImage.colors;
    return {
      image: (transition) => {
        const interpolatedColors = interpolateColorStopsArray(
          transition,
          fromColors,
          toColors,
          isSameGradientType ? "same-type" : "cross-type",
        );
        return {
          ...toBackgroundImage,
          colors: interpolatedColors,
        };
      },
      color: isSameGradientType
        ? getInterpolateBackgroundColor()
        : toBackgroundColor,
    };
  }
  return {
    color: getInterpolateBackgroundColor(),
  };
};

// Helper to interpolate color stops with position values
const interpolateStops = (transition, fromStops, toStops) => {
  if (!Array.isArray(fromStops) || !Array.isArray(toStops)) {
    return transition.value < 0.5 ? fromStops : toStops;
  }

  const maxLength = Math.max(fromStops.length, toStops.length);
  const result = [];
  for (let i = 0; i < maxLength; i++) {
    const fromStop = fromStops[i];
    const toStop = toStops[i];
    result.push(interpolateStop(transition, fromStop, toStop));
  }

  return result;
};

// Helper to interpolate a single stop (position value)
const interpolateStop = (transition, fromStop, toStop) => {
  if (fromStop && toStop) {
    // Stops are now already parsed objects
    if (
      fromStop.isNumeric &&
      toStop.isNumeric &&
      fromStop.unit === toStop.unit
    ) {
      const interpolatedValue = interpolate(
        transition,
        fromStop.value,
        toStop.value,
      );
      return {
        isNumeric: true,
        value: interpolatedValue,
        unit: fromStop.unit,
      };
    }
    // Non-numeric or different units - use threshold
    return transition.value < 0.5 ? fromStop : toStop;
  }
  // Only one exists - use it
  return fromStop || toStop;
};

// Helper to interpolate a single color stop between two color stops
const interpolateColorStop = (transition, fromStop, toStop) => {
  if (!fromStop || !toStop) {
    return toStop || fromStop;
  }

  const interpolatedStop = { ...toStop };

  // Interpolate colors if both exist
  if (fromStop.color && toStop.color) {
    interpolatedStop.color = interpolateRGBA(
      transition,
      fromStop.color,
      toStop.color,
    );
  }

  // Interpolate position stops if both exist
  if (fromStop.stops && toStop.stops) {
    interpolatedStop.stops = interpolateStops(
      transition,
      fromStop.stops,
      toStop.stops,
    );
  }

  return interpolatedStop;
};

// Helper to interpolate color stops arrays with different handling strategies
const interpolateColorStopsArray = (
  transition,
  fromColors,
  toColors,
  strategy = "same-type",
) => {
  const maxStops = Math.max(fromColors.length, toColors.length);
  const interpolatedColors = [];

  for (let i = 0; i < maxStops; i++) {
    const fromStop = fromColors[i];
    const toStop = toColors[i];

    if (fromStop && toStop) {
      if (strategy === "cross-type") {
        // For cross-gradient transitions, prioritize target structure
        const interpolatedStop = { ...toStop };
        if (fromStop.color && toStop.color) {
          interpolatedStop.color = interpolateRGBA(
            transition,
            fromStop.color,
            toStop.color,
          );
        }
        interpolatedColors.push(interpolatedStop);
      } else {
        // For same-type transitions, fully interpolate
        interpolatedColors.push(
          interpolateColorStop(transition, fromStop, toStop),
        );
      }
    } else if (toStop) {
      // Only target stop exists - use it as-is
      interpolatedColors.push(toStop);
    } else ;
    // Skip fromStop-only cases in cross transitions
  }

  return interpolatedColors;
};
const interpolateColorStopToColor = (transition, colorStop, targetColor) => {
  const colorStopColor = colorStop.color;
  if (!colorStopColor) {
    return colorStop;
  }
  const colorInterpolated = interpolateRGBA(
    transition,
    colorStopColor,
    targetColor,
  );
  return {
    ...colorStop,
    color: colorInterpolated,
  };
};

// Helper to interpolate from a source color toward a color stop
const interpolateColorToColorStop = (transition, sourceColor, colorStop) => {
  const colorStopColor = colorStop.color;
  if (!colorStopColor) {
    return colorStop;
  }
  const colorInterpolated = interpolateRGBA(
    transition,
    sourceColor,
    colorStopColor,
  );
  return {
    ...colorStop,
    color: colorInterpolated,
  };
};

// Helper functions for image object detection
const isGradientObject = (imageObj) => {
  return (
    imageObj &&
    typeof imageObj === "object" &&
    imageObj.type &&
    imageObj.type.includes("gradient")
  );
};

const gradientHasColors = (gradientObj) => {
  return (
    gradientObj.colors &&
    Array.isArray(gradientObj.colors) &&
    gradientObj.colors.length > 0
  );
};

const getBorderColorAndWidthInterpolation = (fromBorder, toBorder) => {
  // If one side has no color, use transparent as fallback
  const fromBorderColor = fromBorder?.color || [0, 0, 0, 0];
  const toBorderColor = toBorder?.color || [0, 0, 0, 0];
  const getInterpolateBorderColor = () => {
    // Handle cases where one or both colors are undefined (e.g., border: none)
    if (!fromBorderColor && !toBorderColor) {
      return null;
    }
    const borderColorRgbaPair = prepareRGBATransitionPair(
      fromBorderColor,
      toBorderColor,
    );
    if (!borderColorRgbaPair) {
      return toBorderColor;
    }
    const [fromRGBA, toRGBA] = borderColorRgbaPair;
    return (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRGBA, toRGBA);
      return rgbaInterpolated;
    };
  };

  const fromWidth = fromBorder?.width || 0;
  const toWidth = toBorder?.width || 0;
  const getInterpolateBorderWidth = () => {
    return (transition) => interpolate(transition, fromWidth, toWidth);
  };

  return {
    color: getInterpolateBorderColor(),
    width: getInterpolateBorderWidth(),
  };
};

const createObjectInterpolation = (interpolation, from, to) => {
  if (interpolation === to) {
    if (from === to) {
      return null;
    }
    return to;
  }
  const propertyInterpolatorMap = new Map();
  for (const key of Object.keys(interpolation)) {
    const value = interpolation[key];
    if (value === to[key]) {
      continue;
    }
    const propertyInterpolator = (transition) => {
      const interpolatedValue = value(transition);
      return interpolatedValue;
    };
    propertyInterpolatorMap.set(key, propertyInterpolator);
  }
  if (propertyInterpolatorMap.size === 0) {
    return to;
  }
  const interpolateProperties = (transition) => {
    const toAssignMap = new Map();
    for (const [key, interpolate] of propertyInterpolatorMap) {
      const interpolatedValue = interpolate(transition);
      toAssignMap.set(key, interpolatedValue);
    }
    if (toAssignMap.size === 0) {
      return to;
    }
    const copy = { ...to };
    for (const [key, value] of toAssignMap) {
      if (value === undefined) {
        delete copy[key];
      } else {
        copy[key] = value;
      }
    }
    return copy;
  };
  return interpolateProperties;
};

const transitionStyleController = createStyleController("transition");

/**
 * Helper function to create CSS property transitions with common configuration
 * @param {Object} config - Configuration object
 * @param {Function} config.constructor - Constructor function for the transition
 * @param {HTMLElement} config.element - DOM element to animate
 * @param {number} config.to - Target value
 * @param {Function} config.getFrom - Function to get current property value
 * @param {string|Object} config.styleProperty - CSS property name or style object path
 * @param {number} [config.minDiff] - Minimum difference threshold for the transition
 * @param {Object} [config.options={}] - Additional options
 * @param {string} [config.options.styleSynchronizer="js_animation"] - How to apply transition ("js_animation", "inline_style", or "--css-var-name")
 * @returns {Object} Timeline transition object
 */
const createCSSPropertyTransition = ({
  element,
  getFrom,
  styleProperty,
  styleSynchronizer = "js_animation",
  getValue = (t) => t.value,
  lifecycle,
  ...options
}) => {
  if (typeof styleSynchronizer !== "string") {
    throw new Error("styleSynchronizer must be a string");
  }
  const setupSynchronizer = () => {
    if (styleSynchronizer === "inline_style") {
      return {
        update: (transition) => {
          const value = getValue(transition);
          if (typeof styleProperty === "string") {
            // Special handling for different CSS properties
            if (styleProperty === "opacity") {
              element.style[styleProperty] = value;
            } else {
              element.style[styleProperty] =
                typeof value === "number" ? `${value}px` : value;
            }
          } else {
            // Handle complex properties like transform.translateX
            const keys = styleProperty.split(".");
            if (keys[0] === "transform") {
              element.style.transform = `${keys[1]}(${value}px)`;
            }
          }
        },
        restore: () => {
          if (typeof styleProperty === "string") {
            element.style[styleProperty] = "";
          } else {
            const keys = styleProperty.split(".");
            if (keys[0] === "transform") {
              element.style.transform = "";
            }
          }
        },
      };
    }
    if (styleSynchronizer.startsWith("--")) {
      return {
        update: (transition) => {
          const value = getValue(transition);
          // Special handling for different CSS properties
          if (styleProperty === "opacity") {
            element.style.setProperty(styleSynchronizer, value);
          } else {
            element.style.setProperty(
              styleSynchronizer,
              typeof value === "number" ? `${value}px` : value,
            );
          }
        },
        restore: () => {
          element.style.removeProperty(styleSynchronizer);
        },
      };
    }
    if (styleSynchronizer.startsWith("[")) {
      const attributeName = styleSynchronizer.slice(1, -1);
      return {
        update: (transition) => {
          const value = getValue(transition);
          element.setAttribute(attributeName, value);
        },
        restore: () => {
          element.removeAttribute(attributeName);
        },
      };
    }
    return {
      update: (transition) => {
        const value = getValue(transition);

        if (typeof styleProperty === "string") {
          transitionStyleController.set(element, { [styleProperty]: value });
        } else {
          // Handle nested properties like transform.translateX
          const styleObj = {};
          const keys = styleProperty.split(".");
          if (keys.length === 2) {
            styleObj[keys[0]] = { [keys[1]]: value };
          }
          transitionStyleController.set(element, styleObj);
        }
      },
      restore: () => {
        transitionStyleController.delete(element, styleProperty);
      },
    };
  };

  return createTimelineTransition({
    duration: 300,
    ...options,
    key: element,
    isVisual: true,
    lifecycle: combineTwoLifecycle(
      {
        setup: () => {
          const from = getFrom(element);
          const synchronizer = setupSynchronizer();
          return {
            from,
            update: synchronizer.update,
            restore: synchronizer.restore,
          };
        },
      },
      lifecycle,
    ),
  });
};
const createNoopCSSPropertyTransition = ({ element, ...options }) => {
  return createTimelineTransition({
    duration: 300,
    ...options,
    key: element,
    isVisual: true,
    from: 0,
    to: 1,
  });
};
const createInstantCSSPropertyTransition = ({ element, value, ...options }) => {
  return createCSSPropertyTransition({
    ...options,
    element,
    getFrom: () => 0,
    from: 0,
    to: 1,
    getValue: () => value,
  });
};

const createWidthTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createWidthTransition,
    element,
    styleProperty: "width",
    getFrom: getWidth$1,
    to,
    minDiff: 10,
  });
};
const createHeightTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createHeightTransition,
    element,
    styleProperty: "height",
    getFrom: getHeight$1,
    to,
    minDiff: 10,
  });
};

const createOpacityTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createOpacityTransition,
    element,
    styleProperty: "opacity",
    getFrom: getOpacity,
    to,
    minDiff: 0.1,
  });
};
const createTranslateXTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createTranslateXTransition,
    element,
    styleProperty: "transform.translateX",
    getFrom: getTranslateX,
    to,
    minDiff: 10,
  });
};

const createBorderRadiusTransition = (element, to, options = {}) => {
  const from = Object.hasOwn(options, "from")
    ? parseStyle(options.from, "borderRadius")
    : undefined;
  to = parseStyle(to, "borderRadius");
  return createCSSPropertyTransition({
    ...options,
    constructor: createBorderRadiusTransition,
    element,
    styleProperty: "borderRadius",
    getFrom: getBorderRadius,
    from,
    to,
  });
};
const createBorderTransition = (element, to, options = {}) => {
  const fromBorder = Object.hasOwn(options, "from")
    ? parseStyle(options.from, "border", element)
    : getBorder(element);
  const toBorder = parseStyle(to, "border", element);
  let borderInterpolation;
  interpolation: {
    // Handle simple cases where no transition is possible
    if (!fromBorder && !toBorder) {
      borderInterpolation = toBorder;
      break interpolation;
    }
    const colorAndWidthInterpolation = getBorderColorAndWidthInterpolation(
      fromBorder,
      toBorder,
    );
    borderInterpolation = colorAndWidthInterpolation;
  }

  const interpolateBorder = createObjectInterpolation(
    borderInterpolation,
    fromBorder,
    toBorder,
  );
  if (!interpolateBorder) {
    return createNoopCSSPropertyTransition({
      element,
      ...options,
    });
  }
  return createCSSPropertyTransition({
    constructor: createBackgroundTransition,
    element,
    styleProperty: "border",
    from: 0,
    to: 1,
    getFrom: () => 0,
    getValue: (transition) => {
      const borderInterpolated = interpolateBorder(transition);
      const borderCSSValue = stringifyStyle(borderInterpolated, "border");
      return borderCSSValue;
    },
    ...options,
  });
};

const createBackgroundTransition = (element, to, options = {}) => {
  const fromBackground = options.from || getBackground(element);
  const toBackground = parseStyle(to, "background", element);
  let backgrounInterpolation;
  interpolation: {
    // Handle simple cases where no transition is possible
    if (!fromBackground && !toBackground) {
      backgrounInterpolation = toBackground;
      break interpolation;
    }
    if (
      typeof fromBackground !== "object" ||
      typeof toBackground !== "object" ||
      Array.isArray(fromBackground) ||
      Array.isArray(toBackground)
    ) {
      backgrounInterpolation = toBackground;
      break interpolation;
    }
    const colorAndImageInterpolation = getBackgroundColorAndImageInterpolation(
      fromBackground,
      toBackground,
    );
    backgrounInterpolation = colorAndImageInterpolation;
  }

  const interpolateBackground = createObjectInterpolation(
    backgrounInterpolation,
    fromBackground,
    toBackground,
  );
  if (!interpolateBackground) {
    return createNoopCSSPropertyTransition({
      element,
      ...options,
    });
  }
  if (interpolateBackground === toBackground) {
    const toStyleCss = stringifyStyle(to, "background");
    console.warn(
      `Unsupported background transition between "${stringifyStyle(fromBackground, "background")}" and "${toStyleCss}"`,
    );
    return createInstantCSSPropertyTransition({
      element,
      value: toStyleCss,
      ...options,
    });
  }
  return createCSSPropertyTransition({
    constructor: createBackgroundTransition,
    element,
    styleProperty: "background",
    from: 0,
    to: 1,
    getFrom: () => 0,
    getValue: (transition) => {
      const backgroundInterpolated = interpolateBackground(transition);
      return stringifyStyle(backgroundInterpolated, "background");
    },
    ...options,
  });
};
const createBackgroundColorTransition = (element, to, options = {}) => {
  const fromBackgroundColor = options.from || getBackgroundColor(element);
  const toBackgroundColor = parseStyle(to, "backgroundColor", element);
  const rgbaPair = prepareRGBATransitionPair(
    fromBackgroundColor,
    toBackgroundColor);
  if (!rgbaPair) {
    return createNoopCSSPropertyTransition({ element, ...options });
  }
  const [fromRgba, toRgba] = rgbaPair;
  if (areSameRGBA(fromRgba, toRgba)) {
    return createNoopCSSPropertyTransition({ element, ...options });
  }
  return createCSSPropertyTransition({
    ...options,
    constructor: createBackgroundColorTransition,
    element,
    styleProperty: "backgroundColor",
    getFrom: () => 0,
    from: 0,
    to: 1,
    getValue: (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRgba, toRgba);
      const backgroundColorInterpolated = stringifyStyle(
        rgbaInterpolated,
        "backgroundColor",
      );
      return backgroundColorInterpolated;
    },
  });
};

// Helper functions for getting natural values
const getOpacityWithoutTransition = (element) =>
  getOpacity(element, transitionStyleController);
const getTranslateXWithoutTransition = (element) =>
  getTranslateX(element, transitionStyleController);
const getWidthWithoutTransition = (element) =>
  getWidth$1(element, transitionStyleController);
const getHeightWithoutTransition = (element) =>
  getHeight$1(element, transitionStyleController);

const getInnerHeight = (element) => {
  // Always subtract paddings and borders to get the content height
  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const height = getHeight(element);
  const verticalSpaceTakenByPaddings = paddingSizes.top + paddingSizes.bottom;
  const verticalSpaceTakenByBorders = borderSizes.top + borderSizes.bottom;
  const innerHeight =
    height - verticalSpaceTakenByPaddings - verticalSpaceTakenByBorders;
  return innerHeight;
};

const getMarginSizes = (element) => {
  const { marginLeft, marginRight, marginTop, marginBottom } =
    window.getComputedStyle(element, null);
  return {
    left: parseFloat(marginLeft),
    right: parseFloat(marginRight),
    top: parseFloat(marginTop),
    bottom: parseFloat(marginBottom),
  };
};

const getAvailableHeight = (
  element,
  parentHeight = getHeight(element.parentElement),
) => {
  const parentElement = element.parentElement;
  const paddingSizes = getPaddingSizes(parentElement);
  const borderSizes = getBorderSizes(parentElement);
  let availableHeight = parentHeight;
  availableHeight -=
    paddingSizes.top +
    paddingSizes.bottom +
    borderSizes.top +
    borderSizes.bottom;
  if (availableHeight < 0) {
    availableHeight = 0;
  }
  return availableHeight;
};

const resolveCSSSize = (
  size,
  { availableSize, fontSize, autoIsRelativeToFont } = {},
) => {
  if (typeof size === "string") {
    if (size === "auto") {
      return autoIsRelativeToFont ? fontSize : availableSize;
    }
    if (size.endsWith("%")) {
      return availableSize * (parseFloat(size) / 100);
    }
    if (size.endsWith("px")) {
      return parseFloat(size);
    }
    if (size.endsWith("em")) {
      return parseFloat(size) * fontSize;
    }
    if (size.endsWith("rem")) {
      return (
        parseFloat(size) * getComputedStyle(document.documentElement).fontSize
      );
    }
    if (size.endsWith("vw")) {
      return (parseFloat(size) / 100) * window.innerWidth;
    }
    if (size.endsWith("vh")) {
      return (parseFloat(size) / 100) * window.innerHeight;
    }
    return parseFloat(size);
  }
  return size;
};

const getMinHeight = (element, availableHeight) => {
  const computedStyle = window.getComputedStyle(element);
  const { minHeight, fontSize } = computedStyle;
  return resolveCSSSize(minHeight, {
    availableSize:
      availableHeight === undefined
        ? getAvailableHeight(element)
        : availableHeight,
    fontSize,
  });
};

/**
 *
 *
 */


const HEIGHT_TRANSITION_DURATION = 300;
const ANIMATE_TOGGLE = true;
const ANIMATE_RESIZE_AFTER_MUTATION = true;
const ANIMATION_THRESHOLD_PX = 10; // Don't animate changes smaller than this
const DEBUG = false;

const initFlexDetailsSet = (
  container,
  {
    onSizeChange,
    onResizableDetailsChange,
    onMouseResizeEnd,
    onRequestedSizeChange,
    debug = DEBUG,
  } = {},
) => {
  const flexDetailsSet = {
    cleanup: null,
  };

  // Create animation controller for managing height animations
  const transitionController = createGroupTransitionController();

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    // Cancel any ongoing animations
    transitionController.cancel();

    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  flexDetailsSet.cleanup = cleanup;

  const spaceMap = new Map();
  const marginSizeMap = new Map();
  const requestedSpaceMap = new Map();
  const minSpaceMap = new Map();
  let allocatedSpaceMap = new Map();
  const canGrowSet = new Set();
  const canShrinkSet = new Set();
  let availableSpace;
  let remainingSpace;
  let lastChild;
  const openedDetailsArray = [];
  const spaceToSize = (space, element) => {
    const marginSize = marginSizeMap.get(element);
    return space - marginSize;
  };
  const sizeToSpace = (size, element) => {
    const marginSize = marginSizeMap.get(element);
    return size + marginSize;
  };
  const prepareSpaceDistribution = () => {
    spaceMap.clear();
    marginSizeMap.clear();
    requestedSpaceMap.clear();
    minSpaceMap.clear();
    allocatedSpaceMap.clear();
    canGrowSet.clear();
    canShrinkSet.clear();
    availableSpace = getInnerHeight(container);
    remainingSpace = availableSpace;
    openedDetailsArray.length = 0;
    lastChild = null;
    if (debug) {
      console.debug(`📐 Container space: ${availableSpace}px`);
    }

    for (const child of container.children) {
      lastChild = child;
      const marginSizes = getMarginSizes(child);
      const marginSize = marginSizes.top + marginSizes.bottom;
      marginSizeMap.set(child, marginSize);

      if (!isDetailsElement(child)) {
        const size = getHeight(child);
        spaceMap.set(child, size + marginSize);
        requestedSpaceMap.set(child, size + marginSize);
        minSpaceMap.set(child, size + marginSize);
        continue;
      }
      const details = child;
      let size;
      let requestedSize;
      let requestedSizeSource;
      let minSize;
      const summary = details.querySelector("summary");
      const summaryHeight = getHeight(summary);

      size = getHeight(details);

      if (details.open) {
        openedDetailsArray.push(details);
        canGrowSet.add(details);
        canShrinkSet.add(details);
        const detailsContent = summary.nextElementSibling;
        let detailsHeight;
        if (detailsContent) {
          const preserveScroll = captureScrollState(detailsContent);
          const restoreSizeStyle = forceStyles(detailsContent, {
            height: "auto",
          });
          const detailsContentHeight = getHeight(detailsContent);
          restoreSizeStyle();
          // Preserve scroll position after height manipulation
          preserveScroll();
          detailsHeight = summaryHeight + detailsContentHeight;
        } else {
          // empty details content like
          // <details><summary>...</summary></details>
          // or textual content like
          // <details><summary>...</summary>textual content</details>
          detailsHeight = size;
        }

        if (details.hasAttribute("data-requested-height")) {
          const requestedHeightAttribute = details.getAttribute(
            "data-requested-height",
          );
          requestedSize = resolveCSSSize(requestedHeightAttribute);
          if (isNaN(requestedSize) || !isFinite(requestedSize)) {
            console.warn(
              `details ${details.id} has invalid data-requested-height attribute: ${requestedHeightAttribute}`,
            );
          }
          requestedSizeSource = "data-requested-height attribute";
        } else {
          requestedSize = detailsHeight;
          requestedSizeSource = "summary and content height";
        }

        const dataMinHeight = details.getAttribute("data-min-height");
        if (dataMinHeight) {
          minSize = parseFloat(dataMinHeight, 10);
        } else {
          minSize = getMinHeight(details, availableSpace);
        }
      } else {
        requestedSize = summaryHeight;
        requestedSizeSource = "summary height";
        minSize = summaryHeight;
      }
      spaceMap.set(details, size + marginSize);
      requestedSpaceMap.set(details, requestedSize + marginSize);
      minSpaceMap.set(details, minSize + marginSize);
      if (debug) {
        const currentSizeFormatted = spaceToSize(size + marginSize, details);
        const requestedSizeFormatted = spaceToSize(
          requestedSize + marginSize,
          details,
        );
        const minSizeFormatted = spaceToSize(minSize + marginSize, details);
        console.debug(
          `  ${details.id}: ${currentSizeFormatted}px → wants ${requestedSizeFormatted}px (min: ${minSizeFormatted}px) [${requestedSizeSource}]`,
        );
      }
    }
  };

  const applyAllocatedSpaces = ({ reason, animated }) => {
    const changeSet = new Set();
    let maxChange = 0;

    for (const child of container.children) {
      const allocatedSpace = allocatedSpaceMap.get(child);
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const space = spaceMap.get(child);
      const size = spaceToSize(space === undefined ? 0 : space, child);
      const sizeChange = Math.abs(size - allocatedSize);
      if (size === allocatedSize) {
        continue;
      }

      // Track the maximum change to decide if animation is worth it
      maxChange = Math.max(maxChange, sizeChange);

      if (isDetailsElement(child) && child.open) {
        const syncDetailsContentHeight = prepareSyncDetailsContentHeight(child);
        changeSet.add({
          element: child,
          target: allocatedSize,
          sideEffect: (height, { isAnimationEnd } = {}) => {
            syncDetailsContentHeight(height, {
              isAnimation: true,
              isAnimationEnd,
            });
          },
        });
      } else {
        changeSet.add({
          element: child,
          target: allocatedSize,
        });
      }
    }

    if (changeSet.size === 0) {
      return;
    }

    // Don't animate if changes are too small (avoids imperceptible animations that hide scrollbars)
    const shouldAnimate = animated && maxChange >= ANIMATION_THRESHOLD_PX;

    if (debug && animated && !shouldAnimate) {
      console.debug(
        `🚫 Skipping animation: max change ${maxChange.toFixed(2)}px < ${ANIMATION_THRESHOLD_PX}px threshold`,
      );
    }

    if (!shouldAnimate) {
      if (debug) {
        console.debug(`Applying size changes without animation`);
      }
      const sizeChangeEntries = [];
      for (const { element, target, sideEffect } of changeSet) {
        element.style.height = `${target}px`;
        spaceMap.set(element, sizeToSpace(target, element));
        if (sideEffect) {
          sideEffect(target);
        }
        sizeChangeEntries.push({ element, value: target });
      }
      onSizeChange?.(sizeChangeEntries, { reason, animated });
      return;
    }

    if (debug) {
      console.debug(`Start animating size changes`);
    }
    // Create height animations for each element in changeSet
    const transitions = Array.from(changeSet).map(({ element, target }) => {
      const transition = createHeightTransition(element, target, {
        duration: HEIGHT_TRANSITION_DURATION,
        // because we also set inline height when we don't want animation and it should win
        // we could also commit styles for animation or cancel any animation so that when we explicitely set height
        // sync the transition gets overriden
        styleSynchronizer: "inline_style",
      });
      return transition;
    });

    const transition = transitionController.update(transitions, {
      onChange: (changeEntries, isLast) => {
        // Apply side effects for each animated element
        for (const { transition, value } of changeEntries) {
          for (const change of changeSet) {
            if (change.element === transition.key) {
              if (change.sideEffect) {
                change.sideEffect(value, { isAnimationEnd: isLast });
              }
              break;
            }
          }
        }

        if (onSizeChange) {
          // Convert animation entries to the expected format
          const sizeChangeEntries = changeEntries.map(
            ({ transition, value }) => ({
              element: transition.key, // targetKey is the element
              value,
            }),
          );
          onSizeChange(
            sizeChangeEntries,
            isLast ? { reason, animated: false } : { reason, animated },
          );
        }
      },
    });
    transition.play();
  };

  const allocateSpace = (child, spaceToAllocate, requestSource) => {
    const requestedSpace = requestedSpaceMap.get(child);
    const canShrink = canShrinkSet.has(child);
    const canGrow = canGrowSet.has(child);

    let allocatedSpace;
    let allocatedSpaceSource;
    allocate: {
      const minSpace = minSpaceMap.get(child);
      if (spaceToAllocate > remainingSpace) {
        if (remainingSpace < minSpace) {
          allocatedSpace = minSpace;
          allocatedSpaceSource = "min space";
          break allocate;
        }
        allocatedSpace = remainingSpace;
        allocatedSpaceSource = "remaining space";
        break allocate;
      }
      if (spaceToAllocate < minSpace) {
        allocatedSpace = minSpace;
        allocatedSpaceSource = "min space";
        break allocate;
      }
      allocatedSpace = spaceToAllocate;
      allocatedSpaceSource = requestSource;
      break allocate;
    }

    if (allocatedSpace < requestedSpace) {
      if (!canShrink) {
        allocatedSpace = requestedSpace;
        allocatedSpaceSource = `${requestSource} + cannot shrink`;
      }
    } else if (allocatedSpace > requestedSpace) {
      if (!canGrow) {
        allocatedSpace = requestedSpace;
        allocatedSpaceSource = `${requestSource} + cannot grow`;
      }
    }

    remainingSpace -= allocatedSpace;
    if (debug) {
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const sourceInfo =
        allocatedSpaceSource === requestSource
          ? ""
          : ` (${allocatedSpaceSource})`;
      if (allocatedSpace === spaceToAllocate) {
        console.debug(
          `  → ${allocatedSize}px to "${child.id}"${sourceInfo} | ${remainingSpace}px remaining`,
        );
      } else {
        const requestedSize = spaceToSize(spaceToAllocate, child);
        console.debug(
          `  → ${allocatedSize}px -out of ${requestedSize}px wanted- to "${child.id}"${sourceInfo} | ${remainingSpace}px remaining`,
        );
      }
    }
    allocatedSpaceMap.set(child, allocatedSpace);

    const space = spaceMap.get(child);
    return allocatedSpace - space;
  };
  const applyDiffOnAllocatedSpace = (child, diff, source) => {
    if (diff === 0) {
      return 0;
    }
    const allocatedSpace = allocatedSpaceMap.get(child);
    remainingSpace += allocatedSpace;
    const spaceToAllocate = allocatedSpace + diff;
    if (debug) {
      console.debug(
        `🔄 ${child.id}: ${allocatedSpace}px + ${diff}px = ${spaceToAllocate}px (${source})`,
      );
    }
    allocateSpace(child, spaceToAllocate, source);
    const reallocatedSpace = allocatedSpaceMap.get(child);
    return reallocatedSpace - allocatedSpace;
  };
  const distributeAvailableSpace = (source) => {
    if (debug) {
      console.debug(
        `📦 Distributing ${availableSpace}px among ${container.children.length} children:`,
      );
    }
    for (const child of container.children) {
      allocateSpace(child, requestedSpaceMap.get(child), source);
    }
    if (debug) {
      console.debug(`📦 After distribution: ${remainingSpace}px remaining`);
    }
  };
  const distributeRemainingSpace = ({ childToGrow, childToShrinkFrom }) => {
    if (!remainingSpace) {
      return;
    }
    if (remainingSpace < 0) {
      const spaceToSteal = -remainingSpace;
      if (debug) {
        console.debug(
          `⚠️  Deficit: ${remainingSpace}px, stealing ${spaceToSteal}px from elements before ${childToShrinkFrom.id}`,
        );
      }
      updatePreviousSiblingsAllocatedSpace(
        childToShrinkFrom,
        -spaceToSteal,
        `remaining space is negative: ${remainingSpace}px`,
      );
      return;
    }
    if (childToGrow) {
      if (debug) {
        console.debug(
          `✨ Bonus: giving ${remainingSpace}px to ${childToGrow.id}`,
        );
      }
      applyDiffOnAllocatedSpace(
        childToGrow,
        remainingSpace,
        `remaining space is positive: ${remainingSpace}px`,
      );
    }
  };

  const updatePreviousSiblingsAllocatedSpace = (
    child,
    diffToApply,
    source,
    mapRemainingDiffToApply,
  ) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diffToApply;
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      const spaceDiff = applyDiffOnAllocatedSpace(
        previousSibling,
        remainingDiffToApply,
        source,
      );
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (!remainingDiffToApply) {
          break;
        }
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return spaceDiffSum;
  };
  const updateNextSiblingsAllocatedSpace = (
    child,
    diffToApply,
    reason,
    mapRemainingDiffToApply,
  ) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diffToApply;
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (mapRemainingDiffToApply) {
        remainingDiffToApply = mapRemainingDiffToApply(
          nextSibling,
          remainingDiffToApply,
        );
      }
      const spaceDiff = applyDiffOnAllocatedSpace(
        nextSibling,
        remainingDiffToApply,
        reason,
      );
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (!remainingDiffToApply) {
          break;
        }
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    return spaceDiffSum;
  };
  const updateSiblingAllocatedSpace = (child, diff, reason) => {
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (!isDetailsElement(nextSibling)) {
        nextSibling = nextSibling.nextElementSibling;
        continue;
      }
      const spaceDiff = applyDiffOnAllocatedSpace(nextSibling, diff, reason);
      if (spaceDiff) {
        return spaceDiff;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    if (debug) {
      console.debug(
        "coult not update next sibling allocated space, try on previous siblings",
      );
    }
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      if (!isDetailsElement(previousSibling)) {
        previousSibling = previousSibling.previousElementSibling;
        continue;
      }
      const spaceDiff = applyDiffOnAllocatedSpace(
        previousSibling,
        diff,
        reason,
      );
      if (spaceDiff) {
        return spaceDiff;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return 0;
  };

  const saveCurrentSizeAsRequestedSizes = ({
    replaceExistingAttributes,
  } = {}) => {
    for (const child of container.children) {
      if (canGrowSet.has(child) || canShrinkSet.has(child)) {
        if (
          child.hasAttribute("data-requested-height") &&
          !replaceExistingAttributes
        ) {
          continue;
        }
        const allocatedSpace = allocatedSpaceMap.get(child);
        child.setAttribute("data-requested-height", allocatedSpace);
      }
    }
  };

  const updateSpaceDistribution = ({ reason, animated }) => {
    if (debug) {
      console.group(`updateSpaceDistribution: ${reason}`);
    }
    prepareSpaceDistribution();
    distributeAvailableSpace(reason);
    distributeRemainingSpace({
      childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
      childToShrinkFrom: lastChild,
    });
    if (
      reason === "initial_space_distribution" ||
      reason === "content_change"
    ) {
      spaceMap.clear(); // force to set size at start
    }
    applyAllocatedSpaces({ reason, animated });
    saveCurrentSizeAsRequestedSizes();
    if (debug) {
      console.groupEnd();
    }
  };

  const resizableDetailsIdSet = new Set();
  const updateResizableDetails = () => {
    const currentResizableDetailsIdSet = new Set();
    let hasPreviousOpen = false;
    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      if (!child.open) {
        continue;
      }
      if (hasPreviousOpen) {
        currentResizableDetailsIdSet.add(child.id);
      }
      if (!hasPreviousOpen && child.open) {
        hasPreviousOpen = true;
      }
    }

    let someNew;
    let someOld;
    for (const currentId of currentResizableDetailsIdSet) {
      if (!resizableDetailsIdSet.has(currentId)) {
        resizableDetailsIdSet.add(currentId);
        someNew = true;
      }
    }
    for (const id of resizableDetailsIdSet) {
      if (!currentResizableDetailsIdSet.has(id)) {
        resizableDetailsIdSet.delete(id);
        someOld = true;
      }
    }
    if (someNew || someOld) {
      for (const child of container.children) {
        if (!child.dispatchEvent) {
          // ignore text nodes
          continue;
        }
        child.dispatchEvent(
          new CustomEvent("resizablechange", {
            detail: {
              resizable: resizableDetailsIdSet.has(child.id),
            },
          }),
        );
      }
      onResizableDetailsChange?.(resizableDetailsIdSet);
    }
  };

  {
    updateSpaceDistribution({
      reason: "initial_space_distribution",
    });
    updateResizableDetails();
  }

  {
    const distributeSpaceAfterToggle = (details) => {
      const reason = details.open
        ? `${details.id} just opened`
        : `${details.id} just closed`;
      if (debug) {
        console.group(`distributeSpaceAfterToggle: ${reason}`);
      }
      prepareSpaceDistribution();
      distributeAvailableSpace(reason);

      const requestedSpace = requestedSpaceMap.get(details);
      const allocatedSpace = allocatedSpaceMap.get(details);
      const spaceToSteal = requestedSpace - allocatedSpace - remainingSpace;
      if (spaceToSteal === 0) {
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
          childToShrinkFrom: lastChild,
        });
        return;
      }
      if (debug) {
        console.debug(
          `${details.id} would like to take ${requestedSpace}px (${reason}). Trying to steal ${spaceToSteal}px from sibling, remaining space: ${remainingSpace}px`,
        );
      }
      const spaceStolenFromSibling = -updateSiblingAllocatedSpace(
        details,
        -spaceToSteal,
        reason,
      );
      if (spaceStolenFromSibling) {
        if (debug) {
          console.debug(
            `${spaceStolenFromSibling}px space stolen from sibling`,
          );
        }
        applyDiffOnAllocatedSpace(details, requestedSpace, reason);
      } else {
        if (debug) {
          console.debug(
            `no space could be stolen from sibling, remaining space: ${remainingSpace}px`,
          );
        }
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[0],
          childToShrinkFrom: lastChild,
        });
      }
      if (debug) {
        console.groupEnd();
      }
    };

    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      const details = child;
      const ontoggle = () => {
        distributeSpaceAfterToggle(details);
        applyAllocatedSpaces({
          reason: details.open ? "details_opened" : "details_closed",
          animated: ANIMATE_TOGGLE,
        });
        updateResizableDetails();
      };
      if (details.open) {
        setTimeout(() => {
          details.addEventListener("toggle", ontoggle);
        });
      } else {
        details.addEventListener("toggle", ontoggle);
      }
      cleanupCallbackSet.add(() => {
        details.removeEventListener("toggle", ontoggle);
      });
    }
  }

  {
    const prepareResize = () => {
      let resizedElement;
      // let startSpaceMap;
      let startAllocatedSpaceMap;
      let currentAllocatedSpaceMap;

      const start = (element) => {
        updateSpaceDistribution({
          reason: "mouse_resize_start",
        });
        resizedElement = element;
        // startSpaceMap = new Map(spaceMap);
        startAllocatedSpaceMap = new Map(allocatedSpaceMap);
      };

      const applyMoveDiffToSizes = (moveDiff, reason) => {
        let spaceDiff = 0;
        let remainingMoveToApply;
        if (moveDiff > 0) {
          remainingMoveToApply = moveDiff;
          {
            // alors ici on veut grow pour tenter de restaurer la diff
            // entre requestedMap et spaceMap
            // s'il n'y en a pas alors on aura pas appliquer ce move
            const spaceGivenToNextSiblings = updateNextSiblingsAllocatedSpace(
              resizedElement,
              remainingMoveToApply,
              reason,
              (nextSibling) => {
                const requestedSpace = requestedSpaceMap.get(nextSibling);
                const space = spaceMap.get(nextSibling);
                return requestedSpace - space;
              },
            );
            if (spaceGivenToNextSiblings) {
              spaceDiff -= spaceGivenToNextSiblings;
              remainingMoveToApply -= spaceGivenToNextSiblings;
              if (debug) {
                console.debug(
                  `${spaceGivenToNextSiblings}px given to previous siblings`,
                );
              }
            }
          }
          {
            const spaceStolenFromPreviousSiblings =
              -updatePreviousSiblingsAllocatedSpace(
                resizedElement,
                -remainingMoveToApply,
                reason,
              );
            if (spaceStolenFromPreviousSiblings) {
              spaceDiff += spaceStolenFromPreviousSiblings;
              remainingMoveToApply -= spaceStolenFromPreviousSiblings;
              if (debug) {
                console.debug(
                  `${spaceStolenFromPreviousSiblings}px stolen from previous siblings`,
                );
              }
            }
          }
          {
            applyDiffOnAllocatedSpace(resizedElement, spaceDiff, reason);
          }
        }

        remainingMoveToApply = -moveDiff;
        {
          const selfShrink = -applyDiffOnAllocatedSpace(
            resizedElement,
            -remainingMoveToApply,
            reason,
          );
          remainingMoveToApply -= selfShrink;
          spaceDiff += selfShrink;
        }
        {
          const nextSiblingsShrink = -updateNextSiblingsAllocatedSpace(
            resizedElement,
            -remainingMoveToApply,
            reason,
          );
          if (nextSiblingsShrink) {
            remainingMoveToApply -= nextSiblingsShrink;
            spaceDiff += nextSiblingsShrink;
          }
        }
        {
          updatePreviousSiblingsAllocatedSpace(
            resizedElement,
            spaceDiff,
            reason,
          );
        }
      };

      const move = (yMove, gesture) => {
        // if (isNaN(moveRequestedSize) || !isFinite(moveRequestedSize)) {
        //   console.warn(
        //     `requestResize called with invalid size: ${moveRequestedSize}`,
        //   );
        //   return;
        // }
        const reason = `applying ${yMove}px move on ${resizedElement.id}`;
        if (debug) {
          console.group(reason);
        }

        const moveDiff = -yMove;
        applyMoveDiffToSizes(moveDiff, reason);
        applyAllocatedSpaces({
          reason: gesture.isMouseUp ? "mouse_resize_end" : "mouse_resize",
        });
        currentAllocatedSpaceMap = new Map(allocatedSpaceMap);
        allocatedSpaceMap = new Map(startAllocatedSpaceMap);
        if (debug) {
          console.groupEnd();
        }
      };

      const end = () => {
        if (currentAllocatedSpaceMap) {
          allocatedSpaceMap = currentAllocatedSpaceMap;
          saveCurrentSizeAsRequestedSizes({ replaceExistingAttributes: true });
          for (const [child, allocatedSpace] of allocatedSpaceMap) {
            const size = spaceToSize(allocatedSpace, child);
            if (onRequestedSizeChange) {
              onRequestedSizeChange(child, size);
            }
            child.dispatchEvent(
              new CustomEvent("resizeend", {
                detail: {
                  size,
                },
              }),
            );
          }
          onMouseResizeEnd?.();
        }
      };

      return { start, move, end };
    };

    const onmousedown = (event) => {
      const { start, move, end } = prepareResize();

      startDragToResizeGesture(event, {
        onDragStart: (gesture) => {
          start(gesture.element);
        },
        onDrag: (gesture) => {
          const yMove = gesture.yMove;
          move(yMove, gesture);
        },
        onRelease: () => {
          end();
        },
        constrainedFeedbackLine: false,
      });
    };
    container.addEventListener("mousedown", onmousedown);
    cleanupCallbackSet.add(() => {
      container.removeEventListener("mousedown", onmousedown);
    });
  }

  {
    /**
     * In the following HTML browser will set `<div>` height as if it was "auto"
     *
     * ```html
     * <details style="height: 100px;">
     *   <summary>...</summary>
     *   <div style="height: 100%"></div>
     * </details>
     * ```
     *
     * So we always maintain a precise px height for the details content to ensure
     * it takes 100% of the details height (minus the summay)
     *
     * To achieve this we need to update these px heights when the container size changes
     */
    const resizeObserver = new ResizeObserver(() => {
      updateSpaceDistribution({
        reason: "container_resize",
      });
    });
    resizeObserver.observe(container);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
    });
  }

  {
    // Track when the DOM structure changes inside the container
    // This detects when:
    // - Details elements are added/removed
    // - The content inside details elements changes
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          updateSpaceDistribution({
            reason: "content_change",
            animated: ANIMATE_RESIZE_AFTER_MUTATION,
          });
          return;
        }
        if (mutation.type === "characterData") {
          updateSpaceDistribution({
            reason: "content_change",
            animated: ANIMATE_RESIZE_AFTER_MUTATION,
          });
          return;
        }
      }
    });
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }

  return flexDetailsSet;
};

const prepareSyncDetailsContentHeight = (details) => {
  const getHeightCssValue = (height) => {
    return `${height}px`;
  };

  const summary = details.querySelector("summary");
  const summaryHeight = getHeight(summary);
  details.style.setProperty(
    "--summary-height",
    getHeightCssValue(summaryHeight),
  );

  const content = summary.nextElementSibling;
  if (!content) {
    return (detailsHeight) => {
      details.style.setProperty(
        "--details-height",
        getHeightCssValue(detailsHeight),
      );
      details.style.setProperty(
        "--content-height",
        getHeightCssValue(detailsHeight - summaryHeight),
      );
    };
  }

  // Capture scroll state at the beginning before any DOM manipulation
  const preserveScroll = captureScrollState(content);
  content.style.height = "var(--content-height)";

  const contentComputedStyle = getComputedStyle(content);
  const scrollbarMightTakeHorizontalSpace =
    contentComputedStyle.overflowY === "auto" &&
    contentComputedStyle.scrollbarGutter !== "stable";

  return (detailsHeight, { isAnimation, isAnimationEnd } = {}) => {
    const contentHeight = detailsHeight - summaryHeight;
    details.style.setProperty(
      "--details-height",
      getHeightCssValue(detailsHeight),
    );
    details.style.setProperty(
      "--content-height",
      getHeightCssValue(contentHeight),
    );

    if (!isAnimation || isAnimationEnd) {
      if (scrollbarMightTakeHorizontalSpace) {
        // Fix scrollbar induced overflow:
        //
        // 1. browser displays a scrollbar because there is an overflow inside overflow: auto
        // 2. we set height exactly to the natural height required to prevent overflow
        //
        // actual: browser keeps scrollbar displayed
        // expected: scrollbar is hidden
        //
        // Solution: Temporarily prevent scrollbar to display
        // force layout recalculation, then restore
        const restoreOverflow = forceStyles(content, {
          "overflow-y": "hidden",
        });
        // eslint-disable-next-line no-unused-expressions
        content.offsetHeight;
        restoreOverflow();
      }
    }

    // Preserve scroll position at the end after all DOM manipulations
    // The captureScrollState function is smart enough to handle new dimensions
    preserveScroll();
  };
};

const isDetailsElement = (element) => {
  return element && element.tagName === "DETAILS";
};

const getAvailableWidth = (
  element,
  parentWidth = getWidth(element.parentElement),
) => {
  const parentElement = element.parentElement;
  const paddingSizes = getPaddingSizes(parentElement);
  const borderSizes = getBorderSizes(parentElement);
  let availableWidth = parentWidth;
  availableWidth -=
    paddingSizes.left +
    paddingSizes.right +
    borderSizes.left +
    borderSizes.right;
  if (availableWidth < 0) {
    availableWidth = 0;
  }
  return availableWidth;
};

const getInnerWidth = (element) => {
  // Always subtract paddings and borders to get the content width
  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const width = getWidth(element);
  const horizontalSpaceTakenByPaddings = paddingSizes.left + paddingSizes.right;
  const horizontalSpaceTakenByBorders = borderSizes.left + borderSizes.right;
  const innerWidth =
    width - horizontalSpaceTakenByPaddings - horizontalSpaceTakenByBorders;
  return innerWidth;
};

const getMaxHeight = (
  element,
  availableHeight = getAvailableHeight(element),
) => {
  let maxHeight = availableHeight;
  const marginSizes = getMarginSizes(element);
  maxHeight -= marginSizes.top;
  maxHeight -= marginSizes.bottom;

  const parentElement = element.parentElement;
  const parentElementComputedStyle = window.getComputedStyle(parentElement);
  if (
    parentElementComputedStyle.display === "flex" &&
    parentElementComputedStyle.flexDirection === "column"
  ) {
    let previousSibling = element.previousElementSibling;
    while (previousSibling) {
      if (canTakeSpace(previousSibling)) {
        const previousSiblingHeight = getHeight(previousSibling);
        maxHeight -= previousSiblingHeight;
        const previousSiblingMarginSizes = getMarginSizes(previousSibling);
        maxHeight -= previousSiblingMarginSizes.top;
        maxHeight -= previousSiblingMarginSizes.bottom;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      if (canTakeSpace(nextSibling)) {
        const nextSiblingMinHeight = getMinHeight(nextSibling, availableHeight);
        maxHeight -= nextSiblingMinHeight;
        const nextSiblingMarginSizes = getMarginSizes(nextSibling);
        maxHeight -= nextSiblingMarginSizes.top;
        maxHeight -= nextSiblingMarginSizes.bottom;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxHeight;
};

const canTakeSpace = (element) => {
  const computedStyle = window.getComputedStyle(element);

  if (computedStyle.display === "none") {
    return false;
  }
  if (computedStyle.position === "absolute") {
    return false;
  }
  return true;
};

const canTakeSize = (element) => {
  const computedStyle = window.getComputedStyle(element);

  if (computedStyle.display === "none") {
    return false;
  }
  if (computedStyle.position === "absolute") {
    return false;
  }
  return true;
};

const getMinWidth = (element, availableWidth) => {
  const computedStyle = window.getComputedStyle(element);
  const { minWidth, fontSize } = computedStyle;
  return resolveCSSSize(minWidth, {
    availableSize:
      availableWidth === undefined
        ? getAvailableWidth(element)
        : availableWidth,
    fontSize,
  });
};

const getMaxWidth = (
  element,
  availableWidth = getAvailableWidth(element),
) => {
  let maxWidth = availableWidth;

  const marginSizes = getMarginSizes(element);
  maxWidth -= marginSizes.left;
  maxWidth -= marginSizes.right;

  const parentElement = element.parentElement;
  const parentElementComputedStyle = window.getComputedStyle(parentElement);
  if (
    parentElementComputedStyle.display === "flex" &&
    parentElementComputedStyle.flexDirection === "row"
  ) {
    let previousSibling = element.previousElementSibling;
    while (previousSibling) {
      if (canTakeSize(previousSibling)) {
        const previousSiblingWidth = getWidth(previousSibling);
        maxWidth -= previousSiblingWidth;
        const previousSiblingMarginSizes = getMarginSizes(previousSibling);
        maxWidth -= previousSiblingMarginSizes.left;
        maxWidth -= previousSiblingMarginSizes.right;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      if (canTakeSize(nextSibling)) {
        const nextSiblingMinWidth = getMinWidth(nextSibling, availableWidth);
        maxWidth -= nextSiblingMinWidth;
        const nextSiblingMarginSizes = getMarginSizes(nextSibling);
        maxWidth -= nextSiblingMarginSizes.left;
        maxWidth -= nextSiblingMarginSizes.right;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxWidth;
};

/**
 * Measures the width of the longest rendered visual line inside an element.
 *
 * Useful for solving the CSS "shrinkwrap" problem: when multi-line text sits
 * inside a `max-width` container, CSS expands the element to fill all
 * available space, leaving trailing whitespace to the right of the text.
 * Setting an explicit width equal to the longest line eliminates that gap.
 * See shrinkwrap_demo.html for a visual explanation.
 *
 * Returns `null` when all content fits on a single visual line (nothing to
 * optimize). Returns the pixel width of the widest line when text wraps to
 * two or more lines.
 *
 * ## Implementation note — bounding extent, not sum of widths
 *
 * `range.getClientRects()` returns one rect per layout box intersecting the
 * range. Nested elements (e.g. `<span><span>text</span></span>`) produce
 * multiple overlapping rects for the exact same pixels on the same line.
 * Summing their `width` values therefore over-counts the true line width.
 *
 * Instead we compute the bounding extent per line: track the minimum `left`
 * and maximum `right` across all rects sharing the same rounded `top`, then
 * use `right - left` as the line width. This is correct regardless of nesting
 * depth and works well for regular inline text content.
 *
 * Limitation: rects are grouped by `Math.round(r.top)`, so elements on the
 * same visual line but with slightly different baselines (e.g. an icon taller
 * than surrounding text) could be counted as separate lines. This is unlikely
 * to matter in practice for normal text rendering.
 *
 * Limitation: `range.getClientRects()` returns rects for text nodes and inline
 * boxes as laid out in the flow, ignoring any `overflow: hidden` or `max-width`
 * clipping applied to ancestor elements. If child elements clip their own
 * content (e.g. badges with `overflow: hidden` and `max-width`), the rects
 * will reflect the unclipped text size, producing a width larger than what is
 * visually rendered. In that case prefer `measureWidestChildRow`, which uses
 * each child's own `getBoundingClientRect()` and therefore respects clipping.
 *
 * @param {Element} el - The element whose text content should be measured.
 * @returns {number|null} Width in pixels of the longest visual line,
 *   or `null` if there is only one visual line.
 */
const measureLongestVisualLineWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);

  const lineBoundsByTop = new Map();
  for (const r of range.getClientRects()) {
    if (r.width === 0) {
      continue;
    }
    const top = Math.round(r.top);
    const existing = lineBoundsByTop.get(top);
    if (existing === undefined) {
      lineBoundsByTop.set(top, { left: r.left, right: r.right });
    } else {
      if (r.left < existing.left) {
        existing.left = r.left;
      }
      if (r.right > existing.right) {
        existing.right = r.right;
      }
    }
  }

  if (lineBoundsByTop.size <= 1) {
    return null;
  }

  let longestLineWidth = 0;
  for (const { left, right } of lineBoundsByTop.values()) {
    const w = right - left;
    if (w > longestLineWidth) {
      longestLineWidth = w;
    }
  }
  return longestLineWidth;
};

// Measures the width of the widest row of direct children.
// Uses children's bounding rects (which respect overflow:hidden / max-width)
// rather than Range.getClientRects() which sees through clipping boundaries.
// Returns null when all children fit on a single row (nothing to optimize).
const measureWidestChildRow = (el) => {
  const children = Array.from(el.children);
  if (children.length === 0) {
    return null;
  }

  const containerStyle = getComputedStyle(el);
  const paddingLeft = parseFloat(containerStyle.paddingLeft);
  const paddingRight = parseFloat(containerStyle.paddingRight);
  const borderLeft = parseFloat(containerStyle.borderLeftWidth);
  const borderRight = parseFloat(containerStyle.borderRightWidth);

  // Group children by row using their top position
  const rowsByTop = new Map();
  for (const child of children) {
    const rect = child.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    const top = Math.round(rect.top);
    const existing = rowsByTop.get(top);
    if (existing === undefined) {
      rowsByTop.set(top, { left: rect.left, right: rect.right });
    } else {
      if (rect.left < existing.left) {
        existing.left = rect.left;
      }
      if (rect.right > existing.right) {
        existing.right = rect.right;
      }
    }
  }

  if (rowsByTop.size <= 1) {
    return null;
  }

  let widestRowWidth = 0;
  for (const { left, right } of rowsByTop.values()) {
    const rowWidth = right - left;
    if (rowWidth > widestRowWidth) {
      widestRowWidth = rowWidth;
    }
  }

  // Convert from absolute pixel width to the container's content-box width
  // so that setting el.style.width = result + "px" works correctly.
  if (containerStyle.boxSizing === "border-box") {
    return (
      widestRowWidth + paddingLeft + paddingRight + borderLeft + borderRight
    );
  }
  return widestRowWidth;
};

const useAvailableHeight = (elementRef) => {
  const [availableHeight, availableHeightSetter] = useState(-1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    let raf;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const parentHeight = entry.contentRect.height;
      const availableH = getAvailableHeight(element, parentHeight);
      raf = requestAnimationFrame(() => {
        availableHeightSetter(availableH);
      });
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return availableHeight;
};

const useAvailableWidth = (elementRef) => {
  const [availableWidth, availableWidthSetter] = useState(-1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    let raf;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const parentWidth = entry.contentRect.width;
      const availableW = getAvailableWidth(element, parentWidth);
      raf = requestAnimationFrame(() => {
        availableWidthSetter(availableW);
      });
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return availableWidth;
};

const useMaxHeight = (elementRef, availableHeight) => {
  const element = elementRef.current;
  if (!element) {
    return -1;
  }
  const maxWidth = getMaxHeight(element, availableHeight);
  return maxWidth;
};

const useMaxWidth = (elementRef, availableWidth) => {
  const element = elementRef.current;
  if (!element) {
    return -1;
  }
  const maxWidth = getMaxWidth(element, availableWidth);
  return maxWidth;
};

const useResizeStatus = (elementRef, { as = "number" } = {}) => {
  const [resizing, setIsResizing] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(null);
  const [resizeHeight, setResizeHeight] = useState(null);

  useLayoutEffect(() => {
    const element = elementRef.current;

    const onresizestart = (e) => {
      const sizeInfo = e.detail;
      setResizeWidth(
        as === "number" ? sizeInfo.width : sizeInfo.widthAsPercentage,
      );
      setResizeHeight(
        as === "number" ? sizeInfo.height : sizeInfo.heightAsPercentage,
      );
      setIsResizing(true);
    };
    const onresize = (e) => {
      const sizeInfo = e.detail;
      setResizeWidth(
        as === "number" ? sizeInfo.width : sizeInfo.widthAsPercentage,
      );
      setResizeHeight(
        as === "number" ? sizeInfo.height : sizeInfo.heightAsPercentage,
      );
    };
    const onresizeend = () => {
      setIsResizing(false);
    };

    element.addEventListener("resizestart", onresizestart);
    element.addEventListener("resize", onresize);
    element.addEventListener("resizeend", onresizeend);
    return () => {
      element.removeEventListener("resizestart", onresizestart);
      element.removeEventListener("resize", onresize);
      element.removeEventListener("resizeend", onresizeend);
    };
  }, [as]);

  return {
    resizing,
    resizeWidth,
    resizeHeight,
  };
};

export { EASING, ELEMENT_SIZE_CHANGE, activeElementSignal, addActiveElementEffect, addAttributeEffect, allowWheelThrough, appendStyles, applyNewPosition, canScroll, captureScrollState, chainEvent, claimWheelGesture, closestOpenableAncestor, contrastColor, createBackgroundColorTransition, createBackgroundTransition, createBorderRadiusTransition, createBorderTransition, createDragGestureController, createDragToMoveGestureController, createEventGroupLogger, createGroupTransitionController, createHeightTransition, createIterableWeakSet, createOpacityTransition, createPubSub, createStyleController, createTimelineTransition, createTransition, createTranslateXTransition, createValueEffect, createWidthTransition, cubicBezier, dispatchCustomEvent, dispatchInternalCustomEvent, dispatchPublicCustomEvent, dragAfterIntent, elementIsFocusable, elementIsVisibleForFocus, elementIsVisuallyVisible, findAfter, findAncestor, findBefore, findDescendant, findEvent, findFocusDelegateTarget, findFocusable, findSelfOrAncestorFixedPosition, formatEventSideEffect, getAncestorOpenType, getAvailableHeight, getAvailableWidth, getBackground, getBackgroundColor, getBorder, getBorderRadius, getBorderSizes, getContrastRatio, getDefaultStyles, getDragCoordinates, getDropTargetInfo, getElementSignature, getFirstVisuallyVisibleAncestor, getFocusVisibilityInfo, getHeight, getHeightWithoutTransition, getInnerHeight, getInnerWidth, getKeyboardEventDefaultAction, getLuminance, getMarginSizes, getMaxHeight, getMaxWidth, getMinHeight, getMinWidth, getOpacity, getOpacityWithoutTransition, getPaddingSizes, getPositionedParent, getPositioningScrollOffset, getPreferedColorScheme, getScrollBox, getScrollContainer, getScrollContainerSet, getScrollRelativeRect, getSelfAndAncestorScrolls, getStyle, getTranslateX, getTranslateXWithoutTransition, getTranslateY, getVirtualKeyboardOverlayHeight, getVisuallyVisibleInfo, getWidth, getWidthWithoutTransition, hasCSSSizeUnit, initFlexDetailsSet, initFocusGroup, initPositionSticky, isAncestorOpen, isPrimaryButtonEvent, isSameColor, isScrollable, markDragSource, measureLongestVisualLineWidth, measureScrollbar, measureWidestChildRow, mergeOneStyle, mergeTwoStyles, normalizeKeyboardKey, normalizeStyle, normalizeStyles, observeAncestorOpenState, onAncestorReopen, parsePositionArea, parseStyle, performTabNavigation, pickPositionRelativeTo, prefersDarkColors, prefersLightColors, preventFocusNav, preventFocusNavViaKeyboard, preventIntermediateScrollbar, releaseWheelGesture, resolveCSSColor, resolveCSSSize, resolveColorLuminance, resolveOklchLightness, scrollIntoViewScoped, scrollIntoViewWithStickyAwareness, scrollRoomTowards, setAttribute, setAttributes, setStyles, setVirtualKeyboardOverlaysContent, snapToPixel, startDragTo, startDragToResizeGesture, startDragToTravel, stickyAsRelativeCoords, stringifyStyle, subscribeVirtualKeyboardGeometryChange, subscribeVisualViewportResizeSettled, subscribeWindowResizeSettled, suppressClickAfterGesture, trapFocusInside, trapScrollInside, useActiveElement, useAvailableHeight, useAvailableWidth, useMaxHeight, useMaxWidth, useResizeStatus, visibleRectEffect, waitForPressHeld, watchWheelTravel, wheelGestureIsTakenFrom };
