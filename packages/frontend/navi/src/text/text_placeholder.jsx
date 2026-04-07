import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  .navi_text_placeholder {
    display: inline-block;
    width: 100%;
    height: 1em;
    background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
    background-size: 200% 100%;
    border-radius: 4px;

    &[data-loading] {
      animation: shimmer 1.2s infinite;
    }
  }
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

export const TextPlaceholder = ({ loading, ...props }) => {
  return (
    <Box
      {...props}
      baseClassName="navi_text_placeholder"
      data-loading={loading ? "" : undefined}
    />
  );
};
