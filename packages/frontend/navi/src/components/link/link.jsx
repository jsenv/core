import.meta.css = /* css */ `
  .navi_link {
  }
`;

export const Link = ({
  children,
  onEnterKeyDown,
  onKeyDown,
  className = "",
  ...rest
}) => {
  return (
    <a
      {...rest}
      className={["navi_link", ...className.split(" ")].join(" ")}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnterKeyDown) {
          e.preventDefault();
          e.stopPropagation();
          onEnterKeyDown(e);
        }
        onKeyDown?.(e);
      }}
    >
      {children}
    </a>
  );
};
