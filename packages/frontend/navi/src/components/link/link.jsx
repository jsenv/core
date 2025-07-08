import.meta.css = /* css */ `
  .navi_link {
  }
`;

export const Link = ({ children, className = "", ...rest }) => {
  return (
    <a {...rest} className={["navi_link", ...className.split(" ")].join(" ")}>
      {children}
    </a>
  );
};
