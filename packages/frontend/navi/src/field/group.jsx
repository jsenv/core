import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  .navi_group {
    /* First child: no bottom border radius */
    > *:first-child:not(:only-child) {
      border-top-right-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
    }

    /* Last child: no top border radius */
    > *:last-child:not(:only-child) {
      border-top-left-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
    }

    /* Middle children: no border radius */
    > *:not(:first-child):not(:last-child) {
      border-right: none !important;
      border-left: none !important;
      border-radius: 0 !important;
    }

    &[data-vertical] {
      /* TODO: vertical stuff */
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
