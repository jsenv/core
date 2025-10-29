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

export const useTypographyStyle = (props) => {
  const color = props.color;
  const bold = props.bold;
  const italic = props.italic;
  const underline = props.underline;
  const size = props.size;
  delete props.color;
  delete props.bold;
  delete props.italic;
  delete props.underline;
  delete props.size;
  return {
    color,
    fontWeight: bold ? "bold" : bold === undefined ? undefined : "normal",
    fontStyle: italic ? "italic" : italic === undefined ? undefined : "normal",
    fontSize: size,
    textDecoration: underline
      ? "underline"
      : underline === undefined
        ? undefined
        : "none",
  };
};

export const Text = ({ style, children, ...rest }) => {
  const { all } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(
    {
      ...all,
      ...useTypographyStyle(rest),
    },
    style,
  );

  return (
    <span {...rest} className="navi_text" style={innerStyle}>
      {children}
    </span>
  );
};

export const Icon = ({ style, children, ...rest }) => {
  const { all } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(
    {
      ...all,
      ...useTypographyStyle(rest),
    },
    style,
  );

  return (
    <span {...rest} className="navi_icon" style={innerStyle}>
      {children}
    </span>
  );
};
