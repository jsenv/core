import { normalizeStyle } from "./style_parsing.js";

// Register the unstyled custom element once
let persistentUnstyledElement = null;
const getNaviUnstyledElement = () => {
  if (persistentUnstyledElement) {
    return persistentUnstyledElement;
  }

  class UnstyledElement extends HTMLElement {
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
      `;
    }

    setElement(element) {
      // Clear previous content and add new element
      const shadow = this.shadowRoot;
      const styleElement = shadow.querySelector("style");
      shadow.innerHTML = "";
      shadow.appendChild(styleElement);

      const clonedElement = element.cloneNode(true);
      shadow.appendChild(clonedElement);
      return clonedElement;
    }
  }

  customElements.define("navi-unstyled", UnstyledElement);

  // Create and add the persistent element to the document
  persistentUnstyledElement = document.createElement("navi-unstyled");
  document.body.appendChild(persistentUnstyledElement);
  return persistentUnstyledElement;
};

const stylesCache = new Map();
/**
 * Gets the default browser styles for an HTML element by creating an isolated custom element
 * @param {string|Element} input - CSS selector (e.g., 'input[type="text"]'), HTML source (e.g., '<button>'), or DOM element
 * @returns {CSSStyleDeclaration} Computed styles of the unstyled element
 */
export const getDefaultStyles = (input) => {
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
      cacheKey = input;
    } else {
      // CSS selector
      element = createElementFromSelector(input);
      cacheKey = input;
    }
  } else if (input instanceof Element) {
    // DOM element
    element = input;
    cacheKey = input.outerHTML;
  } else {
    throw new Error(
      "Input must be a CSS selector, HTML source, or DOM element",
    );
  }

  // Check cache first
  if (stylesCache.has(cacheKey)) {
    return stylesCache.get(cacheKey);
  }

  // Register the unstyled element if not already done
  const naviUnstyledElement = getNaviUnstyledElement();
  const elementShadow = naviUnstyledElement.setElement(element);

  // Get computed styles of the actual element inside the shadow DOM
  const computedStyles = getComputedStyle(elementShadow);
  // Create a copy of the styles since the original will be invalidated when element is removed
  const stylesCopy = {};
  for (let i = 0; i < computedStyles.length; i++) {
    const property = computedStyles[i];
    stylesCopy[property] = normalizeStyle(
      computedStyles.getPropertyValue(property),
      property,
    );
  }

  // Cache the result
  stylesCache.set(cacheKey, stylesCopy);

  return stylesCopy;
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
