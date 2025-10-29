import { useLayoutStyle } from "../layout/use_layout_style.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";

import.meta.css = /* css */ `
  :root {
    --navi-icon-align-y: center;
  }

  .navi_text {
    display: inline-flex;
    align-items: baseline;
    gap: 0.1em;
  }

  .navi_icon {
    --align-y: var(--navi-icon-align-y, center);

    display: inline-flex;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    align-self: var(--align-y);
    line-height: 1em;
  }
`;

export const Text = ({
  children,
  color,
  bold,
  italic,
  underline,
  style,
  ...rest
}) => {
  const { all } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(
    {
      ...all,
      color,
      fontWeight: bold ? "bold" : undefined,
      fontStyle: italic ? "italic" : undefined,
      textDecoration: underline ? "underline" : undefined,
    },
    style,
  );

  return (
    <span {...rest} className="navi_text" style={innerStyle}>
      {children}
    </span>
  );
};

const alignYMapping = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};
export const Icon = ({ alignY, style, children, ...rest }) => {
  const innerStyle = { ...style };
  if (alignY !== "center") {
    innerStyle["--align-y"] = alignYMapping[alignY];
  }

  return (
    <span {...rest} className="navi_icon" style={innerStyle}>
      {children}
    </span>
  );
};
