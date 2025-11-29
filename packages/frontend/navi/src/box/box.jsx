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
 * - `alignX` controls horizontal alignment regardless of layout direction
 * - `alignY` controls vertical alignment regardless of layout direction
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

import { normalizeStyles } from "@jsenv/dom";
import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import { BoxFlowContext } from "./box_flow_context.jsx";
import {
  getHowToHandleStyleProp,
  getVisualChildStylePropStrategy,
  isStyleProp,
  prepareStyleValue,
} from "./box_style_util.js";
import { getDefaultDisplay } from "./display_defaults.js";
import {
  applyStyle,
  initPseudoStyles,
  PSEUDO_NAMED_STYLES_DEFAULT,
  PSEUDO_STATE_DEFAULT,
} from "./pseudo_styles.js";
import { withPropsClassName } from "./with_props_class_name.js";

import.meta.css = /* css */ `
  [data-flow-inline] {
    display: inline;
  }

  [data-flow-row] {
    display: flex;
    flex-direction: column;
  }

  [data-flow-column] {
    display: flex;
    flex-direction: row;
  }

  [data-flow-row] > [data-flow-row],
  [data-flow-row] > [data-flow-column],
  [data-flow-column] > [data-flow-column],
  [data-flow-column] > [data-flow-row] {
    flex-shrink: 0;
  }

  [data-flow-inline][data-flow-row],
  [data-flow-inline][data-flow-column] {
    display: inline-flex;
  }
`;

const PSEUDO_CLASSES_DEFAULT = [];
const PSEUDO_ELEMENTS_DEFAULT = [];
const STYLE_CSS_VARS_DEFAULT = {};

export const Box = (props) => {
  const {
    as = "div",
    baseClassName,
    className,
    baseStyle,

    // style management
    style,
    styleCSSVars = STYLE_CSS_VARS_DEFAULT,
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

  const defaultDisplay = getDefaultDisplay(TagName);
  let { box, inline, row, column } = rest;
  if (box === "auto" || inline || defaultDisplay === "inline") {
    if (rest.width !== undefined || rest.height !== undefined) {
      box = true;
    }
  }
  if (box) {
    if (inline === undefined) {
      inline = true;
    }
    if (column === undefined && !row) {
      column = true;
    }
  }

  let boxFlow;
  if (inline) {
    if (row) {
      boxFlow = "inline-row";
    } else if (column) {
      boxFlow = "inline-column";
    } else {
      boxFlow = "inline";
    }
  } else if (row) {
    boxFlow = "row";
  } else if (column) {
    boxFlow = "column";
  } else {
    boxFlow = defaultDisplay;
  }
  const innerClassName = withPropsClassName(baseClassName, className);

  const selfForwardedProps = {};
  const childForwardedProps = {};
  styling: {
    const parentBoxFlow = useContext(BoxFlowContext);
    const styleDeps = [
      // Layout and alignment props
      parentBoxFlow,
      boxFlow,

      // Style context dependencies
      styleCSSVars,
      pseudoClasses,
      pseudoElements,

      // Selectors
      visualSelector,
      pseudoStateSelector,
    ];
    let innerPseudoState;
    if (basePseudoState && pseudoState) {
      innerPseudoState = {};
      const baseStateKeys = Object.keys(basePseudoState);
      const pseudoStateKeySet = new Set(Object.keys(pseudoState));
      for (const key of baseStateKeys) {
        if (pseudoStateKeySet.has(key)) {
          pseudoStateKeySet.delete(key);
          const value = pseudoState[key];
          styleDeps.push(value);
          innerPseudoState[key] = value;
        } else {
          const value = basePseudoState[key];
          styleDeps.push(value);
          innerPseudoState[key] = value;
        }
      }
      for (const key of pseudoStateKeySet) {
        const value = pseudoState[key];
        styleDeps.push(value);
        innerPseudoState[key] = value;
      }
    } else if (basePseudoState) {
      innerPseudoState = basePseudoState;
      for (const key of Object.keys(basePseudoState)) {
        const value = basePseudoState[key];
        styleDeps.push(value);
      }
    } else if (pseudoState) {
      innerPseudoState = pseudoState;
      for (const key of Object.keys(pseudoState)) {
        const value = pseudoState[key];
        styleDeps.push(value);
      }
    } else {
      innerPseudoState = PSEUDO_STATE_DEFAULT;
    }
    const boxStyles = {};
    const styleContext = {
      parentBoxFlow,
      boxFlow,
      styleCSSVars,
      pseudoState: innerPseudoState,
      pseudoClasses,
      pseudoElements,
      remainingProps: rest,
      styles: boxStyles,
    };
    let boxPseudoNamedStyles = PSEUDO_NAMED_STYLES_DEFAULT;
    const shouldForwardAllToChild = visualSelector && pseudoStateSelector;

    const addStyle = (value, name, stylesTarget, context) => {
      styleDeps.push(value); // impact box style -> add to deps
      const cssVar = styleCSSVars[name];
      const mergedValue = prepareStyleValue(
        stylesTarget[name],
        value,
        name,
        context,
      );
      if (cssVar) {
        stylesTarget[cssVar] = mergedValue;
        return true;
      }
      stylesTarget[name] = mergedValue;
      return false;
    };
    const addStyleMaybeForwarding = (
      value,
      name,
      stylesTarget,
      context,
      visualChildPropStrategy,
    ) => {
      if (!visualChildPropStrategy) {
        addStyle(value, name, stylesTarget, context);
        return false;
      }
      const cssVar = styleCSSVars[name];
      if (cssVar) {
        // css var wins over visual child handling
        addStyle(value, name, stylesTarget, context);
        return false;
      }
      if (visualChildPropStrategy === "copy") {
        // we stylyze ourself + forward prop to the child
        addStyle(value, name, stylesTarget, context);
      }
      return true;
    };
    const assignStyle = (
      value,
      name,
      styleContext,
      boxStylesTarget,
      styleOrigin,
    ) => {
      const context = styleOrigin === "base_style" ? "js" : "css";
      const isCss = styleOrigin === "base_style" || styleOrigin === "style";
      if (isCss) {
        addStyle(value, name, boxStylesTarget, context);
        return;
      }
      const isPseudoStyle = styleOrigin === "pseudo_style";
      const mightStyle = isStyleProp(name);
      if (!mightStyle) {
        // not a style prop what do we do with it?
        if (shouldForwardAllToChild) {
          if (isPseudoStyle) {
            // le pseudo style est deja passé tel quel au child
          } else {
            childForwardedProps[name] = value;
          }
        } else {
          if (isPseudoStyle) {
            console.warn(`unsupported pseudo style key "${name}"`);
          }
          selfForwardedProps[name] = value;
        }
        return;
      }
      // it's a style prop, we need first to check if we have css var to handle them
      // otherwise we decide to put it either on self or child
      const visualChildPropStrategy =
        visualSelector && getVisualChildStylePropStrategy(name);
      const getStyle = getHowToHandleStyleProp(name);
      if (
        // prop name === css style name
        !getStyle
      ) {
        const needForwarding = addStyleMaybeForwarding(
          value,
          name,
          boxStylesTarget,
          context,
          visualChildPropStrategy,
        );
        if (needForwarding) {
          if (isPseudoStyle) {
            // le pseudo style est deja passé tel quel au child
          } else {
            childForwardedProps[name] = value;
          }
        }
        return;
      }
      const cssValues = getStyle(value, styleContext);
      if (!cssValues) {
        return;
      }
      let needForwarding = false;
      for (const styleName of Object.keys(cssValues)) {
        const cssValue = cssValues[styleName];
        needForwarding = addStyleMaybeForwarding(
          cssValue,
          styleName,
          boxStylesTarget,
          context,
          visualChildPropStrategy,
        );
      }
      if (needForwarding) {
        if (isPseudoStyle) {
          // le pseudo style est deja passé tel quel au child
        } else {
          childForwardedProps[name] = value;
        }
      }
    };

    if (baseStyle) {
      for (const key of baseStyle) {
        const value = baseStyle[key];
        assignStyle(value, key, styleContext, boxStyles, "baseStyle");
      }
    }
    const remainingPropKeyArray = Object.keys(rest);
    for (const propName of remainingPropKeyArray) {
      if (propName === "ref") {
        // some props not destructured but that are neither
        // style props, nor should be forwarded to the child
        continue;
      }
      const propValue = rest[propName];
      assignStyle(propValue, propName, styleContext, boxStyles, "prop");
    }
    if (pseudoStyle) {
      const assignPseudoStyle = (
        propValue,
        propName,
        pseudoStyleContext,
        pseudoStylesTarget,
      ) => {
        assignStyle(
          propValue,
          propName,
          pseudoStyleContext,
          pseudoStylesTarget,
          "pseudo_style",
        );
      };

      const pseudoStyleKeys = Object.keys(pseudoStyle);
      if (pseudoStyleKeys.length) {
        boxPseudoNamedStyles = {};
        for (const key of pseudoStyleKeys) {
          const pseudoStyleContext = {
            ...styleContext,
            styleCSSVars: {
              ...styleCSSVars,
              ...styleCSSVars[key],
            },
            pseudoName: key,
          };

          // pseudo class
          if (key.startsWith(":")) {
            styleDeps.push(key);
            const pseudoClassStyles = {};
            const pseudoClassStyle = pseudoStyle[key];
            for (const pseudoClassStyleKey of Object.keys(pseudoClassStyle)) {
              const pseudoClassStyleValue =
                pseudoClassStyle[pseudoClassStyleKey];
              assignPseudoStyle(
                pseudoClassStyleValue,
                pseudoClassStyleKey,
                pseudoStyleContext,
                pseudoClassStyles,
              );
            }
            boxPseudoNamedStyles[key] = pseudoClassStyles;
            continue;
          }
          // pseudo element
          if (key.startsWith("::")) {
            styleDeps.push(key);
            const pseudoElementStyles = {};
            const pseudoElementStyle = pseudoStyle[key];
            for (const pseudoElementStyleKey of Object.keys(
              pseudoElementStyle,
            )) {
              const pseudoElementStyleValue =
                pseudoElementStyle[pseudoElementStyleKey];
              assignPseudoStyle(
                pseudoElementStyleValue,
                pseudoElementStyleKey,
                pseudoStyleContext,
                pseudoElementStyles,
              );
            }
            boxPseudoNamedStyles[key] = pseudoElementStyles;
            continue;
          }
          console.warn(`unsupported pseudo style key "${key}"`);
        }
      }
      childForwardedProps.pseudoStyle = pseudoStyle;
    }
    if (typeof style === "string") {
      const styleObject = normalizeStyles(style, "css");
      for (const styleName of Object.keys(styleObject)) {
        const styleValue = styleObject[styleName];
        assignStyle(styleValue, styleName, styleContext, boxStyles, "style");
      }
    } else if (style && typeof style === "object") {
      for (const styleName of Object.keys(style)) {
        const styleValue = style[styleName];
        assignStyle(styleValue, styleName, styleContext, boxStyles, "style");
      }
    }

    const updateStyle = useCallback((state) => {
      const boxEl = ref.current;
      applyStyle(boxEl, boxStyles, state, boxPseudoNamedStyles);
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
      const visualEl = visualSelector
        ? boxEl.querySelector(visualSelector)
        : null;
      return initPseudoStyles(pseudoStateEl, {
        pseudoClasses: innerPseudoClasses,
        pseudoState: innerPseudoState,
        effect: updateStyle,
        elementToImpact: boxEl,
        elementListeningPseudoState: visualEl,
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
        typeof child === "function" ? child(childForwardedProps) : child,
      );
    } else if (typeof children === "function") {
      innerChildren = children(childForwardedProps);
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
      data-flow-inline={inline ? "" : undefined}
      data-flow-row={row ? "" : undefined}
      data-flow-column={column ? "" : undefined}
      data-visual-selector={visualSelector}
      {...selfForwardedProps}
    >
      <BoxFlowContext.Provider value={boxFlow}>
        {innerChildren}
      </BoxFlowContext.Provider>
    </TagName>
  );
};
