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
export const setVirtualKeyboardOverlaysContent = (value) => {
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
 *
 * The height only, never `boundingRect.y`: moving focus from one field to
 * another with the keyboard up, Chrome 153 (Android 10) reported the same
 * height with a top 200px off, its bottom nowhere near the screen's. The
 * keyboard is at the bottom of the viewport; its height is what holds.
 */
export const getVirtualKeyboardOverlayHeight = () => {
  if (!virtualKeyboard) {
    return 0;
  }
  const { height } = virtualKeyboard.boundingRect;
  return height > 0 ? height : 0;
};

/**
 * Calls `callback` whenever the keyboard shows, hides or resizes — whenever
 * getVirtualKeyboardOverlayHeight() changes. Returns an unsubscribe function;
 * a no-op (never calls back) without support.
 *
 * On the height alone: Chrome (Android 10 / Chrome 153) also fires
 * "geometrychange" at an unchanged height while the page is scrolled with the
 * keyboard up, and a listener acting on those — bringing the focused field
 * back into view — takes the scroll away from the user. The rest of the rect
 * says nothing either (see getVirtualKeyboardOverlayHeight for its y).
 *
 * Undebounced on purpose, unlike window/visualViewport resize
 * (window_size.js): filtered on the height, what is left is the keyboard
 * itself changing, not the layout reacting to it, which is the whole point of
 * overlaying.
 */
export const subscribeVirtualKeyboardGeometryChange = (callback) => {
  if (!virtualKeyboard) {
    return () => {};
  }
  let height = getVirtualKeyboardOverlayHeight();
  const onGeometryChange = (event) => {
    const newHeight = getVirtualKeyboardOverlayHeight();
    if (newHeight === height) {
      return;
    }
    height = newHeight;
    callback(event);
  };
  virtualKeyboard.addEventListener("geometrychange", onGeometryChange);
  return () => {
    virtualKeyboard.removeEventListener("geometrychange", onGeometryChange);
  };
};
