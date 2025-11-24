import { useRef } from "preact/hooks";

import { Text } from "./text.jsx";
import { useContrastingColor } from "./use_contrasting_color.js";

import.meta.css = /* css */ `
  @layer navi {
  }
  .navi_badge_count {
    --x-border-radius: var(--border-radius, 1em);

    display: inline-flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    color: var(--color, var(--x-color-contrasting));
    border-radius: var(--x-border-radius);
  }
  .navi_badge_count_visual {
    width: 1lh;
    height: 1lh;
    font-size: var(--font-size, inherit);
    text-align: center;
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-radius: inherit;
  }
  .navi_count_badge_overflow {
    position: relative;
    top: -0.4em;
    font-size: 0.8em;
  }

  .navi_badge_count[data-single-digit] {
    --x-size: 1lh;
    --x-border-radius: 100%;
  }
  .navi_badge_count[data-two-digits] {
    --x-size: 1lh;
    --x-border-radius: 100%;
  }
  .navi_badge_count[data-indeterminate-digits] .navi_badge_count_visual {
    width: auto;
    height: auto;
    padding-right: 0.5em;
    padding-left: 0.5em;
    --x-border-radius: 1em;
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

const BadgeCountOverflow = () => (
  <span className="navi_count_badge_overflow">+</span>
);

export const BadgeCount = ({
  children,
  max = 99,
  maxElement = <BadgeCountOverflow />,
  ...props
}) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  const numericValue =
    typeof children === "string" ? parseInt(children, 10) : children;
  // Calculer la valeur à afficher en fonction du paramètre max
  const getDisplayValue = () => {
    if (
      max === undefined ||
      max === Infinity ||
      max === false ||
      max === "false" ||
      max === "Infinity" ||
      max === "none"
    ) {
      return children;
    }

    const numericMax = typeof max === "string" ? parseInt(max, 10) : max;
    if (isNaN(numericValue) || isNaN(numericMax)) {
      return children;
    }
    if (numericValue > numericMax) {
      return (
        <>
          {numericMax}
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
      data-single-digit={digitCount === 1 ? "" : undefined}
      data-two-digits={digitCount === 2 ? "" : undefined}
      data-indeterminate-digits={digitCount > 2 ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {/* When we double click on count we don't want to eventually select surrounding text (in case) */}
      {/* the surrounding text has no spaces so we add "&#8203;" (zero-width space char) */}
      {/* This also forces .navi_badge_count to take 1 line-height even if .navi_badge_count_visual font-size differs  */}
      <span style="user-select: none">&#8203;</span>
      {/* Force element to take 1 line-height */}
      <span className="navi_badge_count_visual">{displayValue}</span>
      <span style="user-select: none">&#8203;</span>
    </Text>
  );
};
