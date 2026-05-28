import { useContext, useRef } from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { Box, BoxForwardedPropsContext } from "../box/box.jsx";
import { LoadingOutline } from "../graphic/loading/loading_outline.jsx";
import { getHrefTargetInfo } from "../nav/browser_integration/href_target_info.js";
import { assertRoute, useRouteStatus } from "../nav/route.js";
import { Text, markAsOutsideTextFlow } from "../text/text.jsx";
import { useAccentColorAttributes } from "../utils/use_accent_color_attributes.js";
import { ActionContext } from "./control_context.js";
import { useControlProps } from "./control_hooks.jsx";
import { FormContext } from "./form_context.js";
import { ParentUIStateControllerContext } from "./ui_state_controller.js";
import {
  dispatchRequestAction,
  dispatchRequestInteraction,
} from "./validation/custom_constraint_validation.js";

/**
 * Notes on Button uiAction and action behavior regarding their context (form, radio list, picker):
 *
 * - A button ui action receives closest ui state in param (form, radiolist, ...)
 * - If button is type="submit" it will try to execute closest form action
 *   but ideally you should prefer the syntax <Button uiAction="submit"> as it works in other context too (picker)
 *   and try to execute closest action on form/radiolist etc and uiAction on picker
 *   (This way you can copy paste <Button uiAction="submit"> inside form or inside picker and it works)
 * - A button with an action should not use type="submit" or uiAction="submit" as it would execute both closest action and his own
 */

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
      --button-border-radius: 2px;
      --button-outline-width: 1px;
      --button-border-width: 1px;

      --button-outline-color: var(--navi-focus-outline-color);
      --button-loader-color: var(--navi-loader-color);
      --button-border-color: light-dark(#767676, #8e8e93);
      --button-background-color: var(
        --button-background,
        light-dark(#f3f4f6, #2d3748)
      );
      --button-color: currentColor;
      --button-cursor: pointer;

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
    /* outline will draw the border when visible */
    --x-button-outline-width: calc(
      var(--button-outline-width) + var(--button-border-width)
    );
    --x-button-outline-offset: calc(-1 * var(--button-border-width));
    --x-button-border-color: var(--button-border-color);
    --x-button-background: var(--button-background);
    --x-button-background-color: var(--button-background-color);
    --x-button-color: var(--button-color);
    --x-button-cursor: var(--button-cursor);

    box-sizing: border-box;
    aspect-ratio: inherit;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--button-border-radius);
    outline: none;
    cursor: var(--x-button-cursor);
    -webkit-tap-highlight-color: transparent;
    position: relative;
    touch-action: manipulation;
    user-select: none;

    &[data-accent-needs-dark-fg] {
      --button-color: black;
    }

    &[data-icon] {
      --button-padding: 0;
    }

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
      color: var(--x-button-color);
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
      outline-width: var(--x-button-outline-width);
      outline-color: var(--button-outline-color);
      outline-offset: var(--x-button-outline-offset);
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

    &[data-reveal-on-interaction] {
      --x-button-background-color: transparent;
      --x-button-border-color: transparent;
    }

    /* Hover */
    &[data-hover] {
      --x-button-border-color: var(--button-border-color-hover);
      --x-button-background-color: var(--button-background-color-hover);
      --x-button-color: var(--button-color-hover);
    }
    &[data-nohover] {
      --x-button-border-color: var(--button-border-color);
      --x-button-background-color: var(--button-background-color);
      --x-button-color: var(--button-color);
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

      color: unset;

      /* Remove pressed effects */
      .navi_button_content {
        transform: none;

        .navi_button_shadow {
          box-shadow: none;
        }
      }
    }
    /* Discrete variant */
    &[data-discrete] {
      --x-button-background-color: transparent;
      --x-button-border-color: transparent;

      &[data-hover] {
        --x-button-border-color: var(--button-border-color-hover);
      }
      &[data-nohover] {
        --x-button-border-color: transparent;
      }
      &[data-readonly] {
        --x-button-border-color: transparent;
      }
      &[data-disabled] {
        --x-button-border-color: transparent;
      }
    }
    /* Callout (info, warning, error) */
    &[data-callout] {
      --x-button-border-color: var(--callout-color);
    }
  }
`;

export const Button = (props) => {
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  const button = renderButton(ButtonUI, props);

  return button;
};

const ButtonRouteResolver = (props) => {
  const Next = useNextResolver();
  if (props.route) {
    return <ButtonWithRoute {...props} />;
  }
  return <Next {...props} />;
};
const ButtonFieldResolver = (props) => {
  const Next = useNextResolver();

  if (props.name || props.action || Object.hasOwn(props, "value")) {
    return <ButtonFieldInterface {...props} />;
  }
  return <Next {...props} />;
};
const ButtonInsideFormResolver = (props) => {
  const Next = useNextResolver();
  const formContext = useContext(FormContext);

  if (formContext) {
    return <ButtonInsideForm {...props} />;
  }
  return <Next {...props} />;
};

const renderButton = createComponentResolver([
  ButtonRouteResolver,
  ButtonInsideFormResolver,
  ButtonFieldResolver,
]);

const ButtonUI = (props) => {
  import.meta.css = css;
  const {
    ref,

    // href/link
    href,
    target,
    rel,

    // visual
    icon,
    revealOnInteraction = icon,
    discrete = icon && !revealOnInteraction,
    spacing,
    children,
    ...rest
  } = props;
  const loading = props.basePseudoState?.[":-navi-loading"];

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
      {...rest}
      ref={ref}
      as={as}
      href={href}
      target={innerTarget}
      rel={innerRel}
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
      data-icon={icon ? "" : undefined}
      data-reveal-on-interaction={revealOnInteraction ? "" : undefined}
      data-discrete={discrete ? "" : undefined}
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
      <ButtonContent spacing={spacing}>{children}</ButtonContent>
    </Box>
  );
};
const ButtonContent = ({ spacing, children }) => {
  const buttonProps = useContext(BoxForwardedPropsContext);
  return (
    <Text
      {...buttonProps}
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

const ButtonInsideForm = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      // The default action for a button inside a form is to request form action
      action={(v, { event }) => {
        const button = event.currentTarget;
        const { form } = button;
        const shouldRequestFormAction = (() => {
          if (event.defaultPrevented) {
            return false;
          }
          const button = event.currentTarget;
          const { form } = button;
          if (!form) {
            // either we are a "reset" button (not associated to the form)
            // or there is no form despites from context saying so (unlikely)
            return false;
          }
          const wouldSubmitFormByType =
            button.type === "submit" || button.type === "image";
          if (wouldSubmitFormByType) {
            return true;
          }
          const firstButtonSubmittingForm = form.querySelector(
            `button[type="submit"], input[type="submit"], input[type="image"], [data-action="submit"]`,
          );
          if (button !== firstButtonSubmittingForm) {
            // an other button is explicitly submitting the form, this one would not submit it
            // so it would have no effect
            return false;
          }
          // this is the only button inside the form without type attribute, so it defaults to type="submit"
          return true;
        })();

        if (shouldRequestFormAction) {
          dispatchRequestAction(form, {
            event,
            requester: button,
          });
          if (event.type === "click") {
            event.preventDefault(); // prevent form submission
          }
        }
      }}
      {...props}
    />
  );
};
const ButtonFieldInterface = (props) => {
  const Next = useNextResolver();
  const { ref, onClick, onMouseDown } = props;
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const ancestorAction = useContext(ActionContext);
  const [buttonProps, remainingProps] = useControlProps(props, {
    primaryInteractionMode: "pointer",
    controlType: "button",
    statePropName: "value",
    getUIValue: () => {
      const button = ref.current;
      // The button uiState is a combination of its own state (if it has a name)
      // and its parent state (if the parent is named or is a named collection)
      const buttonUIState = {};
      if (parentUIStateController) {
        const parentName = parentUIStateController.name;
        const parentUIState = parentUIStateController.uiStateSignal.peek();
        if (parentName) {
          buttonUIState[parentName] = parentUIState;
        }
        // this is how we detect named collection for now (they don't have a name and have an object in their ui state)
        else if (typeof parentUIState === "object" && parentUIState !== null) {
          Object.assign(buttonUIState, parentUIState);
        } else {
          // no name, we don't know where to put that value right?
        }
      }
      if (button.name) {
        buttonUIState[button.name] = button.value;
      }
      if (!parentUIStateController && !button.name) {
        return props.value;
      }
      return buttonUIState;
    },
    allowNameless: true,
    // button inherit their ancestor params:
    // - inside a form button action gets the form params
    // - inside a radio list or a picker it's the same
    paramsSignal: ancestorAction ? ancestorAction.paramsSignal : undefined,
  });

  return (
    <Next
      {...buttonProps}
      {...remainingProps}
      onMouseDown={(e) => {
        onMouseDown?.(e);
        // we set pressed state on mouse down so that button feels responsive, but we dispatch action on click to allow preventing default without blocking pressed state
        const button = ref.current;
        dispatchRequestInteraction(button, e);
      }}
      onClick={(e) => {
        onClick?.(e);
        const button = ref.current;
        dispatchRequestAction(button, { event: e });
      }}
    />
  );
};

const ButtonWithRoute = (props) => {
  const Next = useNextResolver();
  const { route, routeParams, children, ...rest } = props;
  if (import.meta.dev) {
    assertRoute(route);
  }
  const url = route.buildUrl(routeParams);
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const linkMatching = matching && paramsAreMatching;

  return (
    <Next
      href={url}
      data-href-current={linkMatching ? "" : undefined}
      {...rest}
    >
      {children || route.buildRelativeUrl(routeParams)}
    </Next>
  );
};
