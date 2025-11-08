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

import { BoxLayoutContext } from "./layout_context.jsx";
import { applyStyle, initPseudoStyles } from "./pseudo_styles.js";
import { withPropsClassName } from "./with_props_class_name.js";
import { resolveSpacingSize, withPropsStyle } from "./with_props_style.js";

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
    shrink,
    expand,
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
  const remainingProps = useBoxStyle(rest, {
    ref,
    managedByCSSVars,
    pseudoState:
      basePseudoState && pseudoState
        ? { ...basePseudoState, ...pseudoState }
        : basePseudoState,
    pseudoClasses,
    pseudoElements,
    pseudoStyle,
    visualSelector,
    pseudoStateSelector,
    base: {
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
    },
  });
  const layout = layoutRow
    ? "row"
    : layoutColumn
      ? "column"
      : layoutInline
        ? "inline"
        : undefined;

  const innerClassName = withPropsClassName(baseClassName, className);

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

const useBoxStyle = (
  props,
  {
    ref,
    managedByCSSVars,
    visualSelector,
    pseudoStateSelector,
    pseudoState,
    pseudoClasses,
    pseudoElements,
    pseudoStyle,
    base,
  },
) => {
  if (!pseudoClasses && pseudoState) {
    // <Box pseudo={{ ":hover": { backgroundColor: "red" } }}> would watch :hover
    pseudoClasses = Object.keys(pseudoState);
  }

  let initProps;
  if (visualSelector) {
    initProps = () => {
      const [remainingProps, innerStyle, contentStyle, pseudoStyles] =
        withPropsStyle(
          props,
          {
            managedByCSSVars,
            pseudoClasses,
            pseudoElements,
            pseudoStyle,
            base,
            outerSpacing: true,
            align: true,
            dimension: true,
            typo: true,
          },
          {
            innerSpacing: true,
            visual: true,
          },
        );
      return [
        remainingProps,
        (state) => {
          const el = ref.current;
          applyStyle(el, innerStyle);

          const visualEl = el.querySelector(visualSelector);
          if (visualEl) {
            applyStyle(visualEl, contentStyle, state, pseudoStyles);
          }
        },
      ];
    };
  } else if (pseudoStateSelector) {
    initProps = () => {
      const [remainingProps, innerStyle, wrapperStyle, pseudoStyles] =
        withPropsStyle(
          props,
          {
            managedByCSSVars,
            pseudoClasses,
            pseudoElements,
            pseudoStyle,
            base,
            outerSpacing: true,
            align: true,
            typo: true,
          },
          {
            innerSpacing: true,
            dimension: true,
            visual: true,
          },
        );
      return [
        remainingProps,
        (state) => {
          const el = ref.current;
          applyStyle(el, innerStyle);

          const pseudoEl = el.closest(pseudoStateSelector);
          if (pseudoEl) {
            applyStyle(pseudoEl, wrapperStyle, state, pseudoStyles);
          }
        },
      ];
    };
  } else {
    initProps = () => {
      const [remainingProps, innerStyle, pseudoStyles] = withPropsStyle(props, {
        managedByCSSVars,
        pseudoClasses,
        pseudoElements,
        pseudoStyle,
        base,
        outerSpacing: true,
        innerSpacing: true,
        align: true,
        dimension: true,
        typo: true,
        visual: true,
      });
      return [
        remainingProps,
        (state) => {
          const el = ref.current;
          applyStyle(el, innerStyle, state, pseudoStyles);
        },
      ];
    };
  }

  const [remainingProps, updateStyle] = initProps();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return null;
    }
    const pseudoStateEl = pseudoStateSelector
      ? el.querySelector(pseudoStateSelector)
      : null;
    return initPseudoStyles(pseudoStateEl, {
      pseudoClasses,
      pseudoState,
      effect: updateStyle,
      elementToImpact: el,
    });
  }, [pseudoClasses, pseudoState, updateStyle]);

  return remainingProps;
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
