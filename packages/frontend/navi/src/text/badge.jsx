import { useRef } from "preact/hooks";

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
    display: inline-block;
    padding-top: var(--padding-y);
    padding-right: var(--padding-x);
    padding-bottom: var(--padding-y);
    padding-left: var(--padding-x);
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

    .navi_badge_button {
      display: inline-flex;
      padding: 0 var(--padding-x) 0 0.35em;
      align-items: center;
      justify-content: center;
      color: inherit;
      border-radius: 0 1em 1em 0;
      opacity: 0.5;
      transition:
        opacity 0.15s,
        background 0.15s;
      cursor: pointer;
      user-select: none;

      &:hover {
        background: rgba(0, 0, 0, 0.15);
        opacity: 1;
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
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
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
