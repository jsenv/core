import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { SurroundingTextAligner } from "./surrounding_text_aligner.jsx";
import { Text } from "./text.jsx";

const css = /* css */ `
  @layer navi {
    /* Ensure data attributes from box.jsx can win to update display */
    .navi_icon {
      display: inline-block;
      box-sizing: border-box;
      max-width: 100%;
      max-height: 100%;
    }
  }

  .navi_icon {
    white-space: nowrap;

    &[data-flow-inline] {
      width: 1em;
      height: 1em;
    }
    &[data-icon-char] {
      flex-grow: 0 !important;

      svg,
      img {
        width: 100%;
        height: 100%;
      }
      svg {
        overflow: visible;
      }
    }
    &[data-interactive] {
      cursor: pointer;
    }
  }

  .navi_icon_char_slot {
    opacity: 0;
    cursor: default;
    user-select: none;
  }
  .navi_text.navi_icon_foreground {
    position: absolute;
    inset: 0;
    display: inline-flex;

    & > .navi_text {
      display: flex;
      aspect-ratio: 1 / 1;
      min-width: 0;
      height: 100%;
      max-height: 1em;
      align-items: center;
      justify-content: center;
    }
  }

  .navi_icon > svg,
  .navi_icon > img {
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
  }
  .navi_icon[data-width-fixed] > svg,
  .navi_icon[data-width-fixed] > img {
    width: 100%;
    height: auto;
  }
  .navi_icon[data-height-fixed] > svg,
  .navi_icon[data-height-fixed] > img {
    width: auto;
    height: 100%;
  }
  .navi_icon[data-width-fixed][data-height-fixed] > svg,
  .navi_icon[data-width-fixed][data-height-fixed] > img {
    width: 100%;
    height: 100%;
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
  import.meta.css = css;

  const innerChildren = href ? (
    <svg width="100%" height="100%">
      <use href={href} />
    </svg>
  ) : (
    children
  );

  let { flex, grid, width, height } = props;
  if (width === "auto") {
    width = undefined;
  }
  if (height === "auto") {
    height = undefined;
  }
  const hasExplicitWidth = width !== undefined;
  const hasExplicitHeight = height !== undefined;
  const widthFixed =
    hasExplicitWidth ||
    (hasExplicitHeight && (props.square || props.circle || props.aspectRatio));
  const heightFixed =
    hasExplicitHeight ||
    (hasExplicitWidth && (props.square || props.circle || props.aspectRatio));
  if (widthFixed || heightFixed) {
    if (flex === undefined) {
      flex = "x";
    }
  } else if (decorative === undefined && !onClick) {
    decorative = true;
  }
  const ariaProps = decorative ? { "aria-hidden": "true" } : {};
  const textRef = useRef();

  if (typeof children === "string") {
    return (
      <Text {...props} {...ariaProps} data-icon-text="">
        {children}
      </Text>
    );
  }

  if (flex || grid) {
    return (
      <Box
        square
        {...props}
        {...ariaProps}
        flex={flex}
        baseClassName="navi_icon"
        data-width-fixed={widthFixed ? "" : undefined}
        data-height-fixed={heightFixed ? "" : undefined}
        data-interactive={onClick ? "" : undefined}
        onClick={onClick}
      >
        {innerChildren}
      </Box>
    );
  }

  const invisibleText = baseChar.repeat(charWidth);
  return (
    <SurroundingTextAligner align="center" childRef={textRef}>
      <Text
        {...props}
        {...ariaProps}
        className={withPropsClassName("navi_icon", props.className)}
        spacing="pre"
        data-icon-char=""
        data-width-fixed={widthFixed ? "" : undefined}
        data-height-fixed={heightFixed ? "" : undefined}
        data-interactive={onClick ? "" : undefined}
        onClick={onClick}
        ref={textRef}
      >
        <span className="navi_icon_char_slot" aria-hidden="true">
          {invisibleText}
        </span>
        <Text className="navi_icon_foreground" spacing="pre">
          {innerChildren}
        </Text>
      </Text>
    </SurroundingTextAligner>
  );
};
