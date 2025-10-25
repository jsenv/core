import { normalizeStyle } from "./style_parsing.js";

// Register the style isolator custom element once
let persistentStyleIsolator = null;
const getNaviStyleIsolator = () => {
  if (persistentStyleIsolator) {
    return persistentStyleIsolator;
  }

  class StyleIsolator extends HTMLElement {
    constructor() {
      super();

      // Create shadow DOM to isolate from external CSS
      const shadow = this.attachShadow({ mode: "closed" });

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
          * {
            all: revert;
          }
        </style>
        <div id="unstyled_element_slot"></div>
      `;

      this.unstyledElementSlot = shadow.querySelector("#unstyled_element_slot");
    }

    getIsolatedStyles(element, context = "js") {
      this.unstyledElementSlot.innerHTML = "";
      const unstyledElement = element.cloneNode(true);
      this.unstyledElementSlot.appendChild(unstyledElement);

      // Get computed styles of the actual element inside the shadow DOM
      const computedStyles = getComputedStyle(unstyledElement);
      // Create a copy of the styles since the original will be invalidated when element is removed
      const stylesCopy = {};
      for (let i = 0; i < computedStyles.length; i++) {
        const property = computedStyles[i];
        stylesCopy[property] = normalizeStyle(
          computedStyles.getPropertyValue(property),
          property,
          context,
        );
      }

      return stylesCopy;
    }
  }

  customElements.define("navi-style-isolator", StyleIsolator);

  // Create and add the persistent element to the document
  persistentStyleIsolator = document.createElement("navi-style-isolator");
  document.body.appendChild(persistentStyleIsolator);
  return persistentStyleIsolator;
};

const stylesCache = new Map();
/**
 * Gets the default browser styles for an HTML element by creating an isolated custom element
 * @param {string|Element} input - CSS selector (e.g., 'input[type="text"]'), HTML source (e.g., '<button>'), or DOM element
 * @param {string} context - Output format: "js" for JS object (default) or "css" for CSS string
 * @returns {Object|string} Computed styles as JS object or CSS string
 */
export const getDefaultStyles = (input, context = "js") => {
  let element;
  let cacheKey;

  // Determine input type and create element accordingly
  if (typeof input === "string") {
    if (input[0] === "<") {
      // HTML source
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = input;
      element = tempDiv.firstElementChild;
      if (!element) {
        throw new Error(`Invalid HTML source: ${input}`);
      }
      cacheKey = `${input}:${context}`;
    } else {
      // CSS selector
      element = createElementFromSelector(input);
      cacheKey = `${input}:${context}`;
    }
  } else if (input instanceof Element) {
    // DOM element
    element = input;
    cacheKey = `${input.outerHTML}:${context}`;
  } else {
    throw new Error(
      "Input must be a CSS selector, HTML source, or DOM element",
    );
  }

  // Check cache first
  if (stylesCache.has(cacheKey)) {
    return stylesCache.get(cacheKey);
  }

  // Get the persistent style isolator element
  const naviStyleIsolator = getNaviStyleIsolator();
  const defaultStyles = naviStyleIsolator.getIsolatedStyles(element, context);

  // Cache the result
  stylesCache.set(cacheKey, defaultStyles);

  return defaultStyles;
};

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
