import { useRef } from "preact/hooks";

import { Text } from "./text.jsx";
import { useContrastingColor } from "./use_contrasting_color.js";

import.meta.css = /* css */ `
  @layer navi {
  }
  .navi_badge_count {
    --x-size: 1.5em;
    --x-border-radius: var(--border-radius);
    --x-number-font-size: var(--font-size);

    display: inline-block;
    box-sizing: border-box;
    color: var(--color, var(--x-color-contrasting));
    line-height: 1;
    vertical-align: baseline;
    border-radius: var(--x-border-radius);
  }
  .navi_badge_count_visual {
    display: inline-flex;
    width: var(--x-size);
    height: var(--x-size);
    align-items: inherit;
    justify-content: inherit;
    font-size: var(--font-size);
    text-align: center;
    line-height: var(--x-size);
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-radius: inherit;
  }
  .navi_badge_count_text {
    font-size: var(--x-number-font-size);
  }
  .navi_count_badge_overflow {
    position: relative;
    top: -0.4em;
    font-size: 0.8em;
  }

  .navi_badge_count[data-single-digit] {
    --x-border-radius: 100%;
    --x-number-font-size: var(--font-size);
  }
  .navi_badge_count[data-two-digits] {
    --x-border-radius: 100%;
    --x-number-font-size: 0.8em;
  }
  .navi_badge_count[data-two-digits][data-value-overflow] {
    --x-number-font-size: 0.6em;
  }
  .navi_badge_count[data-indeterminate-digits] {
    --x-border-radius: 1em;
    --x-size: auto;
  }
  .navi_badge_count[data-indeterminate-digits] .navi_badge_count_visual {
    padding-right: 0.5em;
    padding-left: 0.5em;
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
  useContrastingColor(ref, ".navi_badge_count_visual");

  const valueRequested =
    typeof children === "string" ? parseInt(children, 10) : children;
  const valueDisplayed = applyMaxToValue(max, valueRequested);
  const digitCount = String(valueDisplayed).length;
  const hasOverflow = valueDisplayed !== valueRequested;

  return (
    <Text
      ref={ref}
      className="navi_badge_count"
      bold
      data-single-digit={digitCount === 1 ? "" : undefined}
      data-two-digits={digitCount === 2 ? "" : undefined}
      data-value-overflow={hasOverflow ? "" : undefined}
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
      <span className="navi_badge_count_visual">
        <span className="navi_badge_count_text">
          {valueDisplayed}
          {hasOverflow && maxElement}
        </span>
      </span>
      <span style="user-select: none">&#8203;</span>
    </Text>
  );
};
const applyMaxToValue = (max, value) => {
  if (isNaN(value)) {
    return value;
  }
  if (
    max === undefined ||
    max === Infinity ||
    max === false ||
    max === "false" ||
    max === "Infinity" ||
    max === "none"
  ) {
    return value;
  }
  const numericMax = typeof max === "string" ? parseInt(max, 10) : max;
  if (isNaN(numericMax)) {
    return value;
  }
  if (value > numericMax) {
    return numericMax;
  }
  return value;
};
