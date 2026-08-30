import { performTabNavigation } from "@jsenv/dom";
import { useContext, useEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { resolveSpacingSize } from "@jsenv/navi/src/box/box_style_util.js";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { MaxLinesContext } from "@jsenv/navi/src/text/max_lines_context.js";
import { Icon, Text } from "@jsenv/navi/src/text/text.jsx";
import { compareTwoJsValues } from "@jsenv/navi/src/utils/compare_two_js_values.js";
import { renderSafe } from "@jsenv/navi/src/utils/render_safe.js";
import {
  ControlIdContext,
  ControlNameContext,
  ReadOnlyContext,
} from "../control_context.js";
import {
  ControlFacadeChildrenWrapper,
  useControlFacadeProps,
} from "../control_hooks.jsx";
import { getUIStateControllerById } from "../controller_registry.js";
import { uiStateHoldsNothing } from "../ui_state_controller.js";
import { Button } from "../input/button.jsx";
import { resolveInputProps } from "../input/resolve_input_props.js";
import { useAutoSelectReadOnly } from "../input/use_autoselect_read_only.js";
import { createOpenToken } from "../rules/control_callout.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import {
  dispatchRequestClearUIState,
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "../ui_state_dom.js";
import { PickerConfirmResolver } from "./picker_confirm.jsx";
import { PickerContext } from "./picker_context.jsx";
import { PickerCustomResolver } from "./picker_custom.jsx";
import { PickerPresetResolver } from "./picker_preset.jsx";
import {
  PickerArrayUI,
  PickerChip,
  PickerColorUI,
  PickerObjectUI,
  PickerDatetimeUI,
  PickerDateUI,
  PickerDurationUI,
  PickerFileUI,
  PickerTimeUI,
  PickerTypeResolver,
  PickerWeekUI,
} from "./picker_types.jsx";
import { CalendarSvg } from "../../graphic/icons/calendar_svg.jsx";
import { ClockSvg } from "../../graphic/icons/clock_svg.jsx";
import { ColorSvg } from "../../graphic/icons/color_svg.jsx";
import { DurationSvg } from "../../graphic/icons/duration_svg.jsx";
import { FileSvg } from "../../graphic/icons/file_svg.jsx";
import { PencilSvg } from "../../graphic/icons/pencil_svg.jsx";

const css = /* css */ `
  @layer navi {
    .navi_picker {
      --picker-border-radius: var(--navi-control-border-radius);
      --picker-border-width: var(--navi-control-border-width);
      /* Focus outline */
      --picker-outline-width: var(--navi-focus-outline-width);
      --picker-outline-offset: calc(-0.5 * var(--picker-outline-width));
      --picker-outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --picker-padding-x-default: var(--navi-picker-padding-x-default);
      --picker-padding-y-default: var(--navi-picker-padding-y-default);
      --picker-font-size: var(--navi-control-font-size);
      --picker-font-family: var(--navi-control-font-family);
      --picker-loader-color: var(--navi-loader-color);
      --picker-border-color: var(--navi-control-border-color);
      --picker-background-color: white;
      --picker-color: currentColor;
      --picker-placeholder-color: var(--navi-placeholder-color);
      --picker-placeholder-font-style: var(--navi-placeholder-font-style);
      --picker-color-dimmed: color-mix(in srgb, currentColor 60%, transparent);
      /* Hover */
      --picker-border-color-hover: color-mix(
        in srgb,
        var(--picker-border-color) 70%,
        black
      );
      --picker-background-color-hover: color-mix(
        in srgb,
        var(--picker-background-color) 95%,
        black
      );
      /* Readonly */
      --picker-border-color-readonly: color-mix(
        in srgb,
        var(--picker-border-color) 45%,
        transparent
      );
      --picker-background-color-readonly: var(--picker-background-color);
      --picker-color-readonly: var(--picker-color-dimmed);
      /* Disabled */
      --picker-border-color-disabled: var(--picker-border-color-readonly);
      --picker-background-color-disabled: color-mix(
        in srgb,
        var(--picker-background-color) 95%,
        grey
      );
      --picker-color-disabled: var(--picker-color-dimmed);
      /* Icon */
      --picker-icon-color: #5e4e4e;
      --picker-icon-color-readonly: color-mix(
        in srgb,
        var(--picker-icon-color) 45%,
        transparent
      );
      --picker-icon-color-disabled: var(--picker-icon-color-readonly);
      /* Where the slots sit INSIDE the box, visible only once the box is bigger
         than what it holds (a width/height the caller gave it). Distinct from
         textAlign, which places the text inside the value slot; this places the
         slots themselves. */
      --picker-align-x-default: flex-start;
      --picker-align-y-default: center;
    }
  }

  .navi_picker {
    --x-picker-background-color: var(--picker-background-color);
    --x-picker-border-color: var(--picker-border-color);
    --x-picker-padding-top: var(
      --picker-padding-top,
      var(
        --picker-padding-y,
        var(--picker-padding, var(--picker-padding-y-default))
      )
    );
    --x-picker-padding-right: var(
      --picker-padding-right,
      var(
        --picker-padding-x,
        var(--picker-padding, var(--picker-padding-x-default))
      )
    );
    --x-picker-padding-left: var(
      --picker-padding-left,
      var(
        --picker-padding-x,
        var(--picker-padding, var(--picker-padding-x-default))
      )
    );
    --x-picker-padding-bottom: var(
      --picker-padding-bottom,
      var(
        --picker-padding-y,
        var(--picker-padding, var(--picker-padding-y-default))
      )
    );
    --x-picker-color: var(--picker-color);
    --x-picker-icon-color: var(--picker-icon-color);
    --x-picker-align-x: var(--picker-align-x, var(--picker-align-x-default));
    --x-picker-align-y: var(--picker-align-y, var(--picker-align-y-default));

    /* Deliberately NOT positioned: the popup children live in here, and a
       layer="local" Popover/Dialog takes its nearest positioned ancestor as
       containing block — the trigger would cap it at the height of one line and
       clip it. Everything that needs a containing block (the custom-UI input
       overlay, the loading outline) lives in .navi_picker_box below instead.
       This element stays a real box so the sizing props a caller puts on the
       picker (minWidth, expandX…) still apply; the box just fills it. */
    display: inline-flex;
    box-sizing: border-box;
    max-width: 100%;
    /* Inherited properties stay here: a caller's own size/color lands on this
       element, and re-declaring them on the box below would override what it
       would otherwise inherit. */
    color: var(--x-picker-color);
    font-size: var(--picker-font-size);
    font-family: var(--picker-font-family);
    text-align: inherit;
    /* The control line, like the control font: a picker is drawn by hand next
       to inputs that sit on it, and its box is sized in lh — the same number
       of pixels, or a picker and an input in one row are not the same height
       and their text is not on the same row. */
    line-height: var(--navi-control-line-height);
    /* The frame is drawn by the box, but its radius is declared here, on the
       control root, like every other navi control does — so anything styling
       the picker from the outside (a Group squaring the corners it joins) has
       one element to talk to, and the box follows.
       Corner by corner rather than as the shorthand: a picker is not always
       the member a Group joins — it can arrive wrapped (in a Box carrying a
       state, in a link, in a tooltip), and the ask then travels down as
       inherited custom properties instead of landing on this element as a
       radius. Each corner falls back to the picker's own radius when nothing
       asks for anything. */
    border-top-left-radius: var(
      --x-corner-top-left-radius,
      var(--picker-border-radius)
    );
    border-top-right-radius: var(
      --x-corner-top-right-radius,
      var(--picker-border-radius)
    );
    border-bottom-right-radius: var(
      --x-corner-bottom-right-radius,
      var(--picker-border-radius)
    );
    border-bottom-left-radius: var(
      --x-corner-bottom-left-radius,
      var(--picker-border-radius)
    );

    .navi_picker_box {
      /* The ask stops here: this element is the picker's frame, so nothing it
         holds is at the seam — the chevron and the clear cross in the slot, a
         button in a custom UI. */
      --x-corner-top-left-radius: initial;
      --x-corner-top-right-radius: initial;
      --x-corner-bottom-right-radius: initial;
      --x-corner-bottom-left-radius: initial;

      position: relative;
      display: inline-flex;
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
      min-height: calc(
        1lh + var(--x-picker-padding-top) + var(--x-picker-padding-bottom)
      );
      padding-top: var(--x-picker-padding-top);
      padding-right: 0;
      padding-bottom: var(--x-picker-padding-bottom);
      padding-left: 0;
      flex: 1 1 auto;
      flex-direction: row;
      align-items: var(--x-picker-align-y);
      justify-content: var(--x-picker-align-x);
      background-color: var(--x-picker-background-color);
      border-width: var(--picker-border-width);
      border-style: solid;
      border-color: var(--x-picker-border-color);
      border-radius: inherit;
      outline-width: var(--picker-outline-width);
      outline-style: none;
      outline-color: var(--picker-outline-color);
      outline-offset: var(--picker-outline-offset);
      cursor: var(--x-picker-cursor, pointer);
      pointer-events: auto;
      /* user-select: none; */
      -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);
    }

    .navi_picker_value {
      display: inline-block;
      min-width: 0;
      max-width: 100%;
      margin-top: calc(-1 * var(--x-picker-padding-top));
      margin-bottom: calc(-1 * var(--x-picker-padding-bottom));
      padding-top: var(--x-picker-padding-top);
      padding-right: var(--x-picker-padding-right);
      padding-bottom: var(--x-picker-padding-bottom);
      padding-left: var(--x-picker-padding-left);
      flex-grow: 1;
      justify-content: inherit;
      pointer-events: none;
      user-select: none;

      /* The value the picker draws itself is the control's own text, at the
         control's font size: it keeps the control line, snapped to the pixel
         like the field around it. A caller's "ui" is the caller's own drawing
         of the control, and it is written on the page's line, as the number,
         so each text it holds keeps a line relative to its own size. The
         control line is a length (--navi-control-line-height), and inherited
         it would arrive as the control's pixels: a 14px label under an 18px
         picker's 23px line carries ~5px of leading above and below that no
         glyph occupies and nothing on screen explains. Same reason a popup
         takes the number — see .navi_popup in popup.jsx. */
      &[data-picker-facade] {
        line-height: var(--navi-line-height);
      }

      &[navi-placeholder] {
        color: var(--picker-placeholder-color);
        font-style: var(--picker-placeholder-font-style);
      }

      /* A <BadgeList> caps its own rows: it renders the badges that fit and a
         "+N" badge for the rest, reading the number from MaxLinesContext right
         below. The picker must then not clamp on top of it — line-clamp turns
         the value into a -webkit-box and single-line truncation into a
         nowrap block, either of which takes the badge list out of the
         inline-flex layout it needs. maxLines writes those as inline styles on
         the element, hence !important. */
      &:has(.navi_badge_list) {
        display: inline-flex !important;
        -webkit-line-clamp: none !important;
        overflow: visible !important;
        -webkit-box-orient: horizontal !important;
        text-overflow: clip !important;
        white-space: normal !important;
      }

      /* The façade is transparent to the pointer — a press on what it draws
         means "open the picker". An own target is the exception, the same way
         the clear cross is one in the slot below: it says the press is aimed at
         IT, so it has to be reachable at all.
         Positioned as well as pointable: the input covering the box
         (see [navi-ui-custom] below) is absolute, so it paints over every
         static element of the façade whatever their pointer-events say — and
         the press then reaches the input, which is the picker. No offset, so
         nothing moves; this only puts the own target in the same paint layer
         as the things it has to be reachable through. */
      [data-own-target] {
        position: relative;
        pointer-events: auto;
      }
    }
    .navi_picker_right_slot {
      display: inline-flex;
      height: 1em;
      height: 1lh;
      /* Half the horizontal padding by default, so what sits in the slot lines
         up with the gutter the value already has; slotSpacing overrides it */
      margin-right: var(
        --picker-slot-spacing,
        calc(var(--x-picker-padding-right) * 0.5)
      );
      flex-shrink: 0;
      align-items: center;
      align-self: flex-start;
      justify-content: center;
      color: var(--x-picker-icon-color);
      /* Transparent to the pointer: the chevron is decoration, and a click on
         it means "open the picker", which is what the input underneath does. */
      pointer-events: none;

      /* :not(...) — the slot is one line tall, and an icon fills it rather than
         stretching it. An icon that opted out of that cap (Icon's lineOverflow,
         which the slot's own icons use) is asking to be bigger than the line,
         so this must not put the cap back. */
      .navi_icon:not([data-line-overflow="allow"]) {
        max-height: 100%;
      }
      /* The clear cross is the exception — it is a real target with its own
         intention (clear, the opposite of open), so it takes its clicks back.
         A button, or a picker when the cross asks first (see clearConfirm). */
      .navi_button,
      .navi_picker {
        pointer-events: auto;
      }
      /* Drawn small but not small to hit: the spacing around the cross — the
         slot margins on the sides, the picker padding above and below —
         belongs to its clickable zone, the same zone the clear cross of an
         input claims. The visual stays untouched; only the hit area grows.
         On the box for a picker: the picker root is not positioned. */
      .navi_button,
      .navi_picker .navi_picker_box {
        &::before {
          position: absolute;
          top: calc(-1 * var(--x-picker-padding-top));
          right: calc(
            -1 *
              var(
                --picker-slot-spacing,
                calc(var(--x-picker-padding-right) * 0.5)
              )
          );
          bottom: calc(-1 * var(--x-picker-padding-bottom));
          left: calc(
            -1 *
              var(
                --picker-slot-spacing,
                calc(var(--x-picker-padding-right) * 0.5)
              )
          );
          content: "";
        }
      }
    }
    &[navi-single-line] {
      .navi_picker_right_slot {
        align-self: var(--x-picker-align-y);
      }
    }
    .navi_picker_input {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;
      cursor: inherit;
      pointer-events: auto;

      &::-webkit-calendar-picker-indicator {
        cursor: inherit;
      }
    }

    &[navi-ui-custom] {
      .navi_picker_input {
        position: absolute;
        top: calc(-1 * var(--picker-border-width));
        right: calc(-1 * var(--picker-border-width));
        bottom: calc(-1 * var(--picker-border-width));
        left: calc(-1 * var(--picker-border-width));
        /* Reset width/height for input color */
        width: auto;
        height: auto;

        opacity: 0;
        appearance: none;
      }
    }

    .navi_picker_content {
      /* The other side of the frame: what a picker holds here is what its
         popup shows, and a popup is never at a seam. Popover and Dialog stop
         the ask at their own root too — this covers content that reaches the
         popup through neither. */
      --x-corner-top-left-radius: initial;
      --x-corner-top-right-radius: initial;
      --x-corner-bottom-right-radius: initial;
      --x-corner-bottom-left-radius: initial;

      display: contents;
      /* What opens from a control is a page of its own, not part of that
         control's type scale: it is written at the control font by name,
         rather than by inheriting the size the picker itself is drawn at. A
         caller who sizes a picker to the façade it holds (so the padding, the
         corners and the chevron the picker draws in em land on the text the
         caller actually wrote) would otherwise take the popup down with it:
         its title, and everything in it that does not state a size of its
         own. Same reason the popup is written on the page's line rather than
         the control's — see .navi_popup in popup.jsx. */
      font-size: var(--navi-control-font-size);
      text-align: initial; /* Don't inherit picker text align */
    }

    /* Hover */
    &[data-hover] {
      --x-picker-background-color: var(--picker-background-color-hover);
      --x-picker-border-color: var(--picker-border-color-hover);
    }
    /* Readonly */
    &[data-readonly] {
      --x-picker-border-color: var(--picker-border-color-readonly);
      --x-picker-background-color: var(--picker-background-color-readonly);
      --x-picker-color: var(--picker-color-readonly);
      --x-picker-icon-color: var(--picker-icon-color-readonly);
      --x-picker-cursor: default;
    }
    /* Read-only and still opening, so it still says so under the pointer.
       Before the disabled block below on purpose: a disabled picker opens
       nothing, read-only or not. */
    &[data-readonly-opens] {
      --x-picker-cursor: pointer;
    }
    /* Focus. The second selector is the state held by hand (pseudoState on
       the picker lands on this root, which is never focused for real): a demo
       showing the ring without a Tab press. */
    &[data-focus-within]:has(.navi_picker_input[data-focus-visible]),
    &[data-focus-visible] {
      --x-picker-border-color: transparent;

      .navi_picker_box {
        outline-style: solid;
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-picker-border-color: var(--picker-border-color-disabled);
      --x-picker-background-color: var(--picker-background-color-disabled);
      --x-picker-color: var(--picker-color-disabled);
      --x-picker-icon-color: var(--picker-icon-color-disabled);
      --x-picker-cursor: default;
    }
    /* Callout (info, warning, error) */
    &[data-callout] {
      --x-picker-border-color: var(--callout-color);
    }

    /* A variant states what the caller did NOT: it moves the DEFAULTS
       (--picker-*) and never the resolved values (--x-picker-*), so a
       backgroundColor/borderColor/padding prop — which lands inline on this
       same element — still wins. The per-state defaults are re-pointed at the
       base one too, otherwise the @layer formulas (hover = 5% black over the
       background, disabled = 5% grey) would repaint a box the variant just
       took away. */
    &[data-variant="icon"] {
      --picker-padding-x-default: 0;
      --picker-padding-y-default: 0;
      /* Nothing but the icon is drawn here, so a width/height the caller gave
         it is a target area, not a text column: the icon belongs in its middle.
         A default, like everything else a variant moves, so alignX still wins. */
      --picker-align-x-default: center;
      --picker-border-width: 0px; /* must carry a unit (px) — used in calc() to offset the custom input overlay */
      --picker-border-color: transparent;
      --picker-border-color-hover: var(--picker-border-color);
      --picker-border-color-readonly: var(--picker-border-color);
      --picker-border-color-disabled: var(--picker-border-color);
      --picker-background-color: transparent;
      --picker-background-color-hover: var(--picker-background-color);
      --picker-background-color-readonly: var(--picker-background-color);
      --picker-background-color-disabled: var(--picker-background-color);
      --x-picker-icon-color: currentColor;

      /* The value holds nothing but the icon, so it takes the icon's width
         rather than the box's: the box's justify-content is then what places
         it, and alignX means something. */
      .navi_picker_value {
        flex-grow: 0;
      }
    }
    /* discrete: no box at rest, a background on hover — the same word Button
       uses, and the same drawing. What is read is the value, not the field
       around it; the chevron in the right slot is what still says it opens. */
    &[data-variant="discrete"] {
      --picker-border-width: 0px; /* must carry a unit (px) — used in calc() to offset the custom input overlay */
      --picker-border-color: transparent;
      --picker-border-color-hover: var(--picker-border-color);
      --picker-border-color-readonly: var(--picker-border-color);
      --picker-border-color-disabled: var(--picker-border-color);
      --picker-background-color: transparent;
      /* The hover wash is mixed INTO the background instead of replacing it:
         over the transparent default it is exactly the 8% of currentColor it
         has always been, and over a backgroundColor the caller gave it darkens
         that color rather than erasing it. */
      --picker-background-color-hover: color-mix(
        in srgb,
        currentColor 8%,
        var(--picker-background-color)
      );
      --picker-background-color-readonly: var(--picker-background-color);
      --picker-background-color-disabled: var(--picker-background-color);
    }
    &[data-variant="headless"] {
      --picker-padding-x-default: 0;
      --picker-padding-y-default: 0;
      --picker-border-width: 0px; /* must carry a unit (px) — used in calc() to offset the custom input overlay */
      --picker-border-color: transparent;
      --picker-border-color-hover: var(--picker-border-color);
      --picker-border-color-readonly: var(--picker-border-color);
      --picker-border-color-disabled: var(--picker-border-color);
      --picker-background-color: transparent;
      --picker-background-color-hover: var(--picker-background-color);
      --picker-background-color-readonly: var(--picker-background-color);
      --picker-background-color-disabled: var(--picker-background-color);
      --x-picker-icon-color: currentColor;

      .navi_picker_box {
        position: absolute;
        inset: 0;
        z-index: -1;
      }
    }
    /* bare: the caller's drawing IS the trigger. No frame, no control line, no
       slot beside it, no clamp on it — the picker takes the size of what the ui
       draws, to the pixel, and does nothing to it but catch the press. For a
       picker that is a whole piece of a layout (a column of a card, a tile)
       rather than a field: the same drawing can then sit alone somewhere else
       and be the same box in both places. */
    &[data-variant="bare"] {
      --picker-padding-x-default: 0;
      --picker-padding-y-default: 0;
      /* The box holds the drawing rather than placing it inside itself: a
         height the caller gave the picker belongs to the drawing too. */
      --picker-align-y-default: stretch;
      --picker-border-width: 0px; /* must carry a unit (px) — used in calc() to offset the custom input overlay */
      --picker-border-color: transparent;
      --picker-border-color-hover: var(--picker-border-color);
      --picker-border-color-readonly: var(--picker-border-color);
      --picker-border-color-disabled: var(--picker-border-color);
      --picker-background-color: transparent;
      --picker-background-color-hover: var(--picker-background-color);
      --picker-background-color-readonly: var(--picker-background-color);
      --picker-background-color-disabled: var(--picker-background-color);
      --x-picker-icon-color: currentColor;

      /* The drawing is the caller's, so it is written on the page's line at
         the page's size — the control font and the control line belong to the
         field-like drawings, which this one is not. */
      font-size: inherit;
      font-family: inherit;
      line-height: inherit;

      .navi_picker_box {
        /* A field is at least one line tall whatever it holds; this is not a
           field, so its height is the drawing's and nothing else. */
        min-height: 0;
      }
    }
    /* button: drawn as a Button is, from the same tokens (see button_ui.jsx
       and the --navi-button-* vars) — its surface, its padding, a centered
       label, its washed-out read-only and disabled — for a picker that IS a
       button with a popup behind it (a confirm). The value slot draws the
       label (the ui prop), and no slot follows it: nothing says "this opens",
       what it opens says it. Hover keeps the picker's own formulas, which are
       the button's already. */
    &[data-variant="button"] {
      --picker-padding-x-default: var(--navi-button-padding-x-default);
      --picker-padding-y-default: var(--navi-button-padding-y-default);
      --picker-align-x-default: center;
      --picker-background-color: var(--navi-button-background-color);
      /* Read-only / disabled: fading toward the surface, not toward
         transparent — the button's own rule. */
      --picker-border-color-readonly: color-mix(
        in srgb,
        var(--picker-border-color) 30%,
        var(--navi-surface-color)
      );
      --picker-background-color-readonly: var(--picker-background-color);
      --picker-color-readonly: color-mix(
        in srgb,
        var(--picker-color) 30%,
        transparent
      );
      --picker-border-color-disabled: var(--picker-border-color-readonly);
      --picker-background-color-disabled: var(
        --picker-background-color-readonly
      );
      --picker-color-disabled: var(--picker-color-readonly);

      text-align: center;
    }
    /* text: a word in a sentence, marked by the dotted line under it — the way
       a term one can ask about is marked. No box, no slot; the font is the
       sentence's own, so the word sits in its line like the ones around it. */
    &[data-variant="text"] {
      --picker-padding-x-default: 0;
      --picker-padding-y-default: 0;
      --picker-border-width: 0px; /* must carry a unit (px) — used in calc() to offset the custom input overlay */
      --picker-border-color: transparent;
      --picker-border-color-hover: var(--picker-border-color);
      --picker-border-color-readonly: var(--picker-border-color);
      --picker-border-color-disabled: var(--picker-border-color);
      --picker-background-color: transparent;
      --picker-background-color-hover: var(--picker-background-color);
      --picker-background-color-readonly: var(--picker-background-color);
      --picker-background-color-disabled: var(--picker-background-color);

      font-size: inherit;
      font-family: inherit;
      text-decoration: underline dotted;
      text-underline-offset: 0.2em;

      &[data-hover] {
        text-decoration-style: solid;
      }
    }
  }
`;

const PickerButton = (props) => {
  import.meta.css = css;
  warnOnUnknownPickerType(props);
  warnOnUIDrawnByNobody(props);
  if (typeof props.maxLines === "string") {
    props.maxLines = parseInt(props.maxLines);
  }
  // Spacing props travel to CSS as a raw custom property value, so the size
  // keywords have to become lengths here — "s" reaching CSS untouched makes
  // the declaration invalid, silently, and the gap just goes away.
  props.slotSpacing = resolveSpacingSize(props.slotSpacing);
  const {
    ref,
    variant,
    rightSlotIcon,
    rightSlotIconSize = "inherit",
    // What goes in the right slot as-is — no <Icon> around it, so a caller can
    // put something interactive there. `rightSlotIcon` cannot: it is wrapped in
    // an <Icon>, which is aria-hidden, and a focusable node under aria-hidden is
    // invisible to assistive tech while still being reachable by tab.
    rightSlot,
    placeholder,
    ui,
    maxLines: maxLinesProp = 1,
    // By default the popover is at least as wide as the trigger (min-width:
    // --anchor-width). Set true when the CONTENT should dictate the popover width
    // (e.g. a Wheel) instead of being stretched to the trigger — see
    // picker_custom.jsx.
    popupWidthFitContent,
    // Adds a clear button to the right slot, the same one type="search" puts at
    // the end of an input: a picker holds a value the user chose, and unsetting
    // it should not require reopening the popup to hunt for a "none" entry.
    clearable,
    // "Are you sure?" before the cross clears anything. A cross of three
    // millimetres at the edge of a touch screen, right where the chevron is
    // aimed at, is the button pressed by accident — and what it removes does
    // not come back. The cross is then a confirm picker (see
    // picker_confirm.jsx), and the clear only goes out on yes.
    clearConfirm,
    readOnly,
    error,
  } = props;
  // A word in a sentence is never truncated — and the clamp's overflow: hidden
  // would cut its dotted underline, which sits on the edge of the line box
  // (WebKit drops it or not depending on the subpixel position of the line).
  // A bare picker is not truncated either: the drawing it shows is the
  // caller's own, and clamping it would be the picker deciding the shape of
  // something it does not draw.
  const maxLines =
    variant === "text" || variant === "bare" ? undefined : maxLinesProp;
  const isSingleLine = maxLines === 1;
  // Same rule as the root: phrasing content inside a sentence.
  const ContentTag = variant === "text" ? "span" : "div";
  const inputRef = useRef(null);
  const [pickerRemainingProps, inputProps, facadeChildrenProps] =
    useControlFacadeProps(
      {
        ...props,
        ref: inputRef,
      },
      {
        controlType: "picker",
      },
    );
  const uiStateController = getUIStateControllerById(inputProps.id);
  const value = uiStateController.uiState;
  const { basePseudoState, children } = inputProps;
  const loading = basePseudoState[":-navi-loading"];
  // The same chain useControlProps resolves (own prop first, then what the
  // group above says), for the two things it does not carry: the popup content,
  // which is read-only along with the picker, and the cursor, which stays a
  // pointer on a picker that still opens.
  const readOnlyFromAbove = useContext(ReadOnlyContext);
  const readOnlyResolved = readOnly || readOnlyFromAbove;
  // Read off the controller rather than worked out again: what makes a
  // read-only picker open is settled once, where the gate reads it (see
  // createControlInfo's readOnlyOpens). Needed here for the cursor.
  const readOnlyOpens =
    Boolean(readOnlyResolved) && uiStateController.readOnlyOpens;
  // Whether anything can still be changed — read by the clear cross below,
  // clearing being a modification like any other.
  const interactive =
    !basePseudoState[":disabled"] && !basePseudoState[":read-only"] && !loading;
  usePickerErrorCallout(uiStateController, error);

  return (
    /* Read-only crosses into everything the picker is made of: what it really
       holds is drawn by controls of their own — in the popup, and on the façade
       where an application puts its own affordances — and each of them refuses
       in its own words once told. Said from the read-only state alone, never
       from the busy one — an action running for a moment is not the same thing
       as a value nobody may change. */
    <ReadOnlyContext.Provider value={readOnlyResolved}>
      <Box
        // A word in a sentence (variant="text") sits in a <p>, where a <div> is
        // not allowed: phrasing content there, block content elsewhere.
        as={variant === "text" ? "span" : "div"}
        ref={ref}
        // The flow this element really has (.navi_picker is display:inline-flex).
        // Left unsaid, Box reads a <div> as block and resolves alignX into a
        // text-align — which is a different intention entirely (that one is the
        // textAlign prop, placing the text INSIDE the value slot).
        inline
        flex="x"
        baseClassName="navi_picker"
        pseudoClasses={PICKER_BUTTON_PSEUDO_CLASSES}
        data-variant={variant}
        navi-picker=""
        navi-single-line={isSingleLine ? "" : undefined}
        navi-ui-custom={ui === "default" ? undefined : ""}
        data-readonly-opens={readOnlyOpens ? "" : undefined}
        data-popup-width-fit-content={popupWidthFitContent ? "" : undefined}
        {...pickerRemainingProps}
        basePseudoState={basePseudoState}
        styleCSSVars={PickerStyleCSSVars}
        variant={undefined}
        rightSlotIcon={undefined}
        rightSlotIconSize={undefined}
        rightSlot={undefined}
        clearConfirm={undefined}
        openWhileReadOnly={undefined}
        ui={undefined}
        maxLines={undefined}
        popupWidthFitContent={undefined}
        error={undefined}
        dayLabel={undefined}
        // This wrapper will receive keyboard event bubbling from the picker popup content
        // we re-dispatch on the input (to get escape to close for instance)
        onKeyDown={inputProps.onKeyDown}
        // in case request open/close are dispatched on the control root ->
        // redispatch them to the host
        onnavi_request_open={inputProps.onnavi_request_open}
        onnavi_request_close={inputProps.onnavi_request_close}
        // `--navi-select`/`--navi-unselect` about one entry of the list the
        // picker holds — a chip on the façade, a suggestion beside the field.
        // Answered here rather than by the control drawing that list in the
        // popup, even though rows are what such a control owns: a picker given
        // its own value builds its popup only on first open (see
        // popup_content_mount.js), so before that there is no such control at
        // all — and building the whole popup to have someone to talk to, for a
        // cross, is the wrong price. The picker holds the value in the first
        // place and hands it down whenever the popup is built.
        onnavi_request_select={(e) => {
          requestPickerListEntry(ref.current, inputRef.current, e, "select");
        }}
        onnavi_request_unselect={(e) => {
          requestPickerListEntry(ref.current, inputRef.current, e, "unselect");
        }}
      >
        <span className="navi_picker_box">
          {variant === "headless" ? null : (
            <LoadingOutline
              loading={loading}
              color="var(--picker-loader-color)"
              inset={-2}
            />
          )}
          <PickerInput
            tabIndex={variant === "headless" ? -1 : undefined}
            aria-hidden={variant === "headless" ? "true" : undefined}
            {...inputProps}
            // eslint-disable-next-line react/no-children-prop
            children={undefined} // we will render children into the div
            ui={ui}
            onCopy={(e) => {
              const pickerEl = ref.current;
              if (isWithinPickerContent(e.target, pickerEl)) {
                return;
              }
              const uiState = uiStateController.uiState;
              if (uiState === undefined) {
                return;
              }
              e.preventDefault();
              const displayText =
                pickerEl.querySelector(".navi_picker_value")?.textContent ??
                String(uiState);
              e.clipboardData.setData("text/plain", displayText);
              e.clipboardData.setData(
                "application/x-navi",
                JSON.stringify(uiState),
              );
            }}
            onCut={(e) => {
              const pickerEl = ref.current;
              if (isWithinPickerContent(e.target, pickerEl)) {
                return;
              }
              const uiState = uiStateController.uiState;
              if (uiState === undefined) {
                return;
              }
              // the copy part don't need control to be interactable
              const displayText =
                pickerEl.querySelector(".navi_picker_value")?.textContent ??
                String(uiState);
              e.clipboardData.setData("text/plain", displayText);
              e.clipboardData.setData(
                "application/x-navi",
                JSON.stringify(uiState),
              );
              // the clear ui state part need control to be interactable
              dispatchRequestInteraction(pickerEl, {
                event: e,
                name: "cut",
                allowed: () => {
                  dispatchRequestClearUIState(inputRef.current, e);
                },
              });
              e.preventDefault();
            }}
            onPaste={(e) => {
              const pickerEl = ref.current;
              if (isWithinPickerContent(e.target, pickerEl)) {
                // Don't intercept inside the picker popup content.
                return;
              }
              const naviData = e.clipboardData.getData("application/x-navi");
              let pasteValue;
              if (naviData) {
                try {
                  pasteValue = JSON.parse(naviData);
                } catch {
                  pasteValue = naviData;
                }
              } else {
                pasteValue = e.clipboardData.getData("text/plain");
              }
              dispatchRequestInteraction(pickerEl, {
                event: e,
                name: "paste",
                allowed: () => {
                  dispatchRequestSetUIState(inputRef.current, pasteValue, {
                    event: e,
                  });
                },
              });
              e.preventDefault();
            }}
          />
          {variant === "headless" || ui === "default" ? null : (
            <Text
              className="navi_picker_value"
              // Tells the caller's own drawing of the control from the value
              // the picker draws itself, so each is written on its own line
              // (see .navi_picker_value in the CSS above).
              data-picker-facade={ui === undefined ? undefined : ""}
              // A button's label is not a placeholder, however empty the
              // picker behind it is.
              navi-placeholder={
                variant !== "button" &&
                variant !== "text" &&
                uiStateHoldsNothing(value)
                  ? ""
                  : undefined
              }
              maxLines={maxLines}
            >
              <PickerOwnContent>
                <PickerContext.Provider
                  value={{ value, placeholder, maxLines }}
                >
                  {/* For what the picker cannot clamp itself: a <BadgeList>
                      wraps flex rows, which line-clamp never sees. */}
                  <MaxLinesContext.Provider value={maxLines}>
                    {ui === undefined ? (
                      variant === "icon" ? (
                        // An icon picker draws no value, so there is no slot
                        // beside it either — the icon that would have sat in
                        // that slot IS the trigger, and a caller's own `ui`
                        // replaces it like any other.
                        <Icon size={rightSlotIconSize} lineOverflow="allow">
                          {rightSlotIcon === undefined ? (
                            <ChevronDownSvg />
                          ) : (
                            rightSlotIcon
                          )}
                        </Icon>
                      ) : (
                        <PickerDefaultUI />
                      )
                    ) : (
                      ui
                    )}
                  </MaxLinesContext.Provider>
                </PickerContext.Provider>
              </PickerOwnContent>
            </Text>
          )}
          {variant === "icon" ||
          variant === "headless" ||
          variant === "button" ||
          variant === "text" ||
          variant === "bare" ||
          ui === "default" ? null : (
            <span className="navi_picker_right_slot">
              <PickerOwnContent>
                {/* Clearing is a modification: nothing to offer on a picker
                    whose value cannot be changed. The cross is a control of its
                    own, so the interaction gate finds IT rather than the picker
                    and would let the press through — the tap aimed where the
                    chevron sits would empty a field nothing else can touch. */}
                {clearable &&
                interactive &&
                value !== undefined &&
                value !== "" &&
                clearConfirm !== undefined ? (
                  // A picker on the façade of a picker: the cross opens the
                  // question, and yes sends the clear to this picker's input.
                  // A door only (allowNameless): the form around does not see
                  // a field in it.
                  <Picker
                    type="confirm"
                    variant="icon"
                    ui={
                      <Icon size={rightSlotIconSize} lineOverflow="allow">
                        <CloseSvg />
                      </Icon>
                    }
                    message={clearConfirm}
                    command="--navi-clear"
                    commandFor={inputProps.id}
                    tabIndex="-1"
                  />
                ) : clearable &&
                  interactive &&
                  value !== undefined &&
                  value !== "" ? (
                  <Button
                    command="--navi-clear"
                    commandFor={inputProps.id}
                    tabIndex="-1"
                    // No navi-focus-delegate, unlike the identical button inside an
                    // input: handing focus back to the picker's own input is what
                    // opens the popup, and clearing is the opposite intention.
                    icon
                    variant="discrete"
                    // What is busy once the clear is sent is the picker — the value
                    // being removed is the whole field's, and the picker already
                    // draws the wait around all of it. Two outlines for one wait is
                    // one too many.
                    loadingOutline={false}
                    // preventDefault, not just tabIndex="-1": a mousedown focuses
                    // its target before any click happens, and this button should
                    // never hold focus at all — the field keeps it.
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    flex
                    align="center"
                  >
                    <Icon size={rightSlotIconSize} lineOverflow="allow">
                      <CloseSvg />
                    </Icon>
                  </Button>
                ) : rightSlot === undefined ? (
                  // lineOverflow: what sits in the slot is an affordance, not a
                  // character — a caller asking for a bigger one wants it bigger,
                  // not capped at the height of the line it sits on
                  <Icon size={rightSlotIconSize} lineOverflow="allow">
                    {rightSlotIcon === undefined ? (
                      <ChevronDownSvg />
                    ) : (
                      rightSlotIcon
                    )}
                  </Icon>
                ) : (
                  rightSlot
                )}
              </PickerOwnContent>
            </span>
          )}
        </span>
        <ControlFacadeChildrenWrapper {...facadeChildrenProps}>
          {/* The attribute is what tells "inside this picker's popup" from
              "on its façade" — read by this picker's own press handling and by
              the command resolution in control_dom.js. */}
          <ContentTag className="navi_picker_content" data-picker-content="">
            {children}
          </ContentTag>
        </ControlFacadeChildrenWrapper>
      </Box>
    </ReadOnlyContext.Provider>
  );
};
// What the picker draws itself — the value it shows, the furniture in its slot,
// and whatever a caller puts in either — is not another control of the field
// around it: none of it may take the id (nor the name) a <Field> hands down,
// which is the picker's. Two controls under one id is one registry entry, and
// the one that unmounts first — the clear cross the moment the field it emptied
// is empty, a chip the moment its value is taken out — takes the picker's own
// entry with it, leaving the picker looking for a controller that is gone.
const PickerOwnContent = ({ children }) => (
  <ControlIdContext.Provider value={undefined}>
    <ControlNameContext.Provider value={undefined}>
      {children}
    </ControlNameContext.Provider>
  </ControlIdContext.Provider>
);

// `id` is what --navi-select/--navi-unselect carry (a list addresses its rows by
// id); asked of a picker, what they carry is one entry of the list the picker
// holds — the same thing a `<Picker.Chip value>` stands for.
const requestPickerListEntry = (pickerEl, pickerInputEl, e, goal) => {
  const uiState = getUIStateFromElement(pickerInputEl);
  if (!Array.isArray(uiState)) {
    if (import.meta.dev) {
      console.warn(
        `"--navi-${goal}" asked of a picker that does not hold a list — <Picker type="array">`,
        pickerEl,
      );
    }
    return;
  }
  const { id: entry } = e.detail;
  const isThere = uiState.some((item) => compareTwoJsValues(item, entry));
  if (goal === "select" ? isThere : !isThere) {
    return;
  }
  const uiStateNext =
    goal === "select"
      ? [...uiState, entry]
      : uiState.filter((item) => !compareTwoJsValues(item, entry));
  dispatchRequestInteraction(pickerEl, {
    event: e,
    name: goal,
    prevented: () => e.preventDefault(),
    allowed: () => {
      dispatchRequestSetUIState(pickerInputEl, uiStateNext, { event: e });
    },
  });
};

// The nearest popup content upward, contained in this picker — see the same
// helper in picker_custom.jsx for why not this picker's first content element.
const isWithinPickerContent = (el, pickerEl) => {
  return pickerEl.contains(el.closest("[data-picker-content]"));
};

const PICKER_ERROR_TOKEN = createOpenToken();
// The `error` prop rides the control's own callout — the same surface already
// used for failing constraints — so a caller never has to decide where to put
// the message. It shows whether the popup is open or closed, and dismissing it
// discards that error: only a new `error` value raises another one.
const usePickerErrorCallout = (uiStateController, error) => {
  useEffect(() => {
    const { callout } = uiStateController.rules;
    const closeEvent = new CustomEvent("picker_error_cleared", { detail: {} });
    if (!error) {
      callout.removeOpenToken(PICKER_ERROR_TOKEN, closeEvent);
      return undefined;
    }
    callout.addOpenToken(PICKER_ERROR_TOKEN, {
      message: error === true ? "Something went wrong." : error,
      status: "error",
      skipFocus: true,
    });
    return () => {
      callout.removeOpenToken(PICKER_ERROR_TOKEN, closeEvent);
    };
  }, [error]);
};

const PickerInput = (props) => {
  const { ui, readOnly } = props;

  // After type resolution: force readOnly when the input type would open the
  // mobile keyboard. We also suppress the visual ":read-only" state so the
  // picker still looks interactive (it is — just not keyboard-typeable).
  const readOnlyForced = readOnly
    ? false
    : isOpeningKeyboardOnMobile(props.type);

  const autoSelectReadOnlyProps = useAutoSelectReadOnly(props);

  return (
    <Box
      as="input"
      {...props}
      readOnly={readOnlyForced ? true : readOnly}
      data-readonly-forced={readOnlyForced ? "" : undefined}
      ui={undefined}
      className="navi_picker_input"
      pseudoClasses={PickerInputPseudoClasses}
      onKeyDown={(e) => {
        props.onKeyDown(e);
        if (e.key === "Enter") {
          // prevent form submission now that input can have focus
          e.preventDefault();
        } else if (e.key === "Tab" && ui !== "default") {
          // Ensure tab does not tab through the browser picker elements (like in input date)
          performTabNavigation(e);
        }
      }}
      {...autoSelectReadOnlyProps}
    />
  );
};
// Input types that open the software keyboard on mobile.
// When the picker's underlying input has one of these types, we force readOnly
// so tapping the picker doesn't open the keyboard (the picker manages its own UI).
const isOpeningKeyboardOnMobile = (type) => {
  if (NON_MOBILE_KEYBOARD_TYPES.has(type)) {
    return false;
  }
  return true; // default to text
};
const NON_MOBILE_KEYBOARD_TYPES = new Set([
  "date",
  "month",
  "week",
  "time",
  "datetime-local",
  "color",
]);

const PICKER_BUTTON_PSEUDO_CLASSES = [
  ":hover",
  ":focus",
  ":focus-visible",
  ":focus-within",
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":-navi-expanded",
  ":-navi-has-value",
];
const PickerInputPseudoClasses = [
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":-navi-has-value",
  ":-navi-expanded",
];

const PickerStyleCSSVars = {
  "outlineWidth": "--picker-outline-width",
  "borderWidth": "--picker-border-width",
  "borderRadius": "--picker-border-radius",
  "popoverMaxHeight": "--picker-popover-max-height",
  "dialogMinWidth": "--picker-dialog-min-width",
  "dialogMinHeight": "--picker-dialog-min-height",
  "dialogMaxWidth": "--picker-dialog-max-width",
  "dialogMaxHeight": "--picker-dialog-max-height",
  "popupBackgroundColor": "--picker-popup-background-color",
  "popupBorderRadius": "--picker-popup-border-radius",
  "dialogBorderWidth": "--picker-dialog-border-width",
  "slotSpacing": "--picker-slot-spacing",
  // alignX/alignY resolve to these two on a flex-x box; naming the CSS style
  // (not the prop) is what styleCSSVars matches, so justifyContent/alignItems
  // passed directly land in the same variables.
  "justifyContent": "--picker-align-x",
  "alignItems": "--picker-align-y",
  "padding": "--picker-padding",
  "paddingX": "--picker-padding-x",
  "paddingY": "--picker-padding-y",
  "paddingTop": "--picker-padding-top",
  "paddingRight": "--picker-padding-right",
  "paddingBottom": "--picker-padding-bottom",
  "paddingLeft": "--picker-padding-left",
  "borderColor": "--picker-border-color",
  "backgroundColor": "--picker-background-color",
  "color": "--picker-color",
  ":hover": {
    backgroundColor: "--picker-background-color-hover",
    borderColor: "--picker-border-color-hover",
  },
  ":read-only": {
    backgroundColor: "--picker-background-color-readonly",
    borderColor: "--picker-border-color-readonly",
    color: "--picker-color-readonly",
  },
  ":disabled": {
    backgroundColor: "--picker-background-color-disabled",
    borderColor: "--picker-border-color-disabled",
    color: "--picker-color-disabled",
  },
};

const PickerDefaultUI = () => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return null;
    }
    return renderSafe(placeholder);
  }
  return renderSafe(value);
};

const PickerFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  resolveInputProps(props, { controlType: "picker" });

  return <Next {...props} />;
};

/**
 * Button-like trigger that opens a picker (native or custom popup) when clicked.
 *
 * Without `children`, opens the browser-native picker for the given `type`.
 * With `children`, opens a popover (desktop) or dialog (mobile) containing the children.
 * Pass `mode="popover"` or `mode="dialog"` to override the automatic choice.
 *
 * `type="confirm"` is the picker that asks "are you sure?" before doing what it
 * stands for: its popup is the question, `ui` its label, and yes runs its
 * `action` or triggers its `command` once the popup has closed — see
 * picker_confirm.jsx, and `message`, `confirmLabel`, `cancelLabel`,
 * `focusOnOpen` below.
 *
 * @type {import("preact").FunctionComponent<{
 *   type?: "date" | "month" | "week" | "time" | "datetime" | "duration" | "color" | "file" | "text" | "object" | "array" | "confirm" | "navi_time" | "navi_number" | "navi_percentage",
 *   value?: any,
 *   defaultValue?: any,
 *   name?: string,
 *   placeholder?: import("preact").ComponentChildren,
 *   ui?: import("preact").ComponentChildren | "default",
 *   required?: boolean,
 *   min?: Date | string | number,
 *   max?: Date | string | number,
 *   step?: string | number,
 *   disabled?: boolean,
 *   readOnly?: boolean,
 *   openWhileReadOnly?: boolean,
 *   error?: boolean | string,
 *   uiAction?: (value: any, event: Event) => void,
 *   action?: (value: any, event: Event) => void,
 *   children?: import("preact").ComponentChildren,
 *   mode?: "popover" | "dialog" | "callout",
 *   calloutStatus?: "info" | "warning" | "error" | "success" | "none",
 *   calloutIcon?: boolean,
 *   calloutCloseButton?: boolean,
 *   popoverMode?: "nearby" | "overlay",
 *   positionArea?: string,
 *   popupWidthFitContent?: boolean,
 *   variant?: "icon" | "circle" | "headless" | "discrete" | "button" | "text" | "bare" | "picker",
 *   alignX?: "start" | "center" | "end",
 *   alignY?: "start" | "center" | "end" | "stretch",
 *   rightSlotIcon?: import("preact").ComponentChildren,
 *   rightSlotIconSize?: number | string,
 *   rightSlot?: import("preact").ComponentChildren,
 *   clearConfirm?: string | import("preact").ComponentChildren,
 *   message?: import("preact").ComponentChildren,
 *   confirmLabel?: import("preact").ComponentChildren,
 *   cancelLabel?: import("preact").ComponentChildren,
 *   focusOnOpen?: "confirm" | "cancel" | "none",
 *   onConfirm?: (confirmEvent: CustomEvent) => void,
 *   maxLines?: number,
 *   slotSpacing?: number | string,
 *   popoverMaxHeight?: number | string,
 *   dialogMinWidth?: number | string,
 *   dialogMinHeight?: number | string,
 *   dialogMaxWidth?: number | string,
 *   dialogMaxHeight?: number | string,
 *   popupBackgroundColor?: string,
 *   popupBorderRadius?: number | string,
 *   dialogBorderWidth?: number | string,
 *   clearable?: boolean,
 *   popupLayer?: "top" | "local",
 *   popupTestId?: string,
 *   confirmTestId?: string,
 *   cancelTestId?: string,
 *   mountWhenClosed?: boolean,
 *   unmountWhenClosed?: boolean,
 *   dialogExpand?: boolean,
 *   dialogExpandX?: boolean,
 *   dialogExpandY?: boolean,
 *   marginWithContainer?: number | string,
 *   anchor?: import("preact").RefObject<HTMLElement> | HTMLElement,
 *   escapeEffect?: "cancel" | "close",
 *   pointerInteractionOutsideEffect?: "close" | "cancel" | "capture",
 *   backdropVariant?: "auto" | "discrete" | "invisible",
 *   ref?: import("preact").RefObject<HTMLElement>,
 *   [key: string]: any,
 * }>}
 * @param {string} [popupBackgroundColor] The popup's surface. Left out it is
 *   the one every navi popup uses (`--navi-popup-background-color`, which
 *   follows the theme) — the trigger's own `backgroundColor` is not it, so a
 *   variant that paints the trigger transparent leaves the popup a real sheet.
 * @param {number|string} [popupBorderRadius] The popup's corners. Left out they
 *   echo the trigger's `borderRadius`.
 * @param {import("preact").ComponentChildren | "default"} [ui] What the
 *   trigger draws in place of the value's default rendering (a date, a list
 *   joined by commas…) — and then all it draws: `placeholder` is not shown
 *   next to it. A `ui` must therefore say on its own that the picker is empty,
 *   and take the same room empty as it does filled. A <BadgeList> gets both
 *   from its `fallback` — the placeholder text, as plain text, see
 *   docs/badge_list.md. `"default"` draws nothing in the slot at all.
 *
 *   Under `variant="icon"` there is no value to draw, so this IS the trigger:
 *   left out it is the icon the right slot would have shown (`rightSlotIcon`,
 *   or the chevron), and given it is drawn instead — one icon of the caller's
 *   own, and nothing else.
 *
 *   Under `variant="bare"` it is the trigger as well, and the picker adds
 *   nothing around it: whatever this draws is what the picker measures. Its
 *   own padding, its own lines, its own corners — a `<Box>` here gives a
 *   picker the exact box that `<Box>` has on its own. Anything interactive
 *   inside it takes its clicks back with `data-own-target`, the press
 *   everywhere else opening the popup.
 * @param {boolean} [readOnly] Nothing in this picker can be changed — and it
 *   still opens, so what is in the popup can be read: everything in there is
 *   held read-only in turn, each control greying out and saying why on its own.
 *   Which is the point of opening it at all: a picker's answer often exists
 *   only in the shape the popup draws (a plan with one tile ringed, a wheel
 *   stopped on a time), and the trigger's one line is a summary of it, not the
 *   whole of it. The clear cross goes, closing commits nothing, and a `value`
 *   the popup would otherwise have confirmed stays a suggestion.
 *   A picker with no `children` opens the browser's own picker instead, and
 *   that one cannot be held read-only — so it goes on refusing (see
 *   PickerNative).
 * @param {boolean} [openWhileReadOnly=true] Pass false to make `readOnly`
 *   refuse the open as well, for a popup with nothing to read: a form of
 *   controls to fill in, a menu of gestures. Opening then only shows what is
 *   refused, so the picker says why on the trigger instead — where the
 *   interaction happened.
 * @param {boolean|string} [error] Something went wrong around this picker (its
 *   content failed to load, its value could not be resolved…). Shown as a
 *   callout on the trigger, open or closed — the caller has nothing to place.
 *   Dismissing it discards that error; a new `error` value raises another one.
 * @param {"popover"|"dialog"|"callout"} [mode] Which popup the children open
 *   in. Left out, a popover on a large screen and a dialog on a narrow one.
 *   `"callout"` shows them in the picker's own callout — the speech bubble its
 *   constraints speak in, with its status icon, its cross and its arrow on
 *   the trigger — for a tooltip that opens on a press. It closes the way a
 *   callout does: its cross, Escape, a click outside.
 * @param {"info"|"warning"|"error"|"success"|"none"} [calloutStatus]
 *   `mode="callout"`: what the callout says about what it holds — its border,
 *   its icon, and whether a click outside closes it (an "error" stays).
 *   `"none"` is a plain tooltip: no icon, a neutral frame. "info" by default,
 *   "none" under `variant="text"`. The trigger's default icon is the
 *   callout's own status icon in that status (see `CalloutStatusIcon`) — left
 *   out, the trigger is that icon; `variant="circle"` draws it round. The callout's arrow points at
 *   the middle of the trigger (`data-callout-arrow-x="center"` unless the
 *   picker says otherwise).
 * @param {boolean} [calloutIcon] `mode="callout"`: whether the callout shows
 *   its status icon beside what it holds. On by default, off under
 *   `variant="text"` — a word asks for a plain bubble — and never shown
 *   without a status, whatever this says.
 * @param {boolean} [calloutCloseButton=true] `mode="callout"`: pass false to
 *   take the cross off the callout. It still closes on Escape, a click
 *   outside, and a `--navi-close` from what it holds — for a tooltip that is
 *   read rather than dismissed. Off by nobody's default: a text trigger
 *   keeps the cross unless told not to.
 * @param {"nearby"|"overlay"} [popoverMode="nearby"] "overlay" lays the popover
 *   over the trigger, "nearby" leaves a small gap below it.
 * @param {string} [positionArea] Where the popup goes — relative to the trigger
 *   in popover mode, relative to the viewport in dialog mode. Same grammar as
 *   Popover/Dialog's own `positionArea` ("top", "right-end", "inset(top-left)",
 *   …). Defaults to "bottom-start" in popover mode ("inset(top-left)" when
 *   popoverMode is "overlay"), and to Dialog's own "center" in dialog mode. A
 *   popover still flips to the opposite side on its own when there isn't
 *   enough room.
 * @param {boolean} [popupWidthFitContent] By default the popover is at least as
 *   wide as the trigger. Set this to let the content size it instead, so a
 *   popover narrower than the trigger stays narrow. Popover mode only — a
 *   dialog never takes the trigger's width to begin with (see
 *   `dialogMinWidth`).
 * @param {import("preact").ComponentChildren} [rightSlotIcon] What the right
 *   slot draws in place of the chevron. It is the whole slot, not an addition
 *   to it: the picker then no longer says on its own that it opens, so pass
 *   something that does. Decoration only — it is wrapped in an `<Icon>`, which
 *   is `aria-hidden`, so anything focusable in there would be reachable by tab
 *   while invisible to assistive tech. Use `rightSlot` for that.
 *
 *   The slot only exists beside a value. `variant="icon"` has none, so there is
 *   no slot either: the icon becomes the trigger itself and is drawn as the
 *   `ui` — which is also what a caller overrides to draw their own. Nothing
 *   else is drawn there, the clear cross included: one icon has room for one
 *   thing.
 * @param {import("preact").ComponentChildren} [rightSlot] Same place, rendered
 *   as-is: no `<Icon>` around it, nothing `aria-hidden`. This is where an
 *   interactive right slot goes.
 * @param {string|import("preact").ComponentChildren} [clearConfirm] The
 *   question asked before the clear cross clears anything — the `message` of
 *   the `<Picker type="confirm">` the cross then is, plain text or JSX. Asked
 *   BEFORE the ui state is emptied, so answering no leaves the field exactly
 *   as it was; answering yes clears and sends, and the picker's own action
 *   receives the cleared value like any other choice.
 * @param {"icon"|"headless"|"discrete"|"button"|"text"|"bare"|"picker"} [variant]
 *   How the trigger is drawn. `"button"` is a Button's drawing — surface,
 *   padding, a centered label, no chevron — and what a `type="confirm"` picker
 *   draws unless told otherwise: nothing is picked, the popup is a question.
 *   `"text"` is a word in a sentence, underlined with dots, no box and no
 *   slot: what `mode="callout"` uses for a callout on a term rather than on an
 *   icon (`"icon"` being its default, with an info icon in place of the
 *   chevron). `"bare"` draws no trigger of its own at all: the `ui` is it, and
 *   the picker is exactly that drawing's box — no padding, no frame, no
 *   control line, no clamp, no slot — for a picker that is a whole piece of a
 *   layout rather than a field, and which must measure the same as the same
 *   drawing placed anywhere else. `"picker"` (or an explicit
 *   `variant={undefined}`) asks a confirm or callout picker for the field-like
 *   drawing every other picker has.
 * @param {import("preact").ComponentChildren} [message] `type="confirm"`: the
 *   question, in the popup's default body — text, or JSX when it needs an
 *   emphasis, a link. Left out, a generic "are you sure?" in the current
 *   language. To draw the whole popup instead, pass `children`: yes is then
 *   whatever carries `--navi-confirm`, no whatever closes (`--navi-cancel`).
 * @param {import("preact").ComponentChildren} [confirmLabel] `type="confirm"`,
 *   default body: what the yes button reads. Defaults to the translated
 *   "Confirm".
 * @param {import("preact").ComponentChildren} [cancelLabel] Same, for the no
 *   button. Defaults to the translated "Cancel".
 * @param {"confirm"|"cancel"|"none"} [focusOnOpen="confirm"] `type="confirm"`,
 *   default body: which button the keyboard lands on when the popup opens.
 *   `"cancel"` is the careful choice before something that cannot be undone —
 *   a stray Enter then answers no.
 * @param {(confirmEvent: CustomEvent) => void} [onConfirm] Called once the
 *   popup has closed on a `--navi-confirm` said inside it. What a confirm
 *   picker uses to run its press; a picker of any type may listen too.
 * @param {number|string} [rightSlotIconSize="inherit"] How big what sits in the
 *   right slot is drawn — the chevron, a `rightSlotIcon`, or the clear button's
 *   cross. "inherit" takes the picker's own font size.
 * @param {number|string} [slotSpacing] Gap kept between what sits in the right
 *   slot (the chevron, or the clear button) and the picker's own edge — same
 *   prop name Input uses for its own slots. Accepts a spacing token ("s",
 *   "m"…) like any other spacing prop, or a length. Defaults to half the
 *   horizontal padding.
 * @param {number|string} [popoverMaxHeight] Soft cap on the popover's height
 *   (default 300px). The popover shrinks below it when space is tight.
 * @param {number|string} [dialogMinWidth] Floor on the dialog's width. A dialog
 *   picker is not attached to its trigger and does not take its width (unlike
 *   the popover, which uses it as a floor) — this is how a dialog too narrow
 *   for what it holds is widened. Clamped by `dialogMaxWidth`/the container.
 * @param {number|string} [dialogMinHeight] Same, on the height.
 * @param {number|string} [dialogMaxWidth] Ceiling on the dialog's width, the
 *   one `dialogExpand`/`dialogExpandX` grows up to — what makes an expanded
 *   dialog a large sheet rather than a full screen. Capped in turn by the
 *   container minus `marginWithContainer`. Describes the centered shape only:
 *   a dialog docked by `dockedOnSmallTouchScreen` withdraws it and stays
 *   container-wide, so both can be stated at once.
 * @param {number|string} [dialogMaxHeight] Same, on the height.
 * @param {"cancel"|"close"} [escapeEffect="cancel"] What Escape does to an open
 *   picker. "cancel" puts back the value the picker had at open, and a dialog
 *   picker also goes back in history — so anything written to the url while it
 *   was open (a route `stateSignal`, a search param) goes back with it. "close"
 *   makes Escape say what clicking outside says: keep what was chosen, close —
 *   a last resort, see docs/popup_open.md ("Escape cancels, the other gestures
 *   keep") for why Escape should go on meaning cancel, and for what the value
 *   at open is on the picker's very first open.
 * @param {import("preact").RefObject<HTMLElement>|HTMLElement} [anchor] What
 *   the popup hangs off, when that is not the picker itself: a picker whose
 *   trigger is one piece of a bigger control (the chevron half of a split
 *   button) points at the whole control, so the popup lines up with it and is
 *   at least as wide as it.
 * @param {boolean} [allowNameless] - This picker is a door, not a field: it
 *   opens something and holds no value of its own, so the form or group around
 *   it expects nothing from it and says nothing about its missing name.
 * @param {"close"|"cancel"|"capture"} [pointerInteractionOutsideEffect="close"]
 *   What a click outside the popup does: close and keep ("close"), close and
 *   put back the value at open ("cancel"), or nothing at all ("capture"). The
 *   default is what gives a popup with no confirm button its way out that
 *   keeps — see the same section.
 * @param {"auto"|"discrete"|"invisible"} [backdropVariant="auto"] How visible the
 *   popup's backdrop is, independently of what a click outside does: `"auto"`
 *   is the paint `pointerInteractionOutsideEffect` implies, `"discrete"` a
 *   barely-there dim, `"invisible"` fully transparent. For a picker that closes on
 *   an outside click without wanting to dim the page for it.
 * @param {number|string} [marginWithContainer] Minimum gap kept between the
 *   popup and the edges of what contains it (the viewport, or the picker's own
 *   positioned ancestor for `popupLayer="local"`). Caps the popup's size as
 *   well as its placement, so what an expanded dialog leaves visible around
 *   itself is set here. Defaults to `popoverSpacing` in popover mode, and to
 *   Dialog's own 3vvw in dialog mode.
 * @param {string} [popupTestId] The `data-testid` of the popup element — the
 *   popover or dialog the children open in. A `data-testid` on the picker
 *   itself names the trigger (see docs/testid.md); this one is for a test that
 *   needs the popup's own box — its surface, its position, its backdrop — and
 *   not only what it holds, which a testid inside the children already names.
 *   A `mode="callout"` picker has no popup of its own — the callout is the
 *   control's, shared with its constraint messages — so it is not named.
 * @param {string} [confirmTestId] `type="confirm"`, default body: the
 *   `data-testid` of the yes button; `cancelTestId` that of the no button.
 *   Both are elements navi builds, which a test may not name by class (see
 *   docs/testid.md).
 * @param {string} [cancelTestId]
 * @param {boolean} [mountWhenClosed] The popup's own (see Popup): build the
 *   children before any opening. Left out, a picker told no value builds them
 *   right away — it reads its value off the control they hold — and one told
 *   a value waits for the first open. A `type="confirm"` picker never builds
 *   them early: its popup is a question, there is nothing to read.
 * @param {boolean} [unmountWhenClosed] The popup's own: throw the children
 *   away once the popup has closed.
 */
// Every picker type is resolved into one of these before it gets here (see
// PickerTypeResolver and resolveInputProps): a native input type, or navi_js
// for the ones whose value is a whole object. Anything else is a type nobody
// implements — the picker then behaves as a plain text one, silently, and an
// object value reaches the DOM as "[object Object]".
const PICKER_RESOLVED_TYPE_SET = new Set([
  "text",
  "search",
  "tel",
  "url",
  "email",
  "password",
  "number",
  "range",
  "date",
  "month",
  "week",
  "time",
  "datetime-local",
  "color",
  "file",
  "checkbox",
  "radio",
  "hidden",
  "navi_js",
]);
const pickerTypeWarnedSet = new Set();
// A headless picker draws nothing at all — no value, no slot — so anything a
// caller wrote for either is silently dropped. Said out loud, because a prop
// that renders nowhere looks exactly like a prop that does not work.
let uiDrawnByNobodyWarned = false;
const warnOnUIDrawnByNobody = (props) => {
  if (!import.meta.dev || uiDrawnByNobodyWarned) {
    return;
  }
  const { ui, variant } = props;
  if (variant !== "headless" || ui === undefined || ui === "default") {
    return;
  }
  uiDrawnByNobodyWarned = true;
  console.warn(
    `[navi] <Picker variant="headless" ui={…}> — a headless picker draws nothing, so this "ui" is never rendered. ` +
      `For a trigger that is one icon of your own: <Picker variant="icon" ui={<YourSvg />}>.`,
  );
};

const warnOnUnknownPickerType = (props) => {
  if (!import.meta.dev) {
    return;
  }
  const { type } = props;
  if (type === undefined || PICKER_RESOLVED_TYPE_SET.has(type)) {
    return;
  }
  if (pickerTypeWarnedSet.has(type)) {
    return;
  }
  pickerTypeWarnedSet.add(type);
  console.warn(
    `[navi] <Picker type="${type}"> — "${type}" is not a picker type. ` +
      `The picker holds a single text value instead, so an object given to it is written as "[object Object]". ` +
      `Types are: date, month, week, time, datetime, duration, color, file, text, array, object, confirm — ` +
      `"object" being the one for a popup holding several named controls.`,
  );
};

export const Picker = createComponentResolver([
  PickerFirstResolver,
  PickerPresetResolver,
  PickerConfirmResolver,
  PickerCustomResolver,
  PickerTypeResolver,
  PickerButton,
]);

Picker.Chip = PickerChip;

Picker.UI = PickerDefaultUI;

Picker.UI.Date = PickerDateUI;
Picker.UI.Time = PickerTimeUI;
Picker.UI.Duration = PickerDurationUI;
Picker.UI.Week = PickerWeekUI;
Picker.UI.Datetime = PickerDatetimeUI;
Picker.UI.File = PickerFileUI;
Picker.UI.Color = PickerColorUI;
Picker.UI.Object = PickerObjectUI;
Picker.UI.Multiple = PickerArrayUI;

Picker.UI.PencilSvg = PencilSvg;
Picker.UI.ChevronDownSvg = ChevronDownSvg;
Picker.UI.ClockSvg = ClockSvg;
Picker.UI.DurationSvg = DurationSvg;
Picker.UI.CalendarSvg = CalendarSvg;
Picker.UI.FileSvg = FileSvg;
Picker.UI.ColorSvg = ColorSvg;
