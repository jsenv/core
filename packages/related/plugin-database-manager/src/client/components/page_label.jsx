import { IconAndText } from "./icon_and_text.jsx";

export const PageLabel = ({ icon, label, children }) => {
  return (
    <h1 style="display: flex; align-items: stretch; gap: 0.2em;">
      <IconAndText
        icon={icon}
        style={{
          color: "lightgrey",
          userSelect: "none",
        }}
      >
        {label}
      </IconAndText>
      <span>{children}</span>
    </h1>
  );
};
