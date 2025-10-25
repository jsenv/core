const registeredComponents = new Set();
const stylesCache = new Map();

/**
 * Generates a component name from an element
 * @param {Element} element - DOM element to generate name for
 * @returns {string} Component name
 */
const generateComponentName = (element) => {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute("type");

  return type ? `navi-unstyled-${tagName}-${type}` : `navi-unstyled-${tagName}`;
};

/**
 * Gets the default browser styles for an HTML element by creating an isolated custom element
 * @param {string} elementString - HTML element string (e.g., '<input type="text" />')
 * @returns {CSSStyleDeclaration} Computed styles of the unstyled element
 */
export const getDefaultStyles = (elementString) => {
  // Check cache first
  if (stylesCache.has(elementString)) {
    return stylesCache.get(elementString);
  }

  // Parse element string first to get component name
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = elementString;
  const parsedElement = tempDiv.firstElementChild;

  if (!parsedElement) {
    throw new Error(`Invalid element string: ${elementString}`);
  }

  const componentName = generateComponentName(parsedElement);

  // Check if component is already registered
  if (!registeredComponents.has(componentName)) {
    // Create custom element class that will handle this specific element
    class UnstyledElement extends HTMLElement {
      constructor() {
        super();

        // Create shadow DOM to isolate from external CSS
        const shadow = this.attachShadow({ mode: "closed" });

        // Store reference to shadow root for external access
        this._shadowRoot = shadow; // Get tag name for styling
        const tagName = parsedElement.tagName.toLowerCase();

        // Create the actual element using innerHTML
        shadow.innerHTML = `
          <style>
            :host {
              all: initial;
              display: block;
            }
            ${tagName} {
              all: revert;
            }
          </style>
          ${elementString}
        `;
      }
    }

    customElements.define(componentName, UnstyledElement);
    registeredComponents.add(componentName);
  }

  // Create instance
  const unstyledElement = document.createElement(componentName);

  // Add to DOM (required for getComputedStyle to work)
  document.body.appendChild(unstyledElement);

  try {
    // Get computed styles of the actual element inside the shadow DOM
    const tagName = parsedElement.tagName.toLowerCase();
    const actualElement = unstyledElement._shadowRoot.querySelector(tagName);
    const computedStyles = getComputedStyle(actualElement);

    // Create a copy of the styles since the original will be invalidated when element is removed
    const stylesCopy = {};
    for (let i = 0; i < computedStyles.length; i++) {
      const property = computedStyles[i];
      stylesCopy[property] = computedStyles.getPropertyValue(property);
    }

    // Cache the result
    stylesCache.set(elementString, stylesCopy);

    return stylesCopy;
  } finally {
    unstyledElement.remove();
  }
};
