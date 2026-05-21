import { Box } from "@jsenv/navi/src/box/box.jsx";

const css = /* css */ `
  .navi_color {
    display: block;
    width: 1em;
    height: 1em;
    background-color: var(--color);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 2px;
  }
`;

export const Color = ({ children, ...rest }) => {
  import.meta.css = css;

  return (
    <Box
      as="span"
      className="navi_color"
      {...rest}
      style={{ "--color": children }}
    />
  );
};
