import { useRef } from "preact/hooks";

import { useControlProps } from "../control/control_hooks.jsx";
import { useAccentColorAttributes } from "../utils/use_accent_color_attributes.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Text } from "./text.jsx";

const css = /* css */ `
  @layer navi {
  }
  .navi_badge {
    --font-size: 0.7em;
    --padding-x: 0.8em;
    --padding-y: 0.4em;

    --x-background: var(--background, light-dark(#e0e0e0, #3a3a3a));
    --x-background-color: var(--background-color, var(--x-background));
    /* Default: white text — works on colored backgrounds.
       Overridden to dark when the bg is light enough (data-accent-needs-dark-fg)
       or when no background prop is passed (data-badge-default-bg). */
    --x-color: var(--color, white);

    position: relative;
    display: inline-flex;
    max-width: 200px;
    padding-top: var(--padding-y);
    padding-right: var(--padding-x);
    padding-bottom: var(--padding-y);
    padding-left: var(--padding-x);
    align-items: stretch;
    color: var(--x-color);
    font-size: var(--font-size);
    line-height: normal;
    background: var(--x-background);
    background-color: var(--x-background-color);
    border-radius: 1em;

    /* Light colored background needs dark text */
    &[data-accent-needs-dark-fg] {
      --x-color: var(--color, #333);
    }

    &[data-text-overflow] .navi_text_overflow_wrapper {
      /* Keep badge text and button together */
      gap: 0;
    }

    [role="button"] {
      display: inline-flex;
      margin-top: calc(-1 * var(--padding-y));
      margin-bottom: calc(-1 * var(--padding-y));
      padding-right: calc(var(--padding-x) / 2);
      padding-left: calc(var(--padding-x) / 2);
      align-items: center;
      cursor: pointer;
      user-select: none;

      &:first-child {
        margin-left: calc(-1 * var(--padding-x));
        border-top-left-radius: inherit;
        border-bottom-left-radius: inherit;
      }

      &:last-child {
        margin-right: calc(-1 * var(--padding-x));
        border-top-right-radius: inherit;
        border-bottom-right-radius: inherit;
      }

      &:hover {
        background: rgba(0, 0, 0, 0.15);
      }
    }
  }
`;

export const Badge = ({ children, className, ...props }) => {
  import.meta.css = css;
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const { ref } = props;
  useAccentColorAttributes(ref, null);

  return (
    <Text
      className={withPropsClassName("navi_badge", className)}
      bold
      overflowEllipsis
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing={<span></span>}
    >
      {children}
    </Text>
  );
};
const BadgeStyleCSSVars = {
  borderWidth: "--border-width",
  borderRadius: "--border-radius",
  paddingRight: "--padding-right",
  paddingLeft: "--padding-left",
  backgroundColor: "--background-color",
  background: "--background",
  borderColor: "--border-color",
  color: "--color",
  fontSize: "--font-size",
};

const BadgeButton = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const [buttonProps, remainingProps] = useControlProps(props, {
    controlType: "button",
    statePropName: "value",
    allowNameless: true,
  });

  return (
    <Text
      overflowPinned
      className="navi_badge_button"
      role="button"
      onnavi_get_value={(e) => {
        e.detail.respondWith(props.value);
      }}
      {...buttonProps}
      {...remainingProps}
    />
  );
};
Badge.Button = BadgeButton;
