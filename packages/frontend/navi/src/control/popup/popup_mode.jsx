/**
 * Where the "popover or dialog?" answer lives, for both the components that
 * decide it and the content that renders inside one.
 *
 * `useResolvedPopupMode` is the decision (screen size + maxWidth heuristic),
 * called by whatever renders the popup — `Popup` itself, or `picker_custom.jsx`
 * which needs the answer for its own mode-dependent history/ARIA handling on
 * top of picking a renderer. `usePopupMode` is the read side: any content
 * rendered inside a popup can call it to lay itself out differently in a
 * dropdown than in a full-screen modal.
 */

import { createContext } from "preact";
import { useContext, useRef } from "preact/hooks";

import { windowWidthSignal } from "../../layout/responsive.js";

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
 * @param {string} [maxWidth] - A small enough value is treated as "compact",
 *   staying a popover even on a small screen.
 * @returns {["dialog"|"popover", () => void]} The resolved mode, and a
 *   `resetMode` function a caller can call (e.g. on close) to force the *next*
 *   call to re-resolve from scratch instead of keeping the frozen value —
 *   `Popup` itself never needs this (it has no notion of open/close of its
 *   own), `picker_custom.jsx` does (re-evaluates screen size on every fresh
 *   open).
 */
export const useResolvedPopupMode = (modeProp, maxWidth) => {
  const defaultModeRef = useRef(null);
  if (defaultModeRef.current === null) {
    defaultModeRef.current = resolvePopupMode(modeProp, maxWidth);
  }
  const resetMode = () => {
    defaultModeRef.current = null;
  };
  return [defaultModeRef.current, resetMode];
};

const resolvePopupMode = (modeProp, maxWidth) => {
  const isSmallScreen = windowWidthSignal.peek() <= 600;
  const maxWidthPx = parseFloat(maxWidth);
  const isCompact = isFinite(maxWidthPx) && maxWidthPx < 150;
  return modeProp ?? (isSmallScreen && !isCompact ? "dialog" : "popover");
};
