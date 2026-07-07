/**
 * A drawer docked flush to a viewport edge — built entirely on top of
 * `Popup` (which itself picks Popover vs Dialog), relying on capabilities
 * those two already have: `layer="top"` (Popover's default, set explicitly
 * here for clarity) + `anchorCustomEventDetail="ignore"` + `positionArea`
 * for the actual docking (Popover natively, Dialog via its own small
 * positionArea subset — see dialog.jsx's top comment), the shared
 * `slide-from-*` animation kind, native Escape handling, and Popover/
 * Dialog's own `onClose` prop (so this component doesn't need to own an
 * openController just to observe a self-initiated close).
 * `anchorCustomEventDetail="ignore"` matters here specifically: without it,
 * Popover would use the triggering button as a real anchor whenever one is
 * available, docking the panel next to *it* instead of flush against the
 * viewport edge — the opposite of what a side panel is for.
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

const SIDE_TO_POSITION_AREA = {
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
  const positionArea = SIDE_TO_POSITION_AREA[side];
  const isHorizontalDock = side === "left" || side === "right";
  // Preact doesn't auto-append "px" to bare numeric style values the way
  // React does — an unsuffixed number is an invalid CSS length, silently
  // rejected by the browser (leaving width/height unset instead of sized).
  const sizeValue = typeof size === "number" ? `${size}px` : size;

  return (
    <Popup
      mode={mode}
      open={isOpen}
      onClose={onClose}
      layer="top"
      anchorCustomEventDetail="ignore"
      positionArea={positionArea}
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
        // Dialog's own `min-width: var(--anchor-width, 0px)` exists so a
        // dialog naturally matches the width of whatever triggered it
        // (picker_custom.jsx's dialog mode relies on this) — SidePanel's own
        // "anchor" is just the viewport itself, so --anchor-width would
        // otherwise force min-width to the full viewport width, overriding
        // `size` below entirely.
        "--anchor-width": "0px",
        "width": isHorizontalDock ? sizeValue : "100%",
        "height": isHorizontalDock ? "100%" : sizeValue,
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
