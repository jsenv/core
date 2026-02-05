import { useLayoutEffect, useRef } from "preact/hooks";
import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  .navi_group {
    --border-width: 1px;

    > * {
      position: relative;
    }
    > *:hover,
    > *[data-hover] {
      z-index: 1;
    }
    > *:focus-visible,
    > *[data-focus-visible] {
      z-index: 1;
    }

    /* Horizontal (default): Cumulative positioning for border overlap */
    &:not([data-vertical]) {
      > *:first-child:not(:only-child) {
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-top-right-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }
      }

      > *:last-child:not(:only-child) {
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-top-left-radius: 0 !important;
          border-bottom-left-radius: 0 !important;
        }
      }

      > *:not(:first-child):not(:last-child) {
        border-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-radius: 0 !important;
        }
      }
    }

    /* Vertical: Cumulative positioning for border overlap */
    &[data-vertical] {
      > *:first-child:not(:only-child) {
        border-bottom-right-radius: 0 !important;
        border-bottom-left-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-bottom-right-radius: 0 !important;
          border-bottom-left-radius: 0 !important;
        }
      }

      > *:last-child:not(:only-child) {
        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-top-left-radius: 0 !important;
          border-top-right-radius: 0 !important;
        }
      }

      > *:not(:first-child):not(:last-child) {
        border-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-radius: 0 !important;
        }
      }
    }
  }
`;

export const Group = ({
  children,
  borderWidth = 1,
  row,
  vertical = row,
  ...props
}) => {
  const groupRef = useRef(null);

  if (typeof borderWidth === "string") {
    borderWidth = parseFloat(borderWidth);
  }
  const borderWidthCssValue =
    typeof borderWidth === "number" ? `${borderWidth}px` : borderWidth;

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    const { children } = group;
    if (children.length === 0) {
      return;
    }
    let i = 0;
    while (i < children.length) {
      const child = children[i];
      if (i === 0) {
        // First child stays in place
        if (vertical) {
          child.style.top = "";
        } else {
          child.style.left = "";
        }
      } else {
        // Subsequent children get cumulative positioning
        const offset = i * borderWidth * -1;
        if (vertical) {
          child.style.top = borderWidth ? `${offset}px` : "";
          child.style.left = "";
        } else {
          child.style.left = borderWidth ? `${offset}px` : "";
          child.style.top = "";
        }
      }
      i++;
    }
  }, [children, borderWidth, vertical]);

  return (
    <Box
      ref={groupRef}
      baseClassName="navi_group"
      data-vertical={vertical ? "" : undefined}
      row={row}
      style={{
        "--border-width": borderWidthCssValue,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};
