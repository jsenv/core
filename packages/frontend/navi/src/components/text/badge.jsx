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
    --x-spacing: 0.3em;
    --x-size: 1em;
    --x-outer-size: calc(var(--x-size) + var(--x-spacing));
    --x-offset-top: calc(0.5 * (var(--x-outer-size) - 1em));
    --x-border-radius: var(--border-radius, 1em);

    display: inline-block;
    box-sizing: border-box;
    min-width: var(--x-outer-size);
    height: var(--x-outer-size);
    max-height: var(--x-outer-size);
    /* margin-top: calc(-1 * var(--x-offset-top)); */
    padding-right: var(--x-spacing);
    padding-left: var(--x-spacing);
    color: var(--color, var(--x-color-contrasting));
    text-align: center;
    line-height: var(--x-outer-size);
    vertical-align: middle; /* in case this text has !== size surrounding text */
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-radius: var(--x-border-radius);
  }
  .navi_badge_count[data-single-digit] {
    --spacing: 0em;
    --size: 1lh;
    --border-radius: 100%;
  }
  .navi_badge_count[data-two-digits] {
    --spacing: 0em;
    --size: 1.6em;
    --border-radius: 100%;
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
      data-single-digit={digitCount === 1 ? "" : undefined}
      data-two-digits={digitCount === 2 ? "" : undefined}
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing="pre"
    >
      {displayValue}
    </Text>
  );
};
