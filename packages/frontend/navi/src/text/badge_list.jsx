import { Box } from "../box/box.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";

const css = /* css */ `
  @layer navi {
  }
  .navi_badge_list {
    flex-wrap: wrap;
  }
`;

export const BadgeList = ({ children, className, ...props }) => {
  import.meta.css = css;

  return (
    <Box
      flex="x"
      alignY="center"
      spacing="xs"
      className={withPropsClassName("navi_badge_list", className)}
      {...props}
    >
      {children}
    </Box>
  );
};
