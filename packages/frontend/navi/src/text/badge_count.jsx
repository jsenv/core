import { useRef } from "preact/hooks";

import { Icon } from "../graphic/icon.jsx";
import { LoadingDots } from "../graphic/loader/loading_dots.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { formatNumber } from "./format_number.js";
import { SurroundingTextAligner } from "./surrounding_text_aligner.jsx";
import { Text } from "./text.jsx";
import { useDarkBackgroundAttribute } from "./use_dark_background_attribute.js";

const css = /* css */ `
  @layer navi {
  }
  .navi_text.navi_badge_count {
    --font-size: 0.7em;
    --x-background: var(--background);
    --x-background-color: var(--background-color, var(--x-background));
    --x-color-contrasting: var(--navi-color-black);
    --x-color: var(--color, var(--x-color-contrasting));
    --padding-x: 0.5em;
    --padding-y: 0.2em;
    position: relative;
    color: var(--x-color);
    font-size: var(--font-size);
    vertical-align: inherit;

    &[data-dark-background] {
      --x-color-contrasting: var(--navi-color-white);
    }

    &[data-loading] {
      --x-background: transparent;
      --x-background-color: transparent;
      /* Force constrasting color while loading */
      --x-color: var(--x-color-contrasting);
    }

    .navi_count_badge_overflow {
      position: relative;
    }

    /* Ellipse */
    &[data-ellipse] {
      display: inline-block;
      padding-top: var(--padding-y);
      padding-right: var(--padding-x);
      padding-bottom: var(--padding-y);
      padding-left: var(--padding-x);
      line-height: normal;
      background: var(--x-background);
      background-color: var(--x-background-color);
      border-radius: 1em;

      /* For ellipse + single char force the circle aspect as it's prettier */
      &[data-single-char] {
        aspect-ratio: 1/1;
        height: 1.6em;
        padding: 0;
        text-align: center;
        line-height: 1.6em;
      }
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
      background-color: var(--x-background-color);
      border-radius: 50%;

      &[data-single-char] {
        --x-radius: 1.6em;
        --x-number-font-size: unset;
      }
      &[data-two-chars] {
        --x-radius: 2em;
        --x-number-font-size: unset;
      }
      &[data-three-chars] {
        --x-radius: 2.4em;
        --x-number-font-size: 0.8em;
      }
      &[data-four-chars] {
        --x-radius: 2.4em;
        --x-number-font-size: 0.8em;
      }

      .navi_badge_count_text {
        font-size: var(--x-number-font-size);
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
const MAX_FOR_CIRCLE = 99;

export const BadgeCount = ({
  children,
  maxElement = <BadgeCountOverflow />,
  // When you use max="none" (or max > 99) it might be a good idea to force ellipse
  // so that visually the interface do not suddently switch from circle to ellipse depending on the count
  circle,
  max = circle ? MAX_FOR_CIRCLE : Infinity,
  integer,
  lang,
  loading,
  ...props
}) => {
  import.meta.css = css;

  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  useDarkBackgroundAttribute(ref, [loading]);

  let valueRequested = (() => {
    if (typeof children !== "string") return children;
    const parsed = Number(children);
    return Number.isNaN(parsed) ? children : parsed;
  })();
  if (integer && typeof valueRequested === "number") {
    valueRequested = Math.round(valueRequested);
  }
  const valueDisplayed = applyMaxToValue(max, valueRequested);
  const hasOverflow = valueDisplayed !== valueRequested;
  const valueCharCount = String(valueDisplayed).length;
  const charCount = valueCharCount + (hasOverflow ? 1 : 0);
  if (charCount > MAX_CHAR_AS_CIRCLE) {
    circle = false;
  }

  if (circle) {
    return (
      <SurroundingTextAligner align="center" childRef={ref}>
        <BadgeCountCircle
          {...props}
          loading={loading}
          ref={ref}
          hasOverflow={hasOverflow}
          charCount={charCount}
        >
          {valueDisplayed}
          {hasOverflow && maxElement}
        </BadgeCountCircle>
      </SurroundingTextAligner>
    );
  }
  const valueFormatted =
    typeof valueDisplayed === "number"
      ? formatNumber(valueDisplayed, { lang })
      : valueDisplayed;
  return (
    <SurroundingTextAligner align="center" childRef={ref}>
      <BadgeCountEllipse
        {...props}
        loading={loading}
        ref={ref}
        hasOverflow={hasOverflow}
        charCount={charCount}
      >
        {valueFormatted}
        {hasOverflow && maxElement}
      </BadgeCountEllipse>
    </SurroundingTextAligner>
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

const BadgeCountEllipse = ({
  ref,
  loading,
  hasOverflow,
  charCount,
  className,
  children,
  ...props
}) => {
  return (
    <Text
      ref={ref}
      className={withPropsClassName("navi_badge_count", className)}
      bold
      data-ellipse=""
      data-value-overflow={hasOverflow ? "" : undefined}
      data-loading={loading ? "" : undefined}
      data-single-char={charCount === 1 ? "" : undefined}
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
const BadgeCountCircle = ({
  ref,
  charCount,
  hasOverflow,
  loading,
  className,
  children,
  ...props
}) => {
  return (
    <Text
      ref={ref}
      className={withPropsClassName("navi_badge_count", className)}
      data-circle=""
      bold
      data-loading={loading ? "" : undefined}
      data-single-char={charCount === 1 ? "" : undefined}
      data-two-chars={charCount === 2 ? "" : undefined}
      data-three-chars={charCount === 3 ? "" : undefined}
      data-four-chars={charCount === 4 ? "" : undefined}
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
