import { useContext } from "preact/hooks";

import { Box, BoxForwardedPropsContext } from "../../box/box.jsx";
import { LoadingOutline } from "../../graphic/loading/loading_outline.jsx";
import { getHrefTargetInfo } from "../../nav/browser_integration/href_target_info.js";
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
      --button-outline-offset: calc(-1 * var(--button-outline-width) / 2);
      --button-outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --button-padding-x-default: var(--navi-button-padding-x-default);
      --button-padding-y-default: var(--navi-button-padding-y-default);
      --button-loader-color: var(--navi-loader-color);
      --button-border-color: var(--navi-control-border-color);
      --button-background-color: var(
        --button-background,
        light-dark(#f3f4f6, #2d3748)
      );
      --button-color: currentColor;
      --button-cursor: pointer;
      --button-font-size: var(--navi-control-font-size);
      --button-font-family: var(--navi-control-font-family);

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
      /* Pressed */
      --button-border-color-pressed: color-mix(
        in srgb,
        var(--button-border-color) 90%,
        black
      );
      /* Readonly */
      --button-border-color-readonly: color-mix(
        in srgb,
        var(--button-border-color) 30%,
        white
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
    }
  }

  a.navi_button {
    display: inline-block;
    color: inherit;
    text-align: center;
    text-decoration: none;
  }

  .navi_button {
    --x-button-outline-offset: var(--button-outline-offset);
    --x-button-border-color: var(--button-border-color);
    --x-button-background: var(--button-background);
    --x-button-background-color: var(--button-background-color);
    --x-button-color: var(--button-color);
    --x-button-cursor: var(--button-cursor);

    box-sizing: border-box;
    aspect-ratio: inherit;
    padding: 0;
    color: var(--x-button-color);
    background: none;
    border: none;
    border-radius: var(--button-border-radius);
    outline: none;
    cursor: var(--x-button-cursor);
    -webkit-tap-highlight-color: transparent;
    position: relative;
    font-size: var(--button-font-size);
    font-family: var(--button-font-family);
    touch-action: manipulation;
    user-select: none;
    -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);
    display: inline-flex;

    .navi_button_content {
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
      border-width: var(--button-border-width);
      border-style: solid;
      border-color: var(--x-button-border-color);
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

    /* discrete: background on hover */
    &[data-variant="discrete"] {
      --x-button-background-color: transparent;
      --x-button-border-color: transparent;

      &[data-hover] {
        --x-button-border-color: transparent;
        --x-button-background-color: color-mix(
          in srgb,
          currentColor 8%,
          transparent
        );
      }
      &[data-readonly] {
        --x-button-border-color: transparent;
        --x-button-background-color: transparent;
      }
      &[data-disabled] {
        --x-button-border-color: transparent;
        --x-button-background-color: transparent;
      }
    }
    /* discrete-border: border on hover */
    &[data-variant="discrete-border"] {
      --x-button-background-color: transparent;
      --x-button-border-color: transparent;

      &[data-hover] {
        --x-button-border-color: var(--button-border-color-hover);
      }
      &[data-readonly] {
        --x-button-border-color: transparent;
      }
      &[data-disabled] {
        --x-button-border-color: transparent;
      }
    }
    /* border variant: no background, border only */
    &[data-variant="border"] {
      --x-button-background-color: transparent;

      &[data-hover] {
        --x-button-background-color: color-mix(
          in srgb,
          currentColor 8%,
          transparent
        );
      }
      &[data-readonly] {
        --x-button-background-color: transparent;
      }
      &[data-disabled] {
        --x-button-background-color: transparent;
      }
    }
    &[data-icon] {
      --button-padding: 0;
    }
    /* cta: call-to-action — special background, border matches background */
    &[data-cta] {
      --x-button-background-color: var(--button-cta-background-color);
      --x-button-border-color: var(--button-cta-background-color);
      --x-button-color: white;

      &[data-hover] {
        --x-button-background-color: color-mix(
          in srgb,
          var(--button-cta-background-color) 85%,
          white
        );
        --x-button-border-color: color-mix(
          in srgb,
          var(--button-cta-background-color) 85%,
          white
        );
      }
      &[data-readonly] {
        --x-button-background-color: color-mix(
          in srgb,
          var(--button-cta-background-color) 50%,
          white
        );
        --x-button-border-color: color-mix(
          in srgb,
          var(--button-cta-background-color) 50%,
          white
        );
      }
      &[data-disabled] {
        --x-button-background-color: color-mix(
          in srgb,
          var(--button-cta-background-color) 40%,
          white
        );
        --x-button-border-color: color-mix(
          in srgb,
          var(--button-cta-background-color) 40%,
          white
        );
        --x-button-color: color-mix(in srgb, white 60%, transparent);
      }
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

    // visual
    variant,
    icon,
    cta,
    spacing,
  } = props;
  const [buttonControlHostProps, buttonControlRootProps] = useControlProps(
    props,
    {
      controlType: "button",
      statePropName: "value",
      allowNameless: true,
    },
  );
  const { basePseudoState, children } = buttonControlHostProps;
  const loading = basePseudoState[":-navi-loading"];

  const isLink = href !== undefined;
  let as = "button";
  let innerTarget;
  let innerRel;
  if (isLink) {
    as = "a";
    const { isSameSite } = getHrefTargetInfo(href);
    innerTarget =
      target === undefined ? (isSameSite ? undefined : "_blank") : target;
    innerRel =
      rel === undefined
        ? isSameSite
          ? undefined
          : "noopener noreferrer"
        : rel;
  }

  const visualSelector = ".navi_button_content";
  useAccentColorAttributes(ref, null, {
    elementSelector: visualSelector,
  });

  return (
    <Box
      {...buttonControlRootProps}
      {...buttonControlHostProps}
      // eslint-disable-next-line react/no-children-prop
      children={undefined}
      spacing={undefined}
      ref={ref}
      as={as}
      href={href}
      target={innerTarget}
      rel={innerRel}
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
        loading={loading}
        inset={-1}
        color="var(--button-loader-color)"
      />
      <ControlChildrenWrapper>
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
  "padding": "--button-padding",
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
