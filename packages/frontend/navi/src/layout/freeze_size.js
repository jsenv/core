/**
 * Holding a box at the size it has right now — what the `sizing="frozen"` prop
 * on Dialog, Popover and SlideContainer is made of.
 *
 * The need: a surface being used is a frame that has been put down. What moves
 * inside it is its content, not the frame — a list one empties by acting on it
 * (marking as read, archiving) must not resize the box under the finger, or the
 * next row moves while it is being aimed at.
 */

/**
 * Read back through getComputedStyle rather than offsetWidth/offsetHeight: the
 * used values honour whatever `box-sizing` is in effect, so writing them back
 * reproduces exactly the box that was measured, to the subpixel. Neither is
 * affected by a transform, so this is safe to call while an entrance animation
 * is scaling the box.
 *
 * `width`/`height`, never `min-width`/`min-height`: a `max-*` — the caller's
 * own, or the container ceiling a popup already computes for itself — must keep
 * winning, so a box frozen at 500px on a phone held upright still fits once it
 * is turned.
 */
export const freezeSize = (el) => {
  const { width, height } = getComputedStyle(el);
  el.style.width = width;
  el.style.height = height;
};

export const unfreezeSize = (el) => {
  el.style.width = "";
  el.style.height = "";
};
