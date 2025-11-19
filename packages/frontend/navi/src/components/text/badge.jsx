import { useCallback } from "preact/hooks";
import { Text, TextForeground } from "./text.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_badge {
      --border-radius: 1em;
    }
  }
  .navi_badge {
    color: var(--color);
  }
  .navi_badge .navi_char_slot_invisible {
    padding-top: var(--padding-top, var(--padding-y, var(--padding, 0.4em)));
    padding-right: var(
      --padding-right,
      var(--padding-x, var(--padding, 0.4em))
    );
    padding-bottom: var(
      --padding-bottom,
      var(--padding-y, var(--padding, 0.4em))
    );
    padding-left: var(--padding-left, var(--padding-x, var(--padding, 0.4em)));
  }
  .navi_badge .navi_text_foreground {
    width: 100%;
    min-width: 1.5em;
    height: 1.5em;
    align-items: center;
    justify-content: center;
    background-color: var(--background-color);
    border-radius: var(--border-radius, 1em);
  }
`;

const BadgeManagedByCSSVars = {
  borderWidth: "--border-width",
  borderRadius: "--border-radius",
  paddingTop: "--padding-top",
  paddingRight: "--padding-right",
  paddingBottom: "--padding-bottom",
  paddingLeft: "--padding-left",
  backgroundColor: "--background-color",
  borderColor: "--border-color",
  color: "--color",
};
export const BadgeCount = ({ children, bold = true, max, ...props }) => {
  // Calculer la valeur à afficher en fonction du paramètre max
  const getDisplayValue = () => {
    if (max === undefined) {
      return children;
    }
    const numericValue =
      typeof children === "string" ? parseInt(children, 10) : children;
    const numericMax = typeof max === "string" ? parseInt(max, 10) : max;
    if (isNaN(numericValue) || isNaN(numericMax)) {
      return children;
    }
    if (numericValue > numericMax) {
      return `${numericMax}+`;
    }
    return children;
  };

  const displayValue = getDisplayValue();

  const renderForeground = (remainingProps) => {
    return (
      <TextForeground {...remainingProps} box>
        {displayValue}
      </TextForeground>
    );
  };
  const renderForegroundMemoized = useCallback(renderForeground, [
    displayValue,
  ]);

  return (
    <Text
      {...props}
      className="navi_badge"
      bold={bold}
      data-has-foreground=""
      hasChildFunction
      visualSelector=".navi_text_foreground"
      managedByCSSVars={BadgeManagedByCSSVars}
    >
      {/* padding must go on the char slot */}
      <span className="navi_char_slot_invisible" aria-hidden="true">
        {displayValue}
      </span>
      {renderForegroundMemoized}
    </Text>
  );
};
