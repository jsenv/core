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
import { initPseudoStyles } from "./pseudo_styles.js";

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

    // style management
    contentRef,

    children,
    ...rest
  } = props;

  const layoutFromContext = useContext(BoxLayoutContext);
  const insideFlexContainer =
    layoutFromContext === "row" ||
    layoutFromContext === "column" ||
    layoutFromContext === "inline";

  const ref = useRef();
  const TagName = as;
  const remainingProps = useBoxStyle(rest, {
    boxRef: ref,
    contentRef,
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
  });
  const layout = layoutRow
    ? "row"
    : layoutColumn
      ? "column"
      : layoutInline
        ? "inline"
        : undefined;

  return (
    <TagName ref={ref} {...remainingProps}>
      <BoxLayoutContext.Provider value={layout}>
        {children}
      </BoxLayoutContext.Provider>
    </TagName>
  );
};

const useBoxStyle = (props, { boxRef, contentRef, base }) => {
  let {
    pseudoClasses,
    pseudoElements,
    managedByCSSVars,
    disabled,
    readOnly,
    loading,
    focusVisible,
    ...rest
  } = props;

  if (!pseudoClasses && rest.pseudo) {
    // <Box pseudo={{ ":hover": { backgroundColor: "red" } }}> would watch :hover
    pseudoClasses = Object.keys(rest.pseudo);
  }

  let initProps;
  if (contentRef) {
    initProps = () => {
      const [remainingProps, innerStyle, contentStyle, pseudoStyles] =
        withPropsStyle(
          rest,
          {
            managedByCSSVars,
            pseudoClasses,
            pseudoElements,
            base,
            layout: true,
            typo: true,
            innerSpacing: false,
            visual: false,
          },
          {
            innerSpacing: true,
            visual: true,
          },
        );
      return [
        remainingProps,
        (state) => {
          const el = boxRef.current;
          applyStyles(el, innerStyle);

          const contentEl = contentRef.current;
          if (contentEl) {
            applyStyles(contentEl, contentStyle, pseudoStyles, state);
          }
        },
      ];
    };
  } else {
    initProps = () => {
      const [remainingProps, innerStyle, pseudoStyles] = withPropsStyle(rest, {
        managedByCSSVars,
        pseudoClasses,
        pseudoElements,
        base,
        layout: true,
        typo: true,
      });
      return [
        remainingProps,
        (state) => {
          const el = boxRef.current;
          applyStyles(el, innerStyle, pseudoStyles, state);
        },
      ];
    };
  }

  const [remainingProps, effect] = initProps();
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) {
      console.log("here");
      return;
    }
    console.log(el, pseudoClasses);
    initPseudoStyles(
      el,
      {
        pseudoClasses,
        disabled,
        readOnly,
        loading,
        focusVisible,
      },
      {
        effect,
      },
    );
  }, [
    disabled,
    readOnly,
    loading,
    focusVisible,
    effect,
    contentRef?.current,
    boxRef.current,
  ]);

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
