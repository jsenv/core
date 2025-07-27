export const FocusGroup = ({
  direction = "vertical",
  extend = true, // whether to extend focus group to any ancestor focus group (not implemented yet)
  children,
}) => {
  return <div className="navi_focus_group">{children}</div>;
};
