import { Box } from "../box/box.jsx";
import { Text } from "../text/text.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";

import.meta.css = /* css */ `
  .navi_icon {
    display: inline-block;
    box-sizing: border-box;
    width: 1em;
    max-width: 100%;
    height: 1em;
    max-height: 100%;
  }

  .navi_icon[data-interactive] {
    cursor: pointer;
  }

  .navi_icon_char_slot {
    opacity: 0;
    cursor: default;
    user-select: none;
  }
  .navi_icon_foreground {
    position: absolute;
    top: 50%;
    left: 0;
    display: inline-flex;
    box-sizing: border-box;
    aspect-ratio: 1/1;
    width: 100%;
    align-items: center;
    justify-content: start;
    transform: translateY(-50%);
  }
  .navi_icon_foreground > .navi_text {
    display: flex;
    aspect-ratio: 1 / 1;
    min-width: 0;
    height: 100%;
    max-height: 1em;
    align-items: center;
    justify-content: center;
  }

  .navi_icon > svg,
  .navi_icon > img {
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
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
  .navi_icon[data-width][data-height] > svg,
  .navi_icon[data-width][data-height] > img {
    width: 100%;
    height: 100%;
  }

  .navi_icon[data-icon-char] svg,
  .navi_icon[data-icon-char] img {
    width: 100%;
    height: 100%;
  }
  .navi_icon[data-icon-char] svg {
    overflow: visible;
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
  decorative,
  onClick,
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
  if (width === undefined && height === undefined) {
    if (decorative === undefined) {
      decorative = true;
    }
  } else {
    box = true;
  }
  const ariaProps = decorative ? { "aria-hidden": "true" } : {};

  if (box) {
    if (
      import.meta.dev &&
      props.scale &&
      props.padding &&
      String(props.padding).includes("em")
    ) {
      console.warn(
        "Using 'em' units for padding with scale cause positioning issue during the scale transition",
      );
    }

    return (
      <Box
        {...props}
        {...ariaProps}
        box={box}
        baseClassName="navi_icon"
        data-width={width}
        data-height={height}
        data-interactive={onClick ? "" : undefined}
        onClick={onClick}
      >
        {innerChildren}
      </Box>
    );
  }

  const invisibleText = baseChar.repeat(charWidth);

  return (
    <Text
      {...props}
      {...ariaProps}
      className={withPropsClassName("navi_icon", className)}
      spacing="pre"
      data-icon-char=""
      data-width={width}
      data-height={height}
      data-interactive={onClick ? "" : undefined}
      onClick={onClick}
    >
      <span className="navi_icon_char_slot" aria-hidden="true">
        {invisibleText}
      </span>
      <Text className="navi_icon_foreground" spacing="pre">
        {innerChildren}
      </Text>
    </Text>
  );
};
