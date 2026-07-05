import { chainEvent, findEvent } from "@jsenv/dom";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { useStableCallback } from "../utils/use_stable_callback.js";
import { Popover } from "./popover.jsx";

const css = /* css */ `
  @layer navi {
    .navi_side_panel {
      --side-panel-width: 400px;
      --side-panel-background: white;
      --side-panel-shadow: -4px 0 24px rgba(0, 0, 0, 0.18);
      --side-panel-animation-duration: 250ms;
    }
  }

  .navi_side_panel {
    /* Popover.jsx positions itself relative to an anchor (inline top/left,
       recomputed via ResizeObserver/positionPopover). The side panel has no
       anchor — it always docks full-height to the right edge — so override
       with !important to win over those inline styles. */
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    left: auto !important;
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
    color: inherit;
    background: none;
    border: none;
    pointer-events: none;
    overflow: visible;

    /* Popover's own backdrop always becomes pointer-events:auto while open,
       which would block interaction with the rest of the page. Restore
       click-through unless the panel is acting as a modal. */
    &:not([data-close-on-click-outside]) .navi_popover_backdrop {
      pointer-events: none !important;
    }

    .navi_side_panel_dialog {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: var(--side-panel-width);
      background: var(--side-panel-background);
      outline: none;
      box-shadow: var(--side-panel-shadow);
      animation-duration: var(--side-panel-animation-duration);
      animation-timing-function: ease-out;
      animation-fill-mode: both;
      pointer-events: auto;
      overflow-y: auto;
    }

    &[data-opening] {
      .navi_side_panel_dialog {
        animation-name: navi_side_panel_slide_in;
      }
    }
  }

  .navi_side_panel_close_button {
    position: absolute;
    top: 12px;
    right: 12px;

    z-index: 1; /* For some reason required to interact properly with the button */
    display: flex;
    width: 28px;
    height: 28px;
    padding: 0;
    align-items: center;
    justify-content: center;
    color: #6c757d;
    font-size: 18px;
    line-height: 1;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      color: #212529;
      background: #f0f0f0;
    }
  }

  @keyframes navi_side_panel_slide_in {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
`;

const SidePanelStyleCSSVars = {
  width: "--side-panel-width",
};

export const SidePanel = ({
  isOpen,
  onClose,
  children,
  closeOnClickOutside = false,
  hideCloseButton = false,
  width,
  ...rest
}) => {
  import.meta.css = css;
  onClose = useStableCallback(onClose);
  const panelRef = useRef(null);
  const dialogRef = useRef(null);
  const [phase, setPhase] = useState(isOpen ? "open" : "closed");
  const isMountedRef = useRef(false);

  // openController centralizes open/close decision-making (focus transfer on
  // open via Popover, focus restore on close here) — same contract as
  // picker_custom.jsx's controller, duplicated for now.
  const openController = useOpenController((openEvent) => {
    const focusedBeforeOpen = openEvent.detail.focusedBeforeOpen;
    return {
      onRequestClose: () => {
        // The side panel never denies a close request.
      },
      onClose: (closeEvent) => {
        setPhase("closed");
        onClose(closeEvent);
        if (focusedBeforeOpen && document.contains(focusedBeforeOpen)) {
          focusedBeforeOpen.focus({ preventScroll: true });
        }
      },
    };
  });

  useLayoutEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      if (isOpen) {
        openController.open(new CustomEvent("open_on_mount", { detail: {} }));
      }
      return;
    }
    if (isOpen === openController.opened) {
      return;
    }
    if (isOpen) {
      setPhase("opening");
      openController.open(new CustomEvent("open_by_prop", { detail: {} }));
    } else {
      openController.requestClose(
        new CustomEvent("close_by_prop", { detail: {} }),
        { isCancel: true },
      );
    }
  }, [isOpen]);

  useKeyboardShortcuts(dialogRef, [
    {
      key: "escape",
      handler: (e) => {
        openController.requestClose(e, { isCancel: true });
        return true;
      },
    },
  ]);

  const onAnimationEnd = () => {
    if (phase === "opening") {
      setPhase("open");
    }
  };

  return (
    <Popover
      ref={panelRef}
      openController={openController}
      className="navi_side_panel"
      styleCSSVars={SidePanelStyleCSSVars}
      width={width}
      pointerTrap={!closeOnClickOutside}
      focusTrap={closeOnClickOutside}
      autoFocus="fallback"
      aria-expanded={phase !== "closed" ? "true" : "false"}
      data-opening={phase === "opening" ? "" : undefined}
      data-close-on-click-outside={closeOnClickOutside ? "" : undefined}
      onnavi_request_close={(e) => {
        openController.requestClose(e, { isCancel: e.detail?.isCancel });
      }}
      {...rest}
    >
      <div
        ref={dialogRef}
        className="navi_side_panel_dialog"
        tabIndex={-1}
        role={closeOnClickOutside ? "dialog" : "complementary"}
        aria-modal={closeOnClickOutside ? "true" : undefined}
        onAnimationEnd={onAnimationEnd}
      >
        {!hideCloseButton && (
          <button
            className="navi_side_panel_close_button"
            aria-label="Close panel"
            onClick={(e) => openController.requestClose(e, { isCancel: true })}
          >
            ×
          </button>
        )}
        {children}
      </div>
    </Popover>
  );
};

// Duplicated from picker_custom.jsx's useOpenController/createOpenController.
// Owns open/close lifecycle for a Popover-backed popup: guards against
// duplicate requests, runs Popover's openEffect (showPopover, focus
// transfer, traps, positioning) and the side panel's own onClose reaction
// (focus restore) in the right order.
const useOpenController = (openHandler) => {
  const stableOpenHandler = useStableCallback(openHandler);
  const controllerRef = useRef(null);
  if (!controllerRef.current) {
    controllerRef.current = createOpenController(stableOpenHandler);
  }
  useLayoutEffect(() => {
    return () => {
      controllerRef.current.close();
    };
  }, []);
  return controllerRef.current;
};

const createOpenController = (openHandler) => {
  let closeHandlers = null;
  let openEffectCleanup = null;
  const performClose = (closeEvent) => {
    controller.opened = false;
    // Sync the DOM closed first (releasing the focus trap) — only then run
    // the side panel's own reaction (onClose may restore focus to an element
    // outside the popup, which the focus trap would otherwise fight while
    // still active).
    openEffectCleanup?.(closeEvent);
    openEffectCleanup = null;
    closeHandlers?.onClose?.(closeEvent);
    closeHandlers = null;
  };
  const controller = {
    opened: false,
    openEffect: null,
    open: (e, detail) => {
      if (controller.opened || !controller.openEffect) {
        return;
      }
      const requestOpenEvent = new CustomEvent("navi_request_open", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestOpenEvent, e);
      controller.opened = true;
      openEffectCleanup = controller.openEffect(requestOpenEvent) || null;
      closeHandlers = openHandler(requestOpenEvent) || null;
    },
    requestClose: (
      e = new CustomEvent("programmatic", { detail: {} }),
      detail,
    ) => {
      if (!controller.opened) {
        return;
      }
      const requestCloseEvent = new CustomEvent("navi_request_close", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestCloseEvent, e);
      closeHandlers?.onRequestClose?.(requestCloseEvent);
      if (requestCloseEvent.defaultPrevented) {
        const nativeCancelEvent = findEvent(requestCloseEvent, "cancel");
        if (nativeCancelEvent) {
          nativeCancelEvent.preventDefault();
        }
        return;
      }
      performClose(requestCloseEvent);
    },
    close: (e = new CustomEvent("programmatic", { detail: {} }), detail) => {
      if (!controller.opened) {
        return;
      }
      const closeEvent = new CustomEvent("navi_close", {
        detail: { event: e, ...detail },
      });
      chainEvent(closeEvent, e);
      performClose(closeEvent);
    },
  };
  return controller;
};
