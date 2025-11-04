import { createContext } from "preact";
import { useContext, useMemo, useState } from "preact/hooks";

import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";

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

const OverflowIndicatorContext = createContext(null);
export const Text = ({ className, children, overflowProtected, ...rest }) => {
  const setOverflowIndicator = useContext(OverflowIndicatorContext);
  const innerClassName = withPropsClassName("navi_text", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });
  const text = (
    <span className={innerClassName} style={innerStyle} {...remainingProps}>
      {children}
    </span>
  );
  setOverflowIndicator?.(overflowProtected ? text : null);
  return text;
};

export const TextOverflow = ({ as = "div", className, children, ...rest }) => {
  const TagName = as;
  const innerClassName = withPropsClassName("navi_text_overflow", className);
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });
  const [OverflowProtectedText, setOverflowProtectedText] = useState(null);
  const setOverflowProtectedTextWrapper = useMemo((value) => {
    return setOverflowProtectedText(() => value);
  }, []);

  return (
    <TagName className={innerClassName} style={innerStyle} {...remainingProps}>
      <span className="navi_text_overflow_wrapper">
        <span className="navi_text_overflow_text">
          <OverflowIndicatorContext.Provider
            value={setOverflowProtectedTextWrapper}
          >
            {children}
          </OverflowIndicatorContext.Provider>
        </span>
        {OverflowProtectedText}
      </span>
    </TagName>
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
