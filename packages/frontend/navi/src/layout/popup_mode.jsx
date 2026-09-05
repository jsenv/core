/**
 * Where the "popover or dialog?" answer lives, for both the components that
 * decide it and the content that renders inside one.
 *
 * `useResolvedPopupMode` is the decision (available width + maxWidth
 * heuristic — the visual viewport, or the container for a local popup),
 * called by whatever renders the popup — `Popup` itself, or `picker_custom.jsx`
 * which needs the answer for its own mode-dependent history/ARIA handling on
 * top of picking a renderer. `usePopupMode` is the read side: any content
 * rendered inside a popup can call it to lay itself out differently in a
 * dropdown than in a full-screen modal.
 */

import { getPositionedParent } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useRef } from "preact/hooks";

import { visualViewportWidthSignal } from "./responsive.js";

export const PopupModeContext = createContext(undefined);

/**
 * Read the mode of the popup this is rendered inside — a `Popup`, or a
 * `Picker`'s own popup. Returns undefined outside of any popup content.
 *
 * @returns {"popover" | "dialog" | undefined}
 */
export const usePopupMode = () => useContext(PopupModeContext);

/**
 * Resolves which of Popover/Dialog a popup should be. Frozen for the component
 * instance's lifetime, so a screen resize never switches an already-mounted
 * popup from one to the other mid-session.
 *
 * @param {"dialog"|"popover"} [modeProp] - Forces one mode; `undefined` to
 *   resolve automatically.
 * @param {string} [maxWidth] - A fixed length under 150px is treated as
 *   "compact", staying a popover even in a narrow container. Read in px, em or
 *   rem; a width given as a share (%, viewport units, calc()) says nothing
 *   about how small the popup is and leaves the container's own width to
 *   decide.
 * @param {object} [options]
 * @param {"top"|"local"} [options.layer] - Where the popup will live. The
 *   decision measures the room the popup will actually get: the visual
 *   viewport for a top-layer popup, the positioned ancestor for a
 *   `layer="local"` one — a 320px frame is a small screen for the popup it
 *   confines, whatever the window measures.
 * @param {{current: Element|null}} [options.elementRef] - An element at (or
 *   near) the spot the popup is declared, used to find the positioned
 *   ancestor a local popup answers to. Only read for `layer="local"`.
 * @returns {["dialog"|"popover", () => void]} The resolved mode, and a
 *   `resetMode` function a caller can call (e.g. on close) to force the *next*
 *   call to re-resolve from scratch instead of keeping the frozen value —
 *   `Popup` itself never needs this (it has no notion of open/close of its
 *   own), `picker_custom.jsx` does (re-evaluates the available room on every
 *   fresh open).
 */
export const useResolvedPopupMode = (
  modeProp,
  maxWidth,
  { layer, elementRef } = {},
) => {
  const defaultModeRef = useRef(null);
  let mode = defaultModeRef.current;
  if (mode === null) {
    const element = elementRef ? elementRef.current : null;
    mode = resolvePopupMode(modeProp, maxWidth, { layer, element });
    // A local popup measures its container, and that takes DOM: on the very
    // first render the element is not mounted yet, so the value above came
    // from the viewport fallback. Used for this render, but not frozen — the
    // next render has the element and resolves against the real container.
    // Only when an elementRef was handed over though: without one there is
    // nothing to wait for, and staying unfrozen would let the mode flip
    // mid-session, the very thing the freeze exists to prevent.
    const resolvedBlind =
      layer === "local" && !modeProp && elementRef && !element;
    if (!resolvedBlind) {
      defaultModeRef.current = mode;
    }
  }
  const resetMode = () => {
    defaultModeRef.current = null;
  };
  return [mode, resetMode];
};

const resolvePopupMode = (modeProp, maxWidth, { layer, element }) => {
  if (modeProp) {
    return modeProp;
  }
  const isNarrow = getAvailableWidth(layer, element) <= 600;
  const maxWidthPx = resolveFixedLength(maxWidth);
  const isCompact = maxWidthPx !== null && maxWidthPx < 150;
  return isNarrow && !isCompact ? "dialog" : "popover";
};

// A length must be resolved before it can be compared to one: "22em" is not 22
// pixels. px and em/rem are the values describing a fixed box, so they are the
// ones read here — em against the root font size like rem, this being decided
// before there is any element to resolve it against. Anything else (%,
// viewport units, calc()) is a share of something rather than a statement that
// the popup is small, and reads as no maxWidth at all: the same dialog a
// narrow screen gets when nothing caps the width.
const FIXED_LENGTH_REGEX = /^([0-9.]+)(px|em|rem)?$/;
const resolveFixedLength = (value) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = FIXED_LENGTH_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, amount, unit] = match;
  if (unit === "em" || unit === "rem") {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    return parseFloat(amount) * rootFontSize;
  }
  return parseFloat(amount);
};

// The room the popup will really get: what it is positioned and sized
// against. For a local popup that is its positioned ancestor; for a top-layer
// one the visual viewport — not window.innerWidth, which ignores pinch-zoom
// and the mobile keyboard's effect on what is actually visible.
const getAvailableWidth = (layer, element) => {
  if (layer === "local" && element) {
    return getPositionedParent(element).clientWidth;
  }
  return visualViewportWidthSignal.peek();
};
