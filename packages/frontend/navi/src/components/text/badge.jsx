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
    color: var(--color, var(--x-color-contrasting));
    font-size: var(--font-size);
    text-align: center;
    vertical-align: middle;
    border-radius: var(--x-border-radius);
  }
  .navi_count_badge_overflow {
    position: relative;
    top: -0.1em;
  }
  /* Ellipse */
  .navi_badge_count[data-ellipse] {
    padding-right: 0.4em;
    padding-left: 0.4em;
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-radius: 1em;
  }
  /* Circle */
  .navi_badge_count[data-circle] {
    width: var(--x-size);
    height: var(--x-size);
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

const MAX_CHAR_AS_CIRCLE = 3;
export const BadgeCount = ({
  children,
  circle,
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
  const valueCharCount = String(valueDisplayed).length;
  const charCount = valueCharCount + (hasOverflow ? 1 : 0);

  if (charCount > MAX_CHAR_AS_CIRCLE) {
    circle = false;
  } else if (
    charCount === MAX_CHAR_AS_CIRCLE &&
    valueCharCount === MAX_CHAR_AS_CIRCLE - 1
  ) {
    // we want to display 100 and max is 1000 we "can't" use circle here
    // because when people/designers force a max they don't expect the circle to become an ellipse
    // so we want to be sure it'will always be a circle
    circle = false;
  }

  if (circle) {
    return (
      <BadgeCountCircle
        {...props}
        ref={ref}
        hasOverflow={hasOverflow}
        charCount={charCount}
      >
        {valueDisplayed}
        {hasOverflow && maxElement}
      </BadgeCountCircle>
    );
  }
  return (
    <BadgeCountEllipse {...props} ref={ref} hasOverflow={hasOverflow}>
      {valueDisplayed}
      {hasOverflow && maxElement}
    </BadgeCountEllipse>
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

const BadgeCountCircle = ({
  ref,
  charCount,
  hasOverflow,
  children,
  ...props
}) => {
  return (
    <Text
      ref={ref}
      className="navi_badge_count"
      data-circle=""
      bold
      data-single-char={charCount === 1 ? "" : undefined}
      data-two-chars={charCount === 2 ? "" : undefined}
      data-three-chars={charCount === 3 ? "" : undefined}
      data-value-overflow={hasOverflow ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {/* When we double click on count we don't want to eventually select surrounding text (in case) */}
      {/* the surrounding text has no spaces so we add "&#8203;" (zero-width space char) */}
      <span style="user-select: none">&#8203;</span>
      <span className="navi_badge_count_frame" />
      <span className="navi_badge_count_text">{children}</span>
      <span style="user-select: none">&#8203;</span>
    </Text>
  );
};
const BadgeCountEllipse = ({ ref, children, hasOverflow, ...props }) => {
  return (
    <Text
      ref={ref}
      className="navi_badge_count"
      bold
      data-ellipse=""
      data-value-overflow={hasOverflow ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {/* When we double click on count we don't want to eventually select surrounding text (in case) */}
      {/* the surrounding text has no spaces so we add "&#8203;" (zero-width space char) */}
      <span style="user-select: none">&#8203;</span>
      {children}
      <span style="user-select: none">&#8203;</span>
    </Text>
  );
};
