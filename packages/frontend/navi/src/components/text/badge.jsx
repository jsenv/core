import { Box } from "../layout/box.jsx";

import.meta.css = /* css */ `
  .navi_count {
    position: relative;
    top: -1px;
    color: rgba(28, 43, 52, 0.4);
  }
`;

export const Count = ({ children, ...rest }) => {
  return (
    <Box as="span" baseClassName=".navi_count" {...rest}>
      ({children})
    </Box>
  );
};
