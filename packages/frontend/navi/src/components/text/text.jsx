import.meta.css = /* css */ `
  .navi_text {
    display: inline-flex;
    align-items: baseline;
    gap: 0.1em;
  }

  .navi_icon {
    display: inline-flex;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
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

export const Icon = ({ children, ...rest }) => {
  return (
    <span {...rest} className="navi_icon">
      {children}
    </span>
  );
};
