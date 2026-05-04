import { useCallback, useContext, useRef } from "preact/hooks";

import { useAction } from "../action/use_action.js";
import { useActionStatus } from "../action/use_action_status.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { getHrefTargetInfo } from "../nav/browser_integration/href_target_info.js";
import { assertRoute, useRouteStatus } from "../nav/route.js";
import { Text, markAsOutsideTextFlow } from "../text/text.jsx";
import { useAutoFocus } from "../utils/focus/use_auto_focus.js";
import { useAccentColorAttributes } from "../utils/use_accent_color_attributes.js";
import { FormActionContext } from "./form_context.js";
import { useActionEvents } from "./use_action_events.js";
import { useFormEvents } from "./use_form_events.js";
import {
  DisabledContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
} from "./use_ui_state_controller.js";
import { forwardActionRequested } from "./validation/custom_constraint_validation.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

/**
 * We need a content the visually shrink (scale down) but the button interactive are must remain intact
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
      --button-outline-width: 1px;
      --button-border-width: 1px;
      --button-border-radius: 2px;
      /* Global padding defaults — override these to change all button paddings. */
      /* Use --button-padding, --button-padding-x, --button-padding-y for per-button overrides. */
      --button-padding-x-default: 6px;
      --button-padding-y-default: 1px;
      /* default */

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
    /* Internal vars — prefixed with --x- to signal they are private, do not use from outside */
    --x-button-outline-width: var(--button-outline-width);
    --x-button-border-radius: var(--button-border-radius);
    --x-button-border-width: var(--button-border-width);
    --x-button-outer-width: calc(
      var(--x-button-border-width) + var(--x-button-outline-width)
    );
    --x-button-outline-color: var(--button-outline-color);
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
    border-radius: var(--x-button-border-radius);
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

      border-width: var(--x-button-outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--x-button-border-radius);
      outline-width: var(--x-button-border-width);
      outline-style: solid;
      outline-color: var(--x-button-border-color);
      outline-offset: calc(-1 * (var(--x-button-border-width)));
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
      --x-button-border-color: var(--x-button-outline-color);
    }
    &[data-focus-visible] {
      .navi_button_content {
        outline-width: var(--x-button-outer-width);
        outline-offset: calc(-1 * var(--x-button-outer-width));
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
  const ref = props.ref || defaultRef;

  return <ButtonDispatcher {...props} ref={ref} />;
};
const ButtonDispatcher = (props) => {
  const formContext = useContext(FormActionContext);
  const hasAction = Boolean(
    props.action || (props.shortcuts && props.shortcuts.length > 0),
  );
  if (hasAction) {
    if (formContext && props.action) {
      return <ButtonWithActionInsideForm {...props} />;
    }
    return <ButtonWithAction {...props} />;
  }
  if (props.route) {
    return <ButtonWithRoute {...props} />;
  }
  return <ButtonUI {...props} />;
};
const ButtonUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    readOnly,
    disabled,
    loading,
    autoFocus,

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
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);

  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;

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

  const renderButtonContent = (buttonProps) => {
    return (
      <Text
        {...buttonProps}
        flex={spacing !== undefined ? true : buttonProps.flex}
        spacing={spacing}
        className="navi_button_content"
      >
        {children}
        <ButtonShadow />
      </Text>
    );
  };
  const renderButtonContentMemoized = useCallback(renderButtonContent, [
    children,
    spacing,
  ]);

  return (
    <Box
      data-readonly-silent={innerLoading ? "" : undefined}
      {...remainingProps}
      ref={ref}
      autFocus={undefined} // See use_auto_focus.js
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
      aria-busy={innerLoading}
      // style management
      baseClassName="navi_button"
      styleCSSVars={ButtonStyleCSSVars}
      pseudoClasses={ButtonPseudoClasses}
      pseudoElements={ButtonPseudoElements}
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      visualSelector={visualSelector}
      hasChildFunction
    >
      <LoaderBackground
        loading={innerLoading}
        inset={-1}
        color="var(--button-loader-color)"
      />
      {renderButtonContentMemoized}
    </Box>
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

const ButtonWithRoute = (props) => {
  const { route, routeParams, children, ...rest } = props;
  if (import.meta.dev) {
    assertRoute(route);
  }
  const url = route.buildUrl(routeParams);
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const linkMatching = matching && paramsAreMatching;

  return (
    <ButtonDispatcher
      href={url}
      data-href-current={linkMatching ? "" : undefined}
      {...rest}
      route={undefined}
      routeParams={undefined}
    >
      {children || route.buildRelativeUrl(routeParams)}
    </ButtonDispatcher>
  );
};
const ButtonWithAction = (props) => {
  const {
    ref,
    action,
    loading,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;
  const boundAction = useAction(action);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });

  const innerLoading = loading || actionLoading;

  useActionEvents(ref, {
    onPrevented: onActionPrevented,
    onRequested: (e) => forwardActionRequested(e, boundAction),
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <ButtonDispatcher
      // put data-action first to help find it in devtools
      data-action={boundAction.name}
      {...rest}
      ref={ref}
      action={undefined}
      loading={innerLoading}
    >
      {children}
    </ButtonDispatcher>
  );
};
const ButtonWithActionInsideForm = (props) => {
  const {
    ref,
    type,
    action,
    loading,
    children,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    ...rest
  } = props;
  const formAction = useContext(FormActionContext);
  const hasEffectOnForm =
    type === "submit" || type === "reset" || type === "image";
  if (import.meta.dev && hasEffectOnForm) {
    throw new Error(
      `<Button type="${type}" /> should not have their own action`,
    );
  }
  const formParamsSignal = formAction.paramsSignal;
  const actionBoundToFormParams = useAction(action, formParamsSignal);
  const { loading: actionLoading } = useActionStatus(actionBoundToFormParams);

  const innerLoading = loading || actionLoading;
  useFormEvents(ref, {
    onFormActionPrevented: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionPrevented?.(e);
      }
    },
    onFormActionStart: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionStart?.(e);
      }
    },
    onFormActionAbort: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionAbort?.(e);
      }
    },
    onFormActionError: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionError?.(e.detail.error);
      }
    },
    onFormActionEnd: (e) => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionEnd?.(e);
      }
    },
  });

  return (
    <ButtonDispatcher
      data-action={actionBoundToFormParams.name}
      {...rest}
      ref={ref}
      action={undefined}
      type={type}
      loading={innerLoading}
      onnavi_action_requested={(e) => {
        forwardActionRequested(e, actionBoundToFormParams, e.target.form);
      }}
    >
      {children}
    </ButtonDispatcher>
  );
};
