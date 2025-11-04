import { useContext } from "preact/hooks";

import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import {
  resolveSpacingSize,
  withPropsStyle,
} from "../props_composition/with_props_style.js";
import { BoxFlowContext } from "./layout_context.jsx";

import.meta.css = /* css */ ``;

export const Box = ({
  as = "div",
  flow,
  contentAlignX,
  contentAlignY,
  contentGap,
  shrink,
  expand,
  className,
  children,
  ...rest
}) => {
  const contextBoxFlow = useContext(BoxFlowContext);

  const TagName = as;
  const innerClassName = withPropsClassName("navi_box", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    base: {
      ...(flow === "row"
        ? {
            display: "flex",
            flexDirection: "column",
            // Only set alignItems if it's not the default "stretch"
            alignItems: contentAlignX !== "stretch" ? contentAlignX : undefined,
            // Only set justifyContent if it's not the default "start"
            justifyContent:
              contentAlignY !== "start" ? contentAlignY : undefined,
            gap: resolveSpacingSize(contentGap, "gap"),
          }
        : {}),
      ...(flow === "col"
        ? {
            display: "flex",
            flexDirection: "row",
            // set if not the default ("start")
            justifyContent:
              contentAlignX === "start" ? undefined : contentAlignX,
            // set if not the default ("stretch")
            alignItems: contentAlignY === "stretch" ? undefined : contentAlignY,
            gap: resolveSpacingSize(contentGap, "gap"),
          }
        : {}),
      ...(flow === "inline"
        ? {
            display: "inline-flex",
          }
        : {}),

      flexShrink: shrink ? 1 : contextBoxFlow ? 0 : undefined,
      flexGrow: contextBoxFlow && expand ? 1 : undefined,
    },
    layout: true,
  });

  return (
    <TagName
      className={innerClassName}
      style={innerStyle}
      data-flow={flow}
      {...remainingProps}
    >
      <BoxFlowContext.Provider value={flow}>{children}</BoxFlowContext.Provider>
    </TagName>
  );
};
