import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { useStableCallback } from "../utils/use_stable_callback.js";

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
    /* Reset the UA [popover] defaults (margin: auto, inset: 0, border: solid,
       padding: 0.25em, width/height: fit-content, background: Canvas) so the
       popover behaves like a plain fixed-position wrapper. */
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: auto;
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
    color: inherit;
    background: none;
    border: none;
    pointer-events: none;
    overflow: visible;

    .navi_side_panel_overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      pointer-events: auto;
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

    &[data-closing] {
      .navi_side_panel_dialog {
        animation-name: navi_side_panel_slide_out;
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

  @keyframes navi_side_panel_slide_out {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(100%);
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
  const previousFocusRef = useRef(null);
  const isMountedRef = useRef(false);

  useLayoutEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (isOpen) {
      setPhase("opening");
    } else if (phase !== "closed") {
      setPhase("closing");
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    const panelEl = panelRef.current;
    if (!panelEl) {
      return;
    }
    // "manual" popovers stay hidden (UA default: display: none) until shown —
    // this is what promotes the element into the top layer, replacing the
    // createPortal(..., document.body) this component used to need.
    if (phase !== "closed" && !panelEl.matches(":popover-open")) {
      panelEl.showPopover();
    }
  }, [phase]);

  useLayoutEffect(() => {
    if (phase === "opening" && dialogRef.current) {
      previousFocusRef.current = document.activeElement;
      dialogRef.current.focus();
    }
  }, [phase]);

  useKeyboardShortcuts(dialogRef, [
    {
      key: "escape",
      handler: () => {
        onClose();
        return true;
      },
    },
  ]);

  if (phase === "closed") {
    return null;
  }

  const onAnimationEnd = () => {
    if (phase === "opening") {
      setPhase("open");
    } else if (phase === "closing") {
      setPhase("closed");
      const prev = previousFocusRef.current;
      if (prev && document.contains(prev)) {
        prev.focus({
          preventScroll: true,
        });
      }
      previousFocusRef.current = null;
    }
  };

  return (
    <Box
      ref={panelRef}
      popover="manual"
      baseClassName="navi_side_panel"
      styleCSSVars={SidePanelStyleCSSVars}
      width={width}
      aria-expanded={phase !== "closed" ? "true" : "false"}
      data-opening={phase === "opening" ? "" : undefined}
      data-closing={phase === "closing" ? "" : undefined}
      onnavi_request_close={(e) => {
        onClose(e);
      }}
      {...rest}
    >
      {closeOnClickOutside && (
        <div
          className="navi_side_panel_overlay"
          onClick={(e) => {
            onClose(e);
          }}
        />
      )}
      <Box
        ref={dialogRef}
        baseClassName="navi_side_panel_dialog"
        tabIndex={-1}
        role={closeOnClickOutside ? "dialog" : "complementary"}
        aria-modal={closeOnClickOutside ? "true" : undefined}
        onAnimationEnd={onAnimationEnd}
      >
        {!hideCloseButton && (
          <button
            className="navi_side_panel_close_button"
            aria-label="Close panel"
            onClick={() => onClose()}
          >
            ×
          </button>
        )}
        {children}
      </Box>
    </Box>
  );
};
