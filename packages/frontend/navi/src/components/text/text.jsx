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

export const Text = ({ children, ...rest }) => {
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <span {...remainingProps} className="navi_text" style={innerStyle}>
      {children}
    </span>
  );
};

export const Icon = ({ children, ...rest }) => {
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <span {...remainingProps} className="navi_icon" style={innerStyle}>
      {children}
    </span>
  );
};
