import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

import { InlineFlexContext } from "../layout/layout_context.jsx";
import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import {
  resolveSpacingSize,
  withPropsStyle,
} from "../props_composition/with_props_style.js";

import.meta.css = /* css */ `
  :root {
    --navi-icon-align-y: center;
  }

  .navi_icon {
    position: relative;
    width: 1em;
    height: 1em;
    height: 1lh;
    flex-shrink: 0;
    vertical-align: middle;
  }

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

const OverflowPinnedElementContext = createContext(null);
export const Text = (props) => {
  const { overflowEllipsis, ...rest } = props;
  if (overflowEllipsis) {
    return <TextOverflow {...rest} />;
  }
  if (props.overflowPinned) {
    return <TextOverflowPinned {...props} />;
  }
  return <TextBasic {...props} />;
};
const TextOverflow = ({ as = "div", className, children, ...rest }) => {
  const TagName = as;
  const innerClassName = withPropsClassName("navi_text_overflow", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });
  const [OverflowPinnedElement, setOverflowPinnedElement] = useState(null);

  return (
    <TagName className={innerClassName} style={innerStyle} {...remainingProps}>
      <span className="navi_text_overflow_wrapper">
        <span className="navi_text_overflow_text">
          <OverflowPinnedElementContext.Provider
            value={setOverflowPinnedElement}
          >
            {children}
          </OverflowPinnedElementContext.Provider>
        </span>
        {OverflowPinnedElement}
      </span>
    </TagName>
  );
};
const TextOverflowPinned = ({ overflowPinned, ...props }) => {
  const setOverflowPinnedElement = useContext(OverflowPinnedElementContext);
  const text = <Text {...props}></Text>;
  if (!setOverflowPinnedElement) {
    console.warn(
      "<Text overflowPinned> declared outside a <Text overflowEllipsis>",
    );
    return text;
  }
  if (overflowPinned) {
    setOverflowPinnedElement(text);
    return null;
  }
  setOverflowPinnedElement(null);
  return text;
};
const TextBasic = ({
  as = "span",
  className,
  inlineFlex,
  gap = "xxs",
  children,
  ...rest
}) => {
  const TagName = as;
  const innerClassName = withPropsClassName("navi_text", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    base: {
      display: inlineFlex ? "inline-flex" : undefined,
      gap: inlineFlex ? resolveSpacingSize(gap, "gap") : undefined,
    },
    layout: true,
    typo: true,
  });

  const text = (
    <TagName className={innerClassName} style={innerStyle} {...remainingProps}>
      <InlineFlexContext.Provider value={inlineFlex}>
        {children}
      </InlineFlexContext.Provider>
    </TagName>
  );

  if (inlineFlex) {
    return (
      <span style="display: inline-flex; vertical-align: top;">{text}</span>
    );
  }

  return text;
};

export const Icon = ({ className, children, ...rest }) => {
  const innerClassName = withPropsClassName("navi_icon", className);
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
