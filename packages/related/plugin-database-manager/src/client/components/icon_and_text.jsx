import { FontSizedSvg } from "../svg/font_sized_svg.jsx";

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
      <FontSizedSvg className="icon">{icon}</FontSizedSvg>
      <span className="text">{children}</span>
    </span>
  );
};
