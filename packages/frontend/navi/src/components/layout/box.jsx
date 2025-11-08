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
  assignStyle,
  getStylePropGroup,
  normalizeSpacingStyle,
  normalizeTypoStyle,
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

const PSEUDO_CLASSES_DEFAULT = [":hover", ":active"];
const PSEUDO_ELEMENTS_DEFAULT = [];
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
    style,
    shrink,
    expand,
    managedByCSSVars,
    basePseudoState,
    pseudoState, // for demo purposes it's possible to control pseudo state from props
    pseudoClasses = PSEUDO_CLASSES_DEFAULT,
    pseudoElements = PSEUDO_ELEMENTS_DEFAULT,
    pseudoStyle,
    // visualSelector convey the following:
    // The box itself is visually "invisible", one of its descendant is responsible for visual representation
    // - Some styles will be used on the box itself (for instance margins)
    // - Some styles will be used on the visual element (for instance paddings, backgroundColor)
    // -> introduced for <Button /> with transform:scale on press
    visualSelector,
    // pseudoStateSelector convey the following:
    // The box contains content that holds pseudoState
    // -> introduced for <Input /> with a wrapped for loading, checkboxes, etc
    pseudoStateSelector,
    hasChildFunction,

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

  const remainingProps = {};
  styling: {
    const boxLayout = useContext(BoxLayoutContext);
    const innerPseudoState =
      basePseudoState && pseudoState
        ? { ...basePseudoState, ...pseudoState }
        : basePseudoState;
    const styleContext = {
      boxLayout,
      managedByCSSVars,
      pseudoState: innerPseudoState,
      pseudoClasses,
      pseudoElements,
    };

    const baseStyles = {
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
    };
    const styleDeps = [
      // Layout and alignment props
      boxLayout,
      contentAlignX,
      contentAlignY,
      contentSpacing,

      // Flex/sizing props
      shrink,
      expand,
      insideFlexContainer,

      // Style context dependencies
      managedByCSSVars,
      pseudoClasses,
      pseudoElements,

      // Selectors
      visualSelector,
      pseudoStateSelector,
    ];
    const marginStyles = {};
    const paddingStyles = {};
    const dimensionStyles = {};
    const positionStyles = {};
    const typoStyles = {};
    const visualStyles = {};
    const stylingKeyCandidateArray = Object.keys(rest);
    const remainingPropKeys = [];
    for (const key of stylingKeyCandidateArray) {
      const group = getStylePropGroup(key);
      const value = rest[key];
      if (!group) {
        remainingPropKeys.push(key);
        remainingProps[key] = value;
        continue;
      }
      styleDeps.push(value);
      if (group === "margin") {
        assignStyle(
          marginStyles,
          value,
          key,
          styleContext,
          normalizeSpacingStyle,
        );
        continue;
      }
      if (group === "padding") {
        assignStyle(
          paddingStyles,
          value,
          key,
          styleContext,
          normalizeSpacingStyle,
        );
        continue;
      }
      if (group === "dimension") {
        assignStyle(dimensionStyles, value, key, styleContext);
        continue;
      }
      if (group === "position") {
        assignStyle(positionStyles, value, key, styleContext);
        continue;
      }
      if (group === "typo") {
        assignStyle(typoStyles, value, key, styleContext, normalizeTypoStyle);
        continue;
      }
      // "visual"
      assignStyle(visualStyles, value, key, styleContext);
    }

    const pseudoNamedStyles = {};
    if (pseudoStyle) {
      for (const key of Object.keys(pseudoStyle)) {
        const pseudoStyleContext = {
          ...styleContext,
          managedByCSSVars: {
            ...managedByCSSVars,
            ...managedByCSSVars[key],
          },
          pseudoName: key,
        };

        // pseudo class
        if (key.startsWith(":")) {
          styleDeps.push(key);
          const pseudoClassStyles = {};
          const pseudoClassStyle = pseudoStyle[key];
          for (const pseudoClassStyleKey of Object.keys(pseudoClassStyle)) {
            const pseudoClassStyleValue = pseudoClassStyle[pseudoClassStyleKey];
            styleDeps.push(pseudoClassStyleValue);
            assignStyle(
              pseudoClassStyles,
              pseudoClassStyleValue,
              pseudoClassStyleKey,
              pseudoStyleContext,
            );
          }
          pseudoNamedStyles[key] = pseudoClassStyles;
          continue;
        }
        // pseudo element
        if (key.startsWith("::")) {
          styleDeps.push(key);
          const pseudoElementStyles = {};
          const pseudoElementStyle = pseudoStyle[key];
          for (const pseudoElementStyleKey of Object.keys(pseudoElementStyle)) {
            const pseudoElementStyleValue =
              pseudoElementStyle[pseudoElementStyleKey];
            styleDeps.push(pseudoElementStyleValue);
            assignStyle(
              pseudoElementStyles,
              pseudoElementStyleValue,
              pseudoElementStyleKey,
              pseudoStyleContext,
            );
          }
          pseudoNamedStyles[key] = pseudoElementStyles;
          continue;
        }
        console.warn(`unsupported pseudo style key "${key}"`);
      }
    }

    if (insideFlexContainer) {
      baseStyles.flexShrink = shrink ? 1 : 0;
      baseStyles.flexGrow = expand ? 1 : undefined;
    } else {
      if (expand) {
        assignStyle(dimensionStyles, true, "expandX", styleContext);
        assignStyle(dimensionStyles, true, "expandY", styleContext);
      }
      if (shrink) {
        // can we do something, does it have a meaning here?
      }
    }

    const boxStyle = baseStyles;
    let secondaryStyle;
    if (visualSelector) {
      // box will get margin, position, dimension, typo
      Object.assign(boxStyle, marginStyles);
      Object.assign(boxStyle, positionStyles);
      Object.assign(boxStyle, dimensionStyles);
      Object.assign(boxStyle, typoStyles);
      // visual element will get padding and visual
      secondaryStyle = {};
      Object.assign(secondaryStyle, paddingStyles);
      Object.assign(secondaryStyle, visualStyles);
    } else if (pseudoStateSelector) {
      // box will get margin, position, dimension, typo
      Object.assign(boxStyle, marginStyles);
      Object.assign(boxStyle, positionStyles);
      Object.assign(boxStyle, dimensionStyles);
      Object.assign(boxStyle, typoStyles);
      // visual element will get padding and visual
      secondaryStyle = {};
      Object.assign(boxStyle, paddingStyles);
      Object.assign(boxStyle, visualStyles);
    } else {
      // box get all the styles
      Object.assign(boxStyle, marginStyles);
      Object.assign(boxStyle, positionStyles);
      Object.assign(boxStyle, dimensionStyles);
      Object.assign(boxStyle, typoStyles);
      Object.assign(boxStyle, paddingStyles);
      Object.assign(boxStyle, visualStyles);
    }
    if (typeof style === "string") {
      appendStyles(boxStyle, normalizeStyles(style, "css"), "css");
      styleDeps.push(style); // impact box style -> add to deps
    } else if (style && typeof style === "object") {
      for (const key of Object.keys(style)) {
        const stylePropValue = style[key];
        assignStyle(boxStyle, stylePropValue, key, styleContext);
        styleDeps.push(stylePropValue); // impact box style -> add to deps
      }
    }

    const updateStyle = useCallback((state) => {
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
    }, styleDeps);
    useLayoutEffect(() => {
      const boxEl = ref.current;
      if (!boxEl) {
        return null;
      }
      const pseudoStateEl = pseudoStateSelector
        ? boxEl.querySelector(pseudoStateSelector)
        : boxEl;
      return initPseudoStyles(pseudoStateEl, {
        pseudoClasses,
        pseudoState: innerPseudoState,
        effect: updateStyle,
        elementToImpact: boxEl,
      });
    }, [pseudoStateSelector, pseudoClasses, innerPseudoState, updateStyle]);
  }

  // When hasChildFunction is used it means
  // Some/all the children needs to access remainingProps
  // to render and will provide a function to do so.
  let innerChildren;
  if (hasChildFunction) {
    if (Array.isArray(children)) {
      innerChildren = children.map((child) =>
        typeof child === "function" ? child(remainingProps) : child,
      );
    } else if (typeof children === "function") {
      innerChildren = children(remainingProps);
    } else {
      innerChildren = children;
    }
  } else {
    innerChildren = children;
  }

  return (
    <TagName
      ref={ref}
      className={innerClassName}
      data-layout-row={layoutRow ? "" : undefined}
      data-layout-column={layoutColumn ? "" : undefined}
      data-layout-inline={layoutInline ? "" : undefined}
      {...(pseudoStateSelector ? undefined : remainingProps)}
    >
      <BoxLayoutContext.Provider value={layout}>
        {innerChildren}
      </BoxLayoutContext.Provider>
    </TagName>
  );
};

export const Layout = (props) => {
  const { row, column, ...rest } = props;

  if (row) {
    return <Box layoutRow {...rest} />;
  }
  if (column) {
    return <Box layoutColumn {...rest} />;
  }
  return <Box {...rest} />;
};
