import { useContext } from "preact/hooks";

import { FlexDirectionContext } from "./layout_context.jsx";

export const useLayoutStyle = (props) => {
  const flexDirection = useContext(FlexDirectionContext);

  const style = {};

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
        style.margin = margin;
      }
      if (marginLeft !== undefined) {
        style.marginLeft = marginLeft;
      } else if (marginX !== undefined) {
        style.marginLeft = marginX;
      }
      if (marginRight !== undefined) {
        style.marginRight = marginRight;
      } else if (marginX !== undefined) {
        style.marginRight = marginX;
      }
      if (marginTop !== undefined) {
        style.marginTop = marginTop;
      } else if (marginY !== undefined) {
        style.marginTop = marginY;
      }
      if (marginBottom !== undefined) {
        style.marginBottom = marginBottom;
      } else if (marginY !== undefined) {
        style.marginBottom = marginY;
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
        style.padding = padding;
      }
      if (paddingLeft !== undefined) {
        style.paddingLeft = paddingLeft;
      } else if (paddingX !== undefined) {
        style.paddingLeft = paddingX;
      }
      if (paddingRight !== undefined) {
        style.paddingRight = paddingRight;
      } else if (paddingX !== undefined) {
        style.paddingRight = paddingX;
      }
      if (paddingTop !== undefined) {
        style.paddingTop = paddingTop;
      } else if (paddingY !== undefined) {
        style.paddingTop = paddingY;
      }
      if (paddingBottom !== undefined) {
        style.paddingBottom = paddingBottom;
      } else if (paddingY !== undefined) {
        style.paddingBottom = paddingY;
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
        style.alignSelf = alignY;
      }
      // For row, alignX uses auto margins for positioning
      // NOTE: Auto margins only work effectively for positioning individual items.
      // When multiple adjacent items have the same auto margin alignment (e.g., alignX="end"),
      // only the first item will be positioned as expected because subsequent items
      // will be positioned relative to the previous item's margins, not the container edge.
      if (alignX !== undefined) {
        if (alignX === "start") {
          style.marginRight = "auto";
        } else if (alignX === "end") {
          style.marginLeft = "auto";
        } else if (alignX === "center") {
          style.marginLeft = "auto";
          style.marginRight = "auto";
        }
      }
    } else if (flexDirection === "column") {
      // In column direction: alignX controls align-self, alignY uses auto margins
      if (alignX !== undefined && alignX !== "start") {
        style.alignSelf = alignX;
      }
      // For column, alignY uses auto margins for positioning
      // NOTE: Same auto margin limitation applies - multiple adjacent items with
      // the same alignY won't all position relative to container edges.
      if (alignY !== undefined) {
        if (alignY === "start") {
          style.marginBottom = "auto";
        } else if (alignY === "end") {
          style.marginTop = "auto";
        } else if (alignY === "center") {
          style.marginTop = "auto";
          style.marginBottom = "auto";
        }
      }
    }
    // non flex
    else {
      if (alignX === "start") {
        style.marginRight = "auto";
      } else if (alignX === "center") {
        style.marginLeft = "auto";
        style.marginRight = "auto";
      } else if (alignX === "end") {
        style.marginLeft = "auto";
      }

      if (alignY === "start") {
        style.marginBottom = "auto";
      } else if (alignY === "center") {
        style.marginTop = "auto";
        style.marginBottom = "auto";
      } else if (alignY === "end") {
        style.marginTop = "auto";
      }
    }
  }

  expand: {
    const expand = props.expand;
    delete props.expand;
    if (expand) {
      if (flexDirection === "row") {
        style.flexGrow = 1;
      } else if (flexDirection === "column") {
        style.flexGrow = 1;
      } else {
        style.width = "100%";
      }
    }
  }

  return style;
};
