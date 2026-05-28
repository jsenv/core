/**
 * Box - A Swiss Army Knife for Layout
 *
 * A regular div by default, enhanced with styling props for spacing, sizing,
 * and layout. The main value is a friendlier API over raw CSS Flexbox.
 *
 * ## Display & Layout
 *
 * - `flex` — horizontal flex container (items side by side)
 * - `flex="y"` — vertical flex container (items stacked). The prop name makes
 *   the axis explicit, avoiding the classic CSS trap where `flex-direction: column`
 *   actually stacks items vertically despite "column" feeling horizontal.
 * - `grid` — grid container
 * - `inline` — switches to inline display (works with flex and grid too)
 *
 * ## Alignment
 *
 * Instead of CSS's justify-content/align-items which swap meaning based on flex-direction:
 * - `alignX` — horizontal alignment, always
 * - `alignY` — vertical alignment, always
 *
 * ## Spacing & Sizing
 *
 * Props for margin, padding, gap, width, height, expand, shrink, and more.
 *
 * ## Pseudo-class Styles
 *
 * The `style` prop supports pseudo-class keys alongside regular CSS properties.
 * This lets you express hover, focus, and custom interaction states in one object,
 * without writing CSS or adding class names:
 *
 * ```jsx
 * <Box
 *   style={{
 *     backgroundColor: "blue",
 *     ":-navi:pressed": {
 *       backgroundColor: "darkblue",
 *     },
 *     ":hover": {
 *       backgroundColor: "lightblue",
 *     },
 *   }}
 * />
 * ```
 *
 * Styles are applied directly to the DOM (not via Preact's style prop) for two reasons:
 * 1. **Pseudo-class support**: reacting to `:hover`, `:focus`, or custom states like
 *    `:-navi:pressed` without re-rendering the component on every pseudo state change.
 * 2. **Correct initial render**: pseudo-class state must be read from the DOM node at
 *    mount time. Preact's style prop runs before the DOM exists, so the right initial
 *    style can only be determined once the node is available.
 */

import { normalizeStyles } from "@jsenv/dom";
import { createContext, isValidElement, toChildArray } from "preact";
import { useCallback, useContext } from "preact/hooks";

import { withPropsClassName } from "../utils/with_props_class_name.js";
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
import { useComposeElementRef } from "./use_element_ref.js";
import { usePartiallyHidden } from "./use_partially_hidden.js";

export const BoxForwardedPropsContext = createContext({});

import.meta.css = /* css */ `
  @layer navi {
    /*
    When using square/circle/aspectRatio prop we expect box to respect the aspect ratio.
    But within flex containers or stuff like that the min-width/min-height auto
    will prevent the item from shrinking to respect aspect-ratio
    We put that in a layer navi + a specific attribute so that it's very easy to override this
    */
    [navi-aspect-ratio] {
      min-width: 0;
      min-height: 0;
    }
  }

  /* We force a given display style using html attribute instead of inline style */
  /* No particular reason for this, logic could be moved to inline style like the rest */
  /* It was an attempt to see if attributes where a good candidate to set style based on props */
  /* Actullay it's not that much as it make the attribute and CSS complexity explode */
  /* For now it's kept here and must be outside layer navi to be able to override any given display
  Set by navi itself on their default display */
  [navi-box-flow="inline"] {
    display: inline;
  }
  [navi-box-flow="block"] {
    display: block;
  }
  [navi-box-flow="inline-block"] {
    display: inline-block;
  }
  [navi-box-flow="flex-x"] {
    display: flex;
  }
  [navi-box-flow="flex-y"] {
    display: flex;
    flex-direction: column;
  }
  [navi-box-flow="inline-flex-x"] {
    display: inline-flex;
  }
  [navi-box-flow="inline-flex-y"] {
    display: inline-flex;
    flex-direction: column;
  }
  [navi-box-flow="grid"] {
    display: grid;
    &[navi-box-flow-column] {
      grid-auto-flow: column;
    }
    &[navi-box-flow-row] {
      grid-auto-flow: row;
    }
    &[navi-box-flow-column][navi-box-flow-row] {
      grid-auto-flow: unset;
    }
  }
  [navi-box-flow="inline-grid"] {
    display: inline-grid;
    &[navi-box-flow-column] {
      grid-auto-flow: column;
    }
    &[navi-box-flow-row] {
      grid-auto-flow: row;
    }
    &[navi-box-flow-column][navi-box-flow-row] {
      grid-auto-flow: unset;
    }
  }
  /*

  It's very common to declare a display on component as follow
  .component_class { display: component_display; }

  This kill the default behavior of [hidden] attribute and we need to explicitly handle it with:
  .component_class[hidden] { display: none; }

  To avoid this extra work and potential mistakes we force the default behavior of [hidden] attribute.
  */
  [hidden] {
    display: none !important;
  }

  /* Partially hidden (or fully hidden) element should not participate in view transition no matter what */
  /* Otherwise they appear immedatly and fully visible from a fully/partially hidden state */
  [navi-partially-hidden] {
    view-transition-name: none !important;
  }
`;

const PSEUDO_CLASSES_DEFAULT = [];
const PSEUDO_ELEMENTS_DEFAULT = [];
const STYLE_CSS_VARS_DEFAULT = {};
const PROPS_CSS_VARS_DEFAULT = {};
// When only pseudoStateSelector is set (no visualSelector), the box owns its
// visual identity. Only event handlers and these explicit props are forwarded
// to the inner semantic/interactive child element.
const PSEUDO_STATE_CHILD_PROP_SET = new Set(["tabIndex", "tabindex"]);

export const Box = (props) => {
  const {
    as = "div",
    baseClassName,
    className,
    baseStyle,

    // style management
    style,
    styleCSSVars = STYLE_CSS_VARS_DEFAULT,
    propsCSSVars = PROPS_CSS_VARS_DEFAULT,
    basePseudoState,
    pseudoState, // for demo purposes it's possible to control pseudo state from props
    pseudoClasses = PSEUDO_CLASSES_DEFAULT,
    pseudoElements = PSEUDO_ELEMENTS_DEFAULT,
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
    hasChildUsingForwardedProps,
    baseChildPropSet,
    childPropSet,
    // preventInitialTransition can be used to prevent transition on mount
    // (when transition is set via props, this is done automatically)
    // so this prop is useful only when transition is enabled from "outside" (via CSS)
    preventInitialTransition,

    children,
    separator,
    ...rest
  } = props;
  let ref;
  const TagName = as;

  const defaultDisplay = getDefaultDisplay(TagName);
  // Read the parent flow early so we can use it when display="inherit" is requested.
  const parentBoxFlow = useContext(BoxFlowContext);
  let { inline, block, flex, grid, row, column } = rest;
  // To obtain flex direction we have the following deprecated props:
  // - [deprecated] <Box column> -> <Box flex> or <Box flex="x">
  // - [deprecated] <Box row> -> <Box flex="y">
  // - [deprecated] <Box flex column> -> <Box flex="x">
  // - [deprecated] <Box flex row> -> <Box flex="y">

  if (flex === true) {
    flex = row ? "y" : "x";
  }
  if (flex === undefined && grid === undefined) {
    if (column) {
      flex = "x";
    } else if (row) {
      flex = "y";
    }
  }
  if (defaultDisplay === "inline") {
    if (inline === undefined && !block) {
      inline = true;
    }
  } else if (defaultDisplay === "block") {
    if (block === undefined && !flex && !grid) {
      block = true;
    }
  } else if (defaultDisplay === "inline-block") {
    if (inline === undefined && !block) {
      inline = true;
    }
    if (block === undefined && !flex && !grid) {
      block = true;
    }
  }
  if (
    inline &&
    (rest.width !== undefined || rest.height !== undefined) &&
    flex === undefined
  ) {
    flex = "x";
  }
  let boxFlow;
  if (inline) {
    if (flex === "x") {
      boxFlow = "inline-flex-x";
    } else if (flex === "y") {
      boxFlow = "inline-flex-y";
    } else if (grid) {
      boxFlow = "inline-grid";
    } else if (block) {
      boxFlow = "inline-block";
    } else {
      boxFlow = "inline";
    }
  } else if (flex === "x") {
    boxFlow = "flex-x";
  } else if (flex === "y") {
    boxFlow = "flex-y";
  } else if (grid) {
    boxFlow = "grid";
  } else if (block) {
    boxFlow = "block";
  } else {
    boxFlow = defaultDisplay;
  }
  // When display="inherit" is passed, adopt the parent's flow instead of computing one.
  // This lets a child Box mirror its parent's flex/grid/block layout without repeating
  // the same layout props, and is used e.g. by Button's inner content element.
  if (rest.display === "inherit") {
    boxFlow = parentBoxFlow;
  }
  const boxFlowIsDefault = boxFlow === defaultDisplay;

  const remainingPropKeySet = new Set(Object.keys(rest));
  // some props not destructured but that are neither
  // style props, nor should be forwarded to the child
  remainingPropKeySet.delete("ref");

  const innerClassName = withPropsClassName(baseClassName, className);
  const selfForwardedProps = {};
  const childForwardedProps = {};
  styling: {
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

      preventInitialTransition,
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
    const canForwardToChild = hasChildUsingForwardedProps;
    const shouldForwardAllToChild =
      canForwardToChild && visualSelector && pseudoStateSelector;

    const addStyle = (value, name, styleContext, stylesTarget, context) => {
      const mergedValue = prepareStyleValue(
        stylesTarget[name],
        value,
        name,
        styleContext,
        context,
      );
      const cssVar = styleContext.styleCSSVars[name];
      if (cssVar) {
        addCSSVar(mergedValue, cssVar, stylesTarget);
        if (name === "borderRadius" && value === "inherit") {
          // "inherit" cannot be expressed via a CSS variable — a var() reference
          // never propagates the inherit keyword itself. So when borderRadius="inherit"
          // we must also set the inline style directly so the element actually
          // inherits the radius from its parent.
          styleDeps.push(name, value);
          stylesTarget[name] = mergedValue;
        }
        return true;
      }
      styleDeps.push(name, value); // impact box style -> add to deps
      stylesTarget[name] = mergedValue;
      return false;
    };
    const addCSSVar = (value, name, stylesTarget) => {
      styleDeps.push(name, value); // impact box style -> add to deps
      stylesTarget[name] = value;
    };
    const addStyleMaybeForwarding = (
      value,
      name,
      styleContext,
      stylesTarget,
      context,
      visualChildPropStrategy,
    ) => {
      if (!visualChildPropStrategy) {
        addStyle(value, name, styleContext, stylesTarget, context);
        return false;
      }
      const cssVar = styleCSSVars[name];
      if (cssVar) {
        // css var wins over visual child handling
        addStyle(value, name, styleContext, stylesTarget, context);
        return false;
      }
      if (visualChildPropStrategy === "copy") {
        // we stylyze ourself + forward prop to the child
        addStyle(value, name, styleContext, stylesTarget, context);
      }
      if (!canForwardToChild) {
        return false;
      }
      return true;
    };

    // By default ":hover", ":active" are not tracked.
    // But if code explicitely do something like:
    // style={{ ":hover": { backgroundColor: "red" } }}
    // then we'll track ":hover" state changes even for basic elements like <div>
    const pseudoClassesFromStyleSet = new Set();
    boxPseudoNamedStyles = {};
    const visitProp = (
      value,
      name,
      styleContext,
      boxStylesTarget,
      styleOrigin,
    ) => {
      const isPseudoElement = name.startsWith("::");
      const isPseudoClass = name.startsWith(":");
      if (isPseudoElement || isPseudoClass) {
        styleDeps.push(name);
        pseudoClassesFromStyleSet.add(name);
        const pseudoStyleContext = {
          ...styleContext,
          styleCSSVars: {
            ...styleCSSVars,
            ...styleCSSVars[name],
          },
          pseudoName: name,
        };
        const pseudoStyleKeys = Object.keys(value);
        if (isPseudoElement) {
          const pseudoElementStyles = {};
          for (const key of pseudoStyleKeys) {
            visitProp(
              value[key],
              key,
              pseudoStyleContext,
              pseudoElementStyles,
              "pseudo_style",
            );
          }
          boxPseudoNamedStyles[name] = pseudoElementStyles;
          return;
        }
        const pseudoClassStyles = {};
        for (const key of pseudoStyleKeys) {
          visitProp(
            value[key],
            key,
            pseudoStyleContext,
            pseudoClassStyles,
            "pseudo_style",
          );
          boxPseudoNamedStyles[name] = pseudoClassStyles;
        }
        return;
      }

      const context = styleOrigin === "base_style" ? "js" : "css";
      const isCss = styleOrigin === "base_style" || styleOrigin === "style";
      if (isCss) {
        addStyle(value, name, styleContext, boxStylesTarget, context);
        return;
      }
      if (name.startsWith("--")) {
        addStyle(value, name, styleContext, boxStylesTarget, context);
        return;
      }
      const propCssVar = propsCSSVars[name];
      if (propCssVar) {
        if (value !== undefined) {
          addCSSVar(value, propCssVar, boxStylesTarget);
        }
        return;
      }
      const isPseudoStyle = styleOrigin === "pseudo_style";
      if (isStyleProp(name)) {
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
            styleContext,
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
            styleContext,
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
        return;
      }
      // not a style prop what do we do with it?
      // When pseudoStateSelector is set, the child element is the semantic/interactive one
      // When both selectors are set the child IS the component (e.g. Button with scale
      // transform) — forward everything so it behaves like a normal element.
      // When only pseudoStateSelector is set, the box keeps its own visual identity
      // (border, background, overflow…) and the child is just the interactive/semantic
      // element inside it. Only event handlers (onXxx) belong on that child; everything
      // else stays on the box.
      if (isPseudoStyle) {
        if (shouldForwardAllToChild) {
          // le pseudo style est deja passé tel quel au child
        } else {
          console.warn(`unsupported pseudo style key "${name}"`);
          selfForwardedProps[name] = value;
        }
      } else if (shouldForwardAllToChild) {
        childForwardedProps[name] = value;
      } else {
        selfForwardedProps[name] = value;
      }
      return;
    };

    if (baseStyle) {
      for (const key of baseStyle) {
        const value = baseStyle[key];
        visitProp(value, key, styleContext, boxStyles, "baseStyle");
      }
    }
    for (const propName of remainingPropKeySet) {
      const propValue = rest[propName];
      if (baseChildPropSet?.has(propName) || childPropSet?.has(propName)) {
        if (canForwardToChild) {
          childForwardedProps[propName] = propValue;
        } else {
          selfForwardedProps[propName] = propValue;
        }
        continue;
      }
      if (canForwardToChild && toCopySet.has(propName)) {
        childForwardedProps[propName] = propValue;
      }
      const isDataAttribute = propName.startsWith("data-");
      if (isDataAttribute) {
        selfForwardedProps[propName] = propValue;
        continue;
      }
      // At some point I'd like to transform all data-* attribute in the DOM
      // into navi-* attribute so that when you look at the DOM you can easily understand which attributes
      // where added by navi or your code.
      // This help human to better scan the DOM
      const isNaviAttribute = propName.startsWith("navi-");
      if (isNaviAttribute) {
        selfForwardedProps[propName] = propValue;
        continue;
      }
      const isEventHandler = propName.startsWith("on");
      if (isEventHandler) {
        if (shouldForwardAllToChild) {
          childForwardedProps[propName] = propValue;
          continue;
        }
        selfForwardedProps[propName] = propValue;
        continue;
      }
      if (
        canForwardToChild &&
        pseudoStateSelector &&
        PSEUDO_STATE_CHILD_PROP_SET.has(propName)
      ) {
        childForwardedProps[propName] = propValue;
        continue;
      }
      visitProp(propValue, propName, styleContext, boxStyles, "prop");
    }
    if (typeof style === "string") {
      const styleObject = normalizeStyles(style, "css");
      for (const styleName of Object.keys(styleObject)) {
        const styleValue = styleObject[styleName];
        visitProp(styleValue, styleName, styleContext, boxStyles, "style");
      }
    } else if (style && typeof style === "object") {
      for (const styleName of Object.keys(style)) {
        const styleValue = style[styleName];
        visitProp(styleValue, styleName, styleContext, boxStyles, "style");
      }
    }

    styleDeps.push(pseudoStateSelector, innerPseudoState);
    let innerPseudoClasses;
    if (pseudoClassesFromStyleSet.size) {
      innerPseudoClasses = [...pseudoClasses];
      if (pseudoClasses !== PSEUDO_CLASSES_DEFAULT) {
        styleDeps.push(...pseudoClasses);
      }
      for (const key of pseudoClassesFromStyleSet) {
        innerPseudoClasses.push(key);
        styleDeps.push(key);
      }
    } else {
      innerPseudoClasses = pseudoClasses;
      if (pseudoClasses !== PSEUDO_CLASSES_DEFAULT) {
        styleDeps.push(...pseudoClasses);
      }
    }
    const syncBox = useCallback((boxEl) => {
      const pseudoStateEl = pseudoStateSelector
        ? boxEl.querySelector(pseudoStateSelector)
        : boxEl;
      if (!pseudoStateEl) {
        console.error(
          `pseudoStateSelector "${pseudoStateSelector}" did not match any element inside the box`,
          boxEl,
        );
      }
      const visualEl = visualSelector
        ? boxEl.querySelector(visualSelector)
        : null;
      return initPseudoStyles(pseudoStateEl, {
        pseudoClasses: innerPseudoClasses,
        pseudoState: innerPseudoState,
        effect: (state) => {
          applyStyle(
            boxEl,
            boxStyles,
            state,
            boxPseudoNamedStyles,
            preventInitialTransition,
          );
        },
        elementToImpact: boxEl,
        elementListeningPseudoState:
          visualEl === pseudoStateEl ? null : visualEl,
      });
    }, styleDeps);
    ref = useComposeElementRef(syncBox, props.ref);

    usePartiallyHidden(ref, Boolean(rest.viewTransitionName));
  }

  let innerChildren = children;
  if (separator) {
    // Flatten nested arrays (e.g., from .map()) to treat each element as individual child
    innerChildren = applySeparatorOnChildren(innerChildren, separator);
  }

  // When hasChildUsingForwardedProps is used it means
  // Some/all the children needs to access remainingProps
  // to render and will provide a function to do so.
  if (hasChildUsingForwardedProps) {
    innerChildren = (
      <BoxForwardedPropsContext.Provider value={childForwardedProps}>
        {innerChildren}
      </BoxForwardedPropsContext.Provider>
    );
  }

  const aspectRatio = rest.square || rest.circle ? "1/1" : rest.aspectRatio;

  return (
    <TagName
      ref={ref}
      className={innerClassName}
      navi-box-flow={boxFlowIsDefault ? undefined : boxFlow}
      navi-box-flow-row={row ? "" : undefined}
      navi-box-flow-column={column ? "" : undefined}
      navi-aspect-ratio={aspectRatio ? aspectRatio : undefined}
      data-visual-selector={visualSelector}
      {...selfForwardedProps}
    >
      <BoxFlowContext.Provider value={boxFlow}>
        {innerChildren}
      </BoxFlowContext.Provider>
    </TagName>
  );
};

const toCopySet = new Set([]);

export const applySeparatorOnChildren = (children, separator) => {
  const flattenedChildren = toChildArray(children);
  if (flattenedChildren.length <= 1) {
    return children;
  }
  const childrenWithSeparators = [];
  let i = 0;
  while (true) {
    const child = flattenedChildren[i];
    childrenWithSeparators.push(child);
    i++;
    const isLast = i === flattenedChildren.length;
    if (isLast) {
      break;
    }
    const nextChild = flattenedChildren[i];
    if (!shouldInjectSeparatorBetween(child, nextChild)) {
      continue;
    }
    // Support function separators that receive separator index
    const separatorElement =
      typeof separator === "function"
        ? separator(i - 1) // i-1 because i was incremented after pushing child
        : separator;
    childrenWithSeparators.push(separatorElement);
  }
  return childrenWithSeparators;
};
const shouldInjectSeparatorBetween = (left, right) => {
  if (isValidElement(left) && left.props?.hidden) {
    return false;
  }
  if (isValidElement(right) && right.props?.hidden) {
    return false;
  }
  return true;
};
