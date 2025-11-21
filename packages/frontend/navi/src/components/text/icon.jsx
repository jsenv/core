import { Box } from "../layout/box.jsx";
import { withPropsClassName } from "../layout/with_props_class_name.js";
import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  .navi_icon {
    display: inline-block;
    box-sizing: border-box;
  }

  .navi_icon_char_slot {
    opacity: 0;
    cursor: default;
    user-select: none;
  }
  .navi_icon_foreground {
    position: absolute;
    inset: 0;
    display: inline-flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: start;
  }
  .navi_icon_foreground > .navi_text {
    display: flex;
    aspect-ratio: 1 / 1;
    height: 100%;
    max-height: 1em;
    align-items: center;
    justify-content: center;
  }

  .navi_icon > svg,
  .navi_icon > img {
    width: 100%;
    height: 100%;
  }
  .navi_icon[data-width] > svg,
  .navi_icon[data-width] > img {
    width: 100%;
    height: auto;
  }
  .navi_icon[data-height] > svg,
  .navi_icon[data-height] > img {
    width: auto;
    height: 100%;
  }
`;

export const Icon = ({
  href,
  children,
  className,
  charWidth = 1,
  // 0 (zéro) is the real char width
  // but 2 zéros gives too big icons
  // while 1 "W" gives a nice result
  baseChar = "W",
  "aria-label": ariaLabel,
  role,
  decorative = false,
  ...props
}) => {
  const innerChildren = href ? (
    <svg width="100%" height="100%">
      <use href={href} />
    </svg>
  ) : (
    children
  );

  let { box, width, height } = props;
  if (width !== undefined || height !== undefined) {
    box = true;
  }

  if (box) {
    return (
      <Box
        {...props}
        baseClassName="navi_icon"
        data-width={width}
        data-height={height}
      >
        {innerChildren}
      </Box>
    );
  }

  const invisibleText = baseChar.repeat(charWidth);
  const ariaProps = decorative
    ? { "aria-hidden": "true" }
    : { role, "aria-label": ariaLabel };

  return (
    <Text
      {...props}
      {...ariaProps}
      box={box}
      className={withPropsClassName("navi_icon", className)}
      contentSpacing="pre"
      data-icon-char=""
      data-width={width}
      data-height={height}
    >
      <span className="navi_icon_char_slot" aria-hidden="true">
        {invisibleText}
      </span>
      <span className="navi_icon_foreground">
        <Text contentSpacing="pre">{innerChildren}</Text>
      </span>
    </Text>
  );
};
