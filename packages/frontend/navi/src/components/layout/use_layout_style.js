/**
 * Layout Style Hook
 *
 * This hook processes layout-related props and converts them into CSS styles.
 * It handles spacing (margin/padding), alignment (alignX/alignY), and expansion behavior.
 * The hook is context-aware and adapts behavior based on flex direction.
 *
 * Key features:
 * - Spacing: margin/padding with X/Y shortcuts and directional variants
 * - Alignment: alignX/alignY using align-self and auto margins
 * - Expansion: expand prop for taking remaining space (flexGrow or width: 100%)
 * - Context-aware: behavior changes based on FlexDirectionContext (row/column/none)
 */

import { useContext } from "preact/hooks";

import { FlexDirectionContext } from "./layout_context.jsx";

/**
 * Converts layout props into CSS styles
 * @param {Object} props - Component props containing layout properties
 * @param {string|number} [props.margin] - All-sides margin
 * @param {string|number} [props.marginX] - Horizontal margin (left + right)
 * @param {string|number} [props.marginY] - Vertical margin (top + bottom)
 * @param {string|number} [props.marginLeft] - Left margin
 * @param {string|number} [props.marginRight] - Right margin
 * @param {string|number} [props.marginTop] - Top margin
 * @param {string|number} [props.marginBottom] - Bottom margin
 * @param {string|number} [props.padding] - All-sides padding
 * @param {string|number} [props.paddingX] - Horizontal padding (left + right)
 * @param {string|number} [props.paddingY] - Vertical padding (top + bottom)
 * @param {string|number} [props.paddingLeft] - Left padding
 * @param {string|number} [props.paddingRight] - Right padding
 * @param {string|number} [props.paddingTop] - Top padding
 * @param {string|number} [props.paddingBottom] - Bottom padding
 * @param {"start"|"center"|"end"|"stretch"} [props.alignX] - Horizontal alignment
 * @param {"start"|"center"|"end"|"stretch"} [props.alignY] - Vertical alignment
 * @param {boolean} [props.expand] - Whether element should expand to fill available space
 * @returns {Object} Object with categorized styles: { margin, padding, alignment, expansion, all }
 */
export const useLayoutStyle = (props) => {
  const flexDirection = useContext(FlexDirectionContext);

  const marginStyle = {};
  const paddingStyle = {};
  const alignmentStyle = {};
  const expansionStyle = {};

  spacing: {
    outer_spacing: {
      const margin = props.margin;
      const marginX = props.marginX;
      const marginY = props.marginY;
      const marginLeft = props.marginLeft;
      const marginRight = props.marginRight;
      const marginTop = props.marginTop;
      const marginBottom = props.marginBottom;
      delete props.margin;
      delete props.marginX;
      delete props.marginY;
      delete props.marginLeft;
      delete props.marginRight;
      delete props.marginTop;
      delete props.marginBottom;

      if (margin !== undefined) {
        marginStyle.margin = margin;
      }
      if (marginLeft !== undefined) {
        marginStyle.marginLeft = marginLeft;
      } else if (marginX !== undefined) {
        marginStyle.marginLeft = marginX;
      }
      if (marginRight !== undefined) {
        marginStyle.marginRight = marginRight;
      } else if (marginX !== undefined) {
        marginStyle.marginRight = marginX;
      }
      if (marginTop !== undefined) {
        marginStyle.marginTop = marginTop;
      } else if (marginY !== undefined) {
        marginStyle.marginTop = marginY;
      }
      if (marginBottom !== undefined) {
        marginStyle.marginBottom = marginBottom;
      } else if (marginY !== undefined) {
        marginStyle.marginBottom = marginY;
      }
    }
    inner_spacing: {
      const padding = props.padding;
      const paddingX = props.paddingX;
      const paddingY = props.paddingY;
      const paddingLeft = props.paddingLeft;
      const paddingRight = props.paddingRight;
      const paddingTop = props.paddingTop;
      const paddingBottom = props.paddingBottom;
      delete props.padding;
      delete props.paddingX;
      delete props.paddingY;
      delete props.paddingLeft;
      delete props.paddingRight;
      delete props.paddingTop;
      delete props.paddingBottom;

      if (padding !== undefined) {
        paddingStyle.padding = padding;
      }
      if (paddingLeft !== undefined) {
        paddingStyle.paddingLeft = paddingLeft;
      } else if (paddingX !== undefined) {
        paddingStyle.paddingLeft = paddingX;
      }
      if (paddingRight !== undefined) {
        paddingStyle.paddingRight = paddingRight;
      } else if (paddingX !== undefined) {
        paddingStyle.paddingRight = paddingX;
      }
      if (paddingTop !== undefined) {
        paddingStyle.paddingTop = paddingTop;
      } else if (paddingY !== undefined) {
        paddingStyle.paddingTop = paddingY;
      }
      if (paddingBottom !== undefined) {
        paddingStyle.paddingBottom = paddingBottom;
      } else if (paddingY !== undefined) {
        paddingStyle.paddingBottom = paddingY;
      }
    }
  }

  align: {
    const alignX = props.alignX;
    const alignY = props.alignY;
    delete props.alignX;
    delete props.alignY;

    // flex
    if (flexDirection === "row") {
      // In row direction: alignX controls justify-content, alignY controls align-self
      if (alignY !== undefined && alignY !== "start") {
        alignmentStyle.alignSelf = alignY;
      }
      // For row, alignX uses auto margins for positioning
      // NOTE: Auto margins only work effectively for positioning individual items.
      // When multiple adjacent items have the same auto margin alignment (e.g., alignX="end"),
      // only the first item will be positioned as expected because subsequent items
      // will be positioned relative to the previous item's margins, not the container edge.
      if (alignX !== undefined) {
        if (alignX === "start") {
          alignmentStyle.marginRight = "auto";
        } else if (alignX === "end") {
          alignmentStyle.marginLeft = "auto";
        } else if (alignX === "center") {
          alignmentStyle.marginLeft = "auto";
          alignmentStyle.marginRight = "auto";
        }
      }
    } else if (flexDirection === "column") {
      // In column direction: alignX controls align-self, alignY uses auto margins
      if (alignX !== undefined && alignX !== "start") {
        alignmentStyle.alignSelf = alignX;
      }
      // For column, alignY uses auto margins for positioning
      // NOTE: Same auto margin limitation applies - multiple adjacent items with
      // the same alignY won't all position relative to container edges.
      if (alignY !== undefined) {
        if (alignY === "start") {
          alignmentStyle.marginBottom = "auto";
        } else if (alignY === "end") {
          alignmentStyle.marginTop = "auto";
        } else if (alignY === "center") {
          alignmentStyle.marginTop = "auto";
          alignmentStyle.marginBottom = "auto";
        }
      }
    }
    // non flex
    else {
      if (alignX === "start") {
        alignmentStyle.marginRight = "auto";
      } else if (alignX === "center") {
        alignmentStyle.marginLeft = "auto";
        alignmentStyle.marginRight = "auto";
      } else if (alignX === "end") {
        alignmentStyle.marginLeft = "auto";
      }

      if (alignY === "start") {
        alignmentStyle.marginBottom = "auto";
      } else if (alignY === "center") {
        alignmentStyle.marginTop = "auto";
        alignmentStyle.marginBottom = "auto";
      } else if (alignY === "end") {
        alignmentStyle.marginTop = "auto";
      }
    }
  }

  expand: {
    const expand = props.expand;
    delete props.expand;
    if (expand) {
      if (flexDirection === "row") {
        expansionStyle.flexGrow = 1;
      } else if (flexDirection === "column") {
        expansionStyle.flexGrow = 1;
      } else {
        expansionStyle.width = "100%";
      }
    }
  }

  // Merge all styles for convenience
  const allStyles = {
    ...marginStyle,
    ...paddingStyle,
    ...alignmentStyle,
    ...expansionStyle,
  };

  return {
    margin: marginStyle,
    padding: paddingStyle,
    alignment: alignmentStyle,
    expansion: expansionStyle,
    all: allStyles,
  };
};
