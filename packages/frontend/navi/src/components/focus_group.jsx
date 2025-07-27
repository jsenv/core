/**
 * 
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://github.com/openui/open-ui/issues/990
 */

export const FocusGroup = ({
  direction = "vertical",
  extend = true, // whether to extend focus group to any ancestor focus group (not implemented yet)
  children,
}) => {
  return <div className="navi_focus_group">{children}</div>;
};
