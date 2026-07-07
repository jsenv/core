/**
 * A drawer docked flush to a viewport edge — built entirely on top of
 * `Popup` (which itself picks Popover vs Dialog), relying on capabilities
 * those two already have: `anchor="viewport"` + `anchorArea` for the actual
 * docking (Popover natively, Dialog via its own small anchorArea subset —
 * see dialog.jsx's top comment), the shared `slide-from-*` animation kind,
 * native Escape handling, and Popover/Dialog's own `onClose` prop (so this
 * component doesn't need to own an openController just to observe a
 * self-initiated close).
 *
 * `animation` only applies when explicitly requested — SidePanel doesn't
 * animate by default.
 */
import { Button } from "../control/input/button.jsx";
import { Popup } from "./popup.jsx";

const css = /* css */ `
  .navi_side_panel_close_button {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1; /* sits above the panel's own content */
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
`;

const SIDE_TO_ANCHOR_AREA = {
  left: "on-the-left",
  right: "on-the-right",
  top: "above",
  bottom: "below",
};

export const SidePanel = ({
  isOpen,
  onClose,
  children,
  side = "right",
  // Size along the docked axis (width for left/right, height for top/bottom)
  // — the perpendicular axis is always forced to 100%.
  size = 400,
  animation,
  closeOnClickOutside = false,
  hideCloseButton = false,
  mode,
  style,
  ...rest
}) => {
  import.meta.css = css;
  const anchorArea = SIDE_TO_ANCHOR_AREA[side];
  const isHorizontalDock = side === "left" || side === "right";

  return (
    <Popup
      mode={mode}
      open={isOpen}
      onClose={onClose}
      anchor="viewport"
      anchorArea={anchorArea}
      animation={animation ? `slide-from-${side}` : undefined}
      pointerInteractionOutsideEffect={
        closeOnClickOutside ? "close" : "capture"
      }
      focusCapture={closeOnClickOutside}
      style={{
        ...style,
        // Popover/Dialog both reserve a soft margin/cap around their own
        // popup by default (Popover's 300px --popover-max-height, its 0.95×
        // viewport --popover-maxmax-height/width hard ceiling, Dialog's
        // --dialog-viewport-spacing gap and matching --dialog-maxmax-*) —
        // all meant for a centered/dropdown-sized popup, none of which makes
        // sense once docked flush to an edge. Overridden regardless of
        // which of the two Popup actually renders; each ignores the
        // variable that isn't its own.
        "--popover-max-height": "100dvh",
        "--popover-maxmax-height": "100dvh",
        "--popover-maxmax-width": "100dvw",
        "--dialog-maxmax-height": "100dvh",
        "--dialog-maxmax-width": "100dvw",
        "--dialog-viewport-spacing": "0",
        "width": isHorizontalDock ? size : "100%",
        "height": isHorizontalDock ? "100%" : size,
      }}
      {...rest}
    >
      {!hideCloseButton && (
        <Button
          className="navi_side_panel_close_button"
          aria-label="Close panel"
          command="--navi-close"
        >
          ×
        </Button>
      )}
      {children}
    </Popup>
  );
};
