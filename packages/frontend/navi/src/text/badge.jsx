import { useRef } from "preact/hooks";

import { Icon } from "../graphic/icon.jsx";
import { LoadingDots } from "../graphic/loader/loading_dots.jsx";
import { Text } from "./text.jsx";
import { useContrastingColor } from "./use_contrasting_color.js";

import.meta.css = /* css */ `
  @layer navi {
  }
  .navi_badge_count {
    --x-background: var(--background);
    --x-background-color: var(--background-color);
    position: relative;
    display: inline-block;
    color: var(--color, var(--x-color-contrasting));
    font-size: var(--font-size);
    vertical-align: middle;

    .navi_count_badge_overflow {
      position: relative;
      top: -0.1em;
    }

    /* Ellipse */
    &[data-ellipse] {
      padding-right: 0.4em;
      padding-left: 0.4em;
      background: var(--x-background);
      background-color: var(--x-background-color, var(--x-background));
      border-radius: 1em;
      &[data-loading] {
        --x-background: transparent;
      }
    }

    /* Circle */
    &[data-circle] {
      --x-size: 1.5em;
      --x-border-radius: var(--border-radius);
      --x-number-font-size: var(--font-size);

      width: var(--x-size);
      height: var(--x-size);
      border-radius: var(--x-border-radius);
      &[data-single-char] {
        --x-border-radius: 100%;
        --x-number-font-size: unset;
      }
      &[data-two-chars] {
        --x-border-radius: 100%;
        --x-number-font-size: 0.8em;
      }
      &[data-three-chars] {
        --x-border-radius: 100%;
        --x-number-font-size: 0.6em;
      }

      .navi_badge_count_frame {
        position: absolute;
        top: 50%;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--x-background);
        background-color: var(--x-background-color, var(--x-background));
        border-radius: inherit;
        transform: translateY(-50%);
      }

      .navi_badge_count_text {
        position: absolute;
        top: 50%;
        left: 50%;
        font-size: var(--x-number-font-size, inherit);
        transform: translate(-50%, -50%);
      }
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
  ellipse,
  max = ellipse ? Infinity : 99,
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
    ellipse = true;
  }

  if (ellipse) {
    return (
      <BadgeCountEllipse {...props} ref={ref} hasOverflow={hasOverflow}>
        {valueDisplayed}
        {hasOverflow && maxElement}
      </BadgeCountEllipse>
    );
  }
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
      data-single-char={charCount === 1 ? "" : undefined}
      data-two-chars={charCount === 2 ? "" : undefined}
      data-three-chars={charCount === 3 ? "" : undefined}
      data-value-overflow={hasOverflow ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {loading ? (
        <LoadingDots />
      ) : (
        <>
          {/* When we double click on count we don't want to eventually select surrounding text (in case) */}
          {/* the surrounding text has no spaces so we add "&#8203;" (zero-width space char) */}
          <span style="user-select: none">&#8203;</span>
          <span className="navi_badge_count_frame" />
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
