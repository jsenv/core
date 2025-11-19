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
export const BadgeCount = ({ children, bold = true, ...props }) => {
  const renderForeground = (remainingProps) => {
    return (
      <TextForeground {...remainingProps} box>
        {children}
      </TextForeground>
    );
  };
  const renderForegroundMemoized = useCallback(renderForeground, [children]);

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
        {children}
      </span>
      {renderForegroundMemoized}
    </Text>
  );
};
