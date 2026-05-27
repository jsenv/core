import { Box } from "@jsenv/navi/src/box/box.jsx";

const css = /* css */ `
  .navi_color {
    display: block;
    aspect-ratio: 1/1;
    height: 1em;
    height: 1lh;
    background-color: currentColor;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 2px;

    &[navi-color-empty] {
      background-image:
        linear-gradient(45deg, #ccc 25%, transparent 25%),
        linear-gradient(-45deg, #ccc 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ccc 75%),
        linear-gradient(-45deg, transparent 75%, #ccc 75%);
      background-position:
        0 0,
        0 3px,
        3px -3px,
        -3px 0;
      background-size: 6px 6px;
      /* Checkerboard pattern to convey "no color / transparent" */
      background-color: white;
    }
  }
`;

export const Color = ({ children, ...rest }) => {
  import.meta.css = css;
  const color = children || undefined;

  return (
    <Box
      as="span"
      className="navi_color"
      navi-color-empty={color ? undefined : ""}
      // propsCSSVars={COLOR_PROP_CSS_VAR}
      color={color}
      title={color}
      {...rest}
    />
  );
};
// const COLOR_PROP_CSS_VAR = {
//   color: "--color",
// };
