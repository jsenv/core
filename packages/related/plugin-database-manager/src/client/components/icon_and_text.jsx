export const IconAndText = ({ icon, children, ...rest }) => {
  return (
    <span
      className="icon_and_text"
      {...rest}
      style={{
        display: "flex",
        alignItems: "center",
        ...rest.style,
      }}
    >
      <span className="icon" style="width: 1em; height: 1em; line-height: 1em;">
        {icon}
      </span>
      <span className="text">{children}</span>
    </span>
  );
};
