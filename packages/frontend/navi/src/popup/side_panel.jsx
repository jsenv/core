/**
 * A drawer docked flush to a viewport (or container) edge — built entirely
 * on top of `Popup` (which itself picks Popover vs Dialog), relying on
 * capabilities those two already have: `layer` + `anchorCustomEventDetail="ignore"`
 * + `positionArea` for the actual docking (Popover natively, Dialog via its
 * own small positionArea subset — see dialog.jsx's top comment), the shared
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
 *
 * The perpendicular axis (the one *not* along `size`) is always forced to
 * fill its container, but *how* depends on `layer`: with `layer="top"`
 * (default) the container is the viewport itself, so `--navi-vvh`/
 * `--navi-vvw` (kept in sync with `window.visualViewport`, see
 * navi_css_vars.js) are used instead of a plain `100%`/`100dvh` — a plain
 * percentage there would resolve against the top layer's own initial
 * containing block (the *layout* viewport), which doesn't shrink when e.g.
 * the on-screen keyboard opens, unlike the *visible* one. With
 * `layer="local"` the container is a real DOM ancestor, so plain `100%`
 * already tracks it correctly — the popup's own default max-height/
 * max-width ceiling (meant for a centered/dropdown-sized popup) is instead
 * just removed, since that ancestor's own size is already the true limit.
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

/**
 * @param {object} props
 * @param {boolean} props.isOpen - Controlled open state (mapped to `Popup`'s
 *   own `open`).
 * @param {(event: Event) => void} [props.onClose] - Called when the panel
 *   actually closes (see `Dialog`/`Popover`'s own `onClose`).
 * @param {"left"|"right"|"top"|"bottom"} [props.side="right"] - Which
 *   viewport/container edge the panel is docked flush against.
 * @param {string|number} [props.size=400] - Size along the docked axis
 *   (width for `left`/`right`, height for `top`/`bottom`) — a bare number is
 *   treated as pixels. The perpendicular axis always fills its container
 *   (see this file's top comment for how, and why that differs by `layer`).
 * @param {"top"|"local"} [props.layer="top"] - `"top"` (default): docks
 *   against the viewport (real top-layer rendering, matches a fixed,
 *   always-on-screen drawer). `"local"`: docks against the panel's own
 *   positioned DOM ancestor instead, confined to (and clipped by) it — for
 *   a drawer that only takes over part of the page rather than the whole
 *   viewport.
 * @param {boolean|"auto"|`slide-from-${string}`} [props.animation] - Off by
 *   default (unlike `Dialog`/`Popover` themselves) — SidePanel is commonly
 *   toggled instead of opened/closed as a one-off, where a slide transition
 *   is more often undesired noise than not. Pass `true`/`"auto"` (resolves
 *   to `slide-from-${side}`) or an explicit direction to opt in.
 * @param {boolean} [props.closeOnClickOutside=false] - `false` (default):
 *   maps to `pointerInteractionOutsideEffect="none"` — in popover mode, no
 *   backdrop at all, outside clicks pass straight through; in dialog mode,
 *   the outside click is still absorbed (a `<dialog>` always blocks
 *   interaction with the rest of the page one way or another — see
 *   `dialog.jsx`'s own doc) but with no dimming effect. `true`: closes the
 *   panel on an outside click instead, and also enables trapping Tab
 *   navigation inside the panel (`focusCapture`) — closing on outside
 *   interaction only makes sense paired with not letting focus silently
 *   leave the panel first.
 * @param {boolean} [props.hideCloseButton=false] - Omits the built-in ×
 *   button in the panel's own top-right corner.
 * @param {"dialog"|"popover"} [props.mode] - Forwarded to `Popup` — forces
 *   one underlying renderer instead of its automatic screen-size
 *   resolution. Note that if `Popup` ends up in dialog mode (small screen,
 *   or forced here), the panel becomes modal regardless of
 *   `closeOnClickOutside`/`pointerInteractionOutsideEffect`: a `<dialog>`
 *   always blocks interaction with the rest of the page one way or another
 *   (see `dialog.jsx`'s own doc) — there is no dialog-mode equivalent of a
 *   popover's fully passive, click-through backdrop.
 * @param {object} [props.style] - Merged with (and overridden by) this
 *   component's own sizing styles below.
 * @param {import("preact").ComponentChildren} props.children
 */
export const SidePanel = ({
  isOpen,
  onClose,
  children,
  side = "right",
  size = 400,
  animation,
  closeOnClickOutside = false,
  hideCloseButton = false,
  mode,
  layer = "top",
  style,
  ...rest
}) => {
  import.meta.css = css;
  const positionArea = SIDE_TO_POSITION_AREA[side];
  const isHorizontalDock = side === "left" || side === "right";
  const isTopLayer = layer === "top";
  // Preact doesn't auto-append "px" to bare numeric style values the way
  // React does — an unsuffixed number is an invalid CSS length, silently
  // rejected by the browser (leaving width/height unset instead of sized).
  const sizeValue = typeof size === "number" ? `${size}px` : size;
  // See this file's top comment for why this differs by layer: the
  // viewport itself (layer="top") needs the visual-viewport-synced vars,
  // a real DOM ancestor (layer="local") already works with a plain 100%.
  const perpendicularSize = isTopLayer
    ? `var(${isHorizontalDock ? "--navi-vvh" : "--navi-vvw"})`
    : "100%";
  const perpendicularMaxProp = isHorizontalDock ? "maxHeight" : "maxWidth";

  return (
    <Popup
      mode={mode}
      open={isOpen}
      onClose={onClose}
      layer={layer}
      anchorCustomEventDetail="ignore"
      positionArea={positionArea}
      animation={animation ? `slide-from-${side}` : undefined}
      pointerInteractionOutsideEffect={closeOnClickOutside ? "close" : "none"}
      focusCapture={closeOnClickOutside}
      style={{
        ...style,
        ...(isTopLayer
          ? // Popover/Dialog both reserve a soft margin/cap around their own
            // popup by default (Popover's 300px --popover-max-height, its
            // 0.95x-visible-viewport --popover-maxmax-height/width hard
            // ceiling, Dialog's --dialog-viewport-spacing gap and matching
            // --dialog-maxmax-*) — all meant for a centered/dropdown-sized
            // popup, none of which makes sense once docked flush to a
            // viewport edge. Overridden regardless of which of the two
            // Popup actually renders; each ignores the variable that isn't
            // its own. `--navi-vvh`/`--navi-vvw` (not `100dvh`/`100dvw`,
            // which shares plain percentages' layout-viewport blind spot)
            // so this stays accurate when the visible viewport shrinks
            // (on-screen keyboard, mobile browser chrome).
            {
              "--popover-max-height": "var(--navi-vvh)",
              "--popover-maxmax-height": "var(--navi-vvh)",
              "--popover-maxmax-width": "var(--navi-vvw)",
              "--dialog-maxmax-height": "var(--navi-vvh)",
              "--dialog-maxmax-width": "var(--navi-vvw)",
            }
          : // The panel is confined to (and clipped by) a real DOM ancestor
            // here, not the viewport — that ancestor's own size is already
            // the true limit, so the popup's own ceiling (meant for a
            // viewport-relative popup) is just removed instead.
            { [perpendicularMaxProp]: "none" }),
        // Dialog's own `min-width: var(--anchor-width, 0px)` exists so a
        // dialog naturally matches the width of whatever triggered it
        // (picker_custom.jsx's dialog mode relies on this) — SidePanel's own
        // "anchor" is just its container, so --anchor-width would otherwise
        // force min-width to the full container width, overriding `size`
        // below entirely.
        "--anchor-width": "0px",
        "width": isHorizontalDock ? sizeValue : perpendicularSize,
        "height": isHorizontalDock ? perpendicularSize : sizeValue,
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
