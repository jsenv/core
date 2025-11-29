/**
 * Merges a component's base className with className received from props.
 *
 * ```jsx
 * const MyButton = ({ className, children }) => (
 *   <button className={withPropsClassName("btn", className)}>
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
export const withPropsClassName = (baseClassName, classNameFromProps) => {
  if (!classNameFromProps) {
    return baseClassName;
  }

  // Trim and normalize whitespace from the props className
  const trimmedPropsClassName = classNameFromProps.trim();
  if (!trimmedPropsClassName) {
    return baseClassName;
  }

  // Normalize multiple spaces to single spaces and combine
  const normalizedPropsClassName = trimmedPropsClassName.replace(/\s+/g, " ");
  if (!baseClassName) {
    return normalizedPropsClassName;
  }
  return `${baseClassName} ${normalizedPropsClassName}`;
};
