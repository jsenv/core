import { useRef } from "preact/hooks";
import { formatNumber } from "@jsenv/humanize";

import { LoadingDotsSvg } from "../graphic/loading/loading_dots_svg.jsx";
import { useAccentColorAttributes } from "../utils/use_accent_color_attributes.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Icon, Text } from "./text.jsx";
import { TextAnchor } from "./text_anchor.jsx";

const css = /* css */ `
  @layer navi {
  }
  .navi_text.navi_badge_count {
    /* Important to prevent anchor from breaking to a new line */
    white-space: nowrap;
    --font-size: 0.7em;
    --x-background: var(--background);
    --x-background-color: var(--background-color, var(--x-background));
    --x-color-contrasting: var(--navi-color-white);
    --x-color: var(--color, var(--x-color-contrasting));
    --badge-count-padding-x-default: 0.5em;
    /* Ink to edge: ~6px above and below the digits at the default size, for
       ~7px on the sides — a little less than the sides, which is what reads
       as balanced on a pill; 0.2em read as squashed. */
    --badge-count-padding-y-default: 0.3em;

    /* Each side resolves the most specific value it was given, from the side
       itself down to the axis, the shorthand, then the default. */
    --x-badge-count-padding-top: var(
      --badge-count-padding-top,
      var(
        --badge-count-padding-y,
        var(--badge-count-padding, var(--badge-count-padding-y-default))
      )
    );
    --x-badge-count-padding-right: var(
      --badge-count-padding-right,
      var(
        --badge-count-padding-x,
        var(--badge-count-padding, var(--badge-count-padding-x-default))
      )
    );
    --x-badge-count-padding-bottom: var(
      --badge-count-padding-bottom,
      var(
        --badge-count-padding-y,
        var(--badge-count-padding, var(--badge-count-padding-y-default))
      )
    );
    --x-badge-count-padding-left: var(
      --badge-count-padding-left,
      var(
        --badge-count-padding-x,
        var(--badge-count-padding, var(--badge-count-padding-x-default))
      )
    );

    position: relative;
    color: var(--x-color);
    font-size: var(--font-size);
    font-variant-numeric: tabular-nums;
    /* Its own line, relative to its own font: inherited from a control it
       would arrive as that control's pixels (a button's 17px), and a badge
       drawn bigger or smaller than the button's text would get a line box
       that does not match its glyph — a digit off its circle's center. */
    line-height: var(--navi-line-height);
    vertical-align: inherit;

    &[data-accent-needs-dark-fg] {
      --x-color-contrasting: var(--navi-color-black);
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
      padding-top: var(--x-badge-count-padding-top);
      padding-right: var(--x-badge-count-padding-right);
      padding-bottom: var(--x-badge-count-padding-bottom);
      padding-left: var(--x-badge-count-padding-left);
      background: var(--x-background);
      background-color: var(--x-background-color);
      border-radius: 1em;

      /* For ellipse + single char force the circle aspect as it's prettier */
      &[data-single-char] {
        /* The digit sits in a square content box that the radius rounds into a
           circle, so no padding is needed to obtain the shape. Sizing is
           content-box: a padding prop then grows the square from the outside —
           a bigger circle, or a pill on one axis — instead of eating into it
           and pushing the digit out. */
        --badge-count-padding-x-default: 0;
        --badge-count-padding-y-default: 0;

        display: inline-block;
        box-sizing: content-box;
        width: 1.6em;
        height: 1.6em;
        text-align: center;
        line-height: 1.6em;
        /* Larger than any half-height it can reach, so the shape stays fully
           round whatever the padding adds. */
        border-radius: 100em;
      }
    }

    /* Circle */
    &[data-circle] {
      --x-number-font-size: var(--font-size);
      /* Same as the single char ellipse: the radius comes from the number of
         characters, padding grows it from the outside. */
      --badge-count-padding-x-default: 0;
      --badge-count-padding-y-default: 0;

      display: inline-flex;
      box-sizing: content-box;
      aspect-ratio: 1/1;
      width: var(--x-radius);
      height: var(--x-radius);
      padding-top: var(--x-badge-count-padding-top);
      padding-right: var(--x-badge-count-padding-right);
      padding-bottom: var(--x-badge-count-padding-bottom);
      padding-left: var(--x-badge-count-padding-left);
      align-items: center;
      justify-content: center;
      background: var(--x-background);
      background-color: var(--x-background-color);
      border-radius: 100em;

      &[data-single-char] {
        --x-radius: 1.6em;
        --x-number-font-size: unset;
      }
      &[data-two-chars] {
        /* 1.8em of the badge font is 1.26em of the text's: inside the line
           (1.25), so a circle beside a button's label does not make that
           button taller than its neighbours. 2em did, by a pixel and a half. */
        --x-radius: 1.8em;
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
  // On the capitals rather than on the line box: a count sits beside a word,
  // and the eye centers it on the letters, not on the leading around them —
  // the line box center is above that, by half the leading plus what the
  // font keeps above its capitals (see TextAnchor).
  textAnchor = "char-center",
  lineLayout,
  ...props
}) => {
  import.meta.css = css;
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const { ref } = props;
  useAccentColorAttributes(ref, null);

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

  const textKey = `${loading ? "loading-" : ""}${String(valueDisplayed)}${hasOverflow ? "-overflow" : ""}`;

  if (circle) {
    return (
      <TextAnchor
        childRef={ref}
        textAnchor={textAnchor}
        textSize={props.size}
        textKey={textKey}
        lineLayout={lineLayout}
      >
        <BadgeCountCircle
          {...props}
          loading={loading}
          hasOverflow={hasOverflow}
          charCount={charCount}
        >
          {valueDisplayed}
          {hasOverflow && maxElement}
        </BadgeCountCircle>
      </TextAnchor>
    );
  }
  const valueFormatted =
    typeof valueDisplayed === "number"
      ? formatNumber(valueDisplayed, { lang })
      : valueDisplayed;
  return (
    <TextAnchor
      childRef={ref}
      textAnchor={textAnchor}
      textSize={props.size}
      textKey={textKey}
      lineLayout={lineLayout}
    >
      <BadgeCountEllipse
        {...props}
        loading={loading}
        hasOverflow={hasOverflow}
        charCount={charCount}
      >
        {valueFormatted}
        {hasOverflow && maxElement}
      </BadgeCountEllipse>
    </TextAnchor>
  );
};
const BadgeCountStyleCSSVars = {
  borderWidth: "--border-width",
  borderRadius: "--border-radius",
  padding: "--badge-count-padding",
  paddingX: "--badge-count-padding-x",
  paddingY: "--badge-count-padding-y",
  paddingTop: "--badge-count-padding-top",
  paddingRight: "--badge-count-padding-right",
  paddingBottom: "--badge-count-padding-bottom",
  paddingLeft: "--badge-count-padding-left",
  backgroundColor: "--background-color",
  background: "--background",
  borderColor: "--border-color",
  color: "--color",
  fontSize: "--font-size",
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
  loading,
  hasOverflow,
  charCount,
  className,
  children,
  ...props
}) => {
  return (
    <Text
      className={withPropsClassName("navi_badge_count", className)}
      bold
      data-ellipse=""
      data-value-overflow={hasOverflow ? "" : undefined}
      data-loading={loading ? "" : undefined}
      data-single-char={charCount === 1 ? "" : undefined}
      {...props}
      styleCSSVars={BadgeCountStyleCSSVars}
      spacing="pre"
    >
      {loading ? (
        <Icon>
          <LoadingDotsSvg />
        </Icon>
      ) : (
        children
      )}
    </Text>
  );
};
const BadgeCountCircle = ({
  charCount,
  hasOverflow,
  loading,
  className,
  children,
  ...props
}) => {
  return (
    <Text
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
      styleCSSVars={BadgeCountStyleCSSVars}
      spacing="pre"
    >
      {loading ? (
        <Icon>
          <LoadingDotsSvg />
        </Icon>
      ) : (
        <span className="navi_badge_count_text">{children}</span>
      )}
    </Text>
  );
};
