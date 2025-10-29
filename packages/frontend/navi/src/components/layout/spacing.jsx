import { withPropsStyle } from "../props_composition/with_props_style.js";
import { useLayoutStyle } from "./use_layout_style.js";

export const Spacing = ({ style, children, ...rest }) => {
  const { padding, margin } = useLayoutStyle(rest);
  return (
    <div
      {...rest}
      style={withPropsStyle(
        {
          ...margin,
          ...padding,
        },
        style,
      )}
    >
      {children}
    </div>
  );
};
