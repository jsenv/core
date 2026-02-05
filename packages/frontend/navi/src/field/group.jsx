import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  .navi_group {
    /* Horizontal (default): First child loses right radius, last child loses left radius */
    &:not([data-vertical]) {
      > *:first-child:not(:only-child) {
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }

      > *:last-child:not(:only-child) {
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
      }

      > *:not(:first-child):not(:last-child) {
        border-right: none !important;
        border-left: none !important;
        border-radius: 0 !important;
      }
    }

    /* Vertical: First child loses bottom radius, last child loses top radius */
    &[data-vertical] {
      > *:first-child:not(:only-child) {
        border-bottom-right-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
      }

      > *:last-child:not(:only-child) {
        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;
      }

      > *:not(:first-child):not(:last-child) {
        border-top: none !important;
        border-bottom: none !important;
        border-radius: 0 !important;
      }
    }
  }
`;

export const Group = ({ children, row, vertical = row, ...props }) => {
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
