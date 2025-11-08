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

import { appendStyles, normalizeStyles } from "@jsenv/dom";
import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import {
  generateDimensionStyles,
  generateMarginStyles,
  generatePaddingStyles,
  generatePositionStyles,
  generatePseudoNamedStyles,
  generateTypoStyles,
  generateVisualStyles,
  resolveSpacingSize,
} from "./box_style_util.js";
import { BoxLayoutContext } from "./layout_context.jsx";
import { applyStyle, initPseudoStyles } from "./pseudo_styles.js";
import { withPropsClassName } from "./with_props_class_name.js";

import.meta.css = /* css */ `
  [data-layout-row] {
    display: flex;
    flex-direction: column;
  }

  [data-layout-column] {
    display: flex;
    flex-direction: "row";
  }

  [data-layout-inline] {
    display: inline-flex;
  }
`;

export const Box = (props) => {
  const {
    as = "div",
    layoutRow,
    layoutColumn,
    layoutInline,
    contentAlignX,
    contentAlignY,
    contentSpacing,
    baseClassName,
    className,
    baseStyle,

    // style management
    managedByCSSVars,
    basePseudoState,
    pseudoState, // for demo purposes it's possible to control pseudo state from props
    pseudoClasses,
    pseudoElements,
    pseudoStyle,
    // visualSelector convey the following:
    // The box itself is visually "invisible", one of its descendant is responsible for visual representation
    // - Some styles will be used on the box itself (for instance margins)
    // - Some styles will be used on the visual element (for instance paddings, backgroundColor)
    // -> introduced for <Button /> with transform:scale on press
    visualSelector,
    // pseudoStateSelector convey the following:
    // The box contains content that holds pseudoState
    // TOBE IMPLEMENTED
    // -> introduced for <Input /> with a wrapped for loading, checkboxes, etc
    pseudoStateSelector,

    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  const layoutFromContext = useContext(BoxLayoutContext);
  const insideFlexContainer =
    layoutFromContext === "row" ||
    layoutFromContext === "column" ||
    layoutFromContext === "inline";

  const TagName = as;
  const layout = layoutRow
    ? "row"
    : layoutColumn
      ? "column"
      : layoutInline
        ? "inline"
        : undefined;
  const innerClassName = withPropsClassName(baseClassName, className);

  let remainingProps;
  styling: {
    const boxLayout = useContext(BoxLayoutContext);
    const innerPseudoState =
      basePseudoState && pseudoState
        ? { ...basePseudoState, ...pseudoState }
        : basePseudoState;
    const innerPseudoClasses =
      pseudoClasses ||
      // <Box pseudo={{ ":hover": { backgroundColor: "red" } }}> would enable ":hover"
      // even if not part of the pseudoClasses enabled for this component
      pseudoState
        ? Object.keys(pseudoState)
        : undefined;
    const styleContext = {
      boxLayout,
      managedByCSSVars,
      pseudoState: innerPseudoState,
      pseudoClasses: innerPseudoClasses,
      pseudoElements,
      pseudoStyle,
    };
    /* eslint-disable no-unused-vars */
    const {
      // style from props
      style,

      // layout props
      // layout/spacing
      margin,
      marginX,
      marginY,
      marginLeft,
      marginRight,
      marginTop,
      marginBottom,
      padding,
      paddingX,
      paddingY,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      // layout/position
      alignX,
      alignY,
      left,
      top,
      // layout/size
      shrink,
      expand,
      expandX = expand,
      expandY = expand,
      width,
      minWidth,
      maxWidth,
      height,
      minHeight,
      maxHeight,

      // typo props
      size,
      bold,
      thin,
      italic,
      underline,
      underlineStyle,
      underlineColor,
      color,
      textShadow,
      lineHeight,
      noWrap,

      // visual props
      boxShadow,
      background,
      backgroundColor,
      backgroundImage,
      backgroundSize,
      border,
      borderWidth,
      borderRadius,
      borderColor,
      borderStyle,
      borderTop,
      borderLeft,
      borderRight,
      borderBottom,
      opacity,
      filter,
      cursor,

      // props not related to styling
      ...nonStylingProps
    } = rest;
    /* eslint-enable no-unused-vars */
    remainingProps = nonStylingProps;

    const base = {
      ...baseStyle,
      ...(layoutRow
        ? {
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
            // Set if not the default ("start")
            justifyContent:
              contentAlignX === "start" ? undefined : contentAlignX,
            // set if not the default ("stretch")
            alignItems: contentAlignY === "stretch" ? undefined : contentAlignY,
            gap: resolveSpacingSize(contentSpacing, "gap"),
          }
        : {}),
      ...(layoutInline ? {} : {}),
      flexShrink: shrink ? 1 : insideFlexContainer ? 0 : undefined,
      flexGrow: insideFlexContainer && expand ? 1 : undefined,
    };
    const propStyles = style ? normalizeStyles(style, "css") : {};
    const marginStyles = generateMarginStyles(props, styleContext);
    const paddingStyles = generatePaddingStyles(props, styleContext);
    const dimensionStyles = generateDimensionStyles(props, styleContext);
    const positionStyles = generatePositionStyles(props, styleContext);
    const typoStyles = generateTypoStyles(props, styleContext);
    const visualStyles = generateVisualStyles(props, styleContext);
    const pseudoNamedStyles = generatePseudoNamedStyles(props, styleContext);

    const boxStyle = {};
    let secondaryStyle;
    if (base) {
      Object.assign(boxStyle, base);
    }

    if (visualSelector) {
      Object.assign(boxStyle, marginStyles);
      Object.assign(boxStyle, positionStyles);
      Object.assign(boxStyle, dimensionStyles);
      Object.assign(boxStyle, typoStyles);
      // visual el get padding and visual styles
      secondaryStyle = {};
      Object.assign(secondaryStyle, paddingStyles);
      Object.assign(secondaryStyle, visualStyles);
    } else if (pseudoStateSelector) {
      // for now box get all the styles too
      secondaryStyle = {};
      Object.assign(boxStyle, marginStyles);
      Object.assign(boxStyle, positionStyles);
      Object.assign(boxStyle, dimensionStyles);
      Object.assign(boxStyle, typoStyles);
      Object.assign(boxStyle, paddingStyles);
      Object.assign(boxStyle, visualStyles);
    } else {
      // box get all the styles
      Object.assign(boxStyle, marginStyles);
      Object.assign(boxStyle, positionStyles);
      Object.assign(boxStyle, dimensionStyles);
      Object.assign(boxStyle, typoStyles);
      Object.assign(secondaryStyle, paddingStyles);
      Object.assign(secondaryStyle, visualStyles);
    }

    if (style) {
      appendStyles(boxStyle, propStyles, "css");
    }

    const updateStyle = useCallback(
      (state) => {
        const boxEl = ref.current;
        applyStyle(boxEl, boxStyle);

        if (pseudoStateSelector) {
          const pseudoEl = boxEl.querySelector(pseudoStateSelector);
          if (pseudoEl) {
            applyStyle(pseudoEl, secondaryStyle, state, pseudoNamedStyles);
          }
        } else if (visualSelector) {
          const visualEl = boxEl.querySelector(visualSelector);
          if (visualEl) {
            applyStyle(visualEl, secondaryStyle, state, pseudoNamedStyles);
          }
        }
      },
      [visualSelector, boxStyle, secondaryStyle, pseudoNamedStyles],
    );
    useLayoutEffect(() => {
      const boxEl = ref.current;
      if (!boxEl) {
        return null;
      }
      const pseudoStateEl = pseudoStateSelector
        ? boxEl.querySelector(pseudoStateSelector)
        : boxEl;
      return initPseudoStyles(pseudoStateEl, {
        pseudoClasses: innerPseudoClasses,
        pseudoState: innerPseudoState,
        effect: updateStyle,
        elementToImpact: boxEl,
      });
    }, [
      pseudoStateSelector,
      innerPseudoClasses,
      innerPseudoState,
      updateStyle,
    ]);
  }

  return (
    <TagName
      ref={ref}
      className={innerClassName}
      data-layout-row={as === "div" && layoutRow ? "" : undefined}
      data-layout-column={as === "div" && layoutColumn ? "" : undefined}
      data-layout-inline={as === "div" && layoutInline ? "" : undefined}
      {...remainingProps}
    >
      <BoxLayoutContext.Provider value={layout}>
        {children}
      </BoxLayoutContext.Provider>
    </TagName>
  );
};

export const Layout = (props) => {
  const { row, column, ...rest } = props;

  if (row) {
    // eslint-disable-next-line jsenv/no-unknown-params
    return <Box layoutRow {...rest} />;
  }
  if (column) {
    // eslint-disable-next-line jsenv/no-unknown-params
    return <Box layoutColumn {...rest} />;
  }
  return <Box {...rest} />;
};
