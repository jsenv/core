import { withPropsClassName } from "../with_props_class_name.js";
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

export const Caption = ({ className, ...rest }) => {
  return (
    <Text
      size="xs"
      marginBottom="sm"
      className={withPropsClassName("navi_caption", className)}
      {...rest}
      styleCSSVars={CaptionStyleCSSVars}
    />
  );
};
