import { useRef } from "preact/hooks";

import { useAccentColorAttributes } from "../utils/use_accent_color_attributes.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Text } from "./text.jsx";

const css = /* css */ `
  @layer navi {
    .navi_badge {
      --light-color: #e6e6e6;
      --dark-color: #444;
    }
  }
  .navi_badge {
    --font-size: 0.7em;
    --color: var(--light-color);
    --padding-x: 0.8em;
    --padding-y: 0.4em;

    --x-background: var(--background, light-dark(#e0e0e0, #3a3a3a));
    --x-background-color: var(--background-color, var(--x-background));
    --x-color-contrasting: var(--navi-color-white);
    --x-color: var(--color);

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

    &[data-accent-needs-dark-fg] {
      --x-color: var(--dark-color);
      --x-color-contrasting: var(--navi-color-black);
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
