import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  .navi_group {
    --border-width: 1px;

    > *:hover,
    > *[data-hover] {
      position: relative;
      z-index: 1;
    }
    > *:focus-visible,
    > *[data-focus-visible] {
      position: relative;
      z-index: 1;
    }

    /* Horizontal (default): Cumulative margin for border overlap */
    &:not([data-vertical]) {
      > *:not(:first-child) {
        margin-left: calc(var(--border-width) * -1);
      }
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

    /* Vertical: Cumulative margin for border overlap */
    &[data-vertical] {
      > *:not(:first-child) {
        margin-top: calc(var(--border-width) * -1);
      }
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
      {...props}
      style={{
        "--border-width": borderWidthCssValue,
        ...props.style,
      }}
    >
      {children}
    </Box>
  );
};
