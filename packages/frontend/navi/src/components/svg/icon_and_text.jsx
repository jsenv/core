import { FontSizedSvg } from "./font_sized_svg.jsx";

export const IconAndText = ({ icon, children, ...rest }) => {
  if (typeof icon === "function") icon = icon({});

  return (
    <span
      className="icon_and_text"
      {...rest}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.1em",
        ...rest.style,
      }}
    >
      <FontSizedSvg className="icon">{icon}</FontSizedSvg>
      <span className="text">{children}</span>
    </span>
  );
};
