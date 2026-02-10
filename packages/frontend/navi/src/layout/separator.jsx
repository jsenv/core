import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_separator {
      --size: 1px;
      --color: #e4e4e7;
      --spacing: 0.5em;
      --spacing-start: 0.5em;
      --spacing-end: 0.5em;
    }
  }

  .navi_separator {
    width: 100%;
    height: var(--size);
    margin-top: var(--spacing-start, var(--spacing));
    margin-bottom: var(--spacing-end, var(--spacing));
    flex-shrink: 0;
    background: var(--color);
    border: none;

    &[data-vertical] {
      display: inline-block;

      width: var(--size);
      height: 1lh;
      margin-top: 0;
      margin-right: var(--spacing-end, var(--spacing));
      margin-bottom: 0;
      margin-left: var(--spacing-start, var(--spacing));
      vertical-align: bottom;
    }
  }
`;

const SeparatorStyleCSSVars = {
  color: "--color",
};
export const Separator = ({ vertical, ...props }) => {
  return (
    <Box
      as={vertical ? "span" : "hr"}
      {...props}
      data-vertical={vertical ? "" : undefined}
      baseClassName="navi_separator"
      styleCSSVars={SeparatorStyleCSSVars}
    />
  );
};
