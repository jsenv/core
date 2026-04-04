import { createContext } from "preact";
import { createPortal } from "preact/compat";
import { useContext, useEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_side_panel {
      --side-panel-width: 400px;
      --side-panel-background: white;
      --side-panel-shadow: -4px 0 24px rgba(0, 0, 0, 0.18);
      --side-panel-animation-duration: 250ms;
    }
  }

  .navi_side_panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    pointer-events: none;

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

    &[data-opening] .navi_side_panel_dialog {
      animation-name: navi_side_panel_slide_in;
    }

    &[data-closing] .navi_side_panel_dialog {
      animation-name: navi_side_panel_slide_out;
    }
  }

  .navi_side_panel_close_button {
    position: absolute;
    top: 12px;
    right: 12px;
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

const SidePanelCloseContext = createContext(null);
export const useSidePanelClose = () => useContext(SidePanelCloseContext);

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
  const panelDialogRef = useRef(null);
  const [phase, setPhase] = useState(isOpen ? "open" : "closed");
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPhase("opening");
    } else if (phase !== "closed") {
      setPhase("closing");
    }
  }, [isOpen]);

  useEffect(() => {
    if (phase === "opening" && panelDialogRef.current) {
      previousFocusRef.current = document.activeElement;
      panelDialogRef.current.focus();
    }
  }, [phase]);

  useKeyboardShortcuts(panelDialogRef, [
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
    if (phase === "opening") setPhase("open");
    if (phase === "closing") {
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

  return createPortal(
    <SidePanelCloseContext.Provider value={onClose}>
      <Box
        baseClassName="navi_side_panel"
        propsCSSVars={SidePanelStyleCSSVars}
        width={width}
        data-opening={phase === "opening" ? "" : undefined}
        data-closing={phase === "closing" ? "" : undefined}
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
          ref={panelDialogRef}
          baseClassName="navi_side_panel_dialog"
          tabIndex={-1}
          role={closeOnClickOutside ? "dialog" : "complementary"}
          aria-modal={closeOnClickOutside ? "true" : undefined}
          onAnimationEnd={onAnimationEnd}
        >
          {!hideCloseButton && <NaviSidePanelCloseButton />}
          {children}
        </Box>
      </Box>
    </SidePanelCloseContext.Provider>,
    document.body,
  );
};

const NaviSidePanelCloseButton = () => {
  const sidePanelClose = useSidePanelClose();
  return (
    <button
      className="navi_side_panel_close_button"
      aria-label="Close panel"
      onClick={sidePanelClose}
    >
      ×
    </button>
  );
};
