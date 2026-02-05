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

    /* Horizontal (default): First child loses right radius, last child loses left radius */
    &:not([data-vertical]) {
      > *:first-child:not(:only-child) {
        right: calc(var(--border-width) * -1);
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-top-right-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }
      }

      > *:last-child:not(:only-child) {
        left: calc(var(--border-width) * -1);
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

    /* Vertical: First child loses bottom radius, last child loses top radius */
    &[data-vertical] {
      > *:first-child:not(:only-child) {
        bottom: calc(var(--border-width) * -1);
        border-bottom-right-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
      }

      > *:last-child:not(:only-child) {
        top: calc(var(--border-width) * -1);
        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;
      }

      > *:not(:first-child):not(:last-child) {
        border-radius: 0 !important;
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
  if (typeof borderWidth === "string") {
    borderWidth = parseFloat(borderWidth);
  }
  const borderWidthCssValue =
    typeof borderWidth === "number" ? `${borderWidth}px` : borderWidth;

  return (
    <Box
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
