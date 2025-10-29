import { mergeStyles } from "@jsenv/dom";

/**
 * Merges a component's base style with style received from props.
 * Automatically normalizes style values (e.g., adds "px" units where needed).
 *
 * ```jsx
 * const MyButton = ({ style, children }) => (
 *   <button style={withPropsStyle({ padding: 10 }, style)}>
 *     {children}
 *   </button>
 * );
 *
 * // Usage:
 * <MyButton style={{ color: 'red', fontSize: 14 }} />
 * <MyButton style="color: blue; margin: 5px;" />
 * <MyButton /> // Just base styles
 * ```
 *
 * @param {string|object} baseStyle - The component's base style (string or object)
 * @param {string|object} [styleFromProps] - Additional style from props (optional)
 * @returns {object} The merged and normalized style object
 */
export const withPropsStyle = (baseStyle, styleFromProps) => {
  return mergeStyles(baseStyle, styleFromProps, "css");
};
