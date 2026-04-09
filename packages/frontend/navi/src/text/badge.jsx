import { useRef } from "preact/hooks";

import { Text } from "./text.jsx";
import { useDarkBackgroundAttribute } from "./use_dark_background_attribute.js";

import.meta.css = /* css */ `
  @layer navi {
  }
  .navi_badge {
    --font-size: 0.7em;
    --x-background: var(--background);
    --x-background-color: var(--background-color, var(--x-background));
    --x-color-contrasting: var(--navi-color-black);
    --x-color: var(--color, var(--x-color-contrasting));
    --padding-x: 0.8em;
    --padding-y: 0.4em;
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

    &[data-dark-background] {
      --x-color-contrasting: var(--navi-color-white);
    }
  }
`;

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

export const Badge = ({ children, ...props }) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  useDarkBackgroundAttribute(ref);

  return (
    <Text
      ref={ref}
      className="navi_badge"
      bold
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      <span style="user-select: none">&#8203;</span>
      {children}
      <span style="user-select: none">&#8203;</span>
    </Text>
  );
};
