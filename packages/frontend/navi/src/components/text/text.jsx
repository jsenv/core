import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";
import { TextOverflow } from "./text_overflow.jsx";

import.meta.css = /* css */ `
  :root {
    --navi-icon-align-y: center;
  }

  .navi_icon {
    display: inline-flex;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    line-height: 1em;
  }

  .navi_text[data-line] {
    display: inline-flex;
    align-items: baseline;
    gap: 0.1em;
    white-space: nowrap;
  }

  .navi_count {
    position: relative;
    top: -1px;
    color: rgba(28, 43, 52, 0.4);
  }
`;

export const Text = ({ className, children, ...rest }) => {
  const innerClassName = withPropsClassName("navi_text", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <span className={innerClassName} style={innerStyle} {...remainingProps}>
      {children}
    </span>
  );
};

export const TextLine = ({ children, ...rest }) => {
  return (
    <Text {...rest} data-line="">
      {children}
    </Text>
  );
};
Text.Line = TextLine;

export const TextAndCount = ({ children, count, ...rest }) => {
  return (
    <TextOverflow
      {...rest}
      afterContent={count > 0 && <span className="navi_count">({count})</span>}
    >
      {children}
    </TextOverflow>
  );
};

export const Icon = ({ className, children, ...rest }) => {
  const innerClassName = withPropsClassName("navi_icon", className);
  if (rest.alignY === undefined) {
    rest.alignY = "center";
  }
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <span className={innerClassName} style={innerStyle} {...remainingProps}>
      {children}
    </span>
  );
};
