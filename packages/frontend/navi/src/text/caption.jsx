import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_caption {
      --color: #6b7280;
    }

    @media (prefers-color-scheme: dark) {
      .navi_caption {
        --color: rgb(129, 134, 140);
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
      as="small"
      size="0.8em" // We use em to be relative to the parent (we want to be smaller than the surrounding text)
      className={withPropsClassName("navi_caption", className)}
      {...rest}
      styleCSSVars={CaptionStyleCSSVars}
    />
  );
};
