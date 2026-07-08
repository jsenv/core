/**
 * A drawer docked flush to a viewport (or container) edge, built on top of
 * `Popup`. Sizing, the perpendicular-axis fill, and the flush-edge
 * border-radius are all resolved by this file's own CSS (keyed off the
 * `navi-side`/`data-layer` attributes) rather than computed in JS — read
 * the CSS block below instead of expecting a JS equivalent of it here.
 *
 * `anchorCustomEventDetail="ignore"` is required, not cosmetic: without it,
 * Popover would dock next to whatever triggered the open instead of flush
 * against the edge, defeating the point of a side panel.
 */
import { Button } from "../control/input/button.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Popup } from "./popup.jsx";

const css = /* css */ `
  .navi_side_panel {
    /* Dialog's own \`min-width: var(--anchor-width, 0px)\` exists so a
       dialog naturally matches whatever triggered it (picker_custom.jsx's
       dialog mode relies on this) — SidePanel's own "anchor" is just its
       container, so this would otherwise force min-width to the full
       container width, overriding \`size\` below entirely. Popover ignores
       this var. */
    --anchor-width: 0px;

    /* Docked-axis size: content-sized by default (the custom property is
       unset unless the \`size\` prop is passed, and var() falls back to
       "auto"), forced via \`size\` otherwise. */
    &[navi-side="left"],
    &[navi-side="right"] {
      width: var(--navi-side-panel-size, auto);
    }
    &[navi-side="top"],
    &[navi-side="bottom"] {
      height: var(--navi-side-panel-size, auto);
    }

    /* layer="top": the container is the viewport itself, so the
       perpendicular axis and the popup's own ceiling both use
       \`--navi-vvh\`/\`--navi-vvw\` (kept in sync with window.visualViewport,
       see navi_css_vars.js) instead of a plain 100%/100dvh, which tracks
       the *layout* viewport instead — that doesn't shrink when e.g. the
       on-screen keyboard opens, unlike the *visible* one. The viewport
       itself has no border-radius to inherit, hence 0 below rather than
       "inherit" (see layer="local" below). */
    &[data-layer="top"] {
      --popover-max-height: var(--navi-vvh);
      --popover-maxmax-height: var(--navi-vvh);
      --popover-maxmax-width: var(--navi-vvw);
      --dialog-maxmax-height: var(--navi-vvh);
      --dialog-maxmax-width: var(--navi-vvw);

      &[navi-side="left"],
      &[navi-side="right"] {
        height: var(--navi-vvh);
      }
      &[navi-side="top"],
      &[navi-side="bottom"] {
        width: var(--navi-vvw);
      }
      &[navi-side="left"] {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      &[navi-side="right"] {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
      &[navi-side="top"] {
        border-top-left-radius: 0;
        border-top-right-radius: 0;
      }
      &[navi-side="bottom"] {
        border-bottom-right-radius: 0;
        border-bottom-left-radius: 0;
      }
    }

    /* layer="local": the container is a real DOM ancestor, so plain 100%
       already tracks it correctly, and the popup's own ceiling is
       neutralized instead — a comfortably large but still valid length,
       not "none": these vars feed a CSS min(), which treats "none" as
       invalid and falls back to its own initial value rather than using
       ours. The real container's own corner may itself be rounded, hence
       "inherit" below rather than 0 (see layer="top" above) — border-radius
       isn't naturally an inherited property, so this must be explicit. */
    &[data-layer="local"] {
      --popover-max-height: 100000px;
      --popover-maxmax-height: 100000px;
      --popover-maxmax-width: 100000px;
      --dialog-maxmax-height: 100000px;
      --dialog-maxmax-width: 100000px;

      &[navi-side="left"],
      &[navi-side="right"] {
        height: 100%;
      }
      &[navi-side="top"],
      &[navi-side="bottom"] {
        width: 100%;
      }
      &[navi-side="left"] {
        border-top-left-radius: inherit;
        border-bottom-left-radius: inherit;
      }
      &[navi-side="right"] {
        border-top-right-radius: inherit;
        border-bottom-right-radius: inherit;
      }
      &[navi-side="top"] {
        border-top-left-radius: inherit;
        border-top-right-radius: inherit;
      }
      &[navi-side="bottom"] {
        border-bottom-right-radius: inherit;
        border-bottom-left-radius: inherit;
      }
    }

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
    /* Kept near (not touching) whichever edge the panel is flush against. */
    &[navi-side="left"] {
      .navi_side_panel_close_button {
        right: auto;
        left: 12px;
      }
    }
    &[navi-side="bottom"] {
      .navi_side_panel_close_button {
        top: auto;
        bottom: 12px;
      }
    }
  }
`;

const SIDE_TO_POSITION_AREA = {
  left: "on-the-left",
  right: "on-the-right",
  top: "above",
  bottom: "below",
};

// Preact doesn't auto-append "px" to bare numeric style values the way React
// does — an unsuffixed number is an invalid CSS length, silently rejected by
// the browser (leaving the property unset instead of sized).
const toCssLength = (value) =>
  value === undefined || value === null
    ? undefined
    : typeof value === "number"
      ? `${value}px`
      : value;

/**
 * @param {object} props
 * @param {boolean} [props.open] - Controlled open state, forwarded as-is to
 *   `Popup`'s own `open`.
 * @param {boolean} [props.defaultOpen] - Uncontrolled, mount-only initial
 *   open state, forwarded as-is to `Popup`. Neither this nor `open` is
 *   required at all for a purely command-driven panel (an `id` plus a
 *   `<Button command="--navi-toggle" commandFor={id}>` elsewhere, same as
 *   `Dialog`/`Popover` themselves — see either's own doc).
 * @param {(event: Event) => void} [props.onClose] - Called when the panel
 *   actually closes (see `Dialog`/`Popover`'s own `onClose`).
 * @param {"left"|"right"|"top"|"bottom"} [props.side="right"] - Which
 *   viewport/container edge the panel is docked flush against.
 * @param {string|number} [props.size] - Size along the docked axis (width
 *   for `left`/`right`, height for `top`/`bottom`) — a bare number is
 *   treated as pixels. Omitted by default: the panel then sizes to its own
 *   content instead of a fixed size (still capped by the popup's own
 *   max-width/max-height, same as `Dialog`/`Popover`). The perpendicular
 *   axis always fills its container regardless (see this file's own CSS).
 * @param {string|number} [props.minSize] - Floor for the docked axis (same
 *   unit rules as `size`) — forwarded as `Popup`'s own `minWidth`/
 *   `minHeight` (whichever matches the docked axis), so a content-sized
 *   panel (no `size` given) never shrinks below this.
 * @param {"top"|"local"} [props.layer="top"] - `"top"` (default): docks
 *   against the viewport (real top-layer rendering, matches a fixed,
 *   always-on-screen drawer). `"local"`: docks against the panel's own
 *   positioned DOM ancestor instead, confined to (and clipped by) it — for
 *   a drawer that only takes over part of the page rather than the whole
 *   viewport.
 * @param {boolean|"fading"} [props.animation] - Off by default (unlike
 *   `Dialog`/`Popover` themselves) — SidePanel is commonly toggled instead
 *   of opened/closed as a one-off, where a slide transition is more often
 *   undesired noise than not. `true` slides in from `side`; `"fading"` is
 *   the other common choice. Other values are forwarded as-is but not a
 *   documented/encouraged part of this component's own API.
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
 *   button (positioned near — but never touching — the flush edge; see
 *   this file's own CSS).
 * @param {"dialog"|"popover"} [props.mode] - Forwarded to `Popup` — forces
 *   one underlying renderer instead of its automatic screen-size
 *   resolution. Note that if `Popup` ends up in dialog mode (small screen,
 *   or forced here), the panel becomes modal regardless of
 *   `closeOnClickOutside`/`pointerInteractionOutsideEffect`: a `<dialog>`
 *   always blocks interaction with the rest of the page one way or another
 *   (see `dialog.jsx`'s own doc) — there is no dialog-mode equivalent of a
 *   popover's fully passive, click-through backdrop.
 * @param {import("preact").ComponentChildren} props.children
 */
export const SidePanel = ({
  open,
  defaultOpen,
  onClose,
  children,
  side = "right",
  size,
  minSize,
  animation,
  closeOnClickOutside = false,
  hideCloseButton = false,
  mode,
  layer = "top",
  className,
  ...rest
}) => {
  import.meta.css = css;
  const positionArea = SIDE_TO_POSITION_AREA[side];
  const isHorizontalDock = side === "left" || side === "right";
  const sizeValue = toCssLength(size);
  const minSizeValue = toCssLength(minSize);

  return (
    <Popup
      mode={mode}
      open={open}
      defaultOpen={defaultOpen}
      onClose={onClose}
      layer={layer}
      anchorCustomEventDetail="ignore"
      positionArea={positionArea}
      animation={animation === true ? `slide-from-${side}` : animation}
      pointerInteractionOutsideEffect={closeOnClickOutside ? "close" : "none"}
      focusCapture={closeOnClickOutside}
      minWidth={isHorizontalDock ? minSizeValue : undefined}
      minHeight={isHorizontalDock ? undefined : minSizeValue}
      className={withPropsClassName("navi_side_panel", className)}
      navi-side={side}
      style={{ "--navi-side-panel-size": sizeValue }}
      {...rest}
    >
      {!hideCloseButton && (
        <Button
          className="navi_side_panel_close_button"
          aria-label="Close panel"
          command="--navi-close"
          navi-autofocus="fallback"
        >
          ×
        </Button>
      )}
      {children}
    </Popup>
  );
};
