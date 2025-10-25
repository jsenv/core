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

  // Parse element string using DOM
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = elementString;
  const parsedElement = tempDiv.firstElementChild;

  if (!parsedElement) {
    throw new Error(`Invalid element string: ${elementString}`);
  }

  // Create custom element class that will handle this specific element
  class UnstyledElement extends HTMLElement {
    constructor() {
      super();

      // Create shadow DOM to isolate from external CSS
      const shadow = this.attachShadow({ mode: "closed" });

      // Create the actual element we want to measure
      const tagName = parsedElement.tagName.toLowerCase();
      const actualElement = document.createElement(tagName);

      // Copy all attributes from the parsed element
      for (const attr of parsedElement.attributes) {
        actualElement.setAttribute(attr.name, attr.value);
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

  // Create instance to generate component name
  const unstyledElement = new UnstyledElement();
  const componentName = generateComponentName(parsedElement);

  // Register custom element if not already registered
  if (!registeredComponents.has(componentName)) {
    customElements.define(componentName, UnstyledElement);
    registeredComponents.add(componentName);
  }

  // Add to DOM (required for getComputedStyle to work)
  document.body.appendChild(unstyledElement);

  try {
    // Get computed styles of the actual element inside the shadow DOM
    const actualElement = unstyledElement.getActualElement();
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
    // Clean up - remove the element from DOM
    document.body.removeChild(unstyledElement);
  }
};
