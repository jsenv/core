import "./size/resize.js";

export { elementIsVisible } from "./element_is_visible.js";
export {
  addActiveElementEffect,
  useActiveElement,
} from "./focus/active_element.js";
export { elementIsFocusable } from "./focus/element_is_focusable.js";
export { trapFocusInside } from "./focus/focus_trap.js";
export {
  getAncestorScrolls,
  getScrollableParentSet,
  trapScrollInside,
} from "./scroll.js";

// size
export { getAvailableHeight } from "./size/get_available_height.js";
export { getAvailableWidth } from "./size/get_available_width.js";
export { getBorderSizes } from "./size/get_border_sizes.js";
export { getHeight } from "./size/get_height.js";
export { getMarginSizes } from "./size/get_margin_sizes.js";
export { getMaxHeight } from "./size/get_max_height.js";
export { getMaxWidth } from "./size/get_max_width.js";
export { getMinHeight } from "./size/get_min_height.js";
export { getMinWidth } from "./size/get_min_width.js";
export { getPaddingSizes } from "./size/get_padding_sizes.js";
export { getWidth } from "./size/get_width.js";
// size hooks
export { useAvailableHeight } from "./size/hooks/use_available_height.js";
export { useAvailableWidth } from "./size/hooks/use_available_width.js";
export { useMaxHeight } from "./size/hooks/use_max_height.js";
export { useMaxWidth } from "./size/hooks/use_max_width.js";
export { useResizeStatus } from "./size/hooks/use_resize_status.js";

export { getStyle, setAttributes, setStyles } from "./style_and_attributes.js";
export { findFirstDescendant } from "./traversal.js";
