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

import { useContext, useLayoutEffect, useRef } from "preact/hooks";

import {
  applyStyles,
  resolveSpacingSize,
  withPropsStyle,
} from "../props_composition/with_props_style.js";
import { BoxLayoutContext } from "./layout_context.jsx";

export const Box = (props) => {
  const {
    as = "div",
    layoutRow,
    layoutColumn,
    layoutInline,
    contentAlignX,
    contentAlignY,
    contentSpacing,
    shrink,
    expand,
    children,
    ...rest
  } = props;

  const layoutFromContext = useContext(BoxLayoutContext);
  const insideFlexContainer =
    layoutFromContext === "row" ||
    layoutFromContext === "column" ||
    layoutFromContext === "inline";

  const TagName = as;
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    base: {
      ...(layoutRow
        ? {
            display: "flex",
            flexDirection: "column",
            // Set if not the default ("stretch")
            alignItems: contentAlignX === "stretch" ? undefined : contentAlignX,
            // set if not the default ("start")
            justifyContent:
              contentAlignY === "start" ? undefined : contentAlignY,
            gap: resolveSpacingSize(contentSpacing, "gap"),
          }
        : {}),
      ...(layoutColumn
        ? {
            display: "flex",
            flexDirection: "row",
            // Set if not the default ("start")
            justifyContent:
              contentAlignX === "start" ? undefined : contentAlignX,
            // set if not the default ("stretch")
            alignItems: contentAlignY === "stretch" ? undefined : contentAlignY,
            gap: resolveSpacingSize(contentSpacing, "gap"),
          }
        : {}),
      ...(layoutInline
        ? {
            display: "inline-flex",
          }
        : {}),
      flexShrink: shrink ? 1 : insideFlexContainer ? 0 : undefined,
      flexGrow: insideFlexContainer && expand ? 1 : undefined,
    },
    layout: true,
    typo: true,
  });
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    applyStyles(el, innerStyle);
  }, [innerStyle]);

  return (
    <TagName ref={ref} style={innerStyle} {...remainingProps}>
      <BoxLayoutContext.Provider
        value={
          layoutRow
            ? "row"
            : layoutColumn
              ? "column"
              : layoutInline
                ? "inline"
                : undefined
        }
      >
        {children}
      </BoxLayoutContext.Provider>
    </TagName>
  );
};

export const Layout = ({ row, column, ...rest }) => {
  if (row) {
    return <Box layoutRow {...rest} />;
  }
  if (column) {
    return <Box layoutColumn {...rest} />;
  }
  return <Box {...rest} />;
};
