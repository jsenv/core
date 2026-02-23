import { Box } from "../box/box.jsx";
import { Text } from "../text/text.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";

import.meta.css = /* css */ `
  .navi_icon {
    display: inline-block;
    box-sizing: border-box;
    max-width: 100%;
    max-height: 100%;

    &[data-flow-inline] {
      width: 1em;
      height: 1em;
    }
    &[data-icon-char] {
      flex-grow: 0 !important;
      line-height: normal;
    }
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
    inset: 0;
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
  .navi_icon[data-has-width] > svg,
  .navi_icon[data-has-width] > img {
    width: 100%;
    height: auto;
  }
  .navi_icon[data-has-height] > svg,
  .navi_icon[data-has-height] > img {
    width: auto;
    height: 100%;
  }
  .navi_icon[data-has-width][data-has-height] > svg,
  .navi_icon[data-has-width][data-has-height] > img {
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
  if (width === "auto") width = undefined;
  if (height === "auto") height = undefined;
  const hasExplicitWidth = width !== undefined;
  const hasExplicitHeight = height !== undefined;
  if (!hasExplicitWidth && !hasExplicitHeight) {
    if (decorative === undefined && !onClick) {
      decorative = true;
    }
  } else {
    box = true;
  }
  const ariaProps = decorative ? { "aria-hidden": "true" } : {};

  if (typeof children === "string") {
    return (
      <Text {...props} {...ariaProps} data-icon-text="">
        {children}
      </Text>
    );
  }

  if (box) {
    return (
      <Box
        square
        {...props}
        {...ariaProps}
        box={box}
        baseClassName="navi_icon"
        data-has-width={hasExplicitWidth ? "" : undefined}
        data-has-height={hasExplicitHeight ? "" : undefined}
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
      className={withPropsClassName("navi_icon", props.className)}
      spacing="pre"
      data-icon-char=""
      data-has-width={hasExplicitWidth ? "" : undefined}
      data-has-height={hasExplicitHeight ? "" : undefined}
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
