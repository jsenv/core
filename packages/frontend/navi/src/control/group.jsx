import { Box } from "@jsenv/navi/src/box/box.jsx";

const css = /* css */ `
  .navi_group {
    --group-border-width: var(--navi-control-border-width);

    /* Squaring the joined corners is said on the direct child alone: a navi
       control declares the radius of its frame on its own root, and whatever
       inner element actually draws the frame inherits it. .navi_button_content
       is the exception — a button's frame sits on it and a button can arrive
       wrapped (a tooltip, a link), so it is named on its own. */

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
        margin-left: calc(var(--border-width, var(--group-border-width)) * -1);
      }
      > *:first-child:not(:only-child) {
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;

        .navi_button_content {
          border-top-right-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }
      }

      > *:last-child:not(:only-child) {
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;

        .navi_button_content {
          border-top-left-radius: 0 !important;
          border-bottom-left-radius: 0 !important;
        }
      }

      > *:not(:first-child):not(:last-child) {
        border-radius: 0 !important;

        .navi_button_content {
          border-radius: 0 !important;
        }
      }
    }

    /* Vertical: Cumulative margin for border overlap */
    &[data-vertical] {
      > *:not(:first-child) {
        margin-top: calc(var(--border-width, var(--group-border-width)) * -1);
      }
      > *:first-child:not(:only-child) {
        border-bottom-right-radius: 0 !important;
        border-bottom-left-radius: 0 !important;

        .navi_button_content {
          border-bottom-right-radius: 0 !important;
          border-bottom-left-radius: 0 !important;
        }
      }

      > *:last-child:not(:only-child) {
        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;

        .navi_button_content {
          border-top-left-radius: 0 !important;
          border-top-right-radius: 0 !important;
        }
      }

      > *:not(:first-child):not(:last-child) {
        border-radius: 0 !important;

        .navi_button_content {
          border-radius: 0 !important;
        }
      }
    }
  }
`;

export const Group = ({ children, row, vertical = row, ...props }) => {
  import.meta.css = css;

  return (
    <Box
      baseClassName="navi_group"
      data-vertical={vertical ? "" : undefined}
      row={row}
      {...props}
    >
      {children}
    </Box>
  );
};
