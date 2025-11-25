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
    position: relative;

    display: inline-block;
    box-sizing: border-box;
    width: var(--x-size);
    height: var(--x-size);
    color: var(--color, var(--x-color-contrasting));
    font-size: var(--font-size);
    text-align: center;
    vertical-align: middle;
    border-radius: var(--x-border-radius);
  }
  .navi_badge_count_frame {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-radius: inherit;
    transform: translateY(-50%);
  }
  .navi_badge_count_text {
    position: absolute;
    top: 50%;
    left: 50%;
    color: white;
    font-size: var(--x-number-font-size, inherit);
    transform: translate(-50%, -50%);
  }
  .navi_count_badge_overflow {
    position: relative;
    top: -0.1em;
  }

  .navi_badge_count[data-single-char] {
    --x-border-radius: 100%;
    --x-number-font-size: unset;
  }
  .navi_badge_count[data-two-chars] {
    --x-border-radius: 100%;
    --x-number-font-size: 0.8em;
  }
  .navi_badge_count[data-three-chars] {
    --x-border-radius: 100%;
    --x-number-font-size: 0.6em;
  }
  .navi_badge_count[data-indeterminate-chars] {
    --x-border-radius: 1em;
    --x-size: auto;
    padding-right: 0.5em;
    padding-left: 0.5em;
  }
  .navi_badge_count[data-indeterminate-chars] .navi_badge_count_text {
    position: relative;
    top: unset;
    left: unset;
    transform: none;
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
  const hasOverflow = valueDisplayed !== valueRequested;
  const charCount = String(valueDisplayed).length + (hasOverflow ? 1 : 0);

  return (
    <Text
      ref={ref}
      className="navi_badge_count"
      bold
      data-single-char={charCount === 1 ? "" : undefined}
      data-two-chars={charCount === 2 ? "" : undefined}
      data-three-chars={charCount === 3 ? "" : undefined}
      data-indeterminate-chars={charCount > 3 ? "" : undefined}
      data-value-overflow={hasOverflow ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {/* When we double click on count we don't want to eventually select surrounding text (in case) */}
      {/* the surrounding text has no spaces so we add "&#8203;" (zero-width space char) */}
      <span style="user-select: none">&#8203;</span>
      <span className="navi_badge_count_frame" />
      <span className="navi_badge_count_text">
        {valueDisplayed}
        {hasOverflow && maxElement}
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
