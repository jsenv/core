/**
 * A popup nobody has asked for yet stands in as one bare element: a
 * `<dialog>` for a Dialog, a `<div>` for a Popover. That element is all that
 * reaches a closed popup before its first opening: a command finds it by id
 * (`commandfor`) and asks it to open, a press on what opens it announces
 * itself on it (navi_open_press), --navi-toggle reads its aria-expanded. The
 * popup proper — its open controller, its box, its backdrop, its focus and
 * pseudo-class wiring — is built at the first request: an open, its signal or
 * its `open` saying open. A list whose rows each hold a few popups mounts
 * hundreds of them, and would pay for every one at every mount, for openings
 * that mostly never come. Built once, the popup stays: the next opening finds
 * it there.
 *
 * The intent that warms the content of a closed popup (see
 * popup_content_mount.js) warms one standing in the same way, and builds the
 * popup and its content together: a press on what opens it, a pointer
 * entering its anchor, focus landing there. The click that follows only opens.
 *
 * Nothing about where the popup goes is needed at rest: a popover reads its
 * anchor at the opening, from the request.
 *
 * A popup whose open state its owner holds — a Picker, which hands the popup
 * its own open controller — stands in the same way (useControlledPopupStandIn):
 * a list of cases that each open a sheet is one picker per case. Opening goes
 * through that controller rather than through a request on the element, so the
 * controller is what builds it: `open()` renders the popup proper first, and
 * the content is then built for that opening as it would have been anyway.
 * Something reading the content while closed (`buildContent`) is one more
 * intent there.
 */

import { dispatchCustomEvent } from "@jsenv/dom";
import { computed } from "@preact/signals";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { preloadState } from "../nav/route.js";
import { flushSyncRendering } from "../utils/flush_sync_rendering.js";
import { readOpened, readOpenValue } from "./open_controller.js";
import {
  requestBuildOnPress,
  warmOnAnchorIntent,
} from "./popup_content_mount.js";

/**
 * @returns {[null|"mount"|"interaction"|"request"|"warm", {current: Element}, object]}
 *   Why the popup proper exists (`null` while it stands in; "interaction" is
 *   an opening asked while it stood in, which plays like any other; "warm"
 *   built its content along with it), the ref both elements share, and the
 *   props of the stand-in element.
 */
export const usePopupStandIn = (props) => {
  const { ref, id, signal, value, open, anchor } = props;
  const ownRef = useRef();
  const popupRef = ref || ownRef;
  // Why the popup proper exists, once it does; never undone.
  const builtRef = useRef(null);
  const mountedRef = useRef(false);
  const isMount = !mountedRef.current;
  mountedRef.current = true;
  // Its own reading of the signal: the popup of one card among many, told
  // apart by `value`, follows whether IT is the one open rather than every
  // write the others cause.
  const openedSignal = useMemo(
    () => (signal ? computed(() => readOpened(signal.value, value)) : null),
    [signal, value],
  );
  const openedBySignal = openedSignal ? openedSignal.value : false;
  if (builtRef.current === null) {
    if (isMount && (needsPopupFromMount(props) || open || openedBySignal)) {
      builtRef.current = "mount";
    } else if (open || openedBySignal) {
      builtRef.current = "interaction";
    }
  }
  const [, setBuildCount] = useState(0);
  const pressWarmRef = useRef(null);
  const build = (reason) => {
    if (builtRef.current !== null) {
      return;
    }
    builtRef.current = reason;
    pressWarmRef.current?.();
    pressWarmRef.current = null;
    flushSyncRendering(() => {
      setBuildCount((count) => count + 1);
    });
  };
  const standingIn = builtRef.current === null;
  useEffect(() => {
    if (!standingIn || !anchor) {
      return undefined;
    }
    return warmOnAnchorIntent(anchor, popupRef, () => {
      build("warm");
    });
  }, [standingIn, anchor]);
  useEffect(() => {
    return () => {
      pressWarmRef.current?.();
    };
  }, []);

  const standInProps = {
    "ref": popupRef,
    id,
    "navi-hidden": "",
    "navi-out-of-flow": "",
    "aria-expanded": "false",
    "data-testid": props["data-testid"],
    "onnavi_request_open": (e) => {
      // Built in this same event, and asked again: the opening is the one
      // the popup proper would have had — its source, its anchor, its value.
      build("request");
      const opened = dispatchCustomEvent(
        popupRef.current,
        "navi_request_open",
        e.detail,
      );
      if (!opened) {
        e.preventDefault();
      }
    },
    "onnavi_open_press": (e) => {
      // What the opening will read is asked for at once, as the popup proper
      // does (see open_controller.js); the popup itself once the press is
      // taken for one (see requestBuildOnPress) — the click that follows opens
      // it built, or builds it itself when it comes sooner.
      if (signal) {
        preloadState(signal, readOpenValue(value));
      }
      if (pressWarmRef.current) {
        return;
      }
      pressWarmRef.current = requestBuildOnPress(e, {
        onBuild: () => {
          pressWarmRef.current = null;
          build("warm");
        },
        onGiveUp: () => {
          pressWarmRef.current = null;
        },
      });
    },
  };
  return [builtRef.current, popupRef, standInProps];
};

/**
 * The stand-in of a popup whose owner holds its open controller (see the top
 * comment).
 *
 * @param {object} openController
 * @param {{ ref: {current: Element}, anchor?: any, needed: boolean }} options
 *   `needed`: the owner needs the popup proper now — it is open, or its
 *   content is wanted ahead of any opening; once said, the popup stays built.
 * @returns {[null|"needed"|"open"|"warm", object]} Why the popup proper
 *   exists (`null` while it stands in; "warm" built its content along with
 *   it), and the props of the stand-in element.
 */
export const useControlledPopupStandIn = (
  openController,
  { ref, anchor, needed },
) => {
  const builtRef = useRef(null);
  if (builtRef.current === null && needed) {
    builtRef.current = "needed";
  }
  const [, setBuildCount] = useState(0);
  const pressWarmRef = useRef(null);
  const build = (reason) => {
    if (builtRef.current === null) {
      builtRef.current = reason;
      pressWarmRef.current?.();
      pressWarmRef.current = null;
    }
    setBuildCount((count) => count + 1);
  };
  const standingIn = builtRef.current === null;
  if (standingIn) {
    // Rendered before it returns, even when a warm already asked for the
    // build and its render is still queued: the opening reads the popup
    // proper right after.
    openController.buildPopup = () => {
      flushSyncRendering(() => {
        build("open");
      });
    };
    // The popup proper assigns its own once rendered (see
    // popup_content_mount.js), in renders this one is not always part of:
    // assigned here only while standing in.
    openController.buildContent = () => {
      build("warm");
    };
    openController.onOpeningPress = (openPressEvent) => {
      if (pressWarmRef.current) {
        return;
      }
      pressWarmRef.current = requestBuildOnPress(openPressEvent, {
        onBuild: () => {
          pressWarmRef.current = null;
          build("warm");
        },
        onGiveUp: () => {
          pressWarmRef.current = null;
        },
      });
    };
  } else {
    openController.buildPopup = null;
  }
  useEffect(() => {
    if (!standingIn || !anchor) {
      return undefined;
    }
    return warmOnAnchorIntent(anchor, ref, () => {
      build("warm");
    });
  }, [standingIn, anchor]);
  useEffect(() => {
    return () => {
      pressWarmRef.current?.();
    };
  }, []);

  const standInProps = {
    ref,
    "navi-hidden": "",
    "navi-out-of-flow": "",
    "aria-expanded": "false",
  };
  return [builtRef.current, standInProps];
};

// What needs the popup proper from the start: an opening at mount, content
// built ahead of any opening, a history entry to read.
const needsPopupFromMount = (props) => {
  if (props.defaultOpen || props.navState) {
    return true;
  }
  return props.mount !== undefined && props.mount !== "from-first-open";
};
