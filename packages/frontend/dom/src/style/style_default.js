const registeredComponents = new Set();

/**
 * Gets the default browser styles for an HTML element by creating an isolated custom element
 * @param {string} elementString - HTML element string (e.g., '<input type="text" />')
 * @returns {CSSStyleDeclaration} Computed styles of the unstyled element
 */
export const getDefaultStyles = (elementString) => {
  // Extract tag name and type attribute using simple regex
  const tagMatch = elementString.match(/<(\w+)(?:\s|>)/);
  if (!tagMatch) {
    throw new Error(`Invalid element string: ${elementString}`);
  }

  const tagName = tagMatch[1].toLowerCase();

  // Extract type attribute if present
  const typeMatch = elementString.match(/type\s*=\s*["']([^"']+)["']/);
  const type = typeMatch ? typeMatch[1] : null;

  // Generate component name
  const componentName = type
    ? `navi-unstyled-${tagName}-${type}`
    : `navi-unstyled-${tagName}`;

  // Register custom element if not already registered
  if (!registeredComponents.has(componentName)) {
    class UnstyledElement extends HTMLElement {
      constructor() {
        super();

        // Create shadow DOM to isolate from external CSS
        const shadow = this.attachShadow({ mode: "closed" });

        // Create the actual element we want to measure
        const actualElement = document.createElement(tagName);
        if (type) {
          actualElement.type = type;
        }

        // Copy any other attributes from the original element string
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = elementString;
        const tempElement = tempDiv.firstElementChild;

        if (tempElement) {
          for (const attr of tempElement.attributes) {
            if (attr.name !== "type") {
              // type already handled
              actualElement.setAttribute(attr.name, attr.value);
            }
          }
        }

        // Add minimal reset styles to ensure we get true defaults
        const style = document.createElement("style");
        style.textContent = `
          :host {
            all: initial;
            display: block;
          }
          ${tagName} {
            all: revert;
          }
        `;

        shadow.appendChild(style);
        shadow.appendChild(actualElement);

        // Store reference to the actual element for style computation
        this._actualElement = actualElement;
      }

      getActualElement() {
        return this._actualElement;
      }
    }

    customElements.define(componentName, UnstyledElement);
    registeredComponents.add(componentName);
  }

  // Create instance and append to DOM temporarily
  const customElement = document.createElement(componentName);

  // Add to DOM (required for getComputedStyle to work)
  document.body.appendChild(customElement);

  try {
    // Get computed styles of the actual element inside the shadow DOM
    const actualElement = customElement.getActualElement();
    const computedStyles = getComputedStyle(actualElement);

    // Create a copy of the styles since the original will be invalidated when element is removed
    const stylesCopy = {};
    for (let i = 0; i < computedStyles.length; i++) {
      const property = computedStyles[i];
      stylesCopy[property] = computedStyles.getPropertyValue(property);
    }

    return stylesCopy;
  } finally {
    // Clean up - remove the element from DOM
    document.body.removeChild(customElement);
  }
};
