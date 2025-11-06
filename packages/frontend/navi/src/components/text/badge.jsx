import { withPropsClassName } from "../layout/with_props_class_name.js";
import { withPropsStyle } from "../layout/with_props_style.js";

import.meta.css = /* css */ `
  .navi_count {
    position: relative;
    top: -1px;
    color: rgba(28, 43, 52, 0.4);
  }
`;

export const Count = ({ className, children, ...rest }) => {
  const innerClassName = withPropsClassName("navi_text_overflow", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <span className={innerClassName} style={innerStyle} {...remainingProps}>
      ({children})
    </span>
  );
};
