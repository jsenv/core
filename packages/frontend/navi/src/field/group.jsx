import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  .navi_group {
    /* First child: no bottom border radius */
    > *:first-child {
      border-bottom-right-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
    }

    /* Last child: no top border radius */
    > *:last-child {
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
    }

    /* Middle children: no border radius */
    > * {
      border-radius: 0 !important;
    }

    /* Single child: restore original border radius */
    > *:only-child {
      border-radius: revert !important;
    }
  }
`;

export const Group = ({ children, ...props }) => {
  return (
    <Box baseClassName="navi_group" {...props}>
      {children}
    </Box>
  );
};
