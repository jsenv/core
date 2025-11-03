/**
 * Generates a unique signature for a DOM element that can be used for identification in logs.
 *
 * The returned signature is a valid CSS selector that combines the element's tag name,
 * ID (if present), and class names (if present). This makes it easy to copy-paste
 * the signature into browser dev tools to locate the element in the DOM.
 *
 * @param {HTMLElement} element - The DOM element to generate a signature for
 * @returns {string} A CSS selector string in the format "tagname#id.class1.class2"
 *
 * @example
 * // For <div id="main" class="container active">
 * getElementSignature(element) // Returns: "div#main.container.active"
 *
 * @example
 * // For <button class="btn primary">
 * getElementSignature(element) // Returns: "button.btn.primary"
 *
 * @example
 * // For <span id="label">
 * getElementSignature(element) // Returns: "span#label"
 *
 * @example
 * // For <p> (no id or classes)
 * getElementSignature(element) // Returns: "p"
 */
export const getElementSignature = (element) => {
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = element.className
    ? `.${element.className.split(" ").join(".")}`
    : "";
  return `${tagName}${id}${className}`;
};
