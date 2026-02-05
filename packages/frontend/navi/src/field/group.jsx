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

      > *:nth-child(2) {
        left: calc(var(--border-width) * -1);
      }
      > *:nth-child(3) {
        left: calc(var(--border-width) * -2);
      }
      > *:nth-child(4) {
        left: calc(var(--border-width) * -3);
      }
      > *:nth-child(5) {
        left: calc(var(--border-width) * -4);
      }
      > *:nth-child(6) {
        left: calc(var(--border-width) * -5);
      }
      > *:nth-child(7) {
        left: calc(var(--border-width) * -6);
      }
      > *:nth-child(8) {
        left: calc(var(--border-width) * -7);
      }
      > *:nth-child(9) {
        left: calc(var(--border-width) * -8);
      }
      > *:nth-child(10) {
        left: calc(var(--border-width) * -9);
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

      > *:nth-child(2) {
        top: calc(var(--border-width) * -1);
      }
      > *:nth-child(3) {
        top: calc(var(--border-width) * -2);
      }
      > *:nth-child(4) {
        top: calc(var(--border-width) * -3);
      }
      > *:nth-child(5) {
        top: calc(var(--border-width) * -4);
      }
      > *:nth-child(6) {
        top: calc(var(--border-width) * -5);
      }
      > *:nth-child(7) {
        top: calc(var(--border-width) * -6);
      }
      > *:nth-child(8) {
        top: calc(var(--border-width) * -7);
      }
      > *:nth-child(9) {
        top: calc(var(--border-width) * -8);
      }
      > *:nth-child(10) {
        top: calc(var(--border-width) * -9);
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
      style={{
        "--border-width": borderWidthCssValue,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};
