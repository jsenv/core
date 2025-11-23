import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_caption {
      --color: #59636e;
    }
  }

  .navi_caption {
    color: var(--color);
  }
`;

const CaptionStyleCSSVars = {
  color: "--color",
};

export const Caption = ({ children }) => {
  return (
    <Text size="sm" className="navi_caption" styleCSSVars={CaptionStyleCSSVars}>
      {children}
    </Text>
  );
};
