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
 * The `mount` prop moves that line. "closed" is two states, not one — never
 * opened yet, and closed again after an opening — and the four values answer
 * both at once:
 *
 * | mount             | before the first open       | after a close |
 * | ----------------- | --------------------------- | ------------- |
 * | "always"          | mounted                     | mounted       |
 * | "idle"            | mounted once the page idles | mounted       |
 * | "from-first-open" | not mounted                 | mounted       |
 * | "while-opened"    | not mounted                 | not mounted   |
 *
 * "always" is for content something else depends on before any opening: a
 * value the popup's owner reads off its own children, fields a form around it
 * collects on submit, a size measured from outside.
 *
 * "idle" is "always" minus the cost on the critical render: the page appears
 * without the content, and the browser builds it in an idle moment after
 * load — so by the time anyone clicks, it is usually already there.
 *
 * "while-opened" is the opposite end: content that must be rebuilt from
 * scratch every time, because what it shows is read once at build time and can
 * change while the popup is closed — an uncontrolled field seeded from a
 * `defaultValue`, a form whose fresh state is its initial state.
 *
 * On top of whichever value is picked, intent on the anchor warms the content:
 * a pointer entering the popup's anchor, or focus landing in it, builds the
 * content ahead of the click that will open it. Deferring the build to the
 * opening puts its whole cost in the frame right after the click — the frame
 * where a delay is felt hardest — while the ~100-300ms between hovering a
 * trigger and pressing it are free. The warming render is asynchronous
 * (batched, not flushed): nothing here needs the content in the DOM before
 * the click, only before the open that follows it.
 *
 * "while-opened" content is never warmed. That mode promises two things
 * warming would break: the content is built at open time (so a `defaultValue`
 * read at build time is fresh, not seeded at pointer-enter time), and it is
 * only ever mounted between an open and a close — unmounting happens on close,
 * so a warmed popup that never opens would keep its content in the document
 * indefinitely. Callers lean on that guarantee (e.g. several pickers sharing
 * one set of content ids because only one content exists at a time).
 */

import { useEffect, useLayoutEffect, useState } from "preact/hooks";

import { flushSyncRendering } from "../utils/flush_sync_rendering.js";
import { whenTransitionSettles } from "./popup_shared.js";

export const MOUNT_DEFAULT = "from-first-open";

// requestIdleCallback is missing from Safari; a timeout is close enough there.
const requestIdle = (callback) =>
  typeof requestIdleCallback === "function"
    ? requestIdleCallback(callback)
    : setTimeout(callback, 300);
const cancelIdle = (id) =>
  typeof cancelIdleCallback === "function"
    ? cancelIdleCallback(id)
    : clearTimeout(id);

export const usePopupContentMount = (
  openController,
  ref,
  { mount = MOUNT_DEFAULT, anchor },
) => {
  const mountedAlways = mount === "always";
  const [contentMounted, setContentMounted] = useState(
    () => mountedAlways || openController.opened,
  );
  openController.mountContent = contentMounted
    ? null
    : () => {
        flushSyncRendering(() => {
          setContentMounted(true);
        });
      };
  openController.unmountContent =
    mount === "while-opened"
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
    if (mountedAlways) {
      setContentMounted(true);
    }
  }, [mountedAlways]);
  useEffect(() => {
    if (mount !== "idle" || contentMounted) {
      return undefined;
    }
    const idleId = requestIdle(() => {
      setContentMounted(true);
    });
    return () => {
      cancelIdle(idleId);
    };
  }, [mount, contentMounted]);
  // Warm on intent (see the top comment; "while-opened" is excluded there).
  // The anchor accepts the same shapes Popover resolves at open time — a
  // string id, a ref, an element — but is resolved here at effect time: an id
  // that matches nothing yet simply doesn't warm, the open still mounts the
  // content like it always does.
  useEffect(() => {
    if (contentMounted || !anchor || mount === "while-opened") {
      return undefined;
    }
    const anchorElement =
      typeof anchor === "string"
        ? document.getElementById(anchor)
        : // A ref is unwrapped even when it holds nothing: an expandable with
          // no UI part hands an empty ref over, and the ref object itself is
          // truthy — it would reach addEventListener below and throw.
          "current" in anchor
          ? anchor.current
          : anchor;
    if (!anchorElement) {
      return undefined;
    }
    const warm = () => {
      setContentMounted(true);
    };
    anchorElement.addEventListener("pointerenter", warm);
    anchorElement.addEventListener("focusin", warm);
    return () => {
      anchorElement.removeEventListener("pointerenter", warm);
      anchorElement.removeEventListener("focusin", warm);
    };
  }, [contentMounted, anchor, mount]);

  return contentMounted;
};
