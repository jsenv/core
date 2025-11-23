import { useRef } from "preact/hooks";

import { Text } from "./text.jsx";
import { useContrastingColor } from "./use_contrasting_color.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_badge_count {
      --border-radius: 1em;
    }
  }
  .navi_badge_count {
    --inner-spacing: 0.2em;
    --size: 1em;
    --x-outer-size: calc(var(--size) + var(--inner-spacing));
    --x-offset-top: calc(-0.5 * (1em - var(--size)));

    display: inline-block;
    box-sizing: border-box;
    min-width: var(--size);
    height: var(--size);
    max-height: var(--size);
    margin-top: var(--x-offset-top);
    color: var(--color, var(--color-contrasting));
    text-align: center;
    line-height: var(--size);
    /* vertical-align: middle; */
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-radius: var(--border-radius, 1em);
  }
  .navi_badge_count[data-single-digit] {
    --size: 1.2em;
  }
  .navi_badge_count[data-two-digits] {
    --size: 1.4em;
  }

  .navi_count_badge_overflow {
    position: relative;
    top: -0.4em;
    font-size: 0.8em;
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
};

const BadgeCountOverflow = () => (
  <span className="navi_count_badge_overflow">+</span>
);

export const BadgeCount = ({
  children,
  max,
  maxElement = <BadgeCountOverflow />,
  ...props
}) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  const numericValue =
    typeof children === "string" ? parseInt(children, 10) : children;
  // Calculer la valeur à afficher en fonction du paramètre max
  const getDisplayValue = () => {
    if (max === undefined) {
      return children;
    }

    const numericMax = typeof max === "string" ? parseInt(max, 10) : max;
    if (isNaN(numericValue) || isNaN(numericMax)) {
      return children;
    }
    if (numericValue > numericMax) {
      return (
        <>
          {children}
          {maxElement}
        </>
      );
    }
    return children;
  };

  const displayValue = getDisplayValue();
  useContrastingColor(ref);

  const digitCount = String(numericValue).length;

  return (
    <Text
      ref={ref}
      className="navi_badge_count"
      bold
      data-single-digit={digitCount.length === 1 ? "" : undefined}
      data-two-digits={digitCount.length === 2 ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {displayValue}
    </Text>
  );
};
