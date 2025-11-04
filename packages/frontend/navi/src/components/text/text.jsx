import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";

/*
// TODO: will become a badge or something to display a counter
.navi_count {
    position: relative;
    top: -1px;
    color: rgba(28, 43, 52, 0.4);
  } */

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
const TextBasic = ({ as = "span", className, children, line, ...rest }) => {
  const TagName = as;
  const innerClassName = withPropsClassName("navi_text", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <TagName
      className={innerClassName}
      style={innerStyle}
      data-line={line ? "" : undefined}
      {...remainingProps}
    >
      {children}
    </TagName>
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
