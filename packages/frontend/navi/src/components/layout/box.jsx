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
  DELEGATED_TO_VISUAL_CHILD_PROP_SET,
  FORWARDED_TO_VISUAL_CHILD_PROP_SET,
  getStylePropGroup,
  normalizeSpacingStyle,
  normalizeTypoStyle,
} from "./box_style_util.js";
import { getDefaultDisplay } from "./display_defaults.js";
import { BoxLayoutContext } from "./layout_context.jsx";
import { applyStyle, initPseudoStyles } from "./pseudo_styles.js";
import { withPropsClassName } from "./with_props_class_name.js";

import.meta.css = /* css */ `
  [data-layout-inline] {
    display: inline;
  }

  [data-layout-row] {
    display: flex;
    flex-direction: column;
  }

  [data-layout-column] {
    display: flex;
    flex-direction: "row";
  }

  [data-layout-inline][data-layout-row],
  [data-layout-inline][data-layout-column] {
    display: inline-flex;
  }
`;

const PSEUDO_CLASSES_DEFAULT = [];
const PSEUDO_ELEMENTS_DEFAULT = [];
const MANAGED_BY_CSS_VARS_DEFAULT = {};

export const Box = (props) => {
  const {
    as = "div",
    layoutRow,
    layoutColumn,
    layoutInline,
    baseClassName,
    className,
    baseStyle,

    // style management
    style,
    shrink,
    expand,
    managedByCSSVars = MANAGED_BY_CSS_VARS_DEFAULT,
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
  const TagName = as;

  let layout;
  if (layoutInline) {
    if (layoutRow) {
      layout = "inline-row";
    } else if (layoutColumn) {
      layout = "inline-column";
    } else {
      layout = "inline";
    }
  } else if (layoutRow) {
    layout = "row";
  } else if (layoutColumn) {
    layout = "column";
  } else {
    layout = getDefaultDisplay(TagName);
  }
  const innerClassName = withPropsClassName(baseClassName, className);

  const remainingProps = {};
  styling: {
    const parentLayout = useContext(BoxLayoutContext);
    const insideFlexContainer =
      parentLayout === "row" ||
      parentLayout === "column" ||
      parentLayout === "inline-row" ||
      parentLayout === "inline-column";
    const innerPseudoState =
      basePseudoState && pseudoState
        ? { ...basePseudoState, ...pseudoState }
        : basePseudoState;
    const styleContext = {
      parentLayout,
      layout,
      managedByCSSVars,
      pseudoState: innerPseudoState,
      pseudoClasses,
      pseudoElements,
    };
    // idéalement on devrait aussi laisser passer certaines props ici
    const contentStyleContext = styleContext;
    const baseStyles = baseStyle ? { ...baseStyle } : {};
    const styleDeps = [
      // Layout and alignment props
      parentLayout,
      layout,

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
    const contentStyles = {};
    const stylingKeyCandidateArray = Object.keys(rest);
    const remainingPropKeys = [];
    for (const key of stylingKeyCandidateArray) {
      const value = rest[key];
      const group = getStylePropGroup(key);
      let isRemainingProp = false;

      if (visualSelector) {
        if (FORWARDED_TO_VISUAL_CHILD_PROP_SET.has(key)) {
          remainingPropKeys.push(key);
          remainingProps[key] = value;
          isRemainingProp = false;
        } else if (DELEGATED_TO_VISUAL_CHILD_PROP_SET.has(key)) {
          isRemainingProp = true;
        }
      } else {
        isRemainingProp = !group;
      }

      if (isRemainingProp) {
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
      if (group === "visual") {
        assignStyle(visualStyles, value, key, styleContext);
        continue;
      }
      // "content"
      assignStyle(contentStyles, value, key, contentStyleContext);
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
    Object.assign(boxStyle, marginStyles);
    Object.assign(boxStyle, positionStyles);
    Object.assign(boxStyle, dimensionStyles);
    Object.assign(boxStyle, typoStyles);
    Object.assign(boxStyle, paddingStyles);
    Object.assign(boxStyle, visualStyles);
    Object.assign(boxStyle, contentStyles);

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

      if (pseudoStateSelector) {
        applyStyle(boxEl, boxStyle);
        const pseudoEl = boxEl.querySelector(pseudoStateSelector);
        if (pseudoEl) {
          applyStyle(pseudoEl, null, state, pseudoNamedStyles);
        }
        return;
      }
      if (visualSelector) {
        applyStyle(boxEl, boxStyle);
        const visualEl = boxEl.querySelector(visualSelector);
        if (visualEl) {
          applyStyle(visualEl, null, state, pseudoNamedStyles);
        }
        return;
      }
      applyStyle(boxEl, boxStyle, state, pseudoNamedStyles);
    }, styleDeps);

    const finalStyleDeps = [pseudoStateSelector, innerPseudoState, updateStyle];
    // By default ":hover", ":active" are not tracked.
    // But is code explicitely do something like:
    // pseudoStyle={{ ":hover": { backgroundColor: "red" } }}
    // then we'll track ":hover" state changes even for basic elements like <div>
    let innerPseudoClasses;
    if (pseudoStyle) {
      innerPseudoClasses = [...pseudoClasses];
      if (pseudoClasses !== PSEUDO_CLASSES_DEFAULT) {
        finalStyleDeps.push(...pseudoClasses);
      }
      for (const key of Object.keys(pseudoStyle)) {
        if (key.startsWith(":") && !innerPseudoClasses.includes(key)) {
          innerPseudoClasses.push(key);
          finalStyleDeps.push(key);
        }
      }
    } else {
      innerPseudoClasses = pseudoClasses;
      if (pseudoClasses !== PSEUDO_CLASSES_DEFAULT) {
        finalStyleDeps.push(...pseudoClasses);
      }
    }

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
    }, finalStyleDeps);
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
      data-layout-inline={layoutInline ? "" : undefined}
      data-layout-row={layoutRow ? "" : undefined}
      data-layout-column={layoutColumn ? "" : undefined}
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
