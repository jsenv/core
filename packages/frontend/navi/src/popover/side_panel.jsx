import { createPortal } from "preact/compat";
import { useEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_side_panel {
      --side-panel-width: 400px;
      --side-panel-background: white;
      --side-panel-shadow: -4px 0 24px rgba(0, 0, 0, 0.18);
    }
  }

  .navi_side_panel {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.3);

    .navi_side_panel_dialog {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: var(--side-panel-width);
      background: var(--side-panel-background);
      outline: none;
      box-shadow: var(--side-panel-shadow);
      overflow-y: auto;
    }
  }
`;

export const SidePanel = ({ isOpen, onClose, children, ...rest }) => {
  const panelDialogRef = useRef(null);

  useEffect(() => {
    if (isOpen && panelDialogRef.current) {
      panelDialogRef.current.focus();
    }
  }, [isOpen]);

  useKeyboardShortcuts(panelDialogRef, [
    {
      key: "escape",
      handler: () => {
        onClose();
        return true;
      },
    },
  ]);

  if (!isOpen) {
    return null;
  }

  const naviSidePanel = (
    <Box
      baseClassName="navi_side_panel"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      {...rest}
    >
      <Box
        ref={panelDialogRef}
        baseClassName="navi_side_panel_dialog"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </Box>
    </Box>
  );

  return createPortal(naviSidePanel, document.body);
};
