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
    align-self: center;
    line-height: 1em;
  }
`;

export const Text = ({ children, ...rest }) => {
  return (
    <span {...rest} className="navi_text">
      {children}
    </span>
  );
};

export const Icon = ({ alignY = "center", style, children, ...rest }) => {
  const innerStyle = { ...style };
  if (alignY !== "center") {
    innerStyle["--align-y"] = alignY;
  }

  return (
    <span {...rest} className="navi_icon" style={innerStyle}>
      {children}
    </span>
  );
};
