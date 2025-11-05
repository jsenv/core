/**
 * Box - A Swiss Army Knife for Layout
 *
 * The Box component provides an intuitive, human-friendly API for layout that
 * addresses the cognitive complexity of CSS Flexbox. By default, it's a regular
 * div that can be controlled via styling props (mostly spacing).
 *
 * ## Layout Direction (Intuitive Layout)
 *
 * - `layoutRow` makes all children visually appear as ROWS (stacked vertically)
 * - `layoutColumn` makes all children visually appear as COLUMNS (arranged horizontally)
 * - `layoutInline` creates an inline-flex container
 *
 * This is the opposite of CSS flex-direction, which forces our brain to think in
 * reverse of what we want to obtain. CSS flex-direction is technically correct but
 * cognitively challenging - especially when coming back from days off or for beginners.
 *
 * CSS Flexbox mental model:
 * - flex-direction: row → children flow horizontally
 * - flex-direction: column → children flow vertically
 *
 * Box component mental model (more intuitive):
 * - layoutRow → children become visual rows (vertical stacking)
 * - layoutColumn → children become visual columns (horizontal arrangement)
 * - layoutInline → inline flex container for inline layout contexts
 *
 * ## Human-Friendly Alignment
 *
 * Instead of CSS's justify-content/align-items which depend on flex-direction context:
 * - `contentAlignX` controls horizontal alignment regardless of layout direction
 * - `contentAlignY` controls vertical alignment regardless of layout direction
 *
 * This eliminates the mental overhead of remembering which axis is "main" vs "cross"
 * depending on the flex direction.
 *
 * ## Spacing & Layout Props
 *
 * The Box also serves as a styling foundation with props for:
 * - Spacing: margin, padding, gap
 * - Sizing: width, height, expand, shrink
 * - Positioning: All standard layout and spacing properties
 *
 * This creates a consistent, declarative API for the most common layout needs
 * without requiring separate CSS classes or inline styles.
 */

import { useContext } from "preact/hooks";

import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import {
  resolveSpacingSize,
  withPropsStyle,
} from "../props_composition/with_props_style.js";
import { BoxFlowContext } from "./layout_context.jsx";

import.meta.css = /* css */ ``;

export const Box = ({
  as = "div",
  flow,
  contentAlignX,
  contentAlignY,
  contentGap,
  shrink,
  expand,
  className,
  children,
  ...rest
}) => {
  const contextBoxFlow = useContext(BoxFlowContext);

  const TagName = as;
  const innerClassName = withPropsClassName("navi_box", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    base: {
      ...(flow === "row"
        ? {
            display: "flex",
            flexDirection: "column",
            // Set if not the default ("stretch")
            alignItems: contentAlignX === "stretch" ? undefined : contentAlignX,
            // set if not the default ("start")
            justifyContent:
              contentAlignY === "start" ? undefined : contentAlignY,
            gap: resolveSpacingSize(contentGap, "gap"),
          }
        : {}),
      ...(flow === "col"
        ? {
            display: "flex",
            flexDirection: "row",
            // Set if not the default ("start")
            justifyContent:
              contentAlignX === "start" ? undefined : contentAlignX,
            // set if not the default ("stretch")
            alignItems: contentAlignY === "stretch" ? undefined : contentAlignY,
            gap: resolveSpacingSize(contentGap, "gap"),
          }
        : {}),
      ...(flow === "inline"
        ? {
            display: "inline-flex",
          }
        : {}),

      flexShrink: shrink ? 1 : contextBoxFlow ? 0 : undefined,
      flexGrow: contextBoxFlow && expand ? 1 : undefined,
    },
    layout: true,
  });

  return (
    <TagName
      className={innerClassName}
      style={innerStyle}
      data-flow={flow}
      {...remainingProps}
    >
      <BoxFlowContext.Provider value={flow}>{children}</BoxFlowContext.Provider>
    </TagName>
  );
};

const BoxFlowCol = (props) => {
  return <Box layoutColumn {...props} />;
};
const BoxFlowRow = (props) => {
  return <Box layoutRow {...props} />;
};
Box.col = BoxFlowCol;
Box.row = BoxFlowRow;
