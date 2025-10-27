import { signal, effect, computed, batch, useSignal } from "@preact/signals";
import { useEffect, useRef, useCallback, useContext, useState, useLayoutEffect, useErrorBoundary, useImperativeHandle, useMemo, useId } from "preact/hooks";
import { createContext, createRef, toChildArray, cloneElement } from "preact";
import { jsxs, jsx, Fragment } from "preact/jsx-runtime";
import { forwardRef, createPortal } from "preact/compat";

/* eslint-disable */
// construct-style-sheets-polyfill@3.1.0
// to keep in sync with https://github.com/calebdwilliams/construct-style-sheets
// copy pasted into jsenv codebase to inject this code with more ease
(function () {

  if (typeof document === "undefined" || "adoptedStyleSheets" in document) {
    return;
  }

  var hasShadyCss = "ShadyCSS" in window && !ShadyCSS.nativeShadow;
  var bootstrapper = document.implementation.createHTMLDocument("");
  var closedShadowRootRegistry = new WeakMap();
  var _DOMException = typeof DOMException === "object" ? Error : DOMException;
  var defineProperty = Object.defineProperty;
  var forEach = Array.prototype.forEach;

  var importPattern = /@import.+?;?$/gm;
  function rejectImports(contents) {
    var _contents = contents.replace(importPattern, "");
    if (_contents !== contents) {
      console.warn(
        "@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418",
      );
    }
    return _contents.trim();
  }
  function isElementConnected(element) {
    return "isConnected" in element
      ? element.isConnected
      : document.contains(element);
  }
  function unique(arr) {
    return arr.filter(function (value, index) {
      return arr.indexOf(value) === index;
    });
  }
  function diff(arr1, arr2) {
    return arr1.filter(function (value) {
      return arr2.indexOf(value) === -1;
    });
  }
  function removeNode(node) {
    node.parentNode.removeChild(node);
  }
  function getShadowRoot(element) {
    return element.shadowRoot || closedShadowRootRegistry.get(element);
  }

  var cssStyleSheetMethods = [
    "addRule",
    "deleteRule",
    "insertRule",
    "removeRule",
  ];
  var NonConstructedStyleSheet = CSSStyleSheet;
  var nonConstructedProto = NonConstructedStyleSheet.prototype;
  nonConstructedProto.replace = function () {
    return Promise.reject(
      new _DOMException(
        "Can't call replace on non-constructed CSSStyleSheets.",
      ),
    );
  };
  nonConstructedProto.replaceSync = function () {
    throw new _DOMException(
      "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.",
    );
  };
  function isCSSStyleSheetInstance(instance) {
    return typeof instance === "object"
      ? proto$1.isPrototypeOf(instance) ||
          nonConstructedProto.isPrototypeOf(instance)
      : false;
  }
  function isNonConstructedStyleSheetInstance(instance) {
    return typeof instance === "object"
      ? nonConstructedProto.isPrototypeOf(instance)
      : false;
  }
  var $basicStyleElement = new WeakMap();
  var $locations = new WeakMap();
  var $adoptersByLocation = new WeakMap();
  var $appliedMethods = new WeakMap();
  function addAdopterLocation(sheet, location) {
    var adopter = document.createElement("style");
    $adoptersByLocation.get(sheet).set(location, adopter);
    $locations.get(sheet).push(location);
    return adopter;
  }
  function getAdopterByLocation(sheet, location) {
    return $adoptersByLocation.get(sheet).get(location);
  }
  function removeAdopterLocation(sheet, location) {
    $adoptersByLocation.get(sheet).delete(location);
    $locations.set(
      sheet,
      $locations.get(sheet).filter(function (_location) {
        return _location !== location;
      }),
    );
  }
  function restyleAdopter(sheet, adopter) {
    requestAnimationFrame(function () {
      adopter.textContent = $basicStyleElement.get(sheet).textContent;
      $appliedMethods.get(sheet).forEach(function (command) {
        return adopter.sheet[command.method].apply(adopter.sheet, command.args);
      });
    });
  }
  function checkInvocationCorrectness(self) {
    if (!$basicStyleElement.has(self)) {
      throw new TypeError("Illegal invocation");
    }
  }
  function ConstructedStyleSheet() {
    var self = this;
    var style = document.createElement("style");
    bootstrapper.body.appendChild(style);
    $basicStyleElement.set(self, style);
    $locations.set(self, []);
    $adoptersByLocation.set(self, new WeakMap());
    $appliedMethods.set(self, []);
  }
  var proto$1 = ConstructedStyleSheet.prototype;
  proto$1.replace = function replace(contents) {
    try {
      this.replaceSync(contents);
      return Promise.resolve(this);
    } catch (e) {
      return Promise.reject(e);
    }
  };
  proto$1.replaceSync = function replaceSync(contents) {
    checkInvocationCorrectness(this);
    if (typeof contents === "string") {
      var self_1 = this;
      $basicStyleElement.get(self_1).textContent = rejectImports(contents);
      $appliedMethods.set(self_1, []);
      $locations.get(self_1).forEach(function (location) {
        if (location.isConnected()) {
          restyleAdopter(self_1, getAdopterByLocation(self_1, location));
        }
      });
    }
  };
  defineProperty(proto$1, "cssRules", {
    configurable: true,
    enumerable: true,
    get: function cssRules() {
      checkInvocationCorrectness(this);
      return $basicStyleElement.get(this).sheet.cssRules;
    },
  });
  defineProperty(proto$1, "media", {
    configurable: true,
    enumerable: true,
    get: function media() {
      checkInvocationCorrectness(this);
      return $basicStyleElement.get(this).sheet.media;
    },
  });
  cssStyleSheetMethods.forEach(function (method) {
    proto$1[method] = function () {
      var self = this;
      checkInvocationCorrectness(self);
      var args = arguments;
      $appliedMethods.get(self).push({ method: method, args: args });
      $locations.get(self).forEach(function (location) {
        if (location.isConnected()) {
          var sheet = getAdopterByLocation(self, location).sheet;
          sheet[method].apply(sheet, args);
        }
      });
      var basicSheet = $basicStyleElement.get(self).sheet;
      return basicSheet[method].apply(basicSheet, args);
    };
  });
  defineProperty(ConstructedStyleSheet, Symbol.hasInstance, {
    configurable: true,
    value: isCSSStyleSheetInstance,
  });

  var defaultObserverOptions = {
    childList: true,
    subtree: true,
  };
  var locations = new WeakMap();
  function getAssociatedLocation(element) {
    var location = locations.get(element);
    if (!location) {
      location = new Location(element);
      locations.set(element, location);
    }
    return location;
  }
  function attachAdoptedStyleSheetProperty(constructor) {
    defineProperty(constructor.prototype, "adoptedStyleSheets", {
      configurable: true,
      enumerable: true,
      get: function () {
        return getAssociatedLocation(this).sheets;
      },
      set: function (sheets) {
        getAssociatedLocation(this).update(sheets);
      },
    });
  }
  function traverseWebComponents(node, callback) {
    var iter = document.createNodeIterator(
      node,
      NodeFilter.SHOW_ELEMENT,
      function (foundNode) {
        return getShadowRoot(foundNode)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
      null,
      false,
    );
    for (var next = void 0; (next = iter.nextNode()); ) {
      callback(getShadowRoot(next));
    }
  }
  var $element = new WeakMap();
  var $uniqueSheets = new WeakMap();
  var $observer = new WeakMap();
  function isExistingAdopter(self, element) {
    return (
      element instanceof HTMLStyleElement &&
      $uniqueSheets.get(self).some(function (sheet) {
        return getAdopterByLocation(sheet, self);
      })
    );
  }
  function getAdopterContainer(self) {
    var element = $element.get(self);
    return element instanceof Document ? element.body : element;
  }
  function adopt(self) {
    var styleList = document.createDocumentFragment();
    var sheets = $uniqueSheets.get(self);
    var observer = $observer.get(self);
    var container = getAdopterContainer(self);
    observer.disconnect();
    sheets.forEach(function (sheet) {
      styleList.appendChild(
        getAdopterByLocation(sheet, self) || addAdopterLocation(sheet, self),
      );
    });
    container.insertBefore(styleList, null);
    observer.observe(container, defaultObserverOptions);
    sheets.forEach(function (sheet) {
      restyleAdopter(sheet, getAdopterByLocation(sheet, self));
    });
  }
  function Location(element) {
    var self = this;
    self.sheets = [];
    $element.set(self, element);
    $uniqueSheets.set(self, []);
    $observer.set(
      self,
      new MutationObserver(function (mutations, observer) {
        if (!document) {
          observer.disconnect();
          return;
        }
        mutations.forEach(function (mutation) {
          if (!hasShadyCss) {
            forEach.call(mutation.addedNodes, function (node) {
              if (!(node instanceof Element)) {
                return;
              }
              traverseWebComponents(node, function (root) {
                getAssociatedLocation(root).connect();
              });
            });
          }
          forEach.call(mutation.removedNodes, function (node) {
            if (!(node instanceof Element)) {
              return;
            }
            if (isExistingAdopter(self, node)) {
              adopt(self);
            }
            if (!hasShadyCss) {
              traverseWebComponents(node, function (root) {
                getAssociatedLocation(root).disconnect();
              });
            }
          });
        });
      }),
    );
  }
  Location.prototype = {
    isConnected: function () {
      var element = $element.get(this);
      return element instanceof Document
        ? element.readyState !== "loading"
        : isElementConnected(element.host);
    },
    connect: function () {
      var container = getAdopterContainer(this);
      $observer.get(this).observe(container, defaultObserverOptions);
      if ($uniqueSheets.get(this).length > 0) {
        adopt(this);
      }
      traverseWebComponents(container, function (root) {
        getAssociatedLocation(root).connect();
      });
    },
    disconnect: function () {
      $observer.get(this).disconnect();
    },
    update: function (sheets) {
      var self = this;
      var locationType =
        $element.get(self) === document ? "Document" : "ShadowRoot";
      if (!Array.isArray(sheets)) {
        throw new TypeError(
          "Failed to set the 'adoptedStyleSheets' property on " +
            locationType +
            ": Iterator getter is not callable.",
        );
      }
      if (!sheets.every(isCSSStyleSheetInstance)) {
        throw new TypeError(
          "Failed to set the 'adoptedStyleSheets' property on " +
            locationType +
            ": Failed to convert value to 'CSSStyleSheet'",
        );
      }
      if (sheets.some(isNonConstructedStyleSheetInstance)) {
        throw new TypeError(
          "Failed to set the 'adoptedStyleSheets' property on " +
            locationType +
            ": Can't adopt non-constructed stylesheets",
        );
      }
      self.sheets = sheets;
      var oldUniqueSheets = $uniqueSheets.get(self);
      var uniqueSheets = unique(sheets);
      var removedSheets = diff(oldUniqueSheets, uniqueSheets);
      removedSheets.forEach(function (sheet) {
        removeNode(getAdopterByLocation(sheet, self));
        removeAdopterLocation(sheet, self);
      });
      $uniqueSheets.set(self, uniqueSheets);
      if (self.isConnected() && uniqueSheets.length > 0) {
        adopt(self);
      }
    },
  };

  window.CSSStyleSheet = ConstructedStyleSheet;
  attachAdoptedStyleSheetProperty(Document);
  if ("ShadowRoot" in window) {
    attachAdoptedStyleSheetProperty(ShadowRoot);
    var proto = Element.prototype;
    var attach_1 = proto.attachShadow;
    proto.attachShadow = function attachShadow(init) {
      var root = attach_1.call(this, init);
      if (init.mode === "closed") {
        closedShadowRootRegistry.set(this, root);
      }
      return root;
    };
  }
  var documentLocation = getAssociatedLocation(document);
  if (documentLocation.isConnected()) {
    documentLocation.connect();
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      documentLocation.connect.bind(documentLocation),
    );
  }
})();

const installImportMetaCss = importMeta => {
  const stylesheet = new CSSStyleSheet({
    baseUrl: importMeta.url
  });
  let called = false;
  // eslint-disable-next-line accessor-pairs
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    set(value) {
      if (called) {
        throw new Error("import.meta.css setter can only be called once");
      }
      called = true;
      stylesheet.replaceSync(value);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
    }
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-background-color-readonly: #d3d3d3;
      --navi-color-readonly: grey;
      --navi-background-color-disabled: #d3d3d3;
      --navi-color-disabled: #eeeeee;

      --navi-info-color: #2196f3;
      --navi-warning-color: #ff9800;
      --navi-error-color: #f44336;
    }
  }
`;

const createIterableWeakSet = () => {
  const objectWeakRefSet = new Set();

  return {
    add: (object) => {
      const objectWeakRef = new WeakRef(object);
      objectWeakRefSet.add(objectWeakRef);
    },

    delete: (object) => {
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() === object) {
          objectWeakRefSet.delete(weakRef);
          return true;
        }
      }
      return false;
    },

    *[Symbol.iterator]() {
      for (const objectWeakRef of objectWeakRefSet) {
        const object = objectWeakRef.deref();
        if (object === undefined) {
          objectWeakRefSet.delete(objectWeakRef);
          continue;
        }
        yield object;
      }
    },

    has: (object) => {
      for (const weakRef of objectWeakRefSet) {
        const objectCandidate = weakRef.deref();
        if (objectCandidate === undefined) {
          objectWeakRefSet.delete(weakRef);
          continue;
        }
        if (objectCandidate === object) {
          return true;
        }
      }
      return false;
    },

    clear: () => {
      objectWeakRefSet.clear();
    },

    get size() {
      return objectWeakRefSet.size;
    },

    getStats: () => {
      let alive = 0;
      let dead = 0;
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() !== undefined) {
          alive++;
        } else {
          dead++;
        }
      }
      return { total: objectWeakRefSet.size, alive, dead };
    },
  };
};

const createPubSub = (clearOnPublish = false) => {
  const callbackSet = new Set();

  const publish = (...args) => {
    const results = [];
    for (const callback of callbackSet) {
      const result = callback(...args);
      results.push(result);
    }
    if (clearOnPublish) {
      callbackSet.clear();
    }
    return results;
  };

  const subscribe = (callback) => {
    if (typeof callback !== "function") {
      throw new TypeError("callback must be a function");
    }
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  const clear = () => {
    callbackSet.clear();
  };

  return [publish, subscribe, clear];
};

const createValueEffect = (value) => {
  const callbackSet = new Set();
  const previousValueCleanupSet = new Set();

  const updateValue = (newValue) => {
    if (newValue === value) {
      return;
    }
    for (const cleanup of previousValueCleanupSet) {
      cleanup();
    }
    previousValueCleanupSet.clear();
    const oldValue = value;
    value = newValue;
    for (const callback of callbackSet) {
      const returnValue = callback(newValue, oldValue);
      if (typeof returnValue === "function") {
        previousValueCleanupSet.add(returnValue);
      }
    }
  };

  const addEffect = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  return [updateValue, addEffect];
};

// https://github.com/davidtheclark/tabbable/blob/master/index.js
const isDocumentElement = (node) =>
  node === node.ownerDocument.documentElement;

/**
 * elementToOwnerWindow returns the window owning the element.
 * Usually an element window will just be window.
 * But when an element is inside an iframe, the window of that element
 * is iframe.contentWindow
 * It's often important to work with the correct window because
 * element are scoped per iframes.
 */
const elementToOwnerWindow = (element) => {
  if (elementIsWindow(element)) {
    return element;
  }
  if (elementIsDocument(element)) {
    return element.defaultView;
  }
  return elementToOwnerDocument(element).defaultView;
};
/**
 * elementToOwnerDocument returns the document containing the element.
 * Usually an element document is window.document.
 * But when an element is inside an iframe, the document of that element
 * is iframe.contentWindow.document
 * It's often important to work with the correct document because
 * element are scoped per iframes.
 */
const elementToOwnerDocument = (element) => {
  if (elementIsWindow(element)) {
    return element.document;
  }
  if (elementIsDocument(element)) {
    return element;
  }
  return element.ownerDocument;
};

const elementIsWindow = (a) => a.window === a;
const elementIsDocument = (a) => a.nodeType === 9;
const elementIsDetails = ({ nodeName }) => nodeName === "DETAILS";
const elementIsSummary = ({ nodeName }) => nodeName === "SUMMARY";

// should be used ONLY when an element is related to other elements that are not descendants of this element
const getAssociatedElements = (element) => {
  if (element.tagName === "COL") {
    const columnCells = [];
    const colgroup = element.parentNode;
    const columnIndex = Array.from(colgroup.children).indexOf(element);
    const table = element.closest("table");
    const rows = table.querySelectorAll("tr");
    for (const row of rows) {
      const rowCells = row.children;
      for (const rowCell of rowCells) {
        if (rowCell.cellIndex === columnIndex) {
          columnCells.push(rowCell);
        }
      }
    }
    return columnCells;
  }
  // if (element.tagName === "TR") {
  //   const rowCells = Array.from(element.children);
  //   return rowCells;
  // }
  return null;
};

const getComputedStyle$1 = (element) =>
  elementToOwnerWindow(element).getComputedStyle(element);

const getStyle = (element, name) =>
  getComputedStyle$1(element).getPropertyValue(name);
const setStyle = (element, name, value) => {

  const prevValue = element.style[name];
  if (prevValue) {
    element.style.setProperty(name, value);
    return () => {
      element.style.setProperty(name, prevValue);
    };
  }
  element.style.setProperty(name, value);
  return () => {
    element.style.removeProperty(name);
  };
};

const addWillChange = (element, property) => {
  const currentWillChange = element.style.willChange;
  const willChangeValues = currentWillChange
    ? currentWillChange
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  if (willChangeValues.includes(property)) {
    // Property already exists, return no-op
    return () => {};
  }

  willChangeValues.push(property);
  element.style.willChange = willChangeValues.join(", ");
  // Return function to remove only this property
  return () => {
    const newValues = willChangeValues.filter((v) => v !== property);
    if (newValues.length === 0) {
      element.style.removeProperty("will-change");
    } else {
      element.style.willChange = newValues.join(", ");
    }
  };
};

const createSetMany$1 = (setter) => {
  return (element, description) => {
    const cleanupCallbackSet = new Set();
    for (const name of Object.keys(description)) {
      const value = description[name];
      const restoreStyle = setter(element, name, value);
      cleanupCallbackSet.add(restoreStyle);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
  };
};

const setStyles = createSetMany$1(setStyle);

// Properties that need px units
const pxProperties = [
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "border",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "translateX",
  "translateY",
  "translateZ",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
];

// Properties that need deg units
const degProperties = [
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY",
];

// Properties that should remain unitless
const unitlessProperties = [
  "opacity",
  "zIndex",
  "flexGrow",
  "flexShrink",
  "order",
  "columnCount",
  "scale",
  "scaleX",
  "scaleY",
  "scaleZ",
];

// Normalize a single style value
const normalizeStyle = (value, propertyName, context = "js") => {
  if (propertyName === "transform") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSTransform(value);
      }
      // If code does transform: { translateX: "10px" }
      // we want to store { translateX: 10 }
      const transformNormalized = {};
      for (const key of Object.keys(value)) {
        const partValue = normalizeStyle(value[key], key, "js");
        transformNormalized[key] = partValue;
      }
      return transformNormalized;
    }
    if (typeof value === "object" && value !== null) {
      // For CSS context, ensure transform is a string
      return stringifyCSSTransform(value);
    }
    return value;
  }

  // Handle transform.* properties (e.g., "transform.translateX")
  if (propertyName.startsWith("transform.")) {
    if (context === "css") {
      console.warn(
        `normalizeStyle: magic properties like "${propertyName}" are not applicable in "css" context. Returning original value.`,
      );
      return value;
    }
    const transformProperty = propertyName.slice(10); // Remove "transform." prefix
    // If value is a CSS transform string, parse it first to extract the specific property
    if (typeof value === "string") {
      if (value === "none") {
        return undefined;
      }
      const parsedTransform = parseCSSTransform(value);
      return parsedTransform?.[transformProperty];
    }
    // If value is a transform object, extract the property directly
    if (typeof value === "object" && value !== null) {
      return value[transformProperty];
    }
    // never supposed to happen, the value given is neither string nor object
    return undefined;
  }

  if (pxProperties.includes(propertyName)) {
    return normalizeNumber(value, context, "px", propertyName);
  }
  if (degProperties.includes(propertyName)) {
    return normalizeNumber(value, context, "deg", propertyName);
  }
  if (unitlessProperties.includes(propertyName)) {
    return normalizeNumber(value, context, "", propertyName);
  }

  return value;
};
const normalizeNumber = (value, context, unit, propertyName) => {
  if (context === "css") {
    if (typeof value === "number") {
      if (isNaN(value)) {
        console.warn(`NaN found for "${propertyName}"`);
      }
      return `${value}${unit}`;
    }
    return value;
  }
  if (typeof value === "string") {
    if (value === "auto") {
      return "auto";
    }
    if (value === "none") {
      return "none";
    }
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      console.warn(
        `"${propertyName}": ${value} cannot be converted to number, returning value as-is.`,
      );
      return value;
    }
    return numericValue;
  }
  return value;
};

// Normalize styles for DOM application
const normalizeStyles = (styles, context = "js") => {
  const normalized = {};
  for (const [key, value] of Object.entries(styles)) {
    normalized[key] = normalizeStyle(value, key, context);
  }
  return normalized;
};

// Convert transform object to CSS string
const stringifyCSSTransform = (transformObj) => {
  const transforms = [];
  for (const key of Object.keys(transformObj)) {
    const transformPartValue = transformObj[key];
    const normalizedTransformPartValue = normalizeStyle(
      transformPartValue,
      key,
      "css",
    );
    transforms.push(`${key}(${normalizedTransformPartValue})`);
  }
  return transforms.join(" ");
};

// Parse transform CSS string into object
const parseCSSTransform = (transformString) => {
  if (!transformString || transformString === "none") {
    return undefined;
  }

  const transformObj = {};

  // Parse transform functions
  const transformPattern = /(\w+)\(([^)]+)\)/g;
  let match;

  while ((match = transformPattern.exec(transformString)) !== null) {
    const [, functionName, value] = match;

    // Handle matrix functions specially
    if (functionName === "matrix" || functionName === "matrix3d") {
      const matrixComponents = parseMatrixTransform(match[0]);
      if (matrixComponents) {
        // Only add non-default values to preserve original information
        Object.assign(transformObj, matrixComponents);
      }
      // If matrix can't be parsed to simple components, skip it (keep complex transforms as-is)
      continue;
    }

    // Handle regular transform functions
    const normalizedValue = normalizeStyle(value.trim(), functionName, "js");
    if (normalizedValue !== undefined) {
      transformObj[functionName] = normalizedValue;
    }
  }

  // Return undefined if no properties were extracted (preserves original information)
  return Object.keys(transformObj).length > 0 ? transformObj : undefined;
};

// Parse a matrix transform and extract simple transform components when possible
const parseMatrixTransform = (matrixString) => {
  // Match matrix() or matrix3d() functions
  const matrixMatch = matrixString.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!matrixMatch) {
    return null;
  }

  const values = matrixMatch[1].split(",").map((v) => parseFloat(v.trim()));

  if (matrixString.includes("matrix3d")) {
    // matrix3d(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p)
    if (values.length !== 16) {
      return null;
    }
    const [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = values;
    // Check if it's a simple 2D transform (most common case)
    if (
      c === 0 &&
      d === 0 &&
      g === 0 &&
      h === 0 &&
      i === 0 &&
      j === 0 &&
      k === 1 &&
      l === 0 &&
      o === 0 &&
      p === 1
    ) {
      // This is essentially a 2D transform
      return parseSimple2DMatrix(a, b, e, f, m, n);
    }
    return null; // Complex 3D transform
  }
  // matrix(a, b, c, d, e, f)
  if (values.length !== 6) {
    return null;
  }
  const [a, b, c, d, e, f] = values;
  return parseSimple2DMatrix(a, b, c, d, e, f);
};

// Parse a simple 2D matrix into transform components
const parseSimple2DMatrix = (a, b, c, d, e, f) => {
  const result = {};

  // Extract translation - only add if not default (0)
  if (e !== 0) {
    result.translateX = e;
  }
  if (f !== 0) {
    result.translateY = f;
  }

  // Check for identity matrix (no transform)
  if (a === 1 && b === 0 && c === 0 && d === 1) {
    return result; // Only translation
  }

  // Decompose the 2D transformation matrix
  // Based on: https://frederic-wang.fr/decomposition-of-2d-transform-matrices.html

  const det = a * d - b * c;
  // Degenerate matrix (maps to a line or point)
  if (det === 0) {
    return null;
  }

  // Extract scale and rotation
  if (c === 0) {
    // Simple case: no skew
    if (a !== 1) {
      result.scaleX = a;
    }
    if (d !== 1) {
      result.scaleY = d;
    }
    if (b !== 0) {
      const angle = Math.atan(b / a) * (180 / Math.PI);
      if (angle !== 0) {
        result.rotate = angle;
      }
    }
    return result;
  }

  // General case: decompose using QR decomposition approach
  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = det / scaleX;
  const rotation = Math.atan2(b, a) * (180 / Math.PI);
  const skewX =
    Math.atan((a * c + b * d) / (scaleX * scaleX)) * (180 / Math.PI);
  if (scaleX !== 1) {
    result.scaleX = scaleX;
  }
  if (scaleY !== 1) {
    result.scaleY = scaleY;
  }
  if (rotation !== 0) {
    result.rotate = rotation;
  }
  if (skewX !== 0) {
    result.skewX = skewX;
  }
  return result;
};

// Merge two style objects, handling special cases like transform
const mergeStyles = (stylesA, stylesB) => {
  const result = { ...stylesA };
  for (const key of Object.keys(stylesB)) {
    if (key === "transform") {
      result[key] = mergeOneStyle(stylesA[key], stylesB[key], key);
    } else {
      result[key] = stylesB[key];
    }
  }
  return result;
};

// Merge a single style property value with an existing value
const mergeOneStyle = (
  existingValue,
  newValue,
  propertyName,
  context = "js",
) => {
  if (propertyName === "transform") {
    // Matrix parsing is now handled automatically in parseCSSTransform

    // Determine the types
    const existingIsString =
      typeof existingValue === "string" && existingValue !== "none";
    const newIsString = typeof newValue === "string" && newValue !== "none";
    const existingIsObject =
      typeof existingValue === "object" && existingValue !== null;
    const newIsObject = typeof newValue === "object" && newValue !== null;

    // Case 1: Both are objects - merge directly
    if (existingIsObject && newIsObject) {
      const merged = { ...existingValue, ...newValue };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 2: New is object, existing is string - parse existing and merge
    if (newIsObject && existingIsString) {
      const parsedExisting = parseCSSTransform(existingValue);
      const merged = { ...parsedExisting, ...newValue };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 3: New is string, existing is object - parse new and merge
    if (newIsString && existingIsObject) {
      const parsedNew = parseCSSTransform(newValue);
      const merged = { ...existingValue, ...parsedNew };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const parsedExisting = parseCSSTransform(existingValue);
      const parsedNew = parseCSSTransform(newValue);
      const merged = { ...parsedExisting, ...parsedNew };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 5: New is object, no existing or existing is none/null
    if (newIsObject) {
      return context === "css" ? stringifyCSSTransform(newValue) : newValue;
    }

    // Case 6: New is string, no existing or existing is none/null
    if (newIsString) {
      if (context === "css") {
        return newValue; // Already a string
      }
      return parseCSSTransform(newValue); // Convert to object
    }
  }

  // For all other properties, simple replacement
  return newValue;
};

/**
 * Style Controller System
 *
 * Solves CSS style manipulation problems in JavaScript:
 *
 * ## Main problems:
 * 1. **Temporary style override**: Code wants to read current style, force another style,
 *    then restore original. With inline styles this is ugly and loses original info.
 * 2. **Multiple code parts**: When different parts of code want to touch styles simultaneously,
 *    they step on each other (rare but happens).
 * 3. **Transform composition**: CSS transforms are especially painful - you want to keep
 *    existing transforms but force specific parts (e.g., keep `rotate(45deg)` but override
 *    `translateX`). Native CSS overwrites the entire transform property.
 *
 * ## Solution:
 * Controller pattern + Web Animations API to preserve inline styles. Code that sets
 * inline styles expects to find them unchanged - we use animations for clean override:
 *
 * ```js
 * const controller = createStyleController("myFeature");
 *
 * // Smart value conversion (100 → "100px", 45 → "45deg")
 * controller.set(element, {
 *   transform: { translateX: 100, rotate: 45 }, // Individual transform properties
 *   opacity: 0.5
 * });
 *
 * // Transform objects merged intelligently
 * controller.set(element, {
 *   transform: { translateX: 50 } // Merges with existing transforms
 * });
 *
 * // Get underlying value without this controller's influence
 * const originalOpacity = controller.getUnderlyingValue(element, "opacity");
 * const originalTranslateX = controller.getUnderlyingValue(element, "transform.translateX"); // Magic dot notation!
 * const actualWidth = controller.getUnderlyingValue(element, "rect.width"); // Layout measurements
 *
 * controller.delete(element, "opacity"); // Only removes opacity, keeps transform
 * controller.clear(element); // Removes all styles from this controller only
 * controller.clearAll(); // Cleanup when done
 * ```
 *
 * **Key features:**
 * - **Transform composition**: Intelligently merges transform components instead of overwriting
 * - **Magic properties**: Access transform components with dot notation (e.g., "transform.translateX")
 * - **Layout measurements**: Access actual rendered dimensions with rect.* (e.g., "rect.width")
 * - **getUnderlyingValue()**: Read the "natural" value without this controller's influence
 * - **Smart units**: Numeric values get appropriate units automatically (px, deg, unitless)
 *
 * **Transform limitations:**
 * - **3D Transforms**: Complex `matrix3d()` transforms are preserved as-is and cannot be decomposed
 *   into individual properties. Only `matrix3d()` that represent simple 2D transforms are converted
 *   to object notation. Magic properties like "transform.rotateX" work only with explicit CSS functions,
 *   not with complex 3D matrices.
 *
 * Multiple controllers can safely manage the same element without conflicts.
 */


// Global registry to track which controllers are managing each element's styles
const elementControllerSetRegistry = new WeakMap(); // element -> Set<controller>

// Top-level helpers for controller attachment tracking
const onElementControllerAdded = (element, controller) => {
  if (!elementControllerSetRegistry.has(element)) {
    elementControllerSetRegistry.set(element, new Set());
  }
  const elementControllerSet = elementControllerSetRegistry.get(element);
  elementControllerSet.add(controller);
};
const onElementControllerRemoved = (element, controller) => {
  const elementControllerSet = elementControllerSetRegistry.get(element);
  if (elementControllerSet) {
    elementControllerSet.delete(controller);

    // Clean up empty element registry
    if (elementControllerSet.size === 0) {
      elementControllerSetRegistry.delete(element);
    }
  }
};

const createStyleController = (name = "anonymous") => {
  // Store element data for this controller: element -> { styles, animation }
  const elementWeakMap = new WeakMap();

  const set = (element, stylesToSet) => {
    if (!element || typeof element !== "object") {
      throw new Error("Element must be a valid DOM element");
    }
    if (!stylesToSet || typeof stylesToSet !== "object") {
      throw new Error("styles must be an object");
    }

    const normalizedStylesToSet = normalizeStyles(stylesToSet, "js");
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      const animation = createAnimationForStyles(
        element,
        normalizedStylesToSet,
        name,
      );
      elementWeakMap.set(element, {
        styles: normalizedStylesToSet,
        animation,
      });
      onElementControllerAdded(element, controller);
      return;
    }

    const { styles, animation } = elementData;
    const mergedStyles = mergeStyles(styles, normalizedStylesToSet);
    elementData.styles = mergedStyles;
    updateAnimationStyles(animation, mergedStyles);
  };

  const get = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return undefined;
    }
    const { styles } = elementData;
    if (propertyName === undefined) {
      return { ...styles };
    }
    if (propertyName.startsWith("transform.")) {
      const transformProp = propertyName.slice("transform.".length);
      return styles.transform?.[transformProp];
    }
    return styles[propertyName];
  };

  const deleteMethod = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const { styles, animation } = elementData;
    const hasStyle = Object.hasOwn(styles, propertyName);
    if (!hasStyle) {
      return;
    }
    delete styles[propertyName];
    const isEmpty = Object.keys(styles).length === 0;
    // Clean up empty controller
    if (isEmpty) {
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
      return;
    }
    updateAnimationStyles(animation, styles);
  };

  const commit = (element) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return; // Nothing to commit on this element for this controller
    }
    const { styles, animation } = elementData;
    // Cancel our animation permanently since we're committing styles to inline
    // (Keep this BEFORE getComputedStyle to prevent computedStyle reading our animation styles)
    animation.cancel();
    // Now read the true underlying styles (without our animation influence)
    const computedStyles = getComputedStyle(element);
    // Convert controller styles to CSS and commit to inline styles
    const cssStyles = normalizeStyles(styles, "css");
    for (const [key, value] of Object.entries(cssStyles)) {
      // Merge with existing computed styles for all properties
      const existingValue = computedStyles[key];
      element.style[key] = mergeOneStyle(existingValue, value, key, "css");
    }
    // Clear this controller's styles since they're now inline
    elementWeakMap.delete(element);
    // Clean up controller from element registry
    onElementControllerRemoved(element, controller);
  };

  const clear = (element) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const { animation } = elementData;
    animation.cancel();
    elementWeakMap.delete(element);
    onElementControllerRemoved(element, controller);
  };

  const getUnderlyingValue = (element, propertyName) => {
    const elementControllerSet = elementControllerSetRegistry.get(element);

    const normalizeValueForJs = (value) => {
      // Use normalizeStyle to handle all property types including transform dot notation
      return normalizeStyle(value, propertyName, "js");
    };

    const getFromOtherControllers = () => {
      if (!elementControllerSet || elementControllerSet.size <= 1) {
        return undefined;
      }

      let resultValue;
      for (const otherController of elementControllerSet) {
        if (otherController === controller) continue;
        const otherStyles = otherController.get(element);
        if (propertyName in otherStyles) {
          resultValue = mergeOneStyle(
            resultValue,
            otherStyles[propertyName],
            propertyName,
          );
        }
      }

      // Note: For CSS width/height properties, we can trust the values from other controllers
      // because we assume box-sizing: border-box. If the element used content-box,
      // the CSS width/height would differ from getBoundingClientRect() due to padding/borders,
      // but since controllers set the final rendered size, the CSS value is what matters.
      // For actual layout measurements, use rect.* properties instead.
      return normalizeValueForJs(resultValue);
    };

    const getFromDOM = () => {
      // Handle transform dot notation
      if (propertyName.startsWith("transform.")) {
        const transformValue = getComputedStyle(element).transform;
        return normalizeValueForJs(transformValue);
      }
      // For all other CSS properties, use computed styles
      const computedValue = getComputedStyle(element)[propertyName];
      return normalizeValueForJs(computedValue);
    };

    const getFromDOMLayout = () => {
      // For rect.* properties that reflect actual layout, always read from DOM
      // These represent the actual rendered dimensions, bypassing any controller influence
      if (propertyName === "rect.width") {
        return element.getBoundingClientRect().width;
      }
      if (propertyName === "rect.height") {
        return element.getBoundingClientRect().height;
      }
      if (propertyName === "rect.left") {
        return element.getBoundingClientRect().left;
      }
      if (propertyName === "rect.top") {
        return element.getBoundingClientRect().top;
      }
      if (propertyName === "rect.right") {
        return element.getBoundingClientRect().right;
      }
      if (propertyName === "rect.bottom") {
        return element.getBoundingClientRect().bottom;
      }
      return undefined;
    };

    const getWhileDisablingThisController = (fn) => {
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        return fn();
      }
      const { styles, animation } = elementData;
      // Temporarily cancel our animation to read underlying value
      animation.cancel();
      const underlyingValue = fn();
      // Restore our animation
      elementData.animation = createAnimationForStyles(element, styles, name);
      return underlyingValue;
    };

    if (typeof propertyName === "function") {
      return getWhileDisablingThisController(propertyName);
    }

    // Handle computed layout properties (rect.*) - always read from DOM, bypass controllers
    if (propertyName.startsWith("rect.")) {
      return getWhileDisablingThisController(getFromDOMLayout);
    }
    if (!elementControllerSet || !elementControllerSet.has(controller)) {
      // This controller is not applied, just read current value
      return getFromDOM();
    }
    // Check if other controllers would provide this style
    const valueFromOtherControllers = getFromOtherControllers();
    if (valueFromOtherControllers !== undefined) {
      return valueFromOtherControllers;
    }
    return getWhileDisablingThisController(getFromDOM);
  };

  const clearAll = () => {
    // Remove this controller from all elements and clean up animations
    for (const [
      element,
      elementControllerSet,
    ] of elementControllerSetRegistry) {
      if (!elementControllerSet.has(controller)) {
        continue;
      }
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        continue;
      }
      const { animation } = elementData;
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
    }
  };
  const controller = {
    name,
    set,
    get,
    delete: deleteMethod,
    getUnderlyingValue,
    commit,
    clear,
    clearAll,
  };

  return controller;
};

const createAnimationForStyles = (element, styles, id) => {
  const cssStylesToSet = normalizeStyles(styles, "css");
  const animation = element.animate([cssStylesToSet], {
    duration: 0,
    fill: "forwards",
  });
  animation.id = id; // Set a debug name for this animation
  animation.play();
  animation.pause();
  return animation; // Return the created animation
};

const updateAnimationStyles = (animation, styles) => {
  const cssStyles = normalizeStyles(styles, "css");
  animation.effect.setKeyframes([cssStyles]);
  animation.play();
  animation.pause();
};

const setAttribute = (element, name, value) => {
  if (element.hasAttribute(name)) {
    const prevValue = element.getAttribute(name);
    element.setAttribute(name, value);
    return () => {
      element.setAttribute(name, prevValue);
    };
  }
  element.setAttribute(name, value);
  return () => {
    element.removeAttribute(name);
  };
};

const createSetMany = (setter) => {
  return (element, description) => {
    const cleanupCallbackSet = new Set();
    for (const name of Object.keys(description)) {
      const value = description[name];
      const restoreStyle = setter(element, name, value);
      cleanupCallbackSet.add(restoreStyle);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
  };
};

const setAttributes = createSetMany(setAttribute);

/**
 * Calculates the contrast ratio between two RGBA colors
 * Based on WCAG 2.1 specification
 * @param {Array<number>} rgba1 - [r, g, b, a] values for first color
 * @param {Array<number>} rgba2 - [r, g, b, a] values for second color
 * @param {Array<number>} [background=[255, 255, 255, 1]] - Background color to composite against when colors have transparency
 * @returns {number} Contrast ratio (1-21)
 */
const getContrastRatio = (
  rgba1,
  rgba2,
  background = [255, 255, 255, 1],
) => {
  // When colors have transparency (alpha < 1), we need to composite them
  // against a background to get their effective appearance
  const composited1 = compositeColor(rgba1, background);
  const composited2 = compositeColor(rgba2, background);

  const lum1 = getLuminance(composited1[0], composited1[1], composited1[2]);
  const lum2 = getLuminance(composited2[0], composited2[1], composited2[2]);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Composites a color with alpha over a background color
 * @param {Array<number>} foreground - [r, g, b, a] foreground color
 * @param {Array<number>} background - [r, g, b, a] background color
 * @returns {Array<number>} [r, g, b] composited color (alpha is flattened)
 */
const compositeColor = (foreground, background) => {
  const [fr, fg, fb, fa] = foreground;
  const [br, bg, bb, ba] = background;

  // No transparency: return the foreground color as-is
  if (fa === 1) {
    return [fr, fg, fb];
  }

  // Alpha compositing formula: C = αA * CA + αB * (1 - αA) * CB
  const alpha = fa + ba * (1 - fa);

  if (alpha === 0) {
    return [0, 0, 0];
  }

  const r = (fa * fr + ba * (1 - fa) * br) / alpha;
  const g = (fa * fg + ba * (1 - fa) * bg) / alpha;
  const b = (fa * fb + ba * (1 - fa) * bb) / alpha;

  return [Math.round(r), Math.round(g), Math.round(b)];
};

/**
 * Calculates the relative luminance of an RGB color
 * Based on WCAG 2.1 specification
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {number} Relative luminance (0-1)
 */
const getLuminance = (r, g, b) => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * Parses a CSS color string into RGBA values
 * Supports hex (#rgb, #rrggbb, #rrggbbaa), rgb(), rgba(), hsl(), hsla()
 * @param {string} color - CSS color string
 * @returns {Array<number>|null} [r, g, b, a] values or null if parsing fails
 */
const parseCSSColor = (color) => {
  if (!color || typeof color !== "string") {
    return null;
  }

  color = color.trim().toLowerCase();

  // Hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      // #rgb -> #rrggbb
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b, 1];
    }
    if (hex.length === 6) {
      // #rrggbb
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b, 1];
    }
    if (hex.length === 8) {
      // #rrggbbaa
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return [r, g, b, a];
    }
  }

  // RGB/RGBA colors
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const values = rgbMatch[1].split(",").map((v) => parseFloat(v.trim()));
    if (values.length >= 3) {
      const r = values[0];
      const g = values[1];
      const b = values[2];
      const a = values.length >= 4 ? values[3] : 1;
      return [r, g, b, a];
    }
  }

  // HSL/HSLA colors - convert to RGB
  const hslMatch = color.match(/hsla?\(([^)]+)\)/);
  if (hslMatch) {
    const values = hslMatch[1].split(",").map((v) => parseFloat(v.trim()));
    if (values.length >= 3) {
      const [h, s, l] = values;
      const a = values.length >= 4 ? values[3] : 1;
      const [r, g, b] = hslToRgb(h, s / 100, l / 100);
      return [r, g, b, a];
    }
  }

  // Named colors (basic set)
  if (namedColors[color]) {
    return [...namedColors[color], 1];
  }
  return null;
};

/**
 * Converts RGBA values back to a CSS color string
 * Prefers named colors when possible, then rgb() for opaque colors, rgba() for transparent
 * @param {Array<number>} rgba - [r, g, b, a] values
 * @returns {string|null} CSS color string or null if invalid input
 */
const stringifyCSSColor = (rgba) => {
  if (!Array.isArray(rgba) || rgba.length < 3) {
    return null;
  }

  const [r, g, b, a = 1] = rgba;

  // Validate RGB values
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return null;
  }

  // Validate alpha value
  if (a < 0 || a > 1) {
    return null;
  }

  // Round RGB values to integers
  const rInt = Math.round(r);
  const gInt = Math.round(g);
  const bInt = Math.round(b);

  // Check for named colors (only for fully opaque colors)
  if (a === 1) {
    for (const [name, [nameR, nameG, nameB]] of Object.entries(namedColors)) {
      if (rInt === nameR && gInt === nameG && bInt === nameB) {
        return name;
      }
    }
  }

  // Use rgb() for opaque colors, rgba() for transparent
  if (a === 1) {
    return `rgb(${rInt}, ${gInt}, ${bInt})`;
  }
  return `rgba(${rInt}, ${gInt}, ${bInt}, ${a})`;
};

const namedColors = {
  // Basic colors
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],

  // Gray variations
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  lightgray: [211, 211, 211],
  lightgrey: [211, 211, 211],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  gainsboro: [220, 220, 220],
  whitesmoke: [245, 245, 245],

  // Extended basic colors
  maroon: [128, 0, 0],
  olive: [128, 128, 0],
  lime: [0, 255, 0],
  aqua: [0, 255, 255],
  teal: [0, 128, 128],
  navy: [0, 0, 128],
  fuchsia: [255, 0, 255],
  purple: [128, 0, 128],

  // Red variations
  darkred: [139, 0, 0],
  firebrick: [178, 34, 34],
  crimson: [220, 20, 60],
  indianred: [205, 92, 92],
  lightcoral: [240, 128, 128],
  salmon: [250, 128, 114],
  darksalmon: [233, 150, 122],
  lightsalmon: [255, 160, 122],

  // Pink variations
  pink: [255, 192, 203],
  lightpink: [255, 182, 193],
  hotpink: [255, 105, 180],
  deeppink: [255, 20, 147],
  mediumvioletred: [199, 21, 133],
  palevioletred: [219, 112, 147],

  // Orange variations
  orange: [255, 165, 0],
  darkorange: [255, 140, 0],
  orangered: [255, 69, 0],
  tomato: [255, 99, 71],
  coral: [255, 127, 80],

  // Yellow variations
  gold: [255, 215, 0],
  lightyellow: [255, 255, 224],
  lemonchiffon: [255, 250, 205],
  lightgoldenrodyellow: [250, 250, 210],
  papayawhip: [255, 239, 213],
  moccasin: [255, 228, 181],
  peachpuff: [255, 218, 185],
  palegoldenrod: [238, 232, 170],
  khaki: [240, 230, 140],
  darkkhaki: [189, 183, 107],

  // Green variations
  darkgreen: [0, 100, 0],
  forestgreen: [34, 139, 34],
  seagreen: [46, 139, 87],
  mediumseagreen: [60, 179, 113],
  springgreen: [0, 255, 127],
  mediumspringgreen: [0, 250, 154],
  lawngreen: [124, 252, 0],
  chartreuse: [127, 255, 0],
  greenyellow: [173, 255, 47],
  limegreen: [50, 205, 50],
  palegreen: [152, 251, 152],
  lightgreen: [144, 238, 144],
  mediumaquamarine: [102, 205, 170],
  aquamarine: [127, 255, 212],
  darkolivegreen: [85, 107, 47],
  olivedrab: [107, 142, 35],
  yellowgreen: [154, 205, 50],

  // Blue variations
  darkblue: [0, 0, 139],
  mediumblue: [0, 0, 205],
  royalblue: [65, 105, 225],
  steelblue: [70, 130, 180],
  dodgerblue: [30, 144, 255],
  deepskyblue: [0, 191, 255],
  skyblue: [135, 206, 235],
  lightskyblue: [135, 206, 250],
  lightblue: [173, 216, 230],
  powderblue: [176, 224, 230],
  lightcyan: [224, 255, 255],
  paleturquoise: [175, 238, 238],
  darkturquoise: [0, 206, 209],
  mediumturquoise: [72, 209, 204],
  turquoise: [64, 224, 208],
  cadetblue: [95, 158, 160],
  darkcyan: [0, 139, 139],
  lightseagreen: [32, 178, 170],

  // Purple variations
  indigo: [75, 0, 130],
  darkviolet: [148, 0, 211],
  blueviolet: [138, 43, 226],
  mediumpurple: [147, 112, 219],
  mediumslateblue: [123, 104, 238],
  slateblue: [106, 90, 205],
  darkslateblue: [72, 61, 139],
  lavender: [230, 230, 250],
  thistle: [216, 191, 216],
  plum: [221, 160, 221],
  violet: [238, 130, 238],
  orchid: [218, 112, 214],
  mediumorchid: [186, 85, 211],
  darkorchid: [153, 50, 204],
  darkmagenta: [139, 0, 139],

  // Brown variations
  brown: [165, 42, 42],
  saddlebrown: [139, 69, 19],
  sienna: [160, 82, 45],
  chocolate: [210, 105, 30],
  darkgoldenrod: [184, 134, 11],
  peru: [205, 133, 63],
  rosybrown: [188, 143, 143],
  goldenrod: [218, 165, 32],
  sandybrown: [244, 164, 96],
  tan: [210, 180, 140],
  burlywood: [222, 184, 135],
  wheat: [245, 222, 179],
  navajowhite: [255, 222, 173],
  bisque: [255, 228, 196],
  blanchedalmond: [255, 235, 205],
  cornsilk: [255, 248, 220],

  // Special colors
  transparent: [0, 0, 0], // Note: alpha will be 0 for transparent
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  honeydew: [240, 255, 240],
  ivory: [255, 255, 240],
  lavenderblush: [255, 240, 245],
  linen: [250, 240, 230],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  oldlace: [253, 245, 230],
  seashell: [255, 245, 238],
  snow: [255, 250, 250],
};

/**
 * Converts HSL color to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {Array<number>} [r, g, b] values
 */
const hslToRgb = (h, s, l) => {
  h = h % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const createRgb = (r, g, b) => {
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  };

  if (h >= 0 && h < 60) {
    return createRgb(c, x, 0);
  }
  if (h >= 60 && h < 120) {
    return createRgb(x, c, 0);
  }
  if (h >= 120 && h < 180) {
    return createRgb(0, c, x);
  }
  if (h >= 180 && h < 240) {
    return createRgb(0, x, c);
  }
  if (h >= 240 && h < 300) {
    return createRgb(x, 0, c);
  }
  if (h >= 300 && h < 360) {
    return createRgb(c, 0, x);
  }

  return createRgb(0, 0, 0);
};

/**
 * Determines if the current color scheme is dark mode
 * @param {Element} [element] - DOM element to check color-scheme against (optional)
 * @returns {boolean} True if dark mode is active
 */
const prefersDarkColors = (element) => {
  const colorScheme = getPreferedColorScheme(element);
  return colorScheme.includes("dark");
};

const getPreferedColorScheme = (element) => {
  const computedStyle = getComputedStyle(element || document.documentElement);
  const colorScheme = computedStyle.colorScheme;

  // If no explicit color-scheme is set, or it's "normal",
  // fall back to prefers-color-scheme media query
  if (!colorScheme || colorScheme === "normal") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return colorScheme;
};

/**
 * Resolves a color value, handling CSS custom properties and light-dark() function
 * @param {string} color - CSS color value (may include CSS variables, light-dark())
 * @param {Element} element - DOM element to resolve CSS variables and light-dark() against
 * @param {string} context - Return format: "js" for RGBA array, "css" for CSS string
 * @returns {Array<number>|string|null} [r, g, b, a] values, CSS string, or null if parsing fails
 */
const resolveCSSColor = (color, element, context = "js") => {
  if (!color || typeof color !== "string") {
    return null;
  }

  let resolvedColor = color;

  // Handle light-dark() function
  const lightDarkMatch = color.match(/light-dark\(([^,]+),([^)]+)\)/);
  if (lightDarkMatch) {
    const lightColor = lightDarkMatch[1].trim();
    const darkColor = lightDarkMatch[2].trim();

    // Select the appropriate color and recursively resolve it
    const prefersDark = prefersDarkColors(element);
    resolvedColor = prefersDark ? darkColor : lightColor;
    return resolveCSSColor(resolvedColor, element, context);
  }

  // If it's a CSS custom property, resolve it using getComputedStyle
  if (resolvedColor.includes("var(")) {
    const computedStyle = getComputedStyle(element);

    // Handle var() syntax
    const varMatch = color.match(/var\(([^,)]+)(?:,([^)]+))?\)/);
    if (varMatch) {
      const propertyName = varMatch[1].trim();
      const fallback = varMatch[2]?.trim();

      const resolvedValue = computedStyle.getPropertyValue(propertyName).trim();
      if (resolvedValue) {
        // Recursively resolve in case the CSS variable contains light-dark() or other variables
        return resolveCSSColor(resolvedValue, element, context);
      }
      if (fallback) {
        // Recursively resolve fallback (in case it's also a CSS variable)
        return resolveCSSColor(fallback, element, context);
      }
    }
  }

  // Parse the resolved color and return in the requested format
  const rgba = parseCSSColor(resolvedColor);

  if (context === "css") {
    return rgba ? stringifyCSSColor(rgba) : null;
  }

  return rgba;
};

/**
 * Chooses between light and dark colors based on which provides better contrast against a background
 * @param {Element} element - DOM element to resolve CSS variables against
 * @param {string} backgroundColor - CSS color value (hex, rgb, hsl, CSS variable, etc.)
 * @param {string} lightColor - Light color option (typically for dark backgrounds)
 * @param {string} darkColor - Dark color option (typically for light backgrounds)
 * @returns {string} The color that provides better contrast (lightColor or darkColor)
 */

const pickLightOrDark = (
  element,
  backgroundColor,
  lightColor = "white",
  darkColor = "black",
) => {
  const resolvedBgColor = resolveCSSColor(backgroundColor, element);
  const resolvedLightColor = resolveCSSColor(lightColor, element);
  const resolvedDarkColor = resolveCSSColor(darkColor, element);

  if (!resolvedBgColor || !resolvedLightColor || !resolvedDarkColor) {
    // Fallback to light color if parsing fails
    return lightColor;
  }

  const contrastWithLight = getContrastRatio(
    resolvedBgColor,
    resolvedLightColor,
  );
  const contrastWithDark = getContrastRatio(resolvedBgColor, resolvedDarkColor);

  return contrastWithLight > contrastWithDark ? lightColor : darkColor;
};

const findDescendant = (rootNode, fn, { skipRoot } = {}) => {
  const iterator = createNextNodeIterator(rootNode, rootNode, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    let skipChildren = false;
    if (node === skipRoot) {
      skipChildren = true;
    } else {
      const skip = () => {
        skipChildren = true;
      };
      if (fn(node, skip)) {
        return node;
      }
    }
    ({ done, value: node } = iterator.next(skipChildren));
  }
  return null;
};

const findLastDescendant = (rootNode, fn, { skipRoot } = {}) => {
  const deepestNode = getDeepestNode(rootNode, skipRoot);
  if (deepestNode) {
    const iterator = createPreviousNodeIterator(
      deepestNode,
      rootNode,
      skipRoot,
    );
    let { done, value: node } = iterator.next();
    while (done === false) {
      if (fn(node)) {
        return node;
      }
      ({ done, value: node } = iterator.next());
    }
  }
  return null;
};

const findAfter = (
  from,
  predicate,
  { root = null, skipRoot = null, skipChildren = false } = {},
) => {
  const iterator = createAfterNodeIterator(from, root, skipChildren, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

const findBefore = (
  from,
  predicate,
  { root = null, skipRoot = null } = {},
) => {
  const iterator = createPreviousNodeIterator(from, root, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

const getNextNode = (node, rootNode, skipChild = false, skipRoot = null) => {
  if (!skipChild) {
    const firstChild = node.firstChild;
    if (firstChild) {
      // If the first child is skipRoot or inside skipRoot, skip it
      if (
        skipRoot &&
        (firstChild === skipRoot || skipRoot.contains(firstChild))
      ) {
        // Skip this entire subtree by going to next sibling or up
        return getNextNode(node, rootNode, true, skipRoot);
      }
      return firstChild;
    }
  }

  const nextSibling = node.nextSibling;
  if (nextSibling) {
    // If next sibling is skipRoot, skip it entirely
    if (skipRoot && nextSibling === skipRoot) {
      return getNextNode(nextSibling, rootNode, true, skipRoot);
    }
    return nextSibling;
  }

  const parentNode = node.parentNode;
  if (parentNode && parentNode !== rootNode) {
    return getNextNode(parentNode, rootNode, true, skipRoot);
  }

  return null;
};

const createNextNodeIterator = (node, rootNode, skipRoot = null) => {
  let current = node;
  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      innerSkipChildren,
      skipRoot,
    );
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const createAfterNodeIterator = (
  fromNode,
  rootNode,
  skipChildren = false,
  skipRoot = null,
) => {
  let current = fromNode;
  let childrenSkipped = false;

  // If we're inside skipRoot, we need to start searching after skipRoot entirely
  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
    childrenSkipped = true; // Mark that we've already "processed" this node
    skipChildren = true; // Force skip children to exit the skipRoot subtree
  }

  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      (skipChildren && childrenSkipped === false) || innerSkipChildren,
      skipRoot,
    );
    childrenSkipped = true;
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const getDeepestNode = (node, skipRoot = null) => {
  let deepestNode = node.lastChild;
  while (deepestNode) {
    // If we hit skipRoot or enter its subtree, stop going deeper
    if (
      skipRoot &&
      (deepestNode === skipRoot || skipRoot.contains(deepestNode))
    ) {
      // Try the previous sibling instead
      const previousSibling = deepestNode.previousSibling;
      if (previousSibling) {
        return getDeepestNode(previousSibling, skipRoot);
      }
      // If no previous sibling, return the parent (which should be safe)
      return deepestNode.parentNode === node ? null : deepestNode.parentNode;
    }

    const lastChild = deepestNode.lastChild;
    if (lastChild) {
      deepestNode = lastChild;
    } else {
      break;
    }
  }
  return deepestNode;
};

const getPreviousNode = (node, rootNode, skipRoot = null) => {
  const previousSibling = node.previousSibling;
  if (previousSibling) {
    // If previous sibling is skipRoot, skip it entirely
    if (skipRoot && previousSibling === skipRoot) {
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }

    const deepestChild = getDeepestNode(previousSibling, skipRoot);

    // Check if deepest child is inside skipRoot (shouldn't happen with updated getDeepestNode, but safe check)
    if (
      skipRoot &&
      deepestChild &&
      (deepestChild === skipRoot || skipRoot.contains(deepestChild))
    ) {
      // Skip this sibling entirely and try the next one
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }

    if (deepestChild) {
      return deepestChild;
    }
    return previousSibling;
  }
  if (node !== rootNode) {
    const parentNode = node.parentNode;
    if (parentNode && parentNode !== rootNode) {
      return parentNode;
    }
  }
  return null;
};

const createPreviousNodeIterator = (fromNode, rootNode, skipRoot = null) => {
  let current = fromNode;

  // If we're inside skipRoot, we need to start searching before skipRoot entirely
  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
  }

  const next = () => {
    const previousNode = getPreviousNode(current, rootNode, skipRoot);
    current = previousNode;
    return {
      done: Boolean(previousNode) === false,
      value: previousNode,
    };
  };
  return {
    next,
  };
};

const activeElementSignal = signal(document.activeElement);

document.addEventListener(
  "focus",
  () => {
    activeElementSignal.value = document.activeElement;
  },
  { capture: true },
);
// When clicking on document there is no "focus" event dispatched on the document
// We can detect that with "blur" event when relatedTarget is null
document.addEventListener(
  "blur",
  (e) => {
    if (!e.relatedTarget) {
      activeElementSignal.value = document.activeElement;
    }
  },
  { capture: true },
);

const useActiveElement = () => {
  return activeElementSignal.value;
};

const elementIsVisibleForFocus = (node) => {
  return getFocusVisibilityInfo(node).visible;
};
const getFocusVisibilityInfo = (node) => {
  if (isDocumentElement(node)) {
    return { visible: true, reason: "is document" };
  }
  if (node.hasAttribute("hidden")) {
    return { visible: false, reason: "has hidden attribute" };
  }
  if (getStyle(node, "visibility") === "hidden") {
    return { visible: false, reason: "uses visiblity: hidden" };
  }
  if (node.tagName === "INPUT" && node.type === "hidden") {
    return { visible: false, reason: "input type hidden" };
  }
  let nodeOrAncestor = node;
  while (nodeOrAncestor) {
    if (isDocumentElement(nodeOrAncestor)) {
      break;
    }
    if (getStyle(nodeOrAncestor, "display") === "none") {
      return { visible: false, reason: "ancestor uses display: none" };
    }
    // Check if element is inside a closed details element
    if (elementIsDetails(nodeOrAncestor) && !nodeOrAncestor.open) {
      // Special case: summary elements are visible even when their parent details is closed
      // But only if this details element is the direct parent of the summary
      if (!elementIsSummary(node) || node.parentElement !== nodeOrAncestor) {
        return { visible: false, reason: "inside closed details element" };
      }
      // Continue checking ancestors
    }
    nodeOrAncestor = nodeOrAncestor.parentNode;
  }
  return { visible: true, reason: "no reason to be hidden" };
};
const getVisuallyVisibleInfo = (
  node,
  { countOffscreenAsVisible = false } = {},
) => {
  // First check all the focusable visibility conditions
  const focusVisibilityInfo = getFocusVisibilityInfo(node);
  if (!focusVisibilityInfo.visible) {
    return focusVisibilityInfo;
  }

  // Additional visual visibility checks
  if (getStyle(node, "opacity") === "0") {
    return { visible: false, reason: "uses opacity: 0" };
  }

  const rect = node.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return { visible: false, reason: "has zero dimensions" };
  }

  // Check for clipping
  const clipStyle = getStyle(node, "clip");
  if (clipStyle && clipStyle !== "auto" && clipStyle.includes("rect(0")) {
    return { visible: false, reason: "clipped with clip property" };
  }

  const clipPathStyle = getStyle(node, "clip-path");
  if (clipPathStyle && clipPathStyle.includes("inset(100%")) {
    return { visible: false, reason: "clipped with clip-path" };
  }

  // Check if positioned off-screen (unless option says to count as visible)
  if (!countOffscreenAsVisible) {
    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      return { visible: false, reason: "positioned off-screen" };
    }
  }

  // Check for transform scale(0)
  const transformStyle = getStyle(node, "transform");
  if (transformStyle && transformStyle.includes("scale(0")) {
    return { visible: false, reason: "scaled to zero with transform" };
  }

  return { visible: true, reason: "visually visible" };
};
const getFirstVisuallyVisibleAncestor = (node, options = {}) => {
  let ancestorCandidate = node.parentNode;
  while (ancestorCandidate) {
    const visibilityInfo = getVisuallyVisibleInfo(ancestorCandidate, options);
    if (visibilityInfo.visible) {
      return ancestorCandidate;
    }
    ancestorCandidate = ancestorCandidate.parentElement;
  }
  // This shouldn't happen in normal cases since document element is always visible
  return null;
};

const elementIsFocusable = (node) => {
  // only element node can be focused, document, textNodes etc cannot
  if (node.nodeType !== 1) {
    return false;
  }
  if (!canInteract(node)) {
    return false;
  }
  const nodeName = node.nodeName.toLowerCase();
  if (nodeName === "input") {
    if (node.type === "hidden") {
      return false;
    }
    return elementIsVisibleForFocus(node);
  }
  if (
    ["button", "select", "datalist", "iframe", "textarea"].indexOf(nodeName) >
    -1
  ) {
    return elementIsVisibleForFocus(node);
  }
  if (["a", "area"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("href") === false) {
      return false;
    }
    return elementIsVisibleForFocus(node);
  }
  if (["audio", "video"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("controls") === false) {
      return false;
    }
    return elementIsVisibleForFocus(node);
  }
  if (nodeName === "summary") {
    return elementIsVisibleForFocus(node);
  }
  if (node.hasAttribute("tabindex") || node.hasAttribute("tabIndex")) {
    return elementIsVisibleForFocus(node);
  }
  if (node.hasAttribute("draggable")) {
    return elementIsVisibleForFocus(node);
  }
  return false;
};

const canInteract = (element) => {
  if (element.disabled) {
    return false;
  }
  if (element.hasAttribute("inert")) {
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert
    return false;
  }
  return true;
};

const findFocusable = (element) => {
  const associatedElements = getAssociatedElements(element);
  if (associatedElements) {
    for (const associatedElement of associatedElements) {
      const focusable = findFocusable(associatedElement);
      if (focusable) {
        return focusable;
      }
    }
    return null;
  }
  if (elementIsFocusable(element)) {
    return element;
  }
  const focusableDescendant = findDescendant(element, elementIsFocusable);
  return focusableDescendant;
};

const canInterceptKeys = (event) => {
  const target = event.target;
  // Don't handle shortcuts when user is typing
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.contentEditable === "true" ||
    target.isContentEditable
  ) {
    return false;
  }
  // Don't handle shortcuts when select dropdown is open
  if (target.tagName === "SELECT") {
    return false;
  }
  // Don't handle shortcuts when target or container is disabled
  if (
    target.disabled ||
    target.closest("[disabled]") ||
    target.inert ||
    target.closest("[inert]")
  ) {
    return false;
  }
  return true;
};

// WeakMap to store focus group metadata
const focusGroupRegistry = new WeakMap();

const setFocusGroup = (element, options) => {
  focusGroupRegistry.set(element, options);
  return () => {
    focusGroupRegistry.delete(element);
  };
};
const getFocusGroup = (element) => {
  return focusGroupRegistry.get(element);
};

const createEventMarker = (symbolName) => {
  const symbol = Symbol.for(symbolName);

  const isMarked = (event) => {
    return Boolean(event[symbol]);
  };

  return {
    mark: (event) => {
      event[symbol] = true;
    },
    isMarked,
  };
};

const focusNavEventMarker = createEventMarker("focus_nav");

const isFocusNavMarked = (event) => {
  return focusNavEventMarker.isMarked(event);
};
const markFocusNav = (event) => {
  focusNavEventMarker.mark(event);
};

const performArrowNavigation = (
  event,
  element,
  { direction = "both", loop, name } = {},
) => {
  if (!canInterceptKeys(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.hasAttribute("data-focusnav") === "none") {
    // no need to prevent default here (arrow don't move focus by default in a focus group)
    // (and it would prevent scroll via keyboard that we might want here)
    return true;
  }

  const onTargetToFocus = (targetToFocus) => {
    console.debug(
      `Arrow navigation: ${event.key} from`,
      activeElement,
      "to",
      targetToFocus,
    );
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };

  // Grid navigation: we support only TABLE element for now
  // A role="table" or an element with display: table could be used too but for now we need only TABLE support
  if (element.tagName === "TABLE") {
    const targetInGrid = getTargetInTableFocusGroup(event, element, { loop });
    if (!targetInGrid) {
      return false;
    }
    onTargetToFocus(targetInGrid);
    return true;
  }

  const targetInLinearGroup = getTargetInLinearFocusGroup(event, element, {
    direction,
    loop,
    name,
  });
  if (!targetInLinearGroup) {
    return false;
  }
  onTargetToFocus(targetInLinearGroup);
  return true;
};

const getTargetInLinearFocusGroup = (
  event,
  element,
  { direction, loop, name },
) => {
  const activeElement = document.activeElement;

  // Check for Cmd/Ctrl + arrow keys for jumping to start/end of linear group
  const isJumpToEnd = event.metaKey || event.ctrlKey;

  if (isJumpToEnd) {
    return getJumpToEndTargetLinear(event, element, direction);
  }

  const isForward = isForwardArrow(event, direction);

  // Arrow Left/Up: move to previous focusable element in group
  backward: {
    if (!isBackwardArrow(event, direction)) {
      break backward;
    }
    const previousElement = findBefore(activeElement, elementIsFocusable, {
      root: element,
    });
    if (previousElement) {
      return previousElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      name,
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      const lastFocusableElement = findLastDescendant(
        element,
        elementIsFocusable,
      );
      if (lastFocusableElement) {
        return lastFocusableElement;
      }
    }
    return null;
  }

  // Arrow Right/Down: move to next focusable element in group
  forward: {
    if (!isForward) {
      break forward;
    }
    const nextElement = findAfter(activeElement, elementIsFocusable, {
      root: element,
    });
    if (nextElement) {
      return nextElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      name,
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      // No next element, wrap to first focusable in group
      const firstFocusableElement = findDescendant(element, elementIsFocusable);
      if (firstFocusableElement) {
        return firstFocusableElement;
      }
    }
    return null;
  }

  return null;
};
// Find parent focus group with the same name and try delegation
const delegateArrowNavigation = (event, currentElement, { name }) => {
  let ancestorElement = currentElement.parentElement;
  while (ancestorElement) {
    const ancestorFocusGroup = getFocusGroup(ancestorElement);
    if (!ancestorFocusGroup) {
      ancestorElement = ancestorElement.parentElement;
      continue;
    }

    // Check if groups should delegate to each other
    const shouldDelegate =
      name === undefined && ancestorFocusGroup.name === undefined
        ? true // Both unnamed - delegate based on ancestor relationship
        : ancestorFocusGroup.name === name; // Both have same explicit name

    if (shouldDelegate) {
      // Try navigation in parent focus group
      return getTargetInLinearFocusGroup(event, ancestorElement, {
        direction: ancestorFocusGroup.direction,
        loop: ancestorFocusGroup.loop,
        name: ancestorFocusGroup.name,
      });
    }
  }
  return null;
};

// Handle Cmd/Ctrl + arrow keys for linear focus groups to jump to start/end
const getJumpToEndTargetLinear = (event, element, direction) => {
  // Check if this arrow key is valid for the given direction
  if (!isForwardArrow(event, direction) && !isBackwardArrow(event, direction)) {
    return null;
  }

  if (isBackwardArrow(event, direction)) {
    // Jump to first focusable element in the group
    return findDescendant(element, elementIsFocusable);
  }

  if (isForwardArrow(event, direction)) {
    // Jump to last focusable element in the group
    return findLastDescendant(element, elementIsFocusable);
  }

  return null;
};

const isBackwardArrow = (event, direction = "both") => {
  const backwardKeys = {
    both: ["ArrowLeft", "ArrowUp"],
    vertical: ["ArrowUp"],
    horizontal: ["ArrowLeft"],
  };
  return backwardKeys[direction]?.includes(event.key) ?? false;
};
const isForwardArrow = (event, direction = "both") => {
  const forwardKeys = {
    both: ["ArrowRight", "ArrowDown"],
    vertical: ["ArrowDown"],
    horizontal: ["ArrowRight"],
  };
  return forwardKeys[direction]?.includes(event.key) ?? false;
};

// Handle arrow navigation inside an HTMLTableElement as a grid.
// Moves focus to adjacent cell in the direction of the arrow key.
const getTargetInTableFocusGroup = (event, table, { loop }) => {
  const arrowKey = event.key;

  // Only handle arrow keys
  if (
    arrowKey !== "ArrowRight" &&
    arrowKey !== "ArrowLeft" &&
    arrowKey !== "ArrowUp" &&
    arrowKey !== "ArrowDown"
  ) {
    return null;
  }

  const focusedElement = document.activeElement;
  const currentCell = focusedElement?.closest?.("td,th");

  // If we're not currently in a table cell, try to focus the first focusable element in the table
  if (!currentCell || !table.contains(currentCell)) {
    return findDescendant(table, elementIsFocusable) || null;
  }

  // Get the current position in the table grid
  const currentRow = currentCell.parentElement; // tr element
  const allRows = Array.from(table.rows);
  const currentRowIndex = /** @type {HTMLTableRowElement} */ (currentRow)
    .rowIndex;
  const currentColumnIndex = /** @type {HTMLTableCellElement} */ (currentCell)
    .cellIndex;

  // Check for Cmd/Ctrl + arrow keys for jumping to end of row/column
  const isJumpToEnd = event.metaKey || event.ctrlKey;

  if (isJumpToEnd) {
    return getJumpToEndTarget(
      arrowKey,
      allRows,
      currentRowIndex,
      currentColumnIndex,
    );
  }

  // Create an iterator that will scan through cells in the arrow direction
  // until it finds one with a focusable element inside
  const candidateCells = createTableCellIterator(arrowKey, allRows, {
    startRow: currentRowIndex,
    startColumn: currentColumnIndex,
    originalColumn: currentColumnIndex, // Used to maintain column alignment for vertical moves
    loopMode: normalizeLoop(loop),
  });

  // Find the first cell that is itself focusable
  for (const candidateCell of candidateCells) {
    if (elementIsFocusable(candidateCell)) {
      return candidateCell;
    }
  }

  return null; // No focusable cell found
};

// Handle Cmd/Ctrl + arrow keys to jump to the end of row/column
const getJumpToEndTarget = (
  arrowKey,
  allRows,
  currentRowIndex,
  currentColumnIndex,
) => {
  if (arrowKey === "ArrowRight") {
    // Jump to last focusable cell in current row
    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;

    // Start from the last cell and work backwards to find focusable
    const cells = Array.from(currentRow.cells);
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i];
      if (elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowLeft") {
    // Jump to first focusable cell in current row
    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;

    const cells = Array.from(currentRow.cells);
    for (const cell of cells) {
      if (elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowDown") {
    // Jump to last focusable cell in current column
    for (let rowIndex = allRows.length - 1; rowIndex >= 0; rowIndex--) {
      const row = allRows[rowIndex];
      const cell = row?.cells?.[currentColumnIndex];
      if (cell && elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowUp") {
    // Jump to first focusable cell in current column
    for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
      const row = allRows[rowIndex];
      const cell = row?.cells?.[currentColumnIndex];
      if (cell && elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  return null;
};

// Create an iterator that yields table cells in the direction of arrow key movement.
// This scans through cells until it finds one with a focusable element or completes a full loop.
const createTableCellIterator = function* (
  arrowKey,
  allRows,
  { startRow, startColumn, originalColumn, loopMode },
) {
  if (allRows.length === 0) {
    return; // No rows to navigate
  }

  // Keep track of which column we should prefer for vertical movements
  // This helps maintain column alignment when moving up/down through rows of different lengths
  let preferredColumn = originalColumn;

  const normalizedLoopMode = normalizeLoop(loopMode);

  // Helper function to calculate the next position based on current position and arrow key
  const calculateNextPosition = (currentRow, currentColumn) =>
    getNextTablePosition(
      arrowKey,
      allRows,
      currentRow,
      currentColumn,
      preferredColumn,
      normalizedLoopMode,
    );

  // Start by calculating the first position to move to
  let nextPosition = calculateNextPosition(startRow, startColumn);
  if (!nextPosition) {
    return; // Cannot move in this direction (no looping enabled)
  }

  // Keep track of our actual starting position to detect when we've completed a full loop
  const actualStartingPosition = `${startRow}:${startColumn}`;

  while (true) {
    const [nextColumn, nextRow] = nextPosition; // Destructure [column, row]
    const targetRow = allRows[nextRow];
    const targetCell = targetRow?.cells?.[nextColumn];

    // Yield the cell if it exists
    if (targetCell) {
      yield targetCell;
    }

    // Update our preferred column based on movement:
    // - For horizontal moves, update to current column
    // - For vertical moves in flow mode at boundaries, advance to next/previous column
    if (arrowKey === "ArrowRight" || arrowKey === "ArrowLeft") {
      preferredColumn = nextColumn;
    } else if (arrowKey === "ArrowDown") {
      const isAtBottomRow = nextRow === allRows.length - 1;
      if (isAtBottomRow && normalizedLoopMode === "flow") {
        // Moving down from bottom row in flow mode: advance to next column
        const maxColumns = getMaxColumns(allRows);
        preferredColumn = preferredColumn + 1;
        if (preferredColumn >= maxColumns) {
          preferredColumn = 0; // Wrap to first column
        }
      }
    } else if (arrowKey === "ArrowUp") {
      const isAtTopRow = nextRow === 0;
      if (isAtTopRow && normalizedLoopMode === "flow") {
        // Moving up from top row in flow mode: go to previous column
        const maxColumns = getMaxColumns(allRows);
        if (preferredColumn === 0) {
          preferredColumn = maxColumns - 1; // Wrap to last column
        } else {
          preferredColumn = preferredColumn - 1;
        }
      }
    }

    // Calculate where to move next
    nextPosition = calculateNextPosition(nextRow, nextColumn);
    if (!nextPosition) {
      return; // Hit a boundary with no looping
    }

    // Check if we've completed a full loop by returning to our actual starting position
    const currentPositionKey = `${nextRow}:${nextColumn}`;
    if (currentPositionKey === actualStartingPosition) {
      return; // We've gone full circle back to where we started
    }
  }
};

// Normalize loop option to a mode string or false
const normalizeLoop = (loop) => {
  if (loop === true) return "wrap";
  if (loop === "wrap") return "wrap";
  if (loop === "flow") return "flow";
  return false;
};

const getMaxColumns = (rows) =>
  rows.reduce((max, r) => Math.max(max, r?.cells?.length || 0), 0);

// Calculate the next row and column position when moving in a table with arrow keys.
// Returns [column, row] for the next position, or null if movement is not possible.
const getNextTablePosition = (
  arrowKey,
  allRows,
  currentRow,
  currentColumn,
  preferredColumn, // Used for vertical movement to maintain column alignment
  loopMode,
) => {
  if (arrowKey === "ArrowRight") {
    const currentRowLength = allRows[currentRow]?.cells?.length || 0;
    const nextColumn = currentColumn + 1;

    // Can we move right within the same row?
    if (nextColumn < currentRowLength) {
      return [nextColumn, currentRow]; // [column, row]
    }

    // We're at the end of the row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: move to first cell of next row (wrap to top if at bottom)
      let nextRow = currentRow + 1;
      if (nextRow >= allRows.length) {
        nextRow = 0; // Wrap to first row
      }
      return [0, nextRow]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: stay in same row, wrap to first column
      return [0, currentRow]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowLeft") {
    const previousColumn = currentColumn - 1;

    // Can we move left within the same row?
    if (previousColumn >= 0) {
      return [previousColumn, currentRow]; // [column, row]
    }

    // We're at the beginning of the row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: move to last cell of previous row (wrap to bottom if at top)
      let previousRow = currentRow - 1;
      if (previousRow < 0) {
        previousRow = allRows.length - 1; // Wrap to last row
      }
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      const lastColumnInPreviousRow = Math.max(0, previousRowLength - 1);
      return [lastColumnInPreviousRow, previousRow]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: stay in same row, wrap to last column
      const currentRowLength = allRows[currentRow]?.cells?.length || 0;
      const lastColumnInCurrentRow = Math.max(0, currentRowLength - 1);
      return [lastColumnInCurrentRow, currentRow]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowDown") {
    const nextRow = currentRow + 1;

    // Can we move down within the table?
    if (nextRow < allRows.length) {
      const nextRowLength = allRows[nextRow]?.cells?.length || 0;
      // Try to maintain the preferred column, but clamp to row length
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, nextRowLength - 1),
      );
      return [targetColumn, nextRow]; // [column, row]
    }

    // We're at the bottom row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: advance to next column and go to top row
      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let nextColumnInFlow = currentColumn + 1;
      if (nextColumnInFlow >= maxColumns) {
        nextColumnInFlow = 0; // Wrap to first column
      }
      const topRowLength = allRows[0]?.cells?.length || 0;
      const clampedColumn = Math.min(
        nextColumnInFlow,
        Math.max(0, topRowLength - 1),
      );
      return [clampedColumn, 0]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: go to top row, maintaining preferred column
      const topRowLength = allRows[0]?.cells?.length || 0;
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, topRowLength - 1),
      );
      return [targetColumn, 0]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowUp") {
    const previousRow = currentRow - 1;

    // Can we move up within the table?
    if (previousRow >= 0) {
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      // Try to maintain the preferred column, but clamp to row length
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, previousRowLength - 1),
      );
      return [targetColumn, previousRow]; // [column, row]
    }

    // We're at the top row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: go to previous column and move to bottom row
      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let previousColumnInFlow;
      if (currentColumn === 0) {
        previousColumnInFlow = maxColumns - 1; // Wrap to last column
      } else {
        previousColumnInFlow = currentColumn - 1;
      }
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const clampedColumn = Math.min(
        previousColumnInFlow,
        Math.max(0, bottomRowLength - 1),
      );
      return [clampedColumn, bottomRowIndex]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: go to bottom row, maintaining preferred column
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, bottomRowLength - 1),
      );
      return [targetColumn, bottomRowIndex]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  // Unknown arrow key
  return null;
};

const performTabNavigation = (
  event,
  { rootElement = document.body, outsideOfElement = null } = {},
) => {
  if (!isTabEvent(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.getAttribute("data-focusnav") === "none") {
    event.preventDefault(); // ensure tab cannot move focus
    return true;
  }
  const isForward = !event.shiftKey;
  const onTargetToFocus = (targetToFocus) => {
    console.debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from`,
      activeElement,
      "to",
      targetToFocus,
    );
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };

  {
    console.debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from,`,
      activeElement,
    );
  }

  const predicate = (candidate) => {
    const canBeFocusedByTab = isFocusableByTab(candidate);
    {
      console.debug(`Testing`, candidate, `${canBeFocusedByTab ? "✓" : "✗"}`);
    }
    return canBeFocusedByTab;
  };

  const activeElementIsRoot = activeElement === rootElement;
  forward: {
    if (!isForward) {
      break forward;
    }
    if (activeElementIsRoot) {
      const firstFocusableElement = findDescendant(activeElement, predicate, {
        skipRoot: outsideOfElement,
      });
      if (firstFocusableElement) {
        return onTargetToFocus(firstFocusableElement);
      }
      return false;
    }
    const nextFocusableElement = findAfter(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (nextFocusableElement) {
      return onTargetToFocus(nextFocusableElement);
    }
    const firstFocusableElement = findDescendant(activeElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (firstFocusableElement) {
      return onTargetToFocus(firstFocusableElement);
    }
    return false;
  }

  {
    if (activeElementIsRoot) {
      const lastFocusableElement = findLastDescendant(
        activeElement,
        predicate,
        {
          skipRoot: outsideOfElement,
        },
      );
      if (lastFocusableElement) {
        return onTargetToFocus(lastFocusableElement);
      }
      return false;
    }

    const previousFocusableElement = findBefore(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (previousFocusableElement) {
      return onTargetToFocus(previousFocusableElement);
    }
    const lastFocusableElement = findLastDescendant(activeElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (lastFocusableElement) {
      return onTargetToFocus(lastFocusableElement);
    }
    return false;
  }
};

const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const isFocusableByTab = (element) => {
  if (hasNegativeTabIndex(element)) {
    return false;
  }
  return elementIsFocusable(element);
};
const hasNegativeTabIndex = (element) => {
  return (
    element.hasAttribute &&
    element.hasAttribute("tabIndex") &&
    Number(element.getAttribute("tabindex")) < 0
  );
};

/**
 * 
- https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/openui/open-ui/issues/990

 - https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md#69-grid-focusgroups
 */


const initFocusGroup = (
  element,
  {
    direction = "both",
    // extend = true,
    skipTab = true,
    loop = false,
    name, // Can be undefined for implicit ancestor-descendant grouping
  } = {},
) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const callback of cleanupCallbackSet) {
      callback();
    }
    cleanupCallbackSet.clear();
  };

  // Store focus group data in registry
  const removeFocusGroup = setFocusGroup(element, {
    direction,
    loop,
    name, // Store undefined as-is for implicit grouping
  });
  cleanupCallbackSet.add(removeFocusGroup);

  tab: {
    if (!skipTab) {
      break tab;
    }
    const handleTabKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      performTabNavigation(event, { outsideOfElement: element });
    };
    // Handle Tab navigation (exit group)
    element.addEventListener("keydown", handleTabKeyDown, {
      // we must use capture: false to let chance for other part of the code
      // to call preventFocusNav
      capture: false,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleTabKeyDown, {
        capture: false,
        passive: false,
      });
    });
  }

  // Handle Arrow key navigation (within group)
  {
    const handleArrowKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      performArrowNavigation(event, element, { direction, loop, name });
    };
    element.addEventListener("keydown", handleArrowKeyDown, {
      // we must use capture: false to let chance for other part of the code
      // to call preventFocusNav
      capture: false,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleArrowKeyDown, {
        capture: false,
        passive: false,
      });
    });
  }

  return { cleanup };
};

// note: keep in mind that an element with overflow: 'hidden' is scrollable
// it can be scrolled using keyboard arrows or JavaScript properties such as scrollTop, scrollLeft
// the only overflow that prevents scroll is "visible"
const isScrollable = (element, { includeHidden } = {}) => {
  if (canHaveVerticalScroll(element, { includeHidden })) {
    return true;
  }
  if (canHaveHorizontalScroll(element, { includeHidden })) {
    return true;
  }
  return false;
};

const canHaveVerticalScroll = (element, { includeHidden }) => {
  const verticalOverflow = getStyle(element, "overflow-y");
  if (verticalOverflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (verticalOverflow === "hidden" || verticalOverflow === "clip") {
    return includeHidden;
  }
  const overflow = getStyle(element, "overflow");
  if (overflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true; // "auto", "scroll"
};
const canHaveHorizontalScroll = (element, { includeHidden }) => {
  const horizontalOverflow = getStyle(element, "overflow-x");
  if (horizontalOverflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (horizontalOverflow === "hidden" || horizontalOverflow === "clip") {
    return includeHidden;
  }
  const overflow = getStyle(element, "overflow");
  if (overflow === "visible") {
    if (isDocumentElement(element)) {
      // browser returns "visible" on documentElement even if it is scrollable
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true; // "auto", "scroll"
};

const getScrollingElement = (document) => {
  const { scrollingElement } = document;
  if (scrollingElement) {
    return scrollingElement;
  }

  if (isCompliant(document)) {
    return document.documentElement;
  }

  const body = document.body;
  const isFrameset = body && !/body/i.test(body.tagName);
  const possiblyScrollingElement = isFrameset ? getNextBodyElement(body) : body;

  // If `body` is itself scrollable, it is not the `scrollingElement`.
  return possiblyScrollingElement && bodyIsScrollable(possiblyScrollingElement)
    ? null
    : possiblyScrollingElement;
};

const isHidden = (element) => {
  const display = getStyle(element, "display");
  if (display === "none") {
    return false;
  }

  if (
    display === "table-row" ||
    display === "table-group" ||
    display === "table-column"
  ) {
    return getStyle(element, "visibility") !== "collapsed";
  }

  return true;
};
const isCompliant = (document) => {
  // Note: document.compatMode can be toggle at runtime by document.write
  const isStandardsMode = /^CSS1/.test(document.compatMode);
  if (isStandardsMode) {
    return testScrollCompliance(document);
  }
  return false;
};
const testScrollCompliance = (document) => {
  const iframe = document.createElement("iframe");
  iframe.style.height = "1px";
  const parentNode = document.body || document.documentElement || document;
  parentNode.appendChild(iframe);
  const iframeDocument = iframe.contentWindow.document;
  iframeDocument.write('<!DOCTYPE html><div style="height:9999em">x</div>');
  iframeDocument.close();
  const scrollComplianceResult =
    iframeDocument.documentElement.scrollHeight >
    iframeDocument.body.scrollHeight;
  iframe.parentNode.removeChild(iframe);
  return scrollComplianceResult;
};
const getNextBodyElement = (frameset) => {
  // We use this function to be correct per spec in case `document.body` is
  // a `frameset` but there exists a later `body`. Since `document.body` is
  // a `frameset`, we know the root is an `html`, and there was no `body`
  // before the `frameset`, so we just need to look at siblings after the
  // `frameset`.
  let current = frameset;
  while ((current = current.nextSibling)) {
    if (current.nodeType === 1 && isBodyElement(current)) {
      return current;
    }
  }
  return null;
};
const isBodyElement = (element) => element.ownerDocument.body === element;
const bodyIsScrollable = (body) => {
  // a body element is scrollable if body and html are scrollable and rendered
  if (!isScrollable(body)) {
    return false;
  }
  if (isHidden(body)) {
    return false;
  }

  const documentElement = body.ownerDocument.documentElement;
  if (!isScrollable(documentElement)) {
    return false;
  }
  if (isHidden(documentElement)) {
    return false;
  }

  return true;
};

// https://developer.mozilla.org/en-US/docs/Glossary/Scroll_container


const { documentElement: documentElement$2 } = document;

const getScrollContainer = (arg, { includeHidden } = {}) => {
  if (typeof arg !== "object" || arg.nodeType !== 1) {
    throw new TypeError("getScrollContainer first argument must be DOM node");
  }
  const element = arg;
  if (element === document) {
    return null;
  }
  if (element === documentElement$2) {
    if (isScrollable(element, { includeHidden })) {
      return element;
    }
    return null;
  }
  const position = getStyle(element, "position");
  if (position === "fixed") {
    return getScrollingElement(element.ownerDocument);
  }
  return (
    findScrollContainer(element, { includeHidden }) ||
    getScrollingElement(element.ownerDocument)
  );
};

const findScrollContainer = (element, { includeHidden } = {}) => {
  const position = getStyle(element, "position");
  let parent = element.parentNode;
  // Si l'élément est en position absolute, d'abord trouver le premier parent positionné
  if (position === "absolute") {
    while (parent && parent !== document) {
      if (parent === documentElement$2) {
        break; // documentElement est considéré comme positionné
      }
      const parentPosition = getStyle(parent, "position");
      if (parentPosition !== "static") {
        break; // Trouvé le premier parent positionné
      }
      parent = parent.parentNode;
    }
  }

  // Maintenant chercher le premier parent scrollable à partir du parent positionné
  while (parent) {
    if (parent === document) {
      return null;
    }
    if (isScrollable(parent, { includeHidden })) {
      return parent;
    }
    parent = parent.parentNode;
  }
  return null;
};

/**
 * Creates intuitive scrolling behavior when scrolling over an element that needs to stay interactive
 * (we can't use pointer-events: none). Instead of scrolling the document unexpectedly,
 * finds and scrolls the appropriate scrollable container behind the overlay.
 */


const allowWheelThrough = (element, connectedElement) => {
  const isElementOrDescendant = (possibleDescendant) => {
    return (
      possibleDescendant === element || element.contains(possibleDescendant)
    );
  };
  const tryToScrollOne = (element, wheelEvent) => {
    if (element === document.documentElement) {
      // let browser handle document scrolling
      return true;
    }

    const { deltaX, deltaY } = wheelEvent;
    // we found what we want: a scrollable container behind the element
    // we try to scroll it.
    const elementCanApplyScrollDeltaX =
      deltaX && canApplyScrollDelta(element, deltaX, "x");
    const elementCanApplyScrollDeltaY =
      deltaY && canApplyScrollDelta(element, deltaY, "y");
    if (!elementCanApplyScrollDeltaX && !elementCanApplyScrollDeltaY) {
      return false;
    }
    if (!isScrollable(element)) {
      return false;
    }
    const belongsToElement = isElementOrDescendant(element);
    if (belongsToElement) {
      // let browser handle the scroll on the element itself
      return true;
    }
    wheelEvent.preventDefault();
    applyWheelScrollThrough(element, wheelEvent);
    return true;
  };

  if (connectedElement) {
    const onWheel = (wheelEvent) => {
      const connectedScrollContainer = getScrollContainer(connectedElement);
      if (connectedScrollContainer === document.documentElement) {
        // the connected scrollable parent is the document
        // there is nothing to do, browser native scroll will work as we want
        return;
      }

      const elementsBehindMouse = document.elementsFromPoint(
        wheelEvent.clientX,
        wheelEvent.clientY,
      );
      for (const elementBehindMouse of elementsBehindMouse) {
        // try to scroll element itself
        if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
          return;
        }
        const belongsToElement = isElementOrDescendant(elementBehindMouse);
        // try to scroll what is behind
        if (!belongsToElement) {
          break;
        }
      }
      // At this stage the element has no scrollable parts
      // we can try to scroll the connected scrollable parent
      tryToScrollOne(connectedScrollContainer, wheelEvent);
    };
    element.addEventListener("wheel", onWheel);
    return;
  }

  const onWheel = (wheelEvent) => {
    const elementsBehindMouse = document.elementsFromPoint(
      wheelEvent.clientX,
      wheelEvent.clientY,
    );
    for (const elementBehindMouse of elementsBehindMouse) {
      // try to scroll element itself
      if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
        return;
      }
      const belongsToElement = isElementOrDescendant(elementBehindMouse);
      if (belongsToElement) {
        // keep searching if something in our element is scrollable
        continue;
      }
      // our element is not scrollable, try to scroll the container behind the mouse
      const scrollContainer = getScrollContainer(elementBehindMouse);
      if (tryToScrollOne(scrollContainer, wheelEvent)) {
        return;
      }
    }
  };
  element.addEventListener("wheel", onWheel);
};

const canApplyScrollDelta = (element, delta, axis) => {
  const {
    clientWidth,
    clientHeight,
    scrollWidth,
    scrollHeight,
    scrollLeft,
    scrollTop,
  } = element;

  let size = axis === "x" ? clientWidth : clientHeight;
  let currentScroll = axis === "x" ? scrollLeft : scrollTop;
  let scrollEnd = axis === "x" ? scrollWidth : scrollHeight;

  if (size === scrollEnd) {
    // when scrollWidth === clientWidth, there is no scroll to apply
    return false;
  }
  if (delta < 0 && currentScroll <= 0) {
    // when scrollLeft is 0, we can't scroll to the left
    return false;
  }
  if (delta > 0 && currentScroll + size >= scrollEnd) {
    // when scrollLeft + size >= scrollWidth, we can't scroll to the right
    return false;
  }
  return true;
};

const applyWheelScrollThrough = (element, wheelEvent) => {
  wheelEvent.preventDefault();
  element.scrollBy({
    top: wheelEvent.deltaY,
    left: wheelEvent.deltaX,
    behavior: wheelEvent.deltaMode === 0 ? "auto" : "smooth", // optional tweak
  });
};

const findSelfOrAncestorFixedPosition = (element) => {
  let current = element;
  while (true) {
    const computedStyle = window.getComputedStyle(current);
    if (computedStyle.position === "fixed") {
      const { left, top } = current.getBoundingClientRect();
      return [left, top];
    }
    current = current.parentElement;
    if (!current || current === document.documentElement) {
      break;
    }
  }
  return null;
};

/**
 * Creates a coordinate system positioner for drag operations.
 *
 * ARCHITECTURE:
 * This function uses a modular offset-based approach to handle coordinate system conversions
 * between different positioning contexts (scroll containers and positioned parents).
 *
 * The system decomposes coordinate conversion into two types of offsets:
 * 1. Position offsets - compensate for different positioned parents
 * 2. Scroll offsets - handle scroll position and container differences
 *
 * COORDINATE SYSTEM:
 * - Input coordinates are relative to the reference element's scroll container
 * - Output coordinates are relative to the element's positioned parent for DOM positioning
 * - Handles cross-coordinate system scenarios (different scroll containers and positioned parents)
 *
 * KEY SCENARIOS SUPPORTED:
 * 1. Same positioned parent, same scroll container - Simple case, minimal offsets
 * 2. Different positioned parents, same scroll container - Position offset compensation
 * 3. Same positioned parent, different scroll containers - Scroll offset handling
 * 4. Different positioned parents, different scroll containers - Full offset compensation
 * 5. Overlay elements - Special handling for elements with data-overlay-for attribute
 * 6. Fixed positioning - Special scroll offset handling for fixed positioned elements
 *
 * API CONTRACT:
 * Returns [scrollableLeft, scrollableTop, convertScrollablePosition] where:
 *
 * - scrollableLeft/scrollableTop:
 *   Current element coordinates in the reference coordinate system (adjusted for position offsets)
 *
 * - convertScrollablePosition:
 *   Converts reference coordinate system positions to DOM positioning coordinates
 *   Applies both position and scroll offsets for accurate element placement
 *
 * IMPLEMENTATION STRATEGY:
 * Uses factory functions to create specialized offset calculators based on the specific
 * combination of positioning contexts, optimizing for performance and code clarity.
 */

const createDragElementPositioner = (
  element,
  referenceElement,
  elementToMove,
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  const positionedParent = elementToMove
    ? elementToMove.offsetParent
    : element.offsetParent;
  const scrollContainer = getScrollContainer(element);
  const [getPositionOffsets, getScrollOffsets] = createGetOffsets({
    positionedParent,
    referencePositionedParent: referenceElement
      ? referenceElement.offsetParent
      : undefined,
    scrollContainer,
    referenceScrollContainer: referenceElement
      ? getScrollContainer(referenceElement)
      : undefined,
  });

  {
    [scrollableLeft, scrollableTop] = getScrollablePosition(
      element,
      scrollContainer,
    );
    const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
    scrollableLeft += positionOffsetLeft;
    scrollableTop += positionOffsetTop;
  }
  {
    convertScrollablePosition = (
      scrollableLeftToConvert,
      scrollableTopToConvert,
    ) => {
      const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
      const [scrollOffsetLeft, scrollOffsetTop] = getScrollOffsets();

      const positionedLeftWithoutScroll =
        scrollableLeftToConvert + positionOffsetLeft;
      const positionedTopWithoutScroll =
        scrollableTopToConvert + positionOffsetTop;
      const positionedLeft = positionedLeftWithoutScroll + scrollOffsetLeft;
      const positionedTop = positionedTopWithoutScroll + scrollOffsetTop;

      return [positionedLeft, positionedTop];
    };
  }
  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};

const getScrollablePosition = (element, scrollContainer) => {
  const { left: elementViewportLeft, top: elementViewportTop } =
    element.getBoundingClientRect();
  const scrollContainerIsDocument = scrollContainer === documentElement$1;
  if (scrollContainerIsDocument) {
    return [elementViewportLeft, elementViewportTop];
  }
  const { left: scrollContainerLeft, top: scrollContainerTop } =
    scrollContainer.getBoundingClientRect();
  const scrollableLeft = elementViewportLeft - scrollContainerLeft;
  const scrollableTop = elementViewportTop - scrollContainerTop;

  return [scrollableLeft, scrollableTop];
};

const createGetOffsets = ({
  positionedParent,
  referencePositionedParent = positionedParent,
  scrollContainer,
  referenceScrollContainer = scrollContainer,
}) => {
  const samePositionedParent = positionedParent === referencePositionedParent;
  const getScrollOffsets = createGetScrollOffsets(
    scrollContainer,
    referenceScrollContainer,
    positionedParent,
    samePositionedParent,
  );

  if (samePositionedParent) {
    return [() => [0, 0], getScrollOffsets];
  }

  // parents are different, oh boy let's go
  // The overlay case is problematic because the overlay adjust its position to the target dynamically
  // This creates something complex to support properly.
  // When overlay is fixed we there will never be any offset
  // When overlay is absolute there is a diff relative to the scroll
  // and eventually if the overlay is positioned differently than the other parent
  if (isOverlayOf(positionedParent, referencePositionedParent)) {
    return createGetOffsetsForOverlay(
      positionedParent,
      referencePositionedParent,
      {
        scrollContainer,
        referenceScrollContainer,
        getScrollOffsets,
      },
    );
  }
  if (isOverlayOf(referencePositionedParent, positionedParent)) {
    return createGetOffsetsForOverlay(
      referencePositionedParent,
      positionedParent,
      {
        scrollContainer,
        referenceScrollContainer,
        getScrollOffsets,
      },
    );
  }
  const scrollContainerIsDocument = scrollContainer === documentElement$1;
  if (scrollContainerIsDocument) {
    // Document case: getBoundingClientRect already includes document scroll effects
    // Add current scroll position to get the static offset
    const getPositionOffsetsDocumentScrolling = () => {
      const { scrollLeft: documentScrollLeft, scrollTop: documentScrollTop } =
        scrollContainer;
      const aRect = positionedParent.getBoundingClientRect();
      const bRect = referencePositionedParent.getBoundingClientRect();
      const aLeft = aRect.left;
      const aTop = aRect.top;
      const bLeft = bRect.left;
      const bTop = bRect.top;
      const aLeftDocument = documentScrollLeft + aLeft;
      const aTopDocument = documentScrollTop + aTop;
      const bLeftDocument = documentScrollLeft + bLeft;
      const bTopDocument = documentScrollTop + bTop;
      const offsetLeft = bLeftDocument - aLeftDocument;
      const offsetTop = bTopDocument - aTopDocument;
      return [offsetLeft, offsetTop];
    };
    return [getPositionOffsetsDocumentScrolling, getScrollOffsets];
  }
  // Custom scroll container case: account for container's position and scroll
  const getPositionOffsetsCustomScrollContainer = () => {
    const aRect = positionedParent.getBoundingClientRect();
    const bRect = referencePositionedParent.getBoundingClientRect();
    const aLeft = aRect.left;
    const aTop = aRect.top;
    const bLeft = bRect.left;
    const bTop = bRect.top;

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const offsetLeft =
      bLeft - aLeft + scrollContainer.scrollLeft - scrollContainerRect.left;
    const offsetTop =
      bTop - aTop + scrollContainer.scrollTop - scrollContainerRect.top;
    return [offsetLeft, offsetTop];
  };
  return [getPositionOffsetsCustomScrollContainer, getScrollOffsets];
};
const createGetOffsetsForOverlay = (
  overlay,
  overlayTarget,
  { scrollContainer, referenceScrollContainer, getScrollOffsets },
) => {
  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const referenceScrollContainerIsDocument =
    referenceScrollContainer === documentElement$1;

  if (getComputedStyle(overlay).position === "fixed") {
    if (referenceScrollContainerIsDocument) {
      const getPositionOffsetsFixedOverlay = () => {
        return [0, 0];
      };
      return [getPositionOffsetsFixedOverlay, getScrollOffsets];
    }
    const getPositionOffsetsFixedOverlay = () => {
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      const referenceScrollContainerRect =
        referenceScrollContainer.getBoundingClientRect();
      let offsetLeftBetweenScrollContainers =
        referenceScrollContainerRect.left - scrollContainerRect.left;
      let offsetTopBetweenScrollContainers =
        referenceScrollContainerRect.top - scrollContainerRect.top;
      if (scrollContainerIsDocument) {
        offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
        offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
      }
      return [
        -offsetLeftBetweenScrollContainers,
        -offsetTopBetweenScrollContainers,
      ];
    };
    return [getPositionOffsetsFixedOverlay, getScrollOffsets];
  }

  const getPositionOffsetsOverlay = () => {
    if (sameScrollContainer) {
      const overlayRect = overlay.getBoundingClientRect();
      const overlayTargetRect = overlayTarget.getBoundingClientRect();
      const overlayLeft = overlayRect.left;
      const overlayTop = overlayRect.top;
      let overlayTargetLeft = overlayTargetRect.left;
      let overlayTargetTop = overlayTargetRect.top;
      if (scrollContainerIsDocument) {
        overlayTargetLeft += scrollContainer.scrollLeft;
        overlayTargetTop += scrollContainer.scrollTop;
      }
      const offsetLeftBetweenTargetAndOverlay = overlayTargetLeft - overlayLeft;
      const offsetTopBetweenTargetAndOverlay = overlayTargetTop - overlayTop;
      return [
        -scrollContainer.scrollLeft + offsetLeftBetweenTargetAndOverlay,
        -scrollContainer.scrollTop + offsetTopBetweenTargetAndOverlay,
      ];
    }

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();
    let scrollContainerLeft = scrollContainerRect.left;
    let scrollContainerTop = scrollContainerRect.top;
    let referenceScrollContainerLeft = referenceScrollContainerRect.left;
    let referenceScrollContainerTop = referenceScrollContainerRect.top;
    if (scrollContainerIsDocument) {
      scrollContainerLeft += scrollContainer.scrollLeft;
      scrollContainerTop += scrollContainer.scrollTop;
    }
    const offsetLeftBetweenScrollContainers =
      referenceScrollContainerLeft - scrollContainerLeft;
    const offsetTopBetweenScrollContainers =
      referenceScrollContainerTop - scrollContainerTop;
    return [
      -offsetLeftBetweenScrollContainers - referenceScrollContainer.scrollLeft,
      -offsetTopBetweenScrollContainers - referenceScrollContainer.scrollTop,
    ];
  };
  const getScrollOffsetsOverlay = () => {
    if (sameScrollContainer) {
      return [scrollContainer.scrollLeft, scrollContainer.scrollTop];
    }

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();
    let offsetLeftBetweenScrollContainers =
      referenceScrollContainerRect.left - scrollContainerRect.left;
    let offsetTopBetweenScrollContainers =
      referenceScrollContainerRect.top - scrollContainerRect.top;
    if (scrollContainerIsDocument) {
      offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
      offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
    }

    return [
      referenceScrollContainer.scrollLeft + offsetLeftBetweenScrollContainers,
      referenceScrollContainer.scrollTop + offsetTopBetweenScrollContainers,
    ];
  };
  return [getPositionOffsetsOverlay, getScrollOffsetsOverlay];
};
const isOverlayOf = (element, potentialTarget) => {
  const overlayForAttribute = element.getAttribute("data-overlay-for");
  if (!overlayForAttribute) {
    return false;
  }
  const overlayTarget = document.querySelector(`#${overlayForAttribute}`);
  if (!overlayTarget) {
    return false;
  }
  if (overlayTarget === potentialTarget) {
    return true;
  }
  const overlayTargetPositionedParent = overlayTarget.offsetParent;
  if (overlayTargetPositionedParent === potentialTarget) {
    return true;
  }
  return false;
};

const { documentElement: documentElement$1 } = document;
const createGetScrollOffsets = (
  scrollContainer,
  referenceScrollContainer,
  positionedParent,
  samePositionedParent,
) => {
  const getGetScrollOffsetsSameContainer = () => {
    const scrollContainerIsDocument = scrollContainer === documentElement$1;
    // I don't really get why we have to add scrollLeft (scrollLeft at grab)
    // to properly position the element in this scenario
    // It happens since we use translateX to position the element
    // Or maybe since something else. In any case it works
    const { scrollLeft, scrollTop } = samePositionedParent
      ? { scrollLeft: 0, scrollTop: 0 }
      : referenceScrollContainer;
    if (scrollContainerIsDocument) {
      const fixedPosition = findSelfOrAncestorFixedPosition(positionedParent);
      if (fixedPosition) {
        const getScrollOffsetsFixed = () => {
          const leftScrollToAdd = scrollLeft + fixedPosition[0];
          const topScrollToAdd = scrollTop + fixedPosition[1];
          return [leftScrollToAdd, topScrollToAdd];
        };
        return getScrollOffsetsFixed;
      }
    }
    const getScrollOffsets = () => {
      const leftScrollToAdd = scrollLeft + referenceScrollContainer.scrollLeft;
      const topScrollToAdd = scrollTop + referenceScrollContainer.scrollTop;
      return [leftScrollToAdd, topScrollToAdd];
    };
    return getScrollOffsets;
  };

  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const getScrollOffsetsSameContainer = getGetScrollOffsetsSameContainer();
  if (sameScrollContainer) {
    return getScrollOffsetsSameContainer;
  }
  const getScrollOffsetsDifferentContainers = () => {
    const [scrollLeftToAdd, scrollTopToAdd] = getScrollOffsetsSameContainer();
    const rect = scrollContainer.getBoundingClientRect();
    const referenceRect = referenceScrollContainer.getBoundingClientRect();
    const leftDiff = referenceRect.left - rect.left;
    const topDiff = referenceRect.top - rect.top;
    return [scrollLeftToAdd + leftDiff, scrollTopToAdd + topDiff];
  };
  return getScrollOffsetsDifferentContainers;
};

/**
 * Isolates user interactions to only the specified elements, making everything else non-interactive.
 *
 * This creates a controlled interaction environment where only the target elements (and their ancestors)
 * can receive user input like clicks, keyboard events, focus, etc. All other DOM elements become
 * non-interactive, preventing conflicting or unwanted interactions during critical operations
 * like drag gestures, modal dialogs, or complex UI states.
 *
 * The function uses the `inert` attribute to achieve this isolation, applying it strategically
 * to parts of the DOM tree while preserving the interactive elements and their ancestor chains.
 *
 * Example DOM structure and inert application:
 *
 * Before calling isolateInteractions:
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>
 *       <span>some content</span>
 *       <div class="modal">modal content</div>
 *       <span>more content</span>
 *     </div>
 *     <aside inert>already inert</aside>
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * After calling isolateInteractions([modal, dropdown]):
 * ```
 * <body>
 *   <header inert>...</header>  ← made inert (no active descendants)
 *   <main> ← not inert because it contains active elements
 *     <div> ← not inert because it contains .modal
 *       <span inert>some content</span> ← made inert selectively
 *       <div class="modal">modal content</div> ← stays active
 *       <span inert>more content</span> ← made inert selectively
 *     </div>
 *     <aside inert>already inert</aside>
 *     <div class="dropdown">dropdown menu</div> ← stays active
 *   </main>
 *   <footer inert>...</footer>
 * </body>
 * ```
 *
 * After calling cleanup():
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>
 *       <span>some content</span>
 *       <div class="modal">modal content</div>
 *       <span>more content</span>
 *     </div>
 *     <aside inert>already inert</aside> ← [inert] preserved
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * @param {Array<Element>} elements - Array of elements to keep interactive (non-inert)
 * @returns {Function} cleanup - Function to restore original inert states
 */
const isolateInteractions = (elements) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const toKeepInteractiveSet = new Set();
  const keepSelfAndAncestors = (el) => {
    if (toKeepInteractiveSet.has(el)) {
      return;
    }
    const associatedElements = getAssociatedElements(el);
    if (associatedElements) {
      for (const associatedElement of associatedElements) {
        keepSelfAndAncestors(associatedElement);
      }
    }

    // Add the element itself
    toKeepInteractiveSet.add(el);
    // Add all its ancestors up to document.body
    let ancestor = el.parentNode;
    while (ancestor && ancestor !== document.body) {
      toKeepInteractiveSet.add(ancestor);
      ancestor = ancestor.parentNode;
    }
  };

  // Build set of elements to keep interactive
  for (const element of elements) {
    keepSelfAndAncestors(element);
  }
  // backdrop elements are meant to control interactions happening at document level
  // and should stay interactive
  const backdropElements = document.querySelectorAll("[data-backdrop]");
  for (const backdropElement of backdropElements) {
    keepSelfAndAncestors(backdropElement);
  }

  const setInert = (el) => {
    if (toKeepInteractiveSet.has(el)) {
      // element should stay interactive
      return;
    }
    const restoreAttributes = setAttributes(el, {
      inert: "",
    });
    cleanupCallbackSet.add(() => {
      restoreAttributes();
    });
  };

  const makeElementInertSelectivelyOrCompletely = (el) => {
    // If this element should stay interactive, keep it active
    if (toKeepInteractiveSet.has(el)) {
      return;
    }

    // Since we put all ancestors in toKeepInteractiveSet, if this element
    // is not in the set, we can check if any of its direct children are.
    // If none of the direct children are in the set, then no descendants are either.
    const children = Array.from(el.children);
    const hasInteractiveChildren = children.some((child) =>
      toKeepInteractiveSet.has(child),
    );

    if (!hasInteractiveChildren) {
      // No interactive descendants, make the entire element inert
      setInert(el);
      return;
    }

    // Some children need to stay interactive, process them selectively
    for (const child of children) {
      makeElementInertSelectivelyOrCompletely(child);
    }
  };

  // Apply inert to all top-level elements that aren't in our keep-interactive set
  const bodyChildren = Array.from(document.body.children);
  for (const child of bodyChildren) {
    makeElementInertSelectivelyOrCompletely(child);
  }

  return () => {
    cleanup();
  };
};

installImportMetaCss(import.meta);
const createDragGestureController = (options = {}) => {
  const {
    name,
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    threshold = 5,
    direction: defaultDirection = { x: true, y: true },
    documentInteractions = "auto",
    backdrop = true,
    backdropZIndex = 999999,
  } = options;

  const dragGestureController = {
    grab: null,
    gravViaPointer: null,
  };

  const grab = ({
    element,
    direction = defaultDirection,
    event = new CustomEvent("programmatic"),
    grabX = 0,
    grabY = 0,
    cursor = "grabbing",
    scrollContainer = document.documentElement,
    layoutScrollableLeft: scrollableLeftAtGrab = 0,
    layoutScrollableTop: scrollableTopAtGrab = 0,
  } = {}) => {
    if (!element) {
      throw new Error("element is required");
    }
    if (!direction.x && !direction.y) {
      return null;
    }

    const [publishBeforeDrag, addBeforeDragCallback] = createPubSub();
    const [publishDrag, addDragCallback] = createPubSub();
    const [publishRelease, addReleaseCallback] = createPubSub();
    if (onDrag) {
      addDragCallback(onDrag);
    }
    if (onRelease) {
      addReleaseCallback(onRelease);
    }

    const scrollLeftAtGrab = scrollContainer.scrollLeft;
    const scrollTopAtGrab = scrollContainer.scrollTop;
    const leftAtGrab = scrollLeftAtGrab + scrollableLeftAtGrab;
    const topAtGrab = scrollTopAtGrab + scrollableTopAtGrab;
    const createLayout = (x, y) => {
      const { scrollLeft, scrollTop } = scrollContainer;
      const left = scrollableLeftAtGrab + x;
      const top = scrollableTopAtGrab + y;
      const scrollableLeft = left - scrollLeft;
      const scrollableTop = top - scrollTop;
      const layoutProps = {
        // Raw input coordinates (dragX - grabX + scrollContainer.scrollLeft)
        x,
        y,
        // container scrolls when layout is created
        scrollLeft,
        scrollTop,
        // Position relative to container excluding scrolls
        scrollableLeft,
        scrollableTop,
        // Position relative to container including scrolls
        left,
        top,
        // Delta since grab (number representing how much we dragged)
        xDelta: left - leftAtGrab,
        yDelta: top - topAtGrab,
      };
      return layoutProps;
    };

    const grabLayout = createLayout(
      grabX + scrollContainer.scrollLeft,
      grabY + scrollContainer.scrollTop,
    );
    const gestureInfo = {
      name,
      direction,
      started: !threshold,
      status: "grabbed",

      element,
      scrollContainer,
      grabX, // x grab coordinate (excluding scroll)
      grabY, // y grab coordinate (excluding scroll)
      grabLayout,
      leftAtGrab,
      topAtGrab,

      dragX: grabX, // coordinate of the last drag (excluding scroll of the scrollContainer)
      dragY: grabY, // coordinate of the last drag (excluding scroll of the scrollContainer)
      layout: grabLayout,

      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,

      // metadata about interaction sources
      grabEvent: event,
      dragEvent: null,
      releaseEvent: null,
    };
    definePropertyAsReadOnly(gestureInfo, "name");
    definePropertyAsReadOnly(gestureInfo, "direction");
    definePropertyAsReadOnly(gestureInfo, "scrollContainer");
    definePropertyAsReadOnly(gestureInfo, "grabX");
    definePropertyAsReadOnly(gestureInfo, "grabY");
    definePropertyAsReadOnly(gestureInfo, "grabLayout");
    definePropertyAsReadOnly(gestureInfo, "leftAtGrab");
    definePropertyAsReadOnly(gestureInfo, "topAtGrab");
    definePropertyAsReadOnly(gestureInfo, "grabEvent");

    document_interactions: {
      if (documentInteractions === "manual") {
        break document_interactions;
      }
      /*
      GOAL: Take control of document-level interactions during drag gestures
      
      WHY: During drag operations, we need to prevent conflicting user interactions that would:
      1. Interfere with the drag gesture (competing pointer events, focus changes)
      2. Break the visual feedback (inconsistent cursors, hover states)
      3. Cause unwanted scrolling (keyboard shortcuts, wheel events in restricted directions)
      4. Create accessibility issues (focus jumping, screen reader confusion)

      STRATEGY: Create a controlled interaction environment by:
      1. VISUAL CONTROL: Use a backdrop to unify cursor appearance and block pointer events
      2. INTERACTION ISOLATION: Make non-dragged elements inert to prevent interference
      3. FOCUS MANAGEMENT: Control focus location and prevent focus changes during drag
      4. SELECTIVE SCROLLING: Allow scrolling only in directions supported by the drag gesture

      IMPLEMENTATION:
      */

      // 1. INTERACTION ISOLATION: Make everything except the dragged element inert
      // This prevents keyboard events, pointer interactions, and screen reader navigation
      // on non-relevant elements during the drag operation
      const cleanupInert = isolateInteractions([
        element,
        ...Array.from(document.querySelectorAll("[data-droppable]")),
      ]);
      addReleaseCallback(() => {
        cleanupInert();
      });

      // 2. VISUAL CONTROL: Backdrop for consistent cursor and pointer event blocking
      if (backdrop) {
        const backdropElement = document.createElement("div");
        backdropElement.className = "navi_drag_gesture_backdrop";
        backdropElement.ariaHidden = "true";
        backdropElement.setAttribute("data-backdrop", "");
        backdropElement.style.zIndex = backdropZIndex;
        backdropElement.style.cursor = cursor;

        // Handle wheel events on backdrop for directionally-constrained drag gestures
        // (e.g., table column resize should only allow horizontal scrolling)
        if (!direction.x || !direction.y) {
          backdropElement.onwheel = (e) => {
            e.preventDefault();
            const scrollX = direction.x ? e.deltaX : 0;
            const scrollY = direction.y ? e.deltaY : 0;
            scrollContainer.scrollBy({
              left: scrollX,
              top: scrollY,
              behavior: "auto",
            });
          };
        }
        document.body.appendChild(backdropElement);
        addReleaseCallback(() => {
          backdropElement.remove();
        });
      }

      // 3. FOCUS MANAGEMENT: Control and stabilize focus during drag
      const { activeElement } = document;
      const focusableElement = findFocusable(element);
      // Focus the dragged element (or document.body as fallback) to establish clear focus context
      // This also ensure any keydown event listened by the currently focused element
      // won't be available during drag
      const elementToFocus = focusableElement || document.body;
      elementToFocus.focus({
        preventScroll: true,
      });
      addReleaseCallback(() => {
        // Restore original focus on release
        activeElement.focus({
          preventScroll: true,
        });
      });
      // Prevent Tab navigation entirely (focus should stay stable)
      const onkeydown = (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          return;
        }
      };
      document.addEventListener("keydown", onkeydown);
      addReleaseCallback(() => {
        document.removeEventListener("keydown", onkeydown);
      });

      // 4. SELECTIVE SCROLLING: Allow keyboard scrolling only in supported directions
      {
        const onDocumentKeydown = (keyboardEvent) => {
          // Vertical scrolling keys - prevent if vertical movement not supported
          if (
            keyboardEvent.key === "ArrowUp" ||
            keyboardEvent.key === "ArrowDown" ||
            keyboardEvent.key === " " ||
            keyboardEvent.key === "PageUp" ||
            keyboardEvent.key === "PageDown" ||
            keyboardEvent.key === "Home" ||
            keyboardEvent.key === "End"
          ) {
            if (!direction.y) {
              keyboardEvent.preventDefault();
            }
            return;
          }
          // Horizontal scrolling keys - prevent if horizontal movement not supported
          if (
            keyboardEvent.key === "ArrowLeft" ||
            keyboardEvent.key === "ArrowRight"
          ) {
            if (!direction.x) {
              keyboardEvent.preventDefault();
            }
            return;
          }
        };
        document.addEventListener("keydown", onDocumentKeydown);
        addReleaseCallback(() => {
          document.removeEventListener("keydown", onDocumentKeydown);
        });
      }
    }

    // Set up scroll event handling to adjust drag position when scrolling occurs
    {
      let isHandlingScroll = false;
      const handleScroll = (scrollEvent) => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;
        drag(gestureInfo.dragX, gestureInfo.dragY, { event: scrollEvent });
        isHandlingScroll = false;
      };
      const scrollEventReceiver =
        scrollContainer === document.documentElement
          ? document
          : scrollContainer;
      scrollEventReceiver.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      addReleaseCallback(() => {
        scrollEventReceiver.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }

    const determineDragData = ({
      dragX,
      dragY,
      dragEvent,
      isRelease = false,
    }) => {
      // === ÉTAT INITIAL (au moment du grab) ===
      const { grabX, grabY, grabLayout } = gestureInfo;
      // === CE QUI EST DEMANDÉ (où on veut aller) ===
      // Calcul de la direction basé sur le mouvement précédent
      // (ne tient pas compte du mouvement final une fois les contraintes appliquées)
      // (ici on veut connaitre l'intention)
      // on va utiliser cela pour savoir vers où on scroll si nécéssaire par ex
      const currentDragX = gestureInfo.dragX;
      const currentDragY = gestureInfo.dragY;
      const isGoingLeft = dragX < currentDragX;
      const isGoingRight = dragX > currentDragX;
      const isGoingUp = dragY < currentDragY;
      const isGoingDown = dragY > currentDragY;

      const layoutXRequested = direction.x
        ? scrollContainer.scrollLeft + (dragX - grabX)
        : grabLayout.scrollLeft;
      const layoutYRequested = direction.y
        ? scrollContainer.scrollTop + (dragY - grabY)
        : grabLayout.scrollTop;
      const layoutRequested = createLayout(layoutXRequested, layoutYRequested);
      const currentLayout = gestureInfo.layout;
      let layout;
      if (
        layoutRequested.x === currentLayout.x &&
        layoutRequested.y === currentLayout.y
      ) {
        layout = currentLayout;
      } else {
        // === APPLICATION DES CONTRAINTES ===
        let layoutConstrained = layoutRequested;
        const limitLayout = (left, top) => {
          layoutConstrained = createLayout(
            left === undefined
              ? layoutConstrained.x
              : left - scrollableLeftAtGrab,
            top === undefined ? layoutConstrained.y : top - scrollableTopAtGrab,
          );
        };

        publishBeforeDrag(layoutRequested, currentLayout, limitLayout, {
          dragEvent,
          isRelease,
        });
        // === ÉTAT FINAL ===
        layout = layoutConstrained;
      }

      const dragData = {
        dragX,
        dragY,
        layout,

        isGoingLeft,
        isGoingRight,
        isGoingUp,
        isGoingDown,

        status: isRelease ? "released" : "dragging",
        dragEvent: isRelease ? gestureInfo.dragEvent : dragEvent,
        releaseEvent: isRelease ? dragEvent : null,
      };

      if (isRelease) {
        return dragData;
      }
      if (!gestureInfo.started && threshold) {
        const deltaX = Math.abs(dragX - grabX);
        const deltaY = Math.abs(dragY - grabY);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return dragData;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return dragData;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return dragData;
          }
        }
        dragData.started = true;
      }
      return dragData;
    };

    const drag = (
      dragX = gestureInfo.dragX, // Scroll container relative X coordinate
      dragY = gestureInfo.dragY, // Scroll container relative Y coordinate
      { event = new CustomEvent("programmatic"), isRelease = false } = {},
    ) => {

      const dragData = determineDragData({
        dragX,
        dragY,
        dragEvent: event,
        isRelease,
      });
      const startedPrevious = gestureInfo.started;
      const layoutPrevious = gestureInfo.layout;
      // previousGestureInfo = { ...gestureInfo };
      Object.assign(gestureInfo, dragData);
      if (!startedPrevious && gestureInfo.started) {
        onDragStart?.(gestureInfo);
      }
      const someLayoutChange = gestureInfo.layout !== layoutPrevious;
      publishDrag(
        gestureInfo,
        // we still publish drag event even when unchanged
        // because UI might need to adjust when document scrolls
        // even if nothing truly changes visually the element
        // can decide to stick to the scroll for example
        someLayoutChange,
      );
    };

    const release = ({
      event = new CustomEvent("programmatic"),
      releaseX = gestureInfo.dragX,
      releaseY = gestureInfo.dragY,
    } = {}) => {
      drag(releaseX, releaseY, { event, isRelease: true });
      publishRelease(gestureInfo);
    };

    onGrab?.(gestureInfo);
    const dragGesture = {
      gestureInfo,
      addBeforeDragCallback,
      addDragCallback,
      addReleaseCallback,
      drag,
      release,
    };
    return dragGesture;
  };
  dragGestureController.grab = grab;

  const initDragByPointer = (grabEvent, dragOptions, initializer) => {
    if (grabEvent.button !== undefined && grabEvent.button !== 0) {
      return null;
    }
    const target = grabEvent.target;
    if (!target.closest) {
      // target is a text node
      return null;
    }
    const mouseEventCoords = (mouseEvent) => {
      const { clientX, clientY } = mouseEvent;
      return [clientX, clientY];
    };
    const [grabX, grabY] = mouseEventCoords(grabEvent);
    const dragGesture = dragGestureController.grab({
      grabX,
      grabY,
      event: grabEvent,
      ...dragOptions,
    });
    const dragViaPointer = (dragEvent) => {
      const [mouseDragX, mouseDragY] = mouseEventCoords(dragEvent);
      dragGesture.drag(mouseDragX, mouseDragY, {
        event: dragEvent,
      });
    };
    const releaseViaPointer = (mouseupEvent) => {
      const [mouseReleaseX, mouseReleaseY] = mouseEventCoords(mouseupEvent);
      dragGesture.release({
        event: mouseupEvent,
        releaseX: mouseReleaseX,
        releaseY: mouseReleaseY,
      });
    };
    dragGesture.dragViaPointer = dragViaPointer;
    dragGesture.releaseViaPointer = releaseViaPointer;
    const cleanup = initializer({
      onMove: dragViaPointer,
      onRelease: releaseViaPointer,
    });
    dragGesture.addReleaseCallback(() => {
      cleanup();
    });
    return dragGesture;
  };

  const grabViaPointer = (grabEvent, options) => {
    if (grabEvent.type === "pointerdown") {
      return initDragByPointer(grabEvent, options, ({ onMove, onRelease }) => {
        const target = grabEvent.target;
        target.setPointerCapture(grabEvent.pointerId);
        target.addEventListener("lostpointercapture", onRelease);
        target.addEventListener("pointercancel", onRelease);
        target.addEventListener("pointermove", onMove);
        target.addEventListener("pointerup", onRelease);
        return () => {
          target.releasePointerCapture(grabEvent.pointerId);
          target.removeEventListener("lostpointercapture", onRelease);
          target.removeEventListener("pointercancel", onRelease);
          target.removeEventListener("pointermove", onMove);
          target.removeEventListener("pointerup", onRelease);
        };
      });
    }
    if (grabEvent.type === "mousedown") {
      console.warn(
        `Received "mousedown" event, "pointerdown" events are recommended to perform drag gestures.`,
      );
      return initDragByPointer(grabEvent, options, ({ onMove, onRelease }) => {
        const onPointerUp = (pointerEvent) => {
          // <button disabled> for example does not emit mouseup if we release mouse over it
          // -> we add "pointerup" to catch mouseup occuring on disabled element
          if (pointerEvent.pointerType === "mouse") {
            onRelease(pointerEvent);
          }
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onRelease);
        document.addEventListener("pointerup", onPointerUp);
        return () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onRelease);
          document.removeEventListener("pointerup", onPointerUp);
        };
      });
    }
    throw new Error(
      `Unsupported "${grabEvent.type}" evenet passed to grabViaPointer. "pointerdown" was expected.`,
    );
  };
  dragGestureController.grabViaPointer = grabViaPointer;

  return dragGestureController;
};

const dragAfterThreshold = (
  grabEvent,
  dragGestureInitializer,
  threshold,
) => {
  const significantDragGestureController = createDragGestureController({
    threshold,
    // allow interaction for this intermediate gesture:
    // user should still be able to scroll or interact with the document
    // only once the gesture is significant we take control
    documentInteractions: "manual",
    onDragStart: (gestureInfo) => {
      significantDragGesture.release(); // kill that gesture
      const dragGesture = dragGestureInitializer();
      dragGesture.dragViaPointer(gestureInfo.dragEvent);
    },
  });
  const significantDragGesture =
    significantDragGestureController.grabViaPointer(grabEvent, {
      element: grabEvent.target,
    });
};

const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName],
  });
};

import.meta.css = /* css */ `
  .navi_drag_gesture_backdrop {
    position: fixed;
    inset: 0;
    user-select: none;
  }
`;

const getBorderSizes = (element) => {
  const {
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    borderBottomWidth,
  } = window.getComputedStyle(element, null);
  return {
    left: parseFloat(borderLeftWidth),
    right: parseFloat(borderRightWidth),
    top: parseFloat(borderTopWidth),
    bottom: parseFloat(borderBottomWidth),
  };
};

/**
 * DOM Coordinate Systems: The Missing APIs Problem
 *
 * When positioning and moving DOM elements, we commonly need coordinate information.
 * The web platform provides getBoundingClientRect() which gives viewport-relative coordinates,
 * but this creates several challenges when working with scrollable containers:
 *
 * ## The Problem
 *
 * 1. **Basic positioning**: getBoundingClientRect() works great for viewport-relative positioning
 * 2. **Document scrolling**: When document has scroll, we add document.scrollLeft/scrollTop
 * 3. **Scroll containers**: When elements are inside scrollable containers, we need coordinates
 *    relative to that container, not the document
 *
 * ## Missing Browser APIs
 *
 * The web platform lacks essential APIs for scroll container workflows:
 * - No equivalent of getBoundingClientRect() relative to scroll container
 * - No built-in way to get element coordinates in scroll container space
 * - Manual coordinate conversion is error-prone and inconsistent
 *
 * ## This Module's Solution
 *
 * This module provides the missing coordinate APIs that work seamlessly with scroll containers:
 * - **getScrollRelativeRect()**: element rect relative to scroll container (PRIMARY API)
 * - **getMouseEventScrollRelativeRect()**: Mouse coordinates in scroll container space
 * - **convertScrollRelativeRectInto()**: Convert scroll-relative rect to element positioning coordinates
 *
 * These APIs abstract away the complexity of coordinate system conversion and provide
 * a consistent interface for element positioning regardless of scroll container depth.
 *
 * ## Primary API: getScrollRelativeRect()
 *
 * This is the main API you want - element rectangle relative to scroll container:
 *
 * ```js
 * const rect = element.getBoundingClientRect(); // viewport-relative
 * const scrollRect = getScrollRelativeRect(element, scrollContainer); // scroll-relative
 * ```
 *
 * Returns: { left, top, right, bottom, width, height, scrollLeft, scrollTop, scrollContainer, ...metadata }
 *
 * The scroll values are included so you can calculate scroll-absolute coordinates yourself:
 * ```js
 * const { left, top, scrollLeft, scrollTop } = getScrollRelativeRect(element);
 * const scrollAbsoluteLeft = left + scrollLeft;
 * const scrollAbsoluteTop = top + scrollTop;
 * ```
 *
 * ## Secondary APIs:
 *
 * - **getMouseEventScrollRelativeRect()**: Get mouse coordinates as a rect in scroll container space
 * - **convertScrollRelativeRectInto()**: Convert from scroll-relative coordinates to element positioning coordinates (for setting element.style.left/top)
 *
 * ## Coordinate System Terminology:
 *
 * - **Viewport-relative**: getBoundingClientRect() coordinates - relative to browser viewport
 * - **Scroll-relative**: Coordinates relative to scroll container (ignoring current scroll position)
 * - **Scroll-absolute**: Scroll-relative + scroll position (element's position in full scrollable content)
 * - **Element coordinates**: Coordinates for positioning elements (via element.style.left/top)
 *
 * ## Legacy Coordinate System Diagrams
 *
 * X-Axis Coordinate Systems in Web Development
 *
 * Diagram showing horizontal positioning and scrollbars:
 *
 * VIEWPORT (visible part of the document)
 * ┌───────────────────────────────────────────────┐
 * │                                               │
 * │                                               │
 * │ container.offsetLeft: 20px                    │
 * │       ┼─────────────────────────────┐         │
 * │       │                             │         │
 * │       │                             │         │
 * │       │  el.offsetLeft: 100px       │         │
 * │       │         ┼─────┐             │         │
 * │       │         │     │             │         │
 * │       │         └─────┘             │         │
 * │       │                             │         │
 * │       │ ░░░███░░░░░░░░░░░░░░░░░░░░░ │         │
 * │       └─────│───────────────────────┘         │
 * │ container.scrollLeft: 50px                    │
 * │                                               │
 * │                                               │
 * │ ░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
 * └─────────│─────────────────────────────────────┘
 *   document.scrollLeft: 200px
 *
 *
 * Left coordinate for the element:
 *
 * Document coordinates (absolute position in full document)
 * • Result: 320px
 * • Detail: container.offsetLeft + element.offsetLeft + document.scrollLeft
 *           20                +  100              + 200               = 320px
 *
 * Viewport coordinates (getBoundingClientRect().left):
 * • Result: 120px
 * • Detail: container.offsetLeft + element.offsetLeft
 *           20                +  100              = 120px
 *
 * Scroll coordinates (position within scroll container):
 * • Result: 50px
 * • Detail: element.offsetLeft - container.scrollLeft
 *           100              - 50                 = 50px
 *
 * Scroll behavior examples:
 *
 * When document scrolls (scrollLeft: 200px → 300px):
 * • Document coordinates: 320px → 420px
 * • Viewport coordinates: 120px → 120px (unchanged)
 * • Scroll coordinates: 50px → 50px (unchanged)
 *
 * When container scrolls (scrollLeft: 50px → 100px):
 * • Document coordinates: 320px → 270px
 * • Viewport coordinates: 120px → 70px
 * • Scroll coordinates: 50px → 0px
 */


const { documentElement } = document;

/**
 * Get element rectangle relative to its scroll container
 *
 * @param {Element} element - The element to get coordinates for
 * @param {Element} [scrollContainer] - Optional scroll container (auto-detected if not provided)
 * @param {object} [options] - Configuration options
 * @returns {object} { left, top, right, bottom, width, height, scrollLeft, scrollTop, scrollContainer, ...metadata }
 */
const getScrollRelativeRect = (
  element,
  scrollContainer = getScrollContainer(element),
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const {
    left: leftViewport,
    top: topViewport,
    width,
    height,
  } = element.getBoundingClientRect();

  let fromFixed = false;
  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;
  const scrollLeft = scrollContainer.scrollLeft;
  const scrollTop = scrollContainer.scrollTop;
  const scrollContainerIsDocument = scrollContainer === documentElement;
  const createScrollRelativeRect = (leftScrollRelative, topScrollRelative) => {
    const isStickyLeftOrHasStickyLeftAttr = Boolean(
      fromStickyLeft || fromStickyLeftAttr,
    );
    const isStickyTopOrHasStickyTopAttr = Boolean(
      fromStickyTop || fromStickyTopAttr,
    );
    return {
      left: leftScrollRelative,
      top: topScrollRelative,
      right: leftScrollRelative + width,
      bottom: topScrollRelative + height,

      // metadata
      width,
      height,
      scrollContainer,
      scrollContainerIsDocument,
      scrollLeft,
      scrollTop,
      fromFixed,
      fromStickyLeft,
      fromStickyTop,
      fromStickyLeftAttr,
      fromStickyTopAttr,
      isStickyLeftOrHasStickyLeftAttr,
      isStickyTopOrHasStickyTopAttr,
      isSticky:
        isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
    };
  };

  {
    const computedStyle = getComputedStyle(element);
    {
      const usePositionSticky = computedStyle.position === "sticky";
      if (usePositionSticky) {
        // For CSS position:sticky elements, use scrollable-relative coordinates
        const [leftScrollRelative, topScrollRelative] =
          viewportPosToScrollRelativePos(
            leftViewport,
            topViewport,
            scrollContainer,
          );
        const isStickyLeft = computedStyle.left !== "auto";
        const isStickyTop = computedStyle.top !== "auto";
        fromStickyLeft = isStickyLeft
          ? { value: parseFloat(computedStyle.left) || 0 }
          : undefined;
        fromStickyTop = isStickyTop
          ? { value: parseFloat(computedStyle.top) || 0 }
          : undefined;
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
    {
      const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
      const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
      const useStickyAttribute =
        hasStickyLeftAttribute || hasStickyTopAttribute;
      if (useStickyAttribute) {
        // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
        // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
        let [leftScrollRelative, topScrollRelative] =
          viewportPosToScrollRelativePos(
            leftViewport,
            topViewport,
            scrollContainer,
          );
        if (hasStickyLeftAttribute) {
          const leftCssValue = parseFloat(computedStyle.left) || 0;
          fromStickyLeftAttr = { value: leftCssValue };
          if (useOriginalPositionEvenIfSticky) ; else {
            const scrollLeft = scrollContainer.scrollLeft;
            const stickyPosition = scrollLeft + leftCssValue;
            const leftWithScroll = leftScrollRelative + scrollLeft;
            if (stickyPosition > leftWithScroll) {
              leftScrollRelative = leftCssValue; // Element is stuck
            }
          }
        }
        if (hasStickyTopAttribute) {
          const topCssValue = parseFloat(computedStyle.top) || 0;
          fromStickyTopAttr = { value: topCssValue };
          if (useOriginalPositionEvenIfSticky) ; else {
            const scrollTop = scrollContainer.scrollTop;
            const stickyPosition = scrollTop + topCssValue;
            const topWithScroll = topScrollRelative + scrollTop;
            if (stickyPosition > topWithScroll) {
              topScrollRelative = topCssValue; // Element is stuck
            }
          }
        }
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
  }

  // For normal elements, use scrollable-relative coordinates
  const [leftScrollRelative, topScrollRelative] =
    viewportPosToScrollRelativePos(leftViewport, topViewport, scrollContainer);
  return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
};
const viewportPosToScrollRelativePos = (
  leftViewport,
  topViewport,
  scrollContainer,
) => {
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    return [leftViewport, topViewport];
  }
  const { left: scrollContainerLeftViewport, top: scrollContainerTopViewport } =
    scrollContainer.getBoundingClientRect();
  return [
    leftViewport - scrollContainerLeftViewport,
    topViewport - scrollContainerTopViewport,
  ];
};

const addScrollToRect = (scrollRelativeRect) => {
  const { left, top, width, height, scrollLeft, scrollTop } =
    scrollRelativeRect;
  const leftWithScroll = left + scrollLeft;
  const topWithScroll = top + scrollTop;
  return {
    ...scrollRelativeRect,
    left: leftWithScroll,
    top: topWithScroll,
    right: leftWithScroll + width,
    bottom: topWithScroll + height,
  };
};

// https://github.com/w3c/csswg-drafts/issues/3329
// Return the portion of the element that is visible for this scoll container
const getScrollBox = (scrollContainer) => {
  if (scrollContainer === documentElement) {
    const { clientWidth, clientHeight } = documentElement;

    return {
      left: 0,
      top: 0,
      right: clientWidth,
      bottom: clientHeight,
      width: clientWidth,
      height: clientHeight,
    };
  }

  const { clientWidth, clientHeight } = scrollContainer;
  const scrollContainerBorderSizes = getBorderSizes(scrollContainer);
  const left = scrollContainerBorderSizes.left;
  const top = scrollContainerBorderSizes.top;
  const right = left + clientWidth;
  const bottom = top + clientHeight;
  return {
    left,
    top,
    right,
    bottom,
    width: clientWidth,
    height: clientHeight,
  };
};
// https://developer.mozilla.org/en-US/docs/Glossary/Scroll_container#scrollport
const getScrollport = (scrollBox, scrollContainer) => {
  const { left, top, width, height } = scrollBox;
  const leftWithScroll = left + scrollContainer.scrollLeft;
  const topWithScroll = top + scrollContainer.scrollTop;
  const rightWithScroll = leftWithScroll + width;
  const bottomWithScroll = topWithScroll + height;
  return {
    left: leftWithScroll,
    top: topWithScroll,
    right: rightWithScroll,
    bottom: bottomWithScroll,
  };
};

const getElementSelector = (element) => {
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = element.className
    ? `.${element.className.split(" ").join(".")}`
    : "";
  return `${tagName}${id}${className}`;
};

installImportMetaCss(import.meta);const setupConstraintFeedbackLine = () => {
  const constraintFeedbackLine = createConstraintFeedbackLine();

  // Track last known mouse position for constraint feedback line during scroll
  let lastMouseX = null;
  let lastMouseY = null;

  // Internal function to update constraint feedback line
  const onDrag = (gestureInfo) => {
    const { grabEvent, dragEvent } = gestureInfo;
    if (
      grabEvent.type === "programmatic" ||
      dragEvent.type === "programmatic"
    ) {
      // programmatic drag
      return;
    }

    const mouseX = dragEvent.clientX;
    const mouseY = dragEvent.clientY;
    // Use last known position if current position not available (e.g., during scroll)
    const effectiveMouseX = mouseX !== null ? mouseX : lastMouseX;
    const effectiveMouseY = mouseY !== null ? mouseY : lastMouseY;
    if (effectiveMouseX === null || effectiveMouseY === null) {
      return;
    }

    // Store current mouse position for potential use during scroll
    lastMouseX = mouseX;
    lastMouseY = mouseY;

    const grabClientX = grabEvent.clientX;
    const grabClientY = grabEvent.clientY;

    // Calculate distance between mouse and current grab point
    const deltaX = effectiveMouseX - grabClientX;
    const deltaY = effectiveMouseY - grabClientY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    // Show line only when distance is significant (> 20px threshold)
    const threshold = 20;
    if (distance <= threshold) {
      constraintFeedbackLine.style.opacity = "";
      constraintFeedbackLine.removeAttribute("data-visible");
      return;
    }

    // Calculate angle and position
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    // Position line at current grab point (follows element movement)
    constraintFeedbackLine.style.left = `${grabClientX}px`;
    constraintFeedbackLine.style.top = `${grabClientY}px`;
    constraintFeedbackLine.style.width = `${distance}px`;
    constraintFeedbackLine.style.transform = `rotate(${angle}deg)`;
    // Fade in based on distance (more visible as distance increases)
    const maxOpacity = 0.8;
    const opacityFactor = Math.min((distance - threshold) / 100, 1);
    constraintFeedbackLine.style.opacity = `${maxOpacity * opacityFactor}`;
    constraintFeedbackLine.setAttribute("data-visible", "");
  };

  return {
    onDrag,
    onRelease: () => {
      constraintFeedbackLine.remove();
    },
  };
};

const createConstraintFeedbackLine = () => {
  const line = document.createElement("div");
  line.className = "navi_constraint_feedback_line";
  line.title =
    "Constraint feedback - shows distance between mouse and moving grab point";
  document.body.appendChild(line);
  return line;
};

import.meta.css = /* css */ `
  .navi_constraint_feedback_line {
    position: fixed;
    pointer-events: none;
    z-index: 9998;
    visibility: hidden;
    transition: opacity 0.15s ease;
    transform-origin: left center;
    border-top: 2px dotted rgba(59, 130, 246, 0.7);
  }

  .navi_constraint_feedback_line[data-visible] {
    visibility: visible;
  }
`;

installImportMetaCss(import.meta);const MARKER_SIZE = 12;

let currentDebugMarkers = [];
let currentConstraintMarkers = [];
let currentReferenceElementMarker = null;
let currentElementMarker = null;

const setupDragDebugMarkers = (dragGesture, { referenceElement }) => {
  // Clean up any existing persistent markers from previous drag gestures
  {
    // Remove any existing markers from previous gestures
    const container = document.getElementById("navi_debug_markers_container");
    if (container) {
      container.innerHTML = ""; // Clear all markers efficiently
    }
  }

  const { direction, scrollContainer } = dragGesture.gestureInfo;

  return {
    onConstraints: (
      constraints,
      { left, top, right, bottom, autoScrollArea },
    ) => {
      // Schedule removal of previous markers if they exist
      const previousDebugMarkers = [...currentDebugMarkers];
      const previousConstraintMarkers = [...currentConstraintMarkers];
      const previousReferenceElementMarker = currentReferenceElementMarker;
      const previousElementMarker = currentElementMarker;

      if (
        previousDebugMarkers.length > 0 ||
        previousConstraintMarkers.length > 0 ||
        previousReferenceElementMarker ||
        previousElementMarker
      ) {
        setTimeout(() => {
          previousDebugMarkers.forEach((marker) => marker.remove());
          previousConstraintMarkers.forEach((marker) => marker.remove());
          if (previousReferenceElementMarker) {
            previousReferenceElementMarker.remove();
          }
          if (previousElementMarker) {
            previousElementMarker.remove();
          }
        }, 100);
      }

      // Clear current marker arrays
      currentDebugMarkers.length = 0;
      currentConstraintMarkers.length = 0;
      currentReferenceElementMarker = null;
      currentElementMarker = null;

      // Create element marker (always show the dragged element)
      // When there's a reference element, show it as "Dragged Element"
      // When there's no reference element, show it as "Element"
      const elementLabel = referenceElement ? "Dragged Element" : "Element";
      const elementColor = referenceElement ? "255, 0, 150" : "0, 200, 0"; // Pink when with reference, green when standalone

      currentElementMarker = createElementMarker({
        left,
        top,
        right,
        bottom,
        scrollContainer,
        label: elementLabel,
        color: elementColor,
      });

      // Create reference element marker if reference element exists
      if (referenceElement) {
        currentReferenceElementMarker = createReferenceElementMarker({
          left,
          top,
          right,
          bottom,
          scrollContainer,
        });
      }

      // Collect all markers to be created, then merge duplicates
      const markersToCreate = [];

      {
        if (direction.x) {
          markersToCreate.push({
            name: autoScrollArea.paddingLeft
              ? `autoscroll.left + padding(${autoScrollArea.paddingLeft})`
              : "autoscroll.left",
            x: autoScrollArea.left,
            y: 0,
            color: "0 128 0", // green
            side: "left",
          });
          markersToCreate.push({
            name: autoScrollArea.paddingRight
              ? `autoscroll.right + padding(${autoScrollArea.paddingRight})`
              : "autoscroll.right",
            x: autoScrollArea.right,
            y: 0,
            color: "0 128 0", // green
            side: "right",
          });
        }
        if (direction.y) {
          markersToCreate.push({
            name: autoScrollArea.paddingTop
              ? `autoscroll.top + padding(${autoScrollArea.paddingTop})`
              : "autoscroll.top",
            x: 0,
            y: autoScrollArea.top,
            color: "255 0 0", // red
            side: "top",
          });
          markersToCreate.push({
            name: autoScrollArea.paddingBottom
              ? `autoscroll.bottom + padding(${autoScrollArea.paddingBottom})`
              : "autoscroll.bottom",
            x: 0,
            y: autoScrollArea.bottom,
            color: "255 165 0", // orange
            side: "bottom",
          });
        }
      }

      // Process each constraint individually to preserve names
      for (const constraint of constraints) {
        if (constraint.type === "bounds") {
          const { bounds } = constraint;

          // Create individual markers for each bound with constraint name
          if (direction.x) {
            if (bounds.left !== undefined) {
              markersToCreate.push({
                name: `${constraint.name}.left`,
                x: bounds.left,
                y: 0,
                color: "128 0 128", // purple
                side: "left",
              });
            }
            if (bounds.right !== undefined) {
              // For visual clarity, show rightBound at the right edge of the element
              // when element is positioned at rightBound (not the left edge position)
              markersToCreate.push({
                name: `${constraint.name}.right`,
                x: bounds.right,
                y: 0,
                color: "128 0 128", // purple
                side: "right",
              });
            }
          }
          if (direction.y) {
            if (bounds.top !== undefined) {
              markersToCreate.push({
                name: `${constraint.name}.top`,
                x: 0,
                y: bounds.top,
                color: "128 0 128", // purple
                side: "top",
              });
            }
            if (bounds.bottom !== undefined) {
              // For visual clarity, show bottomBound at the bottom edge of the element
              // when element is positioned at bottomBound (not the left edge position)
              markersToCreate.push({
                name: `${constraint.name}.bottom`,
                x: 0,
                y: bounds.bottom,
                color: "128 0 128", // purple
                side: "bottom",
              });
            }
          }
        } else if (constraint.type === "obstacle") {
          const obstacleMarker = createObstacleMarker(
            constraint,
            scrollContainer,
          );
          currentConstraintMarkers.push(obstacleMarker);
        }
      }

      // Create markers with merging for overlapping positions
      const createdMarkers = createMergedMarkers(
        markersToCreate,
        scrollContainer,
      );
      currentDebugMarkers.push(
        ...createdMarkers.filter((m) => m.type !== "constraint"),
      );
      currentConstraintMarkers.push(
        ...createdMarkers.filter((m) => m.type === "constraint"),
      );
    },
    onRelease: () => {
      {
        return;
      }
    },
  };
};

// Ensure markers container exists and return it
const getMarkersContainer = () => {
  let container = document.getElementById("navi_debug_markers_container");
  if (!container) {
    container = document.createElement("div");
    container.id = "navi_debug_markers_container";
    container.className = "navi_debug_markers_container";
    document.body.appendChild(container);
  }
  return container;
};

// Convert document-relative coordinates to viewport coordinates for marker positioning
// Takes the scroll container into account for proper positioning relative to the container
const getDebugMarkerPos = (x, y, scrollContainer, side = null) => {
  const { documentElement } = document;

  const leftWithoutScroll = x - scrollContainer.scrollLeft;
  const topWithoutScroll = y - scrollContainer.scrollTop;
  let baseX;
  let baseY;
  if (scrollContainer === documentElement) {
    // our markers are injected into the document so we have the right coordinates already
    // and we remove scroll because our markers are in a fixed position ancestor (to ensure they cannot influence scrollbars)
    baseX = leftWithoutScroll;
    baseY = topWithoutScroll;
  } else {
    // we need to remove the scroll of the container?
    // not sure I think here we might want to keep the scroll container scroll
    // and that's it
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    baseX = scrollContainerRect.left + leftWithoutScroll;
    baseY = scrollContainerRect.top + topWithoutScroll;
  }

  // Apply side-specific logic for extending markers across viewport
  if (side === "left" || side === "right") {
    // Vertical markers: x should stay fixed in viewport, y can extend
    return [baseX, 0]; // y=0 to start from top of viewport
  }
  if (side === "top" || side === "bottom") {
    // Horizontal markers: y should stay fixed in viewport, x can extend
    return [0, baseY]; // x=0 to start from left of viewport
  }

  // For obstacles and other markers: use converted coordinates directly
  return [baseX, baseY];
};

const createMergedMarkers = (markersToCreate, scrollContainer) => {
  const mergedMarkers = [];
  const positionMap = new Map();

  // Group markers by position and side
  for (const marker of markersToCreate) {
    const key = `${marker.x},${marker.y},${marker.side}`;

    if (!positionMap.has(key)) {
      positionMap.set(key, []);
    }
    positionMap.get(key).push(marker);
  }

  // Create markers with merged labels for overlapping positions
  for (const [, markers] of positionMap) {
    if (markers.length === 1) {
      // Single marker - create as normal
      const marker = markers[0];
      const domMarker = createDebugMarker(marker, scrollContainer);
      domMarker.type = marker.name.includes("Bound") ? "constraint" : "visible";
      mergedMarkers.push(domMarker);
    } else {
      // Multiple markers at same position - merge labels
      const firstMarker = markers[0];
      const combinedName = markers.map((m) => m.name).join(" + ");

      // Use the first marker's color, or mix colors if needed
      const domMarker = createDebugMarker(
        {
          ...firstMarker,
          name: combinedName,
        },
        scrollContainer,
      );
      domMarker.type = markers.some((m) => m.name.includes("Bound"))
        ? "constraint"
        : "visible";
      mergedMarkers.push(domMarker);
    }
  }

  return mergedMarkers;
};

const createDebugMarker = (
  { name, x, y, color = "255 0 0", side },
  scrollContainer,
) => {
  // Convert coordinates from document-relative to viewport
  const [viewportX, viewportY] = getDebugMarkerPos(x, y, scrollContainer, side);

  const marker = document.createElement("div");
  marker.className = `navi_debug_marker`;
  marker.setAttribute(`data-${side}`, "");
  // Set the color as a CSS custom property
  marker.style.setProperty("--marker-color", `rgb(${color})`);
  // Position markers exactly at the boundary coordinates
  marker.style.left =
    side === "right" ? `${viewportX - MARKER_SIZE}px` : `${viewportX}px`;
  marker.style.top =
    side === "bottom" ? `${viewportY - MARKER_SIZE}px` : `${viewportY}px`;
  marker.title = name;

  // Add label
  const label = document.createElement("div");
  label.className = `navi_debug_marker_label`;
  label.textContent = name;
  marker.appendChild(label);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};
const createObstacleMarker = (obstacleObj, scrollContainer) => {
  const width = obstacleObj.bounds.right - obstacleObj.bounds.left;
  const height = obstacleObj.bounds.bottom - obstacleObj.bounds.top;

  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(
    obstacleObj.bounds.left,
    obstacleObj.bounds.top,
    scrollContainer,
    "obstacle",
  );

  const marker = document.createElement("div");
  marker.className = "navi_obstacle_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = obstacleObj.name;

  // Add label
  const label = document.createElement("div");
  label.className = "navi_obstacle_marker_label";
  label.textContent = obstacleObj.name;
  marker.appendChild(label);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};

const createElementMarker = ({
  left,
  top,
  right,
  bottom,
  scrollContainer,
  label = "Element",
  color = "0, 200, 0", // Default green color
}) => {
  const width = right - left;
  const height = bottom - top;
  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(left, top, scrollContainer, "element");

  const marker = document.createElement("div");
  marker.className = "navi_element_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = label;

  // Set the color as CSS custom properties
  marker.style.setProperty("--element-color", `rgb(${color})`);
  marker.style.setProperty("--element-color-alpha", `rgba(${color}, 0.3)`);

  // Add label
  const labelEl = document.createElement("div");
  labelEl.className = "navi_element_marker_label";
  labelEl.textContent = label;
  marker.appendChild(labelEl);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};

const createReferenceElementMarker = ({
  left,
  top,
  right,
  bottom,
  scrollContainer,
}) => {
  const width = right - left;
  const height = bottom - top;
  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(left, top, scrollContainer, "reference");

  const marker = document.createElement("div");
  marker.className = "navi_reference_element_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = "Reference Element";

  // Add label
  const label = document.createElement("div");
  label.className = "navi_reference_element_marker_label";
  label.textContent = "Reference Element";
  marker.appendChild(label);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};

import.meta.css = /* css */ `
  .navi_debug_markers_container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    pointer-events: none;
    z-index: 999998;
    --marker-size: ${MARKER_SIZE}px;
  }

  .navi_debug_marker {
    position: absolute;
    pointer-events: none;
  }

  /* Markers based on side rather than orientation */
  .navi_debug_marker[data-left],
  .navi_debug_marker[data-right] {
    width: var(--marker-size);
    height: 100vh;
  }

  .navi_debug_marker[data-top],
  .navi_debug_marker[data-bottom] {
    width: 100vw;
    height: var(--marker-size);
  }

  /* Gradient directions based on side, using CSS custom properties for color */
  .navi_debug_marker[data-left] {
    background: linear-gradient(
      to right,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-right] {
    background: linear-gradient(
      to left,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-top] {
    background: linear-gradient(
      to bottom,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-bottom] {
    background: linear-gradient(
      to top,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker_label {
    position: absolute;
    font-size: 12px;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid;
    white-space: nowrap;
    pointer-events: none;
    color: rgb(from var(--marker-color) r g b / 1);
    border-color: rgb(from var(--marker-color) r g b / 1);
  }

  /* Label positioning based on side data attributes */

  /* Left side markers - vertical with 90° rotation */
  .navi_debug_marker[data-left] .navi_debug_marker_label {
    left: 10px;
    top: 20px;
    transform: rotate(90deg);
    transform-origin: left center;
  }

  /* Right side markers - vertical with -90° rotation */
  .navi_debug_marker[data-right] .navi_debug_marker_label {
    right: 10px;
    left: auto;
    top: 20px;
    transform: rotate(-90deg);
    transform-origin: right center;
  }

  /* Top side markers - horizontal, label on the line */
  .navi_debug_marker[data-top] .navi_debug_marker_label {
    top: 0px;
    left: 20px;
  }

  /* Bottom side markers - horizontal, label on the line */
  .navi_debug_marker[data-bottom] .navi_debug_marker_label {
    bottom: 0px;
    top: auto;
    left: 20px;
  }

  .navi_obstacle_marker {
    position: absolute;
    background-color: orange;
    opacity: 0.6;
    z-index: 9999;
    pointer-events: none;
  }

  .navi_obstacle_marker_label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: bold;
    color: white;
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
    pointer-events: none;
  }

  .navi_element_marker {
    position: absolute;
    background-color: var(--element-color-alpha, rgba(255, 0, 150, 0.3));
    border: 2px solid var(--element-color, rgb(255, 0, 150));
    opacity: 0.9;
    z-index: 9997;
    pointer-events: none;
  }

  .navi_element_marker_label {
    position: absolute;
    top: -25px;
    right: 0;
    font-size: 11px;
    font-weight: bold;
    color: var(--element-color, rgb(255, 0, 150));
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid var(--element-color, rgb(255, 0, 150));
    white-space: nowrap;
    pointer-events: none;
  }

  .navi_reference_element_marker {
    position: absolute;
    background-color: rgba(0, 150, 255, 0.3);
    border: 2px dashed rgba(0, 150, 255, 0.7);
    opacity: 0.8;
    z-index: 9998;
    pointer-events: none;
  }

  .navi_reference_element_marker_label {
    position: absolute;
    top: -25px;
    left: 0;
    font-size: 11px;
    font-weight: bold;
    color: rgba(0, 150, 255, 1);
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid rgba(0, 150, 255, 0.7);
    white-space: nowrap;
    pointer-events: none;
  }
`;

const initDragConstraints = (
  dragGesture,
  {
    areaConstraint,
    obstaclesContainer,
    obstacleAttributeName,
    showConstraintFeedbackLine,
    showDebugMarkers,
    referenceElement,
  },
) => {
  const dragGestureName = dragGesture.gestureInfo.name;
  const direction = dragGesture.gestureInfo.direction;
  const scrollContainer = dragGesture.gestureInfo.scrollContainer;
  const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
  const topAtGrab = dragGesture.gestureInfo.topAtGrab;

  const constraintFunctions = [];
  const addConstraint = (constraint) => {
    constraintFunctions.push(constraint);
  };

  if (showConstraintFeedbackLine) {
    const constraintFeedbackLine = setupConstraintFeedbackLine();
    dragGesture.addDragCallback((gestureInfo) => {
      constraintFeedbackLine.onDrag(gestureInfo);
    });
    dragGesture.addReleaseCallback(() => {
      constraintFeedbackLine.onRelease();
    });
  }
  let dragDebugMarkers;
  if (showDebugMarkers) {
    dragDebugMarkers = setupDragDebugMarkers(dragGesture, {
      referenceElement,
    });
    dragGesture.addReleaseCallback(() => {
      dragDebugMarkers.onRelease();
    });
  }

  {
    const areaConstraintFunction = createAreaConstraint(areaConstraint, {
      scrollContainer,
    });
    if (areaConstraintFunction) {
      addConstraint(areaConstraintFunction);
    }
  }
  obstacles: {
    if (!obstacleAttributeName || !obstaclesContainer) {
      break obstacles;
    }
    const obstacleConstraintFunctions =
      createObstacleConstraintsFromQuerySelector(obstaclesContainer, {
        obstacleAttributeName,
        gestureInfo: dragGesture.gestureInfo,
        isDraggedElementSticky: false,
        // isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
      });
    for (const obstacleConstraintFunction of obstacleConstraintFunctions) {
      addConstraint(obstacleConstraintFunction);
    }
  }

  const applyConstraints = (
    layoutRequested,
    currentLayout,
    limitLayout,
    {
      elementWidth,
      elementHeight,
      scrollArea,
      scrollport,
      hasCrossedScrollportLeftOnce,
      hasCrossedScrollportTopOnce,
      autoScrollArea,
      dragEvent,
    },
  ) => {
    if (constraintFunctions.length === 0) {
      return;
    }

    const elementCurrentLeft = currentLayout.left;
    const elementCurrentTop = currentLayout.top;
    const elementLeftRequested = layoutRequested.left;
    const elementTopRequested = layoutRequested.top;
    let elementLeft = elementLeftRequested;
    let elementTop = elementTopRequested;

    const constraintInitParams = {
      leftAtGrab,
      topAtGrab,
      left: elementCurrentLeft,
      top: elementCurrentTop,
      right: elementCurrentLeft + elementWidth,
      bottom: elementCurrentTop + elementHeight,
      width: elementWidth,
      height: elementHeight,
      scrollContainer,
      scrollArea,
      scrollport,
      autoScrollArea,
      dragGestureName,
      dragEvent,
    };
    const constraints = constraintFunctions.map((fn) =>
      fn(constraintInitParams),
    );

    const logConstraintEnforcement = (axis, constraint) => {
      if (constraint.type === "obstacle") {
        return;
      }
      const requested =
        axis === "x" ? elementLeftRequested : elementTopRequested;
      const constrained = axis === "x" ? elementLeft : elementTop;
      const action = constrained > requested ? "increased" : "capped";
      const property = axis === "x" ? "left" : "top";
      console.debug(
        `Drag by ${dragEvent.type}: ${property} ${action} from ${requested.toFixed(2)} to ${constrained.toFixed(2)} by ${constraint.type}:${constraint.name}`,
        constraint.element,
      );
    };

    // Apply each constraint in sequence, accumulating their effects
    // This allows multiple constraints to work together (e.g., bounds + obstacles)
    for (const constraint of constraints) {
      const result = constraint.apply({
        // each constraint works with scroll included coordinates
        // and coordinates we provide here includes the scroll of the container
        left: elementLeft,
        top: elementTop,
        right: elementLeft + elementWidth,
        bottom: elementTop + elementHeight,
        width: elementWidth,
        height: elementHeight,
        currentLeft: elementCurrentLeft,
        currentTop: elementCurrentTop,
        scrollport,
        hasCrossedScrollportLeftOnce,
        hasCrossedScrollportTopOnce,
      });
      if (!result) {
        continue;
      }
      const [elementLeftConstrained, elementTopConstrained] = result;
      if (direction.x && elementLeftConstrained !== elementLeft) {
        elementLeft = elementLeftConstrained;
        logConstraintEnforcement("x", constraint);
      }
      if (direction.y && elementTopConstrained !== elementTop) {
        elementTop = elementTopConstrained;
        logConstraintEnforcement("y", constraint);
      }
    }

    if (dragDebugMarkers) {
      dragDebugMarkers.onConstraints(constraints, {
        left: elementLeft,
        top: elementTop,
        right: elementLeft + elementWidth,
        bottom: elementTop + elementHeight,
        elementWidth,
        elementHeight,
        scrollport,
        autoScrollArea,
      });
    }

    const leftModified = elementLeft !== elementLeftRequested;
    const topModified = elementTop !== elementTopRequested;
    if (!leftModified && !topModified) {
      {
        console.debug(
          `Drag by ${dragEvent.type}: no constraint enforcement needed (${elementLeftRequested.toFixed(2)}, ${elementTopRequested.toFixed(2)})`,
        );
      }
      return;
    }

    limitLayout(elementLeft, elementTop);
  };

  return { applyConstraints };
};

const createAreaConstraint = (areaConstraint, { scrollContainer }) => {
  if (!areaConstraint || areaConstraint === "none") {
    return null;
  }
  if (areaConstraint === "scrollport") {
    const scrollportConstraintFunction = ({ scrollport }) => {
      return createBoundConstraint(scrollport, {
        element: scrollContainer,
        name: "scrollport",
      });
    };
    return scrollportConstraintFunction;
  }
  if (areaConstraint === "scroll") {
    const scrollAreaConstraintFunction = ({ scrollArea }) => {
      return createBoundConstraint(scrollArea, {
        element: scrollContainer,
        name: "scroll_area",
      });
    };
    return scrollAreaConstraintFunction;
  }
  if (typeof areaConstraint === "function") {
    const dynamicAreaConstraintFunction = (params) => {
      const bounds = areaConstraint(params);
      return createBoundConstraint(bounds, {
        name: "dynamic_area",
      });
    };
    return dynamicAreaConstraintFunction;
  }
  if (typeof areaConstraint === "object") {
    const { left, top, right, bottom } = areaConstraint;
    const turnSidePropertyInToGetter = (value, side) => {
      if (value === "scrollport") {
        return ({ scrollport }) => scrollport[side];
      }
      if (value === "scroll") {
        return ({ scrollArea }) => scrollArea[side];
      }
      if (typeof value === "function") {
        return value;
      }
      if (value === undefined) {
        // defaults to scrollport
        return ({ scrollport }) => scrollport[side];
      }
      return () => value;
    };
    const getLeft = turnSidePropertyInToGetter(left, "left");
    const getRight = turnSidePropertyInToGetter(right, "right");
    const getTop = turnSidePropertyInToGetter(top, "top");
    const getBottom = turnSidePropertyInToGetter(bottom, "bottom");

    const dynamicAreaConstraintFunction = (params) => {
      const bounds = {
        left: getLeft(params),
        right: getRight(params),
        top: getTop(params),
        bottom: getBottom(params),
      };
      return createBoundConstraint(bounds, {
        name: "dynamic_area",
      });
    };
    return dynamicAreaConstraintFunction;
  }
  console.warn(
    `Unknown areaConstraint value: ${areaConstraint}. Expected "scrollport", "scroll", "none", an object with boundary definitions, or a function returning boundary definitions.`,
  );
  return null;
};

const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { obstacleAttributeName, gestureInfo, isDraggedElementSticky = false },
) => {
  const dragGestureName = gestureInfo.name;
  const obstacles = scrollableElement.querySelectorAll(
    `[${obstacleAttributeName}]`,
  );
  const obstacleConstraintFunctions = [];
  for (const obstacle of obstacles) {
    if (obstacle.closest("[data-drag-ignore]")) {
      continue;
    }
    if (dragGestureName) {
      const obstacleAttributeValue = obstacle.getAttribute(
        obstacleAttributeName,
      );
      if (obstacleAttributeValue) {
        const obstacleNames = obstacleAttributeValue.split(",");
        const found = obstacleNames.some(
          (obstacleName) =>
            obstacleName.trim().toLowerCase() === dragGestureName.toLowerCase(),
        );
        if (!found) {
          continue;
        }
      }
    }

    obstacleConstraintFunctions.push(
      ({ hasCrossedVisibleAreaLeftOnce, hasCrossedVisibleAreaTopOnce }) => {
        // Only apply the "before crossing visible area" logic when dragging sticky elements
        // Non-sticky elements should be able to cross sticky obstacles while stuck regardless of visible area crossing
        const useOriginalPositionEvenIfSticky = isDraggedElementSticky
          ? !hasCrossedVisibleAreaLeftOnce && !hasCrossedVisibleAreaTopOnce
          : true;

        const obstacleScrollRelativeRect = getScrollRelativeRect(
          obstacle,
          scrollableElement,
          {
            useOriginalPositionEvenIfSticky,
          },
        );
        let obstacleBounds;
        if (
          useOriginalPositionEvenIfSticky &&
          obstacleScrollRelativeRect.isSticky
        ) {
          obstacleBounds = obstacleScrollRelativeRect;
        } else {
          obstacleBounds = addScrollToRect(obstacleScrollRelativeRect);
        }

        // obstacleBounds are already in scrollable-relative coordinates, no conversion needed
        const obstacleObject = createObstacleContraint(obstacleBounds, {
          name: `${obstacleBounds.isSticky ? "sticky " : ""}obstacle (${getElementSelector(obstacle)})`,
          element: obstacle,
        });
        return obstacleObject;
      },
    );
  }
  return obstacleConstraintFunctions;
};

const createBoundConstraint = (bounds, { name, element } = {}) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;

  const apply = ({ left, top, right, bottom, width, height }) => {
    let leftConstrained = left;
    let topConstrained = top;
    // Left boundary: element's left edge should not go before leftBound
    if (leftBound !== undefined && left < leftBound) {
      leftConstrained = leftBound;
    }
    // Right boundary: element's right edge should not go past rightBound
    if (rightBound !== undefined && right > rightBound) {
      leftConstrained = rightBound - width;
    }
    // Top boundary: element's top edge should not go before topBound
    if (topBound !== undefined && top < topBound) {
      topConstrained = topBound;
    }
    // Bottom boundary: element's bottom edge should not go past bottomBound
    if (bottomBound !== undefined && bottom > bottomBound) {
      topConstrained = bottomBound - height;
    }
    return [leftConstrained, topConstrained];
  };

  return {
    type: "bounds",
    name,
    apply,
    element,
    bounds,
  };
};
const createObstacleContraint = (bounds, { element, name }) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;
  const leftBoundRounded = roundForConstraints(leftBound);
  const rightBoundRounded = roundForConstraints(rightBound);
  const topBoundRounded = roundForConstraints(topBound);
  const bottomBoundRounded = roundForConstraints(bottomBound);

  const apply = ({
    left,
    top,
    right,
    bottom,
    width,
    height,
    currentLeft,
    currentTop,
  }) => {
    // Simple collision detection: check where element is and prevent movement into obstacle
    {
      // Determine current position relative to obstacle
      const currentLeftRounded = roundForConstraints(currentLeft);
      const currentRightRounded = roundForConstraints(currentLeft + width);
      const currentTopRounded = roundForConstraints(currentTop);
      const currentBottomRounded = roundForConstraints(currentTop + height);
      const isOnTheLeft = currentRightRounded <= leftBoundRounded;
      const isOnTheRight = currentLeftRounded >= rightBoundRounded;
      const isAbove = currentBottomRounded <= topBoundRounded;
      const isBelow = currentTopRounded >= bottomBoundRounded;

      // If element is on the left, apply X constraint to prevent moving right into obstacle
      if (isOnTheLeft) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const maxLeft = leftBound - width;
          if (left > maxLeft) {
            return [maxLeft, top];
          }
        }
      }
      // If element is on the right, apply X constraint to prevent moving left into obstacle
      else if (isOnTheRight) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const minLeft = rightBound;
          if (left < minLeft) {
            return [minLeft, top];
          }
        }
      }
      // If element is above, apply Y constraint to prevent moving down into obstacle
      else if (isAbove) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const maxTop = topBound - height;
          if (top > maxTop) {
            return [left, maxTop];
          }
        }
      }
      // If element is below, apply Y constraint to prevent moving up into obstacle
      else if (isBelow) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const minTop = bottomBound;
          if (top < minTop) {
            return [left, minTop];
          }
        }
      }
    }

    // Element is overlapping with obstacle - push it out in the direction of least resistance
    // Calculate distances to push element out in each direction
    const distanceToLeft = right - leftBound; // Distance to push left
    const distanceToRight = rightBound - left; // Distance to push right
    const distanceToTop = bottom - topBound; // Distance to push up
    const distanceToBottom = bottomBound - top; // Distance to push down
    // Find the minimum distance (direction of least resistance)
    const minDistance = Math.min(
      distanceToLeft,
      distanceToRight,
      distanceToTop,
      distanceToBottom,
    );
    if (minDistance === distanceToLeft) {
      // Push left: element should not go past leftBound - elementWidth
      const maxLeft = leftBound - width;
      if (left > maxLeft) {
        return [maxLeft, top];
      }
    } else if (minDistance === distanceToRight) {
      // Push right: element should not go before rightBound
      const minLeft = rightBound;
      if (left < minLeft) {
        return [minLeft, top];
      }
    } else if (minDistance === distanceToTop) {
      // Push up: element should not go past topBound - elementHeight
      const maxTop = topBound - height;
      if (top > maxTop) {
        return [left, maxTop];
      }
    } else if (minDistance === distanceToBottom) {
      // Push down: element should not go before bottomBound
      const minTop = bottomBound;
      if (top < minTop) {
        return [left, minTop];
      }
    }

    return null;
  };

  return {
    type: "obstacle",
    name,
    apply,
    element,
    bounds,
  };
};

/**
 * Rounds coordinates to prevent floating point precision issues in constraint calculations.
 *
 * This is critical for obstacle detection because:
 * 1. Boundary detection relies on precise comparisons (e.g., elementRight <= obstacleLeft)
 * 2. Floating point arithmetic can produce values like 149.99999999 instead of 150
 * 3. This causes incorrect boundary classifications (element appears "on left" when it should be "overlapping")
 *
 * Scroll events are more susceptible to this issue because:
 * - Mouse events use integer pixel coordinates from the DOM (e.g., clientX: 150)
 * - Scroll events use element.scrollLeft which can have sub-pixel values from CSS transforms, zoom, etc.
 * - Scroll compensation calculations (scrollDelta * ratios) amplify floating point errors
 * - Multiple scroll events accumulate these errors over time
 *
 * Using 2-decimal precision maintains smooth sub-pixel positioning while ensuring
 * reliable boundary detection for constraint systems.
 */
const roundForConstraints = (value) => {
  return Math.round(value * 100) / 100;
};

const applyStickyFrontiersToAutoScrollArea = (
  autoScrollArea,
  { direction, scrollContainer, dragName },
) => {
  let { left, right, top, bottom } = autoScrollArea;

  if (direction.x) {
    const horizontalStickyFrontiers = createStickyFrontierOnAxis(
      scrollContainer,
      {
        name: dragName,
        scrollContainer,
        primarySide: "left",
        oppositeSide: "right",
      },
    );
    for (const horizontalStickyFrontier of horizontalStickyFrontiers) {
      const { side, bounds, element } = horizontalStickyFrontier;
      if (side === "left") {
        if (bounds.right <= left) {
          continue;
        }
        left = bounds.right;
        continue;
      }
      // right
      if (bounds.left >= right) {
        continue;
      }
      right = bounds.left;
      continue;
    }
  }

  if (direction.y) {
    const verticalStickyFrontiers = createStickyFrontierOnAxis(
      scrollContainer,
      {
        name: dragName,
        scrollContainer,
        primarySide: "top",
        oppositeSide: "bottom",
      },
    );
    for (const verticalStickyFrontier of verticalStickyFrontiers) {
      const { side, bounds, element } = verticalStickyFrontier;

      // Frontier acts as a top barrier - constrains from the bottom edge of the frontier
      if (side === "top") {
        if (bounds.bottom <= top) {
          continue;
        }
        top = bounds.bottom;
        continue;
      }

      // Frontier acts as a bottom barrier - constrains from the top edge of the frontier
      if (bounds.top >= bottom) {
        continue;
      }
      bottom = bounds.top;
      continue;
    }
  }

  return { left, right, top, bottom };
};

const createStickyFrontierOnAxis = (
  element,
  { name, scrollContainer, primarySide, oppositeSide },
) => {
  const primaryAttrName = `data-drag-sticky-${primarySide}-frontier`;
  const oppositeAttrName = `data-drag-sticky-${oppositeSide}-frontier`;
  const frontiers = element.querySelectorAll(
    `[${primaryAttrName}], [${oppositeAttrName}]`,
  );
  const matchingStickyFrontiers = [];
  for (const frontier of frontiers) {
    if (frontier.closest("[data-drag-ignore]")) {
      continue;
    }
    const hasPrimary = frontier.hasAttribute(primaryAttrName);
    const hasOpposite = frontier.hasAttribute(oppositeAttrName);
    // Check if element has both sides (invalid)
    if (hasPrimary && hasOpposite) {
      const elementSelector = getElementSelector(frontier);
      console.warn(
        `Sticky frontier element (${elementSelector}) has both ${primarySide} and ${oppositeSide} attributes. 
  A sticky frontier should only have one side attribute.`,
      );
      continue;
    }
    const attrName = hasPrimary ? primaryAttrName : oppositeAttrName;
    const attributeValue = frontier.getAttribute(attrName);
    if (attributeValue && name) {
      const frontierNames = attributeValue.split(",");
      const isMatching = frontierNames.some(
        (frontierName) =>
          frontierName.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!isMatching) {
        continue;
      }
    }
    const frontierBounds = getScrollRelativeRect(frontier, scrollContainer);
    const stickyFrontierObject = {
      type: "sticky-frontier",
      element: frontier,
      side: hasPrimary ? primarySide : oppositeSide,
      bounds: frontierBounds,
      name: `sticky_frontier_${hasPrimary ? primarySide : oppositeSide} (${getElementSelector(frontier)})`,
    };
    matchingStickyFrontiers.push(stickyFrontierObject);
  }
  return matchingStickyFrontiers;
};

const dragStyleController = createStyleController("drag_to_move");

const createDragToMoveGestureController = ({
  stickyFrontiers = true,
  // Padding to reduce the area used to autoscroll by this amount (applied after sticky frontiers)
  // This creates an invisible space around the area where elements cannot be dragged
  autoScrollAreaPadding = 0,
  // constraints,
  areaConstraint = "scroll", // "scroll" | "scrollport" | "none" | {left,top,right,bottom} | function
  obstaclesContainer,
  obstacleAttributeName = "data-drag-obstacle",
  // Visual feedback line connecting mouse cursor to the moving grab point when constraints prevent following
  // This provides intuitive feedback during drag operations when the element cannot reach the mouse
  // position due to obstacles, boundaries, or other constraints. The line originates from where the mouse
  // initially grabbed the element, but moves with the element to show the current anchor position.
  // It becomes visible when there's a significant distance between mouse and grab point.
  showConstraintFeedbackLine = true,
  showDebugMarkers = true,
  resetPositionAfterRelease = false,
  ...options
} = {}) => {
  const initGrabToMoveElement = (
    dragGesture,
    { element, referenceElement, elementToMove, convertScrollablePosition },
  ) => {
    const direction = dragGesture.gestureInfo.direction;
    dragGesture.gestureInfo.name;
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;
    const elementImpacted = elementToMove || element;
    const translateXAtGrab = dragStyleController.getUnderlyingValue(
      elementImpacted,
      "transform.translateX",
    );
    const translateYAtGrab = dragStyleController.getUnderlyingValue(
      elementImpacted,
      "transform.translateY",
    );
    dragGesture.addReleaseCallback(() => {
      if (resetPositionAfterRelease) {
        dragStyleController.clear(elementImpacted);
      } else {
        dragStyleController.commit(elementImpacted);
      }
    });

    let elementWidth;
    let elementHeight;
    {
      const updateElementDimension = () => {
        const elementRect = element.getBoundingClientRect();
        elementWidth = elementRect.width;
        elementHeight = elementRect.height;
      };
      updateElementDimension();
      dragGesture.addBeforeDragCallback(updateElementDimension);
    }

    let scrollArea;
    {
      // computed at start so that scrollWidth/scrollHeight are fixed
      // even if the dragging side effects increases them afterwards
      scrollArea = {
        left: 0,
        top: 0,
        right: scrollContainer.scrollWidth,
        bottom: scrollContainer.scrollHeight,
      };
    }

    let scrollport;
    let autoScrollArea;
    {
      // for visible are we also want to snapshot the widht/height
      // and we'll add scrollContainer container scrolls during drag (getScrollport does that)
      const scrollBox = getScrollBox(scrollContainer);
      const updateScrollportAndAutoScrollArea = () => {
        scrollport = getScrollport(scrollBox, scrollContainer);
        autoScrollArea = scrollport;
        if (stickyFrontiers) {
          autoScrollArea = applyStickyFrontiersToAutoScrollArea(
            autoScrollArea,
            {
              scrollContainer,
              direction},
          );
        }
        if (autoScrollAreaPadding > 0) {
          autoScrollArea = {
            paddingLeft: autoScrollAreaPadding,
            paddingTop: autoScrollAreaPadding,
            paddingRight: autoScrollAreaPadding,
            paddingBottom: autoScrollAreaPadding,
            left: autoScrollArea.left + autoScrollAreaPadding,
            top: autoScrollArea.top + autoScrollAreaPadding,
            right: autoScrollArea.right - autoScrollAreaPadding,
            bottom: autoScrollArea.bottom - autoScrollAreaPadding,
          };
        }
      };
      updateScrollportAndAutoScrollArea();
      dragGesture.addBeforeDragCallback(updateScrollportAndAutoScrollArea);
    }

    // Set up dragging attribute
    element.setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      element.removeAttribute("data-grabbed");
    });

    // Will be used for dynamic constraints on sticky elements
    let hasCrossedScrollportLeftOnce = false;
    let hasCrossedScrollportTopOnce = false;
    const dragConstraints = initDragConstraints(dragGesture, {
      areaConstraint,
      obstaclesContainer: obstaclesContainer || scrollContainer,
      obstacleAttributeName,
      showConstraintFeedbackLine,
      showDebugMarkers,
      referenceElement,
    });
    dragGesture.addBeforeDragCallback(
      (layoutRequested, currentLayout, limitLayout, { dragEvent }) => {
        dragConstraints.applyConstraints(
          layoutRequested,
          currentLayout,
          limitLayout,
          {
            elementWidth,
            elementHeight,
            scrollArea,
            scrollport,
            hasCrossedScrollportLeftOnce,
            hasCrossedScrollportTopOnce,
            autoScrollArea,
            dragEvent,
          },
        );
      },
    );

    const dragToMove = (gestureInfo) => {
      const { isGoingDown, isGoingUp, isGoingLeft, isGoingRight, layout } =
        gestureInfo;
      const left = layout.left;
      const top = layout.top;
      const right = left + elementWidth;
      const bottom = top + elementHeight;

      {
        hasCrossedScrollportLeftOnce =
          hasCrossedScrollportLeftOnce || left < scrollport.left;
        hasCrossedScrollportTopOnce =
          hasCrossedScrollportTopOnce || top < scrollport.top;

        const getScrollMove = (axis) => {
          const isGoingPositive = axis === "x" ? isGoingRight : isGoingDown;
          if (isGoingPositive) {
            const elementEnd = axis === "x" ? right : bottom;
            const autoScrollAreaEnd =
              axis === "x" ? autoScrollArea.right : autoScrollArea.bottom;

            if (elementEnd <= autoScrollAreaEnd) {
              return 0;
            }
            const scrollAmountNeeded = elementEnd - autoScrollAreaEnd;
            return scrollAmountNeeded;
          }

          const isGoingNegative = axis === "x" ? isGoingLeft : isGoingUp;
          if (!isGoingNegative) {
            return 0;
          }

          const referenceOrEl = referenceElement || element;
          const canAutoScrollNegative =
            axis === "x"
              ? !referenceOrEl.hasAttribute("data-sticky-left") ||
                hasCrossedScrollportLeftOnce
              : !referenceOrEl.hasAttribute("data-sticky-top") ||
                hasCrossedScrollportTopOnce;
          if (!canAutoScrollNegative) {
            return 0;
          }

          const elementStart = axis === "x" ? left : top;
          const autoScrollAreaStart =
            axis === "x" ? autoScrollArea.left : autoScrollArea.top;
          if (elementStart >= autoScrollAreaStart) {
            return 0;
          }

          const scrollAmountNeeded = autoScrollAreaStart - elementStart;
          return -scrollAmountNeeded;
        };

        let scrollLeftTarget;
        let scrollTopTarget;
        if (direction.x) {
          const containerScrollLeftMove = getScrollMove("x");
          if (containerScrollLeftMove) {
            scrollLeftTarget =
              scrollContainer.scrollLeft + containerScrollLeftMove;
          }
        }
        if (direction.y) {
          const containerScrollTopMove = getScrollMove("y");
          if (containerScrollTopMove) {
            scrollTopTarget =
              scrollContainer.scrollTop + containerScrollTopMove;
          }
        }
        // now we know what to do, do it
        if (scrollLeftTarget !== undefined) {
          scrollContainer.scrollLeft = scrollLeftTarget;
        }
        if (scrollTopTarget !== undefined) {
          scrollContainer.scrollTop = scrollTopTarget;
        }
      }

      {
        const { scrollableLeft, scrollableTop } = layout;
        const [positionedLeft, positionedTop] = convertScrollablePosition(
          scrollableLeft,
          scrollableTop,
        );
        const transform = {};
        if (direction.x) {
          const leftTarget = positionedLeft;
          const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
          const leftDelta = leftTarget - leftAtGrab;
          const translateX = translateXAtGrab
            ? translateXAtGrab + leftDelta
            : leftDelta;
          transform.translateX = translateX;
          // console.log({
          //   leftAtGrab,
          //   scrollableLeft,
          //   left,
          //   leftTarget,
          // });
        }
        if (direction.y) {
          const topTarget = positionedTop;
          const topAtGrab = dragGesture.gestureInfo.topAtGrab;
          const topDelta = topTarget - topAtGrab;
          const translateY = translateYAtGrab
            ? translateYAtGrab + topDelta
            : topDelta;
          transform.translateY = translateY;
        }
        dragStyleController.set(elementImpacted, {
          transform,
        });
      }
    };
    dragGesture.addDragCallback(dragToMove);
  };

  const dragGestureController = createDragGestureController(options);
  const grab = dragGestureController.grab;
  dragGestureController.grab = ({
    element,
    referenceElement,
    elementToMove,
    ...rest
  } = {}) => {
    const scrollContainer = getScrollContainer(referenceElement || element);
    const [
      elementScrollableLeft,
      elementScrollableTop,
      convertScrollablePosition,
    ] = createDragElementPositioner(element, referenceElement, elementToMove);
    const dragGesture = grab({
      element,
      scrollContainer,
      layoutScrollableLeft: elementScrollableLeft,
      layoutScrollableTop: elementScrollableTop,
      ...rest,
    });
    initGrabToMoveElement(dragGesture, {
      element,
      referenceElement,
      elementToMove,
      convertScrollablePosition,
    });
    return dragGesture;
  };

  return dragGestureController;
};

/**
 * Detects the drop target based on what element is actually under the mouse cursor.
 * Uses document.elementsFromPoint() to respect visual stacking order naturally.
 *
 * @param {Object} gestureInfo - Gesture information
 * @param {Element[]} targetElements - Array of potential drop target elements
 * @returns {Object|null} Drop target info with elementSide or null if no valid target found
 */
const getDropTargetInfo = (gestureInfo, targetElements) => {
  const dragElement = gestureInfo.element;
  const dragElementRect = dragElement.getBoundingClientRect();
  const intersectingTargets = [];
  let someTargetIsCol;
  let someTargetIsTr;
  for (const targetElement of targetElements) {
    const targetRect = targetElement.getBoundingClientRect();
    if (!rectangleAreIntersecting(dragElementRect, targetRect)) {
      continue;
    }
    if (!someTargetIsCol && targetElement.tagName === "COL") {
      someTargetIsCol = true;
    }
    if (!someTargetIsTr && targetElement.tagName === "TR") {
      someTargetIsTr = true;
    }
    intersectingTargets.push(targetElement);
  }

  if (intersectingTargets.length === 0) {
    return null;
  }

  const dragElementCenterX = dragElementRect.left + dragElementRect.width / 2;
  const dragElementCenterY = dragElementRect.top + dragElementRect.height / 2;
  // Clamp coordinates to viewport to avoid issues with elementsFromPoint
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const clientX =
    dragElementCenterX < 0
      ? 0
      : dragElementCenterX > viewportWidth
        ? viewportWidth - 1
        : dragElementCenterX;
  const clientY =
    dragElementCenterY < 0
      ? 0
      : dragElementCenterY > viewportHeight
        ? viewportHeight - 1
        : dragElementCenterY;

  // Find the first target element in the stack (topmost visible target)
  const elementsUnderDragElement = document.elementsFromPoint(clientX, clientY);
  let targetElement = null;
  let targetIndex = -1;
  for (const element of elementsUnderDragElement) {
    // First, check if the element itself is a target
    const directIndex = intersectingTargets.indexOf(element);
    if (directIndex !== -1) {
      targetElement = element;
      targetIndex = directIndex;
      break;
    }
    // Special case: if element is <td> or <th> and not in targets,
    // try to find its corresponding <col> element
    if (!isTableCell(element)) {
      continue;
    }
    try_col: {
      if (!someTargetIsCol) {
        break try_col;
      }
      const tableCellCol = findTableCellCol(element);
      if (!tableCellCol) {
        break try_col;
      }
      const colIndex = intersectingTargets.indexOf(tableCellCol);
      if (colIndex === -1) {
        break try_col;
      }
      targetElement = tableCellCol;
      targetIndex = colIndex;
      break;
    }
    try_tr: {
      if (!someTargetIsTr) {
        break try_tr;
      }
      const tableRow = element.closest("tr");
      const rowIndex = targetElements.indexOf(tableRow);
      if (rowIndex === -1) {
        break try_tr;
      }
      targetElement = tableRow;
      targetIndex = rowIndex;
      break;
    }
  }
  if (!targetElement) {
    targetElement = intersectingTargets[0];
    targetIndex = 0;
  }

  // Determine position within the target for both axes
  const targetRect = targetElement.getBoundingClientRect();
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const result = {
    index: targetIndex,
    element: targetElement,
    elementSide: {
      x: dragElementRect.left < targetCenterX ? "start" : "end",
      y: dragElementRect.top < targetCenterY ? "start" : "end",
    },
    intersecting: intersectingTargets,
  };
  return result;
};

const rectangleAreIntersecting = (r1, r2) => {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top > r1.bottom ||
    r2.bottom < r1.top
  );
};

const isTableCell = (el) => {
  return el.tagName === "TD" || el.tagName === "TH";
};

/**
 * Find the corresponding <col> element for a given <td> or <th> cell
 * @param {Element} cellElement - The <td> or <th> element
 * @param {Element[]} targetColElements - Array of <col> elements to search in
 * @returns {Element|null} The corresponding <col> element or null if not found
 */
const findTableCellCol = (cellElement) => {
  const table = cellElement.closest("table");
  const colgroup = table.querySelector("colgroup");
  if (!colgroup) {
    return null;
  }
  const cols = colgroup.querySelectorAll("col");
  const columnIndex = cellElement.cellIndex;
  const correspondingCol = cols[columnIndex];
  return correspondingCol;
};

const getHeight = (element) => {
  const { height } = element.getBoundingClientRect();
  return height;
};

const getWidth = (element) => {
  const { width } = element.getBoundingClientRect();
  return width;
};

const stickyAsRelativeCoords = (
  element,
  referenceElement,
  { scrollContainer = getScrollContainer(element) } = {},
) => {
  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasTopStickyAttribute = element.hasAttribute("data-sticky-top");
  if (!hasStickyLeftAttribute && !hasTopStickyAttribute) {
    return null;
  }
  const elementRect = element.getBoundingClientRect();
  const referenceElementRect = referenceElement.getBoundingClientRect();
  const computedStyle = getComputedStyle(element);
  const isDocumentScrolling = scrollContainer === document.documentElement;

  let leftPosition;
  let topPosition;
  if (isDocumentScrolling) {
    // For document scrolling: check if element is currently stuck and calculate offset

    if (hasStickyLeftAttribute) {
      const cssLeftValue = parseFloat(computedStyle.left) || 0;
      const isStuckLeft = elementRect.left <= cssLeftValue;
      if (isStuckLeft) {
        const elementOffsetRelative =
          elementRect.left - referenceElementRect.left;
        leftPosition = elementOffsetRelative - cssLeftValue;
      } else {
        leftPosition = 0;
      }
    }
    if (hasTopStickyAttribute) {
      const cssTopValue = parseFloat(computedStyle.top) || 0;
      const isStuckTop = elementRect.top <= cssTopValue;
      if (isStuckTop) {
        const elementOffsetRelative =
          elementRect.top - referenceElementRect.top;
        topPosition = elementOffsetRelative - cssTopValue;
      } else {
        topPosition = 0;
      }
    }
    return [leftPosition, topPosition];
  }

  // For container scrolling: check if element is currently stuck and calculate offset
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  if (hasStickyLeftAttribute) {
    const cssLeftValue = parseFloat(computedStyle.left) || 0;
    // Check if element is stuck to the left edge of the scrollable container
    const isStuckLeft =
      elementRect.left <= scrollContainerRect.left + cssLeftValue;
    if (isStuckLeft) {
      // Element is stuck - calculate its offset relative to reference element
      const elementOffsetRelative =
        elementRect.left - referenceElementRect.left;
      leftPosition = elementOffsetRelative - cssLeftValue;
    } else {
      // Element is not stuck - behaves like position: relative with no offset
      leftPosition = 0;
    }
  }
  if (hasTopStickyAttribute) {
    const cssTopValue = parseFloat(computedStyle.top) || 0;
    // Check if element is stuck to the top edge of the scrollable container
    const isStuckTop = elementRect.top <= scrollContainerRect.top + cssTopValue;
    if (isStuckTop) {
      // Element is stuck - calculate its offset relative to reference element
      const elementOffsetRelative = elementRect.top - referenceElementRect.top;
      topPosition = elementOffsetRelative - cssTopValue;
    } else {
      // Element is not stuck - behaves like position: relative with no offset
      topPosition = 0;
    }
  }
  return [leftPosition, topPosition];
};

// Creates a visible rect effect that tracks how much of an element is visible within its scrollable parent
// and within the document viewport. This is useful for implementing overlays, lazy loading, or any UI
// that needs to react to element visibility changes.
//
// The function returns two visibility ratios:
// - scrollVisibilityRatio: Visibility ratio relative to the scrollable parent (0-1)
// - visibilityRatio: Visibility ratio relative to the document viewport (0-1)
//
// When scrollable parent is the document, both ratios will be the same.
// When scrollable parent is a custom container, scrollVisibilityRatio might be 1.0 (fully visible
// within the container) while visibilityRatio could be 0.0 (container is scrolled out of viewport).
// A bit like https://tetherjs.dev/ but different
const visibleRectEffect = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollContainer = getScrollContainer(element);
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const check = (reason) => {

    // 1. Calculate element position relative to scrollable parent
    const { scrollLeft, scrollTop } = scrollContainer;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;

    // Get element position relative to its scrollable parent
    let elementAbsoluteLeft;
    let elementAbsoluteTop;
    if (scrollContainerIsDocument) {
      // For document scrolling, use offsetLeft/offsetTop relative to document
      const rect = element.getBoundingClientRect();
      elementAbsoluteLeft = rect.left + scrollLeft;
      elementAbsoluteTop = rect.top + scrollTop;
    } else {
      // For custom container, get position relative to the container
      const elementRect = element.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      elementAbsoluteLeft =
        elementRect.left - scrollContainerRect.left + scrollLeft;
      elementAbsoluteTop =
        elementRect.top - scrollContainerRect.top + scrollTop;
    }

    const leftVisible =
      visibleAreaLeft < elementAbsoluteLeft
        ? elementAbsoluteLeft - visibleAreaLeft
        : 0;
    const topVisible =
      visibleAreaTop < elementAbsoluteTop
        ? elementAbsoluteTop - visibleAreaTop
        : 0;
    // Convert to overlay coordinates (adjust for custom scrollable container)
    let overlayLeft = leftVisible;
    let overlayTop = topVisible;
    if (!scrollContainerIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollContainer.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }

    // 2. Calculate element visible width/height
    const { width, height } = element.getBoundingClientRect();
    const visibleAreaWidth = scrollContainer.clientWidth;
    const visibleAreaHeight = scrollContainer.clientHeight;
    const visibleAreaRight = visibleAreaLeft + visibleAreaWidth;
    const visibleAreaBottom = visibleAreaTop + visibleAreaHeight;
    // 2.1 Calculate visible width
    let widthVisible;
    {
      const maxVisibleWidth = visibleAreaWidth - leftVisible;
      const elementAbsoluteRight = elementAbsoluteLeft + width;
      const elementLeftIsVisible = elementAbsoluteLeft >= visibleAreaLeft;
      const elementRightIsVisible = elementAbsoluteRight <= visibleAreaRight;
      if (elementLeftIsVisible && elementRightIsVisible) {
        // Element fully visible horizontally
        widthVisible = width;
      } else if (elementLeftIsVisible && !elementRightIsVisible) {
        // Element left is visible, right is cut off
        widthVisible = visibleAreaRight - elementAbsoluteLeft;
      } else if (!elementLeftIsVisible && elementRightIsVisible) {
        // Element left is cut off, right is visible
        widthVisible = elementAbsoluteRight - visibleAreaLeft;
      } else {
        // Element spans beyond both sides, show only visible area portion
        widthVisible = maxVisibleWidth;
      }
    }
    // 2.2 Calculate visible height
    let heightVisible;
    {
      const maxVisibleHeight = visibleAreaHeight - topVisible;
      const elementAbsoluteBottom = elementAbsoluteTop + height;
      const elementTopIsVisible = elementAbsoluteTop >= visibleAreaTop;
      const elementBottomIsVisible = elementAbsoluteBottom <= visibleAreaBottom;
      if (elementTopIsVisible && elementBottomIsVisible) {
        // Element fully visible vertically
        heightVisible = height;
      } else if (elementTopIsVisible && !elementBottomIsVisible) {
        // Element top is visible, bottom is cut off
        heightVisible = visibleAreaBottom - elementAbsoluteTop;
      } else if (!elementTopIsVisible && elementBottomIsVisible) {
        // Element top is cut off, bottom is visible
        heightVisible = elementAbsoluteBottom - visibleAreaTop;
      } else {
        // Element spans beyond both sides, show only visible area portion
        heightVisible = maxVisibleHeight;
      }
    }

    // Calculate visibility ratios
    const scrollVisibilityRatio =
      (widthVisible * heightVisible) / (width * height);
    // Calculate visibility ratio relative to document viewport
    let documentVisibilityRatio;
    if (scrollContainerIsDocument) {
      documentVisibilityRatio = scrollVisibilityRatio;
    } else {
      // For custom containers, calculate visibility relative to document viewport
      const elementRect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      // Calculate how much of the element is visible in the document viewport
      const elementLeft = Math.max(0, elementRect.left);
      const elementTop = Math.max(0, elementRect.top);
      const elementRight = Math.min(viewportWidth, elementRect.right);
      const elementBottom = Math.min(viewportHeight, elementRect.bottom);
      const documentVisibleWidth = Math.max(0, elementRight - elementLeft);
      const documentVisibleHeight = Math.max(0, elementBottom - elementTop);
      documentVisibilityRatio =
        (documentVisibleWidth * documentVisibleHeight) / (width * height);
    }

    const visibleRect = {
      left: overlayLeft,
      top: overlayTop,
      right: overlayLeft + widthVisible,
      bottom: overlayTop + heightVisible,
      width: widthVisible,
      height: heightVisible,
      visibilityRatio: documentVisibilityRatio,
      scrollVisibilityRatio,
    };
    update(visibleRect, {
      width,
      height,
    });
  };

  check();

  const [publishBeforeAutoCheck, onBeforeAutoCheck] = createPubSub();
  {
    const autoCheck = (reason) => {
      const beforeCheckResults = publishBeforeAutoCheck(reason);
      check();
      for (const beforeCheckResult of beforeCheckResults) {
        if (typeof beforeCheckResult === "function") {
          beforeCheckResult();
        }
      }
    };
    // let rafId = null;
    // const scheduleCheck = (reason) => {
    //   cancelAnimationFrame(rafId);
    //   rafId = requestAnimationFrame(() => {
    //     autoCheck(reason);
    //   });
    // };
    // addTeardown(() => {
    //   cancelAnimationFrame(rafId);
    // });

    {
      // If scrollable parent is not document, also listen to document scroll
      // to update UI position when the scrollable parent moves in viewport
      const onDocumentScroll = () => {
        autoCheck("document_scroll");
      };
      document.addEventListener("scroll", onDocumentScroll, {
        passive: true,
      });
      addTeardown(() => {
        document.removeEventListener("scroll", onDocumentScroll, {
          passive: true,
        });
      });
      if (!scrollContainerIsDocument) {
        const onScroll = () => {
          autoCheck("scrollable_parent_scroll");
        };
        scrollContainer.addEventListener("scroll", onScroll, {
          passive: true,
        });
        addTeardown(() => {
          scrollContainer.removeEventListener("scroll", onScroll, {
            passive: true,
          });
        });
      }
    }
    {
      const onWindowResize = () => {
        autoCheck("window_size_change");
      };
      window.addEventListener("resize", onWindowResize);
      addTeardown(() => {
        window.removeEventListener("resize", onWindowResize);
      });
    }
    {
      const resizeObserver = new ResizeObserver(() => {
        {
          return;
        }
      });
      resizeObserver.observe(element);
      // Temporarily disconnect ResizeObserver to prevent feedback loops eventually caused by update function
      onBeforeAutoCheck(() => {
        resizeObserver.unobserve(element);
        return () => {
          // This triggers a new call to the resive observer that will be ignored thanks to
          // the widthDiff/heightDiff early return
          resizeObserver.observe(element);
        };
      });
      addTeardown(() => {
        resizeObserver.disconnect();
      });
    }
    {
      const documentIntersectionObserver = new IntersectionObserver(
        () => {
          autoCheck("element_intersection_with_document_change");
        },
        {
          root: null,
          rootMargin: "0px",
          threshold: [0, 0.1, 0.9, 1],
        },
      );
      documentIntersectionObserver.observe(element);
      addTeardown(() => {
        documentIntersectionObserver.disconnect();
      });
      if (!scrollContainerIsDocument) {
        const scrollIntersectionObserver = new IntersectionObserver(
          () => {
            autoCheck("element_intersection_with_scroll_change");
          },
          {
            root: scrollContainer,
            rootMargin: "0px",
            threshold: [0, 0, 1, 0.9, 1],
          },
        );
        scrollIntersectionObserver.observe(element);
        addTeardown(() => {
          scrollIntersectionObserver.disconnect();
        });
      }
    }
    {
      const onWindowTouchMove = () => {
        autoCheck("window_touchmove");
      };
      window.addEventListener("touchmove", onWindowTouchMove, {
        passive: true,
      });
      addTeardown(() => {
        window.removeEventListener("touchmove", onWindowTouchMove, {
          passive: true,
        });
      });
    }
  }

  return {
    check,
    onBeforeAutoCheck,
    disconnect: () => {
      teardown();
    },
  };
};

const pickPositionRelativeTo = (
  element,
  target,
  {
    alignToViewportEdgeWhenTargetNearEdge = 0,
    minLeft = 0,
    forcePosition,
  } = {},
) => {

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  // Get viewport-relative positions
  const elementRect = element.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const {
    left: elementLeft,
    right: elementRight,
    top: elementTop,
    bottom: elementBottom,
  } = elementRect;
  const {
    left: targetLeft,
    right: targetRight,
    top: targetTop,
    bottom: targetBottom,
  } = targetRect;
  const elementWidth = elementRight - elementLeft;
  const elementHeight = elementBottom - elementTop;
  const targetWidth = targetRight - targetLeft;

  // Calculate horizontal position (viewport-relative)
  let elementPositionLeft;
  {
    // Check if target element is wider than viewport
    const targetIsWiderThanViewport = targetWidth > viewportWidth;
    if (targetIsWiderThanViewport) {
      const targetLeftIsVisible = targetLeft >= 0;
      const targetRightIsVisible = targetRight <= viewportWidth;

      if (!targetLeftIsVisible && targetRightIsVisible) {
        // Target extends beyond left edge but right side is visible
        const viewportCenter = viewportWidth / 2;
        const distanceFromRightEdge = viewportWidth - targetRight;
        elementPositionLeft =
          viewportCenter - distanceFromRightEdge / 2 - elementWidth / 2;
      } else if (targetLeftIsVisible && !targetRightIsVisible) {
        // Target extends beyond right edge but left side is visible
        const viewportCenter = viewportWidth / 2;
        const distanceFromLeftEdge = -targetLeft;
        elementPositionLeft =
          viewportCenter - distanceFromLeftEdge / 2 - elementWidth / 2;
      } else {
        // Target extends beyond both edges or is fully visible (center in viewport)
        elementPositionLeft = viewportWidth / 2 - elementWidth / 2;
      }
    } else {
      // Target fits within viewport width - center element relative to target
      elementPositionLeft = targetLeft + targetWidth / 2 - elementWidth / 2;
      // Special handling when element is wider than target
      if (alignToViewportEdgeWhenTargetNearEdge) {
        const elementIsWiderThanTarget = elementWidth > targetWidth;
        const targetIsNearLeftEdge =
          targetLeft < alignToViewportEdgeWhenTargetNearEdge;
        if (elementIsWiderThanTarget && targetIsNearLeftEdge) {
          elementPositionLeft = minLeft; // Left edge of viewport
        }
      }
    }
    // Constrain horizontal position to viewport boundaries
    if (elementPositionLeft < 0) {
      elementPositionLeft = 0;
    } else if (elementPositionLeft + elementWidth > viewportWidth) {
      elementPositionLeft = viewportWidth - elementWidth;
    }
  }

  // Calculate vertical position (viewport-relative)
  let position;
  const spaceAboveTarget = targetTop;
  const spaceBelowTarget = viewportHeight - targetBottom;
  determine_position: {
    if (forcePosition) {
      position = forcePosition;
      break determine_position;
    }
    const preferredPosition = element.getAttribute("data-position");
    const minContentVisibilityRatio = 0.6; // 60% minimum visibility to keep position
    if (preferredPosition) {
      // Element has a preferred position - try to keep it unless we really struggle
      const visibleRatio =
        preferredPosition === "above"
          ? spaceAboveTarget / elementHeight
          : spaceBelowTarget / elementHeight;
      const canShowMinimumContent = visibleRatio >= minContentVisibilityRatio;
      if (canShowMinimumContent) {
        position = preferredPosition;
        break determine_position;
      }
    }
    // No preferred position - use original logic (prefer below, fallback to above if more space)
    const elementFitsBelow = spaceBelowTarget >= elementHeight;
    if (elementFitsBelow) {
      position = "below";
      break determine_position;
    }
    const hasMoreSpaceBelow = spaceBelowTarget >= spaceAboveTarget;
    position = hasMoreSpaceBelow ? "below" : "above";
  }

  let elementPositionTop;
  {
    if (position === "below") {
      // Calculate top position when placing below target (ensure whole pixels)
      const idealTopWhenBelow = targetBottom;
      elementPositionTop =
        idealTopWhenBelow % 1 === 0
          ? idealTopWhenBelow
          : Math.floor(idealTopWhenBelow) + 1;
    } else {
      // Calculate top position when placing above target
      const idealTopWhenAbove = targetTop - elementHeight;
      const minimumTopInViewport = 0;
      elementPositionTop =
        idealTopWhenAbove < minimumTopInViewport
          ? minimumTopInViewport
          : idealTopWhenAbove;
    }
  }

  // Get document scroll for final coordinate conversion
  const { scrollLeft, scrollTop } = document.documentElement;
  const elementDocumentLeft = elementPositionLeft + scrollLeft;
  const elementDocumentTop = elementPositionTop + scrollTop;
  const targetDocumentLeft = targetLeft + scrollLeft;
  const targetDocumentTop = targetTop + scrollTop;
  const targetDocumentRight = targetRight + scrollLeft;
  const targetDocumentBottom = targetBottom + scrollTop;

  return {
    position,
    left: elementDocumentLeft,
    top: elementDocumentTop,
    width: elementWidth,
    height: elementHeight,
    targetLeft: targetDocumentLeft,
    targetTop: targetDocumentTop,
    targetRight: targetDocumentRight,
    targetBottom: targetDocumentBottom,
    spaceAboveTarget,
    spaceBelowTarget,
  };
};

const parseTransform = (transform) => {
  if (!transform || transform === "none") return new Map();
  const transformMap = new Map();

  if (transform.startsWith("matrix(")) {
    // matrix(a, b, c, d, e, f) where e is translateX and f is translateY
    const values = transform
      .match(/matrix\((.*?)\)/)?.[1]
      .split(",")
      .map(Number);
    if (values) {
      const translateX = values[4]; // e value from matrix
      transformMap.set("translateX", { value: translateX, unit: "px" });
      return transformMap;
    }
  }

  // For direct transform functions (when set via style.transform)
  const matches = transform.matchAll(/(\w+)\(([-\d.]+)(%|px|deg)?\)/g);
  for (const match of matches) {
    const [, func, value, unit = ""] = match;
    transformMap.set(func, { value: parseFloat(value), unit });
  }
  return transformMap;
};

const EASING = {
  EASE_OUT: (x) => {
    return cubicBezier(x, 0, 0, 0.58, 1.0);
  }};

const cubicBezier = (t, initial, p1, p2, final) => {
  return (
    (1 - t) * (1 - t) * (1 - t) * initial +
    3 * (1 - t) * (1 - t) * t * p1 +
    3 * (1 - t) * t * t * p2 +
    t * t * t * final
  );
};

const getTimelineCurrentTime = () => {
  return document.timeline.currentTime;
};

const visualCallbackSet = new Set();
const backgroundCallbackSet = new Set();
const addOnTimeline = (callback, isVisual) => {
  {
    visualCallbackSet.add(callback);
  }
};
const removeFromTimeline = (callback, isVisual) => {
  {
    visualCallbackSet.delete(callback);
  }
};

// We need setTimeout to animate things like volume because requestAnimationFrame would be killed when tab is not visible
// while we might want to fadeout volumn when leaving the page for instance
const createBackgroundUpdateLoop = () => {
  let timeout;
  const update = () => {
    for (const backgroundCallback of backgroundCallbackSet) {
      backgroundCallback();
    }
    timeout = setTimeout(update, 16); // roughly 60fps
  };
  return {
    start: () => {
      timeout = setTimeout(update, 16);
    },
    stop: () => {
      clearTimeout(timeout);
    },
  };
};
// For visual things we use animation frame which is more performant and made for this
const createAnimationFrameLoop = () => {
  let animationFrame = null;
  const update = () => {
    for (const visualCallback of visualCallbackSet) {
      visualCallback();
    }
    animationFrame = requestAnimationFrame(update);
  };
  return {
    start: () => {
      animationFrame = requestAnimationFrame(update);
    },
    stop: () => {
      cancelAnimationFrame(animationFrame);
    },
  };
};
const backgroundUpdateLoop = createBackgroundUpdateLoop();
const animationUpdateLoop = createAnimationFrameLoop();

let timelineIsRunning = false;
const startTimeline = () => {
  if (timelineIsRunning) {
    return;
  }
  timelineIsRunning = true;
  backgroundUpdateLoop.start();
  animationUpdateLoop.start();
};
startTimeline();

// Default lifecycle methods that do nothing
const LIFECYCLE_DEFAULT = {
  setup: () => {},
  pause: () => {},
  cancel: () => {},
  finish: () => {},
  updateTarget: () => {},
};

const createTransition = ({
  constructor,
  key,
  from,
  to,
  lifecycle = LIFECYCLE_DEFAULT,
  onUpdate,
  minDiff,
  ...rest
} = {}) => {
  const [updateCallbacks, executeUpdateCallbacks] = createCallbackController();
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const channels = {
    update: updateCallbacks,
    finish: finishCallbacks,
  };
  if (onUpdate) {
    updateCallbacks.add(onUpdate);
  }

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let isFirstUpdate = false;
  let resume;
  let executionLifecycle = null;

  const start = () => {
    isFirstUpdate = true;
    playState = "running";

    executionLifecycle = lifecycle.setup(transition);

    // Allow setup to override from value if transition.from is undefined
    if (
      transition.from === undefined &&
      executionLifecycle.from !== undefined
    ) {
      transition.from = executionLifecycle.from;
    }

    const diff = Math.abs(transition.to - transition.from);
    if (diff === 0) {
      console.warn(
        `${constructor.name} transition has identical from and to values (${transition.from}). This transition will have no effect.`,
      );
    } else if (typeof minDiff === "number" && diff < minDiff) {
      console.warn(
        `${constructor.name} transition difference is very small (${diff}). Consider if this transition is necessary (minimum threshold: ${minDiff}).`,
      );
    }
    transition.update(transition.value);
  };

  const transition = {
    constructor,
    key,
    from,
    to,
    value: from,
    timing: "",
    channels,
    get playState() {
      return playState;
    },

    play: () => {
      if (playState === "idle") {
        transition.value = transition.from;
        transition.timing = "";
        start();
        return;
      }
      if (playState === "running") {
        console.warn("transition already running");
        return;
      }
      if (playState === "paused") {
        playState = "running";
        resume();
        return;
      }
      // "finished"
      start();
    },

    update: (value, isLast) => {
      if (playState === "idle") {
        console.warn("Cannot update transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update a finished transition");
        return;
      }

      transition.value = value;
      transition.timing = isLast ? "end" : isFirstUpdate ? "start" : "progress";
      isFirstUpdate = false;
      executionLifecycle.update(transition);
      executeUpdateCallbacks(transition);
    },

    pause: () => {
      if (playState === "paused") {
        console.warn("transition already paused");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot pause a finished transition");
        return;
      }
      playState = "paused";

      // Let the transition handle its own pause logic
      resume = lifecycle.pause(transition);
    },

    cancel: () => {
      if (executionLifecycle) {
        lifecycle.cancel(transition);
        executionLifecycle.teardown();
        executionLifecycle.restore();
      }
      resume = null;
      playState = "idle";
    },

    finish: () => {
      if (playState === "idle") {
        console.warn("Cannot finish a transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("transition already finished");
        return;
      }
      // "running" or "paused"
      lifecycle.finish(transition);
      executionLifecycle.teardown();
      resume = null;
      playState = "finished";
      executeFinishCallbacks();
    },

    reverse: () => {
      if (playState === "idle") {
        console.warn("Cannot reverse a transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot reverse a finished transition");
        return;
      }

      // Simply swap from and to values to reverse direction
      const originalFrom = transition.from;
      const originalTo = transition.to;

      transition.from = originalTo;
      transition.to = originalFrom;

      // Let the transition handle its own reverse logic (if any)
      if (lifecycle.reverse) {
        lifecycle.reverse(transition);
      }
    },

    updateTarget: (newTarget) => {
      if (
        typeof newTarget !== "number" ||
        isNaN(newTarget) ||
        !isFinite(newTarget)
      ) {
        throw new Error(
          `updateTarget: newTarget must be a finite number, got ${newTarget}`,
        );
      }
      if (playState === "idle") {
        console.warn("Cannot update target of idle transition");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update target of finished transition");
        return;
      }
      const currentValue = transition.value;
      transition.from = currentValue;
      transition.to = newTarget;

      // Let the transition handle its own target update logic
      lifecycle.updateTarget(transition);
    },

    ...rest,
  };

  return transition;
};

// Timeline-managed transition that adds/removes itself from the animation timeline
const createTimelineTransition = ({
  isVisual,
  duration,
  fps = 60,
  easing = EASING.EASE_OUT,
  lifecycle,
  startProgress = 0, // Progress to start from (0-1)
  ...options
}) => {
  if (typeof duration !== "number" || duration <= 0) {
    throw new Error(
      `Invalid duration: ${duration}. Duration must be a positive number.`,
    );
  }

  let lastUpdateTime = -1;

  const timeChangeCallback = () => {
    const timelineCurrentTime = getTimelineCurrentTime();
    const msElapsedSinceStart = timelineCurrentTime - transition.startTime;
    const msRemaining = transition.duration - msElapsedSinceStart;

    if (
      // we reach the end, round progress to 1
      msRemaining < 0 ||
      // we are very close from the end, round progress to 1
      msRemaining <= transition.frameDuration
    ) {
      transition.frameRemainingCount = 0;
      transition.progress = 1;
      transition.update(transition.to, true);
      transition.finish();
      return;
    }
    if (lastUpdateTime === -1) ; else {
      const timeSinceLastUpdate = timelineCurrentTime - lastUpdateTime;
      // Allow rendering if we're within 3ms of the target frame duration
      // This prevents choppy animations when browser timing is slightly off
      const frameTimeTolerance = 3; // ms
      const targetFrameTime = transition.frameDuration - frameTimeTolerance;

      // Skip update only if we're significantly early
      if (timeSinceLastUpdate < targetFrameTime) {
        return;
      }
    }
    lastUpdateTime = timelineCurrentTime;
    const rawProgress = Math.min(msElapsedSinceStart / transition.duration, 1);
    // Apply start progress offset - transition runs from startProgress to 1
    const progress = startProgress + rawProgress * (1 - startProgress);
    transition.progress = progress;
    const easedProgress = transition.easing(progress);
    const value =
      transition.from + (transition.to - transition.from) * easedProgress;
    transition.frameRemainingCount = Math.ceil(
      msRemaining / transition.frameDuration,
    );
    transition.update(value);
  };
  const onTimelineNeeded = () => {
    addOnTimeline(timeChangeCallback);
  };
  const onTimelineNotNeeded = () => {
    removeFromTimeline(timeChangeCallback);
  };

  const { setup } = lifecycle;
  const transition = createTransition({
    ...options,
    startTime: null,
    progress: startProgress, // Initialize with start progress
    duration,
    easing,
    fps,
    get frameDuration() {
      return 1000 / fps;
    },
    frameRemainingCount: 0,
    startProgress, // Store for calculations
    lifecycle: {
      ...lifecycle,
      setup: (transition) => {
        // Handle timeline management
        lastUpdateTime = -1;
        transition.startTime = getTimelineCurrentTime();
        // Calculate remaining frames based on remaining progress
        const remainingProgress = 1 - startProgress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
        onTimelineNeeded();
        // Call the original setup
        return setup(transition);
      },
      pause: (transition) => {
        const pauseTime = getTimelineCurrentTime();
        onTimelineNotNeeded();
        return () => {
          const pausedDuration = getTimelineCurrentTime() - pauseTime;
          transition.startTime += pausedDuration;
          // Only adjust lastUpdateTime if it was set (not -1)
          if (lastUpdateTime !== -1) {
            lastUpdateTime += pausedDuration;
          }
          onTimelineNeeded();
        };
      },
      updateTarget: (transition) => {
        transition.startTime = getTimelineCurrentTime();
        // Don't reset lastUpdateTime - we want visual continuity for smooth target updates
        // Recalculate remaining frames from current progress
        const remainingProgress = 1 - transition.progress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
      },
      cancel: () => {
        onTimelineNotNeeded();
      },
      finish: () => {
        onTimelineNotNeeded();
      },
    },
  });
  return transition;
};

const createCallbackController = () => {
  const callbackSet = new Set();
  const execute = (...args) => {
    for (const callback of callbackSet) {
      callback(...args);
    }
  };
  const callbacks = {
    add: (callback) => {
      if (typeof callback !== "function") {
        throw new TypeError("Callback must be a function");
      }
      callbackSet.add(callback);
      return () => {
        callbackSet.delete(callback);
      };
    },
  };
  return [callbacks, execute];
};

installImportMetaCss(import.meta);
import.meta.css = /* css */ `
  /* Transition data attributes override inline styles using CSS custom properties */
  *[data-transition-opacity] {
    opacity: var(--ui-transition-opacity) !important;
  }

  *[data-transition-translate-x] {
    transform: translateX(var(--ui-transition-translate-x)) !important;
  }

  *[data-transition-width] {
    width: var(--ui-transition-width) !important;
  }

  *[data-transition-height] {
    height: var(--ui-transition-height) !important;
  }
`;

const createHeightTransition = (element, to, options) => {
  const heightTransition = createTimelineTransition({
    ...options,
    constructor: createHeightTransition,
    key: element,
    to,
    isVisual: true,
    minDiff: 10,
    lifecycle: {
      setup: () => {
        const restoreWillChange = addWillChange(element, "height");
        return {
          from: getHeight(element),
          update: ({ value }) => {
            const valueWithUnit = `${value}px`;
            element.setAttribute("data-transition-height", valueWithUnit);
            element.style.setProperty("--ui-transition-height", valueWithUnit);
          },
          teardown: () => {
            element.removeAttribute("data-transition-height");
            element.style.removeProperty("--ui-transition-height");
            restoreWillChange();
          },
          restore: () => {
            element.removeAttribute("data-transition-height");
            element.style.removeProperty("--ui-transition-height");
          },
        };
      },
    },
  });
  return heightTransition;
};
const createWidthTransition = (element, to, options) => {
  const widthTransition = createTimelineTransition({
    ...options,
    constructor: createWidthTransition,
    key: element,
    to,
    minDiff: 10,
    isVisual: true,
    lifecycle: {
      setup: () => {
        const restoreWillChange = addWillChange(element, "width");
        return {
          from: getWidth(element),
          update: ({ value }) => {
            const valueWithUnit = `${value}px`;
            element.setAttribute("data-transition-width", valueWithUnit);
            element.style.setProperty("--ui-transition-width", valueWithUnit);
          },
          teardown: () => {
            element.removeAttribute("data-transition-width");
            element.style.removeProperty("--ui-transition-width");
            restoreWillChange();
          },
          restore: () => {
            element.removeAttribute("data-transition-width");
            element.style.removeProperty("--ui-transition-width");
          },
        };
      },
    },
  });
  return widthTransition;
};
const createOpacityTransition = (element, to, options = {}) => {
  const opacityTransition = createTimelineTransition({
    ...options,
    constructor: createOpacityTransition,
    key: element,
    to,
    minDiff: 0.1,
    isVisual: true,
    lifecycle: {
      setup: () => {
        const restoreWillChange = addWillChange(element, "opacity");
        return {
          from: getOpacity(element),
          update: ({ value }) => {
            element.setAttribute("data-transition-opacity", value);
            element.style.setProperty("--ui-transition-opacity", value);
          },
          teardown: () => {
            element.removeAttribute("data-transition-opacity");
            element.style.removeProperty("--ui-transition-opacity");
            restoreWillChange();
          },
          restore: () => {
            element.removeAttribute("data-transition-opacity");
            element.style.removeProperty("--ui-transition-opacity");
          },
        };
      },
    },
  });
  return opacityTransition;
};
const getOpacity = (element) => {
  return parseFloat(getComputedStyle(element).opacity) || 0;
};

const createTranslateXTransition = (element, to, options) => {
  let unit = "px";
  if (typeof to === "string") {
    if (to.endsWith("%")) {
      unit = "%";
    }
    to = parseFloat(to);
  }

  const translateXTransition = createTimelineTransition({
    ...options,
    constructor: createTranslateXTransition,
    key: element,
    to,
    minDiff: 10,
    isVisual: true,
    lifecycle: {
      setup: () => {
        const restoreWillChange = addWillChange(element, "transform");
        return {
          from: getTranslateX(element),
          update: ({ value }) => {
            const valueWithUnit = `${value}${unit}`;
            element.setAttribute("data-transition-translate-x", valueWithUnit);
            element.style.setProperty(
              "--ui-transition-translate-x",
              valueWithUnit,
            );
          },
          teardown: () => {
            restoreWillChange();
            element.removeAttribute("data-transition-translate-x");
            element.style.removeProperty("--ui-transition-translate-x");
          },
          restore: () => {
            element.removeAttribute("data-transition-translate-x");
            element.style.removeProperty("--ui-transition-translate-x");
          },
        };
      },
    },
  });
  return translateXTransition;
};
const getTranslateX = (element) => {
  const transform = getComputedStyle(element).transform;
  const transformMap = parseTransform(transform);
  return transformMap.get("translateX")?.value || 0;
};

// Helper functions for getting natural (non-transition) values
const getOpacityWithoutTransition = (element) => {
  const transitionOpacity = element.getAttribute("data-transition-opacity");

  // Temporarily remove transition attribute
  element.removeAttribute("data-transition-opacity");

  const naturalValue = parseFloat(getComputedStyle(element).opacity) || 0;

  // Restore transition attribute if it existed
  if (transitionOpacity !== null) {
    element.setAttribute("data-transition-opacity", transitionOpacity);
  }

  return naturalValue;
};

const getTranslateXWithoutTransition = (element) => {
  const transitionTranslateX = element.getAttribute(
    "data-transition-translate-x",
  );

  // Temporarily remove transition attribute
  element.removeAttribute("data-transition-translate-x");

  const transform = getComputedStyle(element).transform;
  const transformMap = parseTransform(transform);
  const naturalValue = transformMap.get("translateX")?.value || 0;

  // Restore transition attribute if it existed
  if (transitionTranslateX !== null) {
    element.setAttribute("data-transition-translate-x", transitionTranslateX);
  }

  return naturalValue;
};

// transition that manages multiple transitions
const createGroupTransition = (transitionArray) => {
  let finishedCount = 0;
  let duration = 0;
  let childCount = transitionArray.length;
  for (const childTransition of transitionArray) {
    if (childTransition.duration > duration) {
      duration = childTransition.duration;
    }
  }

  const groupTransition = createTransition({
    constructor: createGroupTransition,
    from: 0,
    to: 1,
    duration,
    lifecycle: {
      setup: (transition) => {
        finishedCount = 0;

        const cleanupCallbackSet = new Set();
        for (const childTransition of transitionArray) {
          const removeFinishListener = childTransition.channels.finish.add(
            // eslint-disable-next-line no-loop-func
            () => {
              finishedCount++;
              const allFinished = finishedCount === childCount;
              if (allFinished) {
                transition.finish();
              }
            },
          );
          cleanupCallbackSet.add(removeFinishListener);
          childTransition.play();

          const removeUpdateListener = childTransition.channels.update.add(
            () => {
              // Calculate average progress (handle undefined progress)
              let totalProgress = 0;
              let progressCount = 0;
              for (const t of transitionArray) {
                if (typeof t.progress === "number") {
                  totalProgress += t.progress;
                  progressCount++;
                }
              }
              const averageProgress =
                progressCount > 0 ? totalProgress / progressCount : 0;
              // Expose progress on the group transition for external access
              transition.progress = averageProgress;
              // Update this transition's value with average progress
              const isLast = averageProgress >= 1;
              transition.update(averageProgress, isLast);
            },
          );
          cleanupCallbackSet.add(removeUpdateListener);
        }

        return {
          update: () => {},
          teardown: () => {
            for (const cleanupCallback of cleanupCallbackSet) {
              cleanupCallback();
            }
            cleanupCallbackSet.clear();
          },
          restore: () => {},
        };
      },
      pause: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState === "running") {
            childTransition.pause();
          }
        }
        return () => {
          for (const childTransition of transitionArray) {
            if (childTransition.playState === "paused") {
              childTransition.play();
            }
          }
        };
      },

      cancel: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState !== "idle") {
            childTransition.cancel();
          }
        }
      },

      finish: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState !== "finished") {
            childTransition.finish();
          }
        }
      },

      reverse: () => {
        for (const childTransition of transitionArray) {
          if (
            childTransition.playState === "running" ||
            childTransition.playState === "paused"
          ) {
            childTransition.reverse();
          }
        }
      },
    },
  });
  return groupTransition;
};

/**
 * Creates an interface that manages ongoing transitions
 * and handles target updates automatically
 */
const createGroupTransitionController = () => {
  // Track all active transitions for cancellation and matching
  const activeTransitions = new Set();

  return {
    /**
     * Animate multiple transitions simultaneously
     * Automatically handles updateTarget for transitions that match constructor + targetKey
     * @param {Array} transitions - Array of transition objects with constructor and targetKey properties
     * @param {Object} options - Transition options
     * @param {Function} options.onChange - Called with (changeEntries, isLast) during transition
     * @param {Function} options.onFinish - Called when all transitions complete
     * @returns {Object} Playback controller with play(), pause(), cancel(), etc.
     */
    animate: (transitions, options = {}) => {
      const { onChange, onFinish } = options;

      if (transitions.length === 0) {
        // No transitions to animate, call onFinish immediately
        if (onFinish) {
          onFinish([]);
        }
        return {
          play: () => {},
          pause: () => {},
          cancel: () => {},
          finish: () => {},
          playState: "idle",
          channels: { update: { add: () => {} }, finish: { add: () => {} } },
        };
      }

      const newTransitions = [];
      const updatedTransitions = [];

      // Separate transitions into new vs updates to existing ones
      for (const transition of transitions) {
        // Look for existing transition with same constructor and targetKey
        let existingTransition = null;
        for (const transitionCandidate of activeTransitions) {
          if (
            transitionCandidate.constructor === transition.constructor &&
            transitionCandidate.key === transition.key
          ) {
            existingTransition = transitionCandidate;
            break;
          }
        }

        if (existingTransition && existingTransition.playState === "running") {
          // Update the existing transition's target if it supports updateTarget
          if (existingTransition.updateTarget) {
            existingTransition.updateTarget(transition.to);
          }
          updatedTransitions.push(existingTransition);
        } else {
          // Track this new transition
          activeTransitions.add(transition);
          // Clean up tracking when transition finishes
          transition.channels.finish.add(() => {
            activeTransitions.delete(transition);
          });

          newTransitions.push(transition);
        }
      }

      // If we only have updated transitions (no new ones), return a minimal controller
      if (newTransitions.length === 0) {
        return {
          play: () => {}, // Already playing
          pause: () =>
            updatedTransitions.forEach((transition) => transition.pause()),
          cancel: () =>
            updatedTransitions.forEach((transition) => transition.cancel()),
          finish: () =>
            updatedTransitions.forEach((transition) => transition.finish()),
          reverse: () =>
            updatedTransitions.forEach((transition) => transition.reverse()),
          playState: "running", // All are already running
          channels: {
            update: { add: () => {} }, // Update tracking already set up
            finish: { add: () => {} },
          },
        };
      }

      // Create group transition to coordinate new transitions only
      const groupTransition = createGroupTransition(newTransitions);

      // Add unified update tracking for ALL transitions (new + updated)
      if (onChange) {
        groupTransition.channels.update.add((transition) => {
          // Build change entries for current state of ALL transitions
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );

          const isLast = transition.value >= 1; // isLast = value >= 1 (since group tracks 0-1)
          onChange(changeEntries, isLast);
        });
      }

      // Add finish tracking
      if (onFinish) {
        groupTransition.channels.finish.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );
          onFinish(changeEntries);
        });
      }

      return groupTransition;
    },

    /**
     * Cancel all ongoing transitions managed by this controller
     */
    cancel: () => {
      // Cancel all active transitions
      for (const transition of activeTransitions) {
        if (
          transition.playState === "running" ||
          transition.playState === "paused"
        ) {
          transition.cancel();
        }
      }
      // Clear the sets - the finish callbacks will handle individual cleanup
      activeTransitions.clear();
    },
  };
};

const getPaddingSizes = (element) => {
  const { paddingLeft, paddingRight, paddingTop, paddingBottom } =
    window.getComputedStyle(element, null);
  return {
    left: parseFloat(paddingLeft),
    right: parseFloat(paddingRight),
    top: parseFloat(paddingTop),
    bottom: parseFloat(paddingBottom),
  };
};

const resolveCSSSize = (
  size,
  { availableSize, fontSize, autoIsRelativeToFont } = {},
) => {
  if (typeof size === "string") {
    if (size === "auto") {
      return autoIsRelativeToFont ? fontSize : availableSize;
    }
    if (size.endsWith("%")) {
      return availableSize * (parseFloat(size) / 100);
    }
    if (size.endsWith("px")) {
      return parseFloat(size);
    }
    if (size.endsWith("em")) {
      return parseFloat(size) * fontSize;
    }
    if (size.endsWith("rem")) {
      return (
        parseFloat(size) * getComputedStyle(document.documentElement).fontSize
      );
    }
    if (size.endsWith("vw")) {
      return (parseFloat(size) / 100) * window.innerWidth;
    }
    if (size.endsWith("vh")) {
      return (parseFloat(size) / 100) * window.innerHeight;
    }
    return parseFloat(size);
  }
  return size;
};

const getInnerWidth = (element) => {
  // Always subtract paddings and borders to get the content width
  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const width = getWidth(element);
  const horizontalSpaceTakenByPaddings = paddingSizes.left + paddingSizes.right;
  const horizontalSpaceTakenByBorders = borderSizes.left + borderSizes.right;
  const innerWidth =
    width - horizontalSpaceTakenByPaddings - horizontalSpaceTakenByBorders;
  return innerWidth;
};

installImportMetaCss(import.meta);
import.meta.css = /* css */ `
  .ui_transition_container {
    display: inline-flex;
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .ui_transition_outer_wrapper {
    display: inline-flex;
    flex: 1;
  }

  .ui_transition_measure_wrapper {
    overflow: hidden;
    display: inline-flex;
    flex: 1;
  }

  .ui_transition_slot {
    position: relative;
    display: inline-flex;
    flex: 1;
  }

  .ui_transition_phase_overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .ui_transition_content_overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
`;

const DEBUG$3 = {
  size: false,
  transition: false,
  transition_updates: false,
};

// Utility function to format content key states consistently for debug logs
const formatContentKeyState = (contentKey, hasChild, hasTextNode = false) => {
  if (hasTextNode) {
    return "[text]";
  }
  if (!hasChild) {
    return "[empty]";
  }
  if (contentKey === null || contentKey === undefined) {
    return "[unkeyed]";
  }
  return `[data-content-key="${contentKey}"]`;
};

const SIZE_TRANSITION_DURATION = 150; // Default size transition duration
const SIZE_DIFF_EPSILON = 0.5; // Ignore size transition when difference below this (px)
const CONTENT_TRANSITION = "cross-fade"; // Default content transition type
const CONTENT_TRANSITION_DURATION = 300; // Default content transition duration
const PHASE_TRANSITION = "cross-fade";
const PHASE_TRANSITION_DURATION = 300; // Default phase transition duration

const initUITransition = (container) => {
  const localDebug = {
    ...DEBUG$3,
    transition: container.hasAttribute("data-debug-transition"),
  };

  const debug = (type, ...args) => {
    if (localDebug[type]) {
      console.debug(`[${type}]`, ...args);
    }
  };

  if (!container.classList.contains("ui_transition_container")) {
    console.error("Element must have ui_transition_container class");
    return { cleanup: () => {} };
  }

  const outerWrapper = container.querySelector(".ui_transition_outer_wrapper");
  const measureWrapper = container.querySelector(
    ".ui_transition_measure_wrapper",
  );
  const slot = container.querySelector(".ui_transition_slot");
  let phaseOverlay = measureWrapper.querySelector(
    ".ui_transition_phase_overlay",
  );
  let contentOverlay = container.querySelector(
    ".ui_transition_content_overlay",
  );

  if (!phaseOverlay) {
    phaseOverlay = document.createElement("div");
    phaseOverlay.className = "ui_transition_phase_overlay";
    measureWrapper.appendChild(phaseOverlay);
  }
  if (!contentOverlay) {
    contentOverlay = document.createElement("div");
    contentOverlay.className = "ui_transition_content_overlay";
    container.appendChild(contentOverlay);
  }

  if (
    !outerWrapper ||
    !measureWrapper ||
    !slot ||
    !phaseOverlay ||
    !contentOverlay
  ) {
    console.error("Missing required ui-transition structure");
    return { cleanup: () => {} };
  }

  const transitionController = createGroupTransitionController();

  // Transition state
  let activeContentTransition = null;
  let activeContentTransitionType = null;
  let activePhaseTransition = null;
  let activePhaseTransitionType = null;
  let isPaused = false;

  // Size state
  let naturalContentWidth = 0; // Natural size of actual content (not loading/error states)
  let naturalContentHeight = 0;
  let constrainedWidth = 0; // Current constrained dimensions (what outer wrapper is set to)
  let constrainedHeight = 0;
  let sizeTransition = null;
  let resizeObserver = null;
  let sizeHoldActive = false; // Hold previous dimensions during content transitions when size transitions are disabled

  // Prevent reacting to our own constrained size changes while animating
  let suppressResizeObserver = false;
  let pendingResizeSync = false; // ensure one measurement after suppression ends

  // Handle size updates based on content state
  let hasSizeTransitions = container.hasAttribute("data-size-transition");
  const initialTransitionEnabled = container.hasAttribute(
    "data-initial-transition",
  );
  let hasPopulatedOnce = false; // track if we've already populated once (null → something)

  // Child state
  let lastContentKey = null;
  let previousChild = null;
  let isContentPhase = false; // Current state: true when showing content phase (loading/error)
  let wasContentPhase = false; // Previous state for comparison

  const measureContentSize = () => {
    return [getWidth(measureWrapper), getHeight(measureWrapper)];
  };

  const updateContentDimensions = () => {
    const [newWidth, newHeight] = measureContentSize();
    debug("size", "Content size changed:", {
      width: `${naturalContentWidth} → ${newWidth}`,
      height: `${naturalContentHeight} → ${newHeight}`,
    });

    updateNaturalContentSize(newWidth, newHeight);

    if (sizeTransition) {
      debug("size", "Updating animation target:", newHeight);
      updateToSize(newWidth, newHeight);
    } else {
      constrainedWidth = newWidth;
      constrainedHeight = newHeight;
    }
  };

  const stopResizeObserver = () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  };

  const startResizeObserver = () => {
    resizeObserver = new ResizeObserver(() => {
      if (!hasSizeTransitions) {
        return;
      }
      if (suppressResizeObserver) {
        pendingResizeSync = true;
        debug("size", "Resize ignored (suppressed during size transition)");
        return;
      }
      updateContentDimensions();
    });
    resizeObserver.observe(measureWrapper);
  };

  const releaseConstraints = (reason) => {
    debug("size", `Releasing constraints (${reason})`);
    const [beforeWidth, beforeHeight] = measureContentSize();
    outerWrapper.style.width = "";
    outerWrapper.style.height = "";
    outerWrapper.style.overflow = "";
    const [afterWidth, afterHeight] = measureContentSize();
    debug("size", "Size after release:", {
      width: `${beforeWidth} → ${afterWidth}`,
      height: `${beforeHeight} → ${afterHeight}`,
    });
    constrainedWidth = afterWidth;
    constrainedHeight = afterHeight;
    naturalContentWidth = afterWidth;
    naturalContentHeight = afterHeight;
    // Defer a sync if suppression just ended; actual dispatch will come from resize observer
    if (!suppressResizeObserver && pendingResizeSync) {
      pendingResizeSync = false;
      updateContentDimensions();
    }
  };

  const updateToSize = (targetWidth, targetHeight) => {
    if (
      constrainedWidth === targetWidth &&
      constrainedHeight === targetHeight
    ) {
      return;
    }

    const shouldAnimate = container.hasAttribute("data-size-transition");
    const widthDiff = Math.abs(targetWidth - constrainedWidth);
    const heightDiff = Math.abs(targetHeight - constrainedHeight);

    if (widthDiff <= SIZE_DIFF_EPSILON && heightDiff <= SIZE_DIFF_EPSILON) {
      // Both diffs negligible; just sync styles if changed and bail
      if (widthDiff > 0) {
        outerWrapper.style.width = `${targetWidth}px`;
        constrainedWidth = targetWidth;
      }
      if (heightDiff > 0) {
        outerWrapper.style.height = `${targetHeight}px`;
        constrainedHeight = targetHeight;
      }
      debug(
        "size",
        `Skip size animation entirely (diffs width:${widthDiff.toFixed(4)}px height:${heightDiff.toFixed(4)}px)`,
      );
      return;
    }

    if (!shouldAnimate) {
      // No size transitions - just update dimensions instantly
      debug("size", "Updating size instantly:", {
        width: `${constrainedWidth} → ${targetWidth}`,
        height: `${constrainedHeight} → ${targetHeight}`,
      });
      suppressResizeObserver = true;
      outerWrapper.style.width = `${targetWidth}px`;
      outerWrapper.style.height = `${targetHeight}px`;
      constrainedWidth = targetWidth;
      constrainedHeight = targetHeight;
      // allow any resize notifications to settle then re-enable
      requestAnimationFrame(() => {
        suppressResizeObserver = false;
        if (pendingResizeSync) {
          pendingResizeSync = false;
          updateContentDimensions();
        }
      });
      return;
    }

    // Animated size transition
    debug("size", "Animating size:", {
      width: `${constrainedWidth} → ${targetWidth}`,
      height: `${constrainedHeight} → ${targetHeight}`,
    });

    const duration = parseInt(
      container.getAttribute("data-size-transition-duration") ||
        SIZE_TRANSITION_DURATION,
    );

    outerWrapper.style.overflow = "hidden";
    const transitions = [];

    // heightDiff & widthDiff already computed earlier in updateToSize when deciding to skip entirely
    if (heightDiff <= SIZE_DIFF_EPSILON) {
      // Treat as identical
      if (heightDiff > 0) {
        debug(
          "size",
          `Skip height transition (negligible diff ${heightDiff.toFixed(4)}px)`,
        );
      }
      outerWrapper.style.height = `${targetHeight}px`;
      constrainedHeight = targetHeight;
    } else if (targetHeight !== constrainedHeight) {
      transitions.push(
        createHeightTransition(outerWrapper, targetHeight, {
          duration,
          onUpdate: ({ value }) => {
            constrainedHeight = value;
          },
        }),
      );
    }

    if (widthDiff <= SIZE_DIFF_EPSILON) {
      if (widthDiff > 0) {
        debug(
          "size",
          `Skip width transition (negligible diff ${widthDiff.toFixed(4)}px)`,
        );
      }
      outerWrapper.style.width = `${targetWidth}px`;
      constrainedWidth = targetWidth;
    } else if (targetWidth !== constrainedWidth) {
      transitions.push(
        createWidthTransition(outerWrapper, targetWidth, {
          duration,
          onUpdate: ({ value }) => {
            constrainedWidth = value;
          },
        }),
      );
    }

    if (transitions.length > 0) {
      suppressResizeObserver = true;
      sizeTransition = transitionController.animate(transitions, {
        onFinish: () => {
          releaseConstraints("animated size transition completed");
          // End suppression next frame to avoid RO loop warnings
          requestAnimationFrame(() => {
            suppressResizeObserver = false;
            if (pendingResizeSync) {
              pendingResizeSync = false;
              updateContentDimensions();
            }
          });
        },
      });
      sizeTransition.play();
    } else {
      debug(
        "size",
        "No size transitions created (identical or negligible differences)",
      );
    }
  };

  const applySizeConstraints = (targetWidth, targetHeight) => {
    debug("size", "Applying size constraints:", {
      width: `${constrainedWidth} → ${targetWidth}`,
      height: `${constrainedHeight} → ${targetHeight}`,
    });

    outerWrapper.style.width = `${targetWidth}px`;
    outerWrapper.style.height = `${targetHeight}px`;
    outerWrapper.style.overflow = "hidden";
    constrainedWidth = targetWidth;
    constrainedHeight = targetHeight;
  };

  const updateNaturalContentSize = (newWidth, newHeight) => {
    debug("size", "Updating natural content size:", {
      width: `${naturalContentWidth} → ${newWidth}`,
      height: `${naturalContentHeight} → ${newHeight}`,
    });
    naturalContentWidth = newWidth;
    naturalContentHeight = newHeight;
  };

  let isUpdating = false;

  // Shared transition setup function
  const setupTransition = ({
    isPhaseTransition = false,
    overlay,
    existingOldContents,
    needsOldChildClone,
    previousChild,
    firstChild,
    attributeToRemove = [],
  }) => {
    let oldChild = null;
    let cleanup = () => {};
    const currentTransitionElement = existingOldContents[0];

    if (currentTransitionElement) {
      oldChild = currentTransitionElement;
      debug(
        "transition",
        `Continuing from current ${isPhaseTransition ? "phase" : "content"} transition element`,
      );
      cleanup = () => oldChild.remove();
    } else if (needsOldChildClone) {
      overlay.innerHTML = "";

      // Clone the individual element for the transition
      oldChild = previousChild.cloneNode(true);

      // Remove specified attributes
      attributeToRemove.forEach((attr) => oldChild.removeAttribute(attr));

      oldChild.setAttribute("data-ui-transition-old", "");
      overlay.appendChild(oldChild);
      debug(
        "transition",
        `Cloned previous child for ${isPhaseTransition ? "phase" : "content"} transition:`,
        previousChild.getAttribute("data-ui-name") || "unnamed",
      );
      cleanup = () => oldChild.remove();
    } else {
      overlay.innerHTML = "";
      debug(
        "transition",
        `No old child to clone for ${isPhaseTransition ? "phase" : "content"} transition`,
      );
    }

    // Determine which elements to return based on transition type:
    // - Phase transitions: operate on individual elements (cross-fade between specific elements)
    // - Content transitions: operate at container level (slide entire containers, outlive content phases)
    let oldElement;
    let newElement;
    if (isPhaseTransition) {
      // Phase transitions work on individual elements
      oldElement = oldChild;
      newElement = firstChild;
    } else {
      // Content transitions work at container level and can outlive content phase changes
      oldElement = oldChild ? overlay : null;
      newElement = firstChild ? measureWrapper : null;
    }

    return {
      oldChild,
      cleanup,
      oldElement,
      newElement,
    };
  };

  // Initialize with current size
  [constrainedWidth, constrainedHeight] = measureContentSize();

  const handleChildSlotMutation = (reason = "mutation") => {
    if (isUpdating) {
      debug("transition", "Preventing recursive update");
      return;
    }

    hasSizeTransitions = container.hasAttribute("data-size-transition");

    try {
      isUpdating = true;
      const firstChild = slot.children[0] || null;
      const childUIName = firstChild?.getAttribute("data-ui-name");
      if (localDebug.transition) {
        const updateLabel =
          childUIName ||
          (firstChild ? "data-ui-name not specified" : "cleared/empty");
        console.group(`UI Update: ${updateLabel} (reason: ${reason})`);
      }

      // Check for text nodes in the slot (not supported)
      const hasTextNode = Array.from(slot.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
      if (hasTextNode) {
        console.warn(
          "UI Transition: Text nodes in transition slots are not supported. Please wrap text content in an element.",
          { slot, textContent: slot.textContent.trim() },
        );
      }

      // Check for multiple elements in the slot (not supported yet)
      const hasMultipleElements = slot.children.length > 1;
      if (hasMultipleElements) {
        console.warn(
          "UI Transition: Multiple elements in transition slots are not supported yet. Please use a single container element.",
          { slot, elementCount: slot.children.length },
        );
      }

      // Prefer data-content-key on child, fallback to slot
      let currentContentKey = null;
      let slotContentKey = slot.getAttribute("data-content-key");
      let childContentKey = firstChild?.getAttribute("data-content-key");
      if (childContentKey && slotContentKey) {
        console.warn(
          "Both data-content-key found on child and ui_transition_slot. Using child value.",
          { childContentKey, slotContentKey },
        );
      }
      currentContentKey = childContentKey || slotContentKey || null;

      // Determine transition scenarios early for early registration check
      const hadChild = previousChild !== null;
      const hasChild = firstChild !== null;

      // Check for text nodes in previous state (reconstruct from previousChild)
      const hadTextNode =
        previousChild && previousChild.nodeType === Node.TEXT_NODE;

      // Compute formatted content key states ONCE per mutation (requirement: max 2 calls)
      const previousContentKeyState = formatContentKeyState(
        lastContentKey,
        hadChild,
        hadTextNode,
      );
      const currentContentKeyState = formatContentKeyState(
        currentContentKey,
        hasChild,
        hasTextNode,
      );

      // Track previous key before any potential early registration update
      const prevKeyBeforeRegistration = lastContentKey;

      // Prepare phase info early so logging can be unified (even for early return)
      wasContentPhase = isContentPhase;
      isContentPhase = firstChild
        ? firstChild.hasAttribute("data-content-phase")
        : true; // empty (no child) is treated as content phase

      const previousIsContentPhase = !hadChild || wasContentPhase;
      const currentIsContentPhase = !hasChild || isContentPhase;

      // Early conceptual registration path: empty slot, text nodes, or multiple elements (no visual transition)
      const shouldGiveUpEarlyAndJustRegister =
        (!hadChild && !hasChild && !hasTextNode) ||
        hasTextNode ||
        hasMultipleElements;
      let earlyAction = null;
      if (shouldGiveUpEarlyAndJustRegister) {
        if (hasTextNode) {
          earlyAction = "text_nodes_unsupported";
        } else if (hasMultipleElements) {
          earlyAction = "multiple_elements_unsupported";
        } else {
          const prevKey = prevKeyBeforeRegistration;
          const keyChanged = prevKey !== currentContentKey;
          if (!keyChanged) {
            earlyAction = "unchanged";
          } else if (prevKey === null && currentContentKey !== null) {
            earlyAction = "registered";
          } else if (prevKey !== null && currentContentKey === null) {
            earlyAction = "cleared";
          } else {
            earlyAction = "changed";
          }
        }
        // Will update lastContentKey after unified logging
      }

      // Decide which representation to display for previous/current in early case
      const conceptualPrevDisplay =
        prevKeyBeforeRegistration === null
          ? "[unkeyed]"
          : `[data-content-key="${prevKeyBeforeRegistration}"]`;
      const conceptualCurrentDisplay =
        currentContentKey === null
          ? "[unkeyed]"
          : `[data-content-key="${currentContentKey}"]`;
      const previousDisplay = shouldGiveUpEarlyAndJustRegister
        ? conceptualPrevDisplay
        : previousContentKeyState;
      const currentDisplay = shouldGiveUpEarlyAndJustRegister
        ? conceptualCurrentDisplay
        : currentContentKeyState;

      // Build a simple descriptive sentence
      let contentKeysSentence = `Content key: ${previousDisplay} → ${currentDisplay}`;
      debug("transition", contentKeysSentence);

      if (shouldGiveUpEarlyAndJustRegister) {
        // Log decision explicitly (was previously embedded)
        debug("transition", `Decision: EARLY_RETURN (${earlyAction})`);
        // Register new conceptual key & return early (skip rest of transition logic)
        lastContentKey = currentContentKey;
        if (localDebug.transition) {
          console.groupEnd();
        }
        return;
      }
      debug(
        "size",
        `Update triggered, size: ${constrainedWidth}x${constrainedHeight}`,
      );

      if (sizeTransition) {
        sizeTransition.cancel();
      }

      const [newWidth, newHeight] = measureContentSize();
      debug("size", `Measured size: ${newWidth}x${newHeight}`);
      outerWrapper.style.width = `${constrainedWidth}px`;
      outerWrapper.style.height = `${constrainedHeight}px`;

      // Handle resize observation
      stopResizeObserver();
      if (firstChild && !isContentPhase) {
        startResizeObserver();
        debug("size", "Observing child resize");
      }

      // Determine transition scenarios (hadChild/hasChild already computed above for logging)

      /**
       * Content Phase Logic: Why empty slots are treated as content phases
       *
       * When there is no child element (React component returns null), it is considered
       * that the component does not render anything temporarily. This might be because:
       * - The component is loading but does not have a loading state
       * - The component has an error but does not have an error state
       * - The component is conceptually unloaded (underlying content was deleted/is not accessible)
       *
       * This represents a phase of the given content: having nothing to display.
       *
       * We support transitions between different contents via the ability to set
       * [data-content-key] on the ".ui_transition_slot". This is also useful when you want
       * all children of a React component to inherit the same data-content-key without
       * explicitly setting the attribute on each child element.
       */

      // Content key change when either slot or child has data-content-key and it changed
      let shouldDoContentTransition = false;
      if (
        (slot.getAttribute("data-content-key") ||
          firstChild?.getAttribute("data-content-key")) &&
        lastContentKey !== null
      ) {
        shouldDoContentTransition = currentContentKey !== lastContentKey;
      }

      const becomesEmpty = hadChild && !hasChild;
      const becomesPopulated = !hadChild && hasChild;
      const isInitialPopulationWithoutTransition =
        becomesPopulated && !hasPopulatedOnce && !initialTransitionEnabled;

      // Content phase change: any transition between content/content-phase/null except when slot key changes
      // This includes: null→loading, loading→content, content→loading, loading→null, etc.
      const shouldDoPhaseTransition =
        !shouldDoContentTransition &&
        (becomesPopulated ||
          becomesEmpty ||
          (hadChild &&
            hasChild &&
            (previousIsContentPhase !== currentIsContentPhase ||
              (previousIsContentPhase && currentIsContentPhase))));

      const contentChange = hadChild && hasChild && shouldDoContentTransition;
      const phaseChange = hadChild && hasChild && shouldDoPhaseTransition;

      // Determine if we only need to preserve an existing content transition (no new change)
      const preserveOnlyContentTransition =
        activeContentTransition !== null &&
        !shouldDoContentTransition &&
        !shouldDoPhaseTransition &&
        !becomesPopulated &&
        !becomesEmpty;

      // Include becomesPopulated in content transition only if it's not a phase transition
      const shouldDoContentTransitionIncludingPopulation =
        shouldDoContentTransition ||
        (becomesPopulated && !shouldDoPhaseTransition);

      const decisions = [];
      if (shouldDoContentTransition) decisions.push("CONTENT TRANSITION");
      if (shouldDoPhaseTransition) decisions.push("PHASE TRANSITION");
      if (preserveOnlyContentTransition)
        decisions.push("PRESERVE CONTENT TRANSITION");
      if (decisions.length === 0) decisions.push("NO TRANSITION");

      debug("transition", `Decision: ${decisions.join(" + ")}`);
      if (preserveOnlyContentTransition) {
        const progress = (activeContentTransition.progress * 100).toFixed(1);
        debug(
          "transition",
          `Preserving existing content transition (progress ${progress}%)`,
        );
      }

      // Early return optimization: if no transition decision and we are not continuing
      // an existing active content transition (animationProgress > 0), we can skip
      // all transition setup logic below.
      if (
        decisions.length === 1 &&
        decisions[0] === "NO TRANSITION" &&
        activeContentTransition === null &&
        activePhaseTransition === null
      ) {
        debug(
          "transition",
          `Early return: no transition or continuation required`,
        );
        // Still ensure size logic executes below (so do not return before size alignment)
      }

      // Handle initial population skip (first null → something): no content or size animations
      if (isInitialPopulationWithoutTransition) {
        debug(
          "transition",
          "Initial population detected: skipping transitions (opt-in with data-initial-transition)",
        );

        // Apply sizes instantly, no animation
        if (isContentPhase) {
          applySizeConstraints(newWidth, newHeight);
        } else {
          updateNaturalContentSize(newWidth, newHeight);
          releaseConstraints("initial population - skip transitions");
        }

        // Register state and mark initial population done
        previousChild = firstChild;
        lastContentKey = currentContentKey;
        hasPopulatedOnce = true;
        if (localDebug.transition) {
          console.groupEnd();
        }
        return;
      }

      // Plan size transition upfront; execution will happen after content/phase transitions
      let sizePlan = {
        action: "none",
        targetWidth: constrainedWidth,
        targetHeight: constrainedHeight,
      };

      size_transition: {
        const getTargetDimensions = () => {
          if (!isContentPhase) {
            return [newWidth, newHeight];
          }
          const shouldUseNewDimensions =
            naturalContentWidth === 0 && naturalContentHeight === 0;
          const targetWidth = shouldUseNewDimensions
            ? newWidth
            : naturalContentWidth || newWidth;
          const targetHeight = shouldUseNewDimensions
            ? newHeight
            : naturalContentHeight || newHeight;
          return [targetWidth, targetHeight];
        };

        const [targetWidth, targetHeight] = getTargetDimensions();
        sizePlan.targetWidth = targetWidth;
        sizePlan.targetHeight = targetHeight;

        if (
          targetWidth === constrainedWidth &&
          targetHeight === constrainedHeight
        ) {
          debug("size", "No size change required");
          // We'll handle potential constraint release in final section (if not holding)
          break size_transition;
        }

        debug("size", "Size change needed:", {
          width: `${constrainedWidth} → ${targetWidth}`,
          height: `${constrainedHeight} → ${targetHeight}`,
        });

        if (isContentPhase) {
          // Content phases (loading/error) always use size constraints for consistent sizing
          sizePlan.action = hasSizeTransitions ? "animate" : "applyConstraints";
        } else {
          // Actual content: update natural content dimensions for future content phases
          updateNaturalContentSize(targetWidth, targetHeight);
          sizePlan.action = hasSizeTransitions ? "animate" : "release";
        }
      }

      content_transition: {
        // Handle content transitions (slide-left, cross-fade for content key changes)
        if (
          decisions.length === 1 &&
          decisions[0] === "NO TRANSITION" &&
          activeContentTransition === null &&
          activePhaseTransition === null
        ) {
          // Skip creating any new transitions entirely
        } else if (
          shouldDoContentTransitionIncludingPopulation &&
          !preserveOnlyContentTransition
        ) {
          const existingOldContents = contentOverlay.querySelectorAll(
            "[data-ui-transition-old]",
          );
          const animationProgress = activeContentTransition?.progress || 0;

          if (animationProgress > 0) {
            debug(
              "transition",
              `Preserving content transition progress: ${(animationProgress * 100).toFixed(1)}%`,
            );
          }

          const newTransitionType =
            container.getAttribute("data-content-transition") ||
            CONTENT_TRANSITION;
          const canContinueSmoothly =
            activeContentTransitionType === newTransitionType &&
            activeContentTransition;

          if (canContinueSmoothly) {
            debug(
              "transition",
              "Continuing with same content transition type (restarting due to actual change)",
            );
            activeContentTransition.cancel();
          } else if (
            activeContentTransition &&
            activeContentTransitionType !== newTransitionType
          ) {
            debug(
              "transition",
              "Different content transition type, keeping both",
              `${activeContentTransitionType} → ${newTransitionType}`,
            );
          } else if (activeContentTransition) {
            debug("transition", "Cancelling current content transition");
            activeContentTransition.cancel();
          }

          const needsOldChildClone =
            (contentChange || becomesEmpty) &&
            previousChild &&
            !existingOldContents[0];

          const duration = parseInt(
            container.getAttribute("data-content-transition-duration") ||
              CONTENT_TRANSITION_DURATION,
          );
          const type =
            container.getAttribute("data-content-transition") ||
            CONTENT_TRANSITION;

          const setupContentTransition = () =>
            setupTransition({
              isPhaseTransition: false,
              overlay: contentOverlay,
              existingOldContents,
              needsOldChildClone,
              previousChild,
              firstChild,
              attributeToRemove: ["data-content-key"],
            });

          // If size transitions are disabled and the new content is smaller,
          // hold the previous size to avoid cropping during the transition.
          if (!hasSizeTransitions) {
            const willShrinkWidth = constrainedWidth > newWidth;
            const willShrinkHeight = constrainedHeight > newHeight;
            sizeHoldActive = willShrinkWidth || willShrinkHeight;
            if (sizeHoldActive) {
              debug(
                "size",
                `Holding previous size during content transition: ${constrainedWidth}x${constrainedHeight}`,
              );
              applySizeConstraints(constrainedWidth, constrainedHeight);
            }
          }

          activeContentTransition = animateTransition(
            transitionController,
            firstChild,
            setupContentTransition,
            {
              duration,
              type,
              animationProgress,
              isPhaseTransition: false,
              fromContentKeyState: previousContentKeyState,
              toContentKeyState: currentContentKeyState,
              onComplete: () => {
                activeContentTransition = null;
                activeContentTransitionType = null;
                if (sizeHoldActive) {
                  // Release the hold after the content transition completes
                  releaseConstraints(
                    "content transition completed - release size hold",
                  );
                  sizeHoldActive = false;
                }
              },
              debug,
            },
          );

          if (activeContentTransition) {
            activeContentTransition.play();
          }
          activeContentTransitionType = type;
        } else if (
          !shouldDoContentTransition &&
          !preserveOnlyContentTransition
        ) {
          // Clean up content overlay if no content transition needed and nothing to preserve
          contentOverlay.innerHTML = "";
          activeContentTransition = null;
          activeContentTransitionType = null;
        }

        // Handle phase transitions (cross-fade for content phase changes)
        if (shouldDoPhaseTransition) {
          const phaseTransitionType =
            container.getAttribute("data-phase-transition") || PHASE_TRANSITION;

          const existingOldPhaseContents = phaseOverlay.querySelectorAll(
            "[data-ui-transition-old]",
          );
          const phaseAnimationProgress = activePhaseTransition?.progress || 0;

          if (phaseAnimationProgress > 0) {
            debug(
              "transition",
              `Preserving phase transition progress: ${(phaseAnimationProgress * 100).toFixed(1)}%`,
            );
          }

          const canContinueSmoothly =
            activePhaseTransitionType === phaseTransitionType &&
            activePhaseTransition;

          if (canContinueSmoothly) {
            debug("transition", "Continuing with same phase transition type");
            activePhaseTransition.cancel();
          } else if (
            activePhaseTransition &&
            activePhaseTransitionType !== phaseTransitionType
          ) {
            debug(
              "transition",
              "Different phase transition type, keeping both",
              `${activePhaseTransitionType} → ${phaseTransitionType}`,
            );
          } else if (activePhaseTransition) {
            debug("transition", "Cancelling current phase transition");
            activePhaseTransition.cancel();
          }

          const needsOldPhaseClone =
            (becomesEmpty || becomesPopulated || phaseChange) &&
            previousChild &&
            !existingOldPhaseContents[0];

          const phaseDuration = parseInt(
            container.getAttribute("data-phase-transition-duration") ||
              PHASE_TRANSITION_DURATION,
          );

          const setupPhaseTransition = () =>
            setupTransition({
              isPhaseTransition: true,
              overlay: phaseOverlay,
              existingOldContents: existingOldPhaseContents,
              needsOldChildClone: needsOldPhaseClone,
              previousChild,
              firstChild,
              attributeToRemove: ["data-content-key", "data-content-phase"],
            });

          const fromPhase = !hadChild
            ? "null"
            : wasContentPhase
              ? "content-phase"
              : "content";
          const toPhase = !hasChild
            ? "null"
            : isContentPhase
              ? "content-phase"
              : "content";

          debug(
            "transition",
            `Starting phase transition: ${fromPhase} → ${toPhase}`,
          );

          activePhaseTransition = animateTransition(
            transitionController,
            firstChild,
            setupPhaseTransition,
            {
              duration: phaseDuration,
              type: phaseTransitionType,
              animationProgress: phaseAnimationProgress,
              isPhaseTransition: true,
              fromContentKeyState: previousContentKeyState,
              toContentKeyState: currentContentKeyState,
              onComplete: () => {
                activePhaseTransition = null;
                activePhaseTransitionType = null;
                debug("transition", "Phase transition complete");
              },
              debug,
            },
          );

          if (activePhaseTransition) {
            activePhaseTransition.play();
          }
          activePhaseTransitionType = phaseTransitionType;
        }
      }

      // Store current child for next transition
      previousChild = firstChild;
      lastContentKey = currentContentKey;
      if (becomesPopulated) {
        hasPopulatedOnce = true;
      }

      // Execute planned size action, unless holding size during a content transition
      if (!sizeHoldActive) {
        if (
          sizePlan.targetWidth === constrainedWidth &&
          sizePlan.targetHeight === constrainedHeight
        ) {
          // no size changes planned; possibly release constraints
          if (!isContentPhase) {
            releaseConstraints("no size change needed");
          }
        } else if (sizePlan.action === "animate") {
          updateToSize(sizePlan.targetWidth, sizePlan.targetHeight);
        } else if (sizePlan.action === "applyConstraints") {
          applySizeConstraints(sizePlan.targetWidth, sizePlan.targetHeight);
        } else if (sizePlan.action === "release") {
          releaseConstraints("actual content - no size transitions needed");
        }
      }
    } finally {
      isUpdating = false;
      if (localDebug.transition) {
        console.groupEnd();
      }
    }
  };

  // Run once at init to process current slot content (warnings, sizing, transitions)
  handleChildSlotMutation("init");

  // Watch for child changes and attribute changes on children
  const mutationObserver = new MutationObserver((mutations) => {
    let childListMutation = false;
    const attributeMutationSet = new Set();

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        childListMutation = true;
        continue;
      }
      if (mutation.type === "attributes") {
        const { attributeName, target } = mutation;
        if (
          attributeName === "data-content-key" ||
          attributeName === "data-content-phase"
        ) {
          attributeMutationSet.add(attributeName);
          debug(
            "transition",
            `Attribute change detected: ${attributeName} on`,
            target.getAttribute("data-ui-name") || "element",
          );
        }
      }
    }

    if (!childListMutation && attributeMutationSet.size === 0) {
      return;
    }
    const reasonParts = [];
    if (childListMutation) {
      reasonParts.push("childList change");
    }
    if (attributeMutationSet.size) {
      for (const attr of attributeMutationSet) {
        reasonParts.push(`[${attr}] change`);
      }
    }
    const reason = reasonParts.join("+");
    handleChildSlotMutation(reason);
  });

  mutationObserver.observe(slot, {
    childList: true,
    attributes: true,
    attributeFilter: ["data-content-key", "data-content-phase"],
    characterData: false,
  });

  // Return API
  return {
    slot,

    cleanup: () => {
      mutationObserver.disconnect();
      stopResizeObserver();
      if (sizeTransition) {
        sizeTransition.cancel();
      }
      if (activeContentTransition) {
        activeContentTransition.cancel();
      }
      if (activePhaseTransition) {
        activePhaseTransition.cancel();
      }
    },
    pause: () => {
      if (activeContentTransition?.pause) {
        activeContentTransition.pause();
        isPaused = true;
      }
      if (activePhaseTransition?.pause) {
        activePhaseTransition.pause();
        isPaused = true;
      }
    },
    resume: () => {
      if (activeContentTransition?.play && isPaused) {
        activeContentTransition.play();
        isPaused = false;
      }
      if (activePhaseTransition?.play && isPaused) {
        activePhaseTransition.play();
        isPaused = false;
      }
    },
    getState: () => ({
      isPaused,
      contentTransitionInProgress: activeContentTransition !== null,
      phaseTransitionInProgress: activePhaseTransition !== null,
    }),
  };
};

const animateTransition = (
  transitionController,
  newChild,
  setupTransition,
  {
    type,
    duration,
    animationProgress = 0,
    isPhaseTransition,
    onComplete,
    fromContentKeyState,
    toContentKeyState,
    debug,
  },
) => {
  let transitionType;
  if (type === "cross-fade") {
    transitionType = crossFade;
  } else if (type === "slide-left") {
    transitionType = slideLeft;
  } else {
    return null;
  }

  const { cleanup, oldElement, newElement } = setupTransition();
  // Use precomputed content key states (expected to be provided by caller)
  const fromContentKey = fromContentKeyState;
  const toContentKey = toContentKeyState;

  debug("transition", "Setting up animation:", {
    type,
    from: fromContentKey,
    to: toContentKey,
    progress: `${(animationProgress * 100).toFixed(1)}%`,
  });

  const remainingDuration = Math.max(100, duration * (1 - animationProgress));
  debug("transition", `Animation duration: ${remainingDuration}ms`);

  const transitions = transitionType.apply(oldElement, newElement, {
    duration: remainingDuration,
    startProgress: animationProgress,
    isPhaseTransition,
    debug,
  });

  debug(
    "transition",
    `Created ${transitions.length} transition(s) for animation`,
  );

  if (transitions.length === 0) {
    debug("transition", "No transitions to animate, cleaning up immediately");
    cleanup();
    onComplete?.();
    return null;
  }

  const groupTransition = transitionController.animate(transitions, {
    onFinish: () => {
      groupTransition.cancel();
      cleanup();
      onComplete?.();
    },
  });

  return groupTransition;
};

const slideLeft = {
  name: "slide-left",
  apply: (
    oldElement,
    newElement,
    { duration, startProgress = 0, isPhaseTransition = false, debug },
  ) => {
    if (!oldElement && !newElement) {
      return [];
    }

    if (!newElement) {
      // Content -> Empty (slide out left only)
      const currentPosition = getTranslateX(oldElement);
      const containerWidth = getInnerWidth(oldElement.parentElement);
      const from = currentPosition;
      const to = -containerWidth;
      debug("transition", "Slide out to empty:", { from, to });

      return [
        createTranslateXTransition(oldElement, to, {
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Slide out progress:", value);
            if (timing === "end") {
              debug("transition", "Slide out complete");
            }
          },
        }),
      ];
    }

    if (!oldElement) {
      // Empty -> Content (slide in from right)
      const containerWidth = getInnerWidth(newElement.parentElement);
      const from = containerWidth; // Start from right edge for slide-in effect
      const to = getTranslateXWithoutTransition(newElement);
      debug("transition", "Slide in from empty:", { from, to });
      return [
        createTranslateXTransition(newElement, to, {
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Slide in progress:", value);
            if (timing === "end") {
              debug("transition", "Slide in complete");
            }
          },
        }),
      ];
    }

    // Content -> Content (slide left)
    // The old content (oldElement) slides OUT to the left
    // The new content (newElement) slides IN from the right

    // Get positions for the slide animation
    const containerWidth = getInnerWidth(newElement.parentElement);
    const oldContentPosition = getTranslateX(oldElement);
    const currentNewPosition = getTranslateX(newElement);
    const naturalNewPosition = getTranslateXWithoutTransition(newElement);

    // For smooth continuation: if newElement is mid-transition,
    // calculate new position to maintain seamless sliding
    let startNewPosition;
    if (currentNewPosition !== 0 && naturalNewPosition === 0) {
      startNewPosition = currentNewPosition + containerWidth;
      debug(
        "transition",
        "Calculated seamless position:",
        `${currentNewPosition} + ${containerWidth} = ${startNewPosition}`,
      );
    } else {
      startNewPosition = naturalNewPosition || containerWidth;
    }

    // For phase transitions, force new content to start from right edge for proper slide-in
    const effectiveFromPosition = isPhaseTransition
      ? containerWidth
      : startNewPosition;

    debug("transition", "Slide transition:", {
      oldContent: `${oldContentPosition} → ${-containerWidth}`,
      newContent: `${effectiveFromPosition} → ${naturalNewPosition}`,
    });

    const transitions = [];

    // Slide old content out
    transitions.push(
      createTranslateXTransition(oldElement, -containerWidth, {
        from: oldContentPosition,
        duration,
        startProgress,
        onUpdate: ({ value }) => {
          debug("transition_updates", "Old content slide out:", value);
        },
      }),
    );

    // Slide new content in
    transitions.push(
      createTranslateXTransition(newElement, naturalNewPosition, {
        from: effectiveFromPosition,
        duration,
        startProgress,
        onUpdate: ({ value, timing }) => {
          debug("transition_updates", "New content slide in:", value);
          if (timing === "end") {
            debug("transition", "Slide complete");
          }
        },
      }),
    );

    return transitions;
  },
};

const crossFade = {
  name: "cross-fade",
  apply: (
    oldElement,
    newElement,
    { duration, startProgress = 0, isPhaseTransition = false, debug },
  ) => {
    if (!oldElement && !newElement) {
      return [];
    }

    if (!newElement) {
      // Content -> Empty (fade out only)
      const from = getOpacity(oldElement);
      const to = 0;
      debug("transition", "Fade out to empty:", { from, to });
      return [
        createOpacityTransition(oldElement, to, {
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Content fade out:", value.toFixed(3));
            if (timing === "end") {
              debug("transition", "Fade out complete");
            }
          },
        }),
      ];
    }

    if (!oldElement) {
      // Empty -> Content (fade in only)
      const from = 0;
      const to = getOpacityWithoutTransition(newElement);
      debug("transition", "Fade in from empty:", { from, to });
      return [
        createOpacityTransition(newElement, to, {
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Fade in progress:", value.toFixed(3));
            if (timing === "end") {
              debug("transition", "Fade in complete");
            }
          },
        }),
      ];
    }

    // Content -> Content (cross-fade)
    // Get current opacity for both elements
    const oldOpacity = getOpacity(oldElement);
    const newOpacity = getOpacity(newElement);
    const newNaturalOpacity = getOpacityWithoutTransition(newElement);

    // For phase transitions, always start new content from 0 for clean visual transition
    // For content transitions, check for ongoing transitions to continue smoothly
    let effectiveFromOpacity;
    if (isPhaseTransition) {
      effectiveFromOpacity = 0; // Always start fresh for phase transitions (loading → content, etc.)
    } else {
      // For content transitions: if new element has ongoing opacity transition
      // (indicated by non-zero opacity when natural opacity is different),
      // start from current opacity to continue smoothly, otherwise start from 0
      const hasOngoingTransition =
        newOpacity !== newNaturalOpacity && newOpacity > 0;
      effectiveFromOpacity = hasOngoingTransition ? newOpacity : 0;
    }

    debug("transition", "Cross-fade transition:", {
      oldOpacity: `${oldOpacity} → 0`,
      newOpacity: `${effectiveFromOpacity} → ${newNaturalOpacity}`,
      isPhaseTransition,
    });

    return [
      createOpacityTransition(oldElement, 0, {
        from: oldOpacity,
        duration,
        startProgress,
        onUpdate: ({ value }) => {
          if (value > 0) {
            debug(
              "transition_updates",
              "Old content fade out:",
              value.toFixed(3),
            );
          }
        },
      }),
      createOpacityTransition(newElement, newNaturalOpacity, {
        from: effectiveFromOpacity,
        duration,
        startProgress: isPhaseTransition ? 0 : startProgress, // Phase transitions: new content always starts fresh
        onUpdate: ({ value, timing }) => {
          debug("transition_updates", "New content fade in:", value.toFixed(3));
          if (timing === "end") {
            debug("transition", "Cross-fade complete");
          }
        },
      }),
    ];
  },
};

const prefixFirstAndIndentRemainingLines = (
  text,
  { prefix, indentation, trimLines, trimLastLine },
) => {
  const lines = text.split(/\r?\n/);
  const firstLine = lines.shift();
  if (indentation === undefined) {
    {
      indentation = "  "; // prefix + space
    }
  }
  let result = prefix ? `${prefix} ${firstLine}` : firstLine;
  let i = 0;
  while (i < lines.length) {
    const line = trimLines ? lines[i].trim() : lines[i];
    i++;
    result += line.length
      ? `\n${indentation}${line}`
      : trimLastLine && i === lines.length
        ? ""
        : `\n`;
  }
  return result;
};

const actionPrivatePropertiesWeakMap = new WeakMap();
const getActionPrivateProperties = (action) => {
  const actionPrivateProperties = actionPrivatePropertiesWeakMap.get(action);
  if (!actionPrivateProperties) {
    throw new Error(`Cannot find action private properties for "${action}"`);
  }
  return actionPrivateProperties;
};
const setActionPrivateProperties = (action, properties) => {
  actionPrivatePropertiesWeakMap.set(action, properties);
};

const IDLE = { id: "idle" };
const RUNNING = { id: "running" };
const ABORTED = { id: "aborted" };
const FAILED = { id: "failed" };
const COMPLETED = { id: "completed" };

const SYMBOL_OBJECT_SIGNAL = Symbol.for("navi_object_signal");

const isSignal = (value) => {
  return getSignalType(value) !== null;
};

const BRAND_SYMBOL = Symbol.for("preact-signals");
const getSignalType = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (value.brand !== BRAND_SYMBOL) {
    return null;
  }

  if (typeof value._fn === "function") {
    return "computed";
  }

  return "signal";
};

/**
 * Deep equality comparison for JavaScript values with cycle detection and identity optimization.
 *
 * This function performs a comprehensive deep comparison between two JavaScript values,
 * handling all primitive types, objects, arrays, and edge cases that standard equality
 * operators miss.
 *
 * Key features:
 * - **Deep comparison**: Recursively compares nested objects and arrays
 * - **Cycle detection**: Prevents infinite loops with circular references
 * - **Identity optimization**: Uses SYMBOL_IDENTITY for fast comparison of objects with same identity
 * - **Edge case handling**: Properly handles NaN, null, undefined, 0, false comparisons
 * - **Type safety**: Ensures both values have same type before deep comparison
 *
 * Performance optimizations:
 * - Early exit for reference equality (a === b)
 * - Identity symbol check for objects (avoids deep comparison when possible)
 * - Efficient array length check before element-by-element comparison
 *
 * **SYMBOL_IDENTITY explained**:
 * This symbol allows recognizing objects as "conceptually the same" even when they are
 * different object instances. When two objects share the same SYMBOL_IDENTITY value,
 * they are considered equal without performing deep comparison.
 *
 * This is particularly useful for:
 * - Copied objects that should be treated as the same entity
 * - Objects reconstructed from serialization that represent the same data
 * - Parameters passed through spread operator: `{ ...originalParams, newProp: value }`
 * - Memoization scenarios where object content identity matters more than reference identity
 *
 * Use cases:
 * - Memoization cache key comparison ({ id: 1 } should equal { id: 1 })
 * - React/Preact dependency comparison for effects and memos
 * - State change detection in signals and stores
 * - Action parameter comparison for avoiding duplicate requests
 * - Object recognition across serialization/deserialization boundaries
 *
 * Examples:
 * ```js
 * // Standard deep comparison
 * compareTwoJsValues({ id: 1 }, { id: 1 }) // true (slow - deep comparison)
 *
 * // NaN edge case handling
 * compareTwoJsValues(NaN, NaN) // true (unlike === which gives false)
 *
 * // Identity optimization - objects are different instances but same identity
 * const originalParams = { userId: 123, filters: ['active'] };
 * const copiedParams = { ...originalParams, newFlag: true };
 *
 * // Without SYMBOL_IDENTITY: slow deep comparison every time
 * compareTwoJsValues(originalParams, copiedParams) // false (different content)
 *
 * // With SYMBOL_IDENTITY: fast path recognition
 * const sharedIdentity = Symbol('params-identity');
 * originalParams[SYMBOL_IDENTITY] = sharedIdentity;
 * copiedParams[SYMBOL_IDENTITY] = sharedIdentity;
 *
 * compareTwoJsValues(originalParams, copiedParams) // true (fast - identity match)
 * // ↑ This returns true immediately without comparing all properties
 *
 * // Real-world scenario: action memoization
 * const params1 = { userId: 123 };
 * const action1 = createAction(params1);
 *
 * const params2 = { ...params1, extra: 'data' }; // Different object reference
 * params2[SYMBOL_IDENTITY] = params1[SYMBOL_IDENTITY]; // Same conceptual identity
 *
 * const action2 = createAction(params2);
 * // action1 === action2 because params are recognized as conceptually identical
 * ```
 *
 * @param {any} a - First value to compare
 * @param {any} b - Second value to compare
 * @param {Set} seenSet - Internal cycle detection set (automatically managed)
 * @returns {boolean} true if values are deeply equal, false otherwise
 */

/**
 * Symbol used to mark objects with a conceptual identity that transcends reference equality.
 *
 * When two different object instances share the same SYMBOL_IDENTITY value, they are
 * considered equal by compareTwoJsValues without performing expensive deep comparison.
 *
 * This enables recognition of "the same logical object" even when:
 * - The object has been copied via spread operator: `{ ...obj, newProp }`
 * - The object has been reconstructed from serialization
 * - The object is a different instance but represents the same conceptual entity
 *
 * Use Symbol.for() to ensure the same symbol across different modules/contexts.
 */
const SYMBOL_IDENTITY = Symbol.for("navi_object_identity");

const compareTwoJsValues = (a, b, seenSet = new Set()) => {
  if (a === b) {
    return true;
  }
  const aIsIsTruthy = Boolean(a);
  const bIsTruthy = Boolean(b);
  if (aIsIsTruthy && !bIsTruthy) {
    return false;
  }
  if (!aIsIsTruthy && !bIsTruthy) {
    // null, undefined, 0, false, NaN
    if (isNaN(a) && isNaN(b)) {
      return true;
    }
    return a === b;
  }
  const aType = typeof a;
  const bType = typeof b;
  if (aType !== bType) {
    return false;
  }
  const aIsPrimitive =
    a === null || (aType !== "object" && aType !== "function");
  const bIsPrimitive =
    b === null || (bType !== "object" && bType !== "function");
  if (aIsPrimitive !== bIsPrimitive) {
    return false;
  }
  if (aIsPrimitive && bIsPrimitive) {
    return a === b;
  }
  if (seenSet.has(a)) {
    return false;
  }
  if (seenSet.has(b)) {
    return false;
  }
  seenSet.add(a);
  seenSet.add(b);
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) {
    return false;
  }
  if (aIsArray) {
    // compare arrays
    if (a.length !== b.length) {
      return false;
    }
    let i = 0;
    while (i < a.length) {
      const aValue = a[i];
      const bValue = b[i];
      if (!compareTwoJsValues(aValue, bValue, seenSet)) {
        return false;
      }
      i++;
    }
    return true;
  }
  // compare objects
  const aIdentity = a[SYMBOL_IDENTITY];
  const bIdentity = b[SYMBOL_IDENTITY];
  if (aIdentity === bIdentity && SYMBOL_IDENTITY in a && SYMBOL_IDENTITY in b) {
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    const aValue = a[key];
    const bValue = b[key];
    if (!compareTwoJsValues(aValue, bValue, seenSet)) {
      return false;
    }
  }
  return true;
};

/**
 * jsenv/navi - createJsValueWeakMap
 *
 * Key/value cache with true ephemeron behavior and deep equality support.
 *
 * Features:
 * - Mutual retention: key keeps value alive, value keeps key alive
 * - Deep equality: different objects with same content are treated as identical keys
 * - Automatic GC: entries are eligible for collection when unreferenced
 * - Iteration support: can iterate over live entries for deep equality lookup
 *
 * Implementation:
 * - Dual WeakMap (key->value, value->key) provides ephemeron behavior
 * - WeakRef registry enables iteration without preventing GC
 * - Primitives stored in Map (permanent retention - avoid for keys)
 *
 * Use case: Action caching where params (key) and action (value) should have
 * synchronized lifetimes while allowing natural garbage collection.
 */


const createJsValueWeakMap = () => {
  // Core ephemeron maps for mutual retention
  const keyToValue = new WeakMap(); // key -> value
  const valueToKey = new WeakMap(); // value -> key

  // Registry for iteration/deep equality (holds WeakRefs)
  const keyRegistry = new Set(); // Set of WeakRef(key)

  // Primitive cache
  const primitiveCache = new Map();

  function cleanupKeyRegistry() {
    for (const keyRef of keyRegistry) {
      if (keyRef.deref() === undefined) {
        keyRegistry.delete(keyRef);
      }
    }
  }

  return {
    *[Symbol.iterator]() {
      cleanupKeyRegistry();
      for (const keyRef of keyRegistry) {
        const key = keyRef.deref();
        if (key && keyToValue.has(key)) {
          yield [key, keyToValue.get(key)];
        }
      }
      for (const [k, v] of primitiveCache) {
        yield [k, v];
      }
    },

    get(key) {
      const isObject =
        key && (typeof key === "object" || typeof key === "function");
      if (isObject) {
        // Fast path: exact key match
        if (keyToValue.has(key)) {
          return keyToValue.get(key);
        }

        // Slow path: deep equality search
        cleanupKeyRegistry();
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            return keyToValue.get(existingKey);
          }
        }
        return undefined;
      }
      return primitiveCache.get(key);
    },

    set(key, value) {
      const isObject =
        key && (typeof key === "object" || typeof key === "function");
      if (isObject) {
        cleanupKeyRegistry();

        // Remove existing deep-equal key
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            const existingValue = keyToValue.get(existingKey);
            keyToValue.delete(existingKey);
            valueToKey.delete(existingValue);
            keyRegistry.delete(keyRef);
            break;
          }
        }

        // Set ephemeron pair
        keyToValue.set(key, value);
        valueToKey.set(value, key);
        keyRegistry.add(new WeakRef(key));
      } else {
        primitiveCache.set(key, value);
      }
    },

    delete(key) {
      const isObject =
        key && (typeof key === "object" || typeof key === "function");
      if (isObject) {
        cleanupKeyRegistry();

        // Try exact match first
        if (keyToValue.has(key)) {
          const value = keyToValue.get(key);
          keyToValue.delete(key);
          valueToKey.delete(value);

          // Remove from registry
          for (const keyRef of keyRegistry) {
            if (keyRef.deref() === key) {
              keyRegistry.delete(keyRef);
              break;
            }
          }
          return true;
        }

        // Try deep equality
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            const value = keyToValue.get(existingKey);
            keyToValue.delete(existingKey);
            valueToKey.delete(value);
            keyRegistry.delete(keyRef);
            return true;
          }
        }
        return false;
      }
      return primitiveCache.delete(key);
    },

    getStats: () => {
      cleanupKeyRegistry();
      const aliveKeys = Array.from(keyRegistry).filter((ref) =>
        ref.deref(),
      ).length;

      return {
        ephemeronPairs: {
          total: keyRegistry.size,
          alive: aliveKeys,
          note: "True ephemeron: key ↔ value mutual retention via dual WeakMap",
        },
        primitive: {
          total: primitiveCache.size,
          note: "Primitive keys never GC'd",
        },
      };
    },
  };
};

const MERGE_AS_PRIMITIVE_SYMBOL = Symbol("navi_merge_as_primitive");

const mergeTwoJsValues = (firstValue, secondValue) => {
  const firstIsPrimitive =
    firstValue === null ||
    typeof firstValue !== "object" ||
    MERGE_AS_PRIMITIVE_SYMBOL in firstValue;

  if (firstIsPrimitive) {
    return secondValue;
  }
  const secondIsPrimitive =
    secondValue === null ||
    typeof secondValue !== "object" ||
    MERGE_AS_PRIMITIVE_SYMBOL in secondValue;
  if (secondIsPrimitive) {
    return secondValue;
  }
  const objectMerge = {};
  const firstKeys = Object.keys(firstValue);
  const secondKeys = Object.keys(secondValue);
  let hasChanged = false;

  // First loop: check for keys in first object and recursively merge with second
  for (const key of firstKeys) {
    const firstValueForKey = firstValue[key];
    const secondHasKey = secondKeys.includes(key);

    if (secondHasKey) {
      const secondValueForKey = secondValue[key];
      const mergedValue = mergeTwoJsValues(firstValueForKey, secondValueForKey);
      objectMerge[key] = mergedValue;
      if (mergedValue !== firstValueForKey) {
        hasChanged = true;
      }
    } else {
      objectMerge[key] = firstValueForKey;
    }
  }

  for (const key of secondKeys) {
    if (firstKeys.includes(key)) {
      continue;
    }
    objectMerge[key] = secondValue[key];
    hasChanged = true;
  }

  if (!hasChanged) {
    return firstValue;
  }
  return objectMerge;
};

const MAX_ENTRIES = 5;

const stringifyForDisplay = (
  value,
  maxDepth = 2,
  currentDepth = 0,
  options = {},
) => {
  const { asFunctionArgs = false } = options;
  const indent = "  ".repeat(currentDepth);
  const nextIndent = "  ".repeat(currentDepth + 1);

  if (currentDepth >= maxDepth) {
    return typeof value === "object" && value !== null
      ? "[Object]"
      : String(value);
  }

  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (value instanceof Date) {
    return `Date(${value.toISOString()})`;
  }
  if (value instanceof RegExp) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    const openBracket = asFunctionArgs ? "(" : "[";
    const closeBracket = asFunctionArgs ? ")" : "]";

    if (value.length === 0) return `${openBracket}${closeBracket}`;

    // Display arrays with only one element on a single line
    if (value.length === 1) {
      const item = stringifyForDisplay(
        value[0],
        maxDepth,
        currentDepth + 1,
        // Remove asFunctionArgs for nested calls
        { ...options, asFunctionArgs: false },
      );
      return `${openBracket}${item}${closeBracket}`;
    }

    if (value.length > MAX_ENTRIES) {
      const preview = value
        .slice(0, MAX_ENTRIES)
        .map(
          (v) =>
            `${nextIndent}${stringifyForDisplay(v, maxDepth, currentDepth + 1, { ...options, asFunctionArgs: false })}`,
        );
      return `${openBracket}\n${preview.join(",\n")},\n${nextIndent}...${value.length - MAX_ENTRIES} more\n${indent}${closeBracket}`;
    }

    const items = value.map(
      (v) =>
        `${nextIndent}${stringifyForDisplay(v, maxDepth, currentDepth + 1, { ...options, asFunctionArgs: false })}`,
    );
    return `${openBracket}\n${items.join(",\n")}\n${indent}${closeBracket}`;
  }

  if (typeof value === "object") {
    const signalType = getSignalType(value);
    if (signalType) {
      const signalValue = value.peek();
      const prefix = signalType === "computed" ? "computed" : "signal";
      return `${prefix}(${stringifyForDisplay(signalValue, maxDepth, currentDepth, { ...options, asFunctionArgs: false })})`;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";

    // ✅ Inclure les clés avec valeurs undefined/null
    const allEntries = [];
    for (const [key, val] of entries) {
      allEntries.push([key, val]);
    }

    // Ajouter les clés avec undefined (que Object.entries omet)
    const descriptor = Object.getOwnPropertyDescriptors(value);
    for (const [key, desc] of Object.entries(descriptor)) {
      if (desc.value === undefined && !entries.some(([k]) => k === key)) {
        allEntries.push([key, undefined]);
      }
    }

    // Display objects with only one key on a single line
    if (allEntries.length === 1) {
      const [key, val] = allEntries[0];
      const valueStr = stringifyForDisplay(val, maxDepth, currentDepth + 1, {
        ...options,
        asFunctionArgs: false,
      });
      return `{ ${key}: ${valueStr} }`;
    }

    if (allEntries.length > MAX_ENTRIES) {
      const preview = allEntries
        .slice(0, MAX_ENTRIES)
        .map(
          ([k, v]) =>
            `${nextIndent}${k}: ${stringifyForDisplay(v, maxDepth, currentDepth + 1, { ...options, asFunctionArgs: false })}`,
        );
      return `{\n${preview.join(",\n")},\n${nextIndent}...${allEntries.length - MAX_ENTRIES} more\n${indent}}`;
    }

    const pairs = allEntries.map(
      ([k, v]) =>
        `${nextIndent}${k}: ${stringifyForDisplay(v, maxDepth, currentDepth + 1, { ...options, asFunctionArgs: false })}`,
    );
    return `{\n${pairs.join(",\n")}\n${indent}}`;
  }

  return String(value);
};

/**
 * Creates an effect that uses WeakRef to prevent garbage collection of referenced values.
 *
 * This utility is useful when you want to create reactive effects that watch objects
 * without preventing those objects from being garbage collected. If any of the referenced
 * values is collected, the effect automatically disposes itself.
 *
 * @param {Array} values - Array of values to create weak references for
 * @param {Function} callback - Function to call when the effect runs, receives dereferenced values as arguments
 * @returns {Function} dispose - Function to manually dispose the effect
 *
 * @example
 * ```js
 * const objectA = { name: "A" };
 * const objectB = { name: "B" };
 * const prefixSignal = signal('demo');
 *
 * const dispose = weakEffect([objectA, objectB], (a, b) => {
 *   const prefix = prefixSignal.value
 *   console.log(prefix, a.name, b.name);
 * });
 *
 * // Effect will auto-dispose if objectA or objectB where garbage collected
 * // or can be manually disposed:
 * dispose();
 * ```
 */
const weakEffect = (values, callback) => {
  const weakRefSet = new Set();
  for (const value of values) {
    weakRefSet.add(new WeakRef(value));
  }
  const dispose = effect(() => {
    const values = [];
    for (const weakRef of weakRefSet) {
      const value = weakRef.deref();
      if (value === undefined) {
        dispose();
        return;
      }
      values.push(value);
    }
    callback(...values);
  });
  return dispose;
};

let DEBUG$2 = false;
const enableDebugActions = () => {
  DEBUG$2 = true;
};

let dispatchActions = (params) => {
  const { requestedResult } = updateActions({
    globalAbortSignal: new AbortController().signal,
    abortSignal: new AbortController().signal,
    ...params,
  });
  return requestedResult;
};

const dispatchSingleAction = (action, method, options) => {
  const requestedResult = dispatchActions({
    prerunSet: method === "prerun" ? new Set([action]) : undefined,
    runSet: method === "run" ? new Set([action]) : undefined,
    rerunSet: method === "rerun" ? new Set([action]) : undefined,
    resetSet: method === "reset" ? new Set([action]) : undefined,
    ...options,
  });
  if (requestedResult && typeof requestedResult.then === "function") {
    return requestedResult.then((resolvedResult) =>
      resolvedResult ? resolvedResult[0] : undefined,
    );
  }
  return requestedResult ? requestedResult[0] : undefined;
};
const setActionDispatcher = (value) => {
  dispatchActions = value;
};

const getActionDispatcher = () => dispatchActions;

const rerunActions = async (
  actionSet,
  { reason = "rerunActions was called" } = {},
) => {
  return dispatchActions({
    rerunSet: actionSet,
    reason,
  });
};

/**
 * Registry that prevents prerun actions from being garbage collected.
 *
 * When an action is prerun, it might not have any active references yet
 * (e.g., the component that will use it hasn't loaded yet due to dynamic imports).
 * This registry keeps a reference to prerun actions for a configurable duration
 * to ensure they remain available when needed.
 *
 * Actions are automatically unprotected when:
 * - The protection duration expires (default: 5 minutes)
 * - The action is explicitly stopped via .stop()
 */
const prerunProtectionRegistry = (() => {
  const protectedActionMap = new Map(); // action -> { timeoutId, timestamp }
  const PROTECTION_DURATION = 5 * 60 * 1000; // 5 minutes en millisecondes

  const unprotect = (action) => {
    const protection = protectedActionMap.get(action);
    if (protection) {
      clearTimeout(protection.timeoutId);
      protectedActionMap.delete(action);
      if (DEBUG$2) {
        const elapsed = Date.now() - protection.timestamp;
        console.debug(`"${action}": GC protection removed after ${elapsed}ms`);
      }
    }
  };

  return {
    protect(action) {
      // Si déjà protégée, étendre la protection
      if (protectedActionMap.has(action)) {
        const existing = protectedActionMap.get(action);
        clearTimeout(existing.timeoutId);
      }

      const timestamp = Date.now();
      const timeoutId = setTimeout(() => {
        unprotect(action);
        if (DEBUG$2) {
          console.debug(
            `"${action}": prerun protection expired after ${PROTECTION_DURATION}ms`,
          );
        }
      }, PROTECTION_DURATION);

      protectedActionMap.set(action, { timeoutId, timestamp });

      if (DEBUG$2) {
        console.debug(
          `"${action}": protected from GC for ${PROTECTION_DURATION}ms`,
        );
      }
    },

    unprotect,

    isProtected(action) {
      return protectedActionMap.has(action);
    },

    // Pour debugging
    getProtectedActions() {
      return Array.from(protectedActionMap.keys());
    },

    // Nettoyage manuel si nécessaire
    clear() {
      for (const [, protection] of protectedActionMap) {
        clearTimeout(protection.timeoutId);
      }
      protectedActionMap.clear();
    },
  };
})();

const formatActionSet = (actionSet, prefix = "") => {
  let message = "";
  message += `${prefix}`;
  for (const action of actionSet) {
    message += "\n";
    message += prefixFirstAndIndentRemainingLines(String(action), {
      prefix: "  -",
    });
  }
  return message;
};

const actionAbortMap = new Map();
const actionPromiseMap = new Map();
const activationWeakSet = createIterableWeakSet();

const getActivationInfo = () => {
  const runningSet = new Set();
  const settledSet = new Set();

  for (const action of activationWeakSet) {
    const privateProps = getActionPrivateProperties(action);
    const runningState = privateProps.runningStateSignal.peek();

    if (runningState === RUNNING) {
      runningSet.add(action);
    } else if (
      runningState === COMPLETED ||
      runningState === FAILED ||
      runningState === ABORTED
    ) {
      settledSet.add(action);
    } else {
      throw new Error(
        `An action in the activation weak set must be RUNNING, ABORTED, FAILED or COMPLETED, found "${runningState.id}" for action "${action}"`,
      );
    }
  }

  return {
    runningSet,
    settledSet,
  };
};

const updateActions = ({
  globalAbortSignal,
  abortSignal,
  isReplace = false,
  reason,
  prerunSet = new Set(),
  runSet = new Set(),
  rerunSet = new Set(),
  resetSet = new Set(),
  abortSignalMap = new Map(),
  onComplete,
  onAbort,
  onError,
} = {}) => {
  /*
   * Action update flow:
   *
   * Input: 4 sets of requested operations
   * - prerunSet: actions to prerun (background, low priority)
   * - runSet: actions to run (user-visible, medium priority)
   * - rerunSet: actions to force rerun (highest priority)
   * - resetSet: actions to reset/clear
   *
   * Priority resolution:
   * - reset always wins (explicit cleanup)
   * - rerun > run > prerun (rerun forces refresh even if already running)
   * - An action in multiple sets triggers warnings in dev mode
   *
   * Output: Internal operation sets that track what will actually happen
   * - willResetSet: actions that will be reset/cleared
   * - willPrerunSet: actions that will be prerun
   * - willRunSet: actions that will be run
   * - willPromoteSet: prerun actions that become run-requested
   * - stays*Set: actions that remain in their current state
   */

  const { runningSet, settledSet } = getActivationInfo();

  if (DEBUG$2) {
    let argSource = `reason: \`${reason}\``;
    if (isReplace) {
      argSource += `, isReplace: true`;
    }
    console.group(`updateActions({ ${argSource} })`);
    const lines = [
      ...(prerunSet.size ? [formatActionSet(prerunSet, "- prerun:")] : []),
      ...(runSet.size ? [formatActionSet(runSet, "- run:")] : []),
      ...(rerunSet.size ? [formatActionSet(rerunSet, "- rerun:")] : []),
      ...(resetSet.size ? [formatActionSet(resetSet, "- reset:")] : []),
    ];
    console.debug(
      `requested operations:
${lines.join("\n")}`,
    );
  }

  // Internal sets that track what operations will actually be performed
  const willResetSet = new Set();
  const willPrerunSet = new Set();
  const willRunSet = new Set();
  const willPromoteSet = new Set(); // prerun -> run requested
  const staysRunningSet = new Set();
  const staysAbortedSet = new Set();
  const staysFailedSet = new Set();
  const staysCompletedSet = new Set();

  // Step 1: Determine which actions will be reset
  {
    for (const actionToReset of resetSet) {
      if (actionToReset.runningState !== IDLE) {
        willResetSet.add(actionToReset);
      }
    }
  }

  // Step 2: Process prerun, run, and rerun sets
  {
    const handleActionRequest = (
      action,
      requestType, // "prerun", "run", or "rerun"
    ) => {
      const isPrerun = requestType === "prerun";
      const isRerun = requestType === "rerun";

      if (
        action.runningState === RUNNING ||
        action.runningState === COMPLETED
      ) {
        // Action is already running/completed
        // By default, we don't interfere with already active actions
        // Unless it's a rerun or the action is also being reset
        if (isRerun || willResetSet.has(action)) {
          // Force reset first, then rerun/run
          willResetSet.add(action);
          if (isPrerun) {
            willPrerunSet.add(action);
          } else {
            willRunSet.add(action);
          }
        }
        // Otherwise, ignore the request (action stays as-is)
      } else if (isPrerun) {
        willPrerunSet.add(action);
      } else {
        willRunSet.add(action);
      }
    };

    // Process prerunSet (lowest priority)
    for (const actionToPrerun of prerunSet) {
      if (runSet.has(actionToPrerun) || rerunSet.has(actionToPrerun)) {
        // run/rerun wins over prerun - skip prerun
        continue;
      }
      handleActionRequest(actionToPrerun, "prerun");
    }

    // Process runSet (medium priority)
    for (const actionToRun of runSet) {
      if (rerunSet.has(actionToRun)) {
        // rerun wins over run - skip run
        continue;
      }
      if (actionToRun.isPrerun && actionToRun.runningState !== IDLE) {
        // Special case: action was prerun but not yet requested to run
        // Just promote it to "run requested" without rerunning
        willPromoteSet.add(actionToRun);
        continue;
      }
      handleActionRequest(actionToRun, "run");
    }

    // Process rerunSet (highest priority)
    for (const actionToRerun of rerunSet) {
      handleActionRequest(actionToRerun, "rerun");
    }
  }
  const allThenableArray = [];

  // Step 3: Determine which actions will stay in their current state
  {
    for (const actionRunning of runningSet) {
      if (willResetSet.has(actionRunning)) ; else if (
        willRunSet.has(actionRunning) ||
        willPrerunSet.has(actionRunning)
      ) ; else {
        // an action that was running and not affected by this update
        const actionPromise = actionPromiseMap.get(actionRunning);
        allThenableArray.push(actionPromise);
        staysRunningSet.add(actionRunning);
      }
    }
    for (const actionSettled of settledSet) {
      if (willResetSet.has(actionSettled)) ; else if (actionSettled.runningState === ABORTED) {
        staysAbortedSet.add(actionSettled);
      } else if (actionSettled.runningState === FAILED) {
        staysFailedSet.add(actionSettled);
      } else {
        staysCompletedSet.add(actionSettled);
      }
    }
  }
  if (DEBUG$2) {
    const lines = [
      ...(willResetSet.size
        ? [formatActionSet(willResetSet, "- will reset:")]
        : []),
      ...(willPrerunSet.size
        ? [formatActionSet(willPrerunSet, "- will prerun:")]
        : []),
      ...(willPromoteSet.size
        ? [formatActionSet(willPromoteSet, "- will promote:")]
        : []),
      ...(willRunSet.size ? [formatActionSet(willRunSet, "- will run:")] : []),
      ...(staysRunningSet.size
        ? [formatActionSet(staysRunningSet, "- stays running:")]
        : []),
      ...(staysAbortedSet.size
        ? [formatActionSet(staysAbortedSet, "- stays aborted:")]
        : []),
      ...(staysFailedSet.size
        ? [formatActionSet(staysFailedSet, "- stays failed:")]
        : []),
      ...(staysCompletedSet.size
        ? [formatActionSet(staysCompletedSet, "- stays completed:")]
        : []),
    ];
    console.debug(`operations that will be performed:
${lines.join("\n")}`);
  }

  // Step 4: Execute resets
  {
    for (const actionToReset of willResetSet) {
      const actionToResetPrivateProperties =
        getActionPrivateProperties(actionToReset);
      actionToResetPrivateProperties.performStop({ reason });
      activationWeakSet.delete(actionToReset);
    }
  }

  const resultArray = []; // Store results with their execution order
  let hasAsync = false;

  // Step 5: Execute preruns and runs
  {
    const onActionToRunOrPrerun = (actionToPrerunOrRun, isPrerun) => {
      const actionSpecificSignal = abortSignalMap.get(actionToPrerunOrRun);
      const effectiveSignal = actionSpecificSignal || abortSignal;

      const actionToRunPrivateProperties =
        getActionPrivateProperties(actionToPrerunOrRun);
      const performRunResult = actionToRunPrivateProperties.performRun({
        globalAbortSignal,
        abortSignal: effectiveSignal,
        reason,
        isPrerun,
        onComplete,
        onAbort,
        onError,
      });
      activationWeakSet.add(actionToPrerunOrRun);

      if (performRunResult && typeof performRunResult.then === "function") {
        actionPromiseMap.set(actionToPrerunOrRun, performRunResult);
        allThenableArray.push(performRunResult);
        hasAsync = true;
        // Store async result with order info
        resultArray.push({
          type: "async",
          promise: performRunResult,
        });
      } else {
        // Store sync result with order info
        resultArray.push({
          type: "sync",
          result: performRunResult,
        });
      }
    };

    // Execute preruns
    for (const actionToPrerun of willPrerunSet) {
      onActionToRunOrPrerun(actionToPrerun, true);
    }

    // Execute runs
    for (const actionToRun of willRunSet) {
      onActionToRunOrPrerun(actionToRun, false);
    }

    // Execute promotions (prerun -> run requested)
    for (const actionToPromote of willPromoteSet) {
      const actionToPromotePrivateProperties =
        getActionPrivateProperties(actionToPromote);
      actionToPromotePrivateProperties.isPrerunSignal.value = false;
    }
  }
  if (DEBUG$2) {
    console.groupEnd();
  }

  // Calculate requestedResult based on the execution results
  let requestedResult;
  if (resultArray.length === 0) {
    requestedResult = null;
  } else if (hasAsync) {
    requestedResult = Promise.all(
      resultArray.map((item) =>
        item.type === "sync" ? item.result : item.promise,
      ),
    );
  } else {
    requestedResult = resultArray.map((item) => item.result);
  }

  const allResult = allThenableArray.length
    ? Promise.allSettled(allThenableArray)
    : null;
  const runningActionSet = new Set([...willPrerunSet, ...willRunSet]);
  return {
    requestedResult,
    allResult,
    runningActionSet,
  };
};

const NO_PARAMS$1 = {};
const initialParamsDefault = NO_PARAMS$1;

const actionWeakMap = new WeakMap();
const createAction = (callback, rootOptions = {}) => {
  const existing = actionWeakMap.get(callback);
  if (existing) {
    return existing;
  }

  let rootAction;

  const createActionCore = (options, { parentAction } = {}) => {
    let {
      name = callback.name || "anonymous",
      params,
      isPrerun = true,
      runningState = IDLE,
      aborted = false,
      error = null,
      data,
      computedData,
      compute,
      completed = false,
      renderLoadedAsync,
      sideEffect = () => {},
      keepOldData = false,
      meta = {},
      dataEffect,
      completeSideEffect,
    } = options;
    if (!Object.hasOwn(options, "params")) {
      // even undefined should be respect it's only when not provided at all we use default
      params = initialParamsDefault;
    }

    const initialData = data;
    const paramsSignal = signal(params);
    const isPrerunSignal = signal(isPrerun);
    const runningStateSignal = signal(runningState);
    const errorSignal = signal(error);
    const dataSignal = signal(initialData);
    const computedDataSignal = compute
      ? computed(() => {
          const data = dataSignal.value;
          return compute(data);
        })
      : dataSignal;
    computedData =
      computedData === undefined
        ? compute
          ? compute(data)
          : data
        : computedData;

    const prerun = (options) => {
      return dispatchSingleAction(action, "prerun", options);
    };
    const run = (options) => {
      return dispatchSingleAction(action, "run", options);
    };
    const rerun = (options) => {
      return dispatchSingleAction(action, "rerun", options);
    };
    /**
     * Stop the action completely - this will:
     * 1. Abort the action if it's currently running
     * 2. Reset the action to IDLE state
     * 3. Clean up any resources and side effects
     * 4. Reset data to initial value (unless keepOldData is true)
     */
    const stop = (options) => {
      return dispatchSingleAction(action, "stop", options);
    };
    const abort = (reason) => {
      if (runningState !== RUNNING) {
        return false;
      }
      const actionAbort = actionAbortMap.get(action);
      if (!actionAbort) {
        return false;
      }
      if (DEBUG$2) {
        console.log(`"${action}": aborting (reason: ${reason})`);
      }
      actionAbort(reason);
      return true;
    };

    let action;

    const childActionWeakSet = createIterableWeakSet();
    /*
     * Ephemeron behavior is critical here: actions must keep params alive.
     * Without this, bindParams(params) could create a new action while code
     * still references the old action with GC'd params. This would cause:
     * - Duplicate actions in activationWeakSet (old + new)
     * - Cache misses when looking up existing actions
     * - Subtle bugs where different parts of code use different action instances
     * The ephemeron pattern ensures params and actions have synchronized lifetimes.
     */
    const childActionWeakMap = createJsValueWeakMap();
    const _bindParams = (newParamsOrSignal, options = {}) => {
      // ✅ CAS 1: Signal direct -> proxy
      if (isSignal(newParamsOrSignal)) {
        const combinedParamsSignal = computed(() => {
          const newParams = newParamsOrSignal.value;
          const result = mergeTwoJsValues(params, newParams);
          return result;
        });
        return createActionProxyFromSignal(
          action,
          combinedParamsSignal,
          options,
        );
      }

      // ✅ CAS 2: Objet -> vérifier s'il contient des signals
      if (newParamsOrSignal && typeof newParamsOrSignal === "object") {
        const staticParams = {};
        const signalMap = new Map();

        const keyArray = Object.keys(newParamsOrSignal);
        for (const key of keyArray) {
          const value = newParamsOrSignal[key];
          if (isSignal(value)) {
            signalMap.set(key, value);
          } else {
            const objectSignal = value ? value[SYMBOL_OBJECT_SIGNAL] : null;
            if (objectSignal) {
              signalMap.set(key, objectSignal);
            } else {
              staticParams[key] = value;
            }
          }
        }

        if (signalMap.size === 0) {
          // Pas de signals, merge statique normal
          if (params === null || typeof params !== "object") {
            return createChildAction({
              ...options,
              params: newParamsOrSignal,
            });
          }
          const combinedParams = mergeTwoJsValues(params, newParamsOrSignal);
          return createChildAction({
            ...options,
            params: combinedParams,
          });
        }

        // Combiner avec les params existants pour les valeurs statiques
        const paramsSignal = computed(() => {
          const params = {};
          for (const key of keyArray) {
            const signalForThisKey = signalMap.get(key);
            if (signalForThisKey) {
              params[key] = signalForThisKey.value;
            } else {
              params[key] = staticParams[key];
            }
          }
          return params;
        });
        return createActionProxyFromSignal(action, paramsSignal, options);
      }

      // ✅ CAS 3: Primitive -> action enfant
      return createChildAction({
        params: newParamsOrSignal,
        ...options,
      });
    };
    const bindParams = (newParamsOrSignal, options = {}) => {
      const existingChildAction = childActionWeakMap.get(newParamsOrSignal);
      if (existingChildAction) {
        return existingChildAction;
      }
      const childAction = _bindParams(newParamsOrSignal, options);
      childActionWeakMap.set(newParamsOrSignal, childAction);
      childActionWeakSet.add(childAction);

      return childAction;
    };

    const createChildAction = (childOptions) => {
      const childActionOptions = {
        ...rootOptions,
        ...childOptions,
        meta: {
          ...rootOptions.meta,
          ...childOptions.meta,
        },
      };
      const childAction = createActionCore(childActionOptions, {
        parentAction: action,
      });
      return childAction;
    };

    // ✅ Implement matchAllSelfOrDescendant
    const matchAllSelfOrDescendant = (predicate, { includeProxies } = {}) => {
      const matches = [];

      const traverse = (currentAction) => {
        if (currentAction.isProxy && !includeProxies) {
          // proxy action should be ignored because the underlying action will be found anyway
          // and if we check the proxy action we'll end up with duplicates
          // (loading the proxy would load the action it proxies)
          // and as they are 2 different objects they would be added to the set
          return;
        }

        if (predicate(currentAction)) {
          matches.push(currentAction);
        }

        // Get child actions from the current action
        const currentActionPrivateProps =
          getActionPrivateProperties(currentAction);
        const childActionWeakSet = currentActionPrivateProps.childActionWeakSet;
        for (const childAction of childActionWeakSet) {
          traverse(childAction);
        }
      };

      traverse(action);
      return matches;
    };

    name = generateActionName(name, params);
    {
      // Create the action as a function that can be called directly
      action = function actionFunction(params) {
        const boundAction = bindParams(params);
        return boundAction.rerun();
      };
      Object.defineProperty(action, "name", {
        configurable: true,
        writable: true,
        value: name,
      });
    }

    // Assign all the action properties and methods to the function
    Object.assign(action, {
      isAction: true,
      callback,
      rootAction,
      parentAction,
      params,
      isPrerun,
      runningState,
      aborted,
      error,
      data,
      computedData,
      completed,
      prerun,
      run,
      rerun,
      stop,
      abort,
      bindParams,
      matchAllSelfOrDescendant, // ✅ Add the new method
      replaceParams: (newParams) => {
        const currentParams = paramsSignal.value;
        const nextParams = mergeTwoJsValues(currentParams, newParams);
        if (nextParams === currentParams) {
          return false;
        }

        // Update the weak map BEFORE updating the signal
        // so that any code triggered by the signal update finds this action
        if (parentAction) {
          const parentActionPrivateProps =
            getActionPrivateProperties(parentAction);
          const parentChildActionWeakMap =
            parentActionPrivateProps.childActionWeakMap;
          parentChildActionWeakMap.delete(currentParams);
          parentChildActionWeakMap.set(nextParams, action);
        }

        params = nextParams;
        action.params = nextParams;
        action.name = generateActionName(name, nextParams);
        paramsSignal.value = nextParams;
        return true;
      },
      toString: () => action.name,
      meta,
    });
    Object.preventExtensions(action);

    // Effects pour synchroniser les propriétés
    {
      weakEffect([action], (actionRef) => {
        isPrerun = isPrerunSignal.value;
        actionRef.isPrerun = isPrerun;
      });
      weakEffect([action], (actionRef) => {
        runningState = runningStateSignal.value;
        actionRef.runningState = runningState;
        aborted = runningState === ABORTED;
        actionRef.aborted = aborted;
        completed = runningState === COMPLETED;
        actionRef.completed = completed;
      });
      weakEffect([action], (actionRef) => {
        error = errorSignal.value;
        actionRef.error = error;
      });
      weakEffect([action], (actionRef) => {
        data = dataSignal.value;
        computedData = computedDataSignal.value;
        actionRef.data = data;
        actionRef.computedData = computedData;
      });
    }

    // Propriétés privées
    {
      const ui = {
        renderLoaded: null,
        renderLoadedAsync,
        hasRenderers: false, // Flag to track if action is bound to UI components
      };
      let sideEffectCleanup;

      const performRun = (runParams) => {
        const {
          globalAbortSignal,
          abortSignal,
          reason,
          isPrerun,
          onComplete,
          onAbort,
          onError,
        } = runParams;

        if (isPrerun) {
          prerunProtectionRegistry.protect(action);
        }

        const internalAbortController = new AbortController();
        const internalAbortSignal = internalAbortController.signal;
        const abort = (abortReason) => {
          runningStateSignal.value = ABORTED;
          internalAbortController.abort(abortReason);
          actionAbortMap.delete(action);
          if (isPrerun && (globalAbortSignal.aborted || abortSignal.aborted)) {
            prerunProtectionRegistry.unprotect(action);
          }
          if (DEBUG$2) {
            console.log(`"${action}": aborted (reason: ${abortReason})`);
          }
        };

        const onAbortFromSpecific = () => {
          abort(abortSignal.reason);
        };
        const onAbortFromGlobal = () => {
          abort(globalAbortSignal.reason);
        };

        if (abortSignal) {
          abortSignal.addEventListener("abort", onAbortFromSpecific);
        }
        if (globalAbortSignal) {
          globalAbortSignal.addEventListener("abort", onAbortFromGlobal);
        }

        actionAbortMap.set(action, abort);

        batch(() => {
          errorSignal.value = null;
          runningStateSignal.value = RUNNING;
          if (!isPrerun) {
            isPrerunSignal.value = false;
          }
        });

        const args = [];
        args.push(params);
        args.push({ signal: internalAbortSignal, reason, isPrerun });
        const returnValue = sideEffect(...args);
        if (typeof returnValue === "function") {
          sideEffectCleanup = returnValue;
        }

        let runResult;
        let rejected = false;
        let rejectedValue;
        const onRunEnd = () => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          prerunProtectionRegistry.unprotect(action);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          /*
           * Critical: dataEffect, onComplete and completeSideEffect must be batched together to prevent
           * UI inconsistencies. The dataEffect might modify shared state (e.g.,
           * deleting items from a store), and onLoad callbacks might trigger
           * dependent action state changes.
           *
           * Without batching, the UI could render with partially updated state:
           * - dataEffect deletes a resource from the store
           * - UI renders immediately and tries to display the deleted resource
           * - onLoad hasn't yet updated dependent actions to loading state
           *
           * Example: When deleting a resource, we need to both update the store
           * AND put the action that loaded that resource back into loading state
           * before the UI attempts to render the now-missing resource.
           */
          batch(() => {
            dataSignal.value = dataEffect
              ? dataEffect(runResult, action)
              : runResult;
            runningStateSignal.value = COMPLETED;
            onComplete?.(computedDataSignal.peek(), action);
            completeSideEffect?.(action);
          });
          if (DEBUG$2) {
            console.log(`"${action}": completed`);
          }
          return computedDataSignal.peek();
        };
        const onRunError = (e) => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (internalAbortSignal.aborted && e === internalAbortSignal.reason) {
            runningStateSignal.value = ABORTED;
            if (isPrerun && abortSignal.aborted) {
              prerunProtectionRegistry.unprotect(action);
            }
            onAbort(e, action);
            return e;
          }
          if (e.name === "AbortError") {
            throw new Error(
              "never supposed to happen, abort error should be handled by the abort signal",
            );
          }
          if (DEBUG$2) {
            console.log(
              `"${action}": failed (error: ${e}, handled by ui: ${ui.hasRenderers})`,
            );
          }
          batch(() => {
            errorSignal.value = e;
            runningStateSignal.value = FAILED;
            onError?.(e, action);
          });

          if (ui.hasRenderers || onError) {
            console.error(e);
            // For UI-bound actions: error is properly handled by logging + UI display
            // Return error instead of throwing to signal it's handled and prevent:
            // - jsenv error overlay from appearing
            // - error being treated as unhandled by runtime
            return e;
          }
          throw e;
        };

        try {
          const thenableArray = [];
          const callbackResult = callback(...args);
          if (callbackResult && typeof callbackResult.then === "function") {
            thenableArray.push(
              callbackResult.then(
                (value) => {
                  runResult = value;
                },
                (e) => {
                  rejected = true;
                  rejectedValue = e;
                },
              ),
            );
          } else {
            runResult = callbackResult;
          }
          if (ui.renderLoadedAsync && !ui.renderLoaded) {
            const renderLoadedPromise = ui.renderLoadedAsync(...args).then(
              (renderLoaded) => {
                ui.renderLoaded = renderLoaded;
              },
              (e) => {
                if (!rejected) {
                  rejected = true;
                  rejectedValue = e;
                }
              },
            );
            thenableArray.push(renderLoadedPromise);
          }
          if (thenableArray.length === 0) {
            return onRunEnd();
          }
          return Promise.all(thenableArray).then(() => {
            if (rejected) {
              return onRunError(rejectedValue);
            }
            return onRunEnd();
          });
        } catch (e) {
          return onRunError(e);
        }
      };

      const performStop = ({ reason }) => {
        abort(reason);
        if (DEBUG$2) {
          console.log(`"${action}": stopping (reason: ${reason})`);
        }

        prerunProtectionRegistry.unprotect(action);

        if (sideEffectCleanup) {
          sideEffectCleanup(reason);
          sideEffectCleanup = undefined;
        }

        actionPromiseMap.delete(action);
        batch(() => {
          errorSignal.value = null;
          if (!keepOldData) {
            dataSignal.value = initialData;
          }
          isPrerunSignal.value = true;
          runningStateSignal.value = IDLE;
        });
      };

      const privateProperties = {
        initialData,

        paramsSignal,
        runningStateSignal,
        isPrerunSignal,
        dataSignal,
        computedDataSignal,
        errorSignal,

        performRun,
        performStop,
        ui,

        childActionWeakSet,
        childActionWeakMap,
      };
      setActionPrivateProperties(action, privateProperties);
    }

    return action;
  };

  rootAction = createActionCore(rootOptions);
  actionWeakMap.set(callback, rootAction);
  return rootAction;
};

const createActionProxyFromSignal = (
  action,
  paramsSignal,
  { rerunOnChange = false, onChange } = {},
) => {
  const actionTargetChangeCallbackSet = new Set();
  const onActionTargetChange = (callback) => {
    actionTargetChangeCallbackSet.add(callback);
    return () => {
      actionTargetChangeCallbackSet.delete(callback);
    };
  };
  const changeCleanupCallbackSet = new Set();
  const triggerTargetChange = (actionTarget, previousTarget) => {
    for (const changeCleanupCallback of changeCleanupCallbackSet) {
      changeCleanupCallback();
    }
    changeCleanupCallbackSet.clear();
    for (const callback of actionTargetChangeCallbackSet) {
      const returnValue = callback(actionTarget, previousTarget);
      if (typeof returnValue === "function") {
        changeCleanupCallbackSet.add(returnValue);
      }
    }
  };

  let actionTarget = null;
  let currentAction = action;
  let currentActionPrivateProperties = getActionPrivateProperties(action);
  let actionTargetPreviousWeakRef = null;

  const _updateTarget = (params) => {
    const previousActionTarget = actionTargetPreviousWeakRef?.deref();

    if (params === NO_PARAMS$1) {
      actionTarget = null;
      currentAction = action;
      currentActionPrivateProperties = getActionPrivateProperties(action);
    } else {
      actionTarget = action.bindParams(params);
      if (previousActionTarget === actionTarget) {
        return;
      }
      currentAction = actionTarget;
      currentActionPrivateProperties = getActionPrivateProperties(actionTarget);
    }
    actionTargetPreviousWeakRef = actionTarget
      ? new WeakRef(actionTarget)
      : null;
    triggerTargetChange(actionTarget, previousActionTarget);
  };

  const proxyMethod = (method) => {
    return (...args) => {
      /*
       * Ensure the proxy targets the correct action before method execution.
       * This prevents race conditions where external effects run before our
       * internal parameter synchronization effect. Using peek() avoids creating
       * reactive dependencies within this pass-through method.
       */
      _updateTarget(proxyParamsSignal.peek());
      return currentAction[method](...args);
    };
  };

  const nameSignal = signal();
  let actionProxy;
  {
    actionProxy = function actionProxyFunction() {
      return actionProxy.rerun();
    };
    Object.defineProperty(actionProxy, "name", {
      configurable: true,
      get() {
        return nameSignal.value;
      },
    });
  }
  Object.assign(actionProxy, {
    isProxy: true,
    callback: undefined,
    params: undefined,
    isPrerun: undefined,
    runningState: undefined,
    aborted: undefined,
    error: undefined,
    data: undefined,
    computedData: undefined,
    completed: undefined,
    prerun: proxyMethod("prerun"),
    run: proxyMethod("run"),
    rerun: proxyMethod("rerun"),
    stop: proxyMethod("stop"),
    abort: proxyMethod("abort"),
    matchAllSelfOrDescendant: proxyMethod("matchAllSelfOrDescendant"),
    getCurrentAction: () => {
      _updateTarget(proxyParamsSignal.peek());
      return currentAction;
    },
    bindParams: () => {
      throw new Error(
        `bindParams() is not supported on action proxies, use the underlying action instead`,
      );
    },
    replaceParams: null, // Will be set below
    toString: () => actionProxy.name,
    meta: {},
  });
  Object.preventExtensions(actionProxy);

  onActionTargetChange((actionTarget) => {
    const currentAction = actionTarget || action;
    nameSignal.value = `[Proxy] ${currentAction.name}`;
    actionProxy.callback = currentAction.callback;
    actionProxy.params = currentAction.params;
    actionProxy.isPrerun = currentAction.isPrerun;
    actionProxy.runningState = currentAction.runningState;
    actionProxy.aborted = currentAction.aborted;
    actionProxy.error = currentAction.error;
    actionProxy.data = currentAction.data;
    actionProxy.computedData = currentAction.computedData;
    actionProxy.completed = currentAction.completed;
  });

  const proxyPrivateSignal = (signalPropertyName, propertyName) => {
    const signalProxy = signal();
    let dispose;
    onActionTargetChange(() => {
      if (dispose) {
        dispose();
        dispose = undefined;
      }
      dispose = effect(() => {
        const currentActionSignal =
          currentActionPrivateProperties[signalPropertyName];
        const currentActionSignalValue = currentActionSignal.value;
        signalProxy.value = currentActionSignalValue;
        if (propertyName) {
          actionProxy[propertyName] = currentActionSignalValue;
        }
      });
      return dispose;
    });
    return signalProxy;
  };
  const proxyPrivateMethod = (method) => {
    return (...args) => currentActionPrivateProperties[method](...args);
  };

  // Create our own signal for params that we control completely
  const proxyParamsSignal = signal(paramsSignal.value);

  // Watch for changes in the original paramsSignal and update ours
  // (original signal wins over any replaceParams calls)
  weakEffect(
    [paramsSignal, proxyParamsSignal],
    (paramsSignalRef, proxyParamsSignalRef) => {
      proxyParamsSignalRef.value = paramsSignalRef.value;
    },
  );

  const proxyPrivateProperties = {
    get currentAction() {
      return currentAction;
    },
    paramsSignal: proxyParamsSignal,
    isPrerunSignal: proxyPrivateSignal("isPrerunSignal", "isPrerun"),
    runningStateSignal: proxyPrivateSignal(
      "runningStateSignal",
      "runningState",
    ),
    errorSignal: proxyPrivateSignal("errorSignal", "error"),
    dataSignal: proxyPrivateSignal("dataSignal", "data"),
    computedDataSignal: proxyPrivateSignal("computedDataSignal"),
    performRun: proxyPrivateMethod("performRun"),
    performStop: proxyPrivateMethod("performStop"),
    ui: currentActionPrivateProperties.ui,
  };

  onActionTargetChange((actionTarget, previousTarget) => {
    proxyPrivateProperties.ui = currentActionPrivateProperties.ui;
    if (previousTarget && actionTarget) {
      const previousPrivateProps = getActionPrivateProperties(previousTarget);
      if (previousPrivateProps.ui.hasRenderers) {
        const newPrivateProps = getActionPrivateProperties(actionTarget);
        newPrivateProps.ui.hasRenderers = true;
      }
    }
    proxyPrivateProperties.childActionWeakSet =
      currentActionPrivateProperties.childActionWeakSet;
  });
  setActionPrivateProperties(actionProxy, proxyPrivateProperties);

  {
    weakEffect([action], () => {
      const params = proxyParamsSignal.value;
      _updateTarget(params);
    });
  }

  actionProxy.replaceParams = (newParams) => {
    if (currentAction === action) {
      const currentParams = proxyParamsSignal.value;
      const nextParams = mergeTwoJsValues(currentParams, newParams);
      if (nextParams === currentParams) {
        return false;
      }
      proxyParamsSignal.value = nextParams;
      return true;
    }
    if (!currentAction.replaceParams(newParams)) {
      return false;
    }
    proxyParamsSignal.value =
      currentActionPrivateProperties.paramsSignal.peek();
    return true;
  };

  if (rerunOnChange) {
    onActionTargetChange((actionTarget, actionTargetPrevious) => {
      if (
        actionTarget &&
        actionTargetPrevious &&
        !actionTargetPrevious.isPrerun
      ) {
        actionTarget.rerun();
      }
    });
  }
  if (onChange) {
    onActionTargetChange((actionTarget, actionTargetPrevious) => {
      onChange(actionTarget, actionTargetPrevious);
    });
  }

  return actionProxy;
};

const generateActionName = (name, params) => {
  if (params === NO_PARAMS$1) {
    return `${name}({})`;
  }
  // Use stringifyForDisplay with asFunctionArgs option for the entire args array
  const argsString = stringifyForDisplay([params], 3, 0, {
    asFunctionArgs: true,
  });
  return `${name}${argsString}`;
};

const useRunOnMount = (action, Component) => {
  useEffect(() => {
    action.run({
      reason: `<${Component.name} /> mounted`,
    });
  }, []);
};

installImportMetaCss(import.meta);
/**
 * A callout component that mimics native browser validation messages.
 * Features:
 * - Positions above or below target element based on available space
 * - Follows target element during scrolling and resizing
 * - Automatically hides when target element is not visible
 * - Arrow automatically shows when pointing at a valid anchor element
 * - Centers in viewport when no anchor element provided or anchor is too big
 */

/**
 * Shows a callout attached to the specified element
 * @param {string} message - HTML content for the callout
 * @param {Object} options - Configuration options
 * @param {HTMLElement} [options.anchorElement] - Element the callout should follow. If not provided or too big, callout will be centered in viewport
 * @param {string} [options.level="warning"] - Callout level: "info" | "warning" | "error"
 * @param {Function} [options.onClose] - Callback when callout is closed
 * @param {boolean} [options.closeOnClickOutside] - Whether to close on outside clicks (defaults to true for "info" level)
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Object} - Callout object with properties:
 *   - {Function} close - Function to close the callout
 *   - {Function} update - Function to update message and options
 *   - {Function} updatePosition - Function to update position
 *   - {HTMLElement} element - The callout DOM element
 *   - {boolean} opened - Whether the callout is currently open
 */
const openCallout = (
  message,
  {
    anchorElement,
    // Level determines visual styling and behavior:
    // "info" - polite announcement (e.g., "This element cannot be modified")
    // "warning" - expected failure requiring user action (e.g., "Field is required")
    // "error" - unexpected failure, may not be actionable (e.g., "Server error")
    level = "warning",
    onClose,
    closeOnClickOutside = level === "info",
    debug = false,
  } = {},
) => {
  const callout = {
    opened: true,
    close: null,
    level: undefined,

    update: null,
    updatePosition: null,

    element: null,
  };

  if (debug) {
    console.debug("open callout", {
      anchorElement,
      message,
      level,
    });
  }

  const [teardown, addTeardown] = createPubSub(true);
  const close = (reason) => {
    if (!callout.opened) {
      return;
    }
    if (debug) {
      console.debug(`callout closed (reason: ${reason})`);
    }
    callout.opened = false;
    teardown(reason);
  };
  if (onClose) {
    addTeardown(onClose);
  }

  const [updateLevel, addLevelEffect] = createValueEffect(undefined);

  // Create and add callout to document
  const calloutElement = createCalloutElement();
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );
  const calloutCloseButton = calloutElement.querySelector(
    ".navi_callout_close_button",
  );
  calloutCloseButton.onclick = () => {
    close("click_close_button");
  };
  const calloutId = `navi_callout_${Date.now()}`;
  calloutElement.id = calloutId;
  calloutStyleController.set(calloutElement, { opacity: 0 });
  const update = (newMessage, options = {}) => {
    // Connect callout with target element for accessibility
    if (options.level && options.level !== callout.level) {
      callout.level = level;
      updateLevel(level);
    }

    if (options.closeOnClickOutside) {
      closeOnClickOutside = options.closeOnClickOutside;
    }

    if (Error.isError(newMessage)) {
      const error = newMessage;
      newMessage = error.message;
      newMessage += `<pre class="navi_callout_error_stack">${escapeHtml(error.stack)}</pre>`;
    }
    calloutMessageElement.innerHTML = newMessage;
  };
  {
    const handleClickOutside = (event) => {
      if (!closeOnClickOutside) {
        return;
      }

      const clickTarget = event.target;
      if (
        clickTarget === calloutElement ||
        calloutElement.contains(clickTarget)
      ) {
        return;
      }
      // if (
      //   clickTarget === targetElement ||
      //   targetElement.contains(clickTarget)
      // ) {
      //   return;
      // }
      close("click_outside");
    };
    document.addEventListener("click", handleClickOutside, true);
    addTeardown(() => {
      document.removeEventListener("click", handleClickOutside, true);
    });
  }
  Object.assign(callout, {
    element: calloutElement,
    update,
    close,
  });
  addLevelEffect(() => {
    calloutElement.setAttribute("data-level", level);
    if (level === "info") {
      calloutElement.setAttribute("role", "status");
    } else {
      calloutElement.setAttribute("role", "alert");
    }
  });
  document.body.appendChild(calloutElement);
  addTeardown(() => {
    calloutElement.remove();
  });

  if (anchorElement) {
    const anchorVisuallyVisibleInfo = getVisuallyVisibleInfo(anchorElement, {
      countOffscreenAsVisible: true,
    });
    if (!anchorVisuallyVisibleInfo.visible) {
      console.warn(
        `anchor element is not visually visible (${anchorVisuallyVisibleInfo.reason}) -> will be anchored to first visually visible ancestor`,
      );
      anchorElement = getFirstVisuallyVisibleAncestor(anchorElement);
    }

    allowWheelThrough(calloutElement, anchorElement);
    anchorElement.setAttribute("data-callout", calloutId);
    addTeardown(() => {
      anchorElement.removeAttribute("data-callout");
    });

    addLevelEffect(() => {
      anchorElement.style.setProperty(
        "--callout-color",
        `var(--navi-${level}-color)`,
      );
      return () => {
        anchorElement.style.removeProperty("--callout-color");
      };
    });
    addLevelEffect((level) => {
      if (level === "info") {
        anchorElement.setAttribute("aria-describedby", calloutId);
        return () => {
          anchorElement.removeAttribute("aria-describedby");
        };
      }
      anchorElement.setAttribute("aria-errormessage", calloutId);
      anchorElement.setAttribute("aria-invalid", "true");
      return () => {
        anchorElement.removeAttribute("aria-errormessage");
        anchorElement.removeAttribute("aria-invalid");
      };
    });

    {
      const onfocus = () => {
        if (level === "error") {
          // error messages must be explicitely closed by the user
          return;
        }
        if (anchorElement.hasAttribute("data-callout-stay-on-focus")) {
          return;
        }
        close("target_element_focus");
      };
      anchorElement.addEventListener("focus", onfocus);
      addTeardown(() => {
        anchorElement.removeEventListener("focus", onfocus);
      });
    }
    anchorElement.callout = callout;
    addTeardown(() => {
      delete anchorElement.callout;
    });
  }

  update(message, { level });

  {
    let positioner;
    let strategy;
    const determine = () => {
      if (!anchorElement) {
        return "centered";
      }
      // Check if anchor element is too big to reasonably position callout relative to it
      const anchorRect = anchorElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const anchorTooBig = anchorRect.height > viewportHeight - 50;
      if (anchorTooBig) {
        return "centered";
      }
      return "anchored";
    };
    const updatePositioner = () => {
      const newStrategy = determine();
      if (newStrategy === strategy) {
        return;
      }
      positioner?.stop();
      if (newStrategy === "centered") {
        positioner = centerCalloutInViewport(calloutElement);
      } else {
        positioner = stickCalloutToAnchor(calloutElement, anchorElement);
      }
      strategy = newStrategy;
    };
    updatePositioner();
    addTeardown(() => {
      positioner.stop();
    });
    {
      const handleResize = () => {
        updatePositioner();
      };
      window.addEventListener("resize", handleResize);
      addTeardown(() => {
        window.removeEventListener("resize", handleResize);
      });
    }
    callout.updatePosition = () => positioner.update();
  }

  return callout;
};

// Configuration parameters for callout appearance
const BORDER_WIDTH = 1;
const CORNER_RADIUS = 3;
const ARROW_WIDTH = 16;
const ARROW_HEIGHT = 8;
const ARROW_SPACING = 8;

import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-callout-background-color: white;
      --navi-callout-padding: 8px;
    }

    .navi_callout {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      display: block;
      height: auto;
      opacity: 0;
      /* will be positioned with transform: translate */
      transition: opacity 0.2s ease-in-out;
      overflow: visible;
    }

    .navi_callout_frame {
      position: absolute;
      filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
      pointer-events: none;
    }
    .navi_callout[data-level="info"] .navi_callout_border {
      fill: var(--navi-info-color);
    }
    .navi_callout[data-level="warning"] .navi_callout_border {
      fill: var(--navi-warning-color);
    }
    .navi_callout[data-level="error"] .navi_callout_border {
      fill: var(--navi-error-color);
    }
    .navi_callout_frame svg {
      position: absolute;
      inset: 0;
      overflow: visible;
    }
    .navi_callout_background {
      fill: var(--navi-callout-background-color);
    }

    .navi_callout_box {
      position: relative;
      border-style: solid;
      border-color: transparent;
    }
    .navi_callout_body {
      position: relative;
      display: flex;
      max-width: 47vw;
      padding: var(--navi-callout-padding);
      flex-direction: row;
      gap: 10px;
    }
    .navi_callout_icon {
      display: flex;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      align-items: center;
      align-self: flex-start;
      justify-content: center;
      border-radius: 2px;
    }
    .navi_callout_icon_svg {
      width: 16px;
      height: 12px;
      color: white;
    }
    .navi_callout[data-level="info"] .navi_callout_icon {
      background-color: var(--navi-info-color);
    }
    .navi_callout[data-level="warning"] .navi_callout_icon {
      background-color: var(--navi-warning-color);
    }
    .navi_callout[data-level="error"] .navi_callout_icon {
      background-color: var(--navi-error-color);
    }
    .navi_callout_message {
      min-width: 0;
      align-self: center;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .navi_callout_close_button_column {
      display: flex;
      height: 22px;
    }
    .navi_callout_close_button {
      width: 1em;
      height: 1em;
      padding: 0;
      align-self: center;
      color: currentColor;
      font-size: inherit;
      background: none;
      border: none;
      border-radius: 0.2em;
      cursor: pointer;
    }
    .navi_callout_close_button:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    .navi_callout_close_button_svg {
      width: 100%;
      height: 100%;
    }
    .navi_callout_error_stack {
      max-height: 200px;
      overflow: auto;
    }
  }
`;

// HTML template for the callout
const calloutTemplate = /* html */ `
  <div class="navi_callout">
    <div class="navi_callout_box">
      <div class="navi_callout_frame"></div>
      <div class="navi_callout_body">
        <div class="navi_callout_icon">
          <svg
            class="navi_callout_icon_svg"
            viewBox="0 0 125 300"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="currentColor"
              d="m25,1 8,196h59l8-196zm37,224a37,37 0 1,0 2,0z"
            />
          </svg>
        </div>
        <div class="navi_callout_message">Default message</div>
        <div class="navi_callout_close_button_column">
          <button class="navi_callout_close_button">
            <svg
              class="navi_callout_close_button_svg"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
`;

const calloutStyleController = createStyleController("callout");

/**
 * Creates a new callout element from template
 * @returns {HTMLElement} - The callout element
 */
const createCalloutElement = () => {
  const div = document.createElement("div");
  div.innerHTML = calloutTemplate;
  const calloutElement = div.firstElementChild;
  return calloutElement;
};

const centerCalloutInViewport = (calloutElement) => {
  // Set up initial styles for centered positioning
  const calloutBoxElement = calloutElement.querySelector(".navi_callout_box");
  const calloutFrameElement = calloutElement.querySelector(
    ".navi_callout_frame",
  );
  const calloutBodyElement = calloutElement.querySelector(".navi_callout_body");
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );

  // Remove any margins and set frame positioning for no arrow
  calloutBoxElement.style.marginTop = "";
  calloutBoxElement.style.marginBottom = "";
  calloutBoxElement.style.borderWidth = `${BORDER_WIDTH}px`;
  calloutFrameElement.style.left = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.right = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.top = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.bottom = `-${BORDER_WIDTH}px`;

  // Generate simple rectangle SVG without arrow and position in center
  const updateCenteredPosition = () => {
    const calloutElementClone =
      cloneCalloutToMeasureNaturalSize(calloutElement);
    const { height } = calloutElementClone.getBoundingClientRect();
    calloutElementClone.remove();

    // Handle content overflow when viewport is too small
    const viewportHeight = window.innerHeight;
    const maxAllowedHeight = viewportHeight - 40; // Leave some margin from viewport edges

    if (height > maxAllowedHeight) {
      const paddingSizes = getPaddingSizes(calloutBodyElement);
      const paddingY = paddingSizes.top + paddingSizes.bottom;
      const spaceNeededAroundContent = BORDER_WIDTH * 2 + paddingY;
      const spaceAvailableForContent =
        maxAllowedHeight - spaceNeededAroundContent;
      calloutMessageElement.style.maxHeight = `${spaceAvailableForContent}px`;
      calloutMessageElement.style.overflowY = "scroll";
    } else {
      // Reset overflow styles if not needed
      calloutMessageElement.style.maxHeight = "";
      calloutMessageElement.style.overflowY = "";
    }

    // Get final dimensions after potential overflow adjustments
    const { width: finalWidth, height: finalHeight } =
      calloutElement.getBoundingClientRect();
    calloutFrameElement.innerHTML = generateSvgWithoutArrow(
      finalWidth,
      finalHeight,
    );

    // Center in viewport
    const viewportWidth = window.innerWidth;
    const left = (viewportWidth - finalWidth) / 2;
    const top = (viewportHeight - finalHeight) / 2;

    calloutStyleController.set(calloutElement, {
      opacity: 1,
      transform: {
        translateX: left,
        translateY: top,
      },
    });
  };

  // Initial positioning
  updateCenteredPosition();

  window.addEventListener("resize", updateCenteredPosition);

  // Return positioning function for dynamic updates
  return {
    update: updateCenteredPosition,
    stop: () => {
      window.removeEventListener("resize", updateCenteredPosition);
    },
  };
};

/**
 * Positions a callout relative to an anchor element with an arrow pointing to it
 * @param {HTMLElement} calloutElement - The callout element to position
 * @param {HTMLElement} anchorElement - The anchor element to stick to
 * @returns {Object} - Object with update and stop functions
 */
const stickCalloutToAnchor = (calloutElement, anchorElement) => {
  // Get references to callout parts
  const calloutBoxElement = calloutElement.querySelector(".navi_callout_box");
  const calloutFrameElement = calloutElement.querySelector(
    ".navi_callout_frame",
  );
  const calloutBodyElement = calloutElement.querySelector(".navi_callout_body");
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );

  // Set initial border styles
  calloutBoxElement.style.borderWidth = `${BORDER_WIDTH}px`;
  calloutFrameElement.style.left = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.right = `-${BORDER_WIDTH}px`;

  const anchorVisibleRectEffect = visibleRectEffect(
    anchorElement,
    ({ left: anchorLeft, right: anchorRight, visibilityRatio }) => {
      const calloutElementClone =
        cloneCalloutToMeasureNaturalSize(calloutElement);
      const {
        position,
        left: calloutLeft,
        top: calloutTop,
        width: calloutWidth,
        height: calloutHeight,
        spaceAboveTarget,
        spaceBelowTarget,
      } = pickPositionRelativeTo(calloutElementClone, anchorElement, {
        alignToViewportEdgeWhenTargetNearEdge: 20,
        // when fully to the left, the border color is collé to the browser window making it hard to see
        minLeft: 1,
      });
      calloutElementClone.remove();

      // Calculate arrow position to point at anchorElement element
      let arrowLeftPosOnCallout;
      // Determine arrow target position based on attribute
      const arrowPositionAttribute = anchorElement.getAttribute(
        "data-callout-arrow-x",
      );
      let arrowAnchorLeft;
      if (arrowPositionAttribute === "center") {
        // Target the center of the anchorElement element
        arrowAnchorLeft = (anchorLeft + anchorRight) / 2;
      } else {
        const anchorBorderSizes = getBorderSizes(anchorElement);
        // Default behavior: target the left edge of the anchorElement element (after borders)
        arrowAnchorLeft = anchorLeft + anchorBorderSizes.left;
      }

      // Calculate arrow position within the callout
      if (calloutLeft < arrowAnchorLeft) {
        // Callout is left of the target point, move arrow right
        const diff = arrowAnchorLeft - calloutLeft;
        arrowLeftPosOnCallout = diff;
      } else if (calloutLeft + calloutWidth < arrowAnchorLeft) {
        // Edge case: target point is beyond right edge of callout
        arrowLeftPosOnCallout = calloutWidth - ARROW_WIDTH;
      } else {
        // Target point is within callout width
        arrowLeftPosOnCallout = arrowAnchorLeft - calloutLeft;
      }

      // Ensure arrow stays within callout bounds with some padding
      const minArrowPos = CORNER_RADIUS + ARROW_WIDTH / 2 + ARROW_SPACING;
      const maxArrowPos = calloutWidth - minArrowPos;
      arrowLeftPosOnCallout = Math.max(
        minArrowPos,
        Math.min(arrowLeftPosOnCallout, maxArrowPos),
      );

      // Force content overflow when there is not enough space to display
      // the entirety of the callout
      const spaceAvailable =
        position === "below" ? spaceBelowTarget : spaceAboveTarget;
      const paddingSizes = getPaddingSizes(calloutBodyElement);
      const paddingY = paddingSizes.top + paddingSizes.bottom;
      const spaceNeededAroundContent =
        ARROW_HEIGHT + BORDER_WIDTH * 2 + paddingY;
      const spaceAvailableForContent =
        spaceAvailable - spaceNeededAroundContent;
      const contentHeight = calloutHeight - spaceNeededAroundContent;
      const spaceRemainingAfterContent =
        spaceAvailableForContent - contentHeight;
      if (spaceRemainingAfterContent < 2) {
        const maxHeight = spaceAvailableForContent;
        calloutMessageElement.style.maxHeight = `${maxHeight}px`;
        calloutMessageElement.style.overflowY = "scroll";
      } else {
        calloutMessageElement.style.maxHeight = "";
        calloutMessageElement.style.overflowY = "";
      }

      const { width, height } = calloutElement.getBoundingClientRect();
      if (position === "above") {
        // Position above target element
        calloutBoxElement.style.marginTop = "";
        calloutBoxElement.style.marginBottom = `${ARROW_HEIGHT}px`;
        calloutFrameElement.style.top = `-${BORDER_WIDTH}px`;
        calloutFrameElement.style.bottom = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        calloutFrameElement.innerHTML = generateSvgWithBottomArrow(
          width,
          height,
          arrowLeftPosOnCallout,
        );
      } else {
        calloutBoxElement.style.marginTop = `${ARROW_HEIGHT}px`;
        calloutBoxElement.style.marginBottom = "";
        calloutFrameElement.style.top = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        calloutFrameElement.style.bottom = `-${BORDER_WIDTH}px`;
        calloutFrameElement.innerHTML = generateSvgWithTopArrow(
          width,
          height,
          arrowLeftPosOnCallout,
        );
      }

      calloutElement.setAttribute("data-position", position);
      calloutStyleController.set(calloutElement, {
        opacity: visibilityRatio ? 1 : 0,
        transform: {
          translateX: calloutLeft,
          translateY: calloutTop,
        },
      });
    },
  );
  const calloutSizeChangeObserver = observeCalloutSizeChange(
    calloutMessageElement,
    (width, height) => {
      anchorVisibleRectEffect.check(`callout_size_change (${width}x${height})`);
    },
  );
  anchorVisibleRectEffect.onBeforeAutoCheck(() => {
    // prevent feedback loop because check triggers size change which triggers check...
    calloutSizeChangeObserver.disable();
    return () => {
      calloutSizeChangeObserver.enable();
    };
  });

  return {
    update: anchorVisibleRectEffect.check,
    stop: () => {
      calloutSizeChangeObserver.disconnect();
      anchorVisibleRectEffect.disconnect();
    },
  };
};

const observeCalloutSizeChange = (elementSizeToObserve, callback) => {
  let lastContentWidth;
  let lastContentHeight;
  const resizeObserver = new ResizeObserver((entries) => {
    const [entry] = entries;
    const { width, height } = entry.contentRect;
    // Debounce tiny changes that are likely sub-pixel rounding
    if (lastContentWidth !== undefined) {
      const widthDiff = Math.abs(width - lastContentWidth);
      const heightDiff = Math.abs(height - lastContentHeight);
      const threshold = 1; // Ignore changes smaller than 1px
      if (widthDiff < threshold && heightDiff < threshold) {
        return;
      }
    }
    lastContentWidth = width;
    lastContentHeight = height;
    callback(width, height);
  });
  resizeObserver.observe(elementSizeToObserve);

  return {
    disable: () => {
      resizeObserver.unobserve(elementSizeToObserve);
    },
    enable: () => {
      resizeObserver.observe(elementSizeToObserve);
    },
    disconnect: () => {
      resizeObserver.disconnect();
    },
  };
};

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// It's ok to do this because the element is absolutely positioned
const cloneCalloutToMeasureNaturalSize = (calloutElement) => {
  // Create invisible clone to measure natural size
  const calloutElementClone = calloutElement.cloneNode(true);
  calloutElementClone.style.visibility = "hidden";
  const calloutMessageElementClone = calloutElementClone.querySelector(
    ".navi_callout_message",
  );
  // Reset any overflow constraints on the clone
  calloutMessageElementClone.style.maxHeight = "";
  calloutMessageElementClone.style.overflowY = "";

  // Add clone to DOM to measure
  calloutElement.parentNode.appendChild(calloutElementClone);

  return calloutElementClone;
};

/**
 * Generates SVG path for callout with arrow on top
 * @param {number} width - Callout width
 * @param {number} height - Callout height
 * @param {number} arrowPosition - Horizontal position of arrow
 * @returns {string} - SVG markup
 */
const generateSvgWithTopArrow = (width, height, arrowPosition) => {
  // Calculate valid arrow position range
  const arrowLeft =
    ARROW_WIDTH / 2 + CORNER_RADIUS + BORDER_WIDTH + ARROW_SPACING;
  const minArrowPos = arrowLeft;
  const maxArrowPos = width - arrowLeft;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - ARROW_HEIGHT;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + ARROW_HEIGHT;

  // Slight adjustment for visual balance
  const innerArrowWidthReduction = Math.min(BORDER_WIDTH * 0.3, 1);

  // Outer path (border)
  const outerPath = `
      M${CORNER_RADIUS},${ARROW_HEIGHT} 
      H${constrainedArrowPos - ARROW_WIDTH / 2} 
      L${constrainedArrowPos},0 
      L${constrainedArrowPos + ARROW_WIDTH / 2},${ARROW_HEIGHT} 
      H${width - CORNER_RADIUS} 
      Q${width},${ARROW_HEIGHT} ${width},${ARROW_HEIGHT + CORNER_RADIUS} 
      V${adjustedHeight - CORNER_RADIUS} 
      Q${width},${adjustedHeight} ${width - CORNER_RADIUS},${adjustedHeight} 
      H${CORNER_RADIUS} 
      Q0,${adjustedHeight} 0,${adjustedHeight - CORNER_RADIUS} 
      V${ARROW_HEIGHT + CORNER_RADIUS} 
      Q0,${ARROW_HEIGHT} ${CORNER_RADIUS},${ARROW_HEIGHT}
    `;

  // Inner path (content) - keep arrow width almost the same
  const innerRadius = Math.max(0, CORNER_RADIUS - BORDER_WIDTH);
  const innerPath = `
    M${innerRadius + BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} 
    H${constrainedArrowPos - ARROW_WIDTH / 2 + innerArrowWidthReduction} 
    L${constrainedArrowPos},${BORDER_WIDTH} 
    L${constrainedArrowPos + ARROW_WIDTH / 2 - innerArrowWidthReduction},${ARROW_HEIGHT + BORDER_WIDTH} 
    H${width - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} ${width - BORDER_WIDTH},${ARROW_HEIGHT + innerRadius + BORDER_WIDTH} 
    V${adjustedHeight - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} ${width - innerRadius - BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} 
    H${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} ${BORDER_WIDTH},${adjustedHeight - innerRadius - BORDER_WIDTH} 
    V${ARROW_HEIGHT + innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} ${innerRadius + BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH}
  `;

  return /* html */ `
    <svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" class="navi_callout_border" />
      <path d="${innerPath}" class="navi_callout_background" />
    </svg>`;
};

/**
 * Generates SVG path for callout with arrow on bottom
 * @param {number} width - Callout width
 * @param {number} height - Callout height
 * @param {number} arrowPosition - Horizontal position of arrow
 * @returns {string} - SVG markup
 */
const generateSvgWithBottomArrow = (width, height, arrowPosition) => {
  // Calculate valid arrow position range
  const arrowLeft =
    ARROW_WIDTH / 2 + CORNER_RADIUS + BORDER_WIDTH + ARROW_SPACING;
  const minArrowPos = arrowLeft;
  const maxArrowPos = width - arrowLeft;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - ARROW_HEIGHT;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + ARROW_HEIGHT;

  // For small border widths, keep inner arrow nearly the same size as outer
  const innerArrowWidthReduction = Math.min(BORDER_WIDTH * 0.3, 1);

  // Outer path with rounded corners
  const outerPath = `
      M${CORNER_RADIUS},0 
      H${width - CORNER_RADIUS} 
      Q${width},0 ${width},${CORNER_RADIUS} 
      V${contentHeight - CORNER_RADIUS} 
      Q${width},${contentHeight} ${width - CORNER_RADIUS},${contentHeight} 
      H${constrainedArrowPos + ARROW_WIDTH / 2} 
      L${constrainedArrowPos},${adjustedHeight} 
      L${constrainedArrowPos - ARROW_WIDTH / 2},${contentHeight} 
      H${CORNER_RADIUS} 
      Q0,${contentHeight} 0,${contentHeight - CORNER_RADIUS} 
      V${CORNER_RADIUS} 
      Q0,0 ${CORNER_RADIUS},0
    `;

  // Inner path with correct arrow direction and color
  const innerRadius = Math.max(0, CORNER_RADIUS - BORDER_WIDTH);
  const innerPath = `
    M${innerRadius + BORDER_WIDTH},${BORDER_WIDTH} 
    H${width - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${BORDER_WIDTH} ${width - BORDER_WIDTH},${innerRadius + BORDER_WIDTH} 
    V${contentHeight - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${contentHeight - BORDER_WIDTH} ${width - innerRadius - BORDER_WIDTH},${contentHeight - BORDER_WIDTH} 
    H${constrainedArrowPos + ARROW_WIDTH / 2 - innerArrowWidthReduction} 
    L${constrainedArrowPos},${adjustedHeight - BORDER_WIDTH} 
    L${constrainedArrowPos - ARROW_WIDTH / 2 + innerArrowWidthReduction},${contentHeight - BORDER_WIDTH} 
    H${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${contentHeight - BORDER_WIDTH} ${BORDER_WIDTH},${contentHeight - innerRadius - BORDER_WIDTH} 
    V${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${BORDER_WIDTH} ${innerRadius + BORDER_WIDTH},${BORDER_WIDTH}
  `;

  return /* html */ `
    <svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" class="navi_callout_border" />
      <path d="${innerPath}" class="navi_callout_background" />
    </svg>`;
};

/**
 * Generates SVG path for callout without arrow (simple rectangle)
 * @param {number} width - Callout width
 * @param {number} height - Callout height
 * @returns {string} - SVG markup
 */
const generateSvgWithoutArrow = (width, height) => {
  return /* html */ `
    <svg
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <rect
        class="navi_callout_border"
        x="0"
        y="0"
        width="${width}"
        height="${height}"
        rx="${CORNER_RADIUS}"
        ry="${CORNER_RADIUS}"
      />
      <rect
        class="navi_callout_background"
        x="${BORDER_WIDTH}"
        y="${BORDER_WIDTH}"
        width="${width - BORDER_WIDTH * 2}"
        height="${height - BORDER_WIDTH * 2}"
        rx="${Math.max(0, CORNER_RADIUS - BORDER_WIDTH)}"
        ry="${Math.max(0, CORNER_RADIUS - BORDER_WIDTH)}"
      />
    </svg>`;
};

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
const DISABLED_CONSTRAINT = {
  name: "disabled",
  check: (element) => {
    if (element.disabled) {
      return `Ce champ est désactivé.`;
    }
    return null;
  },
};

const REQUIRED_CONSTRAINT = {
  name: "required",
  check: (element, { registerChange }) => {
    if (!element.required) {
      return null;
    }
    const requiredMessage = element.getAttribute("data-required-message");

    if (element.type === "checkbox") {
      if (!element.checked) {
        return requiredMessage || `Veuillez cocher cette case.`;
      }
      return null;
    }
    if (element.type === "radio") {
      // For radio buttons, check if any radio with the same name is selected
      const name = element.name;
      if (!name) {
        // If no name, check just this radio
        if (!element.checked) {
          return requiredMessage || `Veuillez sélectionner une option.`;
        }
        return null;
      }

      const closestFieldset = element.closest("fieldset");
      const fieldsetRequiredMessage = closestFieldset
        ? closestFieldset.getAttribute("data-required-message")
        : null;

      // Find the container (form or closest fieldset)
      const container = element.form || closestFieldset || document;
      // Check if any radio with the same name is checked
      const radioSelector = `input[type="radio"][name="${CSS.escape(name)}"]`;
      const radiosWithSameName = container.querySelectorAll(radioSelector);
      for (const radio of radiosWithSameName) {
        if (radio.checked) {
          return null; // At least one radio is selected
        }
        registerChange((onChange) => {
          radio.addEventListener("change", onChange);
          return () => {
            radio.removeEventListener("change", onChange);
          };
        });
      }

      return {
        message:
          requiredMessage ||
          fieldsetRequiredMessage ||
          `Veuillez sélectionner une option.`,
        target: closestFieldset
          ? closestFieldset.querySelector("legend")
          : undefined,
      };
    }
    if (!element.value) {
      return requiredMessage || `Veuillez remplir ce champ.`;
    }
    return null;
  },
};
const PATTERN_CONSTRAINT = {
  name: "pattern",
  check: (input) => {
    const pattern = input.pattern;
    if (!pattern) {
      return null;
    }
    const value = input.value;
    if (!value) {
      return null;
    }
    const regex = new RegExp(pattern);
    if (!regex.test(value)) {
      const patternMessage = input.getAttribute("data-pattern-message");
      if (patternMessage) {
        return patternMessage;
      }
      let message = `Veuillez respecter le format requis.`;
      const title = input.title;
      if (title) {
        message += `<br />${title}`;
      }
      return message;
    }
    return null;
  },
};
// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/email#validation
const emailregex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const TYPE_EMAIL_CONSTRAINT = {
  name: "type_email",
  check: (input) => {
    if (input.type !== "email") {
      return null;
    }
    const value = input.value;
    if (!value) {
      return null;
    }
    if (!value.includes("@")) {
      return `Veuillez inclure "@" dans l'adresse e-mail. Il manque un symbole "@" dans ${value}.`;
    }
    if (!emailregex.test(value)) {
      return `Veuillez saisir une adresse e-mail valide.`;
    }
    return null;
  },
};

const MIN_LENGTH_CONSTRAINT = {
  name: "min_length",
  check: (element) => {
    if (element.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET.has(element.type)) {
        return null;
      }
    } else if (element.tagName !== "TEXTAREA") {
      return null;
    }

    const minLength = element.minLength;
    if (minLength === -1) {
      return null;
    }

    const value = element.value;
    const valueLength = value.length;
    if (valueLength === 0) {
      return null;
    }
    if (valueLength < minLength) {
      if (valueLength === 1) {
        return `Ce champ doit contenir au moins ${minLength} caractère (il contient actuellement un seul caractère).`;
      }
      return `Ce champ doit contenir au moins ${minLength} caractères (il contient actuellement ${valueLength} caractères).`;
    }
    return null;
  },
};
const INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
]);

const MAX_LENGTH_CONSTRAINT = {
  name: "max_length",
  check: (element) => {
    if (element.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET.has(element.type)) {
        return null;
      }
    } else if (element.tagName !== "TEXTAREA") {
      return null;
    }

    const maxLength = element.maxLength;
    if (maxLength === -1) {
      return null;
    }

    const value = element.value;
    const valueLength = value.length;
    if (valueLength > maxLength) {
      return `Ce champ doit contenir au maximum ${maxLength} caractères (il contient actuellement ${valueLength} caractères).`;
    }
    return null;
  },
};
const INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET = new Set(
  INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET,
);

const TYPE_NUMBER_CONSTRAINT = {
  name: "type_number",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type !== "number") {
      return null;
    }
    if (element.value === "") {
      return null;
    }
    const value = element.valueAsNumber;
    if (isNaN(value)) {
      return `Doit être un nombre.`;
    }
    return null;
  },
};

const MIN_CONSTRAINT = {
  name: "min",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type === "number") {
      const minString = element.min;
      if (minString === "") {
        return null;
      }
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const valueAsNumber = element.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber < minNumber) {
        const minMessage = element.getAttribute("data-min-message");
        return (
          minMessage ||
          `Doit être supérieur ou égal à <strong>${minString}</strong>.`
        );
      }
      return null;
    }
    if (element.type === "time") {
      const min = element.min;
      if (min === undefined) {
        return null;
      }
      const [minHours, minMinutes] = min.split(":").map(Number);
      const value = element.value;
      const [hours, minutes] = value.split(":").map(Number);
      if (hours < minHours) {
        return `Doit être <strong>${min}</strong> ou plus.`;
      }
      if (hours === minHours && minMinutes < minutes) {
        return `Doit être <strong>${min}</strong> ou plus.`;
      }
      return null;
    }
    // "range"
    // - user interface do not let user enter anything outside the boundaries
    // - when setting value via js browser enforce boundaries too
    // "date", "month", "week", "datetime-local"
    // - same as "range"
    return null;
  },
};

const MAX_CONSTRAINT = {
  name: "max",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type === "number") {
      const maxString = element.max;
      if (maxString === "") {
        return null;
      }
      const maxNumber = parseFloat(maxString);
      if (isNaN(maxNumber)) {
        return null;
      }
      const valueAsNumber = element.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber > maxNumber) {
        const maxMessage = element.getAttribute("data-max-message");
        return maxMessage || `Doit être <strong>${maxString}</strong> ou plus.`;
      }
      return null;
    }
    if (element.type === "time") {
      const max = element.min;
      if (max === undefined) {
        return null;
      }
      const [maxHours, maxMinutes] = max.split(":").map(Number);
      const value = element.value;
      const [hours, minutes] = value.split(":").map(Number);
      if (hours > maxHours) {
        return `Doit être <strong>${max}</strong> ou moins.`;
      }
      if (hours === maxHours && maxMinutes > minutes) {
        return `Doit être <strong>${max}</strong> ou moins.`;
      }
      return null;
    }
    return null;
  },
};

const READONLY_CONSTRAINT = {
  name: "readonly",
  check: (element, { skipReadonly }) => {
    if (skipReadonly) {
      return null;
    }
    if (!element.readonly && !element.hasAttribute("data-readonly")) {
      return null;
    }
    if (element.type === "hidden") {
      return null;
    }
    const readonlySilent = element.hasAttribute("data-readonly-silent");
    if (readonlySilent) {
      return { silent: true };
    }
    const readonlyMessage = element.getAttribute("data-readonly-message");
    if (readonlyMessage) {
      return {
        message: readonlyMessage,
        level: "info",
      };
    }
    const isBusy = element.getAttribute("aria-busy") === "true";
    if (isBusy) {
      return {
        target: element,
        message: `Cette action est en cours. Veuillez patienter.`,
        level: "info",
      };
    }
    return {
      target: element,
      message:
        element.tagName === "BUTTON"
          ? `Cet action n'est pas disponible pour l'instant.`
          : `Cet élément est en lecture seule et ne peut pas être modifié.`,
      level: "info",
    };
  },
};

/**
 * Custom form validation implementation
 *
 * This implementation addresses several limitations of the browser's native validation API:
 *
 * Limitations of native validation:
 * - Cannot programmatically detect if validation message is currently displayed
 * - No ability to dismiss messages with keyboard (e.g., Escape key)
 * - Requires complex event handling to manage validation message display
 * - Limited support for storing/managing multiple validation messages
 * - No customization of validation message appearance
 *
 * Design approach:
 * - Works alongside native validation (which acts as a fallback)
 * - Proactively detects validation issues before native validation triggers
 * - Provides complete control over validation message UX
 * - Supports keyboard navigation and dismissal
 * - Allows custom styling and positioning of validation messages
 *
 * Features:
 * - Constraint-based validation system with built-in and custom constraints
 * - Custom validation messages with different severity levels
 * - Form submission prevention on validation failure
 * - Validation on Enter key in forms or standalone inputs
 * - Escape key to dismiss validation messages
 * - Support for standard HTML validation attributes (required, pattern, type="email")
 * - Validation messages that follow the input element and adapt to viewport
 */


const validationInProgressWeakSet = new WeakSet();

const requestAction = (
  target,
  action,
  {
    event,
    requester = target,
    actionOrigin,
    method = "rerun",
    meta = {},
    confirmMessage,
  } = {},
) => {
  if (!actionOrigin) {
    console.warn("requestAction: actionOrigin is required");
  }
  let elementToValidate = requester;

  let validationInterface = elementToValidate.__validationInterface__;
  if (!validationInterface) {
    validationInterface = installCustomConstraintValidation(elementToValidate);
  }

  const customEventDetail = {
    action,
    actionOrigin,
    method,
    event,
    requester,
    meta,
  };

  // Determine what needs to be validated and how to handle the result
  const isForm = elementToValidate.tagName === "FORM";
  const formToValidate = isForm ? elementToValidate : elementToValidate.form;

  let isValid = false;
  let elementForConfirmation = elementToValidate;
  let elementForDispatch = elementToValidate;

  if (formToValidate) {
    // Form validation case
    if (validationInProgressWeakSet.has(formToValidate)) {
      return false;
    }
    validationInProgressWeakSet.add(formToValidate);
    setTimeout(() => {
      validationInProgressWeakSet.delete(formToValidate);
    });

    // Validate all form elements
    const formElements = formToValidate.elements;
    isValid = true; // Assume valid until proven otherwise
    for (const formElement of formElements) {
      const elementValidationInterface = formElement.__validationInterface__;
      if (!elementValidationInterface) {
        continue;
      }

      const elementIsValid = elementValidationInterface.checkValidity({
        fromRequestAction: true,
        skipReadonly:
          formElement.tagName === "BUTTON" && formElement !== requester,
      });
      if (!elementIsValid) {
        elementValidationInterface.reportValidity();
        isValid = false;
        break;
      }
    }

    elementForConfirmation = formToValidate;
    elementForDispatch = target;
  } else {
    // Single element validation case
    isValid = validationInterface.checkValidity({ fromRequestAction: true });
    if (!isValid) {
      if (event) {
        event.preventDefault();
      }
      validationInterface.reportValidity();
    }

    elementForConfirmation = target;
    elementForDispatch = target;
  }

  // If validation failed, dispatch actionprevented and return
  if (!isValid) {
    const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
      detail: customEventDetail,
    });
    elementForDispatch.dispatchEvent(actionPreventedCustomEvent);
    return false;
  }

  // Validation passed, check for confirmation
  confirmMessage =
    confirmMessage ||
    elementForConfirmation.getAttribute("data-confirm-message");
  if (confirmMessage) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(confirmMessage)) {
      const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
        detail: customEventDetail,
      });
      elementForDispatch.dispatchEvent(actionPreventedCustomEvent);
      return false;
    }
  }

  // All good, dispatch the action
  const actionCustomEvent = new CustomEvent("action", {
    detail: customEventDetail,
  });
  elementForDispatch.dispatchEvent(actionCustomEvent);
  return true;
};

const closeValidationMessage = (element, reason) => {
  const validationInterface = element.__validationInterface__;
  if (!validationInterface) {
    return false;
  }
  const { validationMessage } = validationInterface;
  if (!validationMessage) {
    return false;
  }
  return validationMessage.close(reason);
};

const installCustomConstraintValidation = (
  element,
  elementReceivingValidationMessage = element,
) => {
  if (element.tagName === "INPUT" && element.type === "hidden") {
    elementReceivingValidationMessage = element.form || document.body;
  }

  const validationInterface = {
    uninstall: undefined,
    registerConstraint: undefined,
    addCustomMessage: undefined,
    removeCustomMessage: undefined,
    checkValidity: undefined,
    reportValidity: undefined,
    validationMessage: null,
  };

  const cleanupCallbackSet = new Set();
  {
    const uninstall = () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
    validationInterface.uninstall = uninstall;
  }

  {
    element.__validationInterface__ = validationInterface;
    cleanupCallbackSet.add(() => {
      delete element.__validationInterface__;
    });
  }

  const dispatchCancelCustomEvent = (options) => {
    const cancelEvent = new CustomEvent("cancel", options);
    element.dispatchEvent(cancelEvent);
  };

  const closeElementValidationMessage = (reason) => {
    if (validationInterface.validationMessage) {
      validationInterface.validationMessage.close(reason);
      return true;
    }
    return false;
  };

  const constraintSet = new Set();
  constraintSet.add(DISABLED_CONSTRAINT);
  constraintSet.add(REQUIRED_CONSTRAINT);
  constraintSet.add(PATTERN_CONSTRAINT);
  constraintSet.add(TYPE_EMAIL_CONSTRAINT);
  constraintSet.add(TYPE_NUMBER_CONSTRAINT);
  constraintSet.add(MIN_LENGTH_CONSTRAINT);
  constraintSet.add(MAX_LENGTH_CONSTRAINT);
  constraintSet.add(MIN_CONSTRAINT);
  constraintSet.add(MAX_CONSTRAINT);
  constraintSet.add(READONLY_CONSTRAINT);
  {
    validationInterface.registerConstraint = (constraint) => {
      if (typeof constraint === "function") {
        constraint = {
          name: constraint.name || "custom_function",
          check: constraint,
        };
      }
      constraintSet.add(constraint);
      return () => {
        constraintSet.delete(constraint);
      };
    };
  }

  let failedConstraintInfo = null;
  const validityInfoMap = new Map();

  const resetValidity = ({ fromRequestAction } = {}) => {
    if (fromRequestAction && failedConstraintInfo) {
      for (const [key, customMessage] of customMessageMap) {
        if (customMessage.removeOnRequestAction) {
          customMessageMap.delete(key);
        }
      }
    }

    for (const [, validityInfo] of validityInfoMap) {
      if (validityInfo.cleanup) {
        validityInfo.cleanup();
      }
    }
    validityInfoMap.clear();
    failedConstraintInfo = null;
  };
  cleanupCallbackSet.add(resetValidity);

  const checkValidity = ({ fromRequestAction, skipReadonly } = {}) => {
    resetValidity({ fromRequestAction });
    for (const constraint of constraintSet) {
      const constraintCleanupSet = new Set();
      const registerChange = (register) => {
        const registerResult = register(() => {
          checkValidity();
        });
        if (typeof registerResult === "function") {
          constraintCleanupSet.add(registerResult);
        }
      };
      const cleanup = () => {
        for (const cleanupCallback of constraintCleanupSet) {
          cleanupCallback();
        }
        constraintCleanupSet.clear();
      };

      const checkResult = constraint.check(element, {
        fromRequestAction,
        skipReadonly,
        registerChange,
      });
      if (!checkResult) {
        cleanup();
        continue;
      }
      const constraintValidityInfo =
        typeof checkResult === "string"
          ? { message: checkResult }
          : checkResult;

      failedConstraintInfo = {
        name: constraint.name,
        constraint,
        ...constraintValidityInfo,
        cleanup,
        reportStatus: "not_reported",
      };
      validityInfoMap.set(constraint, failedConstraintInfo);
    }

    if (!failedConstraintInfo) {
      closeElementValidationMessage("becomes_valid");
    }

    return !failedConstraintInfo;
  };
  const reportValidity = ({ skipFocus } = {}) => {
    if (!failedConstraintInfo) {
      closeElementValidationMessage("becomes_valid");
      return;
    }
    if (failedConstraintInfo.silent) {
      closeElementValidationMessage("invalid_silent");
      return;
    }
    if (validationInterface.validationMessage) {
      const { message, level, closeOnClickOutside } = failedConstraintInfo;
      validationInterface.validationMessage.update(message, {
        level,
        closeOnClickOutside,
      });
      return;
    }
    if (!skipFocus) {
      element.focus();
    }
    const closeOnCleanup = () => {
      closeElementValidationMessage("cleanup");
    };

    failedConstraintInfo.target || elementReceivingValidationMessage;

    validationInterface.validationMessage = openCallout(
      failedConstraintInfo.message,
      {
        level: failedConstraintInfo.level,
        closeOnClickOutside: failedConstraintInfo.closeOnClickOutside,
        onClose: () => {
          cleanupCallbackSet.delete(closeOnCleanup);
          validationInterface.validationMessage = null;
          if (failedConstraintInfo) {
            failedConstraintInfo.reportStatus = "closed";
          }
          if (!skipFocus) {
            element.focus();
          }
        },
      },
    );
    failedConstraintInfo.reportStatus = "reported";
    cleanupCallbackSet.add(closeOnCleanup);
  };
  validationInterface.checkValidity = checkValidity;
  validationInterface.reportValidity = reportValidity;

  const customMessageMap = new Map();
  {
    constraintSet.add({
      name: "custom_message",
      check: () => {
        for (const [, { message, level }] of customMessageMap) {
          return { message, level };
        }
        return null;
      },
    });
    const addCustomMessage = (
      key,
      message,
      { level = "error", removeOnRequestAction = false } = {},
    ) => {
      customMessageMap.set(key, { message, level, removeOnRequestAction });
      checkValidity();
      reportValidity();
      return () => {
        removeCustomMessage(key);
      };
    };
    const removeCustomMessage = (key) => {
      if (customMessageMap.has(key)) {
        customMessageMap.delete(key);
        checkValidity();
        reportValidity();
      }
    };
    cleanupCallbackSet.add(() => {
      customMessageMap.clear();
    });
    Object.assign(validationInterface, {
      addCustomMessage,
      removeCustomMessage,
    });
  }

  {
    const oninput = () => {
      customMessageMap.clear();
      closeElementValidationMessage("input_event");
      checkValidity();
    };
    element.addEventListener("input", oninput);
    cleanupCallbackSet.add(() => {
      element.removeEventListener("input", oninput);
    });
  }

  {
    // this ensure we re-check validity (and remove message no longer relevant)
    // once the action ends (used to remove the NOT_BUSY_CONSTRAINT message)
    const onactionend = () => {
      checkValidity();
    };
    element.addEventListener("actionend", onactionend);
    if (element.form) {
      element.form.addEventListener("actionend", onactionend);
      cleanupCallbackSet.add(() => {
        element.form.removeEventListener("actionend", onactionend);
      });
    }
    cleanupCallbackSet.add(() => {
      element.removeEventListener("actionend", onactionend);
    });
  }

  {
    const nativeReportValidity = element.reportValidity;
    element.reportValidity = () => {
      reportValidity();
    };
    cleanupCallbackSet.add(() => {
      element.reportValidity = nativeReportValidity;
    });
  }

  {
    const onRequestSubmit = (form, e) => {
      if (form !== element.form && form !== element) {
        return;
      }

      const requestSubmitCustomEvent = new CustomEvent("requestsubmit", {
        cancelable: true,
        detail: { cause: e },
      });
      form.dispatchEvent(requestSubmitCustomEvent);
      if (requestSubmitCustomEvent.defaultPrevented) {
        e.preventDefault();
      }
    };
    requestSubmitCallbackSet.add(onRequestSubmit);
    cleanupCallbackSet.add(() => {
      requestSubmitCallbackSet.delete(onRequestSubmit);
    });
  }

  execute_on_form_submit: {
    const form = element.form || element.tagName === "FORM" ? element : null;
    if (!form) {
      break execute_on_form_submit;
    }
    const removeListener = addEventListener(form, "submit", (e) => {
      e.preventDefault();
      const actionCustomEvent = new CustomEvent("action", {
        detail: {
          action: null,
          event: e,
          method: "rerun",
          requester: form,
          meta: {},
        },
      });
      form.dispatchEvent(actionCustomEvent);
    });
    cleanupCallbackSet.add(() => {
      removeListener();
    });
  }

  {
    const onkeydown = (e) => {
      if (e.key === "Escape") {
        if (!closeElementValidationMessage("escape_key")) {
          dispatchCancelCustomEvent({ detail: { reason: "escape_key" } });
        }
      }
    };
    element.addEventListener("keydown", onkeydown);
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", onkeydown);
    });
  }

  {
    const onblur = () => {
      if (element.value === "") {
        dispatchCancelCustomEvent({ detail: { reason: "blur_empty" } });
        return;
      }
      // if we have failed constraint, we cancel too
      if (failedConstraintInfo) {
        dispatchCancelCustomEvent({
          detail: {
            reason: "blur_invalid",
            failedConstraintInfo,
          },
        });
        return;
      }
    };
    element.addEventListener("blur", onblur);
    cleanupCallbackSet.add(() => {
      element.removeEventListener("blur", onblur);
    });
  }

  return validationInterface;
};

// https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation

const requestSubmitCallbackSet = new Set();
const requestSubmit = HTMLFormElement.prototype.requestSubmit;
HTMLFormElement.prototype.requestSubmit = function (submitter) {
  let prevented = false;
  const preventDefault = () => {
    prevented = true;
  };
  for (const requestSubmitCallback of requestSubmitCallbackSet) {
    requestSubmitCallback(this, { submitter, preventDefault });
  }
  if (prevented) {
    return;
  }
  requestSubmit.call(this, submitter);
};

// const submit = HTMLFormElement.prototype.submit;
// HTMLFormElement.prototype.submit = function (...args) {
//   const form = this;
//   if (form.hasAttribute("data-method")) {
//     console.warn("You must use form.requestSubmit() instead of form.submit()");
//     return form.requestSubmit();
//   }
//   return submit.apply(this, args);
// };

const addEventListener = (element, event, callback) => {
  element.addEventListener(event, callback);
  return () => {
    element.removeEventListener(event, callback);
  };
};

const addIntoArray = (array, ...valuesToAdd) => {
  if (valuesToAdd.length === 1) {
    const [valueToAdd] = valuesToAdd;
    const arrayWithThisValue = [];
    for (const value of array) {
      if (value === valueToAdd) {
        return array;
      }
      arrayWithThisValue.push(value);
    }
    arrayWithThisValue.push(valueToAdd);
    return arrayWithThisValue;
  }

  const existingValueSet = new Set();
  const arrayWithTheseValues = [];
  for (const existingValue of array) {
    arrayWithTheseValues.push(existingValue);
    existingValueSet.add(existingValue);
  }
  let hasNewValues = false;
  for (const valueToAdd of valuesToAdd) {
    if (existingValueSet.has(valueToAdd)) {
      continue;
    }
    arrayWithTheseValues.push(valueToAdd);
    hasNewValues = true;
  }
  return hasNewValues ? arrayWithTheseValues : array;
};

const removeFromArray = (array, ...valuesToRemove) => {
  if (valuesToRemove.length === 1) {
    const [valueToRemove] = valuesToRemove;
    const arrayWithoutThisValue = [];
    let found = false;
    for (const value of array) {
      if (value === valueToRemove) {
        found = true;
        continue;
      }
      arrayWithoutThisValue.push(value);
    }
    if (!found) {
      return array;
    }
    return arrayWithoutThisValue;
  }

  const valuesToRemoveSet = new Set(valuesToRemove);
  const arrayWithoutTheseValues = [];
  let hasRemovedValues = false;
  for (const value of array) {
    if (valuesToRemoveSet.has(value)) {
      hasRemovedValues = true;
      continue;
    }
    arrayWithoutTheseValues.push(value);
  }
  return hasRemovedValues ? arrayWithoutTheseValues : array;
};

// used by form elements such as <input>, <select>, <textarea> to have their own action bound to a single parameter
// when inside a <form> the form params are updated when the form element single param is updated
const useActionBoundToOneParam = (action, externalValue) => {
  const actionFirstArgSignal = useSignal(externalValue);
  const boundAction = useBoundAction(action, actionFirstArgSignal);
  const getValue = useCallback(() => actionFirstArgSignal.value, []);
  const setValue = useCallback((value) => {
    actionFirstArgSignal.value = value;
  }, []);
  const externalValueRef = useRef(externalValue);
  if (externalValue !== externalValueRef.current) {
    externalValueRef.current = externalValue;
    setValue(externalValue);
  }

  const value = getValue();
  return [boundAction, value, setValue];
};
const useActionBoundToOneArrayParam = (
  action,
  name,
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  const [boundAction, value, setValue] = useActionBoundToOneParam(
    action,
    name);

  const add = (valueToAdd, valueArray = value) => {
    setValue(addIntoArray(valueArray, valueToAdd));
  };

  const remove = (valueToRemove, valueArray = value) => {
    setValue(removeFromArray(valueArray, valueToRemove));
  };

  const result = [boundAction, value, setValue];
  result.add = add;
  result.remove = remove;
  return result;
};
// used by <details> to just call their action
const useAction = (action, paramsSignal) => {
  return useBoundAction(action, paramsSignal);
};

const useBoundAction = (action, actionParamsSignal) => {
  const actionRef = useRef();
  const actionCallbackRef = useRef();

  if (!action) {
    return null;
  }
  if (isFunctionButNotAnActionFunction(action)) {
    actionCallbackRef.current = action;
    const existingAction = actionRef.current;
    if (existingAction) {
      return existingAction;
    }
    const actionFromFunction = createAction(
      (...args) => {
        return actionCallbackRef.current?.(...args);
      },
      {
        name: action.name,
        // We don't want to give empty params by default
        // we want to give undefined for regular functions
        params: undefined,
      },
    );
    if (!actionParamsSignal) {
      actionRef.current = actionFromFunction;
      return actionFromFunction;
    }
    const actionBoundToParams =
      actionFromFunction.bindParams(actionParamsSignal);
    actionRef.current = actionBoundToParams;
    return actionBoundToParams;
  }
  if (actionParamsSignal) {
    return action.bindParams(actionParamsSignal);
  }
  return action;
};

const isFunctionButNotAnActionFunction = (action) => {
  return typeof action === "function" && !action.isAction;
};

const addCustomMessage = (element, key, message, options) => {
  const customConstraintValidation =
    element.__validationInterface__ ||
    (element.__validationInterface__ =
      installCustomConstraintValidation(element));

  return customConstraintValidation.addCustomMessage(key, message, options);
};

const removeCustomMessage = (element, key) => {
  const customConstraintValidation = element.__validationInterface__;
  if (!customConstraintValidation) {
    return;
  }
  customConstraintValidation.removeCustomMessage(key);
};

const ErrorBoundaryContext = createContext(null);

const useResetErrorBoundary = () => {
  const resetErrorBoundary = useContext(ErrorBoundaryContext);
  return resetErrorBoundary;
};

const useExecuteAction = (
  elementRef,
  {
    errorEffect = "show_validation_message", // "show_validation_message" or "throw"
  } = {},
) => {
  // see https://medium.com/trabe/catching-asynchronous-errors-in-react-using-error-boundaries-5e8a5fd7b971
  // and https://codepen.io/dmail/pen/XJJqeGp?editors=0010
  // To change if https://github.com/preactjs/preact/issues/4754 lands
  const [error, setError] = useState(null);
  const resetErrorBoundary = useResetErrorBoundary();
  useLayoutEffect(() => {
    if (error) {
      error.__handled__ = true; // prevent jsenv from displaying it
      throw error;
    }
  }, [error]);

  const validationMessageTargetRef = useRef(null);
  const addErrorMessage = (error) => {
    const validationMessageTarget = validationMessageTargetRef.current;
    addCustomMessage(validationMessageTarget, "action_error", error, {
      // This error should not prevent <form> submission
      // so whenever user tries to submit the form the error is cleared
      // (Hitting enter key, clicking on submit button, etc. would allow to re-submit the form in error state)
      removeOnRequestAction: true,
    });
  };
  const removeErrorMessage = () => {
    const validationMessageTarget = validationMessageTargetRef.current;
    if (validationMessageTarget) {
      removeCustomMessage(validationMessageTarget, "action_error");
    }
  };

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const form = element.tagName === "FORM" ? element : element.form;
    if (!form) {
      return null;
    }
    const onReset = () => {
      removeErrorMessage();
    };
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("reset", onReset);
    };
  });

  // const errorEffectRef = useRef();
  // errorEffectRef.current = errorEffect;
  const executeAction = useCallback(
    (actionEvent) => {
      const { action, actionOrigin, requester, event, method } =
        actionEvent.detail;
      const sharedActionEventDetail = {
        action,
        actionOrigin,
        requester,
        event,
        method,
      };

      const dispatchCustomEvent = (type, options) => {
        const element = elementRef.current;
        const customEvent = new CustomEvent(type, options);
        element.dispatchEvent(customEvent);
      };
      if (resetErrorBoundary) {
        resetErrorBoundary();
      }
      removeErrorMessage();
      setError(null);

      const validationMessageTarget = requester || elementRef.current;
      validationMessageTargetRef.current = validationMessageTarget;

      dispatchCustomEvent("actionstart", {
        detail: sharedActionEventDetail,
      });

      return action[method]({
        reason: `"${event.type}" event on ${(() => {
          const target = event.target;
          const tagName = target.tagName.toLowerCase();

          if (target.id) {
            return `${tagName}#${target.id}`;
          }

          const uiName = target.getAttribute("data-ui-name");
          if (uiName) {
            return `${tagName}[data-ui-name="${uiName}"]`;
          }

          return `<${tagName}>`;
        })()}`,
        onAbort: (reason) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionabort", {
              detail: {
                ...sharedActionEventDetail,
                reason,
              },
            });
          }
        },
        onError: (error) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionerror", {
              detail: {
                ...sharedActionEventDetail,
                error,
              },
            });
          }
          if (errorEffect === "show_validation_message") {
            addErrorMessage(error);
          } else if (errorEffect === "throw") {
            setError(error);
          }
        },
        onComplete: (data) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionend", {
              detail: {
                ...sharedActionEventDetail,
                data,
              },
            });
          }
        },
      });
    },
    [errorEffect],
  );

  return executeAction;
};

const addManyEventListeners = (element, events) => {
  const cleanupCallbackSet = new Set();
  for (const event of Object.keys(events)) {
    const callback = events[event];
    element.addEventListener(event, callback);
    cleanupCallbackSet.add(() => {
      element.removeEventListener(event, callback);
    });
  }
  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
  };
};

/**
 * Custom hook creating a stable callback that doesn't trigger re-renders.
 *
 * PROBLEM: Parent components often forget to use useCallback, causing library
 * components to re-render unnecessarily when receiving callback props.
 *
 * SOLUTION: Library components can use this hook to create stable callback
 * references internally, making them defensive against parents who don't
 * optimize their callbacks. This ensures library components don't force
 * consumers to think about useCallback.
 *
 * USAGE:
 * ```js
 * // Parent component (consumer) - no useCallback needed
 * const Parent = () => {
 *   const [count, setCount] = useState(0);
 *
 *   // Parent naturally creates new function reference each render
 *   // (forgetting useCallback is common and shouldn't break performance)
 *   return <LibraryButton onClick={(e) => setCount(count + 1)} />;
 * };
 *
 * // Library component - defensive against changing callbacks
 * const LibraryButton = ({ onClick }) => {
 *   // ✅ Create stable reference from parent's potentially changing callback
 *   const stableClick = useStableCallback(onClick);
 *
 *   // Internal expensive components won't re-render when parent updates
 *   return <ExpensiveInternalButton onClick={stableClick} />;
 * };
 *
 * // Deep internal component gets stable reference
 * const ExpensiveInternalButton = memo(({ onClick }) => {
 *   // This won't re-render when Parent's count changes
 *   // But onClick will always call the latest Parent callback
 *   return <button onClick={onClick}>Click me</button>;
 * });
 * ```
 *
 * Perfect for library components that need performance without burdening consumers.
 */


const useStableCallback = (callback, mapper) => {
  const callbackRef = useRef();
  callbackRef.current = callback;
  const stableCallbackRef = useRef();

  // Return original falsy value directly when callback is not a function
  if (!callback) {
    return callback;
  }

  const existingStableCallback = stableCallbackRef.current;
  if (existingStableCallback) {
    return existingStableCallback;
  }
  const stableCallback = (...args) => {
    const currentCallback = callbackRef.current;
    return currentCallback(...args);
  };
  stableCallbackRef.current = stableCallback;
  return stableCallback;
};

const useActionEvents = (
  elementRef,
  {
    actionOrigin = "action_prop",
    /**
     * @param {Event} e - L'événement original
     * @param {"form_reset" | "blur_invalid" | "escape_key"} reason - Raison du cancel
     */
    onCancel,
    onRequested,
    onPrevented,
    onAction,
    onStart,
    onAbort,
    onError,
    onEnd,
  },
) => {
  onCancel = useStableCallback(onCancel);
  onRequested = useStableCallback(onRequested);
  onPrevented = useStableCallback(onPrevented);
  onAction = useStableCallback(onAction);
  onStart = useStableCallback(onStart);
  onAbort = useStableCallback(onAbort);
  onError = useStableCallback(onError);
  onEnd = useStableCallback(onEnd);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    return addManyEventListeners(element, {
      cancel: (e) => {
        // cancel don't need to check for actionOrigin because
        // it's actually unrelated to a specific actions
        // in that sense it should likely be moved elsewhere as it's related to
        // interaction and constraint validation, not to a specific action
        onCancel?.(e, e.detail.reason);
      },
      actionrequested: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onRequested?.(e);
      },
      actionprevented: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onPrevented?.(e);
      },
      action: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onAction?.(e);
      },
      actionstart: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onStart?.(e);
      },
      actionabort: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onAbort?.(e);
      },
      actionerror: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onError?.(e.detail.error, e);
      },
      actionend: onEnd,
    });
  }, [
    actionOrigin,
    onCancel,
    onRequested,
    onPrevented,
    onAction,
    onStart,
    onAbort,
    onError,
    onEnd,
  ]);
};

const useRequestedActionStatus = (elementRef) => {
  const [actionRequester, setActionRequester] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionAborted, setActionAborted] = useState(false);
  const [actionError, setActionError] = useState(null);

  useActionEvents(elementRef, {
    onAction: (actionEvent) => {
      setActionRequester(actionEvent.detail.requester);
    },
    onStart: () => {
      setActionPending(true);
      setActionAborted(false);
      setActionError(null);
    },
    onAbort: () => {
      setActionPending(false);
      setActionAborted(true);
    },
    onError: (error) => {
      setActionPending(false);
      setActionError(error);
    },
    onEnd: () => {
      setActionPending(false);
    },
  });

  return {
    actionRequester,
    actionPending,
    actionAborted,
    actionError,
  };
};

const detectMac = () => {
  // Modern way using User-Agent Client Hints API
  if (window.navigator.userAgentData) {
    return window.navigator.userAgentData.platform === "macOS";
  }
  // Fallback to userAgent string parsing
  return /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);
};
const isMac = detectMac();

// Maps canonical browser key names to their user-friendly aliases.
// Used for both event matching and ARIA normalization.
const keyMapping = {
  " ": { alias: ["space"] },
  "escape": { alias: ["esc"] },
  "arrowup": { alias: ["up"] },
  "arrowdown": { alias: ["down"] },
  "arrowleft": { alias: ["left"] },
  "arrowright": { alias: ["right"] },
  "delete": { alias: ["del"] },
  // Platform-specific mappings
  ...(isMac
    ? { delete: { alias: ["backspace"] } }
    : { backspace: { alias: ["delete"] } }),
};

const activeShortcutsSignal = signal([]);
const shortcutsMap = new Map();

const areShortcutsEqual = (shortcutA, shortcutB) => {
  return (
    shortcutA.key === shortcutB.key &&
    shortcutA.description === shortcutB.description &&
    shortcutA.enabled === shortcutB.enabled
  );
};

const areShortcutArraysEqual = (arrayA, arrayB) => {
  if (arrayA.length !== arrayB.length) {
    return false;
  }

  for (let i = 0; i < arrayA.length; i++) {
    if (!areShortcutsEqual(arrayA[i], arrayB[i])) {
      return false;
    }
  }

  return true;
};

const updateActiveShortcuts = () => {
  const activeElement = activeElementSignal.peek();
  const currentActiveShortcuts = activeShortcutsSignal.peek();
  const activeShortcuts = [];
  for (const [element, { shortcuts }] of shortcutsMap) {
    if (element === activeElement || element.contains(activeElement)) {
      activeShortcuts.push(...shortcuts);
    }
  }

  // Only update if shortcuts have actually changed
  if (!areShortcutArraysEqual(currentActiveShortcuts, activeShortcuts)) {
    activeShortcutsSignal.value = activeShortcuts;
  }
};
effect(() => {
  // eslint-disable-next-line no-unused-expressions
  activeElementSignal.value;
  updateActiveShortcuts();
});
const addShortcuts = (element, shortcuts) => {
  shortcutsMap.set(element, { shortcuts });
  updateActiveShortcuts();
};
const removeShortcuts = (element) => {
  shortcutsMap.delete(element);
  updateActiveShortcuts();
};

const useKeyboardShortcuts = (
  elementRef,
  shortcuts,
  {
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    allowConcurrentActions,
  } = {},
) => {
  if (!elementRef) {
    throw new Error(
      "useKeyboardShortcuts requires an elementRef to attach shortcuts to.",
    );
  }

  const executeAction = useExecuteAction(elementRef);
  const shortcutActionIsBusyRef = useRef(false);
  useActionEvents(elementRef, {
    actionOrigin: "keyboard_shortcut",
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      const { shortcut } = actionEvent.detail.meta || {};
      if (!shortcut) {
        // not a shortcut (an other interaction triggered the action, don't request it again)
        return;
      }
      // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
      // otherwise setState would call that action immediately
      // setAction(() => actionEvent.detail.action);
      executeAction(actionEvent, {
        requester: document.activeElement,
      });
    },
    onStart: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      if (!allowConcurrentActions) {
        shortcutActionIsBusyRef.current = true;
      }
      shortcut.onStart?.(e);
      onActionStart?.(e);
    },
    onAbort: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onAbort?.(e);
      onActionAbort?.(e);
    },
    onError: (error, e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onError?.(error, e);
      onActionError?.(error, e);
    },
    onEnd: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onEnd?.(e);
      onActionEnd?.(e);
    },
  });

  const shortcutDeps = [];
  for (const shortcut of shortcuts) {
    shortcutDeps.push(
      shortcut.key,
      shortcut.description,
      shortcut.enabled,
      shortcut.confirmMessage,
    );
    shortcut.action = useAction(shortcut.action);
  }

  useEffect(() => {
    const element = elementRef.current;
    const shortcutsCopy = [];
    for (const shortcutCandidate of shortcuts) {
      shortcutsCopy.push({
        ...shortcutCandidate,
        handler: (keyboardEvent) => {
          if (shortcutCandidate.handler) {
            return shortcutCandidate.handler(keyboardEvent);
          }
          if (shortcutActionIsBusyRef.current) {
            return false;
          }
          const { action } = shortcutCandidate;
          return requestAction(element, action, {
            event: keyboardEvent,
            requester: document.activeElement,
            confirmMessage: shortcutCandidate.confirmMessage,
            actionOrigin: "keyboard_shortcut",
            meta: {
              shortcut: shortcutCandidate,
            },
          });
        },
      });
    }

    addShortcuts(element, shortcuts);

    const onKeydown = (event) => {
      applyKeyboardShortcuts(shortcutsCopy, event);
    };
    element.addEventListener("keydown", onKeydown);
    return () => {
      element.removeEventListener("keydown", onKeydown);
      removeShortcuts(element);
    };
  }, [shortcutDeps]);
};

const applyKeyboardShortcuts = (shortcuts, keyboardEvent) => {
  if (!canInterceptKeys(keyboardEvent)) {
    return null;
  }
  for (const shortcutCandidate of shortcuts) {
    let { enabled = true, key } = shortcutCandidate;
    if (!enabled) {
      continue;
    }

    if (typeof key === "function") {
      const keyReturnValue = key(keyboardEvent);
      if (!keyReturnValue) {
        continue;
      }
      key = keyReturnValue;
    }
    if (!key) {
      console.error(shortcutCandidate);
      throw new TypeError(`key is required in keyboard shortcut, got ${key}`);
    }

    // Handle platform-specific combination objects
    let actualCombination;
    let crossPlatformCombination;
    if (typeof key === "object" && key !== null) {
      actualCombination = isMac ? key.mac : key.other;
    } else {
      actualCombination = key;
      if (containsPlatformSpecificKeys(key)) {
        crossPlatformCombination = generateCrossPlatformCombination(key);
      }
    }

    // Check both the actual combination and cross-platform combination
    const matchesActual =
      actualCombination &&
      keyboardEventIsMatchingKeyCombination(keyboardEvent, actualCombination);
    const matchesCrossPlatform =
      crossPlatformCombination &&
      crossPlatformCombination !== actualCombination &&
      keyboardEventIsMatchingKeyCombination(
        keyboardEvent,
        crossPlatformCombination,
      );

    if (!matchesActual && !matchesCrossPlatform) {
      continue;
    }
    if (typeof enabled === "function" && !enabled(keyboardEvent)) {
      continue;
    }
    const returnValue = shortcutCandidate.handler(keyboardEvent);
    if (returnValue) {
      keyboardEvent.preventDefault();
    }
    return shortcutCandidate;
  }
  return null;
};
const containsPlatformSpecificKeys = (combination) => {
  const lowerCombination = combination.toLowerCase();
  const macSpecificKeys = ["command", "cmd"];

  return macSpecificKeys.some((key) => lowerCombination.includes(key));
};
const generateCrossPlatformCombination = (combination) => {
  let crossPlatform = combination;

  if (isMac) {
    // No need to convert anything TO Windows/Linux-specific format since we're on Mac
    return null;
  }
  // If not on Mac but combination contains Mac-specific keys, generate Windows equivalent
  crossPlatform = crossPlatform.replace(/\bcommand\b/gi, "control");
  crossPlatform = crossPlatform.replace(/\bcmd\b/gi, "control");

  return crossPlatform;
};
const keyboardEventIsMatchingKeyCombination = (event, keyCombination) => {
  const keys = keyCombination.toLowerCase().split("+");

  for (const key of keys) {
    let modifierFound = false;

    // Check if this key is a modifier
    for (const [eventProperty, config] of Object.entries(modifierKeyMapping)) {
      const allNames = [...config.names];

      // Add Mac-specific names only if we're on Mac and they exist
      if (isMac && config.macNames) {
        allNames.push(...config.macNames);
      }

      if (allNames.includes(key)) {
        // Check if the corresponding event property is pressed
        if (!event[eventProperty]) {
          return false;
        }
        modifierFound = true;
        break;
      }
    }
    if (modifierFound) {
      continue;
    }

    // Check if it's a range pattern like "a-z" or "0-9"
    if (key.includes("-") && key.length === 3) {
      const [startChar, dash, endChar] = key;
      if (dash === "-") {
        // Only check ranges for single alphanumeric characters
        const eventKey = event.key.toLowerCase();
        if (eventKey.length !== 1) {
          return false; // Not a single character key
        }

        // Only allow a-z and 0-9 ranges
        const isValidRange =
          (startChar >= "a" && endChar <= "z") ||
          (startChar >= "0" && endChar <= "9");

        if (!isValidRange) {
          return false; // Invalid range pattern
        }

        const eventKeyCode = eventKey.charCodeAt(0);
        const startCode = startChar.charCodeAt(0);
        const endCode = endChar.charCodeAt(0);

        if (eventKeyCode >= startCode && eventKeyCode <= endCode) {
          continue; // Range matched
        }
        return false; // Range not matched
      }
    }

    // If it's not a modifier or range, check if it matches the actual key
    if (!isSameKey(event.key, key)) {
      return false;
    }
  }
  return true;
};
// Configuration for mapping shortcut key names to browser event properties
const modifierKeyMapping = {
  metaKey: {
    names: ["meta"],
    macNames: ["command", "cmd"],
  },
  ctrlKey: {
    names: ["control", "ctrl"],
  },
  shiftKey: {
    names: ["shift"],
  },
  altKey: {
    names: ["alt"],
    macNames: ["option"],
  },
};
const isSameKey = (browserEventKey, key) => {
  browserEventKey = browserEventKey.toLowerCase();
  key = key.toLowerCase();

  if (browserEventKey === key) {
    return true;
  }

  // Check if either key is an alias for the other
  for (const [canonicalKey, config] of Object.entries(keyMapping)) {
    const allKeys = [canonicalKey, ...config.alias];
    if (allKeys.includes(browserEventKey) && allKeys.includes(key)) {
      return true;
    }
  }

  return false;
};

const useActionData = (action) => {
  if (!action) {
    return undefined;
  }
  const { computedDataSignal } = getActionPrivateProperties(action);
  const data = computedDataSignal.value;
  return data;
};

const useActionStatus = (action) => {
  if (!action) {
    return {
      params: undefined,
      runningState: IDLE,
      isPrerun: false,
      idle: true,
      loading: false,
      aborted: false,
      error: null,
      completed: false,
      data: undefined,
    };
  }
  const {
    paramsSignal,
    runningStateSignal,
    isPrerunSignal,
    errorSignal,
    computedDataSignal,
  } = getActionPrivateProperties(action);

  const params = paramsSignal.value;
  const isPrerun = isPrerunSignal.value;
  const runningState = runningStateSignal.value;
  const idle = runningState === IDLE;
  const aborted = runningState === ABORTED;
  const error = errorSignal.value;
  const loading = runningState === RUNNING;
  const completed = runningState === COMPLETED;
  const data = computedDataSignal.value;

  return {
    params,
    runningState,
    isPrerun,
    idle,
    loading,
    aborted,
    error,
    completed,
    data,
  };
};

/**
 * Picks the best initial value from three options using a simple priority system.
 *
 * @param {any} externalValue - Value from props or parent component
 * @param {any} fallbackValue - Backup value if external value isn't useful
 * @param {any} defaultValue - Final fallback (usually empty/neutral value)
 *
 * @returns {any} The chosen value using this priority:
 *   1. externalValue (if provided and different from default)
 *   2. fallbackValue (if external value is missing/same as default)
 *   3. defaultValue (if nothing else works)
 *
 * @example
 * resolveInitialValue("hello", "backup", "") → "hello"
 * resolveInitialValue(undefined, "backup", "") → "backup"
 * resolveInitialValue("", "backup", "") → "backup" (empty same as default)
 */
const resolveInitialValue = (
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  if (externalValue !== undefined && externalValue !== defaultValue) {
    return externalValue;
  }
  if (fallbackValue !== undefined) {
    return fallbackValue;
  }
  return defaultValue;
};

/**
 * Hook that syncs external value changes to a setState function.
 * Always syncs when external value changes, regardless of what it changes to.
 *
 * @param {any} externalValue - Value from props or parent component to watch for changes
 * @param {any} defaultValue - Default value to use when external value is undefined
 * @param {Function} setValue - Function to call when external value changes
 * @param {string} name - Parameter name for debugging
 */
const useExternalValueSync = (
  externalValue,
  defaultValue,
  setValue,
  name = "",
) => {
  // Track external value changes and sync them
  const previousExternalValueRef = useRef(externalValue);
  if (externalValue !== previousExternalValueRef.current) {
    previousExternalValueRef.current = externalValue;
    // Always sync external value changes - use defaultValue only when external is undefined
    const valueToSet =
      externalValue === undefined ? defaultValue : externalValue;
    setValue(valueToSet);
  }
};

const UNSET = {};
const useInitialValue = (compute) => {
  const initialValueRef = useRef(UNSET);
  let initialValue = initialValueRef.current;
  if (initialValue !== UNSET) {
    return initialValue;
  }

  initialValue = compute();
  initialValueRef.current = initialValue;
  return initialValue;
};

const FIRST_MOUNT = {};
const useStateArray = (
  externalValue,
  fallbackValue,
  defaultValue = [],
) => {
  const initialValueRef = useRef(FIRST_MOUNT);
  if (initialValueRef.current === FIRST_MOUNT) {
    const initialValue = resolveInitialValue(
      externalValue,
      fallbackValue,
      defaultValue,
    );
    initialValueRef.current = initialValue;
  }
  const initialValue = initialValueRef.current;
  const [array, setArray] = useState(initialValue);

  // Only sync external value changes if externalValue was explicitly provided
  useExternalValueSync(externalValue, defaultValue, setArray, "state_array");

  const add = useCallback((valueToAdd) => {
    setArray((array) => {
      const newArray = addIntoArray(array, valueToAdd);
      return newArray;
    });
  }, []);

  const remove = useCallback((valueToRemove) => {
    setArray((array) => {
      return removeFromArray(array, valueToRemove);
    });
  }, []);

  const reset = useCallback(() => {
    setArray(initialValue);
  }, [initialValue]);

  return [array, add, remove, reset];
};

const getCallerInfo = (targetFunction = null, additionalOffset = 0) => {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_, stack) => stack;

    const error = new Error();
    const stack = error.stack;

    if (!stack || stack.length === 0 || !Array.isArray(stack)) {
      return { raw: "unknown" };
    }

    let targetIndex = -1;

    if (targetFunction) {
      // ✅ Chercher la fonction cible par référence directe
      for (let i = 0; i < stack.length; i++) {
        const frame = stack[i];
        const frameFunction = frame.getFunction();

        // ✅ Comparaison directe par référence
        if (frameFunction === targetFunction) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) {
        return {
          raw: `target function not found in stack`,
          targetFunction: targetFunction.name,
        };
      }

      // ✅ Prendre la fonction qui appelle targetFunction + offset
      const callerIndex = targetIndex + 1 + additionalOffset;

      if (callerIndex >= stack.length) {
        return {
          raw: `caller at offset ${additionalOffset} not found`,
          targetFunction: targetFunction.name,
          requestedIndex: callerIndex,
          stackLength: stack.length,
        };
      }

      const callerFrame = stack[callerIndex];
      return {
        file: callerFrame.getFileName(),
        line: callerFrame.getLineNumber(),
        column: callerFrame.getColumnNumber(),
        function: callerFrame.getFunctionName() || "<anonymous>",
        raw: callerFrame.toString(),
        targetFunction: targetFunction.name,
        offset: additionalOffset,
      };
    }

    // ✅ Comportement original si pas de targetFunction
    if (stack.length > 2) {
      const callerFrame = stack[2 + additionalOffset];

      if (!callerFrame) {
        return {
          raw: `caller at offset ${additionalOffset} not found`,
          requestedIndex: 2 + additionalOffset,
          stackLength: stack.length,
        };
      }

      return {
        file: callerFrame.getFileName(),
        line: callerFrame.getLineNumber(),
        column: callerFrame.getColumnNumber(),
        function: callerFrame.getFunctionName() || "<anonymous>",
        raw: callerFrame.toString(),
        offset: additionalOffset,
      };
    }

    return { raw: "unknown" };
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
};

const primitiveCanBeId = (value) => {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "symbol") {
    return true;
  }
  return false;
};

const arraySignalStore = (
  initialArray = [],
  idKey = "id",
  {
    mutableIdKeys = [],
    name,
    createItem = (props) => {
      return { ...props };
    },
  },
) => {
  const store = {
    name,
  };

  const createItemFromProps = (props) => {
    if (props === null || typeof props !== "object") {
      return props;
    }
    const item = createItem(props);
    return item;
  };

  const arraySignal = signal(initialArray);
  const derivedSignal = computed(() => {
    const array = arraySignal.value;
    const idSet = new Set(); // will be used to detect id changes (deletion, addition)
    const idMap = new Map(); // used to speep up finding item by id
    for (const item of array) {
      const id = item[idKey];
      idSet.add(id);
      idMap.set(id, item);
    }
    return [idSet, idMap];
  });
  const idSetSignal = computed(() => derivedSignal.value[0]);
  const idMapSignal = computed(() => derivedSignal.value[1]);
  const previousIdSetSignal = signal(new Set(idSetSignal.peek()));
  const idChangeCallbackSet = new Set();
  effect(() => {
    const idSet = idSetSignal.value;
    const previousIdSet = previousIdSetSignal.peek();
    const setCopy = new Set();
    let modified = false;
    for (const id of idSet) {
      if (!previousIdSet.has(id)) {
        modified = true;
      }
      setCopy.add(id);
    }
    if (modified) {
      previousIdSetSignal.value = setCopy;
      for (const idChangeCallback of idChangeCallbackSet) {
        idChangeCallback(idSet, previousIdSet);
      }
    }
  });

  const propertiesObserverSet = new Set();
  const observeProperties = (itemSignal, callback) => {
    const observer = { itemSignal, callback };
    propertiesObserverSet.add(observer);

    // Return cleanup function
    return () => {
      propertiesObserverSet.delete(observer);
    };
  };

  const removalsCallbackSet = new Set();
  const observeRemovals = (callback) => {
    removalsCallbackSet.add(callback);
  };

  const itemMatchLifecycleSet = new Set();
  const registerItemMatchLifecycle = (matchPredicate, { match, nomatch }) => {
    const matchState = {
      hasMatched: false,
      hadMatchedBefore: false,
    };
    const itemMatchLifecycle = {
      matchPredicate,
      match,
      nomatch,
      matchState,
    };
    itemMatchLifecycleSet.add(itemMatchLifecycle);
  };

  const readIdFromItemProps = (props, array) => {
    let id;
    if (Object.hasOwn(props, idKey)) {
      id = props[idKey];
      return id;
    }
    if (mutableIdKeys.length === 0) {
      return undefined;
    }

    let mutableIdKey;
    for (const mutableIdKeyCandidate of mutableIdKeys) {
      if (Object.hasOwn(props, mutableIdKeyCandidate)) {
        mutableIdKey = mutableIdKeyCandidate;
        break;
      }
    }
    if (!mutableIdKey) {
      throw new Error(
        `item properties must have one of the following keys:
${[idKey, ...mutableIdKeys].join(", ")}`,
      );
    }
    const mutableIdValue = props[mutableIdKey];
    for (const itemCandidate of array) {
      const mutableIdCandidate = itemCandidate[mutableIdKey];
      if (mutableIdCandidate === mutableIdValue) {
        id = itemCandidate[idKey];
        break;
      }
    }
    if (!id) {
      throw new Error(
        `None of the existing item uses ${mutableIdKey}: ${mutableIdValue}, so item properties must specify the "${idKey}" key.`,
      );
    }
    return id;
  };

  effect(() => {
    const array = arraySignal.value;

    for (const {
      matchPredicate,
      match,
      nomatch,
      matchState,
    } of itemMatchLifecycleSet) {
      let currentlyHasMatch = false;

      // Check if any item currently matches
      for (const item of array) {
        if (matchPredicate(item)) {
          currentlyHasMatch = true;
          break;
        }
      }

      // Handle state transitions
      if (currentlyHasMatch && !matchState.hasMatched) {
        // New match found
        matchState.hasMatched = true;
        const isRematch = matchState.hadMatchedBefore;
        if (match) {
          match(isRematch);
        }
      } else if (!currentlyHasMatch && matchState.hasMatched) {
        // No longer has match
        matchState.hasMatched = false;
        matchState.hadMatchedBefore = true;
        if (nomatch) {
          nomatch();
        }
      }
    }
  });

  const select = (...args) => {
    const array = arraySignal.value;
    const idMap = idMapSignal.value;

    let property;
    let value;
    if (args.length === 1) {
      property = idKey;
      value = args[0];
      if (value !== null && typeof value === "object") {
        value = readIdFromItemProps(value, array);
      }
    } else if (args.length === 2) {
      property = args[0];
      value = args[1];
    }
    if (property === idKey) {
      return idMap.get(value);
    }
    for (const itemCandidate of array) {
      const valueCandidate =
        typeof property === "function"
          ? property(itemCandidate)
          : itemCandidate[property];
      if (valueCandidate === value) {
        return itemCandidate;
      }
    }
    return null;
  };
  const selectAll = (toMatchArray) => {
    const array = arraySignal.value;
    const result = [];
    const idMap = idMapSignal.value;
    for (const toMatch of toMatchArray) {
      const id =
        toMatch !== null && typeof toMatch === "object"
          ? readIdFromItemProps(toMatch, array)
          : toMatch;
      const item = idMap.get(id);
      if (item) {
        result.push(item);
      }
    }
    return result;
  };
  const upsert = (...args) => {
    const itemMutationsMap = new Map(); // Map<itemId, propertyMutations>
    const triggerPropertyMutations = () => {
      if (itemMutationsMap.size === 0) {
        return;
      }
      // we call at the end so that itemWithProps and arraySignal.value was set too
      for (const observer of propertiesObserverSet) {
        const { itemSignal, callback } = observer;
        const watchedItem = itemSignal.peek();
        if (!watchedItem) {
          continue;
        }

        // Check if this item has mutations
        const itemSpecificMutations = itemMutationsMap.get(watchedItem[idKey]);
        if (itemSpecificMutations) {
          callback(itemSpecificMutations);
        }
      }
    };
    const assign = (item, props) => {
      const itemOwnPropertyDescriptors = Object.getOwnPropertyDescriptors(item);
      const itemOwnKeys = Object.keys(itemOwnPropertyDescriptors);
      const itemWithProps = Object.create(
        Object.getPrototypeOf(item),
        itemOwnPropertyDescriptors,
      );
      let hasChanges = false;
      const propertyMutations = {};

      for (const key of Object.keys(props)) {
        const newValue = props[key];
        if (itemOwnKeys.includes(key)) {
          const oldValue = item[key];
          if (newValue !== oldValue) {
            hasChanges = true;
            itemWithProps[key] = newValue;
            propertyMutations[key] = {
              oldValue,
              newValue,
              target: item,
              newTarget: itemWithProps,
            };
          }
        } else {
          hasChanges = true;
          itemWithProps[key] = newValue;
          propertyMutations[key] = {
            added: true,
            newValue,
            target: item,
            newTarget: itemWithProps,
          };
        }
      }

      if (!hasChanges) {
        return item;
      }

      // Store mutations for this specific item
      itemMutationsMap.set(item[idKey], propertyMutations);
      return itemWithProps;
    };

    const array = arraySignal.peek();
    if (args.length === 1 && Array.isArray(args[0])) {
      const propsArray = args[0];
      if (array.length === 0) {
        const arrayAllCreated = [];
        for (const props of propsArray) {
          const item = createItemFromProps(props);
          arrayAllCreated.push(item);
        }
        arraySignal.value = arrayAllCreated;
        return arrayAllCreated;
      }
      let hasNew = false;
      let hasUpdate = false;
      const arraySomeUpdated = [];
      const arrayWithOnlyAffectedItems = [];
      const existingEntryMap = new Map();
      let index = 0;
      while (index < array.length) {
        const existingItem = array[index];
        const id = existingItem[idKey];
        existingEntryMap.set(id, {
          existingItem,
          existingItemIndex: index,
          processed: false,
        });
        index++;
      }

      for (const props of propsArray) {
        const id = readIdFromItemProps(props, array);
        const existingEntry = existingEntryMap.get(id);
        if (existingEntry) {
          const { existingItem } = existingEntry;
          const itemWithPropsOrItem = assign(existingItem, props);
          if (itemWithPropsOrItem !== existingItem) {
            hasUpdate = true;
          }
          arraySomeUpdated.push(itemWithPropsOrItem);
          existingEntry.processed = true;
          arrayWithOnlyAffectedItems.push(itemWithPropsOrItem);
        } else {
          hasNew = true;
          const item = createItemFromProps(props);
          arraySomeUpdated.push(item);
          arrayWithOnlyAffectedItems.push(item);
        }
      }

      for (const [, existingEntry] of existingEntryMap) {
        if (!existingEntry.processed) {
          arraySomeUpdated.push(existingEntry.existingItem);
        }
      }

      if (hasNew || hasUpdate) {
        arraySignal.value = arraySomeUpdated;
        triggerPropertyMutations();
        return arrayWithOnlyAffectedItems;
      }
      return arrayWithOnlyAffectedItems;
    }
    let existingItem = null;
    let updatedItem = null;
    const arraySomeUpdated = [];
    let propertyToMatch;
    let valueToMatch;
    let props;
    if (args.length === 1) {
      const firstArg = args[0];
      propertyToMatch = idKey;
      if (!firstArg || typeof firstArg !== "object") {
        throw new TypeError(
          `Expected an object as first argument, got ${firstArg}`,
        );
      }
      valueToMatch = readIdFromItemProps(firstArg, array);
      props = firstArg;
    } else if (args.length === 2) {
      propertyToMatch = idKey;
      valueToMatch = args[0];
      if (typeof valueToMatch === "object") {
        valueToMatch = valueToMatch[idKey];
      }
      props = args[1];
    } else if (args.length === 3) {
      propertyToMatch = args[0];
      valueToMatch = args[1];
      props = args[2];
    }
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof propertyToMatch === "function"
          ? propertyToMatch(itemCandidate)
          : itemCandidate[propertyToMatch];
      if (itemCandidateValue === valueToMatch) {
        const itemWithPropsOrItem = assign(itemCandidate, props);
        if (itemWithPropsOrItem === itemCandidate) {
          existingItem = itemCandidate;
        } else {
          updatedItem = itemWithPropsOrItem;
        }
        arraySomeUpdated.push(itemWithPropsOrItem);
      } else {
        arraySomeUpdated.push(itemCandidate);
      }
    }
    if (existingItem) {
      return existingItem;
    }
    if (updatedItem) {
      arraySignal.value = arraySomeUpdated;
      triggerPropertyMutations();
      return updatedItem;
    }
    const item = createItemFromProps(props);
    arraySomeUpdated.push(item);
    arraySignal.value = arraySomeUpdated;
    triggerPropertyMutations();
    return item;
  };
  const drop = (...args) => {
    const removedItemArray = [];
    const triggerRemovedMutations = () => {
      if (removedItemArray.length === 0) {
        return;
      }
      // we call at the end so that itemWithProps and arraySignal.value was set too
      for (const removalsCallback of removalsCallbackSet) {
        removalsCallback(removedItemArray);
      }
    };

    const array = arraySignal.peek();
    if (args.length === 1 && Array.isArray(args[0])) {
      const firstArg = args[0];
      const arrayWithoutDroppedItems = [];
      let hasFound = false;
      const idToRemoveSet = new Set();
      const idRemovedArray = [];

      for (const value of firstArg) {
        if (typeof value === "object" && value !== null) {
          const id = readIdFromItemProps(value, array);
          idToRemoveSet.add(id);
        } else if (!primitiveCanBeId(value)) {
          throw new TypeError(`id to drop must be an id, got ${value}`);
        }
        idToRemoveSet.add(value);
      }
      for (const existingItem of array) {
        const existingItemId = existingItem[idKey];
        if (idToRemoveSet.has(existingItemId)) {
          hasFound = true;
          idToRemoveSet.delete(existingItemId);
          idRemovedArray.push(existingItemId);
        } else {
          arrayWithoutDroppedItems.push(existingItem);
        }
      }
      if (idToRemoveSet.size > 0) {
        console.warn(
          `arraySignalStore.drop: Some ids were not found in the array: ${Array.from(idToRemoveSet).join(", ")}`,
        );
      }
      if (hasFound) {
        arraySignal.value = arrayWithoutDroppedItems;
        triggerRemovedMutations();
        return idRemovedArray;
      }
      return [];
    }
    let propertyToMatch;
    let valueToMatch;
    if (args.length === 1) {
      propertyToMatch = idKey;
      valueToMatch = args[0];
      if (valueToMatch !== null && typeof valueToMatch === "object") {
        valueToMatch = readIdFromItemProps(valueToMatch, array);
      } else if (!primitiveCanBeId(valueToMatch)) {
        throw new TypeError(`id to drop must be an id, got ${valueToMatch}`);
      }
    } else {
      propertyToMatch = args[0];
      valueToMatch = args[1];
    }
    const arrayWithoutItemToDrop = [];
    let found = false;
    let itemDropped = null;
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof propertyToMatch === "function"
          ? propertyToMatch(itemCandidate)
          : itemCandidate[propertyToMatch];
      if (itemCandidateValue === valueToMatch) {
        itemDropped = itemCandidate;
        found = true;
      } else {
        arrayWithoutItemToDrop.push(itemCandidate);
      }
    }
    if (found) {
      arraySignal.value = arrayWithoutItemToDrop;
      removedItemArray.push(itemDropped);
      triggerRemovedMutations();
      return itemDropped[idKey];
    }
    return null;
  };

  const signalForMutableIdKey = (mutableIdKey, mutableIdValueSignal) => {
    const itemIdSignal = signal(null);
    const check = (value) => {
      const item = select(mutableIdKey, value);
      if (!item) {
        return false;
      }
      itemIdSignal.value = item[idKey];
      return true;
    };
    if (!check()) {
      effect(function () {
        const mutableIdValue = mutableIdValueSignal.value;
        if (check(mutableIdValue)) {
          this.dispose();
        }
      });
    }

    return computed(() => {
      return select(itemIdSignal.value);
    });
  };

  Object.assign(store, {
    mutableIdKeys,
    arraySignal,
    select,
    selectAll,
    upsert,
    drop,

    observeProperties,
    observeRemovals,
    registerItemMatchLifecycle,
    signalForMutableIdKey,
  });
  return store;
};

// Resource Lifecycle Manager
// This handles ALL resource lifecycle logic (rerun/reset) across all resources
const createResourceLifecycleManager = () => {
  const registeredResources = new Map(); // Map<resourceInstance, lifecycleConfig>
  const resourceDependencies = new Map(); // Map<resourceInstance, Set<dependentResources>>

  const registerResource = (resourceInstance, config) => {
    const {
      rerunOn,
      paramScope = null,
      dependencies = [],
      mutableIdKeys = [],
    } = config;

    registeredResources.set(resourceInstance, {
      rerunOn,
      paramScope,
      mutableIdKeys,
      httpActions: new Set(),
    });

    // Register dependencies
    if (dependencies.length > 0) {
      for (const dependency of dependencies) {
        if (!resourceDependencies.has(dependency)) {
          resourceDependencies.set(dependency, new Set());
        }
        resourceDependencies.get(dependency).add(resourceInstance);
      }
    }
  };

  const registerAction = (resourceInstance, httpAction) => {
    const config = registeredResources.get(resourceInstance);
    if (config) {
      config.httpActions.add(httpAction);
    }
  };

  const shouldRerunAfter = (rerunConfig, httpVerb) => {
    if (rerunConfig === false) return false;
    if (rerunConfig === "*") return true;
    if (Array.isArray(rerunConfig)) {
      const verbSet = new Set(rerunConfig.map((v) => v.toUpperCase()));
      if (verbSet.has("*")) return true;
      return verbSet.has(httpVerb.toUpperCase());
    }
    return false;
  };

  const isParamSubset = (parentParams, childParams) => {
    if (!parentParams || !childParams) return false;
    for (const [key, value] of Object.entries(parentParams)) {
      if (
        !(key in childParams) ||
        !compareTwoJsValues(childParams[key], value)
      ) {
        return false;
      }
    }
    return true;
  };

  const findEffectOnActions = (triggeringAction) => {
    // Determines which actions to rerun/reset when an action completes.

    const actionsToRerun = new Set();
    const actionsToReset = new Set();
    const reasonSet = new Set();

    for (const [resourceInstance, config] of registeredResources) {
      const shouldRerunGetMany = shouldRerunAfter(
        config.rerunOn.GET_MANY,
        triggeringAction.meta.httpVerb,
      );
      const shouldRerunGet = shouldRerunAfter(
        config.rerunOn.GET,
        triggeringAction.meta.httpVerb,
      );

      // Skip if no rerun or reset rules apply
      const hasMutableIdAutorerun =
        (triggeringAction.meta.httpVerb === "POST" ||
          triggeringAction.meta.httpVerb === "PUT" ||
          triggeringAction.meta.httpVerb === "PATCH") &&
        config.mutableIdKeys.length > 0;

      if (
        !shouldRerunGetMany &&
        !shouldRerunGet &&
        triggeringAction.meta.httpVerb !== "DELETE" &&
        !hasMutableIdAutorerun
      ) {
        continue;
      }

      // Parameter scope predicate for config-driven rules
      // Same scope ID or no scope = compatible, subset check for different scopes
      const paramScopePredicate = config.paramScope
        ? (candidateAction) => {
            if (candidateAction.meta.paramScope?.id === config.paramScope.id)
              return true;
            if (!candidateAction.meta.paramScope) return true;
            const candidateParams = candidateAction.meta.paramScope.params;
            const currentParams = config.paramScope.params;
            return isParamSubset(candidateParams, currentParams);
          }
        : (candidateAction) => !candidateAction.meta.paramScope;

      for (const httpAction of config.httpActions) {
        // Find all instances of this action
        const actionCandidateArray = httpAction.matchAllSelfOrDescendant(
          (action) =>
            !action.isPrerun && action.completed && action !== triggeringAction,
        );

        for (const actionCandidate of actionCandidateArray) {
          const triggerVerb = triggeringAction.meta.httpVerb;
          const candidateVerb = actionCandidate.meta.httpVerb;
          const candidateIsPlural = actionCandidate.meta.httpMany;
          if (triggerVerb === candidateVerb) {
            continue;
          }

          const triggeringResource = getResourceForAction(triggeringAction);
          const isSameResource = triggeringResource === resourceInstance;

          // Config-driven same-resource effects (respects param scope)
          config_effect: {
            if (
              !isSameResource ||
              triggerVerb === "GET" ||
              candidateVerb !== "GET"
            ) {
              break config_effect;
            }
            const shouldRerun = candidateIsPlural
              ? shouldRerunGetMany
              : shouldRerunGet;
            if (!shouldRerun) {
              break config_effect;
            }
            if (!paramScopePredicate(actionCandidate)) {
              break config_effect;
            }
            actionsToRerun.add(actionCandidate);
            reasonSet.add("same-resource autorerun");
            continue;
          }

          // DELETE effects on same resource (ignores param scope)
          delete_effect: {
            if (!isSameResource || triggerVerb !== "DELETE") {
              break delete_effect;
            }
            if (candidateIsPlural) {
              if (!shouldRerunGetMany) {
                break delete_effect;
              }
              actionsToRerun.add(actionCandidate);
              reasonSet.add("same-resource DELETE rerun GET_MANY");
              continue;
            }
            // Get the ID(s) that were deleted
            const { dataSignal } = getActionPrivateProperties(triggeringAction);
            const deleteIdSet = triggeringAction.meta.httpMany
              ? new Set(dataSignal.peek())
              : new Set([dataSignal.peek()]);

            const candidateId = actionCandidate.data;
            const isAffected = deleteIdSet.has(candidateId);
            if (!isAffected) {
              break delete_effect;
            }
            if (candidateVerb === "GET" && shouldRerunGet) {
              actionsToRerun.add(actionCandidate);
              reasonSet.add("same-resource DELETE rerun GET");
              continue;
            }
            actionsToReset.add(actionCandidate);
            reasonSet.add("same-resource DELETE reset");
            continue;
          }

          // MutableId effects: rerun GET when matching resource created/updated
          {
            if (
              hasMutableIdAutorerun &&
              candidateVerb === "GET" &&
              !candidateIsPlural &&
              isSameResource
            ) {
              const { computedDataSignal } =
                getActionPrivateProperties(triggeringAction);
              const modifiedData = computedDataSignal.peek();

              if (modifiedData && typeof modifiedData === "object") {
                for (const mutableIdKey of config.mutableIdKeys) {
                  const modifiedMutableId = modifiedData[mutableIdKey];
                  const candidateParams = actionCandidate.params;

                  if (
                    modifiedMutableId !== undefined &&
                    candidateParams &&
                    typeof candidateParams === "object" &&
                    candidateParams[mutableIdKey] === modifiedMutableId
                  ) {
                    actionsToRerun.add(actionCandidate);
                    reasonSet.add(
                      `${triggeringAction.meta.httpVerb}-mutableId autorerun`,
                    );
                    break;
                  }
                }
              }
            }
          }

          // Cross-resource dependency effects: rerun dependent GET_MANY
          {
            if (
              triggeringResource &&
              resourceDependencies
                .get(triggeringResource)
                ?.has(resourceInstance) &&
              triggerVerb !== "GET" &&
              candidateVerb === "GET" &&
              candidateIsPlural
            ) {
              actionsToRerun.add(actionCandidate);
              reasonSet.add("dependency autorerun");
              continue;
            }
          }
        }
      }
    }

    return {
      actionsToRerun,
      actionsToReset,
      reasons: Array.from(reasonSet),
    };
  };

  const onActionComplete = (httpAction) => {
    const { actionsToRerun, actionsToReset, reasons } =
      findEffectOnActions(httpAction);

    if (actionsToRerun.size > 0 || actionsToReset.size > 0) {
      const reason = `${httpAction} triggered ${reasons.join(" and ")}`;
      const dispatchActions = getActionDispatcher();
      dispatchActions({
        rerunSet: actionsToRerun,
        resetSet: actionsToReset,
        reason,
      });
    }
  };

  // Helper to find which resource an action belongs to
  const getResourceForAction = (action) => {
    return action.meta.resourceInstance;
  };

  return {
    registerResource,
    registerAction,
    onActionComplete,
  };
};

// Global resource lifecycle manager instance
const resourceLifecycleManager = createResourceLifecycleManager();

// Cache for parameter scope identifiers
const paramScopeWeakSet = createIterableWeakSet();
let paramScopeIdCounter = 0;
const getParamScope = (params) => {
  for (const existingParamScope of paramScopeWeakSet) {
    if (compareTwoJsValues(existingParamScope.params, params)) {
      return existingParamScope;
    }
  }
  const id = Symbol(`paramScope-${++paramScopeIdCounter}`);
  const newParamScope = {
    params,
    id,
  };
  paramScopeWeakSet.add(newParamScope);
  return newParamScope;
};

const createHttpHandlerForRootResource = (
  name,
  {
    idKey,
    store,
    /*
    Default autorerun behavior explanation:

    GET: false (RECOMMENDED)
    What happens:
    - GET actions are reset by DELETE operations (not rerun)
    - DELETE operation on the displayed item would display nothing in the UI (action is in IDLE state)
    - PUT/PATCH operations update UI via signals, no rerun needed
    - This approach minimizes unnecessary API calls

    How to handle:
    - Applications can provide custom UI for deleted items (e.g., "Item not found")
    - Or redirect users to appropriate pages (e.g., back to list view)

    Alternative (NOT RECOMMENDED):
    - Use GET: ["DELETE"] to rerun and display 404 error received from backend
    - Poor UX: users expect immediate feedback, not loading + error state

    GET_MANY: ["POST"]
    - POST: New items may or may not appear in lists (depends on filters, pagination, etc.)
      Backend determines visibility better than client-side logic
    - DELETE: Excluded by default because:
      • UI handles deletions via store signals (selectAll filters out deleted items)
      • DELETE operations rarely change list content beyond item removal
      • Avoids unnecessary API calls (can be overridden if needed)
    */
    rerunOn = {
      GET: false,
      GET_MANY: [
        "POST",
        // "DELETE"
      ],
    },
    paramScope,
    dependencies = [],
    resourceInstance,
    mutableIdKeys = [],
  },
) => {
  // Register this resource with the resource lifecycle manager
  resourceLifecycleManager.registerResource(resourceInstance, {
    rerunOn,
    paramScope,
    dependencies,
    idKey,
    mutableIdKeys,
  });

  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (itemIdOrItemProps) => {
            const itemId = store.drop(itemIdOrItemProps);
            return itemId;
          }
        : (data) => {
            let item;
            if (Array.isArray(data)) {
              // the callback is returning something like [property, value, props]
              // this is to support a case like:
              // store.upsert("name", "currentName", { name: "newName" })
              // where we want to update the name property of an existing item
              item = store.upsert(...data);
            } else {
              item = store.upsert(data);
            }
            const itemId = item[idKey];
            return itemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${httpVerb}`;
    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, paramScope, resourceInstance, store },
      name: `${name}.${httpVerb}`,
      dataEffect: (data, action) => {
        const actionLabel = action.name;

        if (httpVerb === "DELETE") {
          if (!isProps(data) && !primitiveCanBeId(data)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to drop "${name}" resource), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        if (!isProps(data)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert "${name}" resource), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyDataEffect(data);
      },
      compute: (itemId) => store.select(itemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
    );
    return httpActionAffectingOneItem;
  };
  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      applyDataEffect: (data) => {
        const item = store.upsert(data);
        const itemId = item[idKey];
        return itemId;
      },
      compute: (itemId) => store.select(itemId),
      ...options,
    });
  const POST = (callback, options) =>
    createActionAffectingOneItem("POST", {
      callback,
      applyDataEffect: (data) => {
        const item = store.upsert(data);
        const itemId = item[idKey];
        return itemId;
      },
      compute: (itemId) => store.select(itemId),
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const PATCH = (callback, options) =>
    createActionAffectingOneItem("PATCH", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  const createActionAffectingManyItems = (
    httpVerb,
    { callback, ...options },
  ) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (idOrMutableIdArray) => {
            const idArray = store.drop(idOrMutableIdArray);
            return idArray;
          }
        : (dataArray) => {
            const itemArray = store.upsert(dataArray);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          };

    const httpActionAffectingManyItems = createAction(callback, {
      meta: { httpVerb, httpMany: true, paramScope, resourceInstance, store },
      name: `${name}.${httpVerb}_MANY`,
      data: [],
      dataEffect: applyDataEffect,
      compute: (idArray) => store.selectAll(idArray),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingManyItems,
    );
    return httpActionAffectingManyItems;
  };
  const GET_MANY = (callback, options) =>
    createActionAffectingManyItems("GET", { callback, ...options });
  const POST_MANY = (callback, options) =>
    createActionAffectingManyItems("POST", { callback, ...options });
  const PUT_MANY = (callback, options) =>
    createActionAffectingManyItems("PUT", { callback, ...options });
  const PATCH_MANY = (callback, options) =>
    createActionAffectingManyItems("PATCH", { callback, ...options });
  const DELETE_MANY = (callback, options) =>
    createActionAffectingManyItems("DELETE", { callback, ...options });

  return {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    GET_MANY,
    POST_MANY,
    PUT_MANY,
    PATCH_MANY,
    DELETE_MANY,
  };
};
const createHttpHandlerForRelationshipToOneResource = (
  name,
  {
    idKey,
    store,
    propertyName,
    childIdKey,
    childStore,
    resourceInstance,
    resourceLifecycleManager,
  },
) => {
  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (itemId) => {
            const item = store.select(itemId);
            const childItemId = item[propertyName][childIdKey];
            store.upsert({
              [idKey]: itemId,
              [propertyName]: null,
            });
            return childItemId;
          }
        : // callback must return object with the following format:
          // {
          //   [idKey]: 123,
          //   [propertyName]: {
          //     [childIdKey]: 456, ...childProps
          //   }
          // }
          // the following could happen too if there is no relationship
          // {
          //   [idKey]: 123,
          //   [propertyName]: null
          // }
          (data) => {
            const item = store.upsert(data);
            const childItem = item[propertyName];
            const childItemId = childItem ? childItem[childIdKey] : undefined;
            return childItemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${httpVerb}`;

    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, resourceInstance, store },
      name: `${name}.${httpVerb}`,
      dataEffect: (data, action) => {
        const actionLabel = action.name;

        if (httpVerb === "DELETE") {
          if (!isProps(data) && !primitiveCanBeId(data)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to drop "${name}" resource), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        if (!isProps(data)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert "${name}" resource), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyDataEffect(data);
      },
      compute: (childItemId) => childStore.select(childItemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
    );
    return httpActionAffectingOneItem;
  };

  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  // il n'y a pas de many puisque on cible une seule resource
  // genre table.owner -> c'est un seul owner qu'on peut
  // GET -> recup les infos de l'objet
  // PUT -> mettre a jour l'owner de la table
  // DELETE -> supprimer l'owner de la table

  return { GET, PUT, DELETE };
};
const createHttpHandlerRelationshipToManyResource = (
  name,
  {
    idKey,
    store,
    propertyName,
    childIdKey,
    childStore,
    resourceInstance,
    resourceLifecycleManager,
  } = {},
) => {
  // idéalement s'il y a un GET sur le store originel on voudrait ptet le reload
  // parce que le store originel peut retourner cette liste ou etre impacté
  // pour l'instant on ignore

  // one item AND many child items
  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? ([itemId, childItemId]) => {
            const item = store.select(itemId);
            const childItemArray = item[propertyName];
            const childItemArrayWithoutThisOne = [];
            let found = false;
            for (const childItemCandidate of childItemArray) {
              const childItemCandidateId = childItemCandidate[childIdKey];
              if (childItemCandidateId === childItemId) {
                found = true;
              } else {
                childItemArrayWithoutThisOne.push(childItemCandidate);
              }
            }
            if (found) {
              store.upsert({
                [idKey]: itemId,
                [propertyName]: childItemArrayWithoutThisOne,
              });
            }
            return childItemId;
          }
        : (childData) => {
            const childItem = childStore.upsert(childData); // if the child item was used it will reload thanks to signals
            const childItemId = childItem[childIdKey];
            return childItemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${httpVerb}`;

    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, resourceInstance, store: childStore },
      name: `${name}.${httpVerb}`,
      dataEffect: (data, action) => {
        const actionLabel = action.name;

        if (httpVerb === "DELETE") {
          // For DELETE in many relationship, we expect [itemId, childItemId] array
          if (!Array.isArray(data) || data.length !== 2) {
            throw new TypeError(
              `${actionLabel} must return an array [itemId, childItemId] (that will be used to remove relationship), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        if (!isProps(data)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert child item), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyDataEffect(data);
      },
      compute: (childItemId) => childStore.select(childItemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
    );
    return httpActionAffectingOneItem;
  };
  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      ...options,
    });
  // le souci que je vois ici c'est que je n'ai pas la moindre idée d'ou
  // inserer le childItem (ni meme s'il doit etre visible)
  // je pense que la bonne chose a faire est de reload
  // l'objet user.tables s'il en existe un
  // TODO: find any GET action on "user" and reload it
  const POST = (callback, options) =>
    createActionAffectingOneItem("POST", {
      callback,
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const PATCH = (callback, options) =>
    createActionAffectingOneItem("PATCH", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  const createActionAffectingManyItems = (
    httpVerb,
    { callback, ...options },
  ) => {
    const applyDataEffect =
      httpVerb === "GET"
        ? (data) => {
            // callback must return object with the following format:
            // {
            //   [idKey]: 123,
            //   [propertyName]: [
            //      { [childIdKey]: 456, ...childProps },
            //      { [childIdKey]: 789, ...childProps },
            //      ...
            //   ]
            // }
            // the array can be empty
            const item = store.upsert(data);
            const childItemArray = item[propertyName];
            const childItemIdArray = childItemArray.map(
              (childItem) => childItem[childIdKey],
            );
            return childItemIdArray;
          }
        : httpVerb === "DELETE"
          ? ([itemIdOrMutableId, childItemIdOrMutableIdArray]) => {
              const item = store.select(itemIdOrMutableId);
              const childItemArray = item[propertyName];
              const deletedChildItemIdArray = [];
              const childItemArrayWithoutThoose = [];
              let someFound = false;
              const deletedChildItemArray = childStore.select(
                childItemIdOrMutableIdArray,
              );
              for (const childItemCandidate of childItemArray) {
                if (deletedChildItemArray.includes(childItemCandidate)) {
                  someFound = true;
                  deletedChildItemIdArray.push(childItemCandidate[childIdKey]);
                } else {
                  childItemArrayWithoutThoose.push(childItemCandidate);
                }
              }
              if (someFound) {
                store.upsert({
                  [idKey]: item[idKey],
                  [propertyName]: childItemArrayWithoutThoose,
                });
              }
              return deletedChildItemIdArray;
            }
          : (childDataArray) => {
              // hum ici aussi on voudra reload "user" pour POST
              // les autres les signals se charge de reload si visible
              const childItemArray = childStore.upsert(childDataArray);
              const childItemIdArray = childItemArray.map(
                (childItem) => childItem[childIdKey],
              );
              return childItemIdArray;
            };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${httpVerb}[many]`;

    const httpActionAffectingManyItem = createAction(callback, {
      meta: { httpVerb, httpMany: true, resourceInstance, store: childStore },
      name: `${name}.${httpVerb}[many]`,
      data: [],
      dataEffect: (data, action) => {
        const actionLabel = action.name;

        if (httpVerb === "GET") {
          if (!isProps(data)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to upsert "${name}" resource with many relationships), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        if (httpVerb === "DELETE") {
          // For DELETE_MANY in many relationship, we expect [itemId, childItemIdArray] array
          if (
            !Array.isArray(data) ||
            data.length !== 2 ||
            !Array.isArray(data[1])
          ) {
            throw new TypeError(
              `${actionLabel} must return an array [itemId, childItemIdArray] (that will be used to remove relationships), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        // For POST, PUT, PATCH - expect array of objects
        if (!Array.isArray(data)) {
          throw new TypeError(
            `${actionLabel} must return an array of objects (that will be used to upsert child items), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyDataEffect(data);
      },
      compute: (childItemIdArray) => childStore.selectAll(childItemIdArray),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingManyItem,
    );
    return httpActionAffectingManyItem;
  };

  const GET_MANY = (callback, options) =>
    createActionAffectingManyItems("GET", { callback, ...options });
  const POST_MANY = (callback, options) =>
    createActionAffectingManyItems("POST", { callback, ...options });
  const PUT_MANY = (callback, options) =>
    createActionAffectingManyItems("PUT", { callback, ...options });
  const PATCH_MANY = (callback, options) =>
    createActionAffectingManyItems("PATCH", { callback, ...options });
  const DELETE_MANY = (callback, options) =>
    createActionAffectingManyItems("DELETE", { callback, ...options });

  return {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    GET_MANY,
    POST_MANY,
    PUT_MANY,
    PATCH_MANY,
    DELETE_MANY,
  };
};

const resource = (
  name,
  { idKey, mutableIdKeys = [], rerunOn, httpHandler, ...rest } = {},
) => {
  if (idKey === undefined) {
    idKey = mutableIdKeys.length === 0 ? "id" : mutableIdKeys[0];
  }
  const resourceInstance = {
    isResource: true,
    name,
    idKey,
    httpActions: {},
    addItemSetup: undefined,
    httpHandler,
  };
  if (!httpHandler) {
    const setupCallbackSet = new Set();
    const addItemSetup = (callback) => {
      setupCallbackSet.add(callback);
    };
    resourceInstance.addItemSetup = addItemSetup;

    const itemPrototype = {
      [Symbol.toStringTag]: name,
      toString() {
        let string = `${name}`;
        if (mutableIdKeys.length) {
          for (const mutableIdKey of mutableIdKeys) {
            const mutableId = this[mutableIdKey];
            if (mutableId !== undefined) {
              string += `[${mutableIdKey}=${mutableId}]`;
              return string;
            }
          }
        }
        const id = this[idKey];
        if (id) {
          string += `[${idKey}=${id}]`;
        }
        return string;
      },
    };

    const store = arraySignalStore([], idKey, {
      mutableIdKeys,
      name: `${name} store`,
      createItem: (props) => {
        const item = Object.create(itemPrototype);
        Object.assign(item, props);
        Object.defineProperty(item, SYMBOL_IDENTITY, {
          value: item[idKey],
          writable: false,
          enumerable: false,
          configurable: false,
        });
        for (const setupCallback of setupCallbackSet) {
          setupCallback(item);
        }
        return item;
      },
    });
    const useArray = () => {
      return store.arraySignal.value;
    };
    const useById = (id) => {
      return store.select(idKey, id);
    };

    Object.assign(resourceInstance, {
      useArray,
      useById,
      store,
    });

    httpHandler = createHttpHandlerForRootResource(name, {
      idKey,
      store,
      rerunOn,
      resourceInstance,
      mutableIdKeys,
    });
  }
  resourceInstance.httpHandler = httpHandler;

  // Store the action callback definitions for withParams to use later
  resourceInstance.httpActions = rest;

  // Create HTTP actions
  for (const key of Object.keys(rest)) {
    const method = httpHandler[key];
    if (!method) {
      continue;
    }
    const action = method(rest[key]);
    resourceInstance[key] = action;
  }

  resourceInstance.one = (propertyName, childResource, options) => {
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    resourceInstance.addItemSetup((item) => {
      const childItemIdSignal = signal();
      const updateChildItemId = (value) => {
        const currentChildItemId = childItemIdSignal.peek();
        if (isProps(value)) {
          const childItem = childResource.store.upsert(value);
          const childItemId = childItem[childIdKey];
          if (currentChildItemId === childItemId) {
            return false;
          }
          childItemIdSignal.value = childItemId;
          return true;
        }
        if (primitiveCanBeId(value)) {
          const childItemProps = { [childIdKey]: value };
          const childItem = childResource.store.upsert(childItemProps);
          const childItemId = childItem[childIdKey];
          if (currentChildItemId === childItemId) {
            return false;
          }
          childItemIdSignal.value = childItemId;
          return true;
        }
        if (currentChildItemId === undefined) {
          return false;
        }
        childItemIdSignal.value = undefined;
        return true;
      };
      updateChildItemId(item[propertyName]);

      const childItemSignal = computed(() => {
        const childItemId = childItemIdSignal.value;
        const childItem = childResource.store.select(childItemId);
        return childItem;
      });
      const childItemFacadeSignal = computed(() => {
        const childItem = childItemSignal.value;
        if (childItem) {
          const childItemCopy = Object.create(
            Object.getPrototypeOf(childItem),
            Object.getOwnPropertyDescriptors(childItem),
          );
          Object.defineProperty(childItemCopy, SYMBOL_OBJECT_SIGNAL, {
            value: childItemSignal,
            writable: false,
            enumerable: false,
            configurable: false,
          });
          return childItemCopy;
        }
        const nullItem = {
          [SYMBOL_OBJECT_SIGNAL]: childItemSignal,
          valueOf: () => null,
        };
        return nullItem;
      });

      Object.defineProperty(item, propertyName, {
        get: () => {
          const childItemFacade = childItemFacadeSignal.value;
          return childItemFacade;
        },
        set: (value) => {
          if (!updateChildItemId(value)) {
            return;
          }
        },
      });
    });
    const httpHandlerForRelationshipToOneChild =
      createHttpHandlerForRelationshipToOneResource(childName, {
        idKey,
        store: resourceInstance.store,
        propertyName,
        childIdKey,
        childStore: childResource.store,
        resourceInstance,
        resourceLifecycleManager,
      });
    return resource(childName, {
      idKey: childIdKey,
      httpHandler: httpHandlerForRelationshipToOneChild,
      ...options,
    });
  };
  resourceInstance.many = (propertyName, childResource, options) => {
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    resourceInstance.addItemSetup((item) => {
      const childItemIdArraySignal = signal([]);
      const updateChildItemIdArray = (valueArray) => {
        const currentIdArray = childItemIdArraySignal.peek();

        if (!Array.isArray(valueArray)) {
          if (currentIdArray.length === 0) {
            return;
          }
          childItemIdArraySignal.value = [];
          return;
        }

        let i = 0;
        const idArray = [];
        let modified = false;
        while (i < valueArray.length) {
          const value = valueArray[i];
          const currentIdAtIndex = currentIdArray[idArray.length];
          i++;
          if (isProps(value)) {
            const childItem = childResource.store.upsert(value);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) {
              modified = true;
            }
            idArray.push(childItemId);
            continue;
          }
          if (primitiveCanBeId(value)) {
            const childItemProps = { [childIdKey]: value };
            const childItem = childResource.store.upsert(childItemProps);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) {
              modified = true;
            }
            idArray.push(childItemId);
            continue;
          }
        }
        if (modified || currentIdArray.length !== idArray.length) {
          childItemIdArraySignal.value = idArray;
        }
      };
      updateChildItemIdArray(item[propertyName]);

      const childItemArraySignal = computed(() => {
        const childItemIdArray = childItemIdArraySignal.value;
        const childItemArray = childResource.store.selectAll(childItemIdArray);
        Object.defineProperty(childItemArray, SYMBOL_OBJECT_SIGNAL, {
          value: childItemArraySignal,
          writable: false,
          enumerable: false,
          configurable: false,
        });
        return childItemArray;
      });

      Object.defineProperty(item, propertyName, {
        get: () => {
          const childItemArray = childItemArraySignal.value;
          return childItemArray;
        },
        set: (value) => {
          updateChildItemIdArray(value);
        },
      });
    });
    const httpHandleForChildManyResource =
      createHttpHandlerRelationshipToManyResource(childName, {
        idKey,
        store: resourceInstance.store,
        propertyName,
        childIdKey,
        childStore: childResource.store,
        resourceInstance,
        resourceLifecycleManager,
      });
    return resource(childName, {
      idKey: childIdKey,
      httpHandler: httpHandleForChildManyResource,
      ...options,
    });
  };

  /**
   * Creates a parameterized version of the resource with isolated resource lifecycle behavior.
   *
   * Actions from parameterized resources only trigger rerun/reset for other actions with
   * identical parameters, preventing cross-contamination between different parameter sets.
   *
   * @param {Object} params - Parameters to bind to all actions of this resource (required)
   * @param {Object} options - Additional options for the parameterized resource
   * @param {Array} options.dependencies - Array of resources that should trigger autorerun when modified
   * @param {Object} options.rerunOn - Configuration for when to rerun GET/GET_MANY actions
   * @param {false|Array|string} options.rerunOn.GET - HTTP verbs that trigger GET rerun (false = reset on DELETE)
   * @param {false|Array|string} options.rerunOn.GET_MANY - HTTP verbs that trigger GET_MANY rerun (false = reset on DELETE)
   * @returns {Object} A new resource instance with parameter-bound actions and isolated lifecycle
   * @see {@link ./docs/resource_with_params.md} for detailed documentation and examples
   *
   * @example
   * const ROLE = resource("role", { GET: (params) => fetchRole(params) });
   * const adminRoles = ROLE.withParams({ canlogin: true });
   * const guestRoles = ROLE.withParams({ canlogin: false });
   * // adminRoles and guestRoles have isolated autorerun behavior
   *
   * @example
   * // Cross-resource dependencies
   * const role = resource("role");
   * const database = resource("database");
   * const tables = resource("tables");
   * const ROLE_WITH_OWNERSHIP = role.withParams({ owners: true }, {
   *   dependencies: [role, database, tables],
   * });
   * // ROLE_WITH_OWNERSHIP.GET_MANY will autorerun when any table/database/role is POST/DELETE
   */
  const withParams = (params, options = {}) => {
    // Require parameters
    if (!params || Object.keys(params).length === 0) {
      throw new Error(`resource(${name}).withParams() requires parameters`);
    }

    const { dependencies = [], rerunOn: customRerunOn } = options;

    // Generate unique param scope for these parameters
    const paramScopeObject = getParamScope(params);

    // Use custom rerunOn settings if provided, otherwise use resource defaults
    const finalRerunOn = customRerunOn || rerunOn;

    // Create a new httpHandler with the param scope for isolated autorerun
    const parameterizedHttpHandler = createHttpHandlerForRootResource(name, {
      idKey,
      store: resourceInstance.store,
      rerunOn: finalRerunOn,
      paramScope: paramScopeObject,
      dependencies,
      resourceInstance,
      mutableIdKeys,
    });

    // Create parameterized resource
    const parameterizedResource = {
      isResource: true,
      name,
      idKey,
      useArray: resourceInstance.useArray,
      useById: resourceInstance.useById,
      store: resourceInstance.store,
      addItemSetup: resourceInstance.addItemSetup,
      httpHandler: parameterizedHttpHandler,
      one: resourceInstance.one,
      many: resourceInstance.many,
      dependencies, // Store dependencies for debugging/inspection
      httpActions: resourceInstance.httpActions,
    };

    // Create HTTP actions from the parameterized handler and bind parameters
    for (const key of Object.keys(resourceInstance.httpActions)) {
      const method = parameterizedHttpHandler[key];
      if (method) {
        const action = method(resourceInstance.httpActions[key]);
        // Bind the parameters to get a parameterized action instance
        parameterizedResource[key] = action.bindParams(params);
      }
    }

    // Add withParams method to the parameterized resource for chaining
    parameterizedResource.withParams = (newParams, newOptions = {}) => {
      if (!newParams || Object.keys(newParams).length === 0) {
        throw new Error(`resource(${name}).withParams() requires parameters`);
      }
      // Merge current params with new ones for chaining
      const mergedParams = { ...params, ...newParams };
      // Merge options, with new options taking precedence
      const mergedOptions = {
        dependencies,
        rerunOn: finalRerunOn,
        ...newOptions,
      };
      return withParams(mergedParams, mergedOptions);
    };

    return parameterizedResource;
  };

  resourceInstance.withParams = withParams;

  return resourceInstance;
};

const isProps = (value) => {
  return value !== null && typeof value === "object";
};

const valueInLocalStorage = (key, options = {}) => {
  const { type = "string" } = options;
  const converter = typeConverters[type];
  if (converter === undefined) {
    console.warn(
      `Invalid type "${type}" for "${key}" in local storage, expected one of ${Object.keys(
        typeConverters,
      ).join(", ")}`,
    );
  }
  const getValidityMessage = (
    valueToCheck,
    valueInLocalStorage = valueToCheck,
  ) => {
    if (!converter) {
      return "";
    }
    if (!converter.checkValidity) {
      return "";
    }
    const checkValidityResult = converter.checkValidity(valueToCheck);
    if (checkValidityResult === false) {
      return `${valueInLocalStorage}`;
    }
    if (!checkValidityResult) {
      return "";
    }
    return `${checkValidityResult}, got "${valueInLocalStorage}"`;
  };

  const get = () => {
    let valueInLocalStorage = window.localStorage.getItem(key);
    if (valueInLocalStorage === null) {
      return Object.hasOwn(options, "default") ? options.default : undefined;
    }
    if (converter && converter.decode) {
      const valueDecoded = converter.decode(valueInLocalStorage);
      const validityMessage = getValidityMessage(
        valueDecoded,
        valueInLocalStorage,
      );
      if (validityMessage) {
        console.warn(
          `The value found in localStorage "${key}" is invalid: ${validityMessage}`,
        );
        return undefined;
      }
      return valueDecoded;
    }
    const validityMessage = getValidityMessage(valueInLocalStorage);
    if (validityMessage) {
      console.warn(
        `The value found in localStorage "${key}" is invalid: ${validityMessage}`,
      );
      return undefined;
    }
    return valueInLocalStorage;
  };
  const set = (value) => {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    const validityMessage = getValidityMessage(value);
    if (validityMessage) {
      console.warn(
        `The value to set in localStorage "${key}" is invalid: ${validityMessage}`,
      );
    }
    if (converter && converter.encode) {
      const valueEncoded = converter.encode(value);
      window.localStorage.setItem(key, valueEncoded);
      return;
    }
    window.localStorage.setItem(key, value);
  };
  const remove = () => {
    window.localStorage.removeItem(key);
  };

  return [get, set, remove];
};

const typeConverters = {
  boolean: {
    checkValidity: (value) => {
      if (typeof value !== "boolean") {
        return `must be a boolean`;
      }
      return "";
    },
    decode: (value) => {
      return value === "true";
    },
  },
  string: {
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a string`;
      }
      return "";
    },
  },
  number: {
    decode: (value) => {
      const valueParsed = parseFloat(value);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (!Number.isFinite(value)) {
        return `must be finite`;
      }
      return "";
    },
  },
  positive_number: {
    decode: (value) => {
      const valueParsed = parseFloat(value);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (value < 0) {
        return `must be positive`;
      }
      return "";
    },
  },
  positive_integer: {
    decode: (value) => {
      const valueParsed = parseInt(value, 10);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (!Number.isInteger(value)) {
        return `must be an integer`;
      }
      if (value < 0) {
        return `must be positive`;
      }
      return "";
    },
  },
  percentage: {
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a percentage`;
      }
      if (!value.endsWith("%")) {
        return `must end with %`;
      }
      const percentageString = value.slice(0, -1);
      const percentageFloat = parseFloat(percentageString);
      if (typeof percentageFloat !== "number") {
        return `must be a percentage`;
      }
      if (percentageFloat < 0 || percentageFloat > 100) {
        return `must be between 0 and 100`;
      }
      return "";
    },
  },
  object: {
    decode: (value) => {
      const valueParsed = JSON.parse(value);
      return valueParsed;
    },
    encode: (value) => {
      const valueStringified = JSON.stringify(value);
      return valueStringified;
    },
    checkValidity: (value) => {
      if (value === null || typeof value !== "object") {
        return `must be an object`;
      }
      return "";
    },
  },
};

let baseUrl = window.location.origin;

const setBaseUrl = (value) => {
  baseUrl = new URL(value, window.location).href;
};
const NO_PARAMS = { [SYMBOL_IDENTITY]: Symbol("no_params") };
// Controls what happens to actions when their route becomes inactive:
// 'abort' - Cancel the action immediately when route deactivates
// 'keep-loading' - Allow action to continue running after route deactivation
//
// The 'keep-loading' strategy could act like preloading, keeping data ready for potential return.
// However, since route reactivation triggers action reload anyway, the old data won't be used
// so it's better to abort the action to avoid unnecessary resource usage.
const ROUTE_DEACTIVATION_STRATEGY = "abort"; // 'abort', 'keep-loading'

const routeSet = new Set();
// Store previous route states to detect changes
const routePreviousStateMap = new WeakMap();
// Store abort controllers per action to control their lifecycle based on route state
const actionAbortControllerWeakMap = new WeakMap();
const updateRoutes = (
  url,
  {
    // state
    replace,
    isVisited,
  },
) => {
  const routeMatchInfoSet = new Set();
  for (const route of routeSet) {
    const routePrivateProperties = getRoutePrivateProperties(route);
    const { urlPattern } = routePrivateProperties;

    // Get previous state
    const previousState = routePreviousStateMap.get(route) || {
      active: false,
      params: NO_PARAMS,
    };
    const oldActive = previousState.active;
    const oldParams = previousState.params;
    // Check if the URL matches the route pattern
    const match = urlPattern.exec(url);
    const newActive = Boolean(match);
    let newParams;
    if (match) {
      const { optionalParamKeySet } = routePrivateProperties;
      const extractedParams = extractParams(
        urlPattern,
        url,
        optionalParamKeySet,
      );
      if (compareTwoJsValues(oldParams, extractedParams)) {
        // No change in parameters, keep the old params
        newParams = oldParams;
      } else {
        newParams = extractedParams;
      }
    } else {
      newParams = NO_PARAMS;
    }

    const routeMatchInfo = {
      route,
      routePrivateProperties,
      oldActive,
      newActive,
      oldParams,
      newParams,
    };
    routeMatchInfoSet.add(routeMatchInfo);
    // Store current state for next comparison
    routePreviousStateMap.set(route, {
      active: newActive,
      params: newParams,
    });
  }

  // Apply all signal updates in a batch
  const activeRouteSet = new Set();
  batch(() => {
    for (const {
      route,
      routePrivateProperties,
      newActive,
      newParams,
    } of routeMatchInfoSet) {
      const { activeSignal, paramsSignal, visitedSignal } =
        routePrivateProperties;
      const visited = isVisited(route.url);
      activeSignal.value = newActive;
      paramsSignal.value = newParams;
      visitedSignal.value = visited;
      route.active = newActive;
      route.params = newParams;
      route.visited = visited;
      if (newActive) {
        activeRouteSet.add(route);
      }
    }
  });

  // must be after paramsSignal.value update to ensure the proxy target is set
  // (so after the batch call)
  const toLoadSet = new Set();
  const toReloadSet = new Set();
  const abortSignalMap = new Map();
  const routeLoadRequestedMap = new Map();

  const shouldLoadOrReload = (route, shouldLoad) => {
    const routeAction = route.action;
    const currentAction = routeAction.getCurrentAction();
    if (shouldLoad) {
      if (replace || currentAction.aborted || currentAction.error) {
        shouldLoad = false;
      }
    }
    if (shouldLoad) {
      toLoadSet.add(currentAction);
    } else {
      toReloadSet.add(currentAction);
    }
    routeLoadRequestedMap.set(route, currentAction);
    // Create a new abort controller for this action
    const actionAbortController = new AbortController();
    actionAbortControllerWeakMap.set(currentAction, actionAbortController);
    abortSignalMap.set(currentAction, actionAbortController.signal);
  };

  const shouldLoad = (route) => {
    shouldLoadOrReload(route, true);
  };
  const shouldReload = (route) => {
    shouldLoadOrReload(route, false);
  };
  const shouldAbort = (route) => {
    const routeAction = route.action;
    const currentAction = routeAction.getCurrentAction();
    const actionAbortController =
      actionAbortControllerWeakMap.get(currentAction);
    if (actionAbortController) {
      actionAbortController.abort(`route no longer matching`);
      actionAbortControllerWeakMap.delete(currentAction);
    }
  };

  for (const {
    route,
    routePrivateProperties,
    newActive,
    oldActive,
    newParams,
    oldParams,
  } of routeMatchInfoSet) {
    const routeAction = route.action;
    if (!routeAction) {
      continue;
    }

    const becomesActive = newActive && !oldActive;
    const becomesInactive = !newActive && oldActive;
    const paramsChangedWhileActive =
      newActive && oldActive && newParams !== oldParams;

    // Handle actions for routes that become active
    if (becomesActive) {
      shouldLoad(route);
      continue;
    }

    // Handle actions for routes that become inactive - abort them
    if (becomesInactive && ROUTE_DEACTIVATION_STRATEGY === "abort") {
      shouldAbort(route);
      continue;
    }

    // Handle parameter changes while route stays active
    if (paramsChangedWhileActive) {
      shouldReload(route);
    }
  }

  return {
    loadSet: toLoadSet,
    reloadSet: toReloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
    activeRouteSet,
  };
};
const extractParams = (urlPattern, url, ignoreSet = new Set()) => {
  const match = urlPattern.exec(url);
  if (!match) {
    return NO_PARAMS;
  }
  const params = {};

  // Collect all parameters from URLPattern groups, handling both named and numbered groups
  let wildcardOffset = 0;
  for (const property of URL_PATTERN_PROPERTIES_WITH_GROUP_SET) {
    const urlPartMatch = match[property];
    if (urlPartMatch && urlPartMatch.groups) {
      let localWildcardCount = 0;
      for (const key of Object.keys(urlPartMatch.groups)) {
        const value = urlPartMatch.groups[key];
        const keyAsNumber = parseInt(key, 10);
        if (!isNaN(keyAsNumber)) {
          if (value) {
            // Only include non-empty values and non-ignored wildcard indices
            const wildcardKey = String(wildcardOffset + keyAsNumber);
            if (!ignoreSet.has(wildcardKey)) {
              params[wildcardKey] = decodeURIComponent(value);
            }
            localWildcardCount++;
          }
        } else if (!ignoreSet.has(key)) {
          // Named group (:param or {param}) - only include if not ignored
          params[key] = decodeURIComponent(value);
        }
      }
      // Update wildcard offset for next URL part
      wildcardOffset += localWildcardCount;
    }
  }
  return params;
};
const URL_PATTERN_PROPERTIES_WITH_GROUP_SET = new Set([
  "protocol",
  "username",
  "password",
  "hostname",
  "pathname",
  "search",
  "hash",
]);

const routePrivatePropertiesMap = new Map();
const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};
const createRoute = (urlPatternInput) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const route = {
    urlPattern: urlPatternInput,
    isRoute: true,
    active: false,
    params: NO_PARAMS,
    buildUrl: null,
    bindAction: null,
    relativeUrl: null,
    url: null,
    action: null,
    cleanup,
    toString: () => {
      return `route "${urlPatternInput}"`;
    },
    replaceParams: undefined,
  };
  routeSet.add(route);

  const routePrivateProperties = {
    urlPattern: undefined,
    activeSignal: null,
    paramsSignal: null,
    visitedSignal: null,
    relativeUrlSignal: null,
    urlSignal: null,
    optionalParamKeySet: null,
  };
  routePrivatePropertiesMap.set(route, routePrivateProperties);

  const buildRelativeUrl = (params = {}) => {
    let relativeUrl = urlPatternInput;

    // Replace named parameters (:param and {param})
    for (const key of Object.keys(params)) {
      const value = params[key];
      const encodedValue = encodeURIComponent(value);
      relativeUrl = relativeUrl.replace(`:${key}`, encodedValue);
      relativeUrl = relativeUrl.replace(`{${key}}`, encodedValue);
    }

    // Handle wildcards: if the pattern ends with /*? (optional wildcard)
    // always remove the wildcard part for URL building since it's optional
    if (relativeUrl.endsWith("/*?")) {
      // Always remove the optional wildcard part for URL building
      relativeUrl = relativeUrl.replace(/\/\*\?$/, "");
    } else {
      // For required wildcards (/*) or other patterns, replace normally
      let wildcardIndex = 0;
      relativeUrl = relativeUrl.replace(/\*/g, () => {
        const paramKey = wildcardIndex.toString();
        const replacement = params[paramKey]
          ? encodeURIComponent(params[paramKey])
          : "*";
        wildcardIndex++;
        return replacement;
      });
    }

    return relativeUrl;
  };
  const buildUrl = (params = {}) => {
    let relativeUrl = buildRelativeUrl(params);
    if (relativeUrl[0] === "/") {
      relativeUrl = relativeUrl.slice(1);
    }
    const url = new URL(relativeUrl, baseUrl).href;
    return url;
  };
  route.buildUrl = buildUrl;

  const activeSignal = signal(false);
  const paramsSignal = signal(NO_PARAMS);
  const visitedSignal = signal(false);
  const relativeUrlSignal = computed(() => {
    const params = paramsSignal.value;
    const relativeUrl = buildRelativeUrl(params);
    return relativeUrl;
  });
  const disposeRelativeUrlEffect = effect(() => {
    route.relativeUrl = relativeUrlSignal.value;
  });
  cleanupCallbackSet.add(disposeRelativeUrlEffect);

  const urlSignal = computed(() => {
    const relativeUrl = relativeUrlSignal.value;
    const url = new URL(relativeUrl, baseUrl).href;
    return url;
  });
  const disposeUrlEffect = effect(() => {
    route.url = urlSignal.value;
  });
  cleanupCallbackSet.add(disposeUrlEffect);

  const replaceParams = (newParams) => {
    const currentParams = paramsSignal.peek();
    const updatedParams = { ...currentParams, ...newParams };
    const updatedUrl = route.buildUrl(updatedParams);
    if (route.action) {
      route.action.replaceParams(updatedParams);
    }
    browserIntegration$1.goTo(updatedUrl, { replace: true });
  };
  route.replaceParams = replaceParams;

  const bindAction = (action) => {
    /*
     *
     * here I need to check the store for that action (if any)
     * and listen store changes to do this:
     *
     * When we detect changes we want to update the route params
     * so we'll need to use goTo(buildUrl(params), { replace: true })
     *
     * reinserted is useful because the item id might have changed
     * but not the mutable key
     *
     */

    const { store } = action.meta;
    if (store) {
      const { mutableIdKeys } = store;
      if (mutableIdKeys.length) {
        const mutableIdKey = mutableIdKeys[0];
        const mutableIdValueSignal = computed(() => {
          const params = paramsSignal.value;
          const mutableIdValue = params[mutableIdKey];
          return mutableIdValue;
        });
        const routeItemSignal = store.signalForMutableIdKey(
          mutableIdKey,
          mutableIdValueSignal,
        );
        store.observeProperties(routeItemSignal, (propertyMutations) => {
          const mutableIdPropertyMutation = propertyMutations[mutableIdKey];
          if (!mutableIdPropertyMutation) {
            return;
          }
          route.replaceParams({
            [mutableIdKey]: mutableIdPropertyMutation.newValue,
          });
        });
      }
    }

    /*
    store.registerPropertyLifecycle(activeItemSignal, key, {
    changed: (value) => {
      route.replaceParams({
        [key]: value,
      });
    },
    dropped: () => {
      route.reload();
    },
    reinserted: () => {
      // this will reload all routes which works but
      // - most of the time only "route" is impacted, any other route could stay as is
      // - we already have the data, reloading the route will refetch the backend which is unnecessary
      // we could just remove routing error (which is cause by 404 likely)
      // to actually let the data be displayed
      // because they are available, but in reality the route has no data
      // because the fetch failed
      // so conceptually reloading is fine,
      // the only thing that bothers me a little is that it reloads all routes
      route.reload();
    },
  });
    */

    const actionBoundToThisRoute = action.bindParams(paramsSignal);
    route.action = actionBoundToThisRoute;
    return actionBoundToThisRoute;
  };
  route.bindAction = bindAction;

  {
    // Remove leading slash from urlPattern to make it relative to baseUrl
    const normalizedUrlPattern = urlPatternInput.startsWith("/")
      ? urlPatternInput.slice(1)
      : urlPatternInput;
    const urlPattern = new URLPattern(normalizedUrlPattern, baseUrl, {
      ignoreCase: true,
    });
    routePrivateProperties.urlPattern = urlPattern;
    routePrivateProperties.activeSignal = activeSignal;
    routePrivateProperties.paramsSignal = paramsSignal;
    routePrivateProperties.visitedSignal = visitedSignal;
    routePrivateProperties.relativeUrlSignal = relativeUrlSignal;
    routePrivateProperties.urlSignal = urlSignal;
    routePrivateProperties.cleanupCallbackSet = cleanupCallbackSet;

    // Analyze pattern once to detect optional params (named and wildcard indices)
    // Note: Wildcard indices are stored as strings ("0", "1", ...) to match keys from extractParams
    const optionalParamKeySet = new Set();
    normalizedUrlPattern.replace(/:([A-Za-z0-9_]+)\?/g, (_m, name) => {
      optionalParamKeySet.add(name);
      return "";
    });
    let wildcardIndex = 0;
    normalizedUrlPattern.replace(/\*(\?)?/g, (_m, opt) => {
      if (opt === "?") {
        optionalParamKeySet.add(String(wildcardIndex));
      }
      wildcardIndex++;
      return "";
    });
    routePrivateProperties.optionalParamKeySet = optionalParamKeySet;
  }

  return route;
};
const useRouteStatus = (route) => {
  const routePrivateProperties = getRoutePrivateProperties(route);
  if (!routePrivateProperties) {
    throw new Error(`Cannot find route private properties for ${route}`);
  }

  const { urlSignal, activeSignal, paramsSignal, visitedSignal } =
    routePrivateProperties;

  const url = urlSignal.value;
  const active = activeSignal.value;
  const params = paramsSignal.value;
  const visited = visitedSignal.value;

  return {
    url,
    active,
    params,
    visited,
  };
};

let browserIntegration$1;
const setBrowserIntegration = (integration) => {
  browserIntegration$1 = integration;
};

let onRouteDefined = () => {};
const setOnRouteDefined = (v) => {
  onRouteDefined = v;
};
/**
 * Define all routes for the application.
 *
 * ⚠️ HOT RELOAD WARNING: When destructuring the returned routes, use 'let' instead of 'const'
 * to allow hot reload to update the route references:
 *
 * ❌ const [ROLE_ROUTE, DATABASE_ROUTE] = defineRoutes({...})
 * ✅ let [ROLE_ROUTE, DATABASE_ROUTE] = defineRoutes({...})
 *
 * @param {Object} routeDefinition - Object mapping URL patterns to actions
 * @returns {Array} Array of route objects in the same order as the keys
 */
// All routes MUST be created at once because any url can be accessed
// at any given time (url can be shared, reloaded, etc..)
// Later I'll consider adding ability to have dynamic import into the mix
// (An async function returning an action)
const defineRoutes = (routeDefinition) => {
  // Clean up existing routes
  for (const route of routeSet) {
    route.cleanup();
  }
  routeSet.clear();

  const routeArray = [];
  for (const key of Object.keys(routeDefinition)) {
    const value = routeDefinition[key];
    const route = createRoute(key);
    if (value && value.isAction) {
      route.bindAction(value);
    } else if (typeof value === "function") {
      const actionFromFunction = createAction(value);
      route.bindAction(actionFromFunction);
    } else if (value) {
      route.bindAction(value);
    }
    routeArray.push(route);
  }
  onRouteDefined();

  return routeArray;
};

const arraySignal = (initialValue = []) => {
  const theSignal = signal(initialValue);

  const add = (...args) => {
    theSignal.value = addIntoArray(theSignal.peek(), ...args);
  };
  const remove = (...args) => {
    theSignal.value = removeFromArray(theSignal.peek(), ...args);
  };

  return [theSignal, add, remove];
};

const executeWithCleanup = (fn, cleanup) => {
  let isThenable;
  try {
    const result = fn();
    isThenable = result && typeof result.then === "function";
    if (isThenable) {
      return (async () => {
        try {
          return await result;
        } finally {
          cleanup();
        }
      })();
    }
    return result;
  } finally {
    if (!isThenable) {
      cleanup();
    }
  }
};

let DEBUG$1 = false;
const enableDebugOnDocumentLoading = () => {
  DEBUG$1 = true;
};

const windowIsLoadingSignal = signal(true);
if (document.readyState === "complete") {
  windowIsLoadingSignal.value = false;
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      windowIsLoadingSignal.value = false;
    }
  });
}

const [
  documentLoadingRouteArraySignal,
  addToDocumentLoadingRouteArraySignal,
  removeFromDocumentLoadingRouteArraySignal,
] = arraySignal([]);
const routingWhile = (fn, routeNames = []) => {
  if (DEBUG$1 && routeNames.length > 0) {
    console.debug(`routingWhile: Adding routes to loading state:`, routeNames);
  }
  addToDocumentLoadingRouteArraySignal(...routeNames);
  return executeWithCleanup(fn, () => {
    removeFromDocumentLoadingRouteArraySignal(...routeNames);
    if (DEBUG$1 && routeNames.length > 0) {
      console.debug(
        `routingWhile: Removed routes from loading state:`,
        routeNames,
        "state after removing:",
        documentLoadingRouteArraySignal.peek(),
      );
    }
  });
};

const [
  documentLoadingActionArraySignal,
  addToDocumentLoadingActionArraySignal,
  removeFromDocumentLoadingActionArraySignal,
] = arraySignal([]);
const workingWhile = (fn, actionNames = []) => {
  if (DEBUG$1 && actionNames.length > 0) {
    console.debug(
      `workingWhile: Adding actions to loading state:`,
      actionNames,
    );
  }
  addToDocumentLoadingActionArraySignal(...actionNames);
  return executeWithCleanup(fn, () => {
    removeFromDocumentLoadingActionArraySignal(...actionNames);
    if (DEBUG$1 && actionNames.length > 0) {
      console.debug(
        `routingWhile: Removed action from loading state:`,
        actionNames,
        "start after removing:",
        documentLoadingActionArraySignal.peek(),
      );
    }
  });
};

const documentIsBusySignal = computed(() => {
  return (
    documentLoadingRouteArraySignal.value.length > 0 ||
    documentLoadingActionArraySignal.value.length > 0
  );
});

computed(() => {
  const windowIsLoading = windowIsLoadingSignal.value;
  const routesLoading = documentLoadingRouteArraySignal.value;
  const actionsLoading = documentLoadingActionArraySignal.value;
  const reasonArray = [];
  if (windowIsLoading) {
    reasonArray.push("window_loading");
  }
  if (routesLoading.length > 0) {
    reasonArray.push("document_routing");
  }
  if (actionsLoading.length > 0) {
    reasonArray.push("document_working");
  }
  return reasonArray;
});

const documentStateSignal = signal(null);
const useDocumentState = () => {
  return documentStateSignal.value;
};
const updateDocumentState = (value) => {
  documentStateSignal.value = value;
};

const documentUrlSignal = signal(window.location.href);
const useDocumentUrl = () => {
  return documentUrlSignal.value;
};
const updateDocumentUrl = (value) => {
  documentUrlSignal.value = value;
};

const setupBrowserIntegrationViaHistory = ({
  applyActions,
  applyRouting,
}) => {
  const { history } = window;

  let globalAbortController = new AbortController();
  const triggerGlobalAbort = (reason) => {
    globalAbortController.abort(reason);
    globalAbortController = new AbortController();
  };

  const dispatchActions = (params) => {
    const { requestedResult } = applyActions({
      globalAbortSignal: globalAbortController.signal,
      abortSignal: new AbortController().signal,
      ...params,
    });
    return requestedResult;
  };
  setActionDispatcher(dispatchActions);

  const getDocumentState = () => {
    return window.history.state ? { ...window.history.state } : null;
  };

  const replaceDocumentState = (
    newState,
    { reason = "replaceDocumentState called" } = {},
  ) => {
    const url = window.location.href;
    window.history.replaceState(newState, null, url);
    handleRoutingTask(url, {
      replace: true,
      state: newState,
      reason,
    });
  };

  const historyStartAtStart = getDocumentState();
  const visitedUrlSet = historyStartAtStart
    ? new Set(historyStartAtStart.jsenv_visited_urls || [])
    : new Set();

  // Create a signal that tracks visited URLs for reactive updates
  // Using a counter instead of the Set directly for better performance
  // Links will check isVisited() when this signal changes
  const visitedUrlsSignal = signal(0);

  const isVisited = (url) => {
    url = new URL(url, window.location.href).href;
    return visitedUrlSet.has(url);
  };
  const markUrlAsVisited = (url) => {
    if (visitedUrlSet.has(url)) {
      return;
    }
    visitedUrlSet.add(url);

    // Increment signal to notify subscribers that visited URLs changed
    visitedUrlsSignal.value++;

    const historyState = getDocumentState() || {};
    const hsitoryStateWithVisitedUrls = {
      ...historyState,
      jsenv_visited_urls: Array.from(visitedUrlSet),
    };
    window.history.replaceState(
      hsitoryStateWithVisitedUrls,
      null,
      window.location.href,
    );
    updateDocumentState(hsitoryStateWithVisitedUrls);
  };

  let abortController = null;
  const handleRoutingTask = (url, { state, replace, reason }) => {
    markUrlAsVisited(url);
    updateDocumentUrl(url);
    updateDocumentState(state);
    if (abortController) {
      abortController.abort(`navigating to ${url}`);
    }
    abortController = new AbortController();

    const { allResult, requestedResult } = applyRouting(url, {
      globalAbortSignal: globalAbortController.signal,
      abortSignal: abortController.signal,
      state,
      replace,
      isVisited,
      reason,
    });

    executeWithCleanup(
      () => allResult,
      () => {
        abortController = undefined;
      },
    );
    return requestedResult;
  };

  // Browser event handlers
  window.addEventListener(
    "click",
    (e) => {
      if (e.button !== 0) {
        // Ignore non-left clicks
        return;
      }
      if (e.metaKey) {
        // Ignore clicks with meta key (e.g. open in new tab)
        return;
      }
      const linkElement = e.target.closest("a");
      if (!linkElement) {
        return;
      }
      const href = linkElement.href;
      if (!href || !href.startsWith(window.location.origin)) {
        return;
      }
      if (linkElement.hasAttribute("data-readonly")) {
        return;
      }
      // Ignore anchor navigation (same page, different hash)
      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(href);
      if (
        currentUrl.pathname === targetUrl.pathname &&
        currentUrl.search === targetUrl.search &&
        targetUrl.hash !== ""
      ) {
        return;
      }
      e.preventDefault();
      const state = null;
      history.pushState(state, null, href);
      handleRoutingTask(href, {
        state,
        reason: `"click" on a[href="${href}"]`,
      });
    },
    { capture: true },
  );

  window.addEventListener(
    "submit",
    () => {
      // TODO: Handle form submissions
    },
    { capture: true },
  );

  window.addEventListener("popstate", (popstateEvent) => {
    const url = window.location.href;
    const state = popstateEvent.state;
    handleRoutingTask(url, {
      state,
      reason: `"popstate" event for ${url}`,
    });
  });

  const goTo = async (url, { state = null, replace } = {}) => {
    const currentUrl = documentUrlSignal.peek();
    if (url === currentUrl) {
      return;
    }
    if (replace) {
      window.history.replaceState(state, null, url);
    } else {
      window.history.pushState(state, null, url);
    }
    handleRoutingTask(url, {
      state,
      replace,
      reason: `goTo called with "${url}"`,
    });
  };

  const stop = (reason = "stop called") => {
    triggerGlobalAbort(reason);
  };

  const reload = () => {
    const url = window.location.href;
    const state = history.state;
    handleRoutingTask(url, {
      state,
    });
  };

  const goBack = () => {
    window.history.back();
  };

  const goForward = () => {
    window.history.forward();
  };

  const init = () => {
    const url = window.location.href;
    const state = history.state;
    history.replaceState(state, null, url);
    handleRoutingTask(url, {
      state,
      replace: true,
      reason: "routing initialization",
    });
  };

  return {
    integration: "browser_history_api",
    init,
    goTo,
    stop,
    reload,
    goBack,
    goForward,
    getDocumentState,
    replaceDocumentState,
    isVisited,
    visitedUrlsSignal,
  };
};

const applyActions = (params) => {
  const updateActionsResult = updateActions(params);
  const { allResult, runningActionSet } = updateActionsResult;
  const pendingTaskNameArray = [];
  for (const runningAction of runningActionSet) {
    pendingTaskNameArray.push(runningAction.name);
  }
  workingWhile(() => allResult, pendingTaskNameArray);
  return updateActionsResult;
};

const applyRouting = (
  url,
  {
    globalAbortSignal,
    abortSignal,
    // state
    replace,
    isVisited,
    reason,
  },
) => {
  const {
    loadSet,
    reloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
    activeRouteSet,
  } = updateRoutes(url, {
    replace,
    // state,
    isVisited,
  });
  if (loadSet.size === 0 && reloadSet.size === 0) {
    return {
      allResult: undefined,
      requestedResult: undefined,
      activeRouteSet: new Set(),
    };
  }
  const updateActionsResult = updateActions({
    globalAbortSignal,
    abortSignal,
    runSet: loadSet,
    rerunSet: reloadSet,
    abortSignalMap,
    reason,
  });
  const { allResult, runningActionSet } = updateActionsResult;
  const pendingTaskNameArray = [];
  for (const [route, routeAction] of routeLoadRequestedMap) {
    if (runningActionSet.has(routeAction)) {
      pendingTaskNameArray.push(`${route.relativeUrl} -> ${routeAction.name}`);
    }
  }
  routingWhile(() => allResult, pendingTaskNameArray);
  return { ...updateActionsResult, activeRouteSet };
};

const browserIntegration = setupBrowserIntegrationViaHistory({
  applyActions,
  applyRouting,
});

setOnRouteDefined(() => {
  browserIntegration.init();
});
setBrowserIntegration(browserIntegration);

const actionIntegratedVia = browserIntegration.integration;
const goTo = browserIntegration.goTo;
const stopLoad = (reason = "stopLoad() called") => {
  const windowIsLoading = windowIsLoadingSignal.value;
  if (windowIsLoading) {
    window.stop();
  }
  const documentIsBusy = documentIsBusySignal.value;
  if (documentIsBusy) {
    browserIntegration.stop(reason);
  }
};
const reload = browserIntegration.reload;
const goBack = browserIntegration.goBack;
const goForward = browserIntegration.goForward;
const isVisited = browserIntegration.isVisited;
const visitedUrlsSignal = browserIntegration.visitedUrlsSignal;
browserIntegration.handleActionTask;

const NOT_SET = {};
const NO_OP = () => {};
const NO_ID_GIVEN = [undefined, NO_OP, NO_OP];
const useNavStateBasic = (id, initialValue, { debug } = {}) => {
  const navStateRef = useRef(NOT_SET);
  if (!id) {
    return NO_ID_GIVEN;
  }

  if (navStateRef.current === NOT_SET) {
    const documentState = browserIntegration.getDocumentState();
    const valueInDocumentState = documentState ? documentState[id] : undefined;
    if (valueInDocumentState === undefined) {
      navStateRef.current = initialValue;
      if (initialValue !== undefined) {
        console.debug(
          `useNavState(${id}) initial value is ${initialValue} (from initialValue passed in as argument)`,
        );
      }
    } else {
      navStateRef.current = valueInDocumentState;
      if (debug) {
        console.debug(
          `useNavState(${id}) initial value is ${initialValue} (from nav state)`,
        );
      }
    }
  }

  const set = (value) => {
    const currentValue = navStateRef.current;
    if (typeof value === "function") {
      value = value(currentValue);
    }
    if (debug) {
      console.debug(
        `useNavState(${id}) set ${value} (previous was ${currentValue})`,
      );
    }

    const currentState = browserIntegration.getDocumentState() || {};

    if (value === undefined) {
      if (!Object.hasOwn(currentState, id)) {
        return;
      }
      delete currentState[id];
      browserIntegration.replaceDocumentState(currentState, {
        reason: `delete "${id}" from browser state`,
      });
      return;
    }

    const valueInBrowserState = currentState[id];
    if (valueInBrowserState === value) {
      return;
    }
    currentState[id] = value;
    browserIntegration.replaceDocumentState(currentState, {
      reason: `set { ${id}: ${value} } in browser state`,
    });
  };

  return [
    navStateRef.current,
    set,
    () => {
      set(undefined);
    },
  ];
};

const useNavState = useNavStateBasic;

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .action_error {
    padding: 20px;
    background: #fdd;
    border: 1px solid red;
    margin-top: 0;
    margin-bottom: 20px;
  }
`;
const renderIdleDefault = () => null;
const renderLoadingDefault = () => null;
const renderAbortedDefault = () => null;
const renderErrorDefault = error => {
  let routeErrorText = error && error.message ? error.message : error;
  return jsxs("p", {
    className: "action_error",
    children: ["An error occured: ", routeErrorText]
  });
};
const renderCompletedDefault = () => null;
const ActionRenderer = ({
  action,
  children,
  disabled
}) => {
  const {
    idle: renderIdle = renderIdleDefault,
    loading: renderLoading = renderLoadingDefault,
    aborted: renderAborted = renderAbortedDefault,
    error: renderError = renderErrorDefault,
    completed: renderCompleted,
    always: renderAlways
  } = typeof children === "function" ? {
    completed: children
  } : children || {};
  if (disabled) {
    return null;
  }
  if (action === undefined) {
    throw new Error("ActionRenderer requires an action to render, but none was provided.");
  }
  const {
    idle,
    loading,
    aborted,
    error,
    data
  } = useActionStatus(action);
  const UIRenderedPromise = useUIRenderedPromise(action);
  const [errorBoundary, resetErrorBoundary] = useErrorBoundary();

  // Mark this action as bound to UI components (has renderers)
  // This tells the action system that errors should be caught and stored
  // in the action's error state rather than bubbling up
  useLayoutEffect(() => {
    if (action) {
      const {
        ui
      } = getActionPrivateProperties(action);
      ui.hasRenderers = true;
    }
  }, [action]);
  useLayoutEffect(() => {
    resetErrorBoundary();
  }, [action, loading, idle, resetErrorBoundary]);
  useLayoutEffect(() => {
    UIRenderedPromise.resolve();
    return () => {
      actionUIRenderedPromiseWeakMap.delete(action);
    };
  }, [action]);

  // If renderAlways is provided, it wins and handles all rendering
  if (renderAlways) {
    return renderAlways({
      idle,
      loading,
      aborted,
      error,
      data
    });
  }
  if (idle) {
    return renderIdle(action);
  }
  if (errorBoundary) {
    return renderError(errorBoundary, "ui_error", action);
  }
  if (error) {
    return renderError(error, "action_error", action);
  }
  if (aborted) {
    return renderAborted(action);
  }
  let renderCompletedSafe;
  if (renderCompleted) {
    renderCompletedSafe = renderCompleted;
  } else {
    const {
      ui
    } = getActionPrivateProperties(action);
    if (ui.renderCompleted) {
      renderCompletedSafe = ui.renderCompleted;
    } else {
      renderCompletedSafe = renderCompletedDefault;
    }
  }
  if (loading) {
    if (action.canDisplayOldData && data !== undefined) {
      return renderCompletedSafe(data, action);
    }
    return renderLoading(action);
  }
  return renderCompletedSafe(data, action);
};
const defaultPromise = Promise.resolve();
defaultPromise.resolve = () => {};
const actionUIRenderedPromiseWeakMap = new WeakMap();
const useUIRenderedPromise = action => {
  if (!action) {
    return defaultPromise;
  }
  const actionUIRenderedPromise = actionUIRenderedPromiseWeakMap.get(action);
  if (actionUIRenderedPromise) {
    return actionUIRenderedPromise;
  }
  let resolve;
  const promise = new Promise(res => {
    resolve = res;
  });
  promise.resolve = resolve;
  actionUIRenderedPromiseWeakMap.set(action, promise);
  return promise;
};

const FormContext = createContext();

const FormActionContext = createContext();

const renderActionableComponent = (props, ref, {
  Basic,
  WithAction,
  InsideForm,
  WithActionInsideForm
}) => {
  const {
    action,
    shortcuts
  } = props;
  const formContext = useContext(FormContext);
  const hasActionProps = Boolean(action || shortcuts && shortcuts.length > 0);
  const considerInsideForm = Boolean(formContext);
  if (hasActionProps && WithAction) {
    if (considerInsideForm && WithActionInsideForm) {
      return jsx(WithActionInsideForm, {
        formContext: formContext,
        ref: ref,
        ...props
      });
    }
    return jsx(WithAction, {
      ref: ref,
      ...props
    });
  }
  if (considerInsideForm && InsideForm) {
    return jsx(InsideForm, {
      formContext: formContext,
      ref: ref,
      ...props
    });
  }
  return jsx(Basic, {
    ref: ref,
    ...props
  });
};

const useFocusGroup = (
  elementRef,
  { enabled = true, direction, skipTab, loop, name } = {},
) => {
  useLayoutEffect(() => {
    if (!enabled) {
      return null;
    }
    const focusGroup = initFocusGroup(elementRef.current, {
      direction,
      skipTab,
      loop,
      name,
    });
    return focusGroup.cleanup;
  }, [direction, skipTab, loop, name]);
};

const useDebounceTrue = (value, delay = 300) => {
  const [debouncedTrue, setDebouncedTrue] = useState(false);
  const timerRef = useRef(null);

  useLayoutEffect(() => {
    // If value is true or becomes true, start a timer
    if (value) {
      timerRef.current = setTimeout(() => {
        setDebouncedTrue(true);
      }, delay);
    } else {
      // If value becomes false, clear any pending timer and immediately set to false
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDebouncedTrue(false);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debouncedTrue;
};

installImportMetaCss(import.meta);const rightArrowPath = "M680-480L360-160l-80-80 240-240-240-240 80-80 320 320z";
const downArrowPath = "M480-280L160-600l80-80 240 240 240-240 80 80-320 320z";
import.meta.css = /* css */`
  .summary_marker {
    width: 1em;
    height: 1em;
    line-height: 1em;
  }
  .summary_marker_svg .arrow {
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .summary_marker_svg .arrow[data-animation-target="down"] {
    animation-name: morph-to-down;
  }
  @keyframes morph-to-down {
    from {
      d: path("${rightArrowPath}");
    }
    to {
      d: path("${downArrowPath}");
    }
  }
  .summary_marker_svg .arrow[data-animation-target="right"] {
    animation-name: morph-to-right;
  }
  @keyframes morph-to-right {
    from {
      d: path("${downArrowPath}");
    }
    to {
      d: path("${rightArrowPath}");
    }
  }

  .summary_marker_svg .foreground_circle {
    stroke-dasharray: 503 1507; /* ~25% of circle perimeter */
    stroke-dashoffset: 0;
    animation: progress-around-circle 1.5s linear infinite;
  }
  @keyframes progress-around-circle {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -2010;
    }
  }

  /* fading and scaling */
  .summary_marker_svg .arrow {
    transition: opacity 0.3s ease-in-out;
    opacity: 1;
  }
  .summary_marker_svg .loading_container {
    transition: transform 0.3s linear;
    transform: scale(0.3);
  }
  .summary_marker_svg .background_circle,
  .summary_marker_svg .foreground_circle {
    transition: opacity 0.3s ease-in-out;
    opacity: 0;
  }
  .summary_marker_svg[data-loading] .arrow {
    opacity: 0;
  }
  .summary_marker_svg[data-loading] .loading_container {
    transform: scale(1);
  }
  .summary_marker_svg[data-loading] .background_circle {
    opacity: 0.2;
  }
  .summary_marker_svg[data-loading] .foreground_circle {
    opacity: 1;
  }
`;
const SummaryMarker = ({
  open,
  loading
}) => {
  const showLoading = useDebounceTrue(loading, 300);
  const mountedRef = useRef(false);
  const prevOpenRef = useRef(open);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const shouldAnimate = mountedRef.current && prevOpenRef.current !== open;
  prevOpenRef.current = open;
  return jsx("span", {
    className: "summary_marker",
    children: jsxs("svg", {
      className: "summary_marker_svg",
      viewBox: "0 -960 960 960",
      xmlns: "http://www.w3.org/2000/svg",
      "data-loading": open ? showLoading || undefined : undefined,
      children: [jsxs("g", {
        className: "loading_container",
        "transform-origin": "480px -480px",
        children: [jsx("circle", {
          className: "background_circle",
          cx: "480",
          cy: "-480",
          r: "320",
          stroke: "currentColor",
          fill: "none",
          strokeWidth: "60",
          opacity: "0.2"
        }), jsx("circle", {
          className: "foreground_circle",
          cx: "480",
          cy: "-480",
          r: "320",
          stroke: "currentColor",
          fill: "none",
          strokeWidth: "60",
          strokeLinecap: "round",
          strokeDasharray: "503 1507"
        })]
      }), jsx("g", {
        className: "arrow_container",
        "transform-origin": "480px -480px",
        children: jsx("path", {
          className: "arrow",
          fill: "currentColor",
          "data-animation-target": shouldAnimate ? open ? "down" : "right" : undefined,
          d: open ? downArrowPath : rightArrowPath
        })
      })]
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_details {
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .navi_details > summary {
    flex-shrink: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    user-select: none;
  }
  .summary_body {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    gap: 0.2em;
  }
  .summary_label {
    display: flex;
    flex: 1;
    gap: 0.2em;
    align-items: center;
    padding-right: 10px;
  }

  .navi_details > summary:focus {
    z-index: 1;
  }
`;
const Details = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: DetailsBasic,
    WithAction: DetailsWithAction
  });
});
const DetailsBasic = forwardRef((props, ref) => {
  const {
    id,
    label = "Summary",
    open,
    loading,
    className,
    focusGroup,
    focusGroupDirection,
    arrowKeyShortcuts = true,
    openKeyShortcut = "ArrowRight",
    closeKeyShortcut = "ArrowLeft",
    onToggle,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [innerOpen, innerOpenSetter] = useState(open || navState);
  useFocusGroup(innerRef, {
    enabled: focusGroup,
    name: typeof focusGroup === "string" ? focusGroup : undefined,
    direction: focusGroupDirection
  });

  /**
   * Browser will dispatch "toggle" event even if we set open={true}
   * When rendering the component for the first time
   * We have to ensure the initial "toggle" event is ignored.
   *
   * If we don't do that code will think the details has changed and run logic accordingly
   * For example it will try to navigate to the current url while we are already there
   *
   * See:
   * - https://techblog.thescore.com/2024/10/08/why-we-decided-to-change-how-the-details-element-works/
   * - https://github.com/whatwg/html/issues/4500
   * - https://stackoverflow.com/questions/58942600/react-html-details-toggles-uncontrollably-when-starts-open
   *
   */

  const summaryRef = useRef(null);
  useKeyboardShortcuts(innerRef, [{
    key: openKeyShortcut,
    enabled: arrowKeyShortcuts,
    when: e => document.activeElement === summaryRef.current &&
    // avoid handling openKeyShortcut twice when keydown occurs inside nested details
    !e.defaultPrevented,
    action: e => {
      const details = innerRef.current;
      if (!details.open) {
        e.preventDefault();
        details.open = true;
        return;
      }
      const summary = summaryRef.current;
      const firstFocusableElementInDetails = findAfter(summary, elementIsFocusable, {
        root: details
      });
      if (!firstFocusableElementInDetails) {
        return;
      }
      e.preventDefault();
      firstFocusableElementInDetails.focus();
    }
  }, {
    key: closeKeyShortcut,
    enabled: arrowKeyShortcuts,
    when: () => {
      const details = innerRef.current;
      return details.open;
    },
    action: e => {
      const details = innerRef.current;
      const summary = summaryRef.current;
      if (document.activeElement === summary) {
        e.preventDefault();
        summary.focus();
        details.open = false;
      } else {
        e.preventDefault();
        summary.focus();
      }
    }
  }]);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
  }, []);
  return jsxs("details", {
    ...rest,
    ref: innerRef,
    id: id,
    className: ["navi_details", ...(className ? className.split(" ") : [])].join(" "),
    onToggle: e => {
      const isOpen = e.newState === "open";
      if (mountedRef.current) {
        if (isOpen) {
          innerOpenSetter(true);
          setNavState(true);
        } else {
          innerOpenSetter(false);
          setNavState(undefined);
        }
      }
      onToggle?.(e);
    },
    open: innerOpen,
    children: [jsx("summary", {
      ref: summaryRef,
      children: jsxs("div", {
        className: "summary_body",
        children: [jsx(SummaryMarker, {
          open: innerOpen,
          loading: loading
        }), jsx("div", {
          className: "summary_label",
          children: label
        })]
      })
    }), children]
  });
});
const DetailsWithAction = forwardRef((props, ref) => {
  const {
    action,
    loading,
    onToggle,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const effectiveAction = useAction(action);
  const {
    loading: actionLoading
  } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    // the error will be displayed by actionRenderer inside <details>
    errorEffect: "none"
  });
  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: e => {
      executeAction(e);
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd
  });
  return jsx(DetailsBasic, {
    ...rest,
    ref: innerRef,
    loading: loading || actionLoading,
    onToggle: toggleEvent => {
      const isOpen = toggleEvent.newState === "open";
      if (isOpen) {
        requestAction(toggleEvent.target, effectiveAction, {
          actionOrigin: "action_prop",
          event: toggleEvent,
          method: "run"
        });
      } else {
        effectiveAction.abort();
      }
      onToggle?.(toggleEvent);
    },
    children: jsx(ActionRenderer, {
      action: effectiveAction,
      children: children
    })
  });
});

const useCustomValidationRef = (elementRef, targetSelector) => {
  const customValidationRef = useRef();

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      console.warn(
        "useCustomValidationRef: elementRef.current is null, make sure to pass a ref to an element",
      );
      /* can happen if the component does this for instance:
      const Component = () => {
        const ref = useRef(null) 
        
        if (something) {
          return <input ref={ref} />  
        }
        return <span></span>
      }

      usually it's better to split the component in two but hey 
      */
      return null;
    }
    let target;
    {
      target = element;
    }
    const unsubscribe = subscribe(element, target);
    const validationInterface = element.__validationInterface__;
    customValidationRef.current = validationInterface;
    return () => {
      unsubscribe();
    };
  }, [targetSelector]);

  return customValidationRef;
};

const subscribeCountWeakMap = new WeakMap();
const subscribe = (element, target) => {
  if (element.__validationInterface__) {
    let subscribeCount = subscribeCountWeakMap.get(element);
    subscribeCountWeakMap.set(element, subscribeCount + 1);
  } else {
    installCustomConstraintValidation(element, target);
    subscribeCountWeakMap.set(element, 1);
  }
  return () => {
    unsubscribe(element);
  };
};

const unsubscribe = (element) => {
  const subscribeCount = subscribeCountWeakMap.get(element);
  if (subscribeCount === 1) {
    element.__validationInterface__.uninstall();
    subscribeCountWeakMap.delete(element);
  } else {
    subscribeCountWeakMap.set(element, subscribeCount - 1);
  }
};

const useConstraints = (elementRef, constraints, targetSelector) => {
  const customValidationRef = useCustomValidationRef(
    elementRef,
    targetSelector,
  );
  useLayoutEffect(() => {
    const customValidation = customValidationRef.current;
    const cleanupCallbackSet = new Set();
    for (const constraint of constraints) {
      const unregister = customValidation.registerConstraint(constraint);
      cleanupCallbackSet.add(unregister);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
    };
  }, constraints);
};

const useNetworkSpeed = () => {
  return networkSpeedSignal.value;
};

const connection =
  window.navigator.connection ||
  window.navigator.mozConnection ||
  window.navigator.webkitConnection;

const getNetworkSpeed = () => {
  // ✅ Network Information API (support moderne)
  if (!connection) {
    return "3g";
  }
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType) {
      return effectiveType; // "slow-2g", "2g", "3g", "4g", "5g"
    }
    const downlink = connection.downlink;
    if (downlink) {
      // downlink is in Mbps
      if (downlink < 1) return "slow-2g"; // < 1 Mbps
      if (downlink < 2.5) return "2g"; // 1-2.5 Mbps
      if (downlink < 10) return "3g"; // 2.5-10 Mbps
      return "4g"; // > 10 Mbps
    }
  }
  return "3g";
};

const updateNetworkSpeed = () => {
  networkSpeedSignal.value = getNetworkSpeed();
};

const networkSpeedSignal = signal(getNetworkSpeed());

const setupNetworkMonitoring = () => {
  const cleanupFunctions = [];

  // ✅ 1. Écouter les changements natifs

  if (connection) {
    connection.addEventListener("change", updateNetworkSpeed);
    cleanupFunctions.push(() => {
      connection.removeEventListener("change", updateNetworkSpeed);
    });
  }

  // ✅ 2. Polling de backup (toutes les 60 secondes)
  const pollInterval = setInterval(updateNetworkSpeed, 60000);
  cleanupFunctions.push(() => clearInterval(pollInterval));

  // ✅ 3. Vérifier lors de la reprise d'activité
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      updateNetworkSpeed();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  cleanupFunctions.push(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  // ✅ 4. Vérifier lors de la reprise de connexion
  const handleOnline = () => {
    updateNetworkSpeed();
  };

  window.addEventListener("online", handleOnline);
  cleanupFunctions.push(() => {
    window.removeEventListener("online", handleOnline);
  });

  // Cleanup global
  return () => {
    cleanupFunctions.forEach((cleanup) => cleanup());
  };
};
setupNetworkMonitoring();

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_rectangle_loading {
    position: relative;
    width: 100%;
    height: 100%;
    opacity: 0;
    display: block;
  }

  .navi_rectangle_loading[data-visible] {
    opacity: 1;
  }
`;
const RectangleLoading = ({
  shouldShowSpinner,
  color = "currentColor",
  radius = 0,
  size = 2
}) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }
    const {
      width,
      height
    } = container.getBoundingClientRect();
    setContainerWidth(width);
    setContainerHeight(height);
    let animationFrameId = null;
    // Create a resize observer to detect changes in the container's dimensions
    const resizeObserver = new ResizeObserver(entries => {
      // Use requestAnimationFrame to debounce updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(() => {
        const [containerEntry] = entries;
        const {
          width,
          height
        } = containerEntry.contentRect;
        setContainerWidth(width);
        setContainerHeight(height);
      });
    });
    resizeObserver.observe(container);
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
    };
  }, []);
  return jsx("span", {
    ref: containerRef,
    className: "navi_rectangle_loading",
    "data-visible": shouldShowSpinner ? "" : undefined,
    children: containerWidth > 0 && containerHeight > 0 && jsx(RectangleLoadingSvg, {
      radius: radius,
      color: color,
      width: containerWidth,
      height: containerHeight,
      strokeWidth: size
    })
  });
};
const RectangleLoadingSvg = ({
  width,
  height,
  color,
  radius,
  trailColor = "transparent",
  strokeWidth
}) => {
  const margin = Math.max(2, Math.min(width, height) * 0.03);

  // Calculate the drawable area
  const drawableWidth = width - margin * 2;
  const drawableHeight = height - margin * 2;

  // ✅ Check if this should be a circle
  const maxPossibleRadius = Math.min(drawableWidth, drawableHeight) / 2;
  const actualRadius = Math.min(radius || Math.min(drawableWidth, drawableHeight) * 0.05, maxPossibleRadius // ✅ Limité au radius maximum possible
  );

  // ✅ Determine if we're dealing with a circle
  const isCircle = actualRadius >= maxPossibleRadius * 0.95; // 95% = virtually a circle

  let pathLength;
  let rectPath;
  if (isCircle) {
    // ✅ Circle: perimeter = 2πr
    pathLength = 2 * Math.PI * actualRadius;

    // ✅ Circle path centered in the drawable area
    const centerX = margin + drawableWidth / 2;
    const centerY = margin + drawableHeight / 2;
    rectPath = `
      M ${centerX + actualRadius},${centerY}
      A ${actualRadius},${actualRadius} 0 1 1 ${centerX - actualRadius},${centerY}
      A ${actualRadius},${actualRadius} 0 1 1 ${centerX + actualRadius},${centerY}
    `;
  } else {
    // ✅ Rectangle: calculate perimeter properly
    const straightEdges = 2 * (drawableWidth - 2 * actualRadius) + 2 * (drawableHeight - 2 * actualRadius);
    const cornerArcs = actualRadius > 0 ? 2 * Math.PI * actualRadius : 0;
    pathLength = straightEdges + cornerArcs;
    rectPath = `
      M ${margin + actualRadius},${margin}
      L ${margin + drawableWidth - actualRadius},${margin}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + drawableWidth},${margin + actualRadius}
      L ${margin + drawableWidth},${margin + drawableHeight - actualRadius}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + drawableWidth - actualRadius},${margin + drawableHeight}
      L ${margin + actualRadius},${margin + drawableHeight}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin},${margin + drawableHeight - actualRadius}
      L ${margin},${margin + actualRadius}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + actualRadius},${margin}
    `;
  }

  // Fixed segment size in pixels
  const maxSegmentSize = 40;
  const segmentLength = Math.min(maxSegmentSize, pathLength * 0.25);
  const gapLength = pathLength - segmentLength;

  // Vitesse constante en pixels par seconde
  const networkSpeed = useNetworkSpeed();
  const pixelsPerSecond = {
    "slow-2g": 40,
    "2g": 60,
    "3g": 80,
    "4g": 120
  }[networkSpeed] || 80;
  const animationDuration = Math.max(1.5, pathLength / pixelsPerSecond);

  // ✅ Calculate correct offset based on actual segment size
  const segmentRatio = segmentLength / pathLength;
  const circleOffset = -animationDuration * segmentRatio;
  return jsxs("svg", {
    width: "100%",
    height: "100%",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none",
    style: "overflow: visible",
    xmlns: "http://www.w3.org/2000/svg",
    "shape-rendering": "geometricPrecision",
    children: [isCircle ? jsx("circle", {
      cx: margin + drawableWidth / 2,
      cy: margin + drawableHeight / 2,
      r: actualRadius,
      fill: "none",
      stroke: trailColor,
      strokeWidth: strokeWidth
    }) : jsx("rect", {
      x: margin,
      y: margin,
      width: drawableWidth,
      height: drawableHeight,
      fill: "none",
      stroke: trailColor,
      strokeWidth: strokeWidth,
      rx: actualRadius
    }), jsx("path", {
      d: rectPath,
      fill: "none",
      stroke: color,
      strokeWidth: strokeWidth,
      strokeLinecap: "round",
      strokeDasharray: `${segmentLength} ${gapLength}`,
      pathLength: pathLength,
      children: jsx("animate", {
        attributeName: "stroke-dashoffset",
        from: pathLength,
        to: "0",
        dur: `${animationDuration}s`,
        repeatCount: "indefinite",
        begin: "0s"
      })
    }), jsx("circle", {
      r: strokeWidth,
      fill: color,
      children: jsx("animateMotion", {
        path: rectPath,
        dur: `${animationDuration}s`,
        repeatCount: "indefinite",
        rotate: "auto",
        begin: `${circleOffset}s`
      })
    })]
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_inline_wrapper {
    position: relative;
    width: fit-content;
    display: inline-flex;
    height: fit-content;
    border-radius: inherit;
    cursor: inherit;
  }

  .navi_loading_rectangle_wrapper {
    pointer-events: none;
    position: absolute;
    z-index: 1;
    opacity: 0;
    top: var(--rectangle-top, 0);
    left: var(--rectangle-left, 0);
    bottom: var(--rectangle-bottom, 0);
    right: var(--rectangle-right, 0);
  }
  .navi_loading_rectangle_wrapper[data-visible] {
    opacity: 1;
  }
`;
const LoadableInlineElement = forwardRef((props, ref) => {
  const {
    // background props
    loading,
    containerRef,
    targetSelector,
    color,
    inset,
    spacingTop,
    spacingLeft,
    spacingBottom,
    spacingRight,
    // other props
    width,
    height,
    children,
    ...rest
  } = props;
  return jsxs("span", {
    ...rest,
    ref: ref,
    className: "navi_inline_wrapper",
    style: {
      ...rest.style,
      ...(width ? {
        width
      } : {}),
      ...(height ? {
        height
      } : {})
    },
    children: [jsx(LoaderBackground, {
      loading,
      containerRef,
      targetSelector,
      color,
      inset,
      spacingTop,
      spacingLeft,
      spacingBottom,
      spacingRight
    }), children]
  });
});
const LoaderBackground = ({
  loading,
  containerRef,
  targetSelector,
  color,
  inset = 0,
  spacingTop = 0,
  spacingLeft = 0,
  spacingBottom = 0,
  spacingRight = 0,
  children
}) => {
  if (containerRef) {
    const container = containerRef.current;
    if (!container) {
      return children;
    }
    return createPortal(jsx(LoaderBackgroundWithPortal, {
      container: container,
      loading: loading,
      color: color,
      inset: inset,
      spacingTop: spacingTop,
      spacingLeft: spacingLeft,
      spacingBottom: spacingBottom,
      spacingRight: spacingRight,
      children: children
    }), container);
  }
  return jsx(LoaderBackgroundBasic, {
    targetSelector: targetSelector,
    loading: loading,
    color: color,
    inset: inset,
    spacingTop: spacingTop,
    spacingLeft: spacingLeft,
    spacingBottom: spacingBottom,
    spacingRight: spacingRight,
    children: children
  });
};
const LoaderBackgroundWithPortal = ({
  container,
  loading,
  color,
  inset,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  children
}) => {
  const shouldShowSpinner = useDebounceTrue(loading, 300);
  if (!shouldShowSpinner) {
    return children;
  }
  container.style.position = "relative";
  let paddingTop = 0;
  if (container.nodeName === "DETAILS") {
    paddingTop = container.querySelector("summary").offsetHeight;
  }
  return jsxs(Fragment, {
    children: [jsx("div", {
      style: {
        position: "absolute",
        top: `${inset + paddingTop + spacingTop}px`,
        bottom: `${inset + spacingBottom}px`,
        left: `${inset + spacingLeft}px`,
        right: `${inset + spacingRight}px`
      },
      children: shouldShowSpinner && jsx(RectangleLoading, {
        color: color
      })
    }), children]
  });
};
const LoaderBackgroundBasic = ({
  loading,
  targetSelector,
  color,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  inset,
  children
}) => {
  const shouldShowSpinner = useDebounceTrue(loading, 300);
  const rectangleRef = useRef(null);
  const [, setOutlineOffset] = useState(0);
  const [borderRadius, setBorderRadius] = useState(0);
  const [borderTopWidth, setBorderTopWidth] = useState(0);
  const [borderLeftWidth, setBorderLeftWidth] = useState(0);
  const [borderRightWidth, setBorderRightWidth] = useState(0);
  const [borderBottomWidth, setBorderBottomWidth] = useState(0);
  const [marginTop, setMarginTop] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [marginRight, setMarginRight] = useState(0);
  const [paddingTop, setPaddingTop] = useState(0);
  const [paddingLeft, setPaddingLeft] = useState(0);
  const [paddingRight, setPaddingRight] = useState(0);
  const [paddingBottom, setPaddingBottom] = useState(0);
  const [currentColor, setCurrentColor] = useState(color);
  useLayoutEffect(() => {
    let animationFrame;
    const updateStyles = () => {
      const rectangle = rectangleRef.current;
      if (!rectangle) {
        return;
      }
      const container = rectangle.parentElement;
      const containedElement = rectangle.nextElementSibling;
      const target = targetSelector ? container.querySelector(targetSelector) : containedElement;
      if (target) {
        const {
          width,
          height
        } = target.getBoundingClientRect();
        const containedComputedStyle = window.getComputedStyle(containedElement);
        const targetComputedStyle = window.getComputedStyle(target);
        const newBorderTopWidth = resolveCSSSize(targetComputedStyle.borderTopWidth);
        const newBorderLeftWidth = resolveCSSSize(targetComputedStyle.borderLeftWidth);
        const newBorderRightWidth = resolveCSSSize(targetComputedStyle.borderRightWidth);
        const newBorderBottomWidth = resolveCSSSize(targetComputedStyle.borderBottomWidth);
        const newBorderRadius = resolveCSSSize(targetComputedStyle.borderRadius, {
          availableSize: Math.min(width, height)
        });
        const newOutlineColor = targetComputedStyle.outlineColor;
        const newBorderColor = targetComputedStyle.borderColor;
        const newDetectedColor = targetComputedStyle.color;
        const newOutlineOffset = resolveCSSSize(targetComputedStyle.outlineOffset);
        const newMarginTop = resolveCSSSize(targetComputedStyle.marginTop);
        const newMarginBottom = resolveCSSSize(targetComputedStyle.marginBottom);
        const newMarginLeft = resolveCSSSize(targetComputedStyle.marginLeft);
        const newMarginRight = resolveCSSSize(targetComputedStyle.marginRight);
        const paddingTop = resolveCSSSize(containedComputedStyle.paddingTop);
        const paddingLeft = resolveCSSSize(containedComputedStyle.paddingLeft);
        const paddingRight = resolveCSSSize(containedComputedStyle.paddingRight);
        const paddingBottom = resolveCSSSize(containedComputedStyle.paddingBottom);
        setBorderTopWidth(newBorderTopWidth);
        setBorderLeftWidth(newBorderLeftWidth);
        setBorderRightWidth(newBorderRightWidth);
        setBorderBottomWidth(newBorderBottomWidth);
        setBorderRadius(newBorderRadius);
        setOutlineOffset(newOutlineOffset);
        setMarginTop(newMarginTop);
        setMarginBottom(newMarginBottom);
        setMarginLeft(newMarginLeft);
        setMarginRight(newMarginRight);
        setPaddingTop(paddingTop);
        setPaddingLeft(paddingLeft);
        setPaddingRight(paddingRight);
        setPaddingBottom(paddingBottom);
        if (color) {
          // const resolvedColor = resolveCSSColor(color, rectangle, "css");
          //  console.log(resolvedColor);
          setCurrentColor(color);
        } else if (newOutlineColor && newOutlineColor !== "rgba(0, 0, 0, 0)" && (document.activeElement === containedElement || newBorderColor === "rgba(0, 0, 0, 0)")) {
          setCurrentColor(newOutlineColor);
        } else if (newBorderColor && newBorderColor !== "rgba(0, 0, 0, 0)") {
          setCurrentColor(newBorderColor);
        } else {
          setCurrentColor(newDetectedColor);
        }
      }
      // updateStyles is very cheap so we run it every frame
      animationFrame = requestAnimationFrame(updateStyles);
    };
    updateStyles();
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [color, targetSelector]);
  spacingTop += inset;
  // spacingTop += outlineOffset;
  // spacingTop -= borderTopWidth;
  spacingTop += marginTop;
  spacingLeft += inset;
  // spacingLeft += outlineOffset;
  // spacingLeft -= borderLeftWidth;
  spacingLeft += marginLeft;
  spacingRight += inset;
  // spacingRight += outlineOffset;
  // spacingRight -= borderRightWidth;
  spacingRight += marginRight;
  spacingBottom += inset;
  // spacingBottom += outlineOffset;
  // spacingBottom -= borderBottomWidth;
  spacingBottom += marginBottom;
  if (targetSelector) {
    // oversimplification that actually works
    // (simplified because it assumes the targeted element is a direct child of the contained element which may have padding)
    spacingTop += paddingTop;
    spacingLeft += paddingLeft;
    spacingRight += paddingRight;
    spacingBottom += paddingBottom;
  }
  const maxBorderWidth = Math.max(borderTopWidth, borderLeftWidth, borderRightWidth, borderBottomWidth);
  const halfMaxBorderSize = maxBorderWidth / 2;
  const size = halfMaxBorderSize < 2 ? 2 : halfMaxBorderSize;
  const lineHalfSize = size / 2;
  spacingTop -= lineHalfSize;
  spacingLeft -= lineHalfSize;
  spacingRight -= lineHalfSize;
  spacingBottom -= lineHalfSize;
  return jsxs(Fragment, {
    children: [jsx("span", {
      ref: rectangleRef,
      className: "navi_loading_rectangle_wrapper",
      "data-visible": shouldShowSpinner ? "" : undefined,
      style: {
        "--rectangle-top": `${spacingTop}px`,
        "--rectangle-left": `${spacingLeft}px`,
        "--rectangle-bottom": `${spacingBottom}px`,
        "--rectangle-right": `${spacingRight}px`
      },
      children: loading && jsx(RectangleLoading, {
        shouldShowSpinner: shouldShowSpinner,
        color: currentColor,
        radius: borderRadius,
        size: size
      })
    }), children]
  });
};

// autoFocus does not work so we focus in a useLayoutEffect,
// see https://github.com/preactjs/preact/issues/1255


let blurEvent = null;
let timeout;
document.body.addEventListener(
  "blur",
  (e) => {
    blurEvent = e;
    setTimeout(() => {
      blurEvent = null;
    });
  },
  { capture: true },
);
document.body.addEventListener(
  "focus",
  () => {
    clearTimeout(timeout);
    blurEvent = null;
  },
  { capture: true },
);

const useAutoFocus = (
  focusableElementRef,
  autoFocus,
  { autoFocusVisible, autoSelect } = {},
) => {
  useLayoutEffect(() => {
    if (!autoFocus) {
      return null;
    }
    const activeElement = document.activeElement;
    const focusableElement = focusableElementRef.current;
    focusableElement.focus({ focusVisible: autoFocusVisible });
    if (autoSelect) {
      focusableElement.select();
      // Keep the beginning of the text visible instead of scrolling to the end
      focusableElement.scrollLeft = 0;
    }
    return () => {
      const focusIsOnSelfOrInsideSelf =
        document.activeElement === focusableElement ||
        focusableElement.contains(document.activeElement);
      if (
        !focusIsOnSelfOrInsideSelf &&
        document.activeElement !== document.body
      ) {
        // focus is not on our element (or body) anymore
        // keep it where it is
        return;
      }

      // We have focus but we are unmounted
      // -> try to move focus back to something more meaningful that what browser would do
      // (browser would put it to document.body)
      // -> We'll try to move focus back to the element that had focus before we moved it to this element

      if (!document.body.contains(activeElement)) {
        // previously active element is no longer in the document
        return;
      }

      if (blurEvent) {
        // But if this element is unmounted during a blur, the element that is about to receive focus should prevail
        const elementAboutToReceiveFocus = blurEvent.relatedTarget;
        const isSelfOrInsideSelf =
          elementAboutToReceiveFocus === focusableElement ||
          focusableElement.contains(elementAboutToReceiveFocus);
        const isPreviouslyActiveElementOrInsideIt =
          elementAboutToReceiveFocus === activeElement ||
          (activeElement && activeElement.contains(elementAboutToReceiveFocus));
        if (!isSelfOrInsideSelf && !isPreviouslyActiveElementOrInsideIt) {
          // the element about to receive focus is not the input itself or inside it
          // and is not the previously active element or inside it
          // -> the element about to receive focus should prevail
          return;
        }
      }

      activeElement.focus();
    };
  }, []);

  useEffect(() => {
    if (autoFocus) {
      const focusableElement = focusableElementRef.current;
      focusableElement.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, []);
};

const initCustomField = (customField, field) => {
  const [teardown, addTeardown] = createPubSub();

  const addEventListener = (element, eventType, listener) => {
    element.addEventListener(eventType, listener);
    return addTeardown(() => {
      element.removeEventListener(eventType, listener);
    });
  };
  const updateBooleanAttribute = (attributeName, isPresent) => {
    if (isPresent) {
      customField.setAttribute(attributeName, "");
    } else {
      customField.removeAttribute(attributeName);
    }
  };
  const checkPseudoClasses = () => {
    const hover = field.matches(":hover");
    const active = field.matches(":active");
    const checked = field.matches(":checked");
    const focus = field.matches(":focus");
    const focusVisible = field.matches(":focus-visible");
    const valid = field.matches(":valid");
    const invalid = field.matches(":invalid");
    updateBooleanAttribute(`data-hover`, hover);
    updateBooleanAttribute(`data-active`, active);
    updateBooleanAttribute(`data-checked`, checked);
    updateBooleanAttribute(`data-focus`, focus);
    updateBooleanAttribute(`data-focus-visible`, focusVisible);
    updateBooleanAttribute(`data-valid`, valid);
    updateBooleanAttribute(`data-invalid`, invalid);
  };

  // :hover
  addEventListener(field, "mouseenter", checkPseudoClasses);
  addEventListener(field, "mouseleave", checkPseudoClasses);
  // :active
  addEventListener(field, "mousedown", checkPseudoClasses);
  addEventListener(document, "mouseup", checkPseudoClasses);
  // :focus
  addEventListener(field, "focusin", checkPseudoClasses);
  addEventListener(field, "focusout", checkPseudoClasses);
  // :focus-visible
  addEventListener(document, "keydown", checkPseudoClasses);
  addEventListener(document, "keyup", checkPseudoClasses);
  // :checked
  if (field.type === "checkbox") {
    // Listen to user interactions
    addEventListener(field, "input", checkPseudoClasses);

    // Intercept programmatic changes to .checked property
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "checked",
    );
    Object.defineProperty(field, "checked", {
      get: originalDescriptor.get,
      set(value) {
        originalDescriptor.set.call(this, value);
        checkPseudoClasses();
      },
      configurable: true,
    });
    addTeardown(() => {
      // Restore original property descriptor
      Object.defineProperty(field, "checked", originalDescriptor);
    });
  } else if (field.type === "radio") {
    // Listen to changes on the radio group
    const radioSet =
      field.closest("[data-radio-list], fieldset, form") || document;
    addEventListener(radioSet, "input", checkPseudoClasses);

    // Intercept programmatic changes to .checked property
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "checked",
    );
    Object.defineProperty(field, "checked", {
      get: originalDescriptor.get,
      set(value) {
        originalDescriptor.set.call(this, value);
        checkPseudoClasses();
      },
      configurable: true,
    });
    addTeardown(() => {
      // Restore original property descriptor
      Object.defineProperty(field, "checked", originalDescriptor);
    });
  } else if (field.tagName === "INPUT") {
    addEventListener(field, "input", checkPseudoClasses);
  }

  // just in case + catch use forcing them in chrome devtools
  const interval = setInterval(() => {
    checkPseudoClasses();
  }, 150);
  addTeardown(() => {
    clearInterval(interval);
  });

  return teardown;
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    label {
      cursor: pointer;
    }

    label[data-readonly],
    label[data-disabled] {
      color: rgba(0, 0, 0, 0.5);
      cursor: default;
    }
  }
`;
const ReportReadOnlyOnLabelContext = createContext();
const ReportDisabledOnLabelContext = createContext();
const Label = forwardRef((props, ref) => {
  const {
    readOnly,
    disabled,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [inputReadOnly, setInputReadOnly] = useState(false);
  const innerReadOnly = readOnly || inputReadOnly;
  const [inputDisabled, setInputDisabled] = useState(false);
  const innerDisabled = disabled || inputDisabled;
  return jsx("label", {
    ref: innerRef,
    "data-readonly": innerReadOnly ? "" : undefined,
    "data-disabled": innerDisabled ? "" : undefined,
    ...rest,
    children: jsx(ReportReadOnlyOnLabelContext.Provider, {
      value: setInputReadOnly,
      children: jsx(ReportDisabledOnLabelContext.Provider, {
        value: setInputDisabled,
        children: children
      })
    })
  });
});

const debugUIState = (...args) => {
};
const debugUIGroup = (...args) => {
};

const UIStateControllerContext = createContext();
const UIStateContext = createContext();
const ParentUIStateControllerContext = createContext();

const FieldNameContext = createContext();
const ReadOnlyContext = createContext();
const DisabledContext = createContext();
const RequiredContext = createContext();
const LoadingContext = createContext();
const LoadingElementContext = createContext();

/**
 * UI State Controller Hook
 *
 * Manages the relationship between external state (props) and UI state (what user sees).
 * Allows UI state to diverge temporarily for responsive interactions, with mechanisms
 * to sync back to external state when needed.
 *
 * Key features:
 * - Immediate UI updates for responsive interactions
 * - State divergence with sync capabilities (resetUIState)
 * - Group integration for coordinated form inputs
 * - External control via custom events (onsetuistate/onresetuistate)
 * - Error recovery and form reset support
 *
 * See README.md for detailed usage examples and patterns.
 */
const useUIStateController = (
  props,
  componentType,
  {
    statePropName = "value",
    defaultStatePropName = "defaultValue",
    fallbackState = "",
    getStateFromProp = (prop) => prop,
    getPropFromState = (state) => state,
  } = {},
) => {
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const formContext = useContext(FormContext);
  const { id, name, onUIStateChange, action } = props;
  const uncontrolled = !formContext && !action;
  const [navState, setNavState] = useNavState(id);

  const uiStateControllerRef = useRef();
  const hasStateProp = Object.hasOwn(props, statePropName);
  const state = props[statePropName];
  const defaultState = props[defaultStatePropName];
  const stateInitial = useInitialValue(() => {
    if (hasStateProp) {
      // controlled by state prop ("value" or "checked")
      return getStateFromProp(state);
    }
    if (defaultState) {
      // not controlled but want an initial state (a value or being checked)
      return getStateFromProp(defaultState);
    }
    if (formContext && navState) {
      // not controlled but want to use value from nav state
      // (I think this should likely move earlier to win over the hasUIStateProp when it's undefined)
      return getStateFromProp(navState);
    }
    return getStateFromProp(fallbackState);
  });

  /**
   * This check is needed only for basic field because
   * When using action/form we consider the action/form code
   * will have a side effect that will re-render the component with the up-to-date state
   *
   * In practice we set the checked from the backend state
   * We use action to fetch the new state and update the local state
   * The component re-renders so it's the action/form that is considered as responsible
   * to update the state and as a result allowed to have "checked"/"value" prop without "onUIStateChange"
   */
  const readOnly =
    uncontrolled &&
    hasStateProp &&
    !onUIStateChange &&
    !parentUIStateController;

  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIStateChange,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    uiStateControllerRef);
  useLayoutEffect(() => {
    notifyParentAboutChildMount();
    return notifyParentAboutChildUnmount;
  }, []);

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    existingUIStateController._checkForUpdates({
      readOnly,
      name,
      onUIStateChange,
      getPropFromState,
      getStateFromProp,
      hasStateProp,
      stateInitial,
      state,
    });
    return existingUIStateController;
  }
  debugUIState(
    `Creating "${componentType}" ui state controller - initial state:`,
    JSON.stringify(stateInitial),
  );
  const [publishUIState, subscribeUIState] = createPubSub();
  const uiStateController = {
    _checkForUpdates: ({
      readOnly,
      name,
      onUIStateChange,
      getPropFromState,
      getStateFromProp,
      hasStateProp,
      stateInitial,
      state,
    }) => {
      uiStateController.readOnly = readOnly;
      uiStateController.name = name;
      uiStateController.onUIStateChange = onUIStateChange;
      uiStateController.getPropFromState = getPropFromState;
      uiStateController.getStateFromProp = getStateFromProp;
      uiStateController.stateInitial = stateInitial;

      if (hasStateProp) {
        uiStateController.hasStateProp = true;
        const currentState = uiStateController.state;
        if (state !== currentState) {
          uiStateController.state = state;
          uiStateController.setUIState(
            uiStateController.getPropFromState(state),
            new CustomEvent("state_prop"),
          );
        }
      } else if (uiStateController.hasStateProp) {
        uiStateController.hasStateProp = false;
        uiStateController.state = uiStateController.stateInitial;
      }
    },

    componentType,
    readOnly,
    name,
    hasStateProp,
    state: stateInitial,
    uiState: stateInitial,
    onUIStateChange,
    getPropFromState,
    getStateFromProp,
    setUIState: (prop, e) => {
      const newUIState = uiStateController.getStateFromProp(prop);
      if (formContext) {
        setNavState(prop);
      }
      const currentUIState = uiStateController.uiState;
      if (newUIState === currentUIState) {
        return;
      }
      debugUIState(
        `${componentType}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updating to ${JSON.stringify(newUIState)}`,
      );
      uiStateController.uiState = newUIState;
      publishUIState(newUIState);
      uiStateController.onUIStateChange?.(newUIState, e);
      notifyParentAboutChildUIStateChange(e);
    },
    resetUIState: (e) => {
      const currentState = uiStateController.state;
      uiStateController.setUIState(currentState, e);
    },
    actionEnd: () => {
      if (formContext) {
        setNavState(undefined);
      }
    },
    subscribe: subscribeUIState,
  };
  uiStateControllerRef.current = uiStateController;
  return uiStateController;
};

const NO_PARENT = [() => {}, () => {}, () => {}];
const useParentControllerNotifiers = (
  parentUIStateController,
  uiStateControllerRef,
  componentType,
) => {
  return useMemo(() => {
    if (!parentUIStateController) {
      return NO_PARENT;
    }

    parentUIStateController.componentType;
    const notifyParentAboutChildMount = () => {
      const uiStateController = uiStateControllerRef.current;
      parentUIStateController.registerChild(uiStateController);
    };

    const notifyParentAboutChildUIStateChange = (e) => {
      const uiStateController = uiStateControllerRef.current;
      parentUIStateController.onChildUIStateChange(uiStateController, e);
    };

    const notifyParentAboutChildUnmount = () => {
      const uiStateController = uiStateControllerRef.current;
      parentUIStateController.unregisterChild(uiStateController);
    };

    return [
      notifyParentAboutChildMount,
      notifyParentAboutChildUIStateChange,
      notifyParentAboutChildUnmount,
    ];
  }, []);
};

/**
 * UI Group State Controller Hook
 *
 * This hook manages a collection of child UI state controllers and aggregates their states
 * into a unified group state. It provides a way to coordinate multiple form inputs that
 * work together as a logical unit.
 *
 * What it provides:
 *
 * 1. **Child State Aggregation**:
 *    - Collects state from multiple child UI controllers
 *    - Combines them into a single meaningful group state
 *    - Updates group state automatically when any child changes
 *
 * 2. **Child Filtering**:
 *    - Can filter which child controllers to include based on component type
 *    - Useful for mixed content where only specific inputs matter
 *    - Enables type-safe aggregation patterns
 *
 * 3. **Group Operations**:
 *    - Provides `resetUIState()` that cascades to all children
 *    - Enables group-level operations like "clear all" or "reset form section"
 *    - Maintains consistency across related inputs
 *
 * 4. **External State Management**:
 *    - Notifies external code of group state changes via `onUIStateChange`
 *    - Allows external systems to react to group-level state changes
 *    - Supports complex form validation and submission logic
 *
 * Why use it:
 * - When you have multiple related inputs that should be treated as one logical unit
 * - For implementing checkbox lists, radio groups, or form sections
 * - When you need to perform operations on multiple inputs simultaneously
 * - To aggregate input states for validation or submission
 *
 * How it works:
 * - Child controllers automatically register themselves when mounted
 * - Group controller listens for child state changes and re-aggregates
 * - Custom aggregation function determines how child states combine
 * - Group state updates trigger notifications to external code
 *
 * @param {Object} props - Component props containing onUIStateChange callback
 * @param {string} componentType - Type identifier for this group controller
 * @param {Object} config - Configuration object
 * @param {string} [config.childComponentType] - Filter children by this type (e.g., "checkbox")
 * @param {Function} config.aggregateChildStates - Function to aggregate child states
 * @param {any} [config.emptyState] - State to use when no children have values
 * @returns {Object} UI group state controller
 *
 * Usage Examples:
 * - **Checkbox List**: Aggregates multiple checkboxes into array of checked values
 * - **Radio Group**: Manages radio buttons to ensure single selection
 * - **Form Section**: Groups related inputs for validation and reset operations
 * - **Dynamic Lists**: Handles variable number of repeated input groups
 */

const useUIGroupStateController = (
  props,
  componentType,
  { childComponentType, aggregateChildStates, emptyState = undefined },
) => {
  if (typeof aggregateChildStates !== "function") {
    throw new TypeError("aggregateChildStates must be a function");
  }
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const { onUIStateChange, name } = props;
  const childUIStateControllerArrayRef = useRef([]);
  const childUIStateControllerArray = childUIStateControllerArrayRef.current;
  const uiStateControllerRef = useRef();

  const groupIsRenderingRef = useRef(false);
  const pendingChangeRef = useRef(false);
  groupIsRenderingRef.current = true;
  pendingChangeRef.current = false;

  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIStateChange,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    uiStateControllerRef);
  useLayoutEffect(() => {
    notifyParentAboutChildMount();
    return notifyParentAboutChildUnmount;
  }, []);

  const onChange = (_, e) => {
    if (groupIsRenderingRef.current) {
      pendingChangeRef.current = true;
      return;
    }
    const newUIState = aggregateChildStates(
      childUIStateControllerArray,
      emptyState,
    );
    const uiStateController = uiStateControllerRef.current;
    uiStateController.setUIState(newUIState, e);
  };

  useLayoutEffect(() => {
    groupIsRenderingRef.current = false;
    if (pendingChangeRef.current) {
      pendingChangeRef.current = false;
      onChange(
        null,
        new CustomEvent(`${componentType}_batched_ui_state_update`),
      );
    }
  });

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    existingUIStateController.name = name;
    existingUIStateController.onUIStateChange = onUIStateChange;
    return existingUIStateController;
  }

  const [publishUIState, subscribeUIState] = createPubSub();
  const isMonitoringChild = (childUIStateController) => {
    if (childComponentType === "*") {
      return true;
    }
    return childUIStateController.componentType === childComponentType;
  };
  const uiStateController = {
    componentType,
    name,
    onUIStateChange,
    uiState: emptyState,
    setUIState: (newUIState, e) => {
      const currentUIState = uiStateController.uiState;
      if (newUIState === currentUIState) {
        return;
      }
      uiStateController.uiState = newUIState;
      debugUIGroup(
        `${componentType}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updates from ${JSON.stringify(currentUIState)} to ${JSON.stringify(newUIState)}`,
      );
      publishUIState(newUIState);
      uiStateController.onUIStateChange?.(newUIState, e);
      notifyParentAboutChildUIStateChange(e);
    },
    registerChild: (childUIStateController) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childComponentType = childUIStateController.componentType;
      childUIStateControllerArray.push(childUIStateController);
      debugUIGroup(
        `${componentType}.registerChild("${childComponentType}") -> registered (total: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childComponentType}_mount`),
      );
    },
    onChildUIStateChange: (childUIStateController, e) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      debugUIGroup(
        `${componentType}.onChildUIStateChange("${childComponentType}") to ${JSON.stringify(
          childUIStateController.uiState,
        )}`,
      );
      onChange(childUIStateController, e);
    },
    unregisterChild: (childUIStateController) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childComponentType = childUIStateController.componentType;
      const index = childUIStateControllerArray.indexOf(childUIStateController);
      if (index === -1) {
        return;
      }
      childUIStateControllerArray.splice(index, 1);
      debugUIGroup(
        `${componentType}.unregisterChild("${childComponentType}") -> unregisteed (remaining: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childComponentType}_unmount`),
      );
    },
    resetUIState: (e) => {
      // we should likely batch the changes that will be reported for performances
      for (const childUIStateController of childUIStateControllerArray) {
        childUIStateController.resetUIState(e);
      }
    },
    actionEnd: (e) => {
      for (const childUIStateController of childUIStateControllerArray) {
        childUIStateController.actionEnd(e);
      }
    },
    subscribe: subscribeUIState,
  };
  uiStateControllerRef.current = uiStateController;
  return uiStateController;
};

/**
 * Hook to track UI state from a UI state controller
 *
 * This hook allows external code to react to UI state changes without
 * causing the controller itself to re-create. It returns the current UI state
 * and will cause re-renders when the UI state changes.
 *
 * @param {Object} uiStateController - The UI state controller to track
 * @returns {any} The current UI state
 */
const useUIState = (uiStateController) => {
  const [trackedUIState, setTrackedUIState] = useState(
    uiStateController.uiState,
  );

  useLayoutEffect(() => {
    // Subscribe to UI state changes
    const unsubscribe = uiStateController.subscribe(setTrackedUIState);

    // Sync with current state in case it changed before subscription
    setTrackedUIState(uiStateController.uiState);

    return unsubscribe;
  }, [uiStateController]);

  return trackedUIState;
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    :root {
      --navi-checkmark-color-light: white;
      --navi-checkmark-color-dark: rgb(55, 55, 55);
      --navi-checkmark-color: var(--navi-checkmark-light-color);
    }

    .navi_checkbox {
      position: relative;
      display: inline-flex;
      box-sizing: content-box;

      --outline-offset: 1px;
      --outline-width: 2px;
      --border-width: 1px;
      --border-radius: 2px;
      --width: 13px;
      --height: 13px;

      --outline-color: light-dark(#4476ff, #3b82f6);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      /* --color: currentColor; */
      --checkmark-color: var(--navi-checkmark-color);

      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-checked-readonly: #d3d3d3;
      --border-color-checked-disabled: #d3d3d3;
      --background-color-checked-readonly: var(
        --navi-background-color-readonly
      );
      --background-color-checked-disabled: var(
        --navi-background-color-disabled
      );
      --checkmark-color-readonly: var(--navi-color-readonly);
      --checkmark-color-disabled: var(--navi-color-disabled);
    }
    .navi_checkbox input {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      border: none;
      opacity: 0;
      cursor: inherit;
    }
    .navi_checkbox_field {
      display: inline-flex;
      box-sizing: border-box;
      width: var(--width);
      height: var(--height);
      margin: 3px 3px 3px 4px;
      background-color: var(--background-color);
      border-width: var(--border-width);
      border-style: solid;
      border-color: var(--border-color);
      border-radius: var(--border-radius);
      outline-width: var(--outline-width);

      outline-style: none;

      outline-color: var(--outline-color);
      outline-offset: var(--outline-offset);
      /* color: var(--color); */
    }
    .navi_checkbox_marker {
      width: 100%;
      height: 100%;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.15s ease;
      pointer-events: none;
    }

    /* Focus */
    .navi_checkbox[data-focus-visible] .navi_checkbox_field {
      outline-style: solid;
    }
    /* Hover */
    .navi_checkbox[data-hover] .navi_checkbox_field {
      --border-color: var(--border-color-hover);
    }
    /* Checked */
    .navi_checkbox[data-checked] .navi_checkbox_field {
      --background-color: var(--accent-color);
      --border-color: var(--accent-color);
    }
    .navi_checkbox[data-checked] .navi_checkbox_marker {
      opacity: 1;
      stroke: var(--checkmark-color);
      transform: scale(1);
    }
    /* Readonly */
    .navi_checkbox[data-readonly] .navi_checkbox_field,
    .navi_checkbox[data-readonly][data-hover] .navi_checkbox_field {
      --border-color: var(--border-color-readonly);
      --background-color: var(--background-color-readonly);
    }
    .navi_checkbox[data-checked][data-readonly] .navi_checkbox_field {
      --background-color: var(--background-color-checked-readonly);
      --border-color: var(--border-color-checked-readonly);
    }
    .navi_checkbox[data-checked][data-readonly] .navi_checkbox_marker {
      stroke: var(--checkmark-color-readonly);
    }
    /* Disabled */
    .navi_checkbox[data-disabled] .navi_checkbox_field {
      --background-color: var(--background-color-disabled);
      --border-color: var(--border-color-disabled);
    }
    .navi_checkbox[data-checked][data-disabled] .navi_checkbox_field {
      --border-color: var(--border-color-checked-disabled);
      --background-color: var(--background-color-checked-disabled);
    }

    .navi_checkbox[data-checked][data-disabled] .navi_checkbox_marker {
      stroke: var(--checkmark-color-disabled);
    }
  }
`;
const InputCheckbox = forwardRef((props, ref) => {
  const {
    value = "on"
  } = props;
  const uiStateController = useUIStateController(props, "checkbox", {
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    fallbackState: false,
    getStateFromProp: checked => checked ? value : undefined,
    getPropFromState: Boolean
  });
  const uiState = useUIState(uiStateController);
  const checkbox = renderActionableComponent(props, ref, {
    Basic: InputCheckboxBasic,
    WithAction: InputCheckboxWithAction,
    InsideForm: InputCheckboxInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: checkbox
    })
  });
});
const InputCheckboxBasic = forwardRef((props, ref) => {
  const contextFieldName = useContext(FieldNameContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextRequired = useContext(RequiredContext);
  const contextLoading = useContext(LoadingContext);
  const loadingElement = useContext(LoadingElementContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const reportDisabledOnLabel = useContext(ReportDisabledOnLabelContext);
  const {
    name,
    readOnly,
    disabled,
    required,
    loading,
    autoFocus,
    constraints = [],
    appeareance = "navi",
    // "navi" or "default"
    accentColor,
    onClick,
    onInput,
    style,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const innerName = name || contextFieldName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading = loading || contextLoading && loadingElement === innerRef.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const checked = Boolean(uiState);
  const actionName = rest["data-action"];
  if (actionName) {
    delete rest["data-action"];
  }
  const inputCheckbox = jsx("input", {
    ...rest,
    ref: innerRef,
    type: "checkbox",
    style: appeareance === "default" ? style : undefined,
    name: innerName,
    checked: checked,
    readOnly: innerReadOnly,
    disabled: innerDisabled,
    required: innerRequired,
    "data-callout-arrow-x": "center",
    onClick: e => {
      if (innerReadOnly) {
        e.preventDefault();
      }
      onClick?.(e);
    },
    onInput: e => {
      const checkbox = e.target;
      const checkboxIsChecked = checkbox.checked;
      uiStateController.setUIState(checkboxIsChecked, e);
      onInput?.(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onsetuistate: e => {
      uiStateController.setUIState(e.detail.value, e);
    }
  });
  const loaderProps = {
    loading: innerLoading,
    inset: -1,
    style: {
      "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)"
    },
    color: "var(--accent-color)"
  };
  if (appeareance === "navi") {
    return jsx(NaviCheckbox, {
      "data-action": actionName,
      inputRef: innerRef,
      accentColor: accentColor,
      readOnly: readOnly,
      disabled: innerDisabled,
      style: style,
      children: jsx(LoaderBackground, {
        ...loaderProps,
        targetSelector: ".navi_checkbox_field",
        children: inputCheckbox
      })
    });
  }
  return jsx(LoadableInlineElement, {
    ...loaderProps,
    "data-action": actionName,
    children: inputCheckbox
  });
});
const NaviCheckbox = ({
  accentColor,
  readOnly,
  disabled,
  inputRef,
  style,
  children,
  ...rest
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const naviCheckbox = ref.current;
    const colorPicked = pickLightOrDark(naviCheckbox, "var(--accent-color)", "var(--navi-checkmark-color-light)", "var(--navi-checkmark-color-dark)");
    naviCheckbox.style.setProperty("--checkmark-color", colorPicked);
  }, [accentColor]);
  useLayoutEffect(() => {
    return initCustomField(ref.current, inputRef.current);
  }, []);
  return jsxs("div", {
    ...rest,
    ref: ref,
    className: "navi_checkbox",
    style: {
      ...(accentColor ? {
        "--accent-color": accentColor
      } : {}),
      ...style
    },
    "data-readonly": readOnly ? "" : undefined,
    "data-disabled": disabled ? "" : undefined,
    children: [children, jsx("div", {
      className: "navi_checkbox_field",
      children: jsx("svg", {
        viewBox: "0 0 12 12",
        "aria-hidden": "true",
        className: "navi_checkbox_marker",
        children: jsx("path", {
          d: "M10.5 2L4.5 9L1.5 5.5",
          fill: "none",
          strokeWidth: "2"
        })
      })
    })]
  });
};
const InputCheckboxWithAction = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    onCancel,
    onChange,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(actionBoundToUIState);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });

  // In this situation updating the ui state === calling associated action
  // so cance/abort/error have to revert the ui state to the one before user interaction
  // to show back the real state of the checkbox (not the one user tried to set)
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onAbort: e => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: e => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: e => {
      onActionEnd?.(e);
    }
  });
  return jsx(InputCheckboxBasic, {
    "data-action": actionBoundToUIState.name,
    ...rest,
    ref: innerRef,
    loading: loading || actionLoading,
    onChange: e => {
      requestAction(e.target, actionBoundToUIState, {
        event: e,
        actionOrigin: "action_prop"
      });
      onChange?.(e);
    }
  });
});
const InputCheckboxInsideForm = InputCheckboxBasic;

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    :root {
      --navi-radiomark-color: light-dark(#4476ff, #3b82f6);
    }

    .navi_radio {
      position: relative;
      display: inline-flex;
      box-sizing: content-box;

      --outline-offset: 1px;
      --outline-width: 2px;
      --width: 13px;
      --height: 13px;

      --outline-color: light-dark(#4476ff, #3b82f6);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: var(--navi-radiomark-color);
      --mark-color: var(--accent-color);

      /* light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3)); */
      --accent-color-checked: color-mix(
        in srgb,
        var(--accent-color) 70%,
        black
      );

      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-checked: var(--accent-color);
      --border-color-checked-hover: var(--accent-color-checked);
      --border-color-checked-readonly: #d3d3d3;
      --border-color-checked-disabled: #d3d3d3;
      --background-color-readonly: var(--background-color);
      --background-color-disabled: var(--background-color);
      --background-color-checked-readonly: #d3d3d3;
      --background-color-checked-disabled: var(--background-color);
      --mark-color-hover: var(--accent-color-checked);
      --mark-color-readonly: grey;
      --mark-color-disabled: #eeeeee;
    }
    .navi_radio input {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      opacity: 0;
      cursor: inherit;
    }
    .navi_radio_field {
      display: inline-flex;
      width: var(--width);
      height: var(--height);
      margin-top: 3px;
      margin-right: 3px;
      margin-left: 5px;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      outline-width: var(--outline-width);

      outline-style: none;

      outline-color: var(--outline-color);

      outline-offset: var(--outline-offset);
    }
    .navi_radio_field svg {
      overflow: visible;
    }
    .navi_radio_border {
      fill: var(--background-color);
      stroke: var(--border-color);
    }
    .navi_radio_marker {
      width: 100%;
      height: 100%;
      opacity: 0;
      fill: var(--mark-color);
      transform: scale(0.3);
      transform-origin: center;
      pointer-events: none;
    }
    .navi_radio_dashed_border {
      display: none;
    }
    .navi_radio[data-transition] .navi_radio_marker {
      transition: all 0.15s ease;
    }
    .navi_radio[data-transition] .navi_radio_dashed_border {
      transition: all 0.15s ease;
    }
    .navi_radio[data-transition] .navi_radio_border {
      transition: all 0.15s ease;
    }

    /* Focus */
    .navi_radio[data-focus-visible] .navi_radio_field {
      outline-style: solid;
    }
    /* Hover */
    .navi_radio[data-hover] .navi_radio_border {
      stroke: var(--border-color-hover);
    }
    .navi_radio[data-hover] .navi_radio_marker {
      fill: var(--mark-color-hover);
    }
    /* Checked */
    .navi_radio[data-checked] .navi_radio_border {
      stroke: var(--border-color-checked);
    }
    .navi_radio[data-checked] .navi_radio_marker {
      opacity: 1;
      transform: scale(1);
    }
    .navi_radio[data-hover][data-checked] .navi_radio_border {
      stroke: var(--border-color-checked-hover);
    }
    /* Readonly */
    .navi_radio[data-readonly] .navi_radio_border {
      fill: var(--background-color-readonly);
      stroke: var(--border-color-readonly);
    }
    .navi_radio[data-readonly] .navi_radio_marker {
      fill: var(--mark-color-readonly);
    }
    .navi_radio[data-readonly] .navi_radio_dashed_border {
      display: none;
    }
    .navi_radio[data-checked][data-readonly] .navi_radio_border {
      fill: var(--background-color-checked-readonly);
      stroke: var(--border-color-checked-readonly);
    }
    .navi_radio[data-checked][data-readonly] .navi_radio_marker {
      fill: var(--mark-color-readonly);
    }
    /* Disabled */
    .navi_radio[data-disabled] .navi_radio_border {
      fill: var(--background-color-disabled);
      stroke: var(--border-color-disabled);
    }
    .navi_radio[data-disabled] .navi_radio_marker {
      fill: var(--mark-color-disabled);
    }
    .navi_radio[data-hover][data-checked][data-disabled] .navi_radio_border {
      stroke: var(--border-color-disabled);
    }
    .navi_radio[data-checked][data-disabled] .navi_radio_marker {
      fill: var(--mark-color-disabled);
    }
  }
`;
const InputRadio = forwardRef((props, ref) => {
  const {
    value = "on"
  } = props;
  const uiStateController = useUIStateController(props, "radio", {
    statePropName: "checked",
    fallbackState: false,
    getStateFromProp: checked => checked ? value : undefined,
    getPropFromState: Boolean
  });
  const uiState = useUIState(uiStateController);
  const radio = renderActionableComponent(props, ref, {
    Basic: InputRadioBasic,
    WithAction: InputRadioWithAction,
    InsideForm: InputRadioInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: radio
    })
  });
});
const InputRadioBasic = forwardRef((props, ref) => {
  const contextName = useContext(FieldNameContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextRequired = useContext(RequiredContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const reportDisabledOnLabel = useContext(ReportDisabledOnLabelContext);
  const {
    name,
    readOnly,
    disabled,
    required,
    loading,
    autoFocus,
    constraints = [],
    appeareance = "navi",
    // "navi" or "default"
    accentColor,
    onClick,
    onInput,
    style,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const innerName = name || contextName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading = loading || contextLoading && contextLoadingElement === innerRef.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const checked = Boolean(uiState);
  // we must first dispatch an event to inform all other radios they where unchecked
  // this way each other radio uiStateController knows thery are unchecked
  // we do this on "input"
  // but also when we are becoming checked from outside (hence the useLayoutEffect)
  const updateOtherRadiosInGroup = () => {
    const thisRadio = innerRef.current;
    const radioList = thisRadio.closest("[data-radio-list]");
    if (!radioList) {
      return;
    }
    const radioInputs = radioList.querySelectorAll(`input[type="radio"][name="${thisRadio.name}"]`);
    for (const radioInput of radioInputs) {
      if (radioInput === thisRadio) {
        continue;
      }
      radioInput.dispatchEvent(new CustomEvent("setuistate", {
        detail: false
      }));
    }
  };
  useLayoutEffect(() => {
    if (checked) {
      updateOtherRadiosInGroup();
    }
  }, [checked]);
  const actionName = rest["data-action"];
  if (actionName) {
    delete rest["data-action"];
  }
  const inputRadio = jsx("input", {
    ...rest,
    ref: innerRef,
    type: "radio",
    style: appeareance === "default" ? style : undefined,
    name: innerName,
    checked: checked,
    disabled: innerDisabled,
    required: innerRequired,
    "data-callout-arrow-x": "center",
    onClick: e => {
      if (innerReadOnly) {
        e.preventDefault();
      }
      onClick?.(e);
    },
    onInput: e => {
      const radio = e.target;
      const radioIsChecked = radio.checked;
      if (radioIsChecked) {
        updateOtherRadiosInGroup();
      }
      uiStateController.setUIState(radioIsChecked, e);
      onInput?.(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onsetuistate: e => {
      uiStateController.setUIState(e.detail.value, e);
    }
  });
  const loaderProps = {
    loading: innerLoading,
    inset: -1,
    style: {
      "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)"
    },
    color: "var(--accent-color)"
  };
  if (appeareance === "navi") {
    return jsx(NaviRadio, {
      "data-action": actionName,
      inputRef: innerRef,
      accentColor: accentColor,
      readOnly: innerReadOnly,
      disabled: innerDisabled,
      style: style,
      children: jsx(LoaderBackground, {
        ...loaderProps,
        targetSelector: ".navi_radio_field",
        children: inputRadio
      })
    });
  }
  return jsx(LoadableInlineElement, {
    ...loaderProps,
    "data-action": actionName,
    children: inputRadio
  });
});
const NaviRadio = ({
  inputRef,
  accentColor,
  readOnly,
  disabled,
  style,
  children,
  ...rest
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    return initCustomField(ref.current, inputRef.current);
  }, []);
  return jsxs("span", {
    ...rest,
    ref: ref,
    className: "navi_radio",
    style: {
      ...(accentColor ? {
        "--accent-color": accentColor
      } : {}),
      ...style
    },
    "data-readonly": readOnly ? "" : undefined,
    "data-disabled": disabled ? "" : undefined,
    children: [children, jsx("span", {
      className: "navi_radio_field",
      children: jsxs("svg", {
        viewBox: "0 0 12 12",
        "aria-hidden": "true",
        preserveAspectRatio: "xMidYMid meet",
        children: [jsx("circle", {
          className: "navi_radio_border",
          cx: "6",
          cy: "6",
          r: "5.5",
          strokeWidth: "1"
        }), jsx("circle", {
          className: "navi_radio_dashed_border",
          cx: "6",
          cy: "6",
          r: "5.5",
          strokeWidth: "1",
          strokeDasharray: "2.16 2.16",
          strokeDashoffset: "0"
        }), jsx("circle", {
          className: "navi_radio_marker",
          cx: "6",
          cy: "6",
          r: "3.5"
        })]
      })
    })]
  });
};
const InputRadioWithAction = () => {
  throw new Error(`<Input type="radio" /> with an action make no sense. Use <RadioList action={something} /> instead`);
};
const InputRadioInsideForm = InputRadio;

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_input {
      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));
      --padding-x: 6px;
      --padding-y: 1px;

      --outline-color: light-dark(#4476ff, #3b82f6);

      --border-radius: 2px;
      --border-color: light-dark(#767676, #8e8e93);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 45%,
        transparent
      );
      --border-color-disabled: var(--border-color-readonly);

      --background-color: white;
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --background-color-readonly: var(--background-color);
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 60%,
        transparent
      );

      --color: currentColor;
      --color-readonly: color-mix(in srgb, currentColor 60%, transparent);
      --color-disabled: var(--color-readonly);
      color: var(--color);

      background-color: var(--background-color);
      border-width: var(--outer-width);
      border-width: var(--outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--border-radius);
      outline-width: var(--border-width);
      outline-style: solid;
      outline-color: var(--border-color);
      outline-offset: calc(-1 * (var(--border-width)));
    }
    /* Focus */
    .navi_input[data-focus] {
      border-color: var(--outline-color);
      outline-width: var(--outer-width);
      outline-color: var(--outline-color);
      outline-offset: calc(-1 * var(--outer-width));
    }
    /* Readonly */
    .navi_input[data-readonly] {
      color: var(--color-readonly);
      background-color: var(--background-color-readonly);
      outline-color: var(--border-color-readonly);
    }
    .navi_input[data-readonly]::placeholder {
      color: var(--color-readonly);
    }
    /* Disabled */
    .navi_input[data-disabled] {
      color: var(--color-disabled);
      background-color: var(--background-color-disabled);
      outline-color: var(--border-color-disabled);
    }
    /* Callout (info, warning, error) */
    .navi_input[data-callout] {
      border-color: var(--callout-color);
    }
  }
`;
const InputTextual = forwardRef((props, ref) => {
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);
  const input = renderActionableComponent(props, ref, {
    Basic: InputTextualBasic,
    WithAction: InputTextualWithAction,
    InsideForm: InputTextualInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: input
    })
  });
});
const InputTextualBasic = forwardRef((props, ref) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    type,
    onInput,
    readOnly,
    disabled,
    constraints = [],
    loading,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    appearance = "navi",
    accentColor,
    style,
    width,
    height,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const innerValue = type === "datetime-local" ? convertToLocalTimezone(uiState) : uiState;
  const innerLoading = loading || contextLoading && contextLoadingElement === innerRef.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state
  reportReadOnlyOnLabel?.(innerReadOnly);
  useAutoFocus(innerRef, autoFocus, {
    autoFocusVisible,
    autoSelect
  });
  useConstraints(innerRef, constraints);
  const innerStyle = {
    ...style
  };
  if (width !== undefined) {
    innerStyle.width = width;
  }
  if (height !== undefined) {
    innerStyle.height = height;
  }
  const inputTextual = jsx("input", {
    ...rest,
    ref: innerRef,
    className: appearance === "navi" ? "navi_input" : undefined,
    style: innerStyle,
    type: type,
    "data-value": uiState,
    value: innerValue,
    readOnly: innerReadOnly,
    disabled: innerDisabled,
    "data-readOnly": innerReadOnly ? "" : undefined,
    "data-disabled": innerDisabled ? "" : undefined,
    onInput: e => {
      let inputValue;
      if (type === "number") {
        inputValue = e.target.valueAsNumber;
      } else if (type === "datetime-local") {
        inputValue = convertToUTCTimezone(e.target.value);
      } else {
        inputValue = e.target.value;
      }
      uiStateController.setUIState(inputValue, e);
      onInput?.(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onsetuistate: e => {
      uiStateController.setUIState(e.detail.value, e);
    }
  });
  useLayoutEffect(() => {
    return initCustomField(innerRef.current, innerRef.current);
  }, []);
  if (type === "hidden") {
    return inputTextual;
  }
  return jsx(LoadableInlineElement, {
    loading: innerLoading,
    style: {
      "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)"
    },
    color: "var(--accent-color)",
    width: width,
    height: height,
    inset: -1,
    children: inputTextual
  });
});
const InputTextualWithAction = forwardRef((props, ref) => {
  const uiState = useContext(UIStateContext);
  const {
    action,
    loading,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    onInput,
    onKeyDown,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  const valueAtInteractionRef = useRef(null);
  useOnInputChange(innerRef, e => {
    if (valueAtInteractionRef.current !== null && e.target.value === valueAtInteractionRef.current) {
      valueAtInteractionRef.current = null;
      return;
    }
    requestAction(e.target, boundAction, {
      event: e,
      actionOrigin: "action_prop"
    });
  });
  // here updating the input won't call the associated action
  // (user have to blur or press enter for this to happen)
  // so we can keep the ui state on cancel/abort/error and let user decide
  // to update ui state or retry via blur/enter as is
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason.startsWith("blur_invalid")) {
        if (!cancelOnBlurInvalid) {
          return;
        }
        if (
        // error prevent cancellation until the user closes it (or something closes it)
        e.detail.failedConstraintInfo.level === "error" && e.detail.failedConstraintInfo.reportStatus !== "closed") {
          return;
        }
      }
      if (reason === "escape_key") {
        if (!cancelOnEscape) {
          return;
        }
        /**
         * Browser trigger a "change" event right after the escape is pressed
         * if the input value has changed.
         * We need to prevent the next change event otherwise we would request action when
         * we actually want to cancel
         */
        valueAtInteractionRef.current = e.target.value;
      }
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd
  });
  return jsx(InputTextualBasic, {
    "data-action": boundAction.name,
    ...rest,
    ref: innerRef,
    loading: loading || actionLoading,
    onInput: e => {
      valueAtInteractionRef.current = null;
      onInput?.(e);
    },
    onKeyDown: e => {
      if (e.key !== "Enter") {
        return;
      }
      e.preventDefault();
      /**
       * Browser trigger a "change" event right after the enter is pressed
       * if the input value has changed.
       * We need to prevent the next change event otherwise we would request action twice
       */
      valueAtInteractionRef.current = e.target.value;
      requestAction(e.target, boundAction, {
        event: e,
        actionOrigin: "action_prop"
      });
      onKeyDown?.(e);
    }
  });
});
const InputTextualInsideForm = forwardRef((props, ref) => {
  const {
    onKeyDown,
    // We destructure formContext to avoid passing it to the underlying input element
    // eslint-disable-next-line no-unused-vars
    formContext,
    ...rest
  } = props;
  return jsx(InputTextualBasic, {
    ...rest,
    ref: ref,
    onKeyDown: e => {
      if (e.key === "Enter") {
        const inputElement = e.target;
        const {
          form
        } = inputElement;
        const formSubmitButton = form.querySelector("button[type='submit'], input[type='submit'], input[type='image']");
        e.preventDefault();
        form.dispatchEvent(new CustomEvent("actionrequested", {
          detail: {
            requester: formSubmitButton ? formSubmitButton : inputElement,
            event: e,
            meta: {
              isSubmit: true
            },
            actionOrigin: "action_prop"
          }
        }));
      }
      onKeyDown?.(e);
    }
  });
});
const useOnInputChange = (inputRef, callback) => {
  // we must use a custom event listener because preact bind onChange to onInput for compat with react
  useEffect(() => {
    const input = inputRef.current;
    input.addEventListener("change", callback);
    return () => {
      input.removeEventListener("change", callback);
    };
  }, [callback]);

  // Handle programmatic value changes that don't trigger browser change events
  //
  // Problem: When input values are set programmatically (not by user typing),
  // browsers don't fire the 'change' event. However, our application logic
  // still needs to detect these changes.
  //
  // Example scenario:
  // 1. User starts editing (letter key pressed, value set programmatically)
  // 2. User doesn't type anything additional (this is the key part)
  // 3. User clicks outside to finish editing
  // 4. Without this code, no change event would fire despite the fact that the input value did change from its original state
  //
  // This distinction is crucial because:
  //
  // - If the user typed additional text after the initial programmatic value,
  //   the browser would fire change events normally
  // - But when they don't type anything else, the browser considers it as "no user interaction"
  //   even though the programmatic initial value represents a meaningful change
  const valueAtStartRef = useRef();
  const interactedRef = useRef(false);
  useLayoutEffect(() => {
    const input = inputRef.current;
    valueAtStartRef.current = input.value;
    const onfocus = () => {
      interactedRef.current = false;
      valueAtStartRef.current = input.value;
    };
    const oninput = e => {
      if (!e.isTrusted) {
        // non trusted "input" events will be ignored by the browser when deciding to fire "change" event
        // we ignore them too
        return;
      }
      interactedRef.current = true;
    };
    const onblur = e => {
      if (interactedRef.current) {
        return;
      }
      if (valueAtStartRef.current === input.value) {
        return;
      }
      callback(e);
    };
    input.addEventListener("focus", onfocus);
    input.addEventListener("input", oninput);
    input.addEventListener("blur", onblur);
    return () => {
      input.removeEventListener("focus", onfocus);
      input.removeEventListener("input", oninput);
      input.removeEventListener("blur", onblur);
    };
  }, []);
};
// As explained in https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local#setting_timezones
// datetime-local does not support timezones
const convertToLocalTimezone = dateTimeString => {
  const date = new Date(dateTimeString);
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return dateTimeString;
  }

  // Format to YYYY-MM-DDThh:mm:ss
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};
/**
 * Converts a datetime string without timezone (local time) to UTC format with 'Z' notation
 *
 * @param {string} localDateTimeString - Local datetime string without timezone (e.g., "2023-07-15T14:30:00")
 * @returns {string} Datetime string in UTC with 'Z' notation (e.g., "2023-07-15T12:30:00Z")
 */
const convertToUTCTimezone = localDateTimeString => {
  if (!localDateTimeString) {
    return localDateTimeString;
  }
  try {
    // Create a Date object using the local time string
    // The browser will interpret this as local timezone
    const localDate = new Date(localDateTimeString);

    // Check if the date is valid
    if (isNaN(localDate.getTime())) {
      return localDateTimeString;
    }

    // Convert to UTC ISO string
    const utcString = localDate.toISOString();

    // Return the UTC string (which includes the 'Z' notation)
    return utcString;
  } catch (error) {
    console.error("Error converting local datetime to UTC:", error);
    return localDateTimeString;
  }
};

const Input = forwardRef((props, ref) => {
  const {
    type
  } = props;
  if (type === "radio") {
    return jsx(InputRadio, {
      ...props,
      ref: ref
    });
  }
  if (type === "checkbox") {
    return jsx(InputCheckbox, {
      ...props,
      ref: ref
    });
  }
  return jsx(InputTextual, {
    ...props,
    ref: ref
  });
});

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_editable_wrapper {
    position: absolute;
    inset: 0;
  }
`;
const useEditionController = () => {
  const [editing, editingSetter] = useState(null);
  const startEditing = useCallback(event => {
    editingSetter(current => {
      return current || {
        event
      };
    });
  }, []);
  const stopEditing = useCallback(() => {
    editingSetter(null);
  }, []);
  const prevEditingRef = useRef(editing);
  const editionJustEnded = prevEditingRef.current && !editing;
  prevEditingRef.current = editing;
  return {
    editing,
    startEditing,
    stopEditing,
    editionJustEnded
  };
};
const Editable = forwardRef((props, ref) => {
  let {
    children,
    action,
    editing,
    name,
    value,
    valueSignal,
    onEditEnd,
    constraints,
    type,
    required,
    readOnly,
    min,
    max,
    step,
    minLength,
    maxLength,
    pattern,
    wrapperProps,
    autoSelect = true,
    width,
    height,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  if (valueSignal) {
    value = valueSignal.value;
  }
  const editingPreviousRef = useRef(editing);
  const valueWhenEditStartRef = useRef(editing ? value : undefined);
  if (editingPreviousRef.current !== editing) {
    if (editing) {
      valueWhenEditStartRef.current = value; // Always store the external value
    }
    editingPreviousRef.current = editing;
  }

  // Simulate typing the initial value when editing starts with a custom value
  useLayoutEffect(() => {
    if (!editing) {
      return;
    }
    const editingEvent = editing.event;
    if (!editingEvent) {
      return;
    }
    const editingEventInitialValue = editingEvent.detail?.initialValue;
    if (editingEventInitialValue === undefined) {
      return;
    }
    const input = innerRef.current;
    input.value = editingEventInitialValue;
    input.dispatchEvent(new CustomEvent("input", {
      bubbles: false
    }));
  }, [editing]);
  const input = jsx(Input, {
    ref: innerRef,
    ...rest,
    type: type,
    name: name,
    value: value,
    valueSignal: valueSignal,
    autoFocus: true,
    autoFocusVisible: true,
    autoSelect: autoSelect,
    cancelOnEscape: true,
    cancelOnBlurInvalid: true,
    constraints: constraints,
    required: required,
    readOnly: readOnly,
    min: min,
    max: max,
    step: step,
    minLength: minLength,
    maxLength: maxLength,
    pattern: pattern,
    width: width,
    height: height,
    onCancel: e => {
      if (valueSignal) {
        valueSignal.value = valueWhenEditStartRef.current;
      }
      onEditEnd({
        cancelled: true,
        event: e
      });
    },
    onBlur: e => {
      const value = type === "number" ? e.target.valueAsNumber : e.target.value;
      const valueWhenEditStart = valueWhenEditStartRef.current;
      if (value === valueWhenEditStart) {
        onEditEnd({
          cancelled: true,
          event: e
        });
        return;
      }
    },
    action: action || (() => {}),
    onActionEnd: e => {
      onEditEnd({
        success: true,
        event: e
      });
    }
  });
  return jsxs(Fragment, {
    children: [children || jsx("span", {
      children: value
    }), editing && jsx("div", {
      ...wrapperProps,
      className: ["navi_editable_wrapper", ...(wrapperProps?.className || "").split(" ")].join(" "),
      children: input
    })]
  });
});

const useFormEvents = (
  elementRef,
  {
    onFormReset,
    onFormActionPrevented,
    onFormActionStart,
    onFormActionAbort,
    onFormActionError,
    onFormActionEnd,
  },
) => {
  onFormReset = useStableCallback(onFormReset);
  onFormActionPrevented = useStableCallback(onFormActionPrevented);
  onFormActionStart = useStableCallback(onFormActionStart);
  onFormActionAbort = useStableCallback(onFormActionAbort);
  onFormActionError = useStableCallback(onFormActionError);
  onFormActionEnd = useStableCallback(onFormActionEnd);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    let form = element.form;
    if (!form) {
      // some non input elements may want to listen form events (<RadioList> is a <div>)
      form = element.closest("form");
      if (!form) {
        console.warn("No form found for element", element);
        return null;
      }
    }
    return addManyEventListeners(form, {
      reset: onFormReset,
      actionprevented: onFormActionPrevented,
      actionstart: onFormActionStart,
      actionabort: onFormActionAbort,
      actionerror: onFormActionError,
      actionend: onFormActionEnd,
    });
  }, [
    onFormReset,
    onFormActionPrevented,
    onFormActionStart,
    onFormActionAbort,
    onFormActionError,
    onFormActionEnd,
  ]);
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_button {
      position: relative;
      display: inline-block;
      padding: 0;
      background: none;
      border: none;
      outline: none;

      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));
      --padding-x: 6px;
      --padding-y: 1px;

      --outline-color: light-dark(#4476ff, #3b82f6);

      --border-radius: 2px;
      --border-color: light-dark(#767676, #8e8e93);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);

      --background-color: light-dark(#f3f4f6, #2d3748);
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --background-color-readonly: var(--background-color);
      --background-color-disabled: var(--background-color);

      --color: currentColor;
      --color-readonly: color-mix(in srgb, currentColor 30%, transparent);
      --color-disabled: var(--color-readonly);
    }
    .navi_button_content {
      position: relative;
      display: inline-flex;
      padding-top: var(--padding-y);
      padding-right: var(--padding-x);
      padding-bottom: var(--padding-y);
      padding-left: var(--padding-x);
      color: var(--color);
      background-color: var(--background-color);
      border-width: var(--outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--border-radius);
      outline-width: var(--border-width);
      outline-style: solid;
      outline-color: var(--border-color);
      outline-offset: calc(-1 * (var(--border-width)));
      transition-property: transform;
      transition-duration: 0.15s;
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    .navi_button_shadow {
      position: absolute;
      inset: calc(-1 * var(--outer-width));
      border-radius: inherit;
      pointer-events: none;
    }
    /* Focus */
    .navi_button[data-focus-visible] .navi_button_content {
      --border-color: var(--outline-color);
      outline-width: var(--outer-width);
      outline-offset: calc(-1 * var(--outer-width));
    }
    /* Hover */
    .navi_button[data-hover] .navi_button_content {
      --border-color: var(--border-color-hover);
      --background-color: var(--background-color-hover);
    }
    /* Active */
    .navi_button[data-active] .navi_button_content {
      --outline-color: var(--border-color-active);
      --background-color: none;
      transform: scale(0.9);
    }
    .navi_button[data-active] .navi_button_shadow {
      box-shadow:
        inset 0 3px 6px rgba(0, 0, 0, 0.2),
        inset 0 1px 2px rgba(0, 0, 0, 0.3),
        inset 0 0 0 1px rgba(0, 0, 0, 0.1),
        inset 2px 0 4px rgba(0, 0, 0, 0.1),
        inset -2px 0 4px rgba(0, 0, 0, 0.1);
    }
    /* Readonly */
    .navi_button[data-readonly] .navi_button_content {
      --border-color: var(--border-color-disabled);
      --outline-color: var(--border-color-readonly);
      --background-color: var(--background-color-readonly);
      --color: var(--color-readonly);
    }
    /* Disabled */
    .navi_button[data-disabled] .navi_button_content {
      --border-color: var(--border-color-disabled);
      --background-color: var(--background-color-disabled);
      --color: var(--color-disabled);
      transform: none; /* no active effect */
    }
    .navi_button[data-disabled] .navi_button_shadow {
      box-shadow: none;
    }
    /* Callout (info, warning, error) */
    .navi_button[data-callout] .navi_button_content {
      --border-color: var(--callout-color);
    }

    /* Discrete variant */
    .navi_button[data-discrete] .navi_button_content {
      --background-color: transparent;
      --border-color: transparent;
    }
    .navi_button[data-discrete][data-hover] .navi_button_content {
      --border-color: var(--border-color-hover);
    }
    .navi_button[data-discrete][data-readonly] .navi_button_content {
      --border-color: transparent;
    }
    .navi_button[data-discrete][data-disabled] .navi_button_content {
      --border-color: transparent;
    }
    button[data-discrete] {
      background-color: transparent;
      border-color: transparent;
    }
    button[data-discrete]:hover {
      border-color: revert;
    }
    button[data-discrete][data-readonly],
    button[data-discrete][data-disabled] {
      border-color: transparent;
    }
  }
`;
const Button = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: ButtonBasic,
    WithAction: ButtonWithAction,
    InsideForm: ButtonInsideForm,
    WithActionInsideForm: ButtonWithActionInsideForm
  });
});
const ButtonBasic = forwardRef((props, ref) => {
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const {
    readOnly,
    disabled,
    loading,
    constraints = [],
    autoFocus,
    appearance = "navi",
    discrete,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const innerLoading = loading || contextLoading && contextLoadingElement === innerRef.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;
  let buttonChildren;
  if (appearance === "navi") {
    buttonChildren = jsx(NaviButton, {
      buttonRef: innerRef,
      children: children
    });
  } else {
    buttonChildren = children;
  }
  return jsx("button", {
    ...rest,
    ref: innerRef,
    className: appearance === "navi" ? "navi_button" : undefined,
    "data-discrete": discrete ? "" : undefined,
    "data-readonly": innerReadOnly ? "" : undefined,
    "data-readonly-silent": innerLoading ? "" : undefined,
    "data-disabled": innerDisabled ? "" : undefined,
    "data-callout-arrow-x": "center",
    "aria-busy": innerLoading,
    children: jsx(LoaderBackground, {
      loading: innerLoading,
      inset: -1,
      color: "light-dark(#355fcc, #3b82f6)",
      children: buttonChildren
    })
  });
});
const NaviButton = ({
  buttonRef,
  children
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    return initCustomField(buttonRef.current, buttonRef.current);
  }, []);
  return jsxs("span", {
    ref: ref,
    className: "navi_button_content",
    children: [children, jsx("span", {
      className: "navi_button_shadow"
    })]
  });
};
const ButtonWithAction = forwardRef((props, ref) => {
  const {
    action,
    loading,
    onClick,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const boundAction = useAction(action);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd
  });
  const handleClick = event => {
    event.preventDefault();
    const button = innerRef.current;
    requestAction(button, boundAction, {
      event,
      actionOrigin: "action_prop"
    });
  };
  const innerLoading = loading || actionLoading;
  return jsx(ButtonBasic
  // put data-action first to help find it in devtools
  , {
    "data-action": boundAction.name,
    ...rest,
    ref: innerRef,
    loading: innerLoading,
    onClick: event => {
      handleClick(event);
      onClick?.(event);
    },
    children: children
  });
});
const ButtonInsideForm = forwardRef((props, ref) => {
  const {
    // eslint-disable-next-line no-unused-vars
    formContext,
    type,
    onClick,
    children,
    loading,
    readOnly,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const wouldSubmitFormByType = type === "submit" || type === "image";
  const innerLoading = loading;
  const innerReadOnly = readOnly;
  const handleClick = event => {
    const buttonElement = innerRef.current;
    const {
      form
    } = buttonElement;
    let wouldSubmitForm = wouldSubmitFormByType;
    if (!wouldSubmitForm && type === undefined) {
      const formSubmitButton = form.querySelector("button[type='submit'], input[type='submit'], input[type='image']");
      const wouldSubmitFormBecauseSingleButtonWithoutType = !formSubmitButton;
      wouldSubmitForm = wouldSubmitFormBecauseSingleButtonWithoutType;
    }
    if (!wouldSubmitForm) {
      if (buttonElement.hasAttribute("data-readonly")) {
        event.preventDefault();
      }
      return;
    }
    // prevent default behavior that would submit the form
    // we want to go through the action execution process (with validation and all)
    event.preventDefault();
    form.dispatchEvent(new CustomEvent("actionrequested", {
      detail: {
        requester: buttonElement,
        event,
        meta: {
          isSubmit: true
        },
        actionOrigin: "action_prop"
      }
    }));
  };
  return jsx(ButtonBasic, {
    ...rest,
    ref: innerRef,
    type: type,
    loading: innerLoading,
    readOnly: innerReadOnly,
    onClick: event => {
      handleClick(event);
      onClick?.(event);
    },
    children: children
  });
});
const ButtonWithActionInsideForm = forwardRef((props, ref) => {
  const formAction = useContext(FormActionContext);
  const {
    // eslint-disable-next-line no-unused-vars
    formContext,
    // to avoid passing it to the button element
    type,
    action,
    loading,
    children,
    onClick,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    ...rest
  } = props;
  const formParamsSignal = getActionPrivateProperties(formAction).paramsSignal;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const actionBoundToFormParams = useAction(action, formParamsSignal);
  const {
    loading: actionLoading
  } = useActionStatus(actionBoundToFormParams);
  const innerLoading = loading || actionLoading;
  useFormEvents(innerRef, {
    onFormActionPrevented: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionPrevented?.(e);
      }
    },
    onFormActionStart: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionStart?.(e);
      }
    },
    onFormActionAbort: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionAbort?.(e);
      }
    },
    onFormActionError: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionError?.(e.detail.error);
      }
    },
    onFormActionEnd: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionEnd?.(e);
      }
    }
  });
  return jsx(ButtonBasic, {
    "data-action": actionBoundToFormParams.name,
    ...rest,
    ref: innerRef,
    type: type,
    loading: innerLoading,
    onClick: event => {
      const button = innerRef.current;
      const form = button.form;
      event.preventDefault();
      requestAction(form, actionBoundToFormParams, {
        event,
        requester: button,
        actionOrigin: "action_prop"
      });
      onClick?.(event);
    },
    children: children
  });
});

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_checkbox_list {
      display: flex;
      flex-direction: column;
    }
  }
`;
const CheckboxList = forwardRef((props, ref) => {
  const uiStateController = useUIGroupStateController(props, "checkbox_list", {
    childComponentType: "checkbox",
    aggregateChildStates: childUIStateControllers => {
      const values = [];
      for (const childUIStateController of childUIStateControllers) {
        if (childUIStateController.uiState) {
          values.push(childUIStateController.uiState);
        }
      }
      return values.length === 0 ? undefined : values;
    }
  });
  const uiState = useUIState(uiStateController);
  const checkboxList = renderActionableComponent(props, ref, {
    Basic: CheckboxListBasic,
    WithAction: CheckboxListWithAction,
    InsideForm: CheckboxListInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: checkboxList
    })
  });
});
const Checkbox = InputCheckbox;
const CheckboxListBasic = forwardRef((props, ref) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  const {
    name,
    readOnly,
    disabled,
    required,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const innerLoading = loading || contextLoading;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  return jsx("div", {
    ...rest,
    ref: innerRef,
    name: name,
    className: "navi_checkbox_list",
    "data-checkbox-list": true
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    },
    children: jsx(ParentUIStateControllerContext.Provider, {
      value: uiStateController,
      children: jsx(FieldNameContext.Provider, {
        value: name,
        children: jsx(ReadOnlyContext.Provider, {
          value: innerReadOnly,
          children: jsx(DisabledContext.Provider, {
            value: innerDisabled,
            children: jsx(RequiredContext.Provider, {
              value: required,
              children: jsx(LoadingContext.Provider, {
                value: innerLoading,
                children: children
              })
            })
          })
        })
      })
    })
  });
});
const CheckboxListWithAction = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    actionErrorEffect,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [boundAction] = useActionBoundToOneArrayParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  const [actionRequester, setActionRequester] = useState(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: actionEvent => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: e => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: e => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: e => {
      onActionEnd?.(e);
    }
  });
  return jsx(CheckboxListBasic, {
    "data-action": boundAction.name,
    ...rest,
    ref: innerRef,
    onChange: event => {
      const checkboxList = innerRef.current;
      const checkbox = event.target;
      requestAction(checkboxList, boundAction, {
        event,
        requester: checkbox,
        actionOrigin: "action_prop"
      });
    },
    loading: loading || actionLoading,
    children: jsx(LoadingElementContext.Provider, {
      value: actionRequester,
      children: children
    })
  });
});
const CheckboxListInsideForm = CheckboxListBasic;

const collectFormElementValues = (element) => {
  let formElements;
  if (element.tagName === "FORM") {
    formElements = element.elements;
  } else {
    // fieldset or anything else
    formElements = element.querySelectorAll(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[name]:not([disabled])",
    );
  }

  const values = {};
  const checkboxArrayNameSet = new Set();
  for (const formElement of formElements) {
    if (formElement.type === "checkbox" && formElement.name) {
      const name = formElement.name;
      const endsWithBrackets = name.endsWith("[]");
      if (endsWithBrackets) {
        checkboxArrayNameSet.add(name);
        values[name] = [];
        continue;
      }
      const closestDataCheckboxList = formElement.closest(
        "[data-checkbox-list]",
      );
      if (closestDataCheckboxList) {
        checkboxArrayNameSet.add(name);
        values[name] = [];
      }
    }
  }

  for (const formElement of formElements) {
    const name = formElement.name;
    if (!name) {
      continue;
    }
    const value = getFormElementValue(formElement);
    if (value === undefined) {
      continue; // Skip unchecked checkboxes/radios
    }
    if (formElement.type === "checkbox" && checkboxArrayNameSet.has(name)) {
      values[name].push(value);
    } else {
      values[name] = value;
    }
  }
  return values;
};

const getFormElementValue = (formElement) => {
  const { type, tagName } = formElement;

  if (tagName === "SELECT") {
    if (formElement.multiple) {
      return Array.from(formElement.selectedOptions, (option) =>
        getValue(option),
      );
    }
    return formElement.value;
  }

  if (type === "checkbox" || type === "radio") {
    return formElement.checked ? getValue(formElement) : undefined;
  }

  if (type === "file") {
    return formElement.files; // Return FileList for special handling
  }

  return getValue(formElement);
};

const getValue = (formElement) => {
  const hasDataValueAttribute = formElement.hasAttribute("data-value");
  if (hasDataValueAttribute) {
    // happens for "datetime-local" inputs to keep the timezone
    // consistent when sending to the server
    return formElement.getAttribute("data-value");
  }
  return formElement.value;
};

/**
 *
 * Here we want the same behaviour as web standards:
 *
 * 1. When submitting the form URL does not change
 * 2. When form submission id done user is redirected (by default the current one)
 *    (we can configure this using target)
 *    So for example user might be reidrect to a page with the resource he just created
 *    I could create an example where we would put a link on the page to let user see what he created
 *    but by default user stays on the form allowing to create multiple resources at once
 *    And an other where he is redirected to the resource he created
 * 3. If form submission fails ideally we should display this somewhere on the UI
 *    right now it's just logged to the console I need to see how we can achieve this
 */

const Form = forwardRef((props, ref) => {
  const uiStateController = useUIGroupStateController(props, "form", {
    childComponentType: "*",
    aggregateChildStates: childUIStateControllers => {
      const formValues = {};
      for (const childUIStateController of childUIStateControllers) {
        const {
          name,
          uiState
        } = childUIStateController;
        if (!name) {
          console.warn("A form child component is missing a name property, its state won't be included in the form state", childUIStateController);
          continue;
        }
        formValues[name] = uiState;
      }
      return formValues;
    }
  });
  const uiState = useUIState(uiStateController);
  const form = renderActionableComponent(props, ref, {
    Basic: FormBasic,
    WithAction: FormWithAction
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: form
    })
  });
});
const FormBasic = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const {
    readOnly,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  // instantiation validation to:
  // - receive "requestsubmit" custom event ensure submit is prevented
  // (and also execute action without validation if form.submit() is ever called)
  useConstraints(innerRef, []);
  const innerReadOnly = readOnly || loading;
  const formContextValue = useMemo(() => {
    return {
      loading
    };
  }, [loading]);
  return jsx("form", {
    ...rest,
    ref: innerRef,
    onReset: e => {
      // browser would empty all fields to their default values (likely empty/unchecked)
      // we want to reset to the last known external state instead
      e.preventDefault();
      uiStateController.resetUIState(e);
    },
    children: jsx(ParentUIStateControllerContext.Provider, {
      value: uiStateController,
      children: jsx(ReadOnlyContext.Provider, {
        value: innerReadOnly,
        children: jsx(LoadingContext.Provider, {
          value: loading,
          children: jsx(FormContext.Provider, {
            value: formContextValue,
            children: children
          })
        })
      })
    })
  });
});
const FormWithAction = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    method,
    actionErrorEffect = "show_validation_message",
    // "show_validation_message" or "throw"
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  const {
    actionPending,
    actionRequester: formActionRequester
  } = useRequestedActionStatus(innerRef);
  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onRequested: e => {
      const form = innerRef.current;
      requestAction(form, actionBoundToUIState, {
        requester: e.detail?.requester,
        event: e.detail?.event || e,
        meta: e.detail?.meta,
        actionOrigin: e.detail?.actionOrigin
      });
    },
    onAction: e => {
      const form = innerRef.current;
      const formElementValues = collectFormElementValues(form);
      uiStateController.setUIState(formElementValues, e);
      executeAction(e);
    },
    onStart: onActionStart,
    onAbort: e => {
      // user might want to re-submit as is
      // or change the ui state before re-submitting
      // we can't decide for him
      onActionAbort?.(e);
    },
    onError: e => {
      // user might want to re-submit as is
      // or change the ui state before re-submitting
      // we can't decide for him
      onActionError?.(e);
    },
    onEnd: e => {
      // form side effect is a success
      // we can get rid of the nav state
      // that was keeping the ui state in case user navigates away without submission
      uiStateController.actionEnd(e);
      onActionEnd?.(e);
    }
  });
  const innerLoading = loading || actionPending;
  return jsx(FormBasic, {
    "data-action": actionBoundToUIState.name,
    "data-method": action.meta?.httpVerb || method || "GET",
    ...rest,
    ref: innerRef,
    loading: innerLoading,
    onrequestsubmit: e => {
      // prevent "submit" event that would be dispatched by the browser after form.requestSubmit()
      // (not super important because our <form> listen the "action" and do does preventDefault on "submit")
      e.preventDefault();
      requestAction(e.target, actionBoundToUIState, {
        event: e,
        actionOrigin: "action_prop"
      });
    },
    children: jsx(FormActionContext.Provider, {
      value: actionBoundToUIState,
      children: jsx(LoadingElementContext.Provider, {
        value: formActionRequester,
        children: children
      })
    })
  });
});

// const dispatchCustomEventOnFormAndFormElements = (type, options) => {
//   const form = innerRef.current;
//   const customEvent = new CustomEvent(type, options);
//   // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
//   for (const element of form.elements) {
//     element.dispatchEvent(customEvent);
//   }
//   form.dispatchEvent(customEvent);
// };

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_radio_list {
      display: flex;
      flex-direction: column;
    }
  }
`;
const RadioList = forwardRef((props, ref) => {
  const uiStateController = useUIGroupStateController(props, "radio_list", {
    childComponentType: "radio",
    aggregateChildStates: childUIStateControllers => {
      let activeValue;
      for (const childUIStateController of childUIStateControllers) {
        if (childUIStateController.uiState) {
          activeValue = childUIStateController.uiState;
          break;
        }
      }
      return activeValue;
    }
  });
  const uiState = useUIState(uiStateController);
  const radioList = renderActionableComponent(props, ref, {
    Basic: RadioListBasic,
    WithAction: RadioListWithAction,
    InsideForm: RadioListInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: radioList
    })
  });
});
const Radio = InputRadio;
const RadioListBasic = forwardRef((props, ref) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  const {
    name,
    loading,
    disabled,
    readOnly,
    children,
    required,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const innerLoading = loading || contextLoading;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  return jsx("div", {
    "data-action": rest["data-action"],
    ...rest,
    ref: innerRef,
    className: "navi_radio_list",
    "data-radio-list": true
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    },
    children: jsx(ParentUIStateControllerContext.Provider, {
      value: uiStateController,
      children: jsx(FieldNameContext.Provider, {
        value: name,
        children: jsx(ReadOnlyContext.Provider, {
          value: innerReadOnly,
          children: jsx(DisabledContext.Provider, {
            value: innerDisabled,
            children: jsx(RequiredContext.Provider, {
              value: required,
              children: jsx(LoadingContext.Provider, {
                value: innerLoading,
                children: children
              })
            })
          })
        })
      })
    })
  });
});
const RadioListWithAction = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  const [actionRequester, setActionRequester] = useState(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: actionEvent => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: e => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: e => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: e => {
      onActionEnd?.(e);
    }
  });
  return jsx(RadioListBasic, {
    "data-action": boundAction,
    ...rest,
    ref: innerRef,
    onChange: e => {
      const radio = e.target;
      const radioListContainer = innerRef.current;
      requestAction(radioListContainer, boundAction, {
        event: e,
        requester: radio,
        actionOrigin: "action_prop"
      });
    },
    loading: loading || actionLoading,
    children: jsx(LoadingElementContext.Provider, {
      value: actionRequester,
      children: children
    })
  });
});
const RadioListInsideForm = RadioListBasic;

const useRefArray = (items, keyFromItem) => {
  const refMapRef = useRef(new Map());
  const previousKeySetRef = useRef(new Set());

  return useMemo(() => {
    const refMap = refMapRef.current;
    const previousKeySet = previousKeySetRef.current;
    const currentKeySet = new Set();
    const refArray = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = keyFromItem(item);
      currentKeySet.add(key);

      const refForKey = refMap.get(key);
      if (refForKey) {
        refArray[i] = refForKey;
      } else {
        const newRef = createRef();
        refMap.set(key, newRef);
        refArray[i] = newRef;
      }
    }

    for (const key of previousKeySet) {
      if (!currentKeySet.has(key)) {
        refMap.delete(key);
      }
    }
    previousKeySetRef.current = currentKeySet;

    return refArray;
  }, [items]);
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_select[data-readonly] {
    pointer-events: none;
  }
`;
const Select = forwardRef((props, ref) => {
  const select = renderActionableComponent(props, ref, {
    Basic: SelectBasic,
    WithAction: SelectWithAction,
    InsideForm: SelectInsideForm
  });
  return select;
});
const SelectControlled = forwardRef((props, ref) => {
  const {
    name,
    value,
    loading,
    disabled,
    readOnly,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const selectElement = jsx("select", {
    className: "navi_select",
    ref: innerRef,
    "data-field": "",
    "data-readonly": readOnly && !disabled ? "" : undefined,
    onKeyDown: e => {
      if (readOnly) {
        e.preventDefault();
      }
    },
    ...rest,
    children: children.map(child => {
      const {
        label,
        readOnly: childReadOnly,
        disabled: childDisabled,
        loading: childLoading,
        value: childValue,
        ...childRest
      } = child;
      return jsx("option", {
        name: name,
        value: childValue,
        selected: childValue === value,
        readOnly: readOnly || childReadOnly,
        disabled: disabled || childDisabled,
        loading: loading || childLoading,
        ...childRest,
        children: label
      }, childValue);
    })
  });
  return jsx(LoaderBackground, {
    loading: loading,
    color: "light-dark(#355fcc, #3b82f6)",
    inset: -1,
    children: selectElement
  });
});
const SelectBasic = forwardRef((props, ref) => {
  const {
    value: initialValue,
    id,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const valueAtStart = navState === undefined ? initialValue : navState;
  const [value, setValue] = useState(valueAtStart);
  useEffect(() => {
    setNavState(value);
  }, [value]);
  return jsx(SelectControlled, {
    ref: innerRef,
    value: value,
    onChange: event => {
      const select = event.target;
      const selectedValue = select.value;
      setValue(selectedValue);
    },
    ...rest,
    children: children
  });
});
const SelectWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    valueSignal,
    action,
    children,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState, resetNavState] = useNavState(id);
  const [boundAction, value, setValue, initialValue] = useActionBoundToOneParam(action, name);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  useEffect(() => {
    setNavState(value);
  }, [value]);
  const actionRequesterRef = useRef(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      setValue(initialValue);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: actionEvent => {
      actionRequesterRef.current = actionEvent.detail.requester;
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: e => {
      setValue(initialValue);
      onActionAbort?.(e);
    },
    onError: error => {
      setValue(initialValue);
      onActionError?.(error);
    },
    onEnd: () => {
      resetNavState();
      onActionEnd?.();
    }
  });
  const childRefArray = useRefArray(children, child => child.value);
  return jsx(SelectControlled, {
    ref: innerRef,
    name: name,
    value: value,
    "data-action": boundAction,
    onChange: event => {
      const select = event.target;
      const selectedValue = select.value;
      setValue(selectedValue);
      const radioListContainer = innerRef.current;
      const optionSelected = select.querySelector(`option[value="${selectedValue}"]`);
      requestAction(radioListContainer, boundAction, {
        event,
        requester: optionSelected,
        actionOrigin: "action_prop"
      });
    },
    ...rest,
    children: children.map((child, i) => {
      const childRef = childRefArray[i];
      return {
        ...child,
        ref: childRef,
        loading: child.loading || actionLoading && actionRequesterRef.current === childRef.current,
        readOnly: child.readOnly || actionLoading
      };
    })
  });
});
const SelectInsideForm = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [value, setValue, initialValue] = [name, externalValue, navState];
  useEffect(() => {
    setNavState(value);
  }, [value]);
  useFormEvents(innerRef, {
    onFormReset: () => {
      setValue(undefined);
    },
    onFormActionAbort: () => {
      setValue(initialValue);
    },
    onFormActionError: () => {
      setValue(initialValue);
    }
  });
  return jsx(SelectControlled, {
    ref: innerRef,
    name: name,
    value: value,
    onChange: event => {
      const select = event.target;
      const selectedValue = select.checked;
      setValue(selectedValue);
    },
    ...rest,
    children: children
  });
});

// http://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts
const generateAriaKeyShortcuts = (key) => {
  let actualCombination;

  // Handle platform-specific combination objects
  if (typeof key === "object" && key !== null) {
    actualCombination = isMac ? key.mac : key.other;
  } else {
    actualCombination = key;
  }

  if (actualCombination) {
    return normalizeKeyCombination(actualCombination);
  }

  return "";
};

const normalizeKeyCombination = (combination) => {
  const lowerCaseCombination = combination.toLowerCase();
  const keys = lowerCaseCombination.split("+");

  // First normalize keys to their canonical form, then apply ARIA mapping
  for (let i = 0; i < keys.length; i++) {
    let key = normalizeKey(keys[i]);

    // Then apply ARIA-specific mappings if they exist
    if (keyToAriaKeyMapping[key]) {
      key = keyToAriaKeyMapping[key];
    }

    keys[i] = key;
  }

  return keys.join("+");
};
const keyToAriaKeyMapping = {
  // Platform-specific ARIA names
  command: "meta",
  option: "altgraph", // Mac option key uses "altgraph" in ARIA spec

  // Regular keys - platform-specific normalization
  delete: isMac ? "backspace" : "delete", // Mac delete key is backspace semantically
  backspace: isMac ? "backspace" : "delete",
};
const normalizeKey = (key) => {
  key = key.toLowerCase();

  // Find the canonical form for this key
  for (const [canonicalKey, config] of Object.entries(keyMapping)) {
    const allKeys = [canonicalKey, ...config.alias];
    if (allKeys.includes(key)) {
      return canonicalKey;
    }
  }

  return key;
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_shortcut_container[data-visually-hidden] {
    /* Visually hidden container - doesn't affect layout */
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    /* Ensure it's not interactable */
    opacity: 0;
    pointer-events: none;
  }

  .navi_shortcut_button[data-visually-hidden] {
    /* Visually hidden but accessible to screen readers */
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    /* Ensure it's not focusable via tab navigation */
    opacity: 0;
    pointer-events: none;
  }
`;
const ActiveKeyboardShortcuts = ({
  visible
}) => {
  const activeShortcuts = activeShortcutsSignal.value;
  return jsx("div", {
    className: "navi_shortcut_container",
    "data-visually-hidden": visible ? undefined : "",
    children: activeShortcuts.map(shortcut => {
      return jsx(KeyboardShortcutAriaElement, {
        visible: visible,
        keyCombination: shortcut.key,
        description: shortcut.description,
        enabled: shortcut.enabled,
        "data-action": shortcut.action ? shortcut.action.name : undefined,
        "data-confirm-message": shortcut.confirmMessage
      }, shortcut.key);
    })
  });
};
const KeyboardShortcutAriaElement = ({
  visible,
  keyCombination,
  description,
  enabled,
  ...props
}) => {
  if (typeof keyCombination === "function") {
    return null;
  }
  const ariaKeyshortcuts = generateAriaKeyShortcuts(keyCombination);
  return jsx("button", {
    className: "navi_shortcut_button",
    "data-visually-hidden": visible ? undefined : "",
    "aria-keyshortcuts": ariaKeyshortcuts,
    tabIndex: "-1",
    disabled: !enabled,
    ...props,
    children: description
  });
};

/**
 * Hook that reactively checks if a URL is visited.
 * Re-renders when the visited URL set changes.
 *
 * @param {string} url - The URL to check
 * @returns {boolean} Whether the URL has been visited
 */
const useIsVisited = (url) => {
  return useMemo(() => {
    // Access the signal to create reactive dependency
    // eslint-disable-next-line no-unused-expressions
    visitedUrlsSignal.value;

    return isVisited(url);
  }, [url, visitedUrlsSignal.value]);
};

const DEBUG = {
  registration: false,
  // Element registration/unregistration
  interaction: false,
  // Click and keyboard interactions
  selection: false,
  // Selection state changes (set, add, remove, toggle)
  navigation: false,
  // Arrow key navigation and element finding
  valueExtraction: false // Value extraction from elements
};
const debug = (category, ...args) => {
  if (DEBUG[category]) {
    console.debug(`[selection:${category}]`, ...args);
  }
};
const SelectionContext = createContext();
const useSelectionController = ({
  elementRef,
  layout,
  value,
  onChange,
  multiple,
  selectAllName
}) => {
  if (!elementRef) {
    throw new Error("useSelectionController: elementRef is required");
  }
  onChange = useStableCallback(onChange);
  const currentValueRef = useRef(value);
  currentValueRef.current = value;
  const lastInternalValueRef = useRef(null);
  const selectionController = useMemo(() => {
    const innerOnChange = (newValue, ...args) => {
      lastInternalValueRef.current = newValue;
      onChange?.(newValue, ...args);
    };
    const getCurrentValue = () => currentValueRef.current;
    if (layout === "grid") {
      return createGridSelectionController({
        getCurrentValue,
        onChange: innerOnChange,
        enabled: Boolean(onChange),
        multiple,
        selectAllName
      });
    }
    return createLinearSelectionController({
      getCurrentValue,
      onChange: innerOnChange,
      layout,
      elementRef,
      multiple,
      enabled: Boolean(onChange),
      selectAllName
    });
  }, [layout, multiple, elementRef]);
  useEffect(() => {
    selectionController.element = elementRef.current;
  }, [selectionController]);
  useLayoutEffect(() => {
    selectionController.enabled = Boolean(onChange);
  }, [selectionController, onChange]);

  // Smart sync: only update selection when value changes externally
  useEffect(() => {
    // Check if this is an external change (not from our internal onChange)
    const isExternalChange = !compareTwoJsValues(value, lastInternalValueRef.current);
    if (isExternalChange) {
      selectionController.update(value);
    }
  }, [value, selectionController]);
  return selectionController;
};
// Base Selection - shared functionality between grid and linear
const createBaseSelectionController = ({
  getCurrentValue,
  registry,
  onChange,
  type,
  enabled,
  multiple,
  selectAllName,
  navigationMethods: {
    getElementRange,
    getElementAfter,
    getElementBefore,
    getElementBelow,
    getElementAbove
  }
}) => {
  const [publishChange, subscribeChange] = createPubSub();
  const getElementByValue = valueToFind => {
    for (const element of registry) {
      if (getElementValue(element) === valueToFind) {
        return element;
      }
    }
    return null;
  };
  const update = (newValue, event) => {
    if (!baseSelection.enabled) {
      console.warn("cannot change selection: no onChange provided");
      return;
    }
    const currentValue = getCurrentValue();
    if (compareTwoJsValues(newValue, currentValue)) {
      return;
    }
    const allValues = [];
    for (const element of registry) {
      const value = getElementValue(element);
      allValues.push(value);
    }
    const oldSelectedSet = new Set(currentValue);
    const newSelectedSet = new Set(newValue);
    const willBeUnselectedSet = new Set();
    for (const item of oldSelectedSet) {
      if (!newSelectedSet.has(item)) {
        willBeUnselectedSet.add(item);
      }
    }
    const selectionSet = new Set(newValue);
    for (const newSelected of newSelectedSet) {
      const element = getElementByValue(newSelected);
      if (element._selectionImpact) {
        const impactedValues = element._selectionImpact(allValues);
        for (const impactedValue of impactedValues) {
          selectionSet.add(impactedValue);
        }
      }
    }
    for (const willBeUnselected of willBeUnselectedSet) {
      const element = getElementByValue(willBeUnselected);
      if (element._selectionImpact) {
        const impactedValues = element._selectionImpact(allValues);
        for (const impactedValue of impactedValues) {
          if (selectionSet.has(impactedValue)) {
            // want to be selected -> keep it
            // - might be explicit : initially part of newValue/selectionSet)
            // - or implicit: added to selectionSet by selectionImpact
            continue;
          }
          selectionSet.delete(impactedValue);
        }
      }
    }
    const finalValue = Array.from(selectionSet);
    debug("selection", `${type} setSelection: calling onChange with:`, finalValue);
    onChange(finalValue, event);
    publishChange(finalValue, event);
  };
  let anchorElement = null;
  let activeElement = null;
  const registerElement = (element, options = {}) => {
    const elementValue = getElementValue(element);
    debug("registration", `${type} registerElement:`, element, "value:", elementValue, "registry size before:", registry.size);
    registry.add(element);
    // Store the selectionImpact callback if provided
    if (options.selectionImpact) {
      element._selectionImpact = options.selectionImpact;
    }
    debug("registration", `${type} registerElement: registry size after:`, registry.size);
  };
  const unregisterElement = element => {
    const elementValue = getElementValue(element);
    debug("registration", `${type} unregisterElement:`, element, "value:", elementValue, "registry size before:", registry.size);
    registry.delete(element);
    debug("registration", `${type} unregisterElement: registry size after:`, registry.size);
  };
  const setActiveElement = element => {
    activeElement = element;
  };
  const setAnchorElement = element => {
    const elementValue = getElementValue(element);
    debug("selection", `${type} setAnchorElement:`, element, "value:", elementValue);
    anchorElement = element;
  };
  const isElementSelected = element => {
    const elementValue = getElementValue(element);
    const isSelected = baseSelection.value.includes(elementValue);
    return isSelected;
  };
  const isValueSelected = value => {
    const isSelected = baseSelection.value.includes(value);
    return isSelected;
  };
  // Selection manipulation methods
  const setSelection = (newSelection, event = null) => {
    debug("selection", `${type} setSelection called with:`, newSelection, "current selection:", baseSelection.value);
    if (newSelection.length === baseSelection.value.length && newSelection.every((value, index) => value === baseSelection.value[index])) {
      debug("selection", `${type} setSelection: no change, returning early`);
      return;
    }
    update(newSelection, event);
  };
  const addToSelection = (arrayOfValuesToAdd, event = null) => {
    debug("selection", `${type} addToSelection called with:`, arrayOfValuesToAdd, "current selection:", baseSelection.value);
    const selectionWithValues = [...baseSelection.value];
    let modified = false;
    for (const valueToAdd of arrayOfValuesToAdd) {
      if (!selectionWithValues.includes(valueToAdd)) {
        modified = true;
        selectionWithValues.push(valueToAdd);
        debug("selection", `${type} addToSelection: adding value:`, valueToAdd);
      }
    }
    if (modified) {
      update(selectionWithValues, event);
    } else {
      debug("selection", `${type} addToSelection: no changes made`);
    }
  };
  const removeFromSelection = (arrayOfValuesToRemove, event = null) => {
    let modified = false;
    const selectionWithoutValues = [];
    for (const elementValue of baseSelection.value) {
      if (arrayOfValuesToRemove.includes(elementValue)) {
        modified = true;
      } else {
        selectionWithoutValues.push(elementValue);
      }
    }
    if (modified) {
      update(selectionWithoutValues, event);
    }
  };
  const toggleElement = (element, event = null) => {
    const elementValue = getElementValue(element);
    if (baseSelection.value.includes(elementValue)) {
      baseSelection.removeFromSelection([elementValue], event);
    } else {
      baseSelection.addToSelection([elementValue], event);
    }
  };
  const selectFromAnchorTo = (element, event = null) => {
    if (anchorElement) {
      const currentAnchor = anchorElement; // Preserve the current anchor
      const range = getElementRange(anchorElement, element);
      baseSelection.setSelection(range, event);
      // Restore the original anchor (setSelection changes it to the last element)
      anchorElement = currentAnchor;
    } else {
      baseSelection.setSelection([getElementValue(element)], event);
    }
  };
  const selectAll = event => {
    const allValues = [];
    for (const element of registry) {
      if (selectAllName && getElementSelectionName(element) !== selectAllName) {
        continue;
      }
      const value = getElementValue(element);
      allValues.push(value);
    }
    debug("interaction", "Select All - setting selection to all values:", allValues);
    baseSelection.setSelection(allValues, event);
  };
  const baseSelection = {
    type,
    multiple,
    enabled,
    get value() {
      return getCurrentValue();
    },
    registry,
    get anchorElement() {
      return anchorElement;
    },
    get activeElement() {
      return activeElement;
    },
    channels: {
      change: {
        add: subscribeChange
      }
    },
    update,
    registerElement,
    unregisterElement,
    setAnchorElement,
    setActiveElement,
    isElementSelected,
    isValueSelected,
    setSelection,
    addToSelection,
    removeFromSelection,
    toggleElement,
    selectFromAnchorTo,
    selectAll,
    // Navigation methods (will be overridden by specific implementations)
    getElementRange,
    getElementAfter,
    getElementBefore,
    getElementBelow,
    getElementAbove
  };
  return baseSelection;
};
// Grid Selection Provider - for 2D layouts like tables
const createGridSelectionController = ({
  ...options
}) => {
  const registry = new Set();
  const navigationMethods = {
    getElementRange: (fromElement, toElement) => {
      const fromPos = getElementPosition(fromElement);
      const toPos = getElementPosition(toElement);
      if (!fromPos || !toPos) {
        return [];
      }

      // Check selection types to ensure we only select compatible elements
      const fromSelectionName = getElementSelectionName(fromElement);
      const toSelectionName = getElementSelectionName(toElement);

      // Calculate rectangular selection area
      const {
        x: fromX,
        y: fromY
      } = fromPos;
      const {
        x: toX,
        y: toY
      } = toPos;
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);

      // Find all registered elements within the rectangular area
      const valuesInRange = [];
      for (const element of registry) {
        const pos = getElementPosition(element);
        if (pos && pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
          const elementSelectionName = getElementSelectionName(element);
          // Only include elements with matching selection type
          if (elementSelectionName === fromSelectionName && elementSelectionName === toSelectionName) {
            valuesInRange.push(getElementValue(element));
          }
        }
      }
      return valuesInRange;
    },
    getElementAfter: element => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }
      const {
        x,
        y
      } = currentPos;
      const nextX = x + 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName = getElementSelectionName(candidateElement);
        if (pos && pos.x === nextX && pos.y === y) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },
    getElementBefore: element => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }
      const {
        x,
        y
      } = currentPos;
      const prevX = x - 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName = getElementSelectionName(candidateElement);
        if (pos && pos.x === prevX && pos.y === y) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },
    getElementBelow: element => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }
      const {
        x,
        y
      } = currentPos;
      const nextY = y + 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName = getElementSelectionName(candidateElement);
        if (pos && pos.x === x && pos.y === nextY) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },
    getElementAbove: element => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }
      const {
        x,
        y
      } = currentPos;
      const prevY = y - 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName = getElementSelectionName(candidateElement);
        if (pos && pos.x === x && pos.y === prevY) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    }
  };
  const gridSelectionController = createBaseSelectionController({
    ...options,
    registry,
    type: "grid",
    navigationMethods
  });
  gridSelectionController.axis = {
    x: true,
    y: true
  };
  return gridSelectionController;
};
// Linear Selection Provider - for 1D layouts like lists
const createLinearSelectionController = ({
  layout = "vertical",
  // "horizontal" or "vertical"
  elementRef,
  // Root element to scope DOM traversal
  ...options
}) => {
  if (!["horizontal", "vertical"].includes(layout)) {
    throw new Error(`useLinearSelection: Invalid axis "${layout}". Must be "horizontal" or "vertical".`);
  }
  const registry = new Set();

  // Define navigation methods that need access to registry
  const navigationMethods = {
    getElementRange: (fromElement, toElement) => {
      if (!registry.has(fromElement) || !registry.has(toElement)) {
        return [];
      }

      // Check selection types to ensure we only select compatible elements
      const fromSelectionName = getElementSelectionName(fromElement);
      const toSelectionName = getElementSelectionName(toElement);

      // Use compareDocumentPosition to determine order
      const comparison = fromElement.compareDocumentPosition(toElement);
      let startElement;
      let endElement;
      if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
        // toElement comes after fromElement
        startElement = fromElement;
        endElement = toElement;
      } else if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
        // toElement comes before fromElement
        startElement = toElement;
        endElement = fromElement;
      } else {
        // Same element
        return [getElementValue(fromElement)];
      }
      const valuesInRange = [];

      // Check all registered elements to see if they're in the range
      for (const element of registry) {
        // Check if element is between startElement and endElement
        const afterStart = startElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING;
        const beforeEnd = element.compareDocumentPosition(endElement) & Node.DOCUMENT_POSITION_FOLLOWING;
        if (element === startElement || element === endElement || afterStart && beforeEnd) {
          const elementSelectionName = getElementSelectionName(element);

          // Only include elements with matching selection type
          if (elementSelectionName === fromSelectionName && elementSelectionName === toSelectionName) {
            valuesInRange.push(getElementValue(element));
          }
        }
      }
      return valuesInRange;
    },
    getElementAfter: element => {
      if (!registry.has(element)) {
        return null;
      }
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      const sameTypeElement = findAfter(element, candidate => {
        if (!registry.has(candidate)) {
          return false;
        }
        const candidateSelectionName = getElementSelectionName(candidate);
        // If same selection name, this is our preferred result
        if (candidateSelectionName === currentSelectionName) {
          return true;
        }
        // Different selection name - store as fallback but keep searching
        if (!fallbackElement) {
          fallbackElement = candidate;
        }
        return false;
      }, {
        root: elementRef.current || document.body
      });
      return sameTypeElement || fallbackElement;
    },
    getElementBefore: element => {
      if (!registry.has(element)) {
        return null;
      }
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      const sameTypeElement = findBefore(element, candidate => {
        if (!registry.has(candidate)) {
          return false;
        }
        const candidateSelectionName = getElementSelectionName(candidate);
        // If same selection name, this is our preferred result
        if (candidateSelectionName === currentSelectionName) {
          return true;
        }
        // Different selection name - store as fallback but keep searching
        if (!fallbackElement) {
          fallbackElement = candidate;
        }
        return false;
      }, {
        root: elementRef.current || document.body
      });
      return sameTypeElement || fallbackElement;
    },
    // Add axis-dependent methods
    getElementBelow: element => {
      if (layout === "vertical") {
        return navigationMethods.getElementAfter(element);
      }
      return null;
    },
    getElementAbove: element => {
      if (layout === "vertical") {
        return navigationMethods.getElementBefore(element);
      }
      return null;
    }
  };

  // Create base selection with navigation methods
  const linearSelectionController = createBaseSelectionController({
    ...options,
    registry,
    type: "linear",
    navigationMethods
  });
  linearSelectionController.axis = {
    x: layout === "horizontal",
    y: layout === "vertical"
  };
  return linearSelectionController;
};
// Helper function to extract value from an element
const getElementValue = element => {
  let value;
  if (element.value !== undefined) {
    value = element.value;
  } else if (element.hasAttribute("data-value")) {
    value = element.getAttribute("data-value");
  } else {
    value = undefined;
  }
  debug("valueExtraction", "getElementValue:", element, "->", value);
  return value;
};
const getElementSelectionName = element => {
  return element.getAttribute("data-selection-name");
};

// Helper functions to find end elements for jump to end functionality
const getJumpToEndElement = (selection, element, keydownEvent) => {
  if (selection.type === "grid") {
    return getJumpToEndElementGrid(selection, element, keydownEvent);
  } else if (selection.type === "linear") {
    return getJumpToEndElementLinear(selection, element, keydownEvent);
  }
  return null;
};
const getJumpToEndElementGrid = (selection, element, keydownEvent) => {
  const currentPos = getElementPosition(element);
  if (!currentPos) {
    return null;
  }
  const {
    key
  } = keydownEvent;
  const {
    x,
    y
  } = currentPos;
  const currentSelectionName = getElementSelectionName(element);
  if (key === "ArrowRight") {
    // Jump to last element in current row with matching selection name
    let lastInRow = null;
    let fallbackElement = null;
    let maxX = -1;
    let fallbackMaxX = -1;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);
      if (pos && pos.y === y) {
        if (candidateSelectionName === currentSelectionName && pos.x > maxX) {
          maxX = pos.x;
          lastInRow = candidateElement;
        } else if (candidateSelectionName !== currentSelectionName && pos.x > fallbackMaxX) {
          fallbackMaxX = pos.x;
          fallbackElement = candidateElement;
        }
      }
    }
    return lastInRow || fallbackElement;
  }
  if (key === "ArrowLeft") {
    // Jump to first element in current row with matching selection name
    let firstInRow = null;
    let fallbackElement = null;
    let minX = Infinity;
    let fallbackMinX = Infinity;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);
      if (pos && pos.y === y) {
        if (candidateSelectionName === currentSelectionName && pos.x < minX) {
          minX = pos.x;
          firstInRow = candidateElement;
        } else if (candidateSelectionName !== currentSelectionName && pos.x < fallbackMinX) {
          fallbackMinX = pos.x;
          fallbackElement = candidateElement;
        }
      }
    }
    return firstInRow || fallbackElement;
  }
  if (key === "ArrowDown") {
    // Jump to last element in current column with matching selection name
    let lastInColumn = null;
    let fallbackElement = null;
    let maxY = -1;
    let fallbackMaxY = -1;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);
      if (pos && pos.x === x) {
        if (candidateSelectionName === currentSelectionName && pos.y > maxY) {
          maxY = pos.y;
          lastInColumn = candidateElement;
        } else if (candidateSelectionName !== currentSelectionName && pos.y > fallbackMaxY) {
          fallbackMaxY = pos.y;
          fallbackElement = candidateElement;
        }
      }
    }
    return lastInColumn || fallbackElement;
  }
  if (key === "ArrowUp") {
    // Jump to first element in current column with matching selection name
    let firstInColumn = null;
    let fallbackElement = null;
    let minY = Infinity;
    let fallbackMinY = Infinity;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);
      if (pos && pos.x === x) {
        if (candidateSelectionName === currentSelectionName && pos.y < minY) {
          minY = pos.y;
          firstInColumn = candidateElement;
        } else if (candidateSelectionName !== currentSelectionName && pos.y < fallbackMinY) {
          fallbackMinY = pos.y;
          fallbackElement = candidateElement;
        }
      }
    }
    return firstInColumn || fallbackElement;
  }
  return null;
};
const getJumpToEndElementLinear = (selection, element, direction) => {
  const currentSelectionName = getElementSelectionName(element);
  if (direction === "ArrowDown" || direction === "ArrowRight") {
    // Jump to last element in the registry with matching selection name
    let lastElement = null;
    let fallbackElement = null;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      if (candidateSelectionName === currentSelectionName) {
        if (!lastElement || candidateElement.compareDocumentPosition(lastElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          lastElement = candidateElement;
        }
      } else if (!fallbackElement) {
        if (!fallbackElement || candidateElement.compareDocumentPosition(fallbackElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          fallbackElement = candidateElement;
        }
      }
    }
    return lastElement || fallbackElement;
  }
  if (direction === "ArrowUp" || direction === "ArrowLeft") {
    // Jump to first element in the registry with matching selection name
    let firstElement = null;
    let fallbackElement = null;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      if (candidateSelectionName === currentSelectionName) {
        if (!firstElement || firstElement.compareDocumentPosition(candidateElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          firstElement = candidateElement;
        }
      } else if (!fallbackElement) {
        if (!fallbackElement || fallbackElement.compareDocumentPosition(candidateElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          fallbackElement = candidateElement;
        }
      }
    }
    return firstElement || fallbackElement;
  }
  return null;
};

// Helper function for grid positioning (moved here from createGridSelection)
const getElementPosition = element => {
  // Get position by checking element's position in table structure
  const cell = element.closest("td, th");
  if (!cell) return null;
  const row = cell.closest("tr");
  if (!row) return null;
  const table = row.closest("table");
  if (!table) return null;
  const rows = Array.from(table.rows);
  const cells = Array.from(row.cells);
  return {
    x: cells.indexOf(cell),
    y: rows.indexOf(row)
  };
};
const useSelectableElement = (elementRef, {
  selection,
  selectionController,
  selectionImpact
}) => {
  if (!selectionController) {
    throw new Error("useSelectableElement needs a selectionController");
  }
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const value = getElementValue(element);
    const selectionName = getElementSelectionName(element);
    debug("registration", "useSelectableElement: registering element:", element, "value:", value, "selectionName:", selectionName);
    selectionController.registerElement(element, {
      selectionImpact
    });
    element.setAttribute("data-selectable", "");
    return () => {
      debug("registration", "useSelectableElement: unregistering element:", element, "value:", value);
      selectionController.unregisterElement(element);
      element.removeAttribute("data-selectable");
    };
  }, [selectionController, selectionImpact]);
  const [selected, setSelected] = useState(false);
  debug("selection", "useSelectableElement: initial selected state:", selected);
  // Update selected state when selection value changes
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      debug("selection", "useSelectableElement: no element, setting selected to false");
      setSelected(false);
      return;
    }
    // Use selection values directly for better performance
    const elementValue = getElementValue(element);
    const isSelected = selection.includes(elementValue);
    debug("selection", "useSelectableElement: updating selected state", element, "isSelected:", isSelected);
    setSelected(isSelected);
  }, [selection]);

  // Add event listeners directly to the element
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    let isDragging = false;
    let dragStartElement = null;
    let cleanup = () => {};
    const handleMouseDown = e => {
      if (!selectionController.enabled) {
        return;
      }
      if (e.button !== 0) {
        // Only handle left mouse button
        return;
      }

      // if (e.defaultPrevented) {
      //   // If the event was prevented by another handler, do not interfere
      //   debug("interaction", "mousedown: event already prevented, skipping");
      //   return;
      // }
      const isMultiSelect = e.metaKey || e.ctrlKey;
      const isShiftSelect = e.shiftKey;
      const isSingleSelect = !isMultiSelect && !isShiftSelect;
      const value = getElementValue(element);
      debug("interaction", "mousedown:", {
        element,
        value,
        isMultiSelect,
        isShiftSelect,
        isSingleSelect,
        currentSelection: selectionController.value
      });

      // Handle immediate selection based on modifier keys
      if (isSingleSelect) {
        // Single select - replace entire selection with just this item
        debug("interaction", "mousedown: single select, setting selection to:", [value]);
        selectionController.setSelection([value], e);
      } else if (isMultiSelect && !isShiftSelect) {
        // Multi select without shift - toggle element
        debug("interaction", "mousedown: multi select, toggling element");
        selectionController.toggleElement(element, e);
      } else if (isShiftSelect) {
        e.preventDefault(); // Prevent navigation
        debug("interaction", "mousedown: shift select, selecting from anchor to element");
        selectionController.selectFromAnchorTo(element, e);
      }
      if (!selectionController.dragToSelect) {
        return;
      }

      // Set up for potential drag selection (now works with all modifier combinations)
      dragStartElement = element;
      isDragging = false; // Will be set to true if mouse moves beyond threshold

      // Store initial mouse position for drag threshold
      const startX = e.clientX;
      const startY = e.clientY;
      const dragThreshold = 5; // pixels

      const handleMouseMove = e => {
        if (!dragStartElement) {
          return;
        }
        if (!isDragging) {
          // Check if we've exceeded the drag threshold
          const deltaX = Math.abs(e.clientX - startX);
          const deltaY = Math.abs(e.clientY - startY);
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (distance < dragThreshold) {
            return; // Don't start dragging yet
          }
          isDragging = true;
          // mark it as drag-selecting
          selectionController.element.setAttribute("data-drag-selecting", "");
        }

        // Find the element under the current mouse position
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        if (!elementUnderMouse) {
          return;
        }
        // Find the closest selectable element (look for element with data-value or in registry)
        let targetElement = elementUnderMouse;
        while (true) {
          if (selectionController.registry.has(targetElement)) {
            break;
          }
          if (targetElement.hasAttribute("data-value") || targetElement.hasAttribute("aria-selected")) {
            break;
          }
          targetElement = targetElement.parentElement;
          if (!targetElement) {
            return;
          }
        }
        if (!selectionController.registry.has(targetElement)) {
          return;
        }
        // Check if we're mixing selection types (like row and cell selections)
        const dragStartSelectionName = getElementSelectionName(dragStartElement);
        const targetSelectionName = getElementSelectionName(targetElement);
        // Only allow drag between elements of the same selection type
        if (dragStartSelectionName !== targetSelectionName) {
          debug("interaction", "drag select: skipping mixed selection types", {
            dragStartSelectionName,
            targetSelectionName
          });
          return;
        }

        // Get the range from anchor to current target
        const rangeValues = selectionController.getElementRange(dragStartElement, targetElement);

        // Handle different drag behaviors based on modifier keys
        const isShiftSelect = e.shiftKey;
        const isMultiSelect = e.metaKey || e.ctrlKey;
        if (isShiftSelect) {
          // For shift drag, use selectFromAnchorTo behavior (replace selection with range from anchor)
          debug("interaction", "shift drag select: selecting from anchor to target", rangeValues);
          selectionController.selectFromAnchorTo(targetElement, e);
          return;
        }
        if (isMultiSelect) {
          // For multi-select drag, add to existing selection
          debug("interaction", "multi-select drag: adding range to selection", rangeValues);
          const currentSelection = [...selectionController.value];
          const newSelection = [...new Set([...currentSelection, ...rangeValues])];
          selectionController.setSelection(newSelection, e);
          return;
        }
        // For normal drag, replace selection
        debug("interaction", "drag select: setting selection to range", rangeValues);
        selectionController.setSelection(rangeValues, e);
      };
      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Remove drag-selecting state from table
        if (isDragging) {
          selectionController.element.removeAttribute("data-drag-selecting");
        }

        // Reset drag state
        dragStartElement = null;
        isDragging = false;
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      cleanup = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    };
    element.addEventListener("mousedown", handleMouseDown);
    return () => {
      element.removeEventListener("mousedown", handleMouseDown);
      cleanup();
    };
  }, [selectionController]);
  return {
    selected
  };
};

// Helper function to handle cross-type navigation
const handleCrossTypeNavigation = (currentElement, targetElement, isMultiSelect) => {
  const currentSelectionName = getElementSelectionName(currentElement);
  const targetSelectionName = getElementSelectionName(targetElement);

  // Check if we're switching between different selection types
  if (currentSelectionName !== targetSelectionName) {
    debug("navigation", "Cross-type navigation detected:", currentSelectionName, "->", targetSelectionName);

    // Return info about cross-type navigation for caller to handle
    return {
      isCrossType: true,
      shouldClearPreviousSelection: !isMultiSelect
    };
  }
  return {
    isCrossType: false,
    shouldClearPreviousSelection: false
  };
};
const createSelectionKeyboardShortcuts = (selectionController, {
  toggleEnabled,
  enabled,
  toggleKey = "space"
} = {}) => {
  const getSelectableElement = keydownEvent => {
    return keydownEvent.target.closest("[data-selectable]");
  };
  const moveSelection = (keyboardEvent, getElementToSelect) => {
    const selectableElement = getSelectableElement(keyboardEvent);
    const elementToSelect = getElementToSelect(selectableElement, keyboardEvent);
    if (!elementToSelect) {
      return false;
    }
    const {
      key
    } = keyboardEvent;
    const isMetaOrCtrlPressed = keyboardEvent.metaKey || keyboardEvent.ctrlKey;
    const isShiftSelect = keyboardEvent.shiftKey;
    const isMultiSelect = isMetaOrCtrlPressed && isShiftSelect; // Only add to selection when BOTH are pressed
    const targetValue = getElementValue(elementToSelect);
    const {
      isCrossType,
      shouldClearPreviousSelection
    } = handleCrossTypeNavigation(selectableElement, elementToSelect, isMultiSelect);
    if (isShiftSelect) {
      debug("interaction", `keydownToSelect: ${key} with Shift - selecting from anchor to target element`);
      selectionController.setActiveElement(elementToSelect);
      selectionController.selectFromAnchorTo(elementToSelect, keyboardEvent);
      return true;
    }
    if (isMultiSelect && !isCrossType) {
      debug("interaction", `keydownToSelect: ${key} with multi-select - adding to selection`);
      selectionController.addToSelection([targetValue], keyboardEvent);
      return true;
    }
    // Handle cross-type navigation
    if (shouldClearPreviousSelection) {
      debug("interaction", `keydownToSelect: ${key} - cross-type navigation, clearing and setting new selection`);
      selectionController.setSelection([targetValue], keyboardEvent);
      return true;
    }
    if (isCrossType && !shouldClearPreviousSelection) {
      debug("interaction", `keydownToSelect: ${key} - cross-type navigation with Cmd, adding to selection`);
      selectionController.addToSelection([targetValue], keyboardEvent);
      return true;
    }
    debug("interaction", `keydownToSelect: ${key} - setting selection to target element`);
    selectionController.setSelection([targetValue], keyboardEvent);
    return true;
  };
  if (enabled !== undefined && typeof enabled !== "function") {
    const v = enabled;
    enabled = () => v;
  }
  return [{
    description: "Add element above to selection",
    key: "command+shift+up",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.y) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, getJumpToEndElement);
    }
  }, {
    description: "Select element above",
    key: "up",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.y) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, selectableElement => selectionController.getElementAbove(selectableElement));
    }
  }, {
    description: "Add element below to selection",
    key: "command+shift+down",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.y) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, getJumpToEndElement);
    }
  }, {
    description: "Select element below",
    key: "down",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.y) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, selectableElement => {
        return selectionController.getElementBelow(selectableElement);
      });
    }
  }, {
    description: "Add left element to selection",
    key: "command+shift+left",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.x) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, getJumpToEndElement);
    }
  }, {
    description: "Select left element",
    key: "left",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.x) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, selectableElement => {
        return selectionController.getElementBefore(selectableElement);
      });
    }
  }, {
    description: "Add right element to selection",
    key: "command+shift+right",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.x) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, getJumpToEndElement);
    }
  }, {
    description: "Select right element",
    key: "right",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.x) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, selectableElement => {
        return selectionController.getElementAfter(selectableElement);
      });
    }
  }, {
    description: "Set element as anchor for shift selections",
    key: "shift",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      const element = getSelectableElement(keyboardEvent);
      selectionController.setAnchorElement(element);
      return true;
    }
  }, {
    description: "Select all",
    key: "command+a",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      selectionController.selectAll(keyboardEvent);
      return true;
    }
  }, {
    description: "Toggle element selected state",
    enabled: keyboardEvent => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!toggleEnabled) {
        return false;
      }
      const elementWithToggleShortcut = keyboardEvent.target.closest("[data-selection-keyboard-toggle]");
      if (!elementWithToggleShortcut) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    key: toggleKey,
    handler: keyboardEvent => {
      const element = getSelectableElement(keyboardEvent);
      const elementValue = getElementValue(element);
      const isCurrentlySelected = selectionController.isElementSelected(element);
      if (isCurrentlySelected) {
        selectionController.removeFromSelection([elementValue], keyboardEvent);
        return true;
      }
      selectionController.addToSelection([elementValue], keyboardEvent);
      return true;
    }
  }];
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_link {
    border-radius: 2px;
  }

  .navi_link:focus {
    position: relative;
    z-index: 1; /* Ensure focus outline is above other elements */
  }

  .navi_link[data-readonly] > *,
  .navi_link[inert] > * {
    opacity: 0.5;
  }

  .navi_link[inert] {
    pointer-events: none;
  }

  .navi_link[aria-selected] {
    position: relative;
  }

  .navi_link[aria-selected] input[type="checkbox"] {
    position: absolute;
    opacity: 0;
  }

  /* Visual feedback for selected state */
  .navi_link[aria-selected="true"] {
    background-color: light-dark(#bbdefb, #2563eb);
  }

  .navi_link[data-active] {
    font-weight: bold;
  }

  .navi_link[data-visited] {
    color: light-dark(#6a1b9a, #ab47bc);
  }

  .navi_link[data-no-text-decoration] {
    text-decoration: none;
  }
`;
const Link = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: LinkBasic,
    WithAction: LinkWithAction
  });
});
const LinkBasic = forwardRef((props, ref) => {
  const selectionContext = useContext(SelectionContext);
  if (selectionContext) {
    return jsx(LinkWithSelection, {
      ref: ref,
      ...props
    });
  }
  return jsx(LinkPlain, {
    ref: ref,
    ...props
  });
});
const LinkPlain = forwardRef((props, ref) => {
  const {
    className = "",
    loading,
    readOnly,
    disabled,
    children,
    autoFocus,
    active,
    visited,
    spaceToClick = true,
    constraints = [],
    onClick,
    onKeyDown,
    href,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const isVisited = useIsVisited(href);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(innerRef, shouldDimColor);
  return jsx(LoadableInlineElement, {
    loading: loading,
    color: "light-dark(#355fcc, #3b82f6)",
    children: jsx("a", {
      ...rest,
      ref: innerRef,
      href: href,
      className: ["navi_link", ...className.split(" ")].join(" "),
      "aria-busy": loading,
      inert: disabled,
      "data-field": "",
      "data-readonly": readOnly ? "" : undefined,
      "data-active": active ? "" : undefined,
      "data-visited": visited || isVisited ? "" : undefined,
      onClick: e => {
        closeValidationMessage(e.target, "click");
        if (readOnly) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      },
      onKeyDown: e => {
        if (spaceToClick && e.key === " ") {
          e.preventDefault(); // Prevent page scroll
          if (!readOnly && !disabled) {
            e.target.click();
          }
        }
        onKeyDown?.(e);
      },
      children: children
    })
  });
});
const LinkWithSelection = forwardRef((props, ref) => {
  const {
    selection,
    selectionController
  } = useContext(SelectionContext);
  const {
    value = props.href,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const {
    selected
  } = useSelectableElement(innerRef, {
    selection,
    selectionController
  });
  return jsx(LinkPlain, {
    ...rest,
    ref: innerRef,
    "data-value": value,
    "aria-selected": selected,
    children: children
  });
});

/*
 * Custom hook to apply semi-transparent color when an element should be dimmed.
 *
 * Why we do it this way:
 * 1. **Precise timing**: Captures the element's natural color exactly when transitioning
 *    from normal to dimmed state (not before, not after)
 * 2. **Avoids CSS inheritance issues**: CSS `currentColor` and `color-mix()` don't work
 *    reliably for creating true transparency that matches `opacity: 0.5`
 * 3. **Performance**: Only executes when the dimmed state actually changes, not on every render
 * 4. **Color accuracy**: Uses `color(from ... / 0.5)` syntax to preserve the exact visual
 *    appearance of `opacity: 0.5` but applied only to color
 * 5. **Works with any color**: Handles default blue, visited purple, inherited colors, etc.
 * 6. **Maintains focus outline**: Since we only dim the text color, focus outlines remain
 *    fully visible for accessibility
 */
const useDimColorWhen = (elementRef, shouldDim) => {
  const shouldDimPreviousRef = useRef();
  useLayoutEffect(() => {
    const element = elementRef.current;
    const shouldDimPrevious = shouldDimPreviousRef.current;
    if (shouldDim === shouldDimPrevious) {
      return;
    }
    shouldDimPreviousRef.current = shouldDim;
    if (shouldDim) {
      // Capture color just before applying disabled state
      const computedStyle = getComputedStyle(element);
      const currentColor = computedStyle.color;
      element.style.color = `color(from ${currentColor} srgb r g b / 0.5)`;
    } else {
      // Clear the inline style to let CSS take over
      element.style.color = "";
    }
  });
};
const LinkWithAction = forwardRef((props, ref) => {
  const {
    shortcuts = [],
    readOnly,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    children,
    loading,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const {
    actionPending
  } = useRequestedActionStatus(innerRef);
  const innerLoading = Boolean(loading || actionPending);
  useKeyboardShortcuts(innerRef, shortcuts, {
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd
  });
  return jsx(LinkBasic, {
    ...rest,
    ref: innerRef,
    loading: innerLoading,
    readOnly: readOnly || actionPending,
    "data-readonly-silent": actionPending && !readOnly ? "" : undefined
    /* When we have keyboard shortcuts the link outline is visible on focus (not solely on focus-visible) */,
    "data-focus-visible": "",
    children: children
  });
});

/**
 * UITransition
 *
 * A Preact component that enables smooth animated transitions between its children when the content changes.
 * It observes content keys and phases to create different types of transitions.
 *
 * Features:
 * - Content transitions: Between different content keys (e.g., user profiles, search results)
 * - Phase transitions: Between loading/content/error states for the same content key
 * - Automatic size animation to accommodate content changes
 * - Configurable transition types: "slide-left", "cross-fade"
 * - Independent duration control for content and phase transitions
 *
 * Usage:
 * - Wrap dynamic content in <UITransition> to animate between states
 * - Set a unique `data-content-key` on your rendered content to identify each content variant
 * - Use `data-content-phase` to mark loading/error states for phase transitions
 * - Configure transition types and durations for both content and phase changes
 *
 * Example:
 *
 *   <UITransition
 *     transitionType="slide-left"
 *     transitionDuration={400}
 *     phaseTransitionType="cross-fade"
 *     phaseTransitionDuration={300}
 *   >
 *     {isLoading
 *       ? <Spinner data-content-key={userId} data-content-phase />
 *       : <UserProfile user={user} data-content-key={userId} />}
 *   </UITransition>
 *
 * When `data-content-key` changes, UITransition animates content transitions.
 * When `data-content-phase` changes for the same key, it animates phase transitions.
 */

const ContentKeyContext = createContext();
const UITransition = ({
  children,
  contentKey,
  sizeTransition,
  sizeTransitionDuration,
  transitionType,
  transitionDuration,
  phaseTransitionType,
  phaseTransitionDuration,
  debugTransition,
  ...props
}) => {
  const [contentKeyFromContext, setContentKeyFromContext] = useState();
  const effectiveContentKey = contentKey || contentKeyFromContext;
  const ref = useRef();
  useLayoutEffect(() => {
    const uiTransition = initUITransition(ref.current);
    return () => {
      uiTransition.cleanup();
    };
  }, []);
  return jsx(ContentKeyContext.Provider, {
    value: setContentKeyFromContext,
    children: jsxs("div", {
      ref: ref,
      ...props,
      className: "ui_transition_container",
      "data-size-transition": sizeTransition ? "" : undefined,
      "data-size-transition-duration": sizeTransitionDuration ? sizeTransitionDuration : undefined,
      "data-content-transition": transitionType ? transitionType : undefined,
      "data-content-transition-duration": transitionDuration ? transitionDuration : undefined,
      "data-phase-transition": phaseTransitionType ? phaseTransitionType : undefined,
      "data-phase-transition-duration": phaseTransitionDuration ? phaseTransitionDuration : undefined,
      "data-debug-transition": debugTransition ? "" : undefined,
      children: [jsx("div", {
        className: "ui_transition_outer_wrapper",
        children: jsxs("div", {
          className: "ui_transition_measure_wrapper",
          children: [jsx("div", {
            className: "ui_transition_slot",
            "data-content-key": effectiveContentKey ? effectiveContentKey : undefined,
            children: children
          }), jsx("div", {
            className: "ui_transition_phase_overlay"
          })]
        })
      }), jsx("div", {
        className: "ui_transition_content_overlay"
      })]
    })
  });
};
const useContentKey = (key, enabled) => {
  const setKey = useContext(ContentKeyContext);
  if (setKey && enabled) {
    setKey(key);
  }
  useLayoutEffect(() => {
    if (!setKey || !enabled) {
      return null;
    }
    return () => {
      setKey(v => {
        if (v !== key) {
          // the current key is different from the one we set
          // it means another component set it in the meantime
          // we should not clear it
          return v;
        }
        return undefined;
      });
    };
  }, [enabled]);
};

const Route = ({
  route,
  children
}) => {
  if (!route.action) {
    throw new Error("Route component requires a route with an action to render.");
  }
  const {
    active,
    url
  } = useRouteStatus(route);
  useContentKey(url, active);
  return jsx(ActionRenderer, {
    disabled: !active,
    action: route.action,
    children: children
  });
};

const TableSelectionContext = createContext();
const useTableSelectionContextValue = (
  selection,
  selectionController,
) => {
  const selectionContextValue = useMemo(() => {
    const selectedColumnIds = [];
    const selectedRowIds = [];
    const columnIdWithSomeSelectedCellSet = new Set();
    const rowIdWithSomeSelectedCellSet = new Set();
    for (const item of selection) {
      const selectionValueInfo = parseTableSelectionValue(item);
      if (selectionValueInfo.type === "row") {
        const { rowId } = selectionValueInfo;
        selectedRowIds.push(rowId);
        continue;
      }
      if (selectionValueInfo.type === "column") {
        const { columnId } = selectionValueInfo;
        selectedColumnIds.push(columnId);
        continue;
      }
      if (selectionValueInfo.type === "cell") {
        const { cellId, columnId, rowId } = selectionValueInfo;
        columnIdWithSomeSelectedCellSet.add(columnId);
        rowIdWithSomeSelectedCellSet.add(rowId);
        continue;
      }
    }
    return {
      selection,
      selectionController,
      selectedColumnIds,
      selectedRowIds,
      columnIdWithSomeSelectedCellSet,
      rowIdWithSomeSelectedCellSet,
    };
  }, [selection]);

  return selectionContextValue;
};

const parseTableSelectionValue = (selectionValue) => {
  if (selectionValue.startsWith("column:")) {
    const columnId = selectionValue.slice("column:".length);
    return { type: "column", columnId };
  }
  if (selectionValue.startsWith("row:")) {
    const rowId = selectionValue.slice("row:".length);
    return { type: "row", rowId };
  }
  const cellId = selectionValue.slice("cell:".length);
  const [columnId, rowId] = cellId.split("-");
  return { type: "cell", cellId, columnId, rowId };
};
const stringifyTableSelectionValue = (type, value) => {
  if (type === "cell") {
    const { columnId, rowId } = value;
    return `cell:${columnId}-${rowId}`;
  }
  if (type === "column") {
    return `column:${value}`;
  }
  if (type === "row") {
    return `row:${value}`;
  }
  return "";
};

/**
 * Check if a specific cell is selected
 * @param {Array} selection - The selection set or array
 * @param {{rowIndex: number, columnIndex: number}} cellPosition - Cell coordinates
 * @returns {boolean} True if the cell is selected
 */
const isCellSelected = (selection, cellId) => {
  const cellSelectionValue = stringifyTableSelectionValue("cell", cellId);
  return selection.includes(cellSelectionValue);
};

/**
 * Check if a specific row is selected
 * @param {Array} selection - The selection set or array
 * @param {number} rowIndex - Row index
 * @returns {boolean} True if the row is selected
 */
const isRowSelected = (selection, rowId) => {
  const rowSelectionValue = stringifyTableSelectionValue("row", rowId);
  return selection.includes(rowSelectionValue);
};

/**
 * Check if a specific column is selected
 * @param {Array} selection - The selection set or array
 * @param {number} columnIndex - Column index
 * @returns {boolean} True if the column is selected
 */
const isColumnSelected = (selection, columnId) => {
  const columnSelectionValue = stringifyTableSelectionValue("column", columnId);
  return selection.has(columnSelectionValue);
};

// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants
// https://github.com/pacocoursey/use-descendants/tree/master

const createIsolatedItemTracker = () => {
  // Producer contexts (ref-based, no re-renders)
  const ProducerTrackerContext = createContext();
  const ProducerItemCountRefContext = createContext();
  const ProducerListRenderIdContext = createContext();

  // Consumer contexts (state-based, re-renders)
  const ConsumerItemsContext = createContext();
  const useIsolatedItemTrackerProvider = () => {
    const itemsRef = useRef([]);
    const items = itemsRef.current;
    const itemCountRef = useRef();
    const pendingFlushRef = useRef(false);
    const producerIsRenderingRef = useRef(false);
    const itemTracker = useMemo(() => {
      const registerItem = (index, value) => {
        const hasValue = index in items;
        if (hasValue) {
          const currentValue = items[index];
          if (compareTwoJsValues(currentValue, value)) {
            return;
          }
        }
        items[index] = value;
        if (producerIsRenderingRef.current) {
          // Consumer will sync after producer render completes
          return;
        }
        pendingFlushRef.current = true;
      };
      const getProducerItem = itemIndex => {
        return items[itemIndex];
      };
      const ItemProducerProvider = ({
        children
      }) => {
        items.length = 0;
        itemCountRef.current = 0;
        pendingFlushRef.current = false;
        producerIsRenderingRef.current = true;
        const listRenderId = {};
        useLayoutEffect(() => {
          producerIsRenderingRef.current = false;
        });

        // CRITICAL: Sync consumer state on subsequent renders
        const renderedOnce = useRef(false);
        useLayoutEffect(() => {
          if (!renderedOnce.current) {
            renderedOnce.current = true;
            return;
          }
          pendingFlushRef.current = true;
          itemTracker.flushToConsumers();
        }, [listRenderId]);
        return jsx(ProducerItemCountRefContext.Provider, {
          value: itemCountRef,
          children: jsx(ProducerListRenderIdContext.Provider, {
            value: listRenderId,
            children: jsx(ProducerTrackerContext.Provider, {
              value: itemTracker,
              children: children
            })
          })
        });
      };
      const ItemConsumerProvider = ({
        children
      }) => {
        const [consumerItems, setConsumerItems] = useState(items);
        const flushToConsumers = () => {
          if (!pendingFlushRef.current) {
            return;
          }
          const itemsCopy = [...items];
          pendingFlushRef.current = false;
          setConsumerItems(itemsCopy);
        };
        itemTracker.flushToConsumers = flushToConsumers;
        useLayoutEffect(() => {
          flushToConsumers();
        });
        return jsx(ConsumerItemsContext.Provider, {
          value: consumerItems,
          children: children
        });
      };
      return {
        pendingFlushRef,
        registerItem,
        getProducerItem,
        ItemProducerProvider,
        ItemConsumerProvider
      };
    }, []);
    const {
      ItemProducerProvider,
      ItemConsumerProvider
    } = itemTracker;
    return [ItemProducerProvider, ItemConsumerProvider, items];
  };

  // Hook for producers to register items (ref-based, no re-renders)
  const useTrackIsolatedItem = data => {
    const listRenderId = useContext(ProducerListRenderIdContext);
    const itemCountRef = useContext(ProducerItemCountRefContext);
    const itemTracker = useContext(ProducerTrackerContext);
    const listRenderIdRef = useRef();
    const itemIndexRef = useRef();
    const dataRef = useRef();
    const prevListRenderId = listRenderIdRef.current;
    useLayoutEffect(() => {
      if (itemTracker.pendingFlushRef.current) {
        itemTracker.flushToConsumers();
      }
    });
    if (prevListRenderId === listRenderId) {
      const itemIndex = itemIndexRef.current;
      itemTracker.registerItem(itemIndex, data);
      dataRef.current = data;
      return itemIndex;
    }
    listRenderIdRef.current = listRenderId;
    const itemCount = itemCountRef.current;
    const itemIndex = itemCount;
    itemCountRef.current = itemIndex + 1;
    itemIndexRef.current = itemIndex;
    dataRef.current = data;
    itemTracker.registerItem(itemIndex, data);
    return itemIndex;
  };
  const useTrackedIsolatedItem = itemIndex => {
    const items = useTrackedIsolatedItems();
    const item = items[itemIndex];
    return item;
  };

  // Hooks for consumers to read items (state-based, re-renders)
  const useTrackedIsolatedItems = () => {
    const consumerItems = useContext(ConsumerItemsContext);
    if (!consumerItems) {
      throw new Error("useTrackedIsolatedItems must be used within <ItemConsumerProvider />");
    }
    return consumerItems;
  };
  return [useIsolatedItemTrackerProvider, useTrackIsolatedItem, useTrackedIsolatedItem, useTrackedIsolatedItems];
};

const createItemTracker = () => {
  const ItemTrackerContext = createContext();
  const useItemTrackerProvider = () => {
    const itemsRef = useRef([]);
    const items = itemsRef.current;
    const itemCountRef = useRef(0);
    const tracker = useMemo(() => {
      const ItemTrackerProvider = ({
        children
      }) => {
        // Reset on each render to start fresh
        tracker.reset();
        return jsx(ItemTrackerContext.Provider, {
          value: tracker,
          children: children
        });
      };
      ItemTrackerProvider.items = items;
      return {
        ItemTrackerProvider,
        items,
        registerItem: data => {
          const index = itemCountRef.current++;
          items[index] = data;
          return index;
        },
        getItem: index => {
          return items[index];
        },
        getAllItems: () => {
          return items;
        },
        reset: () => {
          items.length = 0;
          itemCountRef.current = 0;
        }
      };
    }, []);
    return tracker.ItemTrackerProvider;
  };
  const useTrackItem = data => {
    const tracker = useContext(ItemTrackerContext);
    if (!tracker) {
      throw new Error("useTrackItem must be used within SimpleItemTrackerProvider");
    }
    return tracker.registerItem(data);
  };
  const useTrackedItem = index => {
    const trackedItems = useTrackedItems();
    const item = trackedItems[index];
    return item;
  };
  const useTrackedItems = () => {
    const tracker = useContext(ItemTrackerContext);
    if (!tracker) {
      throw new Error("useTrackedItems must be used within SimpleItemTrackerProvider");
    }
    return tracker.items;
  };
  return [useItemTrackerProvider, useTrackItem, useTrackedItem, useTrackedItems];
};

const Z_INDEX_EDITING = 1; /* To go above neighbours, but should not be too big to stay under the sticky cells */

/* needed because cell uses position:relative, sticky must win even if before in DOM order */
const Z_INDEX_STICKY_COLUMN = Z_INDEX_EDITING + 1;
const Z_INDEX_STICKY_ROW = Z_INDEX_STICKY_COLUMN + 1;
const Z_INDEX_STICKY_CORNER = Z_INDEX_STICKY_ROW + 1;

const Z_INDEX_STICKY_FRONTIER_BACKDROP = Z_INDEX_STICKY_CORNER + 1;
const Z_INDEX_STICKY_FRONTIER_PREVIEW =
  Z_INDEX_STICKY_FRONTIER_BACKDROP + 1;
const Z_INDEX_STICKY_FRONTIER_GHOST =
  Z_INDEX_STICKY_FRONTIER_PREVIEW + 1;
const Z_INDEX_RESIZER_BACKDROP = Z_INDEX_STICKY_CORNER + 1; // above sticky cells

const Z_INDEX_CELL_FOREGROUND = 1;
const Z_INDEX_STICKY_FRONTIER_HANDLE = 2; // above the cell placeholder to keep the sticky frontier visible
const Z_INDEX_RESIZER_HANDLE = Z_INDEX_STICKY_FRONTIER_HANDLE + 1;
const Z_INDEX_DROP_PREVIEW = Z_INDEX_STICKY_CORNER + 1;

const Z_INDEX_TABLE_UI = Z_INDEX_STICKY_CORNER + 1;

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_table_drag_clone_container {
    position: absolute;
    left: var(--table-visual-left);
    top: var(--table-visual-top);
    width: var(--table-visual-width);
    height: var(--table-visual-height);
    /* background: rgba(0, 0, 0, 0.5); */
  }

  .navi_table_cell[data-grabbed]::before,
  .navi_table_cell[data-grabbed]::after {
    box-shadow: none !important;
  }

  /* We preprend ".navi_table_container" to ensure it propertly overrides */
  .navi_table_drag_clone_container .navi_table_cell {
    opacity: ${0};
  }

  .navi_table_drag_clone_container .navi_table_cell[data-grabbed] {
    opacity: 0.7;
  }

  .navi_table_drag_clone_container .navi_table_cell_sticky_frontier {
    opacity: 0;
  }

  .navi_table_drag_clone_container .navi_table_cell[data-sticky-left],
  .navi_table_drag_clone_container .navi_table_cell[data-sticky-top] {
    position: relative;
  }

  .navi_table_cell_foreground {
    pointer-events: none;
    position: absolute;
    inset: 0;
    background: lightgrey;
    opacity: 0;
    z-index: ${Z_INDEX_CELL_FOREGROUND};
  }
  .navi_table_cell[data-first-row] .navi_table_cell_foreground {
    background-color: grey;
  }
  .navi_table_cell_foreground[data-visible] {
    opacity: 1;
  }

  .navi_table_drag_clone_container .navi_table_cell_foreground {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
  }
  .navi_table_drag_clone_container
    .navi_table_cell[data-first-row][data-grabbed] {
    opacity: 1;
  }
  .navi_table_drag_clone_container
    .navi_table_cell[data-first-row]
    .navi_table_cell_foreground {
    opacity: 0;
  }

  .navi_table_column_drop_preview {
    position: absolute;
    left: var(--column-left);
    top: var(--column-top);
    width: var(--column-width);
    height: var(--column-height);
    pointer-events: none;
    z-index: ${Z_INDEX_DROP_PREVIEW};
    /* Invisible container - just for positioning */
    background: transparent;
    border: none;
  }

  .navi_table_column_drop_preview_line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: rgba(0, 0, 255, 0.5);
    opacity: 0;
    left: 0; /* Default: left edge for dropping before */
    transform: translateX(-50%);
  }
  .navi_table_column_drop_preview[data-after]
    .navi_table_column_drop_preview_line {
    left: 100%; /* Right edge for dropping after */
  }
  .navi_table_column_drop_preview[data-visible]
    .navi_table_column_drop_preview_line {
    opacity: 1;
  }

  .navi_table_column_drop_preview .arrow_positioner {
    position: absolute;
    left: 0; /* Default: left edge for dropping before */
    display: flex;
    opacity: 0;
    transform: translateX(-50%);
    color: rgba(0, 0, 255, 0.5);
  }
  .navi_table_column_drop_preview[data-after] .arrow_positioner {
    left: 100%; /* Right edge for dropping after */
  }
  .navi_table_column_drop_preview[data-visible] .arrow_positioner {
    opacity: 1;
  }
  .navi_table_column_drop_preview .arrow_positioner[data-top] {
    top: -10px;
  }
  .navi_table_column_drop_preview .arrow_positioner[data-bottom] {
    bottom: -10px;
  }
  .arrow_positioner svg {
    width: 10px;
    height: 10px;
  }
`;
const TableDragContext = createContext();
const useTableDragContextValue = ({
  tableDragCloneContainerRef,
  tableColumnDropPreviewRef,
  columns,
  setColumnOrder,
  canChangeColumnOrder
}) => {
  setColumnOrder = useStableCallback(setColumnOrder);
  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = columnIndex => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = (columnIndex, newColumnIndex) => {
    setGrabTarget(null);
    if (columnIndex === newColumnIndex) {
      return;
    }
    const columnIds = columns.map(col => col.id);
    const columnIdsWithNewOrder = moveItem(columnIds, columnIndex, newColumnIndex);
    setColumnOrder(columnIdsWithNewOrder);
  };
  return useMemo(() => {
    return {
      tableDragCloneContainerRef,
      tableColumnDropPreviewRef,
      grabTarget,
      grabColumn,
      releaseColumn,
      setColumnOrder,
      canChangeColumnOrder
    };
  }, [grabTarget, canChangeColumnOrder]);
};
const moveItem = (array, indexA, indexB) => {
  const newArray = [];
  const movedItem = array[indexA];
  const movingRight = indexA < indexB;
  for (let i = 0; i < array.length; i++) {
    if (movingRight) {
      // Moving right: add target first, then moved item after
      if (i !== indexA) {
        newArray.push(array[i]);
      }
      if (i === indexB) {
        newArray.push(movedItem);
      }
    } else {
      // Moving left: add moved item first, then target after
      if (i === indexB) {
        newArray.push(movedItem);
      }
      if (i !== indexA) {
        newArray.push(array[i]);
      }
    }
  }
  return newArray;
};
const TableDragCloneContainer = forwardRef((props, ref) => {
  const {
    tableId
  } = props;
  return jsx("div", {
    ref: ref,
    className: "navi_table_drag_clone_container",
    "data-overlay-for": tableId
  });
});
const TableColumnDropPreview = forwardRef((props, ref) => {
  return jsxs("div", {
    ref: ref,
    className: "navi_table_column_drop_preview",
    children: [jsx("div", {
      className: "arrow_positioner",
      "data-top": "",
      children: jsx("svg", {
        fill: "currentColor",
        viewBox: "0 0 30.727 30.727",
        children: jsx("path", {
          d: "M29.994,10.183L15.363,24.812L0.733,10.184c-0.977-0.978-0.977-2.561,0-3.536c0.977-0.977,2.559-0.976,3.536,0 l11.095,11.093L26.461,6.647c0.977-0.976,2.559-0.976,3.535,0C30.971,7.624,30.971,9.206,29.994,10.183z"
        })
      })
    }), jsx("div", {
      className: "navi_table_column_drop_preview_line"
    }), jsx("div", {
      className: "arrow_positioner",
      "data-bottom": "",
      children: jsx("svg", {
        fill: "currentColor",
        viewBox: "0 0 30.727 30.727",
        children: jsx("path", {
          d: "M29.994,20.544L15.363,5.915L0.733,20.543c-0.977,0.978-0.977,2.561,0,3.536c0.977,0.977,2.559,0.976,3.536,0 l11.095-11.093L26.461,24.08c0.977,0.976,2.559,0.976,3.535,0C30.971,23.103,30.971,21.521,29.994,20.544z"
        })
      })
    })]
  });
});
const initDragTableColumnViaPointer = (pointerdownEvent, {
  tableDragCloneContainer,
  dropPreview,
  onGrab,
  onDrag,
  onRelease
}) => {
  dragAfterThreshold(pointerdownEvent, () => {
    const [teardown, addTeardown] = createPubSub();
    const tableCell = pointerdownEvent.target.closest(".navi_table_cell");
    const table = tableCell.closest(".navi_table");
    const columnIndex = Array.from(tableCell.parentNode.children).indexOf(tableCell);

    // Track the drop target column index (starts as current column)
    let dropColumnIndex = columnIndex;
    const tableClone = table.cloneNode(true);
    // ensure [data-drag-obstacle] inside the table clone are ignored
    tableClone.setAttribute("data-drag-ignore", "");

    // Scale down the table clone and set transform origin to mouse grab point
    // const tableRect = table.getBoundingClientRect();
    // const mouseX = mousedownEvent.clientX - tableRect.left;
    // const mouseY = mousedownEvent.clientY - tableRect.top;
    // tableClone.style.transform = "scale(1.2)";
    // tableClone.style.transformOrigin = `${mouseX}px ${mouseY}px`;

    {
      // In the table clone we need to convert sticky elements to position: relative
      // with calculated offsets that match their appearance in the original context
      const scrollContainer = getScrollContainer(table);

      // important: only on cells, not on <col> nor <tr>
      const originalStickyCells = table.querySelectorAll(".navi_table_cell[data-sticky-left], .navi_table_cell[data-sticky-top]");
      const cloneStickyCells = tableClone.querySelectorAll(".navi_table_cell[data-sticky-left], .navi_table_cell[data-sticky-top]");
      originalStickyCells.forEach((originalCell, index) => {
        const cloneCell = cloneStickyCells[index];
        const relativePosition = stickyAsRelativeCoords(originalCell,
        // Our clone is absolutely positioned on top of <table />
        // So we need the sticky position relative to <table />
        table, {
          scrollContainer
        });
        if (relativePosition) {
          const [relativeLeft, relativeTop] = relativePosition;
          cloneCell.style.position = "relative";
          if (relativeLeft !== undefined) {
            cloneCell.style.left = `${relativeLeft}px`;
          }
          if (relativeTop !== undefined) {
            cloneCell.style.top = `${relativeTop}px`;
          }
        }
      });
    }
    {
      // ensure [data-grabbed] are present in the table clone
      // we could retry on "sync_attributes" but we want to be sure it's done asap to prevent table from being displayed at all
      // I fear without this we might have an intermediate step where the table column clone is not visible
      // as [data-grabbed] are not set
      // Would not be a problem but this ensure we see exactly the table clone right away preventing any possibility
      // of visual glitches
      const tableCloneCells = tableClone.querySelectorAll(".navi_table_cell");
      tableCloneCells.forEach(cellClone => {
        const cellColumnIndex = Array.from(cellClone.parentNode.children).indexOf(cellClone);
        if (cellColumnIndex === columnIndex) {
          cellClone.setAttribute("data-grabbed", "");
        }
      });
    }
    {
      tableDragCloneContainer.appendChild(tableClone);
      addTeardown(() => {
        tableClone.remove();
      });
    }
    {
      // Sync attribute changes from original table to clone
      // This is used to:
      // - handle table cells being selected as result of mousedown on the <th />
      // - nothing else is supposed to change in the original <table /> during the drag gesture
      const syncTableAttributes = createTableAttributeSync(table, tableClone);
      addTeardown(() => {
        syncTableAttributes.disconnect();
      });
    }
    const colgroup = table.querySelector(".navi_colgroup");
    const colElements = Array.from(colgroup.children);
    const col = colElements[columnIndex];
    const colgroupClone = tableClone.querySelector(".navi_colgroup");
    const colClone = colgroupClone.children[columnIndex];
    const dragToMoveGestureController = createDragToMoveGestureController({
      name: "move-column",
      direction: {
        x: true
      },
      threshold: 0,
      onGrab,
      onDrag: gestureInfo => {
      },
      resetPositionAfterRelease: true,
      onRelease: gestureInfo => {
        {
          teardown();
        }
        onRelease?.(gestureInfo, dropColumnIndex);
      }
    });
    const dragToMoveGesture = dragToMoveGestureController.grabViaPointer(pointerdownEvent, {
      element: colClone,
      referenceElement: col,
      elementToMove: tableClone
    });
    {
      // Get all column elements for drop target detection
      const dropCandidateElements = colElements.filter(col => !(col.getAttribute("data-drag-obstacle") || "").includes("move-column"));
      const updateDropTarget = dropTargetInfo => {
        const targetColumn = dropTargetInfo.element;
        const targetColumnIndex = colElements.indexOf(targetColumn);
        dropColumnIndex = targetColumnIndex;
        if (dropColumnIndex === columnIndex) {
          dropPreview.removeAttribute("data-visible");
          return;
        }
        // Position the invisible container to match the target column
        const {
          left,
          top,
          width,
          height
        } = targetColumn.getBoundingClientRect();
        dropPreview.style.setProperty("--column-left", `${left}px`);
        dropPreview.style.setProperty("--column-top", `${top}px`);
        dropPreview.style.setProperty("--column-width", `${width}px`);
        dropPreview.style.setProperty("--column-height", `${height}px`);
        // Set data-after attribute to control line position via CSS
        if (dropColumnIndex > columnIndex) {
          // Dropping after: CSS will position line at right edge (100%)
          dropPreview.setAttribute("data-after", "");
        } else {
          // Dropping before: CSS will position line at left edge (0%)
          dropPreview.removeAttribute("data-after");
        }
        dropPreview.setAttribute("data-drop-column-index", dropColumnIndex);
        dropPreview.setAttribute("data-visible", "");
      };
      dragToMoveGesture.addDragCallback(gestureInfo => {
        const dropTargetInfo = getDropTargetInfo(gestureInfo, dropCandidateElements);
        if (!dropTargetInfo) {
          dropPreview.removeAttribute("data-visible");
          return;
        }
        updateDropTarget(dropTargetInfo);
      });
      dragToMoveGesture.addReleaseCallback(() => {
        dropPreview.removeAttribute("data-visible");
      });
    }
    return dragToMoveGesture;
  });
};

/**
 * Creates a MutationObserver that syncs attribute changes from original table to clone
 * @param {HTMLElement} table - The original table element
 * @param {HTMLElement} cloneTable - The cloned table element
 * @returns {MutationObserver} The observer instance with disconnect method
 */
const createTableAttributeSync = (table, tableClone) => {
  // Create a map to quickly find corresponding elements in the clone
  const createElementMap = () => {
    const map = new Map();
    const cells = table.querySelectorAll(".navi_table_cell");
    const cellClones = tableClone.querySelectorAll(".navi_table_cell");
    for (let i = 0; i < cells.length; i++) {
      if (cellClones[i]) {
        map.set(cells[i], cellClones[i]);
      }
    }
    return map;
  };
  const elementMap = createElementMap();
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === "attributes") {
        const originalElement = mutation.target;
        const cloneElement = elementMap.get(originalElement);
        if (cloneElement) {
          const attributeName = mutation.attributeName;
          if (attributeName === "style") {
            return;
          }

          // Sync the attribute change to the clone
          if (originalElement.hasAttribute(attributeName)) {
            const attributeValue = originalElement.getAttribute(attributeName);
            cloneElement.setAttribute(attributeName, attributeValue);
          } else {
            cloneElement.removeAttribute(attributeName);
          }
        }
      }
    });
  });

  // Observe attribute changes on all table cells
  const cellsToObserve = table.querySelectorAll(".navi_table_cell");
  cellsToObserve.forEach(cell => {
    observer.observe(cell, {
      attributes: true,
      attributeOldValue: false,
      subtree: false
    });
  });
  return observer;
};

const TableSizeContext = createContext();

const useTableSizeContextValue = ({
  onColumnSizeChange,
  onRowSizeChange,
  columns,
  rows,
  columnResizerRef,
  rowResizerRef,
}) => {
  onColumnSizeChange = useStableCallback(onColumnSizeChange);
  onRowSizeChange = useStableCallback(onRowSizeChange);

  const tableSizeContextValue = useMemo(() => {
    const onColumnSizeChangeWithColumn = onColumnSizeChange
      ? (width, columnIndex) => {
          const column = columns[columnIndex];
          return onColumnSizeChange(width, columnIndex, column);
        }
      : onColumnSizeChange;

    const onRowSizeChangeWithRow = onRowSizeChange
      ? (height, rowIndex) => {
          const row = rows[rowIndex];
          return onRowSizeChange(height, rowIndex, row);
        }
      : onRowSizeChange;

    return {
      onColumnSizeChange: onColumnSizeChangeWithColumn,
      onRowSizeChange: onRowSizeChangeWithRow,
      columnResizerRef,
      rowResizerRef,
    };
  }, []);

  return tableSizeContextValue;
};

installImportMetaCss(import.meta);const ROW_MIN_HEIGHT = 30;
const ROW_MAX_HEIGHT = 100;
const COLUMN_MIN_WIDTH = 50;
const COLUMN_MAX_WIDTH = 500;
import.meta.css = /* css */`
  body {
    --table-resizer-handle-color: #063b7c;
    --table-resizer-color: #387ec9;
  }

  .navi_table_cell {
    /* ensure table cell padding does not count when we say column = 50px we want a column of 50px, not 50px + paddings */
    box-sizing: border-box;
  }

  .navi_table_cell_resize_handle {
    position: absolute;
    /* background: orange; */
    /* opacity: 0.5; */
    z-index: ${Z_INDEX_RESIZER_HANDLE};
  }
  .navi_table_cell_resize_handle[data-left],
  .navi_table_cell_resize_handle[data-right] {
    cursor: ew-resize;
    top: 0;
    bottom: 0;
    width: 8px;
  }
  .navi_table_cell_resize_handle[data-left] {
    left: 0;
  }
  .navi_table_cell_resize_handle[data-right] {
    right: 0;
  }

  .navi_table_cell_resize_handle[data-top],
  .navi_table_cell_resize_handle[data-bottom] {
    cursor: ns-resize;
    left: 0;
    right: 0;
    height: 8px;
  }
  .navi_table_cell_resize_handle[data-top] {
    top: 0;
  }
  .navi_table_cell_resize_handle[data-bottom] {
    bottom: 0;
  }

  .navi_table_column_resizer {
    pointer-events: none;
    position: absolute;
    left: var(--table-column-resizer-left);
    width: 10px;
    top: var(--table-visual-top);
    height: var(--table-visual-height);
    opacity: 0;
  }
  .navi_table_column_resize_handle {
    position: absolute;
    height: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 15px;
    background: var(--table-resizer-handle-color);
    /* opacity: 0.5; */
    width: 5px;
    height: 26px;
    max-height: 80%;
  }
  .navi_table_column_resize_handle[data-left] {
    left: 2px;
  }
  .navi_table_column_resize_handle[data-right] {
    right: 3px;
  }
  .navi_table_column_resize_handle_container {
    position: absolute;
    top: 0;
    left: -10px;
    right: 0;
    height: var(--table-cell-height);
  }
  .navi_table_column_resizer_line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 5px;
    left: -3px;
    background: var(--table-resizer-color);
    opacity: 0;
    transition: opacity 0.1s ease;
  }
  .navi_table_column_resizer[data-hover],
  .navi_table_column_resizer[data-grabbed] {
    opacity: 1;
  }
  .navi_table_column_resizer[data-hover] {
    transition-delay: 150ms; /* Delay before showing hover effect */
  }
  .navi_table_column_resizer[data-grabbed] .navi_table_column_resizer_line {
    opacity: 1;
  }

  .navi_table_row_resizer {
    pointer-events: none;
    position: absolute;
    left: var(--table-visual-left);
    width: var(--table-visual-width);
    top: var(--table-row-resizer-top);
    height: 10px;
    opacity: 0;
  }
  .navi_table_row_resize_handle {
    position: absolute;
    width: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 15px;
    background: var(--table-resizer-handle-color);
    /* opacity: 0.5; */
    width: 26px;
    height: 5px;
    max-width: 80%;
  }
  .navi_table_row_resize_handle[data-top] {
    top: 2px;
  }
  .navi_table_row_resize_handle[data-bottom] {
    bottom: 3px;
  }
  .navi_table_row_resize_handle_container {
    position: absolute;
    left: 0;
    top: -10px;
    bottom: 0;
    width: var(--table-cell-width);
  }
  .navi_table_row_resizer_line {
    position: absolute;
    left: 0;
    right: 0;
    height: 5px;
    top: -3px;
    background: var(--table-resizer-color);
    opacity: 0;
    transition: opacity 0.1s ease;
  }
  .navi_table_row_resizer[data-hover],
  .navi_table_row_resizer[data-grabbed] {
    opacity: 1;
  }
  .navi_table_row_resizer[data-hover] {
    transition-delay: 150ms; /* Delay before showing hover effect */
  }
  .navi_table_row_resizer[data-grabbed] .navi_table_row_resizer_line {
    opacity: 1;
  }
`;

// Column resize components
const TableColumnResizer = forwardRef((props, ref) => {
  return jsxs("div", {
    ref: ref,
    className: "navi_table_column_resizer",
    children: [jsxs("div", {
      className: "navi_table_column_resize_handle_container",
      children: [jsx("div", {
        className: "navi_table_column_resize_handle",
        "data-left": ""
      }), jsx("div", {
        className: "navi_table_column_resize_handle",
        "data-right": ""
      })]
    }), jsx("div", {
      className: "navi_table_column_resizer_line"
    })]
  });
});
const TableCellColumnResizeHandles = ({
  columnIndex,
  columnMinWidth,
  columnMaxWidth
}) => {
  const {
    onColumnSizeChange
  } = useContext(TableSizeContext);
  const canResize = Boolean(onColumnSizeChange);
  return jsxs(Fragment, {
    children: [canResize && columnIndex > 0 && jsx(TableColumnLeftResizeHandle, {
      onRelease: width => onColumnSizeChange(width, columnIndex - 1),
      columnMinWidth: columnMinWidth,
      columnMaxWidth: columnMaxWidth
    }), canResize && jsx(TableColumnRightResizeHandle, {
      onRelease: width => onColumnSizeChange(width, columnIndex),
      columnMinWidth: columnMinWidth,
      columnMaxWidth: columnMaxWidth
    })]
  });
};
const TableColumnLeftResizeHandle = ({
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease
}) => {
  const {
    columnResizerRef
  } = useContext(TableSizeContext);
  return jsx("div", {
    className: "navi_table_cell_resize_handle",
    "data-left": "",
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag column or drag sticky frontier
      initResizeTableColumnViaPointer(e, {
        columnResizer: columnResizerRef.current,
        columnMinWidth,
        columnMaxWidth,
        onGrab,
        onDrag,
        onRelease,
        isLeft: true
      });
    },
    onMouseEnter: e => {
      onMouseEnterLeftResizeHandle(e, columnResizerRef.current);
    },
    onMouseLeave: e => {
      onMouseLeaveLeftResizeHandle(e, columnResizerRef.current);
    }
  });
};
const TableColumnRightResizeHandle = ({
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease
}) => {
  const {
    columnResizerRef
  } = useContext(TableSizeContext);
  return jsx("div", {
    className: "navi_table_cell_resize_handle",
    "data-right": "",
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag column or drag sticky frontier
      initResizeTableColumnViaPointer(e, {
        columnResizer: columnResizerRef.current,
        columnMinWidth,
        columnMaxWidth,
        onGrab,
        onDrag,
        onRelease
      });
    },
    onMouseEnter: e => {
      onMouseEnterRightResizeHandle(e, columnResizerRef.current);
    },
    onMouseLeave: e => {
      onMouseLeaveRightResizeHandle(e, columnResizerRef.current);
    }
  });
};
const updateTableColumnResizerPosition = (columnCell, columnResizer) => {
  if (columnResizer.hasAttribute("data-grabbed")) {
    // ensure mouseenter/mouseleave while resizing cannot interfere
    // while resizing (would move the resizer on other columns)
    return;
  }
  const columnCellRect = columnCell.getBoundingClientRect();
  const columnRight = columnCellRect.right;
  const cellHeight = columnCellRect.height;
  columnResizer.style.setProperty("--table-column-resizer-left", `${columnRight}px`);
  columnResizer.style.setProperty("--table-cell-height", `${cellHeight}px`);
  columnResizer.setAttribute("data-hover", "");
};
// Row resize helper functions
const updateTableRowResizerPosition = (rowCell, rowResizer) => {
  if (rowResizer.hasAttribute("data-grabbed")) {
    // ensure mouseenter/mouseleave while resizing cannot interfere
    // while resizing (would move the resizer on other rows)
    return;
  }
  const rowCellRect = rowCell.getBoundingClientRect();
  const rowBottom = rowCellRect.bottom;
  const cellWidth = rowCellRect.width;
  rowResizer.style.setProperty("--table-row-resizer-top", `${rowBottom}px`);
  rowResizer.style.setProperty("--table-cell-width", `${cellWidth}px`);
  rowResizer.setAttribute("data-hover", "");
};
const onMouseEnterLeftResizeHandle = (e, columnResizer) => {
  const previousCell = e.target.closest(".navi_table_cell").previousElementSibling;
  updateTableColumnResizerPosition(previousCell, columnResizer);
};
const onMouseEnterRightResizeHandle = (e, columnResizer) => {
  const cell = e.target.closest(".navi_table_cell");
  updateTableColumnResizerPosition(cell, columnResizer);
};
const onMouseLeaveLeftResizeHandle = (e, columnResizer) => {
  columnResizer.removeAttribute("data-hover");
};
const onMouseLeaveRightResizeHandle = (e, columnResizer) => {
  columnResizer.removeAttribute("data-hover");
};
// Generic function to handle table cell resize for both axes
const initResizeViaPointer = (pointerdownEvent, {
  tableCell,
  resizer,
  minSize,
  maxSize,
  onGrab,
  onDrag,
  onRelease,
  // Axis-specific configuration
  axis // 'x' or 'y'
}) => {
  const updateResizerPosition = axis === "x" ? updateTableColumnResizerPosition : updateTableRowResizerPosition;
  const tableCellRect = tableCell.getBoundingClientRect();
  // Calculate size and position based on axis
  const currentSize = axis === "x" ? tableCellRect.width : tableCellRect.height;

  // Convert constraint bounds to scroll container coordinates
  // (Same as boundingClientRect + document scrolls but within the scroll container)
  const areaConstraint = (() => {
    const defaultMinSize = axis === "x" ? COLUMN_MIN_WIDTH : ROW_MIN_HEIGHT;
    const defaultMaxSize = axis === "x" ? COLUMN_MAX_WIDTH : ROW_MAX_HEIGHT;
    const minCellSize = typeof minSize === "number" && minSize > defaultMinSize ? minSize : defaultMinSize;
    const maxCellSize = typeof maxSize === "number" && maxSize < defaultMaxSize ? maxSize : defaultMaxSize;
    const isSticky = axis === "x" ? tableCell.hasAttribute("data-sticky-left") : tableCell.hasAttribute("data-sticky-top");
    if (axis === "x") {
      return {
        left: ({
          leftAtGrab,
          scrollport
        }) => {
          // to get the cell position at grab we need to remove cell size because
          // we place the resizer at the right of the cell
          const cellLeftAtGrab = leftAtGrab - currentSize;
          const minLeft = cellLeftAtGrab + minCellSize;
          if (isSticky && minLeft < scrollport.left) {
            return scrollport.left;
          }
          return minLeft;
        },
        right: ({
          leftAtGrab,
          scrollport
        }) => {
          const cellLeftAtGrab = leftAtGrab - currentSize;
          const maxRight = cellLeftAtGrab + maxCellSize;
          if (isSticky && maxRight > scrollport.right) {
            return scrollport.right;
          }
          return maxRight;
        }
      };
    }
    return {
      top: ({
        topAtGrab,
        scrollport
      }) => {
        const cellTopAtGrab = topAtGrab - currentSize;
        const minTop = cellTopAtGrab + minCellSize;
        if (isSticky && minTop < scrollport.top) {
          return scrollport.top;
        }
        return minTop;
      },
      bottom: ({
        topAtGrab,
        scrollport
      }) => {
        const cellTopAtGrab = topAtGrab - currentSize;
        const maxBottom = cellTopAtGrab + maxCellSize;
        if (isSticky && maxBottom > scrollport.bottom) {
          return scrollport.bottom;
        }
        return maxBottom;
      }
    };
  })();

  // Build drag gesture configuration based on axis
  const gestureName = axis === "x" ? "resize-column" : "resize-row";
  const direction = axis === "x" ? {
    x: true
  } : {
    y: true
  };
  updateResizerPosition(tableCell, resizer);
  const dragToMoveGestureController = createDragToMoveGestureController({
    name: gestureName,
    direction,
    backdropZIndex: Z_INDEX_RESIZER_BACKDROP,
    areaConstraint,
    autoScrollAreaPadding: 20,
    onGrab: () => {
      onGrab?.();
    },
    onDrag,
    resetPositionAfterRelease: true,
    onRelease: gestureInfo => {
      const sizeChange = axis === "x" ? gestureInfo.layout.xDelta : gestureInfo.layout.yDelta;
      const newSize = currentSize + sizeChange;
      onRelease(newSize, currentSize);
      resizer.removeAttribute("data-hover");
    }
  });
  dragToMoveGestureController.grabViaPointer(pointerdownEvent, {
    element: resizer,
    referenceElement: tableCell
  });
};
const initResizeTableColumnViaPointer = (pointerdownEvent, {
  columnResizer,
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease,
  isLeft
}) => {
  let tableCell = pointerdownEvent.target.closest(".navi_table_cell");
  if (isLeft) {
    tableCell = tableCell.previousElementSibling;
  }
  initResizeViaPointer(pointerdownEvent, {
    tableCell,
    resizer: columnResizer,
    minSize: columnMinWidth,
    maxSize: columnMaxWidth,
    onGrab,
    onDrag,
    onRelease,
    axis: "x"
  });
};
const initResizeTableRowViaPointer = (pointerdownEvent, {
  rowResizer,
  rowMinHeight,
  rowMaxHeight,
  onGrab,
  onDrag,
  onRelease,
  isTop
}) => {
  let tableCell = pointerdownEvent.target.closest(".navi_table_cell");
  if (isTop) {
    const tableRow = tableCell.closest(".navi_tr");
    const previousTr = findPreviousTableRow(tableRow);
    if (!previousTr) {
      return;
    }
    // Select the same table cell (same column index) in previous row
    const columnIndex = Array.from(tableRow.children).indexOf(tableCell);
    tableCell = previousTr.children[columnIndex];
  }
  initResizeViaPointer(pointerdownEvent, {
    tableCell,
    resizer: rowResizer,
    minSize: rowMinHeight,
    maxSize: rowMaxHeight,
    onGrab,
    onDrag,
    onRelease,
    axis: "y"
  });
};

// Row resize components
const TableRowResizer = forwardRef((props, ref) => {
  return jsxs("div", {
    ref: ref,
    className: "navi_table_row_resizer",
    children: [jsxs("div", {
      className: "navi_table_row_resize_handle_container",
      children: [jsx("div", {
        className: "navi_table_row_resize_handle",
        "data-top": ""
      }), jsx("div", {
        className: "navi_table_row_resize_handle",
        "data-bottom": ""
      })]
    }), jsx("div", {
      className: "navi_table_row_resizer_line"
    })]
  });
});
const TableCellRowResizeHandles = ({
  rowIndex,
  rowMinHeight,
  rowMaxHeight
}) => {
  const {
    onRowSizeChange
  } = useContext(TableSizeContext);
  const canResize = Boolean(onRowSizeChange);
  return jsxs(Fragment, {
    children: [canResize && rowIndex > 0 && jsx(TableRowTopResizeHandle, {
      onRelease: width => onRowSizeChange(width, rowIndex - 1),
      rowMinHeight: rowMinHeight,
      rowMaxHeight: rowMaxHeight
    }), canResize && jsx(TableRowBottomResizeHandle, {
      onRelease: width => onRowSizeChange(width, rowIndex),
      rowMinHeight: rowMinHeight,
      rowMaxHeight: rowMaxHeight
    })]
  });
};
const TableRowTopResizeHandle = ({
  rowMinHeight,
  rowMaxHeight,
  onGrab,
  onDrag,
  onRelease
}) => {
  const {
    rowResizerRef
  } = useContext(TableSizeContext);
  return jsx("div", {
    className: "navi_table_cell_resize_handle",
    "data-top": "",
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag row
      initResizeTableRowViaPointer(e, {
        rowResizer: rowResizerRef.current,
        rowMinHeight,
        rowMaxHeight,
        onGrab,
        onDrag,
        onRelease,
        isTop: true
      });
    },
    onMouseEnter: e => {
      onMouseEnterTopResizeHandle(e, rowResizerRef.current);
    },
    onMouseLeave: e => {
      onMouseLeaveTopResizeHandle(e, rowResizerRef.current);
    }
  });
};
const TableRowBottomResizeHandle = ({
  rowMinHeight,
  rowMaxHeight,
  onGrab,
  onDrag,
  onRelease
}) => {
  const {
    rowResizerRef
  } = useContext(TableSizeContext);
  return jsx("div", {
    className: "navi_table_cell_resize_handle",
    "data-bottom": "",
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag row
      initResizeTableRowViaPointer(e, {
        rowResizer: rowResizerRef.current,
        rowMinHeight,
        rowMaxHeight,
        onGrab,
        onDrag,
        onRelease
      });
    },
    onMouseEnter: e => {
      onMouseEnterBottomResizeHandle(e, rowResizerRef.current);
    },
    onMouseLeave: e => {
      onMouseLeaveBottomResizeHandle(e, rowResizerRef.current);
    }
  });
};
const onMouseEnterTopResizeHandle = (e, rowResize) => {
  const currentRow = e.target.closest(".navi_tr");
  const previousRow = findPreviousTableRow(currentRow);
  if (previousRow) {
    updateTableRowResizerPosition(previousRow.querySelector(".navi_table_cell"), rowResize);
  }
};
const onMouseEnterBottomResizeHandle = (e, rowResizer) => {
  const rowCell = e.target.closest(".navi_table_cell");
  updateTableRowResizerPosition(rowCell, rowResizer);
};
const onMouseLeaveTopResizeHandle = (e, rowResizer) => {
  rowResizer.removeAttribute("data-hover");
};
const onMouseLeaveBottomResizeHandle = (e, rowResizer) => {
  rowResizer.removeAttribute("data-hover");
};
const findPreviousTableRow = currentRow => {
  // First, try to find previous sibling within the same table section
  const previousSibling = currentRow.previousElementSibling;
  if (previousSibling) {
    return previousSibling;
  }

  // Otherwise, get all rows in the table and find the previous one
  const table = currentRow.closest(".navi_table");
  const allRows = Array.from(table.querySelectorAll(".navi_tr"));
  const currentIndex = allRows.indexOf(currentRow);
  return currentIndex > 0 ? allRows[currentIndex - 1] : null;
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  body {
    --selection-border-color: #0078d4;
    --selection-background-color: #eaf1fd;
  }

  .navi_table_cell[aria-selected="true"] {
    background-color: var(--selection-background-color);
  }

  /* One border */
  .navi_table_cell[data-selection-border-top]::after {
    box-shadow: inset 0 1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-right]::after {
    box-shadow: inset -1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-bottom]::after {
    box-shadow: inset 0 -1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-left]::after {
    box-shadow: inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Two border combinations */
  .navi_table_cell[data-selection-border-top][data-selection-border-right]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-top][data-selection-border-bottom]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-top][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-right][data-selection-border-bottom]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-right][data-selection-border-left]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Three border combinations */
  .navi_table_cell[data-selection-border-top][data-selection-border-right][data-selection-border-bottom]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-top][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-top][data-selection-border-right][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Four border combinations (full selection) */
  .navi_table_cell[data-selection-border-top][data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
`;
const useTableSelectionController = ({
  tableRef,
  selection,
  onSelectionChange,
  selectionColor
}) => {
  const selectionController = useSelectionController({
    elementRef: tableRef,
    layout: "grid",
    value: selection,
    onChange: onSelectionChange,
    selectAllName: "cell"
  });
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    updateSelectionBorders(table, selectionController);
  }, [selectionController.value]);
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    if (selectionColor) {
      table.style.setProperty("--selection-border-color", selectionColor);
    } else {
      table.style.removeProperty("--selection-border-color");
    }
  }, [selectionColor]);
  return selectionController;
};
const updateSelectionBorders = (tableElement, selectionController) => {
  // Find all selected cells
  const cells = Array.from(tableElement.querySelectorAll(".navi_table_cell"));
  const selectedCells = [];
  for (const cell of cells) {
    if (selectionController.isElementSelected(cell)) {
      selectedCells.push(cell);
    }
  }

  // Clear all existing selection border attributes
  tableElement.querySelectorAll("[data-selection-border-top], [data-selection-border-right], [data-selection-border-bottom], [data-selection-border-left]").forEach(cell => {
    cell.removeAttribute("data-selection-border-top");
    cell.removeAttribute("data-selection-border-right");
    cell.removeAttribute("data-selection-border-bottom");
    cell.removeAttribute("data-selection-border-left");
  });
  if (selectedCells.length === 0) {
    return;
  }

  // Convert NodeList to array and get cell positions

  const cellPositions = selectedCells.map(cell => {
    const row = cell.parentElement;
    const allRows = Array.from(tableElement.querySelectorAll(".navi_tr"));
    return {
      element: cell,
      rowIndex: allRows.indexOf(row),
      columnIndex: Array.from(row.children).indexOf(cell)
    };
  });

  // Create a set for fast lookup of selected cell positions
  const selectedPositions = new Set(cellPositions.map(pos => `${pos.rowIndex},${pos.columnIndex}`));

  // Apply selection borders based on actual neighbors (for proper L-shaped selection support)
  cellPositions.forEach(({
    element,
    rowIndex,
    columnIndex
  }) => {
    // Top border: if cell above is NOT selected or doesn't exist
    const cellAbove = `${rowIndex - 1},${columnIndex}`;
    if (!selectedPositions.has(cellAbove)) {
      element.setAttribute("data-selection-border-top", "");
    }

    // Bottom border: if cell below is NOT selected or doesn't exist
    const cellBelow = `${rowIndex + 1},${columnIndex}`;
    if (!selectedPositions.has(cellBelow)) {
      element.setAttribute("data-selection-border-bottom", "");
    }

    // Left border: if cell to the left is NOT selected or doesn't exist
    const cellLeft = `${rowIndex},${columnIndex - 1}`;
    if (!selectedPositions.has(cellLeft)) {
      element.setAttribute("data-selection-border-left", "");
    }

    // Right border: if cell to the right is NOT selected or doesn't exist
    const cellRight = `${rowIndex},${columnIndex + 1}`;
    if (!selectedPositions.has(cellRight)) {
      element.setAttribute("data-selection-border-right", "");
    }
  });
};

// TODO: move this to @jsenv/dom (the initStickyGroup part, not the useLayoutEffect)


// React hook version for easy integration
const useStickyGroup = (
  elementRef,
  { elementReceivingCumulativeStickyPositionRef, elementSelector } = {},
) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    return initStickyGroup(element, {
      elementSelector,
      elementReceivingCumulativeStickyPosition:
        elementReceivingCumulativeStickyPositionRef.current,
    });
  }, [elementSelector]);
};

const ITEM_LEFT_VAR = "--sticky-group-item-left";
const ITEM_TOP_VAR = "--sticky-group-item-top";
const FRONTIER_LEFT_VAR = "--sticky-group-left";
const FRONTIER_TOP_VAR = "--sticky-group-top";
// const FRONTIER_LEFT_VIEWPORT_VAR = "--sticky-group-left-viewport";
// const FRONTIER_TOP_VIEWPORT_VAR = "--sticky-group-top-viewport";

/**
 * Creates a sticky group that manages positioning for multiple sticky elements
 * that need to be aware of each other's dimensions.
 * Always uses CSS variables for positioning.
 *
 * @param {HTMLElement} container The container element
 * @returns {Function} Cleanup function
 */
const initStickyGroup = (
  container,
  { elementSelector, elementReceivingCumulativeStickyPosition } = {},
) => {
  if (!container) {
    throw new Error("initStickyGroup: container is required");
  }

  const [teardown, addTeardown] = createPubSub();
  const [cleanup, addCleanup, clearCleanup] = createPubSub();
  addTeardown(cleanup);

  const element = elementSelector
    ? container.querySelector(elementSelector)
    : container;
  const isGrid =
    element.tagName === "TABLE" || element.classList.contains("navi_table");
  const updatePositions = () => {
    // Clear all previous CSS variable cleanups before setting new ones
    cleanup();
    clearCleanup();

    if (isGrid) {
      updateGridPositions();
    } else {
      updateLinearPositions();
    }
  };

  const updateGridPositions = () => {
    // Handle table grid - update both horizontal and vertical sticky elements
    updateTableColumns();
    updateTableRows();
  };
  const updateTableColumns = () => {
    // Find all sticky columns by checking all rows to identify which columns have sticky cells
    const allStickyColumnCells = element.querySelectorAll(
      ".navi_table_cell[data-sticky-left]",
    );
    if (allStickyColumnCells.length === 0) {
      return;
    }

    // Get the first row to determine column indices (use any row that exists)
    const firstRow = element.querySelector(".navi_tr");
    if (!firstRow) {
      return;
    }

    // Group sticky cells by column index
    const stickyColumnsByIndex = new Map();
    allStickyColumnCells.forEach((cell) => {
      const row = cell.closest(".navi_tr");
      const columnIndex = Array.from(row.children).indexOf(cell);
      if (!stickyColumnsByIndex.has(columnIndex)) {
        stickyColumnsByIndex.set(columnIndex, []);
      }
      stickyColumnsByIndex.get(columnIndex).push(cell);
    });

    // Sort columns by index and process them
    const sortedColumnIndices = Array.from(stickyColumnsByIndex.keys()).sort(
      (a, b) => a - b,
    );
    let cumulativeWidth = 0;

    sortedColumnIndices.forEach((columnIndex, stickyIndex) => {
      const cellsInColumn = stickyColumnsByIndex.get(columnIndex);
      const leftPosition = stickyIndex === 0 ? 0 : cumulativeWidth;

      // Set CSS variable on all sticky cells in this column using setStyles for proper cleanup
      cellsInColumn.forEach((cell) => {
        const restoreStyles = setStyles(cell, {
          [ITEM_LEFT_VAR]: `${leftPosition}px`,
        });
        addCleanup(restoreStyles);
      });

      // Also set CSS variable on corresponding <col> element if it exists
      const colgroup = element.querySelector(".navi_colgroup");
      if (colgroup) {
        const colElements = Array.from(colgroup.querySelectorAll(".navi_col"));
        const correspondingCol = colElements[columnIndex];
        if (correspondingCol) {
          const restoreStyles = setStyles(correspondingCol, {
            [ITEM_LEFT_VAR]: `${leftPosition}px`,
          });
          addCleanup(restoreStyles);
        }
      }

      // Update cumulative width for next column using the first cell in this column as reference
      const referenceCell = cellsInColumn[0];
      const columnWidth = referenceCell.getBoundingClientRect().width;
      if (stickyIndex === 0) {
        cumulativeWidth = columnWidth;
      } else {
        cumulativeWidth += columnWidth;
      }
    });

    // Set frontier variables with proper cleanup tracking
    const restoreContainerStyles = setStyles(container, {
      [FRONTIER_LEFT_VAR]: `${cumulativeWidth}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [FRONTIER_LEFT_VAR]: `${cumulativeWidth}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
    }
  };
  const updateTableRows = () => {
    // Handle sticky rows by finding cells with data-sticky-top and grouping by row
    const stickyCells = element.querySelectorAll(
      ".navi_table_cell[data-sticky-top]",
    );
    if (stickyCells.length === 0) {
      return;
    }

    // Group cells by their parent row
    const rowsWithStickyCells = new Map();
    stickyCells.forEach((cell) => {
      const row = cell.parentElement;
      if (!rowsWithStickyCells.has(row)) {
        rowsWithStickyCells.set(row, []);
      }
      rowsWithStickyCells.get(row).push(cell);
    });

    // Convert to array and sort by row position in DOM
    const allRows = Array.from(element.querySelectorAll(".navi_tr"));
    const stickyRows = Array.from(rowsWithStickyCells.keys()).sort((a, b) => {
      const aIndex = allRows.indexOf(a);
      const bIndex = allRows.indexOf(b);
      return aIndex - bIndex;
    });

    let cumulativeHeight = 0;
    stickyRows.forEach((row, index) => {
      const rowCells = rowsWithStickyCells.get(row);
      const topPosition = index === 0 ? 0 : cumulativeHeight;

      // Set CSS variable on all sticky cells in this row using setStyles for proper cleanup
      rowCells.forEach((cell) => {
        const restoreStyles = setStyles(cell, {
          [ITEM_TOP_VAR]: `${topPosition}px`,
        });
        addCleanup(restoreStyles);
      });

      // Also set CSS variable on the <tr> element itself
      const restoreRowStyles = setStyles(row, {
        [ITEM_TOP_VAR]: `${topPosition}px`,
      });
      addCleanup(restoreRowStyles);

      // Update cumulative height for next row
      const rowHeight = row.getBoundingClientRect().height;
      if (index === 0) {
        cumulativeHeight = rowHeight;
      } else {
        cumulativeHeight += rowHeight;
      }
    });

    // Set frontier variables with proper cleanup tracking
    const restoreContainerStyles = setStyles(container, {
      [FRONTIER_TOP_VAR]: `${cumulativeHeight}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [FRONTIER_TOP_VAR]: `${cumulativeHeight}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
    }
  };

  const updateLinearPositions = () => {
    // Handle linear container - detect direction from first sticky element
    const stickyElements = element.querySelectorAll(
      "[data-sticky-left], [data-sticky-top]",
    );
    if (stickyElements.length <= 1) return;

    const firstElement = stickyElements[0];
    const isHorizontal = firstElement.hasAttribute("data-sticky-left");
    const dimensionProperty = isHorizontal ? "width" : "height";
    const cssVariableName = isHorizontal ? ITEM_LEFT_VAR : ITEM_TOP_VAR;

    let cumulativeSize = 0;
    stickyElements.forEach((element, index) => {
      if (index === 0) {
        // First element stays at position 0
        const restoreStyles = setStyles(element, {
          [cssVariableName]: "0px",
        });
        addCleanup(restoreStyles);
        cumulativeSize = element.getBoundingClientRect()[dimensionProperty];
      } else {
        // Subsequent elements use cumulative positioning
        const position = cumulativeSize;
        const restoreStyles = setStyles(element, {
          [cssVariableName]: `${position}px`,
        });
        addCleanup(restoreStyles);
        cumulativeSize += element.getBoundingClientRect()[dimensionProperty];
      }
    });

    // Set frontier variables with proper cleanup tracking
    const frontierVar = isHorizontal ? FRONTIER_LEFT_VAR : FRONTIER_TOP_VAR;
    const restoreContainerStyles = setStyles(container, {
      [frontierVar]: `${cumulativeSize}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [frontierVar]: `${cumulativeSize}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
    }
  };

  // Initial positioning
  updatePositions();

  // Set up ResizeObserver to handle size changes
  const resizeObserver = new ResizeObserver(() => {
    updatePositions();
  });

  // Set up MutationObserver to handle DOM changes
  const mutationObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;

    mutations.forEach((mutation) => {
      // Check if sticky elements were added/removed or attributes changed
      if (mutation.type === "childList") {
        shouldUpdate = true;
      }
      if (mutation.type === "attributes") {
        // Check if the mutation affects sticky attributes
        if (
          mutation.attributeName === "data-sticky-left" ||
          mutation.attributeName === "data-sticky-top"
        ) {
          shouldUpdate = true;
        }
      }
    });

    if (shouldUpdate) {
      updatePositions();
    }
  });

  // Start observing
  resizeObserver.observe(element);
  addTeardown(() => {
    resizeObserver.disconnect();
  });

  mutationObserver.observe(element, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["data-sticky-left", "data-sticky-top"],
  });
  addTeardown(() => {
    mutationObserver.disconnect();
  });

  // Return cleanup function
  return () => {
    teardown();
  };
};

// const visualPositionEffect = (element, callback) => {
//   const updatePosition = () => {
//     const { left, top } = getVisualRect(element, document.body, {
//       isStickyLeft: false,
//       isStickyTop: false,
//     });
//     callback({ left, top });
//   };
//   updatePosition();

//   window.addEventListener("scroll", updatePosition, { passive: true });
//   window.addEventListener("resize", updatePosition);
//   window.addEventListener("touchmove", updatePosition);

//   return () => {
//     window.removeEventListener("scroll", updatePosition, {
//       passive: true,
//     });
//     window.removeEventListener("resize", updatePosition);
//     window.removeEventListener("touchmove", updatePosition);
//   };
// };

const TableStickyContext = createContext();

const useTableStickyContextValue = ({
  stickyLeftFrontierColumnIndex,
  stickyTopFrontierRowIndex,
  onStickyLeftFrontierChange,
  onStickyTopFrontierChange,
}) => {
  onStickyLeftFrontierChange = useStableCallback(onStickyLeftFrontierChange);
  onStickyTopFrontierChange = useStableCallback(onStickyTopFrontierChange);

  return useMemo(() => {
    return {
      stickyLeftFrontierColumnIndex,
      stickyTopFrontierRowIndex,
      onStickyLeftFrontierChange,
      onStickyTopFrontierChange,
    };
  }, [stickyLeftFrontierColumnIndex, stickyTopFrontierRowIndex]);
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  body {
    --sticky-frontier-color: #c0c0c0;
    --sticky-frontier-size: 12px;
    --sticky-frontier-ghost-size: 8px;
  }

  .navi_table_cell[data-sticky-top] {
    position: sticky;
    top: var(--sticky-group-item-top, 0);
    z-index: ${Z_INDEX_STICKY_ROW};
  }
  .navi_table_cell[data-sticky-left] {
    position: sticky;
    left: var(--sticky-group-item-left, 0);
    z-index: ${Z_INDEX_STICKY_COLUMN};
  }
  .navi_table_cell[data-sticky-left][data-sticky-top] {
    position: sticky;
    top: var(--sticky-group-item-top, 0);
    left: var(--sticky-group-item-left, 0);
    z-index: ${Z_INDEX_STICKY_CORNER};
  }

  /* Useful because drag gesture will read this value to detect <col>, <tr> virtual position */
  .navi_col {
    left: var(--sticky-group-item-left, 0);
  }
  .navi_tr {
    top: var(--sticky-group-item-top, 0);
  }

  .navi_table_sticky_frontier {
    position: absolute;
    cursor: grab;
    pointer-events: auto;
  }

  .navi_table_sticky_frontier[data-left] {
    left: calc(var(--table-visual-left) + var(--sticky-group-left));
    width: var(--sticky-frontier-size);
    top: calc(var(--table-visual-top) + var(--sticky-group-top));
    height: calc(var(--table-visual-height) - var(--sticky-group-top));
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier[data-top] {
    left: calc(var(--table-visual-left) + var(--sticky-group-left));
    width: calc(var(--table-visual-width) - var(--sticky-group-left));
    top: calc(var(--table-visual-top) + var(--sticky-group-top));
    height: var(--sticky-frontier-size);
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier_ghost,
  .navi_table_sticky_frontier_preview {
    position: absolute;
    pointer-events: none;
    opacity: 0;
  }
  .navi_table_sticky_frontier_ghost {
    z-index: ${Z_INDEX_STICKY_FRONTIER_GHOST};
    background: rgba(68, 71, 70, 0.5);
  }
  .navi_table_sticky_frontier_preview {
    z-index: ${Z_INDEX_STICKY_FRONTIER_PREVIEW};
    background: rgba(56, 121, 200, 0.5);
  }
  .navi_table_sticky_frontier_ghost[data-visible],
  .navi_table_sticky_frontier_preview[data-visible] {
    opacity: 1;
  }
  .navi_table_sticky_frontier_ghost[data-left],
  .navi_table_sticky_frontier_preview[data-left] {
    top: 0;
    width: var(--sticky-frontier-ghost-size);
    height: var(--table-height, 100%);
  }
  .navi_table_sticky_frontier_ghost[data-left] {
    left: var(--sticky-frontier-ghost-position, 0px);
  }
  .navi_table_sticky_frontier_preview[data-left] {
    left: var(--sticky-frontier-preview-position, 0px);
  }

  .navi_table_sticky_frontier_ghost[data-top],
  .navi_table_sticky_frontier_preview[data-top] {
    left: 0;
    width: var(--table-width, 100%);
    height: var(--sticky-frontier-ghost-size);
  }

  .navi_table_sticky_frontier_ghost[data-top] {
    top: var(--sticky-frontier-ghost-position, 0px);
  }
  .navi_table_sticky_frontier_preview[data-top] {
    top: var(--sticky-frontier-preview-position, 0px);
  }

  /* Positioning adjustments for ::after pseudo-elements on cells adjacent to sticky frontiers */
  /* These ensure selection and focus borders align with the ::before borders */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier]::after {
    left: 0;
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-top-frontier]::after {
    top: 0;
  }

  /* Base borders for sticky cells (will be overridden by frontier rules) */
  .navi_table[data-border-collapse] .navi_table_cell[data-sticky-left]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] .navi_table_cell[data-sticky-top]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header row sticky cells need top border */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-sticky-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-sticky-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column sticky cells need left border */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-sticky-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-sticky-top]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column sticky cells get all four regular borders */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-first-column][data-sticky-left]::before,
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-first-column][data-sticky-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Borders for cells immediately after sticky frontiers */

  /* Left border for the column after sticky-x-frontier */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-x-frontier also need top border (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-after-sticky-left-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Top border for the row after sticky-y-frontier */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-y-frontier also need left border (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column cells after sticky-y-frontier need all four borders (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Corner case: cell after both sticky frontiers */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }
`;
const TableStickyFrontier = ({
  tableRef
}) => {
  const stickyLeftFrontierGhostRef = useRef();
  const stickyLeftFrontierPreviewRef = useRef();
  const stickyTopFrontierGhostRef = useRef();
  const stickyTopFrontierPreviewRef = useRef();
  return jsxs(Fragment, {
    children: [jsx(TableStickyLeftFrontier, {
      tableRef: tableRef,
      stickyLeftFrontierGhostRef: stickyLeftFrontierGhostRef,
      stickyLeftFrontierPreviewRef: stickyLeftFrontierPreviewRef
    }), jsx(TableStickyTopFrontier, {
      tableRef: tableRef,
      stickyTopFrontierGhostRef: stickyTopFrontierGhostRef,
      stickyTopFrontierPreviewRef: stickyTopFrontierPreviewRef
    }), jsx("div", {
      ref: stickyLeftFrontierGhostRef,
      className: "navi_table_sticky_frontier_ghost",
      "data-left": ""
    }), jsx("div", {
      ref: stickyLeftFrontierPreviewRef,
      className: "navi_table_sticky_frontier_preview",
      "data-left": ""
    }), jsx("div", {
      ref: stickyTopFrontierGhostRef,
      className: "navi_table_sticky_frontier_ghost",
      "data-top": ""
    }), jsx("div", {
      ref: stickyTopFrontierPreviewRef,
      className: "navi_table_sticky_frontier_preview",
      "data-top": ""
    })]
  });
};
const TableStickyLeftFrontier = ({
  tableRef,
  stickyLeftFrontierGhostRef,
  stickyLeftFrontierPreviewRef
}) => {
  const {
    stickyLeftFrontierColumnIndex,
    onStickyLeftFrontierChange
  } = useContext(TableStickyContext);
  const canMoveFrontier = Boolean(onStickyLeftFrontierChange);
  return jsx("div", {
    className: "navi_table_sticky_frontier",
    "data-left": "",
    inert: !canMoveFrontier,
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag column

      const table = tableRef.current;
      const stickyLeftFrontierGhost = stickyLeftFrontierGhostRef.current;
      const stickyLeftFrontierPreview = stickyLeftFrontierPreviewRef.current;
      const colgroup = table.querySelector("colgroup");
      const colElements = Array.from(colgroup.children);
      initMoveStickyFrontierViaPointer(e, {
        table,
        frontierGhost: stickyLeftFrontierGhost,
        frontierPreview: stickyLeftFrontierPreview,
        elements: colElements,
        frontierIndex: stickyLeftFrontierColumnIndex,
        axis: "x",
        onRelease: (_, index) => {
          if (index !== stickyLeftFrontierColumnIndex) {
            onStickyLeftFrontierChange(index);
          }
        }
      });
    }
  });
};
const TableStickyTopFrontier = ({
  tableRef,
  stickyTopFrontierGhostRef,
  stickyTopFrontierPreviewRef
}) => {
  const {
    stickyTopFrontierRowIndex,
    onStickyTopFrontierChange
  } = useContext(TableStickyContext);
  const canMoveFrontier = Boolean(onStickyTopFrontierChange);
  return jsx("div", {
    className: "navi_table_sticky_frontier",
    "data-top": "",
    inert: !canMoveFrontier,
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag column

      const table = tableRef.current;
      const rowElements = Array.from(table.querySelectorAll("tr"));
      initMoveStickyFrontierViaPointer(e, {
        table,
        frontierGhost: stickyTopFrontierGhostRef.current,
        frontierPreview: stickyTopFrontierPreviewRef.current,
        elements: rowElements,
        frontierIndex: stickyTopFrontierRowIndex,
        axis: "y",
        onRelease: (_, index) => {
          if (index !== stickyTopFrontierRowIndex) {
            onStickyTopFrontierChange(index);
          }
        }
      });
    }
  });
};

// Generic function to handle sticky frontier movement for both axes
const initMoveStickyFrontierViaPointer = (pointerdownEvent, {
  table,
  frontierGhost,
  frontierPreview,
  frontierIndex,
  onGrab,
  onDrag,
  onRelease,
  // Axis-specific configuration
  axis,
  // 'x' or 'y'
  elements // array of colElements or rowElements
}) => {
  // Get elements based on axis
  const gestureName = axis === "x" ? "move-sticky-left-frontier" : "move-sticky-top-frontier";
  const scrollProperty = axis === "x" ? "scrollLeft" : "scrollTop";
  const ghostVariableName = "--sticky-frontier-ghost-position";
  const previewVariableName = "--sticky-frontier-preview-position";
  const ghostElement = frontierGhost;
  const previewElement = frontierPreview;
  const scrollContainer = getScrollContainer(table);
  // Reset scroll to prevent starting drag in obstacle position
  scrollContainer[scrollProperty] = 0;

  // Setup table dimensions for ghost/preview
  const ghostOffsetParent = ghostElement.offsetParent;
  const ghostOffsetParentRect = ghostOffsetParent.getBoundingClientRect();
  const getPosition = elementRect => {
    if (axis === "x") {
      const elementLeftRelative = elementRect.left - ghostOffsetParentRect.left;
      return elementLeftRelative + elementRect.width;
    }
    const elementTopRelative = elementRect.top - ghostOffsetParentRect.top;
    return elementTopRelative + elementRect.height;
  };

  // Setup initial ghost position
  if (frontierIndex === -1) {
    ghostElement.style.setProperty(ghostVariableName, "0px");
  } else {
    const element = elements[frontierIndex];
    const elementRect = element.getBoundingClientRect();
    const position = getPosition(elementRect);
    ghostElement.style.setProperty(ghostVariableName, `${position}px`);
  }
  ghostElement.setAttribute("data-visible", "");
  let futureFrontierIndex = frontierIndex;
  const onFutureFrontierIndexChange = index => {
    futureFrontierIndex = index;

    // We maintain a visible preview of the frontier
    // to tell user "hey if you grab here, the frontier will be there"
    // At this stage user can see 3 frontiers. Where it is, the one he grab, the future one if he releases.
    if (index === frontierIndex) {
      previewElement.removeAttribute("data-visible");
      return;
    }
    let previewPosition;
    if (index === -1) {
      previewPosition = 0;
    } else {
      const element = elements[index];
      const elementRect = element.getBoundingClientRect();
      previewPosition = getPosition(elementRect);
    }
    previewElement.style.setProperty(previewVariableName, `${previewPosition}px`);
    previewElement.setAttribute("data-visible", "");
  };
  const moveFrontierGestureController = createDragToMoveGestureController({
    name: gestureName,
    direction: {
      [axis]: true
    },
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,
    areaConstraint: "visible",
    areaConstraintElement: table.closest(".navi_table_root"),
    onGrab,
    onDrag: gestureInfo => {
      const dropTargetInfo = getDropTargetInfo(gestureInfo, elements);
      if (dropTargetInfo) {
        const dropColumnIndex = dropTargetInfo.index;
        const dropFrontierIndex = dropTargetInfo.elementSide[axis] === "start" ? dropColumnIndex - 1 : dropColumnIndex;
        if (dropFrontierIndex !== futureFrontierIndex) {
          onFutureFrontierIndexChange(dropFrontierIndex);
        }
      }
      onDrag?.(gestureInfo, futureFrontierIndex);
    },
    onRelease: gesture => {
      previewElement.removeAttribute("data-visible");
      previewElement.style.removeProperty(previewVariableName);
      ghostElement.removeAttribute("data-visible");
      ghostElement.style.removeProperty(ghostVariableName);
      ghostElement.style[axis === "x" ? "left" : "top"] = ""; // reset position set by drag

      onRelease?.(gesture, futureFrontierIndex);
    }
  });
  moveFrontierGestureController.grabViaPointer(pointerdownEvent, {
    element: ghostElement
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_table_ui {
    position: fixed;
    z-index: ${Z_INDEX_TABLE_UI};
    overflow: hidden; /* Ensure UI elements cannot impact scrollbars of the document  */
    inset: 0;
    pointer-events: none; /* UI elements must use pointer-events: auto if they need to be interactive */
    /* background: rgba(0, 255, 0, 0.2); */
  }
`;
const TableUI = forwardRef((props, ref) => {
  const {
    tableRef,
    tableId,
    children
  } = props;

  // ui positioning
  useLayoutEffect(() => {
    const ui = ref.current;
    const table = tableRef.current;
    if (!ui || !table) {
      return null;
    }

    // TODO: external code should be able to call tableVisibleRectEffect.check();
    // (for the drag operation when we scroll)
    // -> actually not that important because browser will dispatch "scroll" events
    // cause by programmatic scrolls before re-painting
    // -> no intermediate state visible to the user where overlay is not in sync
    const tableVisibleRectEffect = visibleRectEffect(table, visibleRect => {
      ui.style.setProperty("--table-visual-left", `${visibleRect.left}px`);
      ui.style.setProperty("--table-visual-width", `${visibleRect.width}px`);
      ui.style.setProperty("--table-visual-top", `${visibleRect.top}px`);
      ui.style.setProperty("--table-visual-height", `${visibleRect.height}px`);
    });
    return tableVisibleRectEffect.disconnect;
  });
  return createPortal(jsx("div", {
    ref: ref,
    className: "navi_table_ui",
    "data-overlay-for": tableId,
    children: children
  }), document.body);
});

/**
 * Table Component with Custom Border and Selection System
 *
 * PROBLEM: We want to draw selected table cells with a clear visual perimeter
 *
 * ATTEMPTED SOLUTIONS & THEIR ISSUES:
 *
 * 1. Drawing selection outside the table:
 *    - z-index issues: Hard to ensure selection appears above all table elements
 *    - Performance issues: Constant recalculation during resizing, scrolling, etc.
 *    - Positioning complexity: Managing absolute positioning relative to table cells
 *
 * 2. Using native CSS table cell borders:
 *    - Border rendering artifacts: CSS borders are not rendered as straight lines,
 *      making selection perimeter imperfect (especially with thick borders)
 *    - Border-collapse compatibility: Native border-collapse causes sticky elements
 *      to lose borders while scrolling in some browsers
 *    - Dimension changes: Custom border-collapse (manually disabling adjacent borders)
 *      changes cell dimensions, making selection outline visible and inconsistent
 *
 * SOLUTION: Custom border system using box-shadow
 *
 * KEY PRINCIPLES:
 * - Use inset box-shadow to ensure borders appear above table cell backgrounds
 * - Use ::before pseudo-elements with position: absolute for flexible positioning
 * - Each cell draws its own borders independently (no border-collapse by default)
 * - Selection borders override table borders using higher CSS specificity
 * - Sticky borders use thicker box-shadows in accent color (yellow)
 *
 * TECHNICAL IMPLEMENTATION:
 * - All borders use inset box-shadow with specific directional mapping:
 *   * Top: inset 0 1px 0 0
 *   * Right: inset -1px 0 0 0
 *   * Bottom: inset 0 -1px 0 0
 *   * Left: inset 1px 0 0 0
 * - Selection borders (blue) override table borders (red) in same pseudo-element
 * - Sticky borders replace regular borders with thicker colored variants
 * - Border-collapse mode available as optional feature for future use
 *
 * Note how border disappear for sticky elements when using border-collapse (https://bugzilla.mozilla.org/show_bug.cgi?id=1727594)
 *
 * Next steps:
 *
 * - Mettre le sticky again dans les tables cells (mais les suivantes pour avoir l'effet d'ombre)
 *
 * - Can add a column (+ button at the end of table headers)
 * - Can add a row (+ button at the end of the row number column )
 * - Delete a row (how?)
 * - Delete a column (how?)
 * - Update table column info (I guess a down arrow icon which opens a meny when clicked for instance)
 */

const [useColumnTrackerProviders, useRegisterColumn, useColumnByIndex] = createIsolatedItemTracker();
const [useRowTrackerProvider, useRegisterRow, useRowByIndex] = createItemTracker();
const ColumnProducerProviderContext = createContext();
const ColumnConsumerProviderContext = createContext();
const ColumnContext = createContext();
const RowContext = createContext();
const ColumnIndexContext = createContext();
const RowIndexContext = createContext();
const TableSectionContext = createContext();
const useIsInTableHead = () => useContext(TableSectionContext) === "head";
const Table = forwardRef((props, ref) => {
  const tableDefaultId = `table-${useId()}`;
  const {
    id = tableDefaultId,
    selection = [],
    selectionColor,
    onSelectionChange,
    onColumnSizeChange,
    onRowSizeChange,
    borderCollapse = true,
    stickyLeftFrontierColumnIndex = -1,
    onStickyLeftFrontierChange,
    stickyTopFrontierRowIndex = -1,
    onStickyTopFrontierChange,
    onColumnOrderChange,
    maxWidth,
    maxHeight,
    overflow,
    children
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const tableContainerRef = useRef();
  const tableUIRef = useRef();
  const [ColumnProducerProvider, ColumnConsumerProvider, columns] = useColumnTrackerProviders();
  const RowTrackerProvider = useRowTrackerProvider();
  const rows = RowTrackerProvider.items;

  // selection
  const selectionController = useTableSelectionController({
    tableRef: innerRef,
    selection,
    onSelectionChange,
    selectionColor
  });
  const selectionContextValue = useTableSelectionContextValue(selection, selectionController);
  useFocusGroup(innerRef);

  // sticky
  useStickyGroup(tableContainerRef, {
    elementSelector: ".navi_table",
    elementReceivingCumulativeStickyPositionRef: tableUIRef
  });
  const stickyContextValue = useTableStickyContextValue({
    stickyLeftFrontierColumnIndex,
    stickyTopFrontierRowIndex,
    onStickyLeftFrontierChange,
    onStickyTopFrontierChange
  });

  // drag columns
  const tableRootRef = useRef();
  const setColumnOrder = columnIdsNewOrder => {
    // the code below ensures we re-render the selection when column are re-ordered
    // forcing each previously selected <td> to unselect and newly selected <td> to be selected
    // (because the corresponding DOM node is now different)
    onSelectionChange?.([...selection]);
    onColumnOrderChange?.(columnIdsNewOrder);
  };
  const tableDragCloneContainerRef = useRef();
  const tableColumnDropPreviewRef = useRef();
  const dragContextValue = useTableDragContextValue({
    tableDragCloneContainerRef,
    tableColumnDropPreviewRef,
    setColumnOrder,
    columns,
    canChangeColumnOrder: Boolean(onColumnOrderChange)
  });
  useKeyboardShortcuts(innerRef, [...createSelectionKeyboardShortcuts(selectionController, {
    toggleEnabled: true,
    enabled: () => dragContextValue.grabTarget === null
  }), {
    key: "enter",
    description: "Edit table cell content",
    enabled: () => dragContextValue.grabTarget === null,
    handler: () => {
      // Find the currently focused cell
      const activeCell = document.activeElement.closest("td");
      if (!activeCell) {
        return false;
      }
      activeCell.dispatchEvent(new CustomEvent("editrequested", {
        bubbles: false
      }));
      return true;
    }
  }, {
    key: "a-z",
    description: "Start editing table cell content",
    enabled: () => dragContextValue.grabTarget === null,
    handler: e => {
      const activeCell = document.activeElement.closest("td");
      if (!activeCell) {
        return false;
      }
      activeCell.dispatchEvent(new CustomEvent("editrequested", {
        bubbles: false,
        detail: {
          initialValue: e.key
        }
      }));
      return true;
    }
  }]);

  // resizing
  const columnResizerRef = useRef();
  const rowResizerRef = useRef();
  const tableSizeContextValue = useTableSizeContextValue({
    onColumnSizeChange,
    onRowSizeChange,
    columns,
    rows,
    columnResizerRef,
    rowResizerRef
  });
  return jsx("div", {
    ref: tableRootRef,
    className: "navi_table_root",
    style: {
      overflow,
      "--table-max-width": maxWidth ? `${maxWidth}px` : undefined,
      "--table-max-height": maxHeight ? `${maxHeight}px` : undefined
    },
    children: jsxs("div", {
      ref: tableContainerRef,
      className: "navi_table_container",
      children: [jsx("table", {
        ref: innerRef,
        id: id,
        className: "navi_table",
        "aria-multiselectable": "true",
        "data-multiselection": selection.length > 1 ? "" : undefined,
        "data-border-collapse": borderCollapse ? "" : undefined,
        "data-droppable": "",
        children: jsx(TableSizeContext.Provider, {
          value: tableSizeContextValue,
          children: jsx(TableSelectionContext.Provider, {
            value: selectionContextValue,
            children: jsx(TableDragContext.Provider, {
              value: dragContextValue,
              children: jsx(TableStickyContext.Provider, {
                value: stickyContextValue,
                children: jsx(ColumnProducerProviderContext.Provider, {
                  value: ColumnProducerProvider,
                  children: jsx(ColumnConsumerProviderContext.Provider, {
                    value: ColumnConsumerProvider,
                    children: jsx(RowTrackerProvider, {
                      children: children
                    })
                  })
                })
              })
            })
          })
        })
      }), jsxs(TableUI, {
        ref: tableUIRef,
        tableRef: innerRef,
        tableId: id,
        children: [jsx(TableStickyContext.Provider, {
          value: stickyContextValue,
          children: jsx(TableStickyFrontier, {
            tableRef: innerRef
          })
        }), jsx(TableColumnResizer, {
          ref: columnResizerRef
        }), jsx(TableRowResizer, {
          ref: rowResizerRef
        }), jsx(TableDragCloneContainer, {
          ref: tableDragCloneContainerRef,
          tableId: id
        }), jsx(TableColumnDropPreview, {
          ref: tableColumnDropPreviewRef
        })]
      })]
    })
  });
});
const Colgroup = ({
  children
}) => {
  const ColumnProducerProvider = useContext(ColumnProducerProviderContext);
  return jsx("colgroup", {
    className: "navi_colgroup",
    children: jsx(ColumnProducerProvider, {
      children: children
    })
  });
};
const Col = ({
  id,
  width,
  immovable,
  backgroundColor
}) => {
  const columnIndex = useRegisterColumn({
    id,
    width,
    immovable,
    backgroundColor
  });
  const {
    stickyLeftFrontierColumnIndex
  } = useContext(TableStickyContext);
  const isStickyLeft = columnIndex <= stickyLeftFrontierColumnIndex;
  return jsx("col", {
    className: "navi_col",
    id: id,
    "data-sticky-left": isStickyLeft ? "" : undefined,
    "data-drag-sticky-left-frontier": isStickyLeft ? "" : undefined,
    "data-drag-obstacle": immovable ? "move-column" : undefined,
    style: {
      minWidth: width ? `${width}px` : undefined,
      maxWidth: width ? `${width}px` : undefined
    }
  });
};
const Thead = ({
  children
}) => {
  return jsx("thead", {
    children: jsx(TableSectionContext.Provider, {
      value: "head",
      children: children
    })
  });
};
const Tbody = ({
  children
}) => {
  return jsx("tbody", {
    children: jsx(TableSectionContext.Provider, {
      value: "body",
      children: children
    })
  });
};
const Tr = ({
  id,
  height,
  children
}) => {
  if (!id) {
    console.warn("<Tr /> must have an id prop to enable selection");
  }
  id = String(id); // we need strings as this value is going to be used in data attributes
  // and when generating cell ids

  const {
    selectedRowIds
  } = useContext(TableSelectionContext);
  const {
    stickyTopFrontierRowIndex
  } = useContext(TableStickyContext);
  const rowIndex = useRegisterRow({
    id,
    height
  });
  const row = useRowByIndex(rowIndex);
  const ColumnConsumerProvider = useContext(ColumnConsumerProviderContext);
  const isStickyTop = rowIndex <= stickyTopFrontierRowIndex;
  const isStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;
  const isRowSelected = selectedRowIds.includes(id);
  children = toChildArray(children);

  /* We use <TableRowCells> to be able to provide <ColumnConsumerProvider />  
  that is needed by useColumnByIndex */

  return jsx("tr", {
    className: "navi_tr",
    "data-row-id": id ? id : undefined,
    "aria-selected": isRowSelected,
    "data-sticky-top": isStickyTop ? "" : undefined,
    "data-drag-sticky-top-frontier": isStickyTopFrontier ? "" : undefined,
    style: {
      height: height ? `${height}px` : undefined,
      maxHeight: height ? `${height}px` : undefined
    },
    children: jsx(ColumnConsumerProvider, {
      children: jsx(TableRowCells, {
        rowIndex: rowIndex,
        row: row,
        children: children
      })
    })
  });
};
const TableRowCells = ({
  children,
  rowIndex,
  row
}) => {
  return children.map((child, columnIndex) => {
    const column = useColumnByIndex(columnIndex);
    const columnId = column.id;
    return jsx(RowContext.Provider, {
      value: row,
      children: jsx(RowIndexContext.Provider, {
        value: rowIndex,
        children: jsx(ColumnIndexContext.Provider, {
          value: columnIndex,
          children: jsx(ColumnContext.Provider, {
            value: column,
            children: child
          })
        })
      })
    }, columnId);
  });
};
const TableCell = forwardRef((props, ref) => {
  const column = useContext(ColumnContext);
  const row = useContext(RowContext);
  const columnIndex = useContext(ColumnIndexContext);
  const rowIndex = useContext(RowIndexContext);
  const {
    className = "",
    canSelectAll,
    canDragColumn,
    canResizeWidth,
    canResizeHeight,
    selectionImpact,
    onClick,
    action,
    name,
    valueSignal,
    // appeareance
    style,
    cursor,
    bold,
    alignX = column.alignX,
    alignY = column.alignY,
    backgroundColor = column.backgroundColor || row.backgroundColor,
    children
  } = props;
  const cellRef = useRef();
  const isFirstRow = rowIndex === 0;
  const isFirstColumn = columnIndex === 0;

  // editing
  const editable = Boolean(action);
  const {
    editing,
    startEditing,
    stopEditing
  } = useEditionController();
  useImperativeHandle(ref, () => ({
    startEditing,
    stopEditing,
    element: cellRef.current
  }));

  // stickyness
  const {
    stickyLeftFrontierColumnIndex,
    stickyTopFrontierRowIndex
  } = useContext(TableStickyContext);
  const stickyLeft = columnIndex <= stickyLeftFrontierColumnIndex;
  const stickyTop = rowIndex <= stickyTopFrontierRowIndex;
  const isStickyLeftFrontier = columnIndex === stickyLeftFrontierColumnIndex;
  const isAfterStickyLeftFrontier = columnIndex === stickyLeftFrontierColumnIndex + 1;
  const isStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;
  const isAfterStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex + 1;

  // selection
  const rowId = row.id;
  const columnId = column.id;
  const selectionValue = stringifyTableSelectionValue("cell", {
    rowId,
    columnId
  });
  const {
    selection,
    selectionController,
    columnIdWithSomeSelectedCellSet,
    rowIdWithSomeSelectedCellSet
  } = useContext(TableSelectionContext);
  const innerSelectionImpact = selectionImpact === undefined ? isFirstRow && isFirstColumn && canSelectAll ? allValues => {
    const cells = allValues.filter(v => parseTableSelectionValue(v).type === "cell");
    return cells;
  } : isFirstRow ? allValues => {
    const columnCells = allValues.filter(v => {
      const selectionValueInfo = parseTableSelectionValue(v);
      return selectionValueInfo.type === "cell" && selectionValueInfo.columnId === columnId;
    });
    return columnCells;
  } : isFirstColumn ? allValues => {
    const rowCells = allValues.filter(v => {
      const selectionValueInfo = parseTableSelectionValue(v);
      return selectionValueInfo.type === "cell" && selectionValueInfo.rowId === rowId;
    });
    return rowCells;
  } : undefined : selectionImpact;
  const {
    selected
  } = useSelectableElement(cellRef, {
    selection,
    selectionController,
    selectionImpact: innerSelectionImpact
    // value: selectionId,
  });

  // moving column
  const {
    tableDragCloneContainerRef,
    tableColumnDropPreviewRef,
    grabTarget,
    grabColumn,
    releaseColumn,
    canChangeColumnOrder
  } = useContext(TableDragContext);
  const columnGrabbed = grabTarget === `column:${columnIndex}`;

  // resizing
  const innerCanDragColumn = canDragColumn === undefined ? rowIndex === 0 && !column.immovable && Boolean(canChangeColumnOrder) : canDragColumn;
  const innerCanResizeWidth = canResizeWidth === undefined ? rowIndex === 0 : canResizeWidth;
  const innerCanResizeHeight = canResizeHeight === undefined ? columnIndex === 0 : canResizeHeight;

  // display
  const isInTableHead = useIsInTableHead();
  const innerStyle = {
    ...style
  };
  const columnContainsSelectedCell = columnIdWithSomeSelectedCellSet.has(columnId);
  const rowContainsSelectedCell = rowIdWithSomeSelectedCellSet.has(rowId);
  const containSelectedCell = isFirstRow && columnContainsSelectedCell || isFirstColumn && rowContainsSelectedCell;

  // appeareance
  const innerBackgroundColor = backgroundColor || containSelectedCell ? "var(--selection-background-color)" : isFirstColumn ? "#F8F8F8" : isFirstRow ? "#d3e7ff" : "white";
  {
    innerStyle["--background-color"] = innerBackgroundColor;
  }
  if (cursor) {
    innerStyle.cursor = cursor;
  }
  const columnWidth = column.width;
  if (columnWidth !== undefined) {
    innerStyle.minWidth = `${columnWidth}px`;
    innerStyle.width = `${columnWidth}px`;
    innerStyle.maxWidth = `${columnWidth}px`;
  }
  const rowHeight = row.height;
  if (rowHeight !== undefined) {
    innerStyle.maxHeight = `${rowHeight}px`;
  }
  const innerAlignX = alignX || isFirstRow ? "center" : "start";
  const innerAlignY = alignY || isFirstColumn ? "center" : "start";
  const innerBold = bold || containSelectedCell;
  if (innerBold) {
    innerStyle.fontWeight = "bold";
  }
  const activeElement = useActiveElement();
  const TagName = isInTableHead ? "th" : "td";
  return jsxs(TagName, {
    className: ["navi_table_cell", ...className.split(" ")].join(" "),
    ref: cellRef,
    style: innerStyle,
    "data-align-x": innerAlignX,
    "data-align-y": innerAlignY
    // we use [data-focus] so that the attribute can be copied
    // to the dragged cell copies
    ,
    "data-focus": activeElement === cellRef.current ? "" : undefined,
    "data-first-row": isFirstRow ? "" : undefined,
    "data-first-column": isFirstColumn ? "" : undefined,
    "data-sticky-left": stickyLeft ? "" : undefined,
    "data-sticky-top": stickyTop ? "" : undefined,
    "data-sticky-left-frontier": stickyLeft && isStickyLeftFrontier ? "" : undefined,
    "data-sticky-top-frontier": stickyTop && isStickyTopFrontier ? "" : undefined,
    "data-after-sticky-left-frontier": isAfterStickyLeftFrontier ? "" : undefined,
    "data-after-sticky-top-frontier": isAfterStickyTopFrontier ? "" : undefined,
    tabIndex: -1,
    "data-height-xxs": rowHeight !== undefined && rowHeight < 42 ? "" : undefined,
    "data-width-xxs": columnWidth !== undefined && columnWidth < 42 ? "" : undefined,
    "data-selection-name": isInTableHead ? "column" : "cell",
    "data-selection-keyboard-toggle": true,
    "aria-selected": selected,
    "data-value": selectionValue,
    "data-editing": editing ? "" : undefined,
    "data-grabbed": columnGrabbed ? "" : undefined,
    onClick: onClick,
    onPointerDown: e => {
      if (!innerCanDragColumn) {
        return;
      }
      if (e.button !== 0) {
        return;
      }
      initDragTableColumnViaPointer(e, {
        tableDragCloneContainer: tableDragCloneContainerRef.current,
        dropPreview: tableColumnDropPreviewRef.current,
        onGrab: () => grabColumn(columnIndex),
        onDrag: () => {},
        onRelease: (_, newColumnIndex) => releaseColumn(columnIndex, newColumnIndex)
      });
    },
    onDoubleClick: e => {
      if (!editable) {
        return;
      }
      startEditing(e);
    },
    oneditrequested: e => {
      if (!editable) {
        return;
      }
      startEditing(e);
    },
    children: [editable ? jsx(Editable, {
      editing: editing,
      onEditEnd: stopEditing,
      value: children,
      action: action,
      name: name,
      valueSignal: valueSignal,
      height: "100%",
      width: "100%",
      children: children
    }) : children, innerCanResizeWidth && jsx(TableCellColumnResizeHandles, {
      columnIndex: columnIndex,
      columnMinWidth: column.minWidth,
      columnMaxWidth: column.maxWidth
    }), innerCanResizeHeight && jsx(TableCellRowResizeHandles, {
      rowIndex: rowIndex,
      rowMinHeight: row.minHeight,
      rowMaxHeight: row.maxHeight
    }), isInTableHead && jsx("span", {
      className: "navi_table_cell_content_bold_clone",
      "aria-hidden": "true",
      children: children
    }), jsx("div", {
      className: "navi_table_cell_foreground",
      "data-visible": columnGrabbed ? "" : undefined
    })]
  });
});
const RowNumberCol = ({
  width = 50,
  minWidth = 30,
  maxWidth = 100,
  immovable = true,
  ...rest
}) => {
  return jsx(Col, {
    id: "row_number",
    width: width,
    minWidth: minWidth,
    maxWidth: maxWidth,
    immovable: immovable,
    ...rest
  });
};
const RowNumberTableCell = props => {
  const columnIndex = useContext(ColumnIndexContext);
  const rowIndex = useContext(RowIndexContext);
  const isTopLeftCell = columnIndex === 0 && rowIndex === 0;
  return jsx(TableCell, {
    canSelectAll: isTopLeftCell,
    alignX: "left",
    ...props,
    children: isTopLeftCell ? "" : rowIndex
  });
};

const useCellsAndColumns = (cells, columns) => {
  const [columnIds, idToColumnMap] = useMemo(() => {
    const columnIds = [];
    const idToColumnMap = new Map();
    for (const column of columns) {
      const columnId = column.id;
      columnIds.push(columnId);
      idToColumnMap.set(columnId, column);
    }
    return [columnIds, idToColumnMap];
  }, [columns]);
  const [orderedAllColumnIds, setOrderedAllColumnIds] = useState(columnIds);
  const orderedColumnIds = [];
  for (const columnId of orderedAllColumnIds) {
    if (!columnIds.includes(columnId)) {
      // generated column (like the row column)
      continue;
    }
    orderedColumnIds.push(columnId);
  }
  const orderedColumns = [];
  for (const columnId of orderedColumnIds) {
    const column = idToColumnMap.get(columnId);
    orderedColumns.push(column);
  }

  // Base cell values in original column order (2D array: rows x columns)
  const [baseCells, setBaseCells] = useState(cells);

  // Memoized index mapping for performance - maps display index to original index
  const columnOrderedIndexMap = useMemo(() => {
    const indexMap = new Map();
    for (let columnIndex = 0; columnIndex < columnIds.length; columnIndex++) {
      const columnIdAtThisIndex = orderedColumnIds[columnIndex];
      const originalIndex = columnIds.indexOf(columnIdAtThisIndex);
      indexMap.set(columnIndex, originalIndex);
    }
    return indexMap;
  }, [columnIds, orderedColumnIds]);

  // Derived state: reorder cell values according to column display order
  const orderedCells = useMemo(() => {
    const reorderedCells = [];
    for (let y = 0; y < baseCells.length; y++) {
      const originalRow = baseCells[y];
      const reorderedRow = [];
      for (let x = 0; x < orderedColumnIds.length; x++) {
        const columnOrderedIndex = columnOrderedIndexMap.get(x);
        const cellValue = originalRow[columnOrderedIndex];
        reorderedRow.push(cellValue);
      }
      reorderedCells.push(reorderedRow);
    }
    return reorderedCells;
  }, [baseCells, columnOrderedIndexMap, orderedColumnIds.length]);

  const setCellValue = ({ columnIndex, rowIndex }, value) => {
    const originalColumnIndex = columnOrderedIndexMap.get(columnIndex);
    if (originalColumnIndex === undefined) {
      console.warn(`Invalid column index: ${columnIndex}`);
      return;
    }
    setBaseCells((previousCells) => {
      const newCells = [];
      for (let y = 0; y < previousCells.length; y++) {
        const currentRow = previousCells[y];
        if (y !== rowIndex) {
          newCells.push(currentRow);
          continue;
        }
        const newRow = [];
        for (let x = 0; x < currentRow.length; x++) {
          const cellValue = x === originalColumnIndex ? value : currentRow[x];
          newRow.push(cellValue);
        }
        newCells.push(newRow);
      }
      return newCells;
    });
  };

  return {
    cells: orderedCells,
    setCellValue,
    columns: orderedColumns,
    setColumnOrder: setOrderedAllColumnIds,
  };
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_tablist {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    justify-content: space-between;
  }

  .navi_tablist > ul {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .navi_tablist > ul > li {
    display: inline-flex;
    position: relative;
  }

  .navi_tab {
    white-space: nowrap;
    display: flex;
    flex-direction: column;
  }

  .navi_tab_content {
    transition: background 0.12s ease-out;
    border-radius: 6px;
    text-decoration: none;
    line-height: 30px;
    display: flex;
    padding: 0 0.5rem;
  }

  .navi_tab:hover .navi_tab_content {
    background: #dae0e7;
    color: #010409;
  }

  .navi_tab .active_marker {
    display: flex;
    background: transparent;
    border-radius: 0.1px;
    width: 100%;
    z-index: 1;
    height: 2px;
    margin-top: 5px;
  }

  /* Hidden bold clone to reserve space for bold width without affecting height */
  .navi_tab_content_bold_clone {
    font-weight: 600; /* force bold to compute max width */
    visibility: hidden; /* not visible */
    display: block; /* in-flow so it contributes to width */
    height: 0; /* zero height so it doesn't change layout height */
    overflow: hidden; /* avoid any accidental height */
    pointer-events: none; /* inert */
  }

  .navi_tab[aria-selected="true"] .active_marker {
    background: rgb(205, 52, 37);
  }

  .navi_tab[aria-selected="true"] .navi_tab_content {
    font-weight: 600;
  }
`;
const TabList = ({
  children,
  ...props
}) => {
  return jsx("nav", {
    className: "navi_tablist",
    role: "tablist",
    ...props,
    children: jsx("ul", {
      children: children.map(child => {
        return jsx("li", {
          children: child
        }, child.props.key);
      })
    })
  });
};
const Tab = ({
  children,
  selected,
  ...props
}) => {
  return jsxs("div", {
    className: "navi_tab",
    role: "tab",
    "aria-selected": selected ? "true" : "false",
    ...props,
    children: [jsx("div", {
      className: "navi_tab_content",
      children: children
    }), jsx("div", {
      className: "navi_tab_content_bold_clone",
      "aria-hidden": "true",
      children: children
    }), jsx("span", {
      className: "active_marker"
    })]
  });
};

/**
 * Creates a signal that stays synchronized with an external value,
 * only updating the signal when the value actually changes.
 *
 * This hook solves a common reactive UI pattern where:
 * 1. A signal controls a UI element (like an input field)
 * 2. The UI element can be modified by user interaction
 * 3. When the external "source of truth" changes, it should take precedence
 *
 * @param {any} value - The external value to sync with (the "source of truth")
 * @param {any} [initialValue] - Optional initial value for the signal (defaults to value)
 * @returns {Signal} A signal that tracks the external value but allows temporary local changes
 *
 * @example
 * const FileNameEditor = ({ file }) => {
 *   // Signal stays in sync with file.name, but allows user editing
 *   const nameSignal = useSignalSync(file.name);
 *
 *   return (
 *     <Editable
 *       valueSignal={nameSignal}  // User can edit this
 *       action={renameFileAction} // Saves changes
 *     />
 *   );
 * };
 *
 * // Scenario:
 * // 1. file.name = "doc.txt", nameSignal.value = "doc.txt"
 * // 2. User types "report" -> nameSignal.value = "report.txt"
 * // 3. External update: file.name = "shared-doc.txt"
 * // 4. Next render: nameSignal.value = "shared-doc.txt" (model wins!)
 *
 */

const useSignalSync = (value, initialValue = value) => {
  const signal = useSignal(initialValue);
  const previousValueRef = useRef(value);

  // Only update signal when external value actually changes
  // This preserves user input between external changes
  if (previousValueRef.current !== value) {
    previousValueRef.current = value;
    signal.value = value; // Model takes precedence
  }

  return signal;
};

/**
 * FontSizedSvg component
 *
 * This component wraps an SVG element to make it inherit the current font size.
 * It creates a container that's exactly 1em × 1em in size, allowing the SVG to scale
 * proportionally with the surrounding text.
 *
 * Usage:
 * ```jsx
 * <FontSizedSvg>
 *   <svg width="100%" height="100%" viewBox="...">
 *     <path d="..." />
 *    </svg>
 * </FontSizedSvg>
 * ```
 *
 * Notes:
 * - The wrapped SVG should use width="100%" and height="100%" to fill the container
 * - This ensures SVG icons match the current text size without additional styling
 * - Useful for inline icons that should respect the parent's font-size
 */

const FontSizedSvg = ({
  width = "1em",
  height = "1em",
  children,
  ...props
}) => {
  return jsx("span", {
    ...props,
    style: {
      display: "flex",
      alignItems: "center",
      width,
      height,
      justifySelf: "center",
      lineHeight: "1em",
      flexShrink: 0
    },
    children: children
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .link_with_icon {
    white-space: nowrap;
    align-items: center;
    gap: 0.3em;
    min-width: 0;
    display: inline-flex;
    flex-grow: 1;
  }
`;
const LinkWithIcon = ({
  icon,
  isCurrent,
  children,
  className = "",
  ...rest
}) => {
  return jsxs(Link, {
    className: ["link_with_icon", ...className.split(" ")].join(" "),
    ...rest,
    children: [jsx(FontSizedSvg, {
      children: icon
    }), isCurrent && jsx(FontSizedSvg, {
      children: jsx(CurrentSvg, {})
    }), children]
  });
};
const CurrentSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 16 16",
    width: "100%",
    height: "100%",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      d: "m 8 0 c -3.3125 0 -6 2.6875 -6 6 c 0.007812 0.710938 0.136719 1.414062 0.386719 2.078125 l -0.015625 -0.003906 c 0.636718 1.988281 3.78125 5.082031 5.625 6.929687 h 0.003906 v -0.003906 c 1.507812 -1.507812 3.878906 -3.925781 5.046875 -5.753906 c 0.261719 -0.414063 0.46875 -0.808594 0.585937 -1.171875 l -0.019531 0.003906 c 0.25 -0.664063 0.382813 -1.367187 0.386719 -2.078125 c 0 -3.3125 -2.683594 -6 -6 -6 z m 0 3.691406 c 1.273438 0 2.308594 1.035156 2.308594 2.308594 s -1.035156 2.308594 -2.308594 2.308594 c -1.273438 -0.003906 -2.304688 -1.035156 -2.304688 -2.308594 c -0.003906 -1.273438 1.03125 -2.304688 2.304688 -2.308594 z m 0 0",
      fill: "#2e3436"
    })
  });
};

const IconAndText = ({
  icon,
  children,
  ...rest
}) => {
  if (typeof icon === "function") icon = icon({});
  return jsxs("span", {
    className: "icon_and_text",
    ...rest,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "0.1em",
      ...rest.style
    },
    children: [jsx(FontSizedSvg, {
      className: "icon",
      children: icon
    }), jsx("span", {
      className: "text",
      children: children
    })]
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .svg_mask_content * {
    fill: black !important;
    stroke: black !important;
    fill-opacity: 1 !important;
    stroke-opacity: 1 !important;
    color: black !important;
    opacity: 1 !important;
  }
`;
const SVGMaskOverlay = ({
  viewBox,
  children
}) => {
  if (!Array.isArray(children)) {
    return children;
  }
  if (children.length === 1) {
    return children[0];
  }
  if (!viewBox) {
    console.error("SVGComposition requires an explicit viewBox");
    return null;
  }

  // First SVG is the base, all others are overlays
  const [baseSvg, ...overlaySvgs] = children;

  // Generate unique ID for this instance
  const instanceId = `svgmo-${Math.random().toString(36).slice(2, 9)}`;

  // Create nested masked elements
  let maskedElement = baseSvg;

  // Apply each mask in sequence
  overlaySvgs.forEach((overlaySvg, index) => {
    const maskId = `mask-${instanceId}-${index}`;
    maskedElement = jsx("g", {
      mask: `url(#${maskId})`,
      children: maskedElement
    });
  });
  return jsxs("svg", {
    viewBox: viewBox,
    width: "100%",
    height: "100%",
    children: [jsx("defs", {
      children: overlaySvgs.map((overlaySvg, index) => {
        const maskId = `mask-${instanceId}-${index}`;

        // IMPORTANT: clone the overlay SVG exactly as is, just add the mask class
        return jsxs("mask", {
          id: maskId,
          children: [jsx("rect", {
            width: "100%",
            height: "100%",
            fill: "white"
          }), cloneElement(overlaySvg, {
            className: "svg_mask_content" // Apply styling to make it black
          })]
        }, maskId);
      })
    }), maskedElement, overlaySvgs]
  });
};

const Overflow = ({
  className,
  children,
  afterContent
}) => {
  return jsx("div", {
    className: className,
    style: "display: flex; flex-wrap: wrap; overflow: hidden; width: 100%; box-sizing: border-box; white-space: nowrap; text-overflow: ellipsis;",
    children: jsxs("div", {
      style: "display: flex; flex-grow: 1; width: 0; gap: 0.3em",
      children: [jsx("div", {
        style: "overflow: hidden; max-width: 100%; text-overflow: ellipsis;",
        children: children
      }), afterContent]
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .text_and_count {
    display: flex;
    align-items: center;
    gap: 3px;
    flex: 1;
    white-space: nowrap;
  }

  .count {
    position: relative;
    top: -1px;
    color: rgba(28, 43, 52, 0.4);
  }
`;
const TextAndCount = ({
  text,
  count
}) => {
  return jsx(Overflow, {
    className: "text_and_count",
    afterContent: count > 0 && jsxs("span", {
      className: "count",
      children: ["(", count, ")"]
    }),
    children: jsx("span", {
      className: "label",
      children: text
    })
  });
};

const createUniqueValueConstraint = (
  // the set might be incomplete (the front usually don't have the full copy of all the items from the backend)
  // but this is already nice to help user with what we know
  // it's also possible that front is unsync with backend, preventing user to choose a value
  // that is actually free.
  // But this is unlikely to happen and user could reload the page to be able to choose that name
  // that suddenly became available
  existingValueSet,
  message = `"{value}" already exists. Please choose another value.`,
) => {
  return {
    name: "unique_value",
    check: (input) => {
      const inputValue = input.value;
      const hasConflict = existingValueSet.has(inputValue);
      // console.log({
      //   inputValue,
      //   names: Array.from(otherNameSet.values()),
      //   hasConflict,
      // });
      if (hasConflict) {
        return message.replace("{value}", inputValue);
      }
      return "";
    },
  };
};

const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  check: (input) => {
    const inputValue = input.value;
    const hasLeadingSpace = inputValue.startsWith(" ");
    const hasTrailingSpace = inputValue.endsWith(" ");
    const hasDoubleSpace = inputValue.includes("  ");
    if (hasLeadingSpace || hasDoubleSpace || hasTrailingSpace) {
      return "Spaces at the beginning, end, or consecutive spaces are not allowed";
    }
    return "";
  },
};

/*
 * - Usage
 * useEffect(() => {
 *   // here you want to know what has changed, causing useEffect to be called
 * }, [name, value])
 *
 * const diff = useDependenciesDiff({ name, value })
 * useEffect(() => {
 *   console.log('useEffect called because', diff)
 * }, [name, value])
 */


const useDependenciesDiff = (inputs) => {
  const oldInputsRef = useRef(inputs);
  const inputValuesArray = Object.values(inputs);
  const inputKeysArray = Object.keys(inputs);
  const diffRef = useRef();
  useMemo(() => {
    const oldInputs = oldInputsRef.current;
    const diff = {};
    for (const key of inputKeysArray) {
      const previous = oldInputs[key];
      const current = inputs[key];
      if (previous !== current) {
        diff[key] = { previous, current };
      }
    }
    diffRef.current = diff;
    oldInputsRef.current = inputs;
  }, inputValuesArray);

  return diffRef.current;
};

export { ActionRenderer, ActiveKeyboardShortcuts, Button, Checkbox, CheckboxList, Col, Colgroup, Details, Editable, ErrorBoundaryContext, FontSizedSvg, Form, IconAndText, Input, Label, Link, LinkWithIcon, Overflow, Radio, RadioList, Route, RowNumberCol, RowNumberTableCell, SINGLE_SPACE_CONSTRAINT, SVGMaskOverlay, Select, SelectionContext, SummaryMarker, Tab, TabList, Table, TableCell, Tbody, TextAndCount, Thead, Tr, UITransition, actionIntegratedVia, addCustomMessage, createAction, createSelectionKeyboardShortcuts, createUniqueValueConstraint, defineRoutes, enableDebugActions, enableDebugOnDocumentLoading, goBack, goForward, goTo, isCellSelected, isColumnSelected, isRowSelected, openCallout, reload, removeCustomMessage, rerunActions, resource, setBaseUrl, stopLoad, stringifyTableSelectionValue, updateActions, useActionData, useActionStatus, useCellsAndColumns, useDependenciesDiff, useDocumentState, useDocumentUrl, useEditionController, useFocusGroup, useKeyboardShortcuts, useNavState, useRouteStatus, useRunOnMount, useSelectableElement, useSelectionController, useSignalSync, useStateArray, valueInLocalStorage };
