import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_badge {
      --border-radius: 1em;
    }
  }
  .navi_badge {
    display: inline-block;
    box-sizing: border-box;
    min-width: 1.5em;
    height: 1.5em;
    max-height: 1.5em;
    padding-right: var(
      --padding-right,
      var(--padding-x, var(--padding, 0.4em))
    );
    padding-left: var(--padding-left, var(--padding-x, var(--padding, 0.4em)));
    color: var(--color);
    text-align: center;
    line-height: 1.5em;
    vertical-align: middle;
    border-radius: var(--border-radius, 1em);
  }
`;

const BadgeManagedByCSSVars = {
  borderWidth: "--border-width",
  borderRadius: "--border-radius",
  paddingRight: "--padding-right",
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

  return (
    <Text
      {...props}
      className="navi_badge"
      bold={bold}
      managedByCSSVars={BadgeManagedByCSSVars}
    >
      {displayValue}
    </Text>
  );
};
