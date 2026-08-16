/**
 * When a popup builds what it holds, and when it throws it away.
 *
 * A closed popup shows nothing, focuses nothing, and answers nothing: what it
 * holds is out of reach until it opens. Building that content at mount time
 * means a page carrying a handful of closed popups pays, on the very render
 * that decides how fast it appears, for content nobody has asked for — and
 * pays again on every subsequent measurement, since each of those nodes makes
 * the document the rest of the page queries bigger.
 *
 * So the content is built when the popup first opens, and stays built from
 * then on: closing is not throwing away, and a reopened popup finds its scroll
 * position, its half-typed form and its list state where it left them.
 *
 * It is built synchronously, from inside `openController.open()` and before
 * `openEffect` runs (see open_controller.js), so the popup still measures real
 * content when it positions and animates itself, and so anything inside it
 * still observes the opening the way it always did — mounted while the popup
 * reads as closed, told it opened right after (see
 * use_displayed_layout_effect.js).
 *
 * `mountWhenClosed` is for content something else depends on before any of
 * this: a value the popup's owner reads off its own children, fields a form
 * around it collects on submit, a size measured from outside.
 *
 * `unmountWhenClosed` is the opposite end: content that must be rebuilt from
 * scratch every time, because what it shows is read once at build time and can
 * change while the popup is closed — an uncontrolled field seeded from a
 * `defaultValue`, a form whose fresh state is its initial state.
 */

import { useLayoutEffect, useState } from "preact/hooks";

import { flushSyncRendering } from "../utils/flush_sync_rendering.js";
import { whenTransitionSettles } from "./popup_shared.js";

export const usePopupContentMount = (
  openController,
  ref,
  { children, mountWhenClosed, unmountWhenClosed },
) => {
  const [contentMounted, setContentMounted] = useState(
    () => Boolean(mountWhenClosed) || openController.opened,
  );
  openController.mountContent = contentMounted
    ? null
    : () => {
        flushSyncRendering(() => {
          setContentMounted(true);
        });
      };
  openController.unmountContent =
    unmountWhenClosed && !mountWhenClosed
      ? () => {
          const element = ref?.current;
          if (!element) {
            setContentMounted(false);
            return;
          }
          // The popup is still on screen while it plays its exit transition;
          // emptying it right away would show that transition running on a
          // blank surface.
          whenTransitionSettles(element, () => {
            if (openController.opened) {
              // reopened while it was leaving — the content it holds is the
              // one that open just asked for
              return;
            }
            setContentMounted(false);
          });
        }
      : null;
  useLayoutEffect(() => {
    if (mountWhenClosed) {
      setContentMounted(true);
    }
  }, [mountWhenClosed]);

  return contentMounted ? children : null;
};
