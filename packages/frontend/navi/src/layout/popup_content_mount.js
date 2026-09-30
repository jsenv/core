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
 * collects on submit, a size measured from outside. When the popup's owner
 * cannot tell at mount whether anything will depend on it, the content waits
 * and whatever depends on it asks for it, closed, with
 * `openController.buildContent()` (a picker's drawing reading the value its
 * popup holds, see usePickerContext).
 *
 * "idle" is "always" minus the cost on the critical render: the page appears
 * without the content, and the browser builds it in an idle moment after
 * load — so by the time anyone clicks, it is usually already there.
 *
 * "while-opened" is the opposite end: content rebuilt from scratch every
 * time, a form whose fresh state is its initial state. What kept content
 * carries into the next opening is an unsent edit — an untouched field
 * follows a new `defaultValue` on its own (see followDefaultValue in
 * ui_state_controller.js) — and this is what throws that edit away.
 *
 * On top of whichever value is picked, intent on the anchor warms the content:
 * a pointer entering the popup's anchor, or focus landing in it, builds the
 * content ahead of the click that will open it. Deferring the build to the
 * opening puts its whole cost in the frame right after the click — the frame
 * where a delay is felt hardest — while the ~100-300ms between hovering a
 * trigger and pressing it are free. The warming render starts at the frame
 * after the one that follows the intent: nothing here needs the content in the
 * DOM before the click, only before the open that follows it, and on a touch
 * screen `pointerover` arrives together with the `pointerdown` — a build
 * started there would hold back the frame that shows the press. Two animation
 * frames, never a timeout: browsers hold timers back while a finger is down,
 * and a timeout started by the press fires at its release, on top of the click.
 *
 * The anchor only says where the popup is placed, so intent inside it is read
 * off the control it is aimed at, the nearest one around the target. A control
 * the anchor holds that is not the one holding this popup keeps that intent:
 * a player's own picker in a card that another picker opens from warms the
 * player's callout, never the card's sheet. And a pointer on a trigger that a
 * press does not open (`data-open-on`: a picker opened by a hold, or only by a
 * command) says nothing; the keyboard still opens it, so focus there warms.
 *
 * "while-opened" content is warmed by an opening press, never by a hover or a
 * focus. That mode promises content built fresh for the gesture that opens
 * it, and mounted only while that gesture and its opening last: callers lean
 * on it (several pickers sharing one set of content ids, because only one
 * content exists at a time). A pointer crossing four triggers would build four
 * contents; a press is the start of one opening.
 *
 * Only what opens the popup can say its press is one, and it says so as the
 * press starts, with a `navi_open_press` delivered where the opening request
 * would be (see announceOpeningPress in commands.js): a `--navi-open` button, a picker's
 * trigger when a press is what opens it, an expandable's UI part. Not the
 * anchor: it says where the popup is placed, not what opens it — a card
 * opened by a hold is pressed all day by taps meant for what it holds.
 *
 * The press builds the content, and the press ending without an open throws
 * it away — its click reaching the document with the popup still closed, no
 * click coming after the release, the browser taking the gesture
 * (`pointercancel`), or the next press starting, before any of its own
 * handlers run: one press at a time holds a content. A keyboard opening builds
 * at open time. A "while-opened" popup with an `onOpen` is not warmed by the
 * press: that callback runs before the content is built (see
 * open_controller.js), and a content seeding itself from what it writes must
 * be built after it. Hover and focus warming, for the other values, builds
 * ahead of `onOpen` all the same.
 */

import { isPressDrivenClick } from "@jsenv/dom";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { flushSyncRendering } from "../utils/flush_sync_rendering.js";
import { whenTransitionSettles } from "./popup_shared.js";

export const MOUNT_DEFAULT = "from-first-open";

// The popups whose content is being built by their own opening, for the length
// of that build. What mounts inside one is not on screen (the popup is still
// closed) and will be revealed by the open that follows — an answer
// use_displayed_layout_effect.js reads from here rather than from the layout.
const popupsMountingContentForOpen = new Set();
export const isMountingContentForOpen = (popupElement) =>
  popupsMountingContentForOpen.has(popupElement);
// The popup being built that holds `element` somewhere below it, or null. For
// an element whose own openable ancestor is something else (a closed trigger
// inside the popup): what the layout would say about it is what it says about
// the whole popup — nothing is on screen there yet.
export const findPopupMountingContentAround = (element) => {
  for (const popupElement of popupsMountingContentForOpen) {
    if (popupElement !== element && popupElement.contains(element)) {
      return popupElement;
    }
  }
  return null;
};

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
  const [contentMounted, setContentMountedState] = useState(
    () => mountedAlways || openController.opened,
  );
  // What was last asked for, ahead of the render that performs it: an open
  // landing in between (a press-warmed content given up just before the open
  // that wanted it) must still find it has to build.
  const contentMountedRef = useRef(contentMounted);
  const setContentMounted = (value) => {
    contentMountedRef.current = value;
    setContentMountedState(value);
  };
  openController.mountContent = () => {
    if (contentMountedRef.current) {
      return;
    }
    const popupElement = ref?.current;
    if (popupElement) {
      popupsMountingContentForOpen.add(popupElement);
    }
    try {
      flushSyncRendering(() => {
        setContentMounted(true);
      });
    } finally {
      if (popupElement) {
        popupsMountingContentForOpen.delete(popupElement);
      }
    }
  };
  // A plain render rather than a flush: the popup stays closed, and nothing is
  // about to measure it.
  openController.buildContent = () => {
    if (contentMountedRef.current) {
      return;
    }
    setContentMounted(true);
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
  // Warm on intent (see the top comment).
  useEffect(() => {
    if (contentMounted || !anchor || mount === "while-opened") {
      return undefined;
    }
    const anchorElement = resolveAnchorElement(anchor);
    if (!anchorElement) {
      return undefined;
    }
    let cancelWarm = null;
    const warm = () => {
      if (cancelWarm) {
        return;
      }
      cancelWarm = requestFrameAfterNext(() => {
        setContentMounted(true);
      });
    };
    // The anchor itself when it is a control (a Popover anchored on the button
    // opening it), or the one the popup is written in (a picker's trigger).
    const isOwnControl = (control) =>
      control === anchorElement || control.contains(ref?.current);
    // pointerover rather than pointerenter: it says which element the pointer
    // is over, and that element decides whose intent it is.
    const onPointerOver = (pointeroverEvent) => {
      const control = findControlAimedAt(
        pointeroverEvent.target,
        anchorElement,
      );
      if (control) {
        if (!isOwnControl(control)) {
          return;
        }
        if (control.hasAttribute("data-open-on")) {
          return;
        }
      }
      warm();
    };
    const onFocusIn = (focusinEvent) => {
      const control = findControlAimedAt(focusinEvent.target, anchorElement);
      if (control && !isOwnControl(control)) {
        return;
      }
      warm();
    };
    anchorElement.addEventListener("pointerover", onPointerOver);
    anchorElement.addEventListener("focusin", onFocusIn);
    return () => {
      cancelWarm?.();
      anchorElement.removeEventListener("pointerover", onPointerOver);
      anchorElement.removeEventListener("focusin", onFocusIn);
    };
  }, [contentMounted, anchor, mount]);
  // Warm on an opening press, for "while-opened" (see the top comment). Told
  // by the popup's own element, which hears the announcement where it hears
  // the opening request: `onnavi_open_press` beside each `onnavi_request_open`.
  const stopPressWarmRef = useRef(null);
  openController.onOpeningPress =
    mount === "while-opened"
      ? () => {
          if (contentMountedRef.current || openController.onOpen) {
            return;
          }
          const cancelBuild = requestFrameAfterNext(() => {
            setContentMounted(true);
          });
          const stopWatching = watchPressEnd(() => {
            stopPressWarmRef.current = null;
            cancelBuild();
            if (!openController.opened) {
              setContentMounted(false);
            }
          });
          stopPressWarmRef.current = () => {
            stopPressWarmRef.current = null;
            cancelBuild();
            stopWatching();
          };
        }
      : null;
  useEffect(() => {
    return () => {
      stopPressWarmRef.current?.();
    };
  }, [mount]);

  return contentMounted;
};

// The anchor accepts the same shapes Popover resolves at open time — a string
// id, a ref, an element — but is resolved at effect time: an id that matches
// nothing yet simply doesn't warm, the open still mounts the content.
const resolveAnchorElement = (anchor) => {
  if (typeof anchor === "string") {
    return document.getElementById(anchor);
  }
  // A ref is unwrapped even when it holds nothing: an expandable with no UI
  // part hands an empty ref over, and the ref object itself is truthy — it
  // would reach addEventListener and throw.
  if ("current" in anchor) {
    return anchor.current;
  }
  return anchor;
};

// The nearest control around the target, when the anchor holds it or is it.
// Null for content of the anchor that no control of its own claims.
const findControlAimedAt = (target, anchorElement) => {
  const control = target.closest("[navi-control]");
  if (!control || !anchorElement.contains(control)) {
    return null;
  }
  return control;
};

// The next frame paints what the input just changed (the pressed trigger); the
// callback runs at the start of the one after.
export const requestFrameAfterNext = (callback) => {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(callback);
  });
  return () => {
    cancelAnimationFrame(frame);
  };
};

// How long the click of a released press may take to arrive. Nothing tells a
// page that a release brings no click — a press that became a drag has its
// click swallowed (suppressClickAfterGesture in @jsenv/dom) — so past this the
// press is taken to have ended without one. Longer than the 300ms a browser
// still waits before the click of a tap on a page not sized for phones.
const PRESS_CLICK_WAIT_MS = 500;

// Installed during the press's own pointerdown: the capture listeners below
// only hear the presses after it.
const watchPressEnd = (onEnd) => {
  let timeout;
  const stop = () => {
    clearTimeout(timeout);
    document.removeEventListener("click", onClick);
    document.removeEventListener("pointerup", onPointerUp, { capture: true });
    document.removeEventListener("pointercancel", end, { capture: true });
    document.removeEventListener("pointerdown", end, { capture: true });
  };
  const end = () => {
    stop();
    onEnd();
  };
  // Bubble phase, on the document: every click handler that could open the
  // popup has run by then.
  const onClick = (clickEvent) => {
    if (isPressDrivenClick(clickEvent)) {
      end();
    }
  };
  const onPointerUp = () => {
    timeout = setTimeout(end, PRESS_CLICK_WAIT_MS);
  };
  document.addEventListener("click", onClick);
  document.addEventListener("pointerup", onPointerUp, { capture: true });
  document.addEventListener("pointercancel", end, { capture: true });
  document.addEventListener("pointerdown", end, { capture: true });
  return stop;
};
