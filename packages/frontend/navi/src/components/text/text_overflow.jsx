import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";

import.meta.css = /* css */ `
  .navi_text_overflow {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    flex-wrap: wrap;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .navi_text_overflow_wrapper {
    display: flex;
    width: 0;
    flex-grow: 1;
    gap: 0.3em;
  }

  .navi_text_overflow_text {
    max-width: 100%;
    text-overflow: ellipsis;
    overflow: hidden;
  }
`;

export const TextOverflow = ({
  as = "div",
  className,
  children,
  afterContent,
  ...rest
}) => {
  const TagName = as;
  const innerClassName = withPropsClassName("navi_text_overflow", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <TagName className={innerClassName} style={innerStyle} {...remainingProps}>
      <span className="navi_text_overflow_wrapper">
        <span style="navi_text_overflow_text">{children}</span>
        {afterContent}
      </span>
    </TagName>
  );
};
