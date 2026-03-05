import { useRef } from "preact/hooks";

import { Icon } from "../graphic/icon.jsx";
import { LoadingDots } from "../graphic/loader/loading_dots.jsx";
import { Text } from "./text.jsx";
import { useContrastingColor } from "./use_contrasting_color.js";

import.meta.css = /* css */ `
  @layer navi {
  }
  .navi_badge_count {
    --font-size: 0.7em;
    --x-background: var(--background);
    --x-background-color: var(--background-color);
    --x-padding: 0.5em;
    position: relative;
    display: inline-block;
    color: var(--color, var(--x-color-contrasting));
    font-size: var(--font-size);

    .navi_count_badge_overflow {
      position: relative;
      top: -0.1em;
      font-size: 0.8em;
    }

    /* Ellipse */
    &[data-ellipse] {
      padding-right: var(--x-padding);
      padding-left: var(--x-padding);
      background: var(--x-background);
      background-color: var(--x-background-color, var(--x-background));
      border-radius: 1em;
    }

    /* Circle */
    &[data-circle] {
      --x-number-font-size: var(--font-size);

      display: inline-flex;
      box-sizing: content-box;
      aspect-ratio: 1/1;
      width: var(--x-radius);
      height: var(--x-radius);
      align-items: center;
      justify-content: center;
      background: var(--x-background);
      background-color: var(--x-background-color, var(--x-background));
      border-radius: 50%;

      &[data-single-char] {
        --x-radius: 1.5em;
        --x-number-font-size: unset;
      }
      &[data-two-chars] {
        --x-radius: 1.8em;
        --x-number-font-size: 0.9em;
      }
      &[data-three-chars] {
        --x-radius: 2em;
        --x-number-font-size: 0.8em;
      }

      .navi_badge_count_text {
        font-size: var(--x-number-font-size);
      }
    }

    &[data-loading] {
      --x-background: transparent;
      --x-background-color: transparent;
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
const BadgeCountOverflow = () => (
  <span className="navi_count_badge_overflow">+</span>
);
const MAX_CHAR_AS_CIRCLE = 3;
export const BadgeCount = ({
  children,
  maxElement = <BadgeCountOverflow />,
  // When you use max="none" (or max > 99) it might be a good idea to force ellipse
  // so that visually the interface do not suddently switch from circle to ellipse depending on the count
  circle,
  max = circle ? 99 : Infinity,
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
  loading,
  children,
  ...props
}) => {
  return (
    <Text
      ref={ref}
      className="navi_badge_count"
      data-circle=""
      bold
      data-loading={loading ? "" : undefined}
      data-single-char={charCount === 1 ? "" : undefined}
      data-two-chars={charCount === 2 ? "" : undefined}
      data-three-chars={charCount === 3 ? "" : undefined}
      data-value-overflow={hasOverflow ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {loading ? (
        <Icon>
          <LoadingDots />
        </Icon>
      ) : (
        <>
          {/* When we double click on count we don't want to eventually select surrounding text (in case) */}
          {/* the surrounding text has no spaces so we add "&#8203;" (zero-width space char) */}
          <span style="user-select: none">&#8203;</span>
          <span className="navi_badge_count_text">{children}</span>
          <span style="user-select: none">&#8203;</span>
        </>
      )}
    </Text>
  );
};
const BadgeCountEllipse = ({
  ref,
  loading,
  children,
  hasOverflow,
  ...props
}) => {
  return (
    <Text
      ref={ref}
      className="navi_badge_count"
      bold
      data-ellipse=""
      data-value-overflow={hasOverflow ? "" : undefined}
      data-loading={loading ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {loading ? (
        <Icon>
          <LoadingDots />
        </Icon>
      ) : (
        <>
          {/* When we double click on count we don't want to eventually select surrounding text (in case) */}
          {/* the surrounding text has no spaces so we add "&#8203;" (zero-width space char) */}
          <span style="user-select: none">&#8203;</span>
          {children}
          <span style="user-select: none">&#8203;</span>
        </>
      )}
    </Text>
  );
};
