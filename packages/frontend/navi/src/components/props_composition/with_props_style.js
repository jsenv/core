/**
 * Merges a component's base style with style received from props.
 *
 * ```jsx
 * const MyButton = ({ style, children }) => (
 *   <button style={withPropsStyle({ padding: '10px' }, style)}>
 *     {children}
 *   </button>
 * );
 *
 * // Usage:
 * <MyButton style={{ color: 'red', fontSize: '14px' }} />
 * <MyButton style="color: blue; margin: 5px;" />
 * <MyButton /> // Just base styles
 * ```
 *
 * @param {string|object} baseStyle - The component's base style (string or object)
 * @param {string|object} [styleFromProps] - Additional style from props (optional)
 * @returns {object} The merged style object
 */
export const withPropsStyle = (baseStyle, styleFromProps) => {
  if (!styleFromProps) {
    return baseStyle;
  }
  if (!baseStyle) {
    return styleFromProps;
  }

  // Parse base style to object if it's a string
  const parsedBaseStyle =
    typeof baseStyle === "string"
      ? parseStyleString(baseStyle)
      : baseStyle || {};
  // Parse props style to object if it's a string
  const parsedPropsStyle =
    typeof styleFromProps === "string"
      ? parseStyleString(styleFromProps)
      : styleFromProps;
  // Merge styles with props taking priority
  return { ...parsedBaseStyle, ...parsedPropsStyle };
};

/**
 * Parses a CSS style string into a style object.
 * Handles CSS properties with proper camelCase conversion.
 *
 * @param {string} styleString - CSS style string like "color: red; font-size: 14px;"
 * @returns {object} Style object with camelCase properties
 */
const parseStyleString = (styleString) => {
  const style = {};

  if (!styleString || typeof styleString !== "string") {
    return style;
  }

  // Split by semicolon and process each declaration
  const declarations = styleString.split(";");

  for (let declaration of declarations) {
    declaration = declaration.trim();
    if (!declaration) continue;

    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;

    const property = declaration.slice(0, colonIndex).trim();
    const value = declaration.slice(colonIndex + 1).trim();

    if (property && value) {
      // Convert kebab-case to camelCase (e.g., "font-size" -> "fontSize")
      const camelCaseProperty = property.replace(/-([a-z])/g, (match, letter) =>
        letter.toUpperCase(),
      );

      style[camelCaseProperty] = value;
    }
  }

  return style;
};
