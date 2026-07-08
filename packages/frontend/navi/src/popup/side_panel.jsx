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
       container width, overriding \`width\`/\`height\` below entirely. Popover
       ignores this var. */
    --anchor-width: 0px;
    /* Side panel create a barriere with the content that is full size */
    /* So by default they don't have border-radius */
    --popup-border-radius: 0px;

    /* Content-sized by default (each custom property is unset unless the
       matching \`width\`/\`height\` prop is passed, and var() falls back to
       "auto") — forced otherwise. Both set unconditionally regardless of
       \`side\`: whichever axis isn't the docked one gets overridden again
       below by the perpendicular-fill rules, at higher specificity, unless
       the corresponding prop was actually passed (see there for why an
       explicit value still wins even on that axis). */
    width: var(--navi-side-panel-width, auto);
    height: var(--navi-side-panel-height, auto);

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
        /* An explicit \`height\` prop still wins here (see the base rule
           above) — only the fallback (no \`height\` given) differs by layer. */
        height: var(--navi-side-panel-height, var(--navi-vvh));
      }
      &[navi-side="top"],
      &[navi-side="bottom"] {
        width: var(--navi-side-panel-width, var(--navi-vvw));
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
       already tracks it correctly on the perpendicular axis — the popup's
       own ceiling there is neutralized instead (a comfortably large but
       still valid length, not "none": these vars feed a CSS min(), which
       treats "none" as invalid and falls back to its own initial value
       rather than using ours). The *docked* axis keeps a real ceiling
       though (90% of the container, a percentage resolving correctly here
       since the popup's own containing block, .navi_popover_clip_wrapper/
       .navi_dialog_clip_wrapper, is inset: 0 within that same container) —
       an oversized explicit width/height prop should shrink to fit rather
       than overflow the container or force it to scroll. The real
       container's own corner may itself be rounded, hence "inherit" below
       rather than 0 (see layer="top" above) — border-radius isn't
       naturally an inherited property, so this must be explicit. */
    &[data-layer="local"] {
      &[navi-side="left"],
      &[navi-side="right"] {
        --popover-maxmax-height: 100000px;
        --dialog-maxmax-height: 100000px;
        --popover-max-height: 100000px;
        --popover-maxmax-width: 90%;
        --dialog-maxmax-width: 90%;
        height: var(--navi-side-panel-height, 100%);
      }
      &[navi-side="top"],
      &[navi-side="bottom"] {
        --popover-maxmax-width: 100000px;
        --dialog-maxmax-width: 100000px;
        --popover-maxmax-height: 90%;
        --dialog-maxmax-height: 90%;
        --popover-max-height: 90%;
        width: var(--navi-side-panel-width, 100%);
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

    /* Sticky regardless of side: the panel's own content always stacks
       (and scrolls) top-to-bottom, whether the panel itself is docked to
       the left/right or the top/bottom of the viewport/container — so
       "top" for the head and "bottom" for the foot are the right offsets
       either way, not something that needs to vary with navi-side. Each
       needs its own opaque background since scrollable content otherwise
       shows through underneath while stuck. */
    .navi_side_panel_head,
    .navi_side_panel_foot {
      position: sticky;
      z-index: 1;
      padding: 12px 16px;
      background-color: var(--navi-popup-background-color);
    }
    .navi_side_panel_head {
      top: 0;
      border-bottom: 1px solid var(--navi-popup-border-color);
    }
    .navi_side_panel_foot {
      bottom: 0;
      border-top: 1px solid var(--navi-popup-border-color);
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
 * @param {string|number} [props.width] - Explicit width — a bare number is
 *   treated as pixels. Relevant for a `left`/`right` panel (its docked
 *   axis); omitted by default, so the panel sizes to its own content there
 *   (still capped by the popup's own max-width, same as `Dialog`/
 *   `Popover`). For a `top`/`bottom` panel (where width is the
 *   perpendicular axis, normally filling the container) passing this
 *   overrides that fill instead — `side` isn't expected to change at
 *   runtime, so there's no need to guard against the "wrong axis" case.
 * @param {string|number} [props.height] - Same as `width`, for the other
 *   axis: docked (content-sized by default) for `top`/`bottom`,
 *   perpendicular (container-filling by default) for `left`/`right`.
 * @param {string|number} [props.minWidth] - Forwarded as-is to `Popup`'s
 *   own `minWidth`.
 * @param {string|number} [props.minHeight] - Forwarded as-is to `Popup`'s
 *   own `minHeight`.
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
  width,
  height,
  minWidth,
  minHeight,
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
      minWidth={toCssLength(minWidth)}
      minHeight={toCssLength(minHeight)}
      className={withPropsClassName("navi_side_panel", className)}
      navi-side={side}
      style={{
        "--navi-side-panel-width": toCssLength(width),
        "--navi-side-panel-height": toCssLength(height),
      }}
      {...rest}
    >
      {!hideCloseButton && (
        <Button
          className="navi_side_panel_close_button"
          aria-label="Close panel"
          command="--navi-close"
          autoFocus="fallback"
        >
          ×
        </Button>
      )}
      {children}
    </Popup>
  );
};

/**
 * Stuck to the top of the panel's own scrollable area (`position: sticky`)
 * regardless of `side` — only the panel's content in between scrolls.
 *
 * @param {object} props
 * @param {string} [props.className] - Merged with the shared
 *   `"navi_side_panel_head"` class this file's own CSS targets.
 * @param {import("preact").ComponentChildren} props.children
 */
const SidePanelHead = ({ className, ...rest }) => (
  <div
    className={withPropsClassName("navi_side_panel_head", className)}
    {...rest}
  />
);
SidePanel.Head = SidePanelHead;

/**
 * Stuck to the bottom of the panel's own scrollable area (`position:
 * sticky`) regardless of `side` — only the panel's content above scrolls.
 *
 * @param {object} props
 * @param {string} [props.className] - Merged with the shared
 *   `"navi_side_panel_foot"` class this file's own CSS targets.
 * @param {import("preact").ComponentChildren} props.children
 */
const SidePanelFoot = ({ className, ...rest }) => (
  <div
    className={withPropsClassName("navi_side_panel_foot", className)}
    {...rest}
  />
);
SidePanel.Foot = SidePanelFoot;
