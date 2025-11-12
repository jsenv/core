/**
 * Generates a unique signature for various types of elements that can be used for identification in logs.
 *
 * This function handles different types of elements and returns an appropriate identifier:
 * - For DOM elements: Creates a CSS selector using tag name, data-ui-name, ID, classes, or parent hierarchy
 * - For React/Preact elements (JSX): Returns JSX-like representation with type and props
 * - For functions: Returns function name and optional underlying element reference in brackets
 * - For null/undefined: Returns the string representation
 *
 * The returned signature for DOM elements is a valid CSS selector that can be copy-pasted
 * into browser dev tools to locate the element in the DOM.
 *
 * @param {HTMLElement|Object|Function|null|undefined} element - The element to generate a signature for
 * @returns {string} A unique identifier string in various formats depending on element type
 *
 * @example
 * // For DOM element with data-ui-name
 * // <div data-ui-name="header">
 * getElementSignature(element) // Returns: `div[data-ui-name="header"]`
 *
 * @example
 * // For DOM element with ID
 * // <div id="main" class="container active">
 * getElementSignature(element) // Returns: "div#main"
 *
 * @example
 * // For DOM element with classes only
 * // <button class="btn primary">
 * getElementSignature(element) // Returns: "button.btn.primary"
 *
 * @example
 * // For DOM element without distinguishing features (uses parent hierarchy)
 * // <p> inside <section id="content">
 * getElementSignature(element) // Returns: "section#content > p"
 *
 * @example
 * // For React/Preact element with props
 * // <MyComponent id="widget" />
 * getElementSignature(element) // Returns: `<MyComponent id="widget" />`
 *
 * @example
 * // For named function with underlying element reference
 * const MyComponent = () => {}; MyComponent.underlyingElementId = "div#main";
 * getElementSignature(MyComponent) // Returns: "[function MyComponent for div#main]"
 *
 * @example
 * // For anonymous function without underlying element
 * const anonymousFunc = () => {};
 * getElementSignature(anonymousFunc) // Returns: "[function]"
 *
 * @example
 * // For named function without underlying element
 * function namedHandler() {}
 * getElementSignature(namedHandler) // Returns: "[function namedHandler]"
 *
 * @example
 * // For null/undefined
 * getElementSignature(null) // Returns: "null"
 */
export const getElementSignature = (element) => {
  if (Array.isArray(element)) {
    if (element.length === 0) {
      return "empty";
    }
    if (element.length === 1) {
      return getElementSignature(element[0]);
    }
    const parent = element[0].parentNode;
    return `${getElementSignature(parent)} children`;
  }
  if (!element) {
    return String(element);
  }
  if (typeof element === "string") {
    return element === ""
      ? "empty string"
      : element.length > 10
        ? `${element.slice(0, 10)}...`
        : element;
  }
  if (typeof element === "function") {
    const functionName = element.name;
    const functionLabel = functionName
      ? `function ${functionName}`
      : "function";
    const underlyingElementId = element.underlyingElementId;
    if (underlyingElementId) {
      return `[${functionLabel} for ${underlyingElementId}]`;
    }
    return `[${functionLabel}]`;
  }
  if (element.nodeType === Node.TEXT_NODE) {
    return `#text(${getElementSignature(element.nodeValue)})`;
  }
  if (element.props) {
    const type = element.type;
    const id = element.props.id;
    if (id) {
      return `<${type} id="${id}" />`;
    }
    return `<${type} />`;
  }

  const tagName = element.tagName.toLowerCase();
  const dataUIName = element.getAttribute("data-ui-name");
  if (dataUIName) {
    return `${tagName}[data-ui-name="${dataUIName}"]`;
  }
  const elementId = element.id;
  if (elementId) {
    return `${tagName}#${elementId}`;
  }
  const className = element.className;
  if (className) {
    return `${tagName}.${className.split(" ").join(".")}`;
  }

  const parentSignature = getElementSignature(element.parentElement);
  return `${parentSignature} > ${tagName}`;
};
