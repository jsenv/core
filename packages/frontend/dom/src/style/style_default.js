import { normalizeStyle } from "./style_parsing.js";

const stylesCache = new Map();

/**
 * Creates an HTML element from a CSS selector
 * @param {string} selector - CSS selector (e.g., 'input[type="text"]', 'button', 'a[href="#"]')
 * @returns {Element} DOM element
 */
const createElementFromSelector = (selector) => {
  // Parse the selector to extract tag name and attributes
  const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!tagMatch) {
    throw new Error(`Invalid selector: ${selector}`);
  }

  const tagName = tagMatch[1].toLowerCase();
  const element = document.createElement(tagName);

  // Extract and apply attributes from selector
  const attributeRegex = /\[([^=\]]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
  let attributeMatch;

  while ((attributeMatch = attributeRegex.exec(selector)) !== null) {
    const attrName = attributeMatch[1];
    const attrValue =
      attributeMatch[2] || attributeMatch[3] || attributeMatch[4] || "";
    element.setAttribute(attrName, attrValue);
  }

  return element;
};

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
 * @param {string} selector - CSS selector (e.g., 'input[type="text"]', 'button', 'a[href]')
 * @returns {CSSStyleDeclaration} Computed styles of the unstyled element
 */
export const getDefaultStyles = (selector) => {
  // Check cache first
  if (stylesCache.has(selector)) {
    return stylesCache.get(selector);
  }

  // Parse selector to create element
  const element = createElementFromSelector(selector);
  const tagName = element.tagName.toLowerCase();
  const componentName = generateComponentName(element);
  let customElement = null;
  // Create custom element class that will handle this specific element
  class UnstyledElement extends HTMLElement {
    constructor() {
      super();

      // Create shadow DOM to isolate from external CSS
      const shadow = this.attachShadow({ mode: "closed" });

      // Create the actual element using innerHTML
      shadow.innerHTML = `
          <style>
            :host {
              all: initial;
              display: block;
              position: fixed;
              opacity: 0;
              visibility: hidden;
              pointer-events: none;
            }
            ${tagName} {
              all: revert;
            }
          </style>
        `;

      // Create and append the element
      const actualElement = element.cloneNode(true);
      shadow.appendChild(actualElement);
      customElement = actualElement;
    }
  }
  // Create instance
  customElements.define(componentName, UnstyledElement);
  const unstyledElement = new UnstyledElement();
  // Add to DOM (required for getComputedStyle to work)
  document.body.appendChild(unstyledElement);

  // Get computed styles of the actual element inside the shadow DOM
  const computedStyles = getComputedStyle(customElement);

  // Create a copy of the styles since the original will be invalidated when element is removed
  const stylesCopy = {};
  for (let i = 0; i < computedStyles.length; i++) {
    const property = computedStyles[i];
    stylesCopy[property] = normalizeStyle(
      computedStyles.getPropertyValue(property),
      property,
    );
  }

  unstyledElement.remove();

  // Cache the result
  stylesCache.set(selector, stylesCopy);

  return stylesCopy;
};
