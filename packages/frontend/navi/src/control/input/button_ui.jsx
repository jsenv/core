import { useContext } from "preact/hooks";

import { Box, BoxForwardedPropsContext } from "../../box/box.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { useDocumentUrl } from "../../nav/browser_integration/document_url_signal.js";
import { getHrefTargetInfo } from "../../nav/browser_integration/href_target_info.js";
import { LINK_REPLACE_ATTRIBUTE } from "../../nav/browser_integration/link_replace.js";
import { PRESSABLE_ATTRIBUTE } from "../../nav/transition_press.js";
import { Text, markAsOutsideTextFlow } from "../../text/text.jsx";
import { useAccentColorAttributes } from "../../utils/use_accent_color_attributes.js";
import { ControlChildrenWrapper, useControlProps } from "../control_hooks.jsx";

/**
 * We need the content to visually shrink (scale down) but the button interactive area MUST remain intact
 * Otherwise a click on the edges of the button cannot not trigger the click event (mouseup occurs outside the button)
 **/

/**
 * We have to re-define the CSS of button because getComputedStyle(button).borderColor returns
 * rgb(0, 0, 0) while being visually grey in chrome
 * So we redefine chrome styles so that loader can keep up with the actual color visible to the user
 */
const css = /* css */ `
  @layer navi {
    .navi_button {
      --button-border-radius: var(--navi-control-border-radius);
      --button-border-width: var(--navi-control-border-width);
      --button-cta-background-color: var(--navi-accent-color);
      /* Focus outline */
      --button-outline-width: var(--navi-focus-outline-width);
      --button-outline-offset: calc(-0.5 * var(--button-outline-width));
      --button-outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --button-padding-x-default: var(--navi-button-padding-x-default);
      --button-padding-y-default: var(--navi-button-padding-y-default);
      --button-loader-color: var(--navi-loader-color);
      --button-border-color: var(--navi-control-border-color);
      --button-background-color: var(
        --button-background,
        var(--navi-button-background-color)
      );
      --button-color: currentColor;
      --button-cursor: pointer;
      --button-font-size: var(--navi-control-font-size);
      --button-font-family: var(--navi-control-font-family, inherit);

      /* Hover */
      --button-border-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 70%,
        black
      );
      --button-background-color-hover: color-mix(
        in srgb,
        var(--button-background-color) 95%,
        black
      );
      --button-color-hover: var(--button-color);
      /* Current: the button points at the page one is already on. Nothing by
         default — it is a nav item that wants to say so, not every button. */
      --button-border-color-current: var(--button-border-color);
      --button-background-color-current: var(--button-background-color);
      --button-color-current: var(--button-color);
      /* Pressed */
      --button-border-color-pressed: color-mix(
        in srgb,
        var(--button-border-color) 90%,
        black
      );
      /* Readonly */
      /* Fading toward the surface, not toward white: "washed out" means
         closer to the paper behind the button, whatever color that paper is
         (white here IS the surface only in the light theme). */
      --button-border-color-readonly: color-mix(
        in srgb,
        var(--button-border-color) 30%,
        var(--navi-surface-color)
      );
      --button-background-color-readonly: var(--button-background-color);
      --button-color-readonly: color-mix(
        in srgb,
        var(--button-color) 30%,
        transparent
      );
      /* Disabled */
      --button-border-color-disabled: var(--button-border-color-readonly);
      --button-background-color-disabled: var(
        --button-background-color-readonly
      );
      --button-color-disabled: var(--button-color-readonly);

      /* Here to be easy to override */
      /* Layered, this one and the three below: display so box.jsx's unlayered
         [navi-box-flow] can put the button inline-flex, the font and the line
         so an app's own button typography wins without having to go through
         the --button-* variables. */
      display: inline-block;
      font-size: var(--button-font-size);
      font-family: var(--button-font-family);
      /* A form control comes with a line of its own from the browser, and that
         line is "normal": a label holding an emoji would then be taller than
         the same label without one. The page's line, like the page's font. */
      line-height: var(--navi-control-line-height);
    }
  }

  a.navi_button {
    text-align: center;
    text-decoration: none;
  }

  .navi_button {
    --x-button-outline-offset: var(--button-outline-offset);
    --x-button-border-color: var(--button-border-color);
    /* The shorthand wins over the parts when it is given, which is what makes
       border="none" remove the line: the parts alone can only ever describe
       a border, never the absence of one. */
    --x-button-border: var(
      --button-border,
      var(--button-border-width) solid var(--x-button-border-color)
    );
    --x-button-background: var(--button-background);
    --x-button-background-color: var(--button-background-color);
    --x-button-color: var(--button-color);
    --x-button-cursor: var(--button-cursor);

    position: relative;
    box-sizing: border-box;
    aspect-ratio: inherit;
    padding: 0;
    color: var(--x-button-color);
    background: none;
    border: none;
    /* Squared from the outside, corner by corner: a Group asks the member it
       joins for square corners along the seam, and the button it means may
       arrive wrapped (in a tooltip, in a link), so the ask travels down as
       inherited custom properties rather than as a selector aimed at the
       button. Each corner falls back to the button's own radius when nothing
       asks for anything. */
    border-top-left-radius: var(
      --x-corner-top-left-radius,
      var(--button-border-radius)
    );
    border-top-right-radius: var(
      --x-corner-top-right-radius,
      var(--button-border-radius)
    );
    border-bottom-right-radius: var(
      --x-corner-bottom-right-radius,
      var(--button-border-radius)
    );
    border-bottom-left-radius: var(
      --x-corner-bottom-left-radius,
      var(--button-border-radius)
    );
    outline: none;
    cursor: var(--x-button-cursor);
    touch-action: manipulation;
    user-select: none;

    .navi_button_content {
      /* The ask stops here: this element is the button's frame, so what is
         inside it (a popover the button opens, a button of its own) is no
         longer at the seam. */
      --x-corner-top-left-radius: initial;
      --x-corner-top-right-radius: initial;
      --x-corner-bottom-right-radius: initial;
      --x-corner-bottom-left-radius: initial;

      position: relative;
      display: inherit;
      box-sizing: border-box;
      aspect-ratio: inherit;
      width: 100%;
      height: 100%;
      padding-top: var(
        --button-padding-top,
        var(
          --button-padding-y,
          var(--button-padding, var(--button-padding-y-default))
        )
      );
      padding-right: var(
        --button-padding-right,
        var(
          --button-padding-x,
          var(--button-padding, var(--button-padding-x-default))
        )
      );
      padding-bottom: var(
        --button-padding-bottom,
        var(
          --button-padding-y,
          var(--button-padding, var(--button-padding-y-default))
        )
      );
      padding-left: var(
        --button-padding-left,
        var(
          --button-padding-x,
          var(--button-padding, var(--button-padding-x-default))
        )
      );
      align-items: inherit;
      justify-content: inherit;
      color: inherit;
      vertical-align: inherit;
      background: var(--x-button-background);
      background-color: var(
        --x-button-background-color,
        var(--x-button-background)
      );
      border: var(--x-button-border);
      border-radius: inherit;
      outline-width: var(--button-outline-width);
      outline-color: var(--button-outline-color);
      outline-offset: var(--button-outline-offset);
      transition-property: transform;
      transition-duration: 0.15s;
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);

      .navi_button_shadow {
        position: absolute;
        inset: calc(-1 * var(--x-button-outer-width));
        border-radius: inherit;
        pointer-events: none;
      }

      & > img {
        border-radius: inherit;
      }
    }

    /* Current */
    &[data-href-current] {
      --x-button-border-color: var(--button-border-color-current);
      --x-button-background-color: var(--button-background-color-current);
      --x-button-color: var(--button-color-current);
    }
    /* Hover */
    &[data-hover] {
      --x-button-border-color: var(--button-border-color-hover);
      --x-button-background-color: var(--button-background-color-hover);
      --x-button-color: var(--button-color-hover);
    }
    /* Pressed */
    &[data-pressed] {
      --x-button-outline-color: var(--button-border-color-pressed);
    }
    &[data-pressed] {
      .navi_button_content {
        transform: scale(0.9);
      }
    }
    &[data-pressed] {
      .navi_button_shadow {
        box-shadow:
          inset 0 3px 6px rgba(0, 0, 0, 0.2),
          inset 0 1px 2px rgba(0, 0, 0, 0.3),
          inset 0 0 0 1px rgba(0, 0, 0, 0.1),
          inset 2px 0 4px rgba(0, 0, 0, 0.1),
          inset -2px 0 4px rgba(0, 0, 0, 0.1);
      }
    }
    /* Readonly */
    &[data-readonly] {
      --x-button-border-color: var(--button-border-color-readonly);
      --x-button-background-color: var(--button-background-color-readonly);
      --x-button-color: var(--button-color-readonly);
      --x-button-cursor: default;
    }
    /* Focus */
    &[data-focus-visible] {
      --x-button-border-color: transparent;

      .navi_button_content {
        outline-style: solid;
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-button-border-color: var(--button-border-color-disabled);
      --x-button-background-color: var(--button-background-color-disabled);
      --x-button-color: var(--button-color-disabled);
      --x-button-cursor: default;

      /* Remove pressed effects */
      .navi_button_content {
        transform: none;

        .navi_button_shadow {
          box-shadow: none;
        }
      }
    }
    /* Callout (info, warning, error) */
    &[data-callout] {
      --x-button-border-color: var(--callout-color);
    }

    /* A variant states what the caller did NOT: the frameless ones below move
       the DEFAULTS (--button-*) and never the resolved values (--x-button-*),
       so a backgroundColor/background/borderColor prop — which lands inline on
       this same element — still wins. Two things come with that: the
       transparent default is written as a fallback of --button-background, so
       the background prop feeds --button-background-color through it; and the
       per-state defaults are re-pointed at the base one, otherwise the @layer
       formulas (hover = 5% black over the background, readonly = the same)
       would repaint a box the variant just took away. */

    /* discrete: background on hover, and nothing else — no box at rest, and no
       shrink when pressed. What is drawn IS the content (a chevron, a number,
       a word), and shrinking it under the finger reads as the content itself
       flinching rather than as a button being pressed. */
    &[data-variant="discrete"] {
      --button-border-width: 0;
      --button-border-color: transparent;
      --button-border-color-hover: var(--button-border-color);
      --button-border-color-current: var(--button-border-color);
      --button-border-color-readonly: var(--button-border-color);
      --button-border-color-disabled: var(--button-border-color);
      --button-background-color: var(--button-background, transparent);
      /* The hover wash is mixed INTO the background instead of replacing it:
         over the transparent default it is exactly the 8% of currentColor it
         has always been, and over a backgroundColor the caller gave it darkens
         that color rather than erasing it. */
      --button-background-color-hover: color-mix(
        in srgb,
        currentColor 8%,
        var(--button-background-color)
      );
      --button-background-color-readonly: var(--button-background-color);
      --button-background-color-disabled: var(--button-background-color);

      &[data-pressed] {
        .navi_button_content {
          transform: none;
        }
      }
    }
    /* bare: discrete, minus the background on hover. For a control whose own
       drawing IS the button (a carousel bullet, a swatch), where a box lighting
       up around it would be the button showing through the only thing one is
       supposed to see. It stays a button in every other way: focusable, ringed
       on focus, commandable. */
    &[data-variant="bare"] {
      --button-border-width: 0;
      --button-border-color: transparent;
      --button-border-color-hover: var(--button-border-color);
      --button-border-color-current: var(--button-border-color);
      --button-border-color-readonly: var(--button-border-color);
      --button-border-color-disabled: var(--button-border-color);
      --button-background-color: var(--button-background, transparent);
      --button-background-color-hover: var(--button-background-color);
      --button-background-color-readonly: var(--button-background-color);
      --button-background-color-disabled: var(--button-background-color);

      &[data-pressed] {
        .navi_button_content {
          transform: none;
        }
      }
    }
    /* discrete-border: border on hover */
    &[data-variant="discrete-border"] {
      --button-background-color: var(--button-background, transparent);
      --button-background-color-hover: var(--button-background-color);
      --button-background-color-readonly: var(--button-background-color);
      --button-background-color-disabled: var(--button-background-color);
      /* The border is the whole point of this variant: it is absent at rest
         and drawn on hover, so only the resting color goes transparent — the
         hover one keeps the @layer formula, now mixed from whatever
         borderColor the caller gave. */
      --x-button-border-color: transparent;

      &[data-hover] {
        --x-button-border-color: var(--button-border-color-hover);
      }
      &[data-readonly],
      &[data-disabled] {
        --x-button-border-color: transparent;
      }
    }
    /* border variant: no background, border only */
    &[data-variant="border"] {
      --button-background-color: var(--button-background, transparent);
      --button-background-color-hover: color-mix(
        in srgb,
        currentColor 8%,
        var(--button-background-color)
      );
      --button-background-color-readonly: var(--button-background-color);
      --button-background-color-disabled: var(--button-background-color);
    }
    /* Last word on the shrink, over whatever the variant decided: the variant
       guesses from how the button is drawn, and that guess is wrong as soon as
       the content is a box of its own — a discrete button holding a filled
       pill reads as a button being pressed, not as its content flinching. */
    &[data-press-effect="scale"][data-pressed] {
      .navi_button_content {
        transform: scale(0.9);
      }
    }
    &[data-press-effect="none"][data-pressed] {
      .navi_button_content {
        transform: none;
      }
    }

    &[data-icon] {
      --button-padding: 0;
      display: inline-flex;
    }
    /* cta: call-to-action — a filled button whose border matches its fill.
       Like the variants above it moves the DEFAULTS, so a backgroundColor /
       borderColor / color prop still wins; and its per-state formulas are
       re-pointed at the base variables, so they compose with whatever color it
       ends up filled with. A CTA lightens toward white where an ordinary
       button darkens toward black: it is already the darkest thing around. */
    &[data-cta] {
      --button-background-color: var(
        --button-background,
        var(--button-cta-background-color)
      );
      --button-border-color: var(--button-cta-background-color);
      --button-color: white;
      --button-background-color-hover: color-mix(
        in srgb,
        var(--button-background-color) 85%,
        white
      );
      --button-border-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 85%,
        white
      );
      --button-background-color-readonly: color-mix(
        in srgb,
        var(--button-background-color) 50%,
        white
      );
      --button-border-color-readonly: color-mix(
        in srgb,
        var(--button-border-color) 50%,
        white
      );
      --button-background-color-disabled: color-mix(
        in srgb,
        var(--button-background-color) 40%,
        white
      );
      --button-border-color-disabled: color-mix(
        in srgb,
        var(--button-border-color) 40%,
        white
      );
      --button-color-disabled: color-mix(
        in srgb,
        var(--button-color) 60%,
        transparent
      );
    }
  }
`;

export const ButtonUI = (props) => {
  import.meta.css = css;
  const {
    ref,

    // href/link
    href,
    target,
    rel,
    replace,
    pressableDuringRouteTransition,

    // visual
    variant,
    pressEffect,
    icon,
    cta,
    spacing,
    // Whether the button draws the loading outline itself. A button that is
    // one half of a bigger control says no: what is busy is the control, and
    // the outline belongs around the whole of it (see split_button.jsx).
    loadingOutline = true,
  } = props;
  const [
    buttonControlRootProps,
    buttonControlHostProps,
    controlChildrenWrapperProps,
  ] = useControlProps(props, {
    controlType: "button",
  });
  const { basePseudoState, children } = buttonControlHostProps;
  const loading = basePseudoState[":-navi-loading"];

  // subscribe to document url to re-render and re-compute getHrefTargetInfo
  useDocumentUrl();
  const isLink = href !== undefined;
  let as = "button";
  let innerTarget;
  let innerRel;
  let innerCurrent;
  if (isLink) {
    as = "a";
    const { isSameSite, isCurrent } = getHrefTargetInfo(href);
    innerTarget =
      target === undefined ? (isSameSite ? undefined : "_blank") : target;
    innerRel =
      rel === undefined
        ? isSameSite
          ? undefined
          : "noopener noreferrer"
        : rel;
    innerCurrent = isCurrent;
  }
  // For a button that has only an href: nothing else knows it points at the
  // page one is on. A route says so through `pseudoState`, which Box lays over
  // this one.
  buttonControlHostProps.basePseudoState = {
    ...basePseudoState,
    ":-navi-href-current": innerCurrent,
  };

  // Worn as an attribute, like a link's (see link_replace.js): read off the
  // anchor by the click handler, off the source by --navi-nav-to.
  const replaceRequest = replace ? { [LINK_REPLACE_ATTRIBUTE]: "" } : null;

  // Worn as an attribute too, and read at the document by whoever catches the
  // press a movement would have swallowed (see transition_press.js).
  const pressableRequest = pressableDuringRouteTransition
    ? { [PRESSABLE_ATTRIBUTE]: "" }
    : null;

  const visualSelector = ".navi_button_content";
  useAccentColorAttributes(ref, null, {
    elementSelector: visualSelector,
  });

  return (
    <Box
      inline
      block
      {...buttonControlRootProps}
      {...buttonControlHostProps}
      // eslint-disable-next-line react/no-children-prop
      children={undefined}
      // All button are forced to type="button" as a way to avoid form submission which
      // should always go through --navi-send command instead
      // without having to call preventDefault() on button clicks
      type="button"
      spacing={undefined}
      cta={undefined}
      pressEffect={undefined}
      loadingOutline={undefined}
      ref={ref}
      as={as}
      href={href}
      target={innerTarget}
      rel={innerRel}
      replace={undefined}
      {...replaceRequest}
      pressableDuringRouteTransition={undefined}
      {...pressableRequest}
      // Respond with the JS prop value directly so callers (e.g. resolveCommandValue)
      // get the original type instead of the DOM-coerced string (e.g. "[object Object]").
      onnavi_get_value={(e) => {
        e.detail.respondWith(props.value);
      }}
      onContextMenu={(e) => {
        if (as === "a") {
          // For link we keep context menu to allow "open in new tab" and other browser features
          return;
        }
        if (e.pointerType !== "touch") {
          // right click is allowed
          return;
        }
        // Suppress the native context menu triggered by long-press on touch devices.
        // Buttons have no meaningful context menu (no text to copy/paste/search),
        // and the long-press visual state would get stuck if we let the menu open.
        // Note: e.button === -1 is equivalent — it means no physical button triggered
        // the event, i.e. it was synthesized from a long-press gesture (right-click gives e.button === 2).
        e.preventDefault();
      }}
      data-variant={variant}
      data-press-effect={pressEffect}
      data-icon={icon ? "" : undefined}
      data-cta={cta ? "" : undefined}
      data-callout-arrow-x="center"
      // style management
      baseClassName="navi_button"
      styleCSSVars={ButtonStyleCSSVars}
      pseudoClasses={ButtonPseudoClasses}
      pseudoElements={ButtonPseudoElements}
      visualSelector={visualSelector}
      hasChildUsingForwardedProps
    >
      <LoadingOutline
        loading={loadingOutline && loading}
        inset={-1}
        color="var(--button-loader-color)"
      />
      <ControlChildrenWrapper {...controlChildrenWrapperProps}>
        <ButtonContent spacing={spacing}>{children}</ButtonContent>
      </ControlChildrenWrapper>
    </Box>
  );
};
const ButtonContent = ({ spacing, children }) => {
  const boxForwardedProps = useContext(BoxForwardedPropsContext);
  return (
    <Text
      {...boxForwardedProps}
      display="inherit"
      spacing={spacing}
      className="navi_button_content"
    >
      {children}
      <ButtonShadow />
    </Text>
  );
};
const ButtonStyleCSSVars = {
  "outlineWidth": "--button-outline-width",
  "borderWidth": "--button-border-width",
  "borderRadius": "--button-border-radius",
  "border": "--button-border",
  "paddingX": "--button-padding-x",
  "paddingY": "--button-padding-y",
  "paddingTop": "--button-padding-top",
  "paddingRight": "--button-padding-right",
  "paddingBottom": "--button-padding-bottom",
  "paddingLeft": "--button-padding-left",
  "borderColor": "--button-border-color",
  "background": "--button-background",
  "backgroundColor": "--button-background-color",
  "color": "--button-color",
  ":hover": {
    backgroundColor: "--button-background-color-hover",
    borderColor: "--button-border-color-hover",
    color: "--button-color-hover",
  },
  ":-navi-pressed": {
    borderColor: "--button-border-color-pressed",
  },
  ":-navi-href-current": {
    backgroundColor: "--button-background-color-current",
    borderColor: "--button-border-color-current",
    color: "--button-color-current",
  },
  ":read-only": {
    backgroundColor: "--button-background-color-readonly",
    borderColor: "--button-border-color-readonly",
    color: "--button-color-readonly",
  },
  ":disabled": {
    backgroundColor: "--button-background-color-disabled",
    borderColor: "--button-border-color-disabled",
    color: "--button-color-disabled",
  },
};
const ButtonPseudoClasses = [
  ":-navi-href-current",
  ":hover",
  ":active",
  ":-navi-pressed",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
const ButtonPseudoElements = ["::-navi-loader"];
const ButtonShadow = () => {
  return <span className="navi_button_shadow"></span>;
};
markAsOutsideTextFlow(ButtonShadow);
