import { withPropsClassName } from "../with_props_class_name.js";
import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_caption {
      --color: #6b7280;
    }

    @media (prefers-color-scheme: dark) {
      .navi_caption {
        --color: rgb(102, 102, 102);
      }
    }
  }

  .navi_caption {
    color: var(--color);
  }
`;

const CaptionStyleCSSVars = {
  color: "--color",
};

export const Caption = ({ className, ...rest }) => {
  return (
    <Text
      as="p"
      size="xs"
      marginTop="sm"
      marginBottom="sm"
      className={withPropsClassName("navi_caption", className)}
      {...rest}
      styleCSSVars={CaptionStyleCSSVars}
    />
  );
};
