/**
 * Merges a component's base className with className received from props.
 * 
 * ```jsx
 * const MyButton = ({ className, children }) => (
 *   <button className={mergeClassNameWithProps("btn", className)}>
 *     {children}
 *   </button>
 * );
 * 
 * // Usage:
 * <MyButton className="primary large" /> // Results in "btn primary large"
 * <MyButton /> // Results in "btn"
 * ```
 * 
 * @param {string} baseClassName - The component's base CSS class name
 * @param {string} [classNameFromProps] - Additional className from props (optional)
 * @returns {string} The merged className string
 */
export const mergeClassNameWithProps = (baseClassName, classNameFromProps) => {
  // Fast path: if no additional className, return base only
  if (!classNameFromProps) {
    return baseClassName;
  }

  // Trim and normalize whitespace from the props className
  const trimmedPropsClassName = classNameFromProps.trim();
  
  // If props className is empty after trimming, return base only
  if (!trimmedPropsClassName) {
    return baseClassName;
  }

  // Normalize multiple spaces to single spaces and combine
  const normalizedPropsClassName = trimmedPropsClassName.replace(/\s+/g, ' ');
  
  return `${baseClassName} ${normalizedPropsClassName}`;
};
