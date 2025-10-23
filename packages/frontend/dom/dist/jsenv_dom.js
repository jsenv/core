import { d, E, d$1, _ } from "/jsenv_dom_node_modules.js";

const createIterableWeakSet = () => {
  const objectWeakRefSet = new Set();
  return {
    add: object => {
      const objectWeakRef = new WeakRef(object);
      objectWeakRefSet.add(objectWeakRef);
    },
    delete: object => {
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
    has: object => {
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
      return {
        total: objectWeakRefSet.size,
        alive,
        dead
      };
    }
  };
};

const createPubSub = () => {
  const callbackSet = new Set();
  const publish = (...args) => {
    const results = [];
    for (const callback of callbackSet) {
      const result = callback(...args);
      results.push(result);
    }
    return results;
  };
  const subscribe = callback => {
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


const isDocumentElement = node => node === node.ownerDocument.documentElement;









const elementToOwnerWindow = element => {
  if (elementIsWindow(element)) {
    return element;
  }
  if (elementIsDocument(element)) {
    return element.defaultView;
  }
  return elementToOwnerDocument(element).defaultView;
};








const elementToOwnerDocument = element => {
  if (elementIsWindow(element)) {
    return element.document;
  }
  if (elementIsDocument(element)) {
    return element;
  }
  return element.ownerDocument;
};
const elementIsWindow = a => a.window === a;
const elementIsDocument = a => a.nodeType === 9;
const elementIsDetails = ({
  nodeName
}) => nodeName === "DETAILS";
const elementIsSummary = ({
  nodeName
}) => nodeName === "SUMMARY";


const getAssociatedElements = element => {
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




  return null;
};

const getComputedStyle$1 = element => elementToOwnerWindow(element).getComputedStyle(element);
const getStyle = (element, name) => getComputedStyle$1(element).getPropertyValue(name);
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
const forceStyle = (element, name, value) => {
  const inlineStyleValue = element.style[name];
  if (inlineStyleValue === value) {
    return () => {};
  }
  const computedStyleValue = getStyle(element, name);
  if (computedStyleValue === value) {
    return () => {};
  }
  const restoreStyle = setStyle(element, name, value);
  return restoreStyle;
};
const addWillChange = (element, property) => {
  const currentWillChange = element.style.willChange;
  const willChangeValues = currentWillChange ? currentWillChange.split(",").map(v => v.trim()).filter(Boolean) : [];
  if (willChangeValues.includes(property)) {

    return () => {};
  }
  willChangeValues.push(property);
  element.style.willChange = willChangeValues.join(", ");

  return () => {
    const newValues = willChangeValues.filter(v => v !== property);
    if (newValues.length === 0) {
      element.style.removeProperty("will-change");
    } else {
      element.style.willChange = newValues.join(", ");
    }
  };
};
const createSetMany$1 = setter => {
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
const forceStyles = createSetMany$1(forceStyle);


const pxProperties = ["width", "height", "top", "left", "right", "bottom", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "border", "borderWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "fontSize", "lineHeight", "letterSpacing", "wordSpacing", "translateX", "translateY", "translateZ", "borderRadius", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"];


const degProperties = ["rotate", "rotateX", "rotateY", "rotateZ", "skew", "skewX", "skewY"];


const unitlessProperties = ["opacity", "zIndex", "flexGrow", "flexShrink", "order", "columnCount", "scale", "scaleX", "scaleY", "scaleZ"];


const normalizeStyle = (value, propertyName, context = "js") => {
  if (propertyName === "transform") {
    if (context === "js") {
      if (typeof value === "string") {

        return parseCSSTransform(value);
      }


      const transformNormalized = {};
      for (const key of Object.keys(value)) {
        const partValue = normalizeStyle(value[key], key, "js");
        transformNormalized[key] = partValue;
      }
      return transformNormalized;
    }
    if (typeof value === "object" && value !== null) {

      return stringifyCSSTransform(value);
    }
    return value;
  }


  if (propertyName.startsWith("transform.")) {
    if (context === "css") {
      console.warn("normalizeStyle: magic properties like \"".concat(propertyName, "\" are not applicable in \"css\" context. Returning original value."));
      return value;
    }
    const transformProperty = propertyName.slice(10);

    if (typeof value === "string") {
      if (value === "none") {
        return undefined;
      }
      const parsedTransform = parseCSSTransform(value);
      return parsedTransform?.[transformProperty];
    }

    if (typeof value === "object" && value !== null) {
      return value[transformProperty];
    }

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
        console.warn("NaN found for \"".concat(propertyName, "\""));
      }
      return "".concat(value).concat(unit);
    }
    return value;
  }
  if (typeof value === "string") {
    if (value === "auto") {
      return "auto";
    }
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      console.warn("\"".concat(propertyName, "\": ").concat(value, " cannot be converted to number, returning value as-is."));
      return value;
    }
    return numericValue;
  }
  return value;
};


const normalizeStyles = (styles, context = "js") => {
  const normalized = {};
  for (const [key, value] of Object.entries(styles)) {
    normalized[key] = normalizeStyle(value, key, context);
  }
  return normalized;
};


const stringifyCSSTransform = transformObj => {
  const transforms = [];
  for (const key of Object.keys(transformObj)) {
    const transformPartValue = transformObj[key];
    const normalizedTransformPartValue = normalizeStyle(transformPartValue, key, "css");
    transforms.push("".concat(key, "(").concat(normalizedTransformPartValue, ")"));
  }
  return transforms.join(" ");
};


const parseCSSTransform = transformString => {
  if (!transformString || transformString === "none") {
    return undefined;
  }
  const transformObj = {};


  const transformPattern = /(\w+)\(([^)]+)\)/g;
  let match;
  while ((match = transformPattern.exec(transformString)) !== null) {
    const [, functionName, value] = match;


    if (functionName === "matrix" || functionName === "matrix3d") {
      const matrixComponents = parseMatrixTransform(match[0]);
      if (matrixComponents) {

        Object.assign(transformObj, matrixComponents);
      }

      continue;
    }


    const normalizedValue = normalizeStyle(value.trim(), functionName, "js");
    if (normalizedValue !== undefined) {
      transformObj[functionName] = normalizedValue;
    }
  }


  return Object.keys(transformObj).length > 0 ? transformObj : undefined;
};


const parseMatrixTransform = matrixString => {

  const matrixMatch = matrixString.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!matrixMatch) {
    return null;
  }
  const values = matrixMatch[1].split(",").map(v => parseFloat(v.trim()));
  if (matrixString.includes("matrix3d")) {

    if (values.length !== 16) {
      return null;
    }
    const [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = values;

    if (c === 0 && d === 0 && g === 0 && h === 0 && i === 0 && j === 0 && k === 1 && l === 0 && o === 0 && p === 1) {

      return parseSimple2DMatrix(a, b, e, f, m, n);
    }
    return null;
  }

  if (values.length !== 6) {
    return null;
  }
  const [a, b, c, d, e, f] = values;
  return parseSimple2DMatrix(a, b, c, d, e, f);
};


const parseSimple2DMatrix = (a, b, c, d, e, f) => {
  const result = {};


  if (e !== 0) {
    result.translateX = e;
  }
  if (f !== 0) {
    result.translateY = f;
  }


  if (a === 1 && b === 0 && c === 0 && d === 1) {
    return result;
  }




  const det = a * d - b * c;

  if (det === 0) {
    return null;
  }


  if (c === 0) {

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


  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = det / scaleX;
  const rotation = Math.atan2(b, a) * (180 / Math.PI);
  const skewX = Math.atan((a * c + b * d) / (scaleX * scaleX)) * (180 / Math.PI);
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


const mergeStyles = (stylesA, stylesB) => {
  const result = {
    ...stylesA
  };
  for (const key of Object.keys(stylesB)) {
    if (key === "transform") {
      result[key] = mergeOneStyle(stylesA[key], stylesB[key], key);
    } else {
      result[key] = stylesB[key];
    }
  }
  return result;
};


const mergeOneStyle = (existingValue, newValue, propertyName, context = "js") => {
  if (propertyName === "transform") {



    const existingIsString = typeof existingValue === "string" && existingValue !== "none";
    const newIsString = typeof newValue === "string" && newValue !== "none";
    const existingIsObject = typeof existingValue === "object" && existingValue !== null;
    const newIsObject = typeof newValue === "object" && newValue !== null;


    if (existingIsObject && newIsObject) {
      const merged = {
        ...existingValue,
        ...newValue
      };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }


    if (newIsObject && existingIsString) {
      const parsedExisting = parseCSSTransform(existingValue);
      const merged = {
        ...parsedExisting,
        ...newValue
      };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }


    if (newIsString && existingIsObject) {
      const parsedNew = parseCSSTransform(newValue);
      const merged = {
        ...existingValue,
        ...parsedNew
      };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }


    if (existingIsString && newIsString) {
      const parsedExisting = parseCSSTransform(existingValue);
      const parsedNew = parseCSSTransform(newValue);
      const merged = {
        ...parsedExisting,
        ...parsedNew
      };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }


    if (newIsObject) {
      return context === "css" ? stringifyCSSTransform(newValue) : newValue;
    }


    if (newIsString) {
      if (context === "css") {
        return newValue;
      }
      return parseCSSTransform(newValue);
    }
  }


  return newValue;
};





























































const elementControllerSetRegistry = new WeakMap();


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


    if (elementControllerSet.size === 0) {
      elementControllerSetRegistry.delete(element);
    }
  }
};
const createStyleController = (name = "anonymous") => {

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
      const animation = createAnimationForStyles(element, normalizedStylesToSet, name);
      elementWeakMap.set(element, {
        styles: normalizedStylesToSet,
        animation
      });
      onElementControllerAdded(element, controller);
      return;
    }
    const {
      styles,
      animation
    } = elementData;
    const mergedStyles = mergeStyles(styles, normalizedStylesToSet);
    elementData.styles = mergedStyles;
    updateAnimationStyles(animation, mergedStyles);
  };
  const get = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return undefined;
    }
    const {
      styles
    } = elementData;
    if (propertyName === undefined) {
      return {
        ...styles
      };
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
    const {
      styles,
      animation
    } = elementData;
    const hasStyle = Object.hasOwn(styles, propertyName);
    if (!hasStyle) {
      return;
    }
    delete styles[propertyName];
    const isEmpty = Object.keys(styles).length === 0;

    if (isEmpty) {
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
      return;
    }
    updateAnimationStyles(animation, styles);
  };
  const commit = element => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const {
      styles,
      animation
    } = elementData;


    animation.cancel();

    const computedStyles = getComputedStyle(element);

    const cssStyles = normalizeStyles(styles, "css");
    for (const [key, value] of Object.entries(cssStyles)) {

      const existingValue = computedStyles[key];
      element.style[key] = mergeOneStyle(existingValue, value, key, "css");
    }

    elementWeakMap.delete(element);

    onElementControllerRemoved(element, controller);
  };
  const clear = element => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const {
      animation
    } = elementData;
    animation.cancel();
    elementWeakMap.delete(element);
    onElementControllerRemoved(element, controller);
  };
  const getUnderlyingValue = (element, propertyName) => {
    const elementControllerSet = elementControllerSetRegistry.get(element);
    const normalizeValueForJs = value => {

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
          resultValue = mergeOneStyle(resultValue, otherStyles[propertyName], propertyName);
        }
      }






      return normalizeValueForJs(resultValue);
    };
    const getFromDOM = () => {

      if (propertyName.startsWith("transform.")) {
        const transformValue = getComputedStyle(element).transform;
        return normalizeValueForJs(transformValue);
      }

      const computedValue = getComputedStyle(element)[propertyName];
      return normalizeValueForJs(computedValue);
    };
    const getFromDOMLayout = () => {


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
    const getWhileDisablingThisController = fn => {
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        return fn();
      }
      const {
        styles,
        animation
      } = elementData;

      animation.cancel();
      const underlyingValue = fn();

      elementData.animation = createAnimationForStyles(element, styles, name);
      return underlyingValue;
    };
    if (typeof propertyName === "function") {
      return getWhileDisablingThisController(propertyName);
    }


    if (propertyName.startsWith("rect.")) {
      return getWhileDisablingThisController(getFromDOMLayout);
    }
    if (!elementControllerSet || !elementControllerSet.has(controller)) {

      return getFromDOM();
    }

    const valueFromOtherControllers = getFromOtherControllers();
    if (valueFromOtherControllers !== undefined) {
      return valueFromOtherControllers;
    }
    return getWhileDisablingThisController(getFromDOM);
  };
  const clearAll = () => {

    for (const [element, elementControllerSet] of elementControllerSetRegistry) {
      if (!elementControllerSet.has(controller)) {
        continue;
      }
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        continue;
      }
      const {
        animation
      } = elementData;
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
    clearAll
  };
  return controller;
};
const createAnimationForStyles = (element, styles, id) => {
  const cssStylesToSet = normalizeStyles(styles, "css");
  const animation = element.animate([cssStylesToSet], {
    duration: 0,
    fill: "forwards"
  });
  animation.id = id;
  animation.play();
  animation.pause();
  return animation;
};
const updateAnimationStyles = (animation, styles) => {
  const cssStyles = normalizeStyles(styles, "css");
  animation.effect.setKeyframes([cssStyles]);
  animation.play();
  animation.pause();
};

const addAttributeEffect = (attributeName, effect) => {
  const cleanupWeakMap = new WeakMap();
  const applyEffect = element => {
    const cleanup = effect(element);
    cleanupWeakMap.set(element, typeof cleanup === "function" ? cleanup : () => {});
  };
  const cleanupEffect = element => {
    const cleanup = cleanupWeakMap.get(element);
    if (cleanup) {
      cleanup();
      cleanupWeakMap.delete(element);
    }
  };
  const checkElement = element => {
    if (element.hasAttribute(attributeName)) {
      applyEffect(element);
    }
    const elementWithAttributeCollection = element.querySelectorAll("[".concat(attributeName, "]"));
    for (const elementWithAttribute of elementWithAttributeCollection) {
      applyEffect(elementWithAttribute);
    }
  };
  checkElement(document.body);
  const mutationObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          checkElement(addedNode);
        }
        for (const removedNode of mutation.removedNodes) {
          if (removedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }


          if (removedNode.hasAttribute && removedNode.hasAttribute(attributeName)) {
            cleanupEffect(removedNode);
          }


          if (removedNode.querySelectorAll) {
            const elementsWithAttribute = removedNode.querySelectorAll("[".concat(attributeName, "]"));
            for (const element of elementsWithAttribute) {
              cleanupEffect(element);
            }
          }
        }
      }
      if (mutation.type === "attributes" && mutation.attributeName === attributeName) {
        const element = mutation.target;
        if (element.hasAttribute(attributeName)) {
          applyEffect(element);
        } else {
          cleanupEffect(element);
        }
      }
    }
  });
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [attributeName]
  });
  return () => {
    mutationObserver.disconnect();
    for (const cleanup of cleanupWeakMap.values()) {
      cleanup();
    }
    cleanupWeakMap.clear();
  };
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
const createSetMany = setter => {
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

const findAncestor = (node, predicate) => {
  let ancestor = node.parentNode;
  while (ancestor) {
    if (predicate(ancestor)) {
      return ancestor;
    }
    ancestor = ancestor.parentNode;
  }
  return null;
};
const findDescendant = (rootNode, fn, {
  skipRoot
} = {}) => {
  const iterator = createNextNodeIterator(rootNode, rootNode, skipRoot);
  let {
    done,
    value: node
  } = iterator.next();
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
    ({
      done,
      value: node
    } = iterator.next(skipChildren));
  }
  return null;
};
const findLastDescendant = (rootNode, fn, {
  skipRoot
} = {}) => {
  const deepestNode = getDeepestNode(rootNode, skipRoot);
  if (deepestNode) {
    const iterator = createPreviousNodeIterator(deepestNode, rootNode, skipRoot);
    let {
      done,
      value: node
    } = iterator.next();
    while (done === false) {
      if (fn(node)) {
        return node;
      }
      ({
        done,
        value: node
      } = iterator.next());
    }
  }
  return null;
};
const findAfter = (from, predicate, {
  root = null,
  skipRoot = null,
  skipChildren = false
} = {}) => {
  const iterator = createAfterNodeIterator(from, root, skipChildren, skipRoot);
  let {
    done,
    value: node
  } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({
      done,
      value: node
    } = iterator.next());
  }
  return null;
};
const findBefore = (from, predicate, {
  root = null,
  skipRoot = null
} = {}) => {
  const iterator = createPreviousNodeIterator(from, root, skipRoot);
  let {
    done,
    value: node
  } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({
      done,
      value: node
    } = iterator.next());
  }
  return null;
};
const getNextNode = (node, rootNode, skipChild = false, skipRoot = null) => {
  if (!skipChild) {
    const firstChild = node.firstChild;
    if (firstChild) {

      if (skipRoot && (firstChild === skipRoot || skipRoot.contains(firstChild))) {

        return getNextNode(node, rootNode, true, skipRoot);
      }
      return firstChild;
    }
  }
  const nextSibling = node.nextSibling;
  if (nextSibling) {

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
    const nextNode = getNextNode(current, rootNode, innerSkipChildren, skipRoot);
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode
    };
  };
  return {
    next
  };
};
const createAfterNodeIterator = (fromNode, rootNode, skipChildren = false, skipRoot = null) => {
  let current = fromNode;
  let childrenSkipped = false;


  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
    childrenSkipped = true;
    skipChildren = true;
  }
  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(current, rootNode, skipChildren && childrenSkipped === false || innerSkipChildren, skipRoot);
    childrenSkipped = true;
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode
    };
  };
  return {
    next
  };
};
const getDeepestNode = (node, skipRoot = null) => {
  let deepestNode = node.lastChild;
  while (deepestNode) {

    if (skipRoot && (deepestNode === skipRoot || skipRoot.contains(deepestNode))) {

      const previousSibling = deepestNode.previousSibling;
      if (previousSibling) {
        return getDeepestNode(previousSibling, skipRoot);
      }

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

    if (skipRoot && previousSibling === skipRoot) {
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }
    const deepestChild = getDeepestNode(previousSibling, skipRoot);


    if (skipRoot && deepestChild && (deepestChild === skipRoot || skipRoot.contains(deepestChild))) {

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


  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
  }
  const next = () => {
    const previousNode = getPreviousNode(current, rootNode, skipRoot);
    current = previousNode;
    return {
      done: Boolean(previousNode) === false,
      value: previousNode
    };
  };
  return {
    next
  };
};

const activeElementSignal = d(document.activeElement);
document.addEventListener("focus", () => {
  activeElementSignal.value = document.activeElement;
}, {
  capture: true
});


document.addEventListener("blur", e => {
  if (!e.relatedTarget) {
    activeElementSignal.value = document.activeElement;
  }
}, {
  capture: true
});
const useActiveElement = () => {
  return activeElementSignal.value;
};
const addActiveElementEffect = callback => {
  const remove = E(() => {
    const activeElement = activeElementSignal.value;
    callback(activeElement);
  });
  return remove;
};

const elementIsVisible = node => {
  if (isDocumentElement(node)) {
    return true;
  }
  if (getStyle(node, "visibility") === "hidden") {
    return false;
  }
  let nodeOrAncestor = node;
  while (nodeOrAncestor) {
    if (isDocumentElement(nodeOrAncestor)) {
      break;
    }
    if (getStyle(nodeOrAncestor, "display") === "none") {
      return false;
    }

    if (elementIsDetails(nodeOrAncestor) && !nodeOrAncestor.open) {


      if (elementIsSummary(node) && node.parentElement === nodeOrAncestor) ; else {
        return false;
      }
    }
    nodeOrAncestor = nodeOrAncestor.parentNode;
  }
  return true;
};

const elementIsFocusable = node => {

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
    return elementIsVisible(node);
  }
  if (["button", "select", "datalist", "iframe", "textarea"].indexOf(nodeName) > -1) {
    return elementIsVisible(node);
  }
  if (["a", "area"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("href") === false) {
      return false;
    }
    return elementIsVisible(node);
  }
  if (["audio", "video"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("controls") === false) {
      return false;
    }
    return elementIsVisible(node);
  }
  if (nodeName === "summary") {
    return elementIsVisible(node);
  }
  if (node.hasAttribute("tabindex") || node.hasAttribute("tabIndex")) {
    return elementIsVisible(node);
  }
  if (node.hasAttribute("draggable")) {
    return elementIsVisible(node);
  }
  return false;
};
const canInteract = element => {
  if (element.disabled) {
    return false;
  }
  if (element.hasAttribute("inert")) {

    return false;
  }
  return true;
};

const findFocusable = element => {
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

const canInterceptKeys = event => {
  const target = event.target;

  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true" || target.isContentEditable) {
    return false;
  }

  if (target.tagName === "SELECT") {
    return false;
  }

  if (target.disabled || target.closest("[disabled]") || target.inert || target.closest("[inert]")) {
    return false;
  }
  return true;
};


const focusGroupRegistry = new WeakMap();
const setFocusGroup = (element, options) => {
  focusGroupRegistry.set(element, options);
  return () => {
    focusGroupRegistry.delete(element);
  };
};
const getFocusGroup = element => {
  return focusGroupRegistry.get(element);
};

const createEventMarker = symbolName => {
  const symbol = Symbol.for(symbolName);
  const isMarked = event => {
    return Boolean(event[symbol]);
  };
  return {
    mark: event => {
      event[symbol] = true;
    },
    isMarked
  };
};

const focusNavEventMarker = createEventMarker("focus_nav");
const preventFocusNav = event => {
  focusNavEventMarker.mark(event);
};
const isFocusNavMarked = event => {
  return focusNavEventMarker.isMarked(event);
};
const markFocusNav = event => {
  focusNavEventMarker.mark(event);
};

const performArrowNavigation = (event, element, {
  direction = "both",
  loop,
  name
} = {}) => {
  if (!canInterceptKeys(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.hasAttribute("data-focusnav") === "none") {


    return true;
  }
  const onTargetToFocus = targetToFocus => {
    console.debug("Arrow navigation: ".concat(event.key, " from"), activeElement, "to", targetToFocus);
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };



  if (element.tagName === "TABLE") {
    const targetInGrid = getTargetInTableFocusGroup(event, element, {
      loop
    });
    if (!targetInGrid) {
      return false;
    }
    onTargetToFocus(targetInGrid);
    return true;
  }
  const targetInLinearGroup = getTargetInLinearFocusGroup(event, element, {
    direction,
    loop,
    name
  });
  if (!targetInLinearGroup) {
    return false;
  }
  onTargetToFocus(targetInLinearGroup);
  return true;
};
const getTargetInLinearFocusGroup = (event, element, {
  direction,
  loop,
  name
}) => {
  const activeElement = document.activeElement;


  const isJumpToEnd = event.metaKey || event.ctrlKey;
  if (isJumpToEnd) {
    return getJumpToEndTargetLinear(event, element, direction);
  }
  const isForward = isForwardArrow(event, direction);


  backward: {
    if (!isBackwardArrow(event, direction)) {
      break backward;
    }
    const previousElement = findBefore(activeElement, elementIsFocusable, {
      root: element
    });
    if (previousElement) {
      return previousElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      name
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      const lastFocusableElement = findLastDescendant(element, elementIsFocusable);
      if (lastFocusableElement) {
        return lastFocusableElement;
      }
    }
    return null;
  }


  forward: {
    if (!isForward) {
      break forward;
    }
    const nextElement = findAfter(activeElement, elementIsFocusable, {
      root: element
    });
    if (nextElement) {
      return nextElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      name
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {

      const firstFocusableElement = findDescendant(element, elementIsFocusable);
      if (firstFocusableElement) {
        return firstFocusableElement;
      }
    }
    return null;
  }
  return null;
};

const delegateArrowNavigation = (event, currentElement, {
  name
}) => {
  let ancestorElement = currentElement.parentElement;
  while (ancestorElement) {
    const ancestorFocusGroup = getFocusGroup(ancestorElement);
    if (!ancestorFocusGroup) {
      ancestorElement = ancestorElement.parentElement;
      continue;
    }


    const shouldDelegate = name === undefined && ancestorFocusGroup.name === undefined ? true
    : ancestorFocusGroup.name === name;

    if (shouldDelegate) {

      return getTargetInLinearFocusGroup(event, ancestorElement, {
        direction: ancestorFocusGroup.direction,
        loop: ancestorFocusGroup.loop,
        name: ancestorFocusGroup.name
      });
    }
  }
  return null;
};


const getJumpToEndTargetLinear = (event, element, direction) => {

  if (!isForwardArrow(event, direction) && !isBackwardArrow(event, direction)) {
    return null;
  }
  if (isBackwardArrow(event, direction)) {

    return findDescendant(element, elementIsFocusable);
  }
  if (isForwardArrow(event, direction)) {

    return findLastDescendant(element, elementIsFocusable);
  }
  return null;
};
const isBackwardArrow = (event, direction = "both") => {
  const backwardKeys = {
    both: ["ArrowLeft", "ArrowUp"],
    vertical: ["ArrowUp"],
    horizontal: ["ArrowLeft"]
  };
  return backwardKeys[direction]?.includes(event.key) ?? false;
};
const isForwardArrow = (event, direction = "both") => {
  const forwardKeys = {
    both: ["ArrowRight", "ArrowDown"],
    vertical: ["ArrowDown"],
    horizontal: ["ArrowRight"]
  };
  return forwardKeys[direction]?.includes(event.key) ?? false;
};



const getTargetInTableFocusGroup = (event, table, {
  loop
}) => {
  const arrowKey = event.key;


  if (arrowKey !== "ArrowRight" && arrowKey !== "ArrowLeft" && arrowKey !== "ArrowUp" && arrowKey !== "ArrowDown") {
    return null;
  }
  const focusedElement = document.activeElement;
  const currentCell = focusedElement?.closest?.("td,th");


  if (!currentCell || !table.contains(currentCell)) {
    return findDescendant(table, elementIsFocusable) || null;
  }


  const currentRow = currentCell.parentElement;
  const allRows = Array.from(table.rows);
  const currentRowIndex =                                   currentRow.rowIndex;
  const currentColumnIndex =                                    currentCell.cellIndex;


  const isJumpToEnd = event.metaKey || event.ctrlKey;
  if (isJumpToEnd) {
    return getJumpToEndTarget(arrowKey, allRows, currentRowIndex, currentColumnIndex);
  }



  const candidateCells = createTableCellIterator(arrowKey, allRows, {
    startRow: currentRowIndex,
    startColumn: currentColumnIndex,
    originalColumn: currentColumnIndex,

    loopMode: normalizeLoop(loop)
  });


  for (const candidateCell of candidateCells) {
    if (elementIsFocusable(candidateCell)) {
      return candidateCell;
    }
  }
  return null;
};


const getJumpToEndTarget = (arrowKey, allRows, currentRowIndex, currentColumnIndex) => {
  if (arrowKey === "ArrowRight") {

    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;


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



const createTableCellIterator = function* (arrowKey, allRows, {
  startRow,
  startColumn,
  originalColumn,
  loopMode
}) {
  if (allRows.length === 0) {
    return;
  }



  let preferredColumn = originalColumn;
  const normalizedLoopMode = normalizeLoop(loopMode);


  const calculateNextPosition = (currentRow, currentColumn) => getNextTablePosition(arrowKey, allRows, currentRow, currentColumn, preferredColumn, normalizedLoopMode);


  let nextPosition = calculateNextPosition(startRow, startColumn);
  if (!nextPosition) {
    return;
  }


  const actualStartingPosition = "".concat(startRow, ":").concat(startColumn);
  while (true) {
    const [nextColumn, nextRow] = nextPosition;
    const targetRow = allRows[nextRow];
    const targetCell = targetRow?.cells?.[nextColumn];


    if (targetCell) {
      yield targetCell;
    }




    if (arrowKey === "ArrowRight" || arrowKey === "ArrowLeft") {
      preferredColumn = nextColumn;
    } else if (arrowKey === "ArrowDown") {
      const isAtBottomRow = nextRow === allRows.length - 1;
      if (isAtBottomRow && normalizedLoopMode === "flow") {

        const maxColumns = getMaxColumns(allRows);
        preferredColumn = preferredColumn + 1;
        if (preferredColumn >= maxColumns) {
          preferredColumn = 0;
        }
      }
    } else if (arrowKey === "ArrowUp") {
      const isAtTopRow = nextRow === 0;
      if (isAtTopRow && normalizedLoopMode === "flow") {

        const maxColumns = getMaxColumns(allRows);
        if (preferredColumn === 0) {
          preferredColumn = maxColumns - 1;
        } else {
          preferredColumn = preferredColumn - 1;
        }
      }
    }


    nextPosition = calculateNextPosition(nextRow, nextColumn);
    if (!nextPosition) {
      return;
    }


    const currentPositionKey = "".concat(nextRow, ":").concat(nextColumn);
    if (currentPositionKey === actualStartingPosition) {
      return;
    }
  }
};


const normalizeLoop = loop => {
  if (loop === true) return "wrap";
  if (loop === "wrap") return "wrap";
  if (loop === "flow") return "flow";
  return false;
};
const getMaxColumns = rows => rows.reduce((max, r) => Math.max(max, r?.cells?.length || 0), 0);



const getNextTablePosition = (arrowKey, allRows, currentRow, currentColumn, preferredColumn,

loopMode) => {
  if (arrowKey === "ArrowRight") {
    const currentRowLength = allRows[currentRow]?.cells?.length || 0;
    const nextColumn = currentColumn + 1;


    if (nextColumn < currentRowLength) {
      return [nextColumn, currentRow];
    }


    if (loopMode === "flow") {

      let nextRow = currentRow + 1;
      if (nextRow >= allRows.length) {
        nextRow = 0;
      }
      return [0, nextRow];
    }
    if (loopMode === "wrap") {

      return [0, currentRow];
    }


    return null;
  }
  if (arrowKey === "ArrowLeft") {
    const previousColumn = currentColumn - 1;


    if (previousColumn >= 0) {
      return [previousColumn, currentRow];
    }


    if (loopMode === "flow") {

      let previousRow = currentRow - 1;
      if (previousRow < 0) {
        previousRow = allRows.length - 1;
      }
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      const lastColumnInPreviousRow = Math.max(0, previousRowLength - 1);
      return [lastColumnInPreviousRow, previousRow];
    }
    if (loopMode === "wrap") {

      const currentRowLength = allRows[currentRow]?.cells?.length || 0;
      const lastColumnInCurrentRow = Math.max(0, currentRowLength - 1);
      return [lastColumnInCurrentRow, currentRow];
    }


    return null;
  }
  if (arrowKey === "ArrowDown") {
    const nextRow = currentRow + 1;


    if (nextRow < allRows.length) {
      const nextRowLength = allRows[nextRow]?.cells?.length || 0;

      const targetColumn = Math.min(preferredColumn, Math.max(0, nextRowLength - 1));
      return [targetColumn, nextRow];
    }


    if (loopMode === "flow") {

      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let nextColumnInFlow = currentColumn + 1;
      if (nextColumnInFlow >= maxColumns) {
        nextColumnInFlow = 0;
      }
      const topRowLength = allRows[0]?.cells?.length || 0;
      const clampedColumn = Math.min(nextColumnInFlow, Math.max(0, topRowLength - 1));
      return [clampedColumn, 0];
    }
    if (loopMode === "wrap") {

      const topRowLength = allRows[0]?.cells?.length || 0;
      const targetColumn = Math.min(preferredColumn, Math.max(0, topRowLength - 1));
      return [targetColumn, 0];
    }


    return null;
  }
  if (arrowKey === "ArrowUp") {
    const previousRow = currentRow - 1;


    if (previousRow >= 0) {
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;

      const targetColumn = Math.min(preferredColumn, Math.max(0, previousRowLength - 1));
      return [targetColumn, previousRow];
    }


    if (loopMode === "flow") {

      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let previousColumnInFlow;
      if (currentColumn === 0) {
        previousColumnInFlow = maxColumns - 1;
      } else {
        previousColumnInFlow = currentColumn - 1;
      }
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const clampedColumn = Math.min(previousColumnInFlow, Math.max(0, bottomRowLength - 1));
      return [clampedColumn, bottomRowIndex];
    }
    if (loopMode === "wrap") {

      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const targetColumn = Math.min(preferredColumn, Math.max(0, bottomRowLength - 1));
      return [targetColumn, bottomRowIndex];
    }


    return null;
  }


  return null;
};

const performTabNavigation = (event, {
  rootElement = document.body,
  outsideOfElement = null
} = {}) => {
  if (!isTabEvent$1(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.getAttribute("data-focusnav") === "none") {
    event.preventDefault();
    return true;
  }
  const isForward = !event.shiftKey;
  const onTargetToFocus = targetToFocus => {
    console.debug("Tab navigation: ".concat(isForward ? "forward" : "backward", " from"), activeElement, "to", targetToFocus);
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };
  {
    console.debug("Tab navigation: ".concat(isForward ? "forward" : "backward", " from,"), activeElement);
  }
  const predicate = candidate => {
    const canBeFocusedByTab = isFocusableByTab(candidate);
    {
      console.debug("Testing", candidate, "".concat(canBeFocusedByTab ? "✓" : "✗"));
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
        skipRoot: outsideOfElement
      });
      if (firstFocusableElement) {
        return onTargetToFocus(firstFocusableElement);
      }
      return false;
    }
    const nextFocusableElement = findAfter(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement
    });
    if (nextFocusableElement) {
      return onTargetToFocus(nextFocusableElement);
    }
    const firstFocusableElement = findDescendant(activeElement, predicate, {
      skipRoot: outsideOfElement
    });
    if (firstFocusableElement) {
      return onTargetToFocus(firstFocusableElement);
    }
    return false;
  }
  {
    if (activeElementIsRoot) {
      const lastFocusableElement = findLastDescendant(activeElement, predicate, {
        skipRoot: outsideOfElement
      });
      if (lastFocusableElement) {
        return onTargetToFocus(lastFocusableElement);
      }
      return false;
    }
    const previousFocusableElement = findBefore(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement
    });
    if (previousFocusableElement) {
      return onTargetToFocus(previousFocusableElement);
    }
    const lastFocusableElement = findLastDescendant(activeElement, predicate, {
      skipRoot: outsideOfElement
    });
    if (lastFocusableElement) {
      return onTargetToFocus(lastFocusableElement);
    }
    return false;
  }
};
const isTabEvent$1 = event => event.key === "Tab" || event.keyCode === 9;
const isFocusableByTab = element => {
  if (hasNegativeTabIndex(element)) {
    return false;
  }
  return elementIsFocusable(element);
};
const hasNegativeTabIndex = element => {
  return element.hasAttribute && element.hasAttribute("tabIndex") && Number(element.getAttribute("tabindex")) < 0;
};










const initFocusGroup = (element, {
  direction = "both",

  skipTab = true,
  loop = false,
  name
} = {}) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const callback of cleanupCallbackSet) {
      callback();
    }
    cleanupCallbackSet.clear();
  };


  const removeFocusGroup = setFocusGroup(element, {
    direction,
    loop,
    name
  });
  cleanupCallbackSet.add(removeFocusGroup);
  tab: {
    if (!skipTab) {
      break tab;
    }
    const handleTabKeyDown = event => {
      if (isFocusNavMarked(event)) {

        return;
      }
      performTabNavigation(event, {
        outsideOfElement: element
      });
    };

    element.addEventListener("keydown", handleTabKeyDown, {


      capture: false,
      passive: false
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleTabKeyDown, {
        capture: false,
        passive: false
      });
    });
  }


  {
    const handleArrowKeyDown = event => {
      if (isFocusNavMarked(event)) {

        return;
      }
      performArrowNavigation(event, element, {
        direction,
        loop,
        name
      });
    };
    element.addEventListener("keydown", handleArrowKeyDown, {


      capture: false,
      passive: false
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleArrowKeyDown, {
        capture: false,
        passive: false
      });
    });
  }
  return {
    cleanup
  };
};

const preventFocusNavViaKeyboard = keyboardEvent => {
  if (keyboardEvent.key === "Tab") {

    keyboardEvent.preventDefault();
    return true;
  }

  preventFocusNav(keyboardEvent);
  return false;
};

const trapFocusInside = element => {
  if (element.nodeType === 3) {
    console.warn("cannot trap focus inside a text node");
    return () => {};
  }
  const trappedElement = activeTraps.find(activeTrap => activeTrap.element === element);
  if (trappedElement) {
    console.warn("focus already trapped inside this element");
    return () => {};
  }
  const isEventOutside = event => {
    if (event.target === element) return false;
    if (element.contains(event.target)) return false;
    return true;
  };
  const lock = () => {
    const onmousedown = event => {
      if (isEventOutside(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const onkeydown = event => {
      if (isTabEvent(event)) {
        performTabNavigation(event, {
          rootElement: element
        });
      }
    };
    document.addEventListener("mousedown", onmousedown, {
      capture: true,
      passive: false
    });
    document.addEventListener("keydown", onkeydown, {
      capture: true,
      passive: false
    });
    return () => {
      document.removeEventListener("mousedown", onmousedown, {
        capture: true,
        passive: false
      });
      document.removeEventListener("keydown", onkeydown, {
        capture: true,
        passive: false
      });
    };
  };
  const deactivate = activate({

    lock
  });
  const untrap = () => {
    deactivate();
  };
  return untrap;
};
const isTabEvent = event => event.key === "Tab" || event.keyCode === 9;
const activeTraps = [];
const activate = ({
  lock
}) => {

  let previousTrap;
  if (activeTraps.length > 0) {
    previousTrap = activeTraps[activeTraps.length - 1];
    previousTrap.unlock();
  }


  const trap = {
    lock,
    unlock: lock()
  };
  activeTraps.push(trap);
  return () => {
    if (activeTraps.length === 0) {
      console.warn("cannot deactivate an already deactivated trap");
      return;
    }
    const lastTrap = activeTraps[activeTraps.length - 1];
    if (trap !== lastTrap) {

      console.warn("you must deactivate trap in the same order they were activated");
      return;
    }
    activeTraps.pop();
    trap.unlock();

    if (previousTrap) {
      previousTrap.unlock = previousTrap.lock();
    }
  };
};


const captureScrollState = element => {
  const scrollLeft = element.scrollLeft;
  const scrollTop = element.scrollTop;
  const scrollWidth = element.scrollWidth;
  const scrollHeight = element.scrollHeight;
  const clientWidth = element.clientWidth;
  const clientHeight = element.clientHeight;


  const scrollLeftPercent = scrollWidth > clientWidth ? scrollLeft / (scrollWidth - clientWidth) : 0;
  const scrollTopPercent = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;


  return () => {

    const newScrollWidth = element.scrollWidth;
    const newScrollHeight = element.scrollHeight;
    const newClientWidth = element.clientWidth;
    const newClientHeight = element.clientHeight;


    if (Math.abs(newScrollWidth - scrollWidth) > 1 || Math.abs(newScrollHeight - scrollHeight) > 1 || Math.abs(newClientWidth - clientWidth) > 1 || Math.abs(newClientHeight - clientHeight) > 1) {
      if (newScrollWidth > newClientWidth) {
        const newScrollLeft = scrollLeftPercent * (newScrollWidth - newClientWidth);
        element.scrollLeft = newScrollLeft;
      }
      if (newScrollHeight > newClientHeight) {
        const newScrollTop = scrollTopPercent * (newScrollHeight - newClientHeight);
        element.scrollTop = newScrollTop;
      }
    } else {
      element.scrollLeft = scrollLeft;
      element.scrollTop = scrollTop;
    }
  };
};




const isScrollable = (element, {
  includeHidden
} = {}) => {
  if (canHaveVerticalScroll(element, {
    includeHidden
  })) {
    return true;
  }
  if (canHaveHorizontalScroll(element, {
    includeHidden
  })) {
    return true;
  }
  return false;
};
const canHaveVerticalScroll = (element, {
  includeHidden
}) => {
  const verticalOverflow = getStyle(element, "overflow-y");
  if (verticalOverflow === "visible") {

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

    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true;
};
const canHaveHorizontalScroll = (element, {
  includeHidden
}) => {
  const horizontalOverflow = getStyle(element, "overflow-x");
  if (horizontalOverflow === "visible") {

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

      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true;
};
const getScrollingElement = document => {
  const {
    scrollingElement
  } = document;
  if (scrollingElement) {
    return scrollingElement;
  }
  if (isCompliant(document)) {
    return document.documentElement;
  }
  const body = document.body;
  const isFrameset = body && !/body/i.test(body.tagName);
  const possiblyScrollingElement = isFrameset ? getNextBodyElement(body) : body;


  return possiblyScrollingElement && bodyIsScrollable(possiblyScrollingElement) ? null : possiblyScrollingElement;
};
const isHidden = element => {
  const display = getStyle(element, "display");
  if (display === "none") {
    return false;
  }
  if (display === "table-row" || display === "table-group" || display === "table-column") {
    return getStyle(element, "visibility") !== "collapsed";
  }
  return true;
};
const isCompliant = document => {

  const isStandardsMode = /^CSS1/.test(document.compatMode);
  if (isStandardsMode) {
    return testScrollCompliance(document);
  }
  return false;
};
const testScrollCompliance = document => {
  const iframe = document.createElement("iframe");
  iframe.style.height = "1px";
  const parentNode = document.body || document.documentElement || document;
  parentNode.appendChild(iframe);
  const iframeDocument = iframe.contentWindow.document;
  iframeDocument.write('<!DOCTYPE html><div style="height:9999em">x</div>');
  iframeDocument.close();
  const scrollComplianceResult = iframeDocument.documentElement.scrollHeight > iframeDocument.body.scrollHeight;
  iframe.parentNode.removeChild(iframe);
  return scrollComplianceResult;
};
const getNextBodyElement = frameset => {





  let current = frameset;
  while (current = current.nextSibling) {
    if (current.nodeType === 1 && isBodyElement(current)) {
      return current;
    }
  }
  return null;
};
const isBodyElement = element => element.ownerDocument.body === element;
const bodyIsScrollable = body => {

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



const {
  documentElement: documentElement$2
} = document;
const getScrollContainer = (arg, {
  includeHidden
} = {}) => {
  if (typeof arg !== "object" || arg.nodeType !== 1) {
    throw new TypeError("getScrollContainer first argument must be DOM node");
  }
  const element = arg;
  if (element === document) {
    return null;
  }
  if (element === documentElement$2) {
    if (isScrollable(element, {
      includeHidden
    })) {
      return element;
    }
    return null;
  }
  const position = getStyle(element, "position");
  if (position === "fixed") {
    return getScrollingElement(element.ownerDocument);
  }
  return findScrollContainer(element, {
    includeHidden
  }) || getScrollingElement(element.ownerDocument);
};
const findScrollContainer = (element, {
  includeHidden
} = {}) => {
  const position = getStyle(element, "position");
  let parent = element.parentNode;

  if (position === "absolute") {
    while (parent && parent !== document) {
      if (parent === documentElement$2) {
        break;
      }
      const parentPosition = getStyle(parent, "position");
      if (parentPosition !== "static") {
        break;
      }
      parent = parent.parentNode;
    }
  }


  while (parent) {
    if (parent === document) {
      return null;
    }
    if (isScrollable(parent, {
      includeHidden
    })) {
      return parent;
    }
    parent = parent.parentNode;
  }
  return null;
};
const getSelfAndAncestorScrolls = (element, startOnParent) => {
  let scrollX = 0;
  let scrollY = 0;
  const ancestorScrolls = [];
  const visitElement = elementOrScrollContainer => {
    const scrollContainer = getScrollContainer(elementOrScrollContainer);
    if (scrollContainer) {
      ancestorScrolls.push({
        element: elementOrScrollContainer,
        scrollContainer
      });
      scrollX += scrollContainer.scrollLeft;
      scrollY += scrollContainer.scrollTop;
      if (scrollContainer === document.documentElement) {
        return;
      }
      visitElement(scrollContainer);
    }
  };
  if (startOnParent) {
    if (element === documentElement$2) ; else {
      visitElement(element.parentNode);
    }
  } else {
    visitElement(element);
  }
  ancestorScrolls.scrollX = scrollX;
  ancestorScrolls.scrollY = scrollY;
  return ancestorScrolls;
};


const getScrollContainerSet = element => {
  const scrollContainerSet = new Set();
  let elementOrScrollContainer = element;
  while (true) {
    const scrollContainer = getScrollContainer(elementOrScrollContainer);
    if (!scrollContainer) {
      break;
    }
    scrollContainerSet.add(scrollContainer);
    if (scrollContainer === documentElement$2) {
      break;
    }
    elementOrScrollContainer = scrollContainer;
  }
  return scrollContainerSet;
};


const measureScrollbar = scrollableElement => {
  const hasXScrollbar = scrollableElement.scrollHeight > scrollableElement.clientHeight;
  const hasYScrollbar = scrollableElement.scrollWidth > scrollableElement.clientWidth;
  if (!hasXScrollbar && !hasYScrollbar) {
    return [0, 0];
  }
  const scrollDiv = document.createElement("div");
  scrollDiv.style.cssText = "position: absolute; width: 100px; height: 100px; overflow: scroll; pointer-events: none; visibility: hidden;";
  scrollableElement.appendChild(scrollDiv);
  const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  const scrollbarHeight = scrollDiv.offsetHeight - scrollDiv.clientHeight;
  scrollableElement.removeChild(scrollDiv);
  return [hasXScrollbar ? scrollbarWidth : 0, hasYScrollbar ? scrollbarHeight : 0];
};

const trapScrollInside = element => {
  const cleanupCallbackSet = new Set();
  const lockScroll = el => {
    const [scrollbarWidth, scrollbarHeight] = measureScrollbar(el);

    const paddingRight = parseInt(getStyle(el, "padding-right"), 0);
    const paddingTop = parseInt(getStyle(el, "padding-top"), 0);
    const removeScrollLockStyles = setStyles(el, {
      "padding-right": "".concat(paddingRight + scrollbarWidth, "px"),
      "padding-top": "".concat(paddingTop + scrollbarHeight, "px"),
      "overflow": "hidden"
    });
    cleanupCallbackSet.add(() => {
      removeScrollLockStyles();
    });
  };
  let previous = element.previousSibling;
  while (previous) {
    if (previous.nodeType === 1) {
      if (isScrollable(previous)) {
        lockScroll(previous);
      }
    }
    previous = previous.previousSibling;
  }
  const selfAndAncestorScrolls = getSelfAndAncestorScrolls(element);
  for (const selfOrAncestorScroll of selfAndAncestorScrolls) {
    const elementToScrollLock = selfOrAncestorScroll.scrollContainer;
    lockScroll(elementToScrollLock);
  }
  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};







const allowWheelThrough = (element, connectedElement) => {
  const isElementOrDescendant = possibleDescendant => {
    return possibleDescendant === element || element.contains(possibleDescendant);
  };
  const tryToScrollOne = (element, wheelEvent) => {
    if (element === document.documentElement) {

      return true;
    }
    const {
      deltaX,
      deltaY
    } = wheelEvent;


    const elementCanApplyScrollDeltaX = deltaX && canApplyScrollDelta(element, deltaX, "x");
    const elementCanApplyScrollDeltaY = deltaY && canApplyScrollDelta(element, deltaY, "y");
    if (!elementCanApplyScrollDeltaX && !elementCanApplyScrollDeltaY) {
      return false;
    }
    if (!isScrollable(element)) {
      return false;
    }
    const belongsToElement = isElementOrDescendant(element);
    if (belongsToElement) {

      return true;
    }
    wheelEvent.preventDefault();
    applyWheelScrollThrough(element, wheelEvent);
    return true;
  };
  if (connectedElement) {
    const onWheel = wheelEvent => {
      const connectedScrollContainer = getScrollContainer(connectedElement);
      if (connectedScrollContainer === document.documentElement) {


        return;
      }
      const elementsBehindMouse = document.elementsFromPoint(wheelEvent.clientX, wheelEvent.clientY);
      for (const elementBehindMouse of elementsBehindMouse) {
        const belongsToElement = isElementOrDescendant(elementBehindMouse);

        if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
          return;
        }
        if (!belongsToElement) {
          break;
        }
      }


      tryToScrollOne(connectedScrollContainer, wheelEvent);
    };
    element.addEventListener("wheel", onWheel);
    return;
  }
  const onWheel = wheelEvent => {
    const elementsBehindMouse = document.elementsFromPoint(wheelEvent.clientX, wheelEvent.clientY);
    for (const elementBehindMouse of elementsBehindMouse) {
      const belongsToElement = isElementOrDescendant(elementBehindMouse);

      if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
        return;
      }
      if (belongsToElement) {



        continue;
      }
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
    scrollTop
  } = element;
  let size = axis === "x" ? clientWidth : clientHeight;
  let currentScroll = axis === "x" ? scrollLeft : scrollTop;
  let scrollEnd = axis === "x" ? scrollWidth : scrollHeight;
  if (size === scrollEnd) {

    return false;
  }
  if (delta < 0 && currentScroll <= 0) {

    return false;
  }
  if (delta > 0 && currentScroll + size >= scrollEnd) {

    return false;
  }
  return true;
};
const applyWheelScrollThrough = (element, wheelEvent) => {
  wheelEvent.preventDefault();
  element.scrollBy({
    top: wheelEvent.deltaY,
    left: wheelEvent.deltaX,
    behavior: wheelEvent.deltaMode === 0 ? "auto" : "smooth"
  });
};

const findSelfOrAncestorFixedPosition = element => {
  let current = element;
  while (true) {
    const computedStyle = window.getComputedStyle(current);
    if (computedStyle.position === "fixed") {
      const {
        left,
        top
      } = current.getBoundingClientRect();
      return [left, top];
    }
    current = current.parentElement;
    if (!current || current === document.documentElement) {
      break;
    }
  }
  return null;
};








































const createDragElementPositioner = (element, referenceElement, elementToMove) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;
  const positionedParent = elementToMove ? elementToMove.offsetParent : element.offsetParent;
  const scrollContainer = getScrollContainer(element);
  const [getPositionOffsets, getScrollOffsets] = createGetOffsets({
    positionedParent,
    referencePositionedParent: referenceElement ? referenceElement.offsetParent : undefined,
    scrollContainer,
    referenceScrollContainer: referenceElement ? getScrollContainer(referenceElement) : undefined
  });
  {
    [scrollableLeft, scrollableTop] = getScrollablePosition(element, scrollContainer);
    const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
    scrollableLeft += positionOffsetLeft;
    scrollableTop += positionOffsetTop;
  }
  {
    convertScrollablePosition = (scrollableLeftToConvert, scrollableTopToConvert) => {
      const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
      const [scrollOffsetLeft, scrollOffsetTop] = getScrollOffsets();
      const positionedLeftWithoutScroll = scrollableLeftToConvert + positionOffsetLeft;
      const positionedTopWithoutScroll = scrollableTopToConvert + positionOffsetTop;
      const positionedLeft = positionedLeftWithoutScroll + scrollOffsetLeft;
      const positionedTop = positionedTopWithoutScroll + scrollOffsetTop;
      return [positionedLeft, positionedTop];
    };
  }
  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};
const getScrollablePosition = (element, scrollContainer) => {
  const {
    left: elementViewportLeft,
    top: elementViewportTop
  } = element.getBoundingClientRect();
  const scrollContainerIsDocument = scrollContainer === documentElement$1;
  if (scrollContainerIsDocument) {
    return [elementViewportLeft, elementViewportTop];
  }
  const {
    left: scrollContainerLeft,
    top: scrollContainerTop
  } = scrollContainer.getBoundingClientRect();
  const scrollableLeft = elementViewportLeft - scrollContainerLeft;
  const scrollableTop = elementViewportTop - scrollContainerTop;
  return [scrollableLeft, scrollableTop];
};
const createGetOffsets = ({
  positionedParent,
  referencePositionedParent = positionedParent,
  scrollContainer,
  referenceScrollContainer = scrollContainer
}) => {
  const samePositionedParent = positionedParent === referencePositionedParent;
  const getScrollOffsets = createGetScrollOffsets(scrollContainer, referenceScrollContainer, positionedParent, samePositionedParent);
  if (samePositionedParent) {
    return [() => [0, 0], getScrollOffsets];
  }







  if (isOverlayOf(positionedParent, referencePositionedParent)) {
    return createGetOffsetsForOverlay(positionedParent, referencePositionedParent, {
      scrollContainer,
      referenceScrollContainer,
      getScrollOffsets
    });
  }
  if (isOverlayOf(referencePositionedParent, positionedParent)) {
    return createGetOffsetsForOverlay(referencePositionedParent, positionedParent, {
      scrollContainer,
      referenceScrollContainer,
      getScrollOffsets
    });
  }
  const scrollContainerIsDocument = scrollContainer === documentElement$1;
  if (scrollContainerIsDocument) {


    const getPositionOffsetsDocumentScrolling = () => {
      const {
        scrollLeft: documentScrollLeft,
        scrollTop: documentScrollTop
      } = scrollContainer;
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

  const getPositionOffsetsCustomScrollContainer = () => {
    const aRect = positionedParent.getBoundingClientRect();
    const bRect = referencePositionedParent.getBoundingClientRect();
    const aLeft = aRect.left;
    const aTop = aRect.top;
    const bLeft = bRect.left;
    const bTop = bRect.top;
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const offsetLeft = bLeft - aLeft + scrollContainer.scrollLeft - scrollContainerRect.left;
    const offsetTop = bTop - aTop + scrollContainer.scrollTop - scrollContainerRect.top;
    return [offsetLeft, offsetTop];
  };
  return [getPositionOffsetsCustomScrollContainer, getScrollOffsets];
};
const createGetOffsetsForOverlay = (overlay, overlayTarget, {
  scrollContainer,
  referenceScrollContainer,
  getScrollOffsets
}) => {
  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const scrollContainerIsDocument = scrollContainer === document.documentElement;
  const referenceScrollContainerIsDocument = referenceScrollContainer === documentElement$1;
  if (getComputedStyle(overlay).position === "fixed") {
    if (referenceScrollContainerIsDocument) {
      const getPositionOffsetsFixedOverlay = () => {
        return [0, 0];
      };
      return [getPositionOffsetsFixedOverlay, getScrollOffsets];
    }
    const getPositionOffsetsFixedOverlay = () => {
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      const referenceScrollContainerRect = referenceScrollContainer.getBoundingClientRect();
      let offsetLeftBetweenScrollContainers = referenceScrollContainerRect.left - scrollContainerRect.left;
      let offsetTopBetweenScrollContainers = referenceScrollContainerRect.top - scrollContainerRect.top;
      if (scrollContainerIsDocument) {
        offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
        offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
      }
      return [-offsetLeftBetweenScrollContainers, -offsetTopBetweenScrollContainers];
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
      return [-scrollContainer.scrollLeft + offsetLeftBetweenTargetAndOverlay, -scrollContainer.scrollTop + offsetTopBetweenTargetAndOverlay];
    }
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect = referenceScrollContainer.getBoundingClientRect();
    let scrollContainerLeft = scrollContainerRect.left;
    let scrollContainerTop = scrollContainerRect.top;
    let referenceScrollContainerLeft = referenceScrollContainerRect.left;
    let referenceScrollContainerTop = referenceScrollContainerRect.top;
    if (scrollContainerIsDocument) {
      scrollContainerLeft += scrollContainer.scrollLeft;
      scrollContainerTop += scrollContainer.scrollTop;
    }
    const offsetLeftBetweenScrollContainers = referenceScrollContainerLeft - scrollContainerLeft;
    const offsetTopBetweenScrollContainers = referenceScrollContainerTop - scrollContainerTop;
    return [-offsetLeftBetweenScrollContainers - referenceScrollContainer.scrollLeft, -offsetTopBetweenScrollContainers - referenceScrollContainer.scrollTop];
  };
  const getScrollOffsetsOverlay = () => {
    if (sameScrollContainer) {
      return [scrollContainer.scrollLeft, scrollContainer.scrollTop];
    }
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect = referenceScrollContainer.getBoundingClientRect();
    let offsetLeftBetweenScrollContainers = referenceScrollContainerRect.left - scrollContainerRect.left;
    let offsetTopBetweenScrollContainers = referenceScrollContainerRect.top - scrollContainerRect.top;
    if (scrollContainerIsDocument) {
      offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
      offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
    }
    return [referenceScrollContainer.scrollLeft + offsetLeftBetweenScrollContainers, referenceScrollContainer.scrollTop + offsetTopBetweenScrollContainers];
  };
  return [getPositionOffsetsOverlay, getScrollOffsetsOverlay];
};
const isOverlayOf = (element, potentialTarget) => {
  const overlayForAttribute = element.getAttribute("data-overlay-for");
  if (!overlayForAttribute) {
    return false;
  }
  const overlayTarget = document.querySelector("#".concat(overlayForAttribute));
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
const {
  documentElement: documentElement$1
} = document;
const createGetScrollOffsets = (scrollContainer, referenceScrollContainer, positionedParent, samePositionedParent) => {
  const getGetScrollOffsetsSameContainer = () => {
    const scrollContainerIsDocument = scrollContainer === documentElement$1;




    const {
      scrollLeft,
      scrollTop
    } = samePositionedParent ? {
      scrollLeft: 0,
      scrollTop: 0
    } : referenceScrollContainer;
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
const getDragCoordinates = (element, scrollContainer = getScrollContainer(element)) => {
  const [scrollableLeft, scrollableTop] = getScrollablePosition(element, scrollContainer);
  const {
    scrollLeft,
    scrollTop
  } = scrollContainer;
  const leftRelativeToScrollContainer = scrollableLeft + scrollLeft;
  const topRelativeToScrollContainer = scrollableTop + scrollTop;
  return [leftRelativeToScrollContainer, topRelativeToScrollContainer];
};





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
      console.warn("@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418");
    }
    return _contents.trim();
  }
  function isElementConnected(element) {
    return "isConnected" in element ? element.isConnected : document.contains(element);
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
  var cssStyleSheetMethods = ["addRule", "deleteRule", "insertRule", "removeRule"];
  var NonConstructedStyleSheet = CSSStyleSheet;
  var nonConstructedProto = NonConstructedStyleSheet.prototype;
  nonConstructedProto.replace = function () {
    return Promise.reject(new _DOMException("Can't call replace on non-constructed CSSStyleSheets."));
  };
  nonConstructedProto.replaceSync = function () {
    throw new _DOMException("Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.");
  };
  function isCSSStyleSheetInstance(instance) {
    return typeof instance === "object" ? proto$1.isPrototypeOf(instance) || nonConstructedProto.isPrototypeOf(instance) : false;
  }
  function isNonConstructedStyleSheetInstance(instance) {
    return typeof instance === "object" ? nonConstructedProto.isPrototypeOf(instance) : false;
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
    $locations.set(sheet, $locations.get(sheet).filter(function (_location) {
      return _location !== location;
    }));
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
    }
  });
  defineProperty(proto$1, "media", {
    configurable: true,
    enumerable: true,
    get: function media() {
      checkInvocationCorrectness(this);
      return $basicStyleElement.get(this).sheet.media;
    }
  });
  cssStyleSheetMethods.forEach(function (method) {
    proto$1[method] = function () {
      var self = this;
      checkInvocationCorrectness(self);
      var args = arguments;
      $appliedMethods.get(self).push({
        method: method,
        args: args
      });
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
    value: isCSSStyleSheetInstance
  });
  var defaultObserverOptions = {
    childList: true,
    subtree: true
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
      }
    });
  }
  function traverseWebComponents(node, callback) {
    var iter = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT, function (foundNode) {
      return getShadowRoot(foundNode) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }, null, false);
    for (var next = void 0; next = iter.nextNode();) {
      callback(getShadowRoot(next));
    }
  }
  var $element = new WeakMap();
  var $uniqueSheets = new WeakMap();
  var $observer = new WeakMap();
  function isExistingAdopter(self, element) {
    return element instanceof HTMLStyleElement && $uniqueSheets.get(self).some(function (sheet) {
      return getAdopterByLocation(sheet, self);
    });
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
      styleList.appendChild(getAdopterByLocation(sheet, self) || addAdopterLocation(sheet, self));
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
    $observer.set(self, new MutationObserver(function (mutations, observer) {
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
    }));
  }
  Location.prototype = {
    isConnected: function () {
      var element = $element.get(this);
      return element instanceof Document ? element.readyState !== "loading" : isElementConnected(element.host);
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
      var locationType = $element.get(self) === document ? "Document" : "ShadowRoot";
      if (!Array.isArray(sheets)) {
        throw new TypeError("Failed to set the 'adoptedStyleSheets' property on " + locationType + ": Iterator getter is not callable.");
      }
      if (!sheets.every(isCSSStyleSheetInstance)) {
        throw new TypeError("Failed to set the 'adoptedStyleSheets' property on " + locationType + ": Failed to convert value to 'CSSStyleSheet'");
      }
      if (sheets.some(isNonConstructedStyleSheetInstance)) {
        throw new TypeError("Failed to set the 'adoptedStyleSheets' property on " + locationType + ": Can't adopt non-constructed stylesheets");
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
    }
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
    document.addEventListener("DOMContentLoaded", documentLocation.connect.bind(documentLocation));
  }
})();

const installImportMetaCss = importMeta => {
  let cssText = "";
  let stylesheet = new CSSStyleSheet({
    baseUrl: importMeta.url
  });
  let adopted = false;
  const css = {
    toString: () => cssText,
    update: value => {
      cssText = value;
      cssText += "\n/* sourceURL=".concat(importMeta.url, " */\n/* inlined from ").concat(importMeta.url, " */");
      stylesheet.replaceSync(cssText);
    },
    inject: () => {
      if (!adopted) {
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
        adopted = true;
      }
    },
    remove: () => {
      if (adopted) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== stylesheet);
        adopted = false;
      }
    }
  };
  Object.defineProperty(importMeta, "css", {
    get() {
      return css;
    },
    set(value) {
      css.update(value);
      css.inject();
    }
  });
  return css.remove;
};




































































const isolateInteractions = elements => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  const toKeepInteractiveSet = new Set();
  const keepSelfAndAncestors = el => {
    if (toKeepInteractiveSet.has(el)) {
      return;
    }
    const associatedElements = getAssociatedElements(el);
    if (associatedElements) {
      for (const associatedElement of associatedElements) {
        keepSelfAndAncestors(associatedElement);
      }
    }


    toKeepInteractiveSet.add(el);

    let ancestor = el.parentNode;
    while (ancestor && ancestor !== document.body) {
      toKeepInteractiveSet.add(ancestor);
      ancestor = ancestor.parentNode;
    }
  };


  for (const element of elements) {
    keepSelfAndAncestors(element);
  }


  const backdropElements = document.querySelectorAll("[data-backdrop]");
  for (const backdropElement of backdropElements) {
    keepSelfAndAncestors(backdropElement);
  }
  const setInert = el => {
    if (toKeepInteractiveSet.has(el)) {

      return;
    }
    const restoreAttributes = setAttributes(el, {
      inert: ""
    });
    cleanupCallbackSet.add(() => {
      restoreAttributes();
    });
  };
  const makeElementInertSelectivelyOrCompletely = el => {

    if (toKeepInteractiveSet.has(el)) {
      return;
    }




    const children = Array.from(el.children);
    const hasInteractiveChildren = children.some(child => toKeepInteractiveSet.has(child));
    if (!hasInteractiveChildren) {

      setInert(el);
      return;
    }


    for (const child of children) {
      makeElementInertSelectivelyOrCompletely(child);
    }
  };


  const bodyChildren = Array.from(document.body.children);
  for (const child of bodyChildren) {
    makeElementInertSelectivelyOrCompletely(child);
  }
  return () => {
    cleanup();
  };
};

installImportMetaCss(import.meta);const createDragGestureController = (options = {}) => {
  const {
    name,
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    threshold = 5,
    direction: defaultDirection = {
      x: true,
      y: true
    },
    documentInteractions = "auto",
    backdrop = true,
    backdropZIndex = 999999
  } = options;
  const dragGestureController = {
    grab: null,
    gravViaPointer: null
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
    layoutScrollableTop: scrollableTopAtGrab = 0
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
      const {
        scrollLeft,
        scrollTop
      } = scrollContainer;
      const left = scrollableLeftAtGrab + x;
      const top = scrollableTopAtGrab + y;
      const scrollableLeft = left - scrollLeft;
      const scrollableTop = top - scrollTop;
      const layoutProps = {

        x,
        y,

        scrollLeft,
        scrollTop,

        scrollableLeft,
        scrollableTop,

        left,
        top,

        xDelta: left - leftAtGrab,
        yDelta: top - topAtGrab
      };
      return layoutProps;
    };
    const grabLayout = createLayout(grabX + scrollContainer.scrollLeft, grabY + scrollContainer.scrollTop);
    const gestureInfo = {
      name,
      direction,
      started: !threshold,
      status: "grabbed",
      element,
      scrollContainer,
      grabX,

      grabY,

      grabLayout,
      leftAtGrab,
      topAtGrab,
      dragX: grabX,

      dragY: grabY,

      layout: grabLayout,
      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,

      grabEvent: event,
      dragEvent: null,
      releaseEvent: null
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



















      const cleanupInert = isolateInteractions([element, ...Array.from(document.querySelectorAll("[data-droppable]"))]);
      addReleaseCallback(() => {
        cleanupInert();
      });


      if (backdrop) {
        const backdropElement = document.createElement("div");
        backdropElement.className = "navi_drag_gesture_backdrop";
        backdropElement.ariaHidden = "true";
        backdropElement.setAttribute("data-backdrop", "");
        backdropElement.style.zIndex = backdropZIndex;
        backdropElement.style.cursor = cursor;



        if (!direction.x || !direction.y) {
          backdropElement.onwheel = e => {
            e.preventDefault();
            const scrollX = direction.x ? e.deltaX : 0;
            const scrollY = direction.y ? e.deltaY : 0;
            scrollContainer.scrollBy({
              left: scrollX,
              top: scrollY,
              behavior: "auto"
            });
          };
        }
        document.body.appendChild(backdropElement);
        addReleaseCallback(() => {
          backdropElement.remove();
        });
      }


      const {
        activeElement
      } = document;
      const focusableElement = findFocusable(element);



      const elementToFocus = focusableElement || document.body;
      elementToFocus.focus({
        preventScroll: true
      });
      addReleaseCallback(() => {

        activeElement.focus({
          preventScroll: true
        });
      });

      const onkeydown = e => {
        if (e.key === "Tab") {
          e.preventDefault();
          return;
        }
      };
      document.addEventListener("keydown", onkeydown);
      addReleaseCallback(() => {
        document.removeEventListener("keydown", onkeydown);
      });


      {
        const onDocumentKeydown = keyboardEvent => {

          if (keyboardEvent.key === "ArrowUp" || keyboardEvent.key === "ArrowDown" || keyboardEvent.key === " " || keyboardEvent.key === "PageUp" || keyboardEvent.key === "PageDown" || keyboardEvent.key === "Home" || keyboardEvent.key === "End") {
            if (!direction.y) {
              keyboardEvent.preventDefault();
            }
            return;
          }

          if (keyboardEvent.key === "ArrowLeft" || keyboardEvent.key === "ArrowRight") {
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


    {
      let isHandlingScroll = false;
      const handleScroll = scrollEvent => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;
        drag(gestureInfo.dragX, gestureInfo.dragY, {
          event: scrollEvent
        });
        isHandlingScroll = false;
      };
      const scrollEventReceiver = scrollContainer === document.documentElement ? document : scrollContainer;
      scrollEventReceiver.addEventListener("scroll", handleScroll, {
        passive: true
      });
      addReleaseCallback(() => {
        scrollEventReceiver.removeEventListener("scroll", handleScroll, {
          passive: true
        });
      });
    }
    const determineDragData = ({
      dragX,
      dragY,
      dragEvent,
      isRelease = false
    }) => {

      const {
        grabX,
        grabY,
        grabLayout
      } = gestureInfo;





      const currentDragX = gestureInfo.dragX;
      const currentDragY = gestureInfo.dragY;
      const isGoingLeft = dragX < currentDragX;
      const isGoingRight = dragX > currentDragX;
      const isGoingUp = dragY < currentDragY;
      const isGoingDown = dragY > currentDragY;
      const layoutXRequested = direction.x ? scrollContainer.scrollLeft + (dragX - grabX) : grabLayout.scrollLeft;
      const layoutYRequested = direction.y ? scrollContainer.scrollTop + (dragY - grabY) : grabLayout.scrollTop;
      const layoutRequested = createLayout(layoutXRequested, layoutYRequested);
      const currentLayout = gestureInfo.layout;
      let layout;
      if (layoutRequested.x === currentLayout.x && layoutRequested.y === currentLayout.y) {
        layout = currentLayout;
      } else {

        let layoutConstrained = layoutRequested;
        const limitLayout = (left, top) => {
          layoutConstrained = createLayout(left === undefined ? layoutConstrained.x : left - scrollableLeftAtGrab, top === undefined ? layoutConstrained.y : top - scrollableTopAtGrab);
        };
        publishBeforeDrag(layoutRequested, currentLayout, limitLayout, {
          dragEvent,
          isRelease
        });

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
        releaseEvent: isRelease ? dragEvent : null
      };
      if (isRelease) {
        return dragData;
      }
      if (!gestureInfo.started && threshold) {
        const deltaX = Math.abs(dragX - grabX);
        const deltaY = Math.abs(dragY - grabY);
        if (direction.x && direction.y) {

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
    const drag = (dragX = gestureInfo.dragX,

    dragY = gestureInfo.dragY,

    {
      event = new CustomEvent("programmatic"),
      isRelease = false
    } = {}) => {
      const dragData = determineDragData({
        dragX,
        dragY,
        dragEvent: event,
        isRelease
      });
      const startedPrevious = gestureInfo.started;
      const layoutPrevious = gestureInfo.layout;

      Object.assign(gestureInfo, dragData);
      if (!startedPrevious && gestureInfo.started) {
        onDragStart?.(gestureInfo);
      }
      const someLayoutChange = gestureInfo.layout !== layoutPrevious;
      publishDrag(gestureInfo,




      someLayoutChange);
    };
    const release = ({
      event = new CustomEvent("programmatic"),
      releaseX = gestureInfo.dragX,
      releaseY = gestureInfo.dragY
    } = {}) => {
      drag(releaseX, releaseY, {
        event,
        isRelease: true
      });
      publishRelease(gestureInfo);
    };
    onGrab?.(gestureInfo);
    const dragGesture = {
      gestureInfo,
      addBeforeDragCallback,
      addDragCallback,
      addReleaseCallback,
      drag,
      release
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

      return null;
    }
    const mouseEventCoords = mouseEvent => {
      const {
        clientX,
        clientY
      } = mouseEvent;
      return [clientX, clientY];
    };
    const [grabX, grabY] = mouseEventCoords(grabEvent);
    const dragGesture = dragGestureController.grab({
      grabX,
      grabY,
      event: grabEvent,
      ...dragOptions
    });
    const dragViaPointer = dragEvent => {
      const [mouseDragX, mouseDragY] = mouseEventCoords(dragEvent);
      dragGesture.drag(mouseDragX, mouseDragY, {
        event: dragEvent
      });
    };
    const releaseViaPointer = mouseupEvent => {
      const [mouseReleaseX, mouseReleaseY] = mouseEventCoords(mouseupEvent);
      dragGesture.release({
        event: mouseupEvent,
        releaseX: mouseReleaseX,
        releaseY: mouseReleaseY
      });
    };
    dragGesture.dragViaPointer = dragViaPointer;
    dragGesture.releaseViaPointer = releaseViaPointer;
    const cleanup = initializer({
      onMove: dragViaPointer,
      onRelease: releaseViaPointer
    });
    dragGesture.addReleaseCallback(() => {
      cleanup();
    });
    return dragGesture;
  };
  const grabViaPointer = (grabEvent, options) => {
    if (grabEvent.type === "pointerdown") {
      return initDragByPointer(grabEvent, options, ({
        onMove,
        onRelease
      }) => {
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
      console.warn("Received \"mousedown\" event, \"pointerdown\" events are recommended to perform drag gestures.");
      return initDragByPointer(grabEvent, options, ({
        onMove,
        onRelease
      }) => {
        const onPointerUp = pointerEvent => {


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
    throw new Error("Unsupported \"".concat(grabEvent.type, "\" evenet passed to grabViaPointer. \"pointerdown\" was expected."));
  };
  dragGestureController.grabViaPointer = grabViaPointer;
  return dragGestureController;
};
const dragAfterThreshold = (grabEvent, dragGestureInitializer, threshold) => {
  const significantDragGestureController = createDragGestureController({
    threshold,



    documentInteractions: "manual",
    onDragStart: gestureInfo => {
      significantDragGesture.release();
      const dragGesture = dragGestureInitializer();
      dragGesture.dragViaPointer(gestureInfo.dragEvent);
    }
  });
  const significantDragGesture = significantDragGestureController.grabViaPointer(grabEvent, {
    element: grabEvent.target
  });
};
const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName]
  });
};
import.meta.css =          "\n  .navi_drag_gesture_backdrop {\n    position: fixed;\n    inset: 0;\n    user-select: none;\n  }\n";

const getBorderSizes = element => {
  const {
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    borderBottomWidth
  } = window.getComputedStyle(element, null);
  return {
    left: parseFloat(borderLeftWidth),
    right: parseFloat(borderRightWidth),
    top: parseFloat(borderTopWidth),
    bottom: parseFloat(borderBottomWidth)
  };
};

























































































































const {
  documentElement
} = document;









const getScrollRelativeRect = (element, scrollContainer = getScrollContainer(element), {
  useOriginalPositionEvenIfSticky = false
} = {}) => {
  const {
    left: leftViewport,
    top: topViewport,
    width,
    height
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
    const isStickyLeftOrHasStickyLeftAttr = Boolean(fromStickyLeft || fromStickyLeftAttr);
    const isStickyTopOrHasStickyTopAttr = Boolean(fromStickyTop || fromStickyTopAttr);
    return {
      left: leftScrollRelative,
      top: topScrollRelative,
      right: leftScrollRelative + width,
      bottom: topScrollRelative + height,

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
      isSticky: isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr
    };
  };
  {
    const computedStyle = getComputedStyle(element);
    {
      const usePositionSticky = computedStyle.position === "sticky";
      if (usePositionSticky) {

        const [leftScrollRelative, topScrollRelative] = viewportPosToScrollRelativePos(leftViewport, topViewport, scrollContainer);
        const isStickyLeft = computedStyle.left !== "auto";
        const isStickyTop = computedStyle.top !== "auto";
        fromStickyLeft = isStickyLeft ? {
          value: parseFloat(computedStyle.left) || 0
        } : undefined;
        fromStickyTop = isStickyTop ? {
          value: parseFloat(computedStyle.top) || 0
        } : undefined;
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
    {
      const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
      const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
      const useStickyAttribute = hasStickyLeftAttribute || hasStickyTopAttribute;
      if (useStickyAttribute) {


        let [leftScrollRelative, topScrollRelative] = viewportPosToScrollRelativePos(leftViewport, topViewport, scrollContainer);
        if (hasStickyLeftAttribute) {
          const leftCssValue = parseFloat(computedStyle.left) || 0;
          fromStickyLeftAttr = {
            value: leftCssValue
          };
          if (useOriginalPositionEvenIfSticky) ; else {
            const scrollLeft = scrollContainer.scrollLeft;
            const stickyPosition = scrollLeft + leftCssValue;
            const leftWithScroll = leftScrollRelative + scrollLeft;
            if (stickyPosition > leftWithScroll) {
              leftScrollRelative = leftCssValue;
            }
          }
        }
        if (hasStickyTopAttribute) {
          const topCssValue = parseFloat(computedStyle.top) || 0;
          fromStickyTopAttr = {
            value: topCssValue
          };
          if (useOriginalPositionEvenIfSticky) ; else {
            const scrollTop = scrollContainer.scrollTop;
            const stickyPosition = scrollTop + topCssValue;
            const topWithScroll = topScrollRelative + scrollTop;
            if (stickyPosition > topWithScroll) {
              topScrollRelative = topCssValue;
            }
          }
        }
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
  }


  const [leftScrollRelative, topScrollRelative] = viewportPosToScrollRelativePos(leftViewport, topViewport, scrollContainer);
  return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
};
const viewportPosToScrollRelativePos = (leftViewport, topViewport, scrollContainer) => {
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    return [leftViewport, topViewport];
  }
  const {
    left: scrollContainerLeftViewport,
    top: scrollContainerTopViewport
  } = scrollContainer.getBoundingClientRect();
  return [leftViewport - scrollContainerLeftViewport, topViewport - scrollContainerTopViewport];
};
const addScrollToRect = scrollRelativeRect => {
  const {
    left,
    top,
    width,
    height,
    scrollLeft,
    scrollTop
  } = scrollRelativeRect;
  const leftWithScroll = left + scrollLeft;
  const topWithScroll = top + scrollTop;
  return {
    ...scrollRelativeRect,
    left: leftWithScroll,
    top: topWithScroll,
    right: leftWithScroll + width,
    bottom: topWithScroll + height
  };
};



const getScrollBox = scrollContainer => {
  if (scrollContainer === documentElement) {
    const {
      clientWidth,
      clientHeight
    } = documentElement;
    return {
      left: 0,
      top: 0,
      right: clientWidth,
      bottom: clientHeight,
      width: clientWidth,
      height: clientHeight
    };
  }
  const {
    clientWidth,
    clientHeight
  } = scrollContainer;
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
    height: clientHeight
  };
};

const getScrollport = (scrollBox, scrollContainer) => {
  const {
    left,
    top,
    width,
    height
  } = scrollBox;
  const leftWithScroll = left + scrollContainer.scrollLeft;
  const topWithScroll = top + scrollContainer.scrollTop;
  const rightWithScroll = leftWithScroll + width;
  const bottomWithScroll = topWithScroll + height;
  return {
    left: leftWithScroll,
    top: topWithScroll,
    right: rightWithScroll,
    bottom: bottomWithScroll
  };
};

const getElementSelector = element => {
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? "#".concat(element.id) : "";
  const className = element.className ? ".".concat(element.className.split(" ").join(".")) : "";
  return "".concat(tagName).concat(id).concat(className);
};

installImportMetaCss(import.meta);const setupConstraintFeedbackLine = () => {
  const constraintFeedbackLine = createConstraintFeedbackLine();


  let lastMouseX = null;
  let lastMouseY = null;


  const onDrag = gestureInfo => {
    const {
      grabEvent,
      dragEvent
    } = gestureInfo;
    if (grabEvent.type === "programmatic" || dragEvent.type === "programmatic") {

      return;
    }
    const mouseX = dragEvent.clientX;
    const mouseY = dragEvent.clientY;

    const effectiveMouseX = mouseX !== null ? mouseX : lastMouseX;
    const effectiveMouseY = mouseY !== null ? mouseY : lastMouseY;
    if (effectiveMouseX === null || effectiveMouseY === null) {
      return;
    }


    lastMouseX = mouseX;
    lastMouseY = mouseY;
    const grabClientX = grabEvent.clientX;
    const grabClientY = grabEvent.clientY;


    const deltaX = effectiveMouseX - grabClientX;
    const deltaY = effectiveMouseY - grabClientY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const threshold = 20;
    if (distance <= threshold) {
      constraintFeedbackLine.style.opacity = "";
      constraintFeedbackLine.removeAttribute("data-visible");
      return;
    }


    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    constraintFeedbackLine.style.left = "".concat(grabClientX, "px");
    constraintFeedbackLine.style.top = "".concat(grabClientY, "px");
    constraintFeedbackLine.style.width = "".concat(distance, "px");
    constraintFeedbackLine.style.transform = "rotate(".concat(angle, "deg)");

    const maxOpacity = 0.8;
    const opacityFactor = Math.min((distance - threshold) / 100, 1);
    constraintFeedbackLine.style.opacity = "".concat(maxOpacity * opacityFactor);
    constraintFeedbackLine.setAttribute("data-visible", "");
  };
  return {
    onDrag,
    onRelease: () => {
      constraintFeedbackLine.remove();
    }
  };
};
const createConstraintFeedbackLine = () => {
  const line = document.createElement("div");
  line.className = "navi_constraint_feedback_line";
  line.title = "Constraint feedback - shows distance between mouse and moving grab point";
  document.body.appendChild(line);
  return line;
};
import.meta.css =          "\n  .navi_constraint_feedback_line {\n    position: fixed;\n    pointer-events: none;\n    z-index: 9998;\n    visibility: hidden;\n    transition: opacity 0.15s ease;\n    transform-origin: left center;\n    border-top: 2px dotted rgba(59, 130, 246, 0.7);\n  }\n\n  .navi_constraint_feedback_line[data-visible] {\n    visibility: visible;\n  }\n";

installImportMetaCss(import.meta);const MARKER_SIZE = 12;
let currentDebugMarkers = [];
let currentConstraintMarkers = [];
let currentReferenceElementMarker = null;
let currentElementMarker = null;
const setupDragDebugMarkers = (dragGesture, {
  referenceElement
}) => {

  {

    const container = document.getElementById("navi_debug_markers_container");
    if (container) {
      container.innerHTML = "";
    }
  }
  const {
    direction,
    scrollContainer
  } = dragGesture.gestureInfo;
  return {
    onConstraints: (constraints, {
      left,
      top,
      right,
      bottom,
      autoScrollArea
    }) => {

      const previousDebugMarkers = [...currentDebugMarkers];
      const previousConstraintMarkers = [...currentConstraintMarkers];
      const previousReferenceElementMarker = currentReferenceElementMarker;
      const previousElementMarker = currentElementMarker;
      if (previousDebugMarkers.length > 0 || previousConstraintMarkers.length > 0 || previousReferenceElementMarker || previousElementMarker) {
        setTimeout(() => {
          previousDebugMarkers.forEach(marker => marker.remove());
          previousConstraintMarkers.forEach(marker => marker.remove());
          if (previousReferenceElementMarker) {
            previousReferenceElementMarker.remove();
          }
          if (previousElementMarker) {
            previousElementMarker.remove();
          }
        }, 100);
      }


      currentDebugMarkers.length = 0;
      currentConstraintMarkers.length = 0;
      currentReferenceElementMarker = null;
      currentElementMarker = null;




      const elementLabel = referenceElement ? "Dragged Element" : "Element";
      const elementColor = referenceElement ? "255, 0, 150" : "0, 200, 0";

      currentElementMarker = createElementMarker({
        left,
        top,
        right,
        bottom,
        scrollContainer,
        label: elementLabel,
        color: elementColor
      });


      if (referenceElement) {
        currentReferenceElementMarker = createReferenceElementMarker({
          left,
          top,
          right,
          bottom,
          scrollContainer
        });
      }


      const markersToCreate = [];
      {
        if (direction.x) {
          markersToCreate.push({
            name: autoScrollArea.paddingLeft ? "autoscroll.left + padding(".concat(autoScrollArea.paddingLeft, ")") : "autoscroll.left",
            x: autoScrollArea.left,
            y: 0,
            color: "0 128 0",

            side: "left"
          });
          markersToCreate.push({
            name: autoScrollArea.paddingRight ? "autoscroll.right + padding(".concat(autoScrollArea.paddingRight, ")") : "autoscroll.right",
            x: autoScrollArea.right,
            y: 0,
            color: "0 128 0",

            side: "right"
          });
        }
        if (direction.y) {
          markersToCreate.push({
            name: autoScrollArea.paddingTop ? "autoscroll.top + padding(".concat(autoScrollArea.paddingTop, ")") : "autoscroll.top",
            x: 0,
            y: autoScrollArea.top,
            color: "255 0 0",

            side: "top"
          });
          markersToCreate.push({
            name: autoScrollArea.paddingBottom ? "autoscroll.bottom + padding(".concat(autoScrollArea.paddingBottom, ")") : "autoscroll.bottom",
            x: 0,
            y: autoScrollArea.bottom,
            color: "255 165 0",

            side: "bottom"
          });
        }
      }


      for (const constraint of constraints) {
        if (constraint.type === "bounds") {
          const {
            bounds
          } = constraint;


          if (direction.x) {
            if (bounds.left !== undefined) {
              markersToCreate.push({
                name: "".concat(constraint.name, ".left"),
                x: bounds.left,
                y: 0,
                color: "128 0 128",

                side: "left"
              });
            }
            if (bounds.right !== undefined) {


              markersToCreate.push({
                name: "".concat(constraint.name, ".right"),
                x: bounds.right,
                y: 0,
                color: "128 0 128",

                side: "right"
              });
            }
          }
          if (direction.y) {
            if (bounds.top !== undefined) {
              markersToCreate.push({
                name: "".concat(constraint.name, ".top"),
                x: 0,
                y: bounds.top,
                color: "128 0 128",

                side: "top"
              });
            }
            if (bounds.bottom !== undefined) {


              markersToCreate.push({
                name: "".concat(constraint.name, ".bottom"),
                x: 0,
                y: bounds.bottom,
                color: "128 0 128",

                side: "bottom"
              });
            }
          }
        } else if (constraint.type === "obstacle") {
          const obstacleMarker = createObstacleMarker(constraint, scrollContainer);
          currentConstraintMarkers.push(obstacleMarker);
        }
      }


      const createdMarkers = createMergedMarkers(markersToCreate, scrollContainer);
      currentDebugMarkers.push(...createdMarkers.filter(m => m.type !== "constraint"));
      currentConstraintMarkers.push(...createdMarkers.filter(m => m.type === "constraint"));
    },
    onRelease: () => {
      {
        return;
      }
    }
  };
};


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



const getDebugMarkerPos = (x, y, scrollContainer, side = null) => {
  const {
    documentElement
  } = document;
  const leftWithoutScroll = x - scrollContainer.scrollLeft;
  const topWithoutScroll = y - scrollContainer.scrollTop;
  let baseX;
  let baseY;
  if (scrollContainer === documentElement) {


    baseX = leftWithoutScroll;
    baseY = topWithoutScroll;
  } else {



    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    baseX = scrollContainerRect.left + leftWithoutScroll;
    baseY = scrollContainerRect.top + topWithoutScroll;
  }


  if (side === "left" || side === "right") {

    return [baseX, 0];
  }
  if (side === "top" || side === "bottom") {

    return [0, baseY];
  }


  return [baseX, baseY];
};
const createMergedMarkers = (markersToCreate, scrollContainer) => {
  const mergedMarkers = [];
  const positionMap = new Map();


  for (const marker of markersToCreate) {
    const key = "".concat(marker.x, ",").concat(marker.y, ",").concat(marker.side);
    if (!positionMap.has(key)) {
      positionMap.set(key, []);
    }
    positionMap.get(key).push(marker);
  }


  for (const [, markers] of positionMap) {
    if (markers.length === 1) {

      const marker = markers[0];
      const domMarker = createDebugMarker(marker, scrollContainer);
      domMarker.type = marker.name.includes("Bound") ? "constraint" : "visible";
      mergedMarkers.push(domMarker);
    } else {

      const firstMarker = markers[0];
      const combinedName = markers.map(m => m.name).join(" + ");


      const domMarker = createDebugMarker({
        ...firstMarker,
        name: combinedName
      }, scrollContainer);
      domMarker.type = markers.some(m => m.name.includes("Bound")) ? "constraint" : "visible";
      mergedMarkers.push(domMarker);
    }
  }
  return mergedMarkers;
};
const createDebugMarker = ({
  name,
  x,
  y,
  color = "255 0 0",
  side
}, scrollContainer) => {

  const [viewportX, viewportY] = getDebugMarkerPos(x, y, scrollContainer, side);
  const marker = document.createElement("div");
  marker.className = "navi_debug_marker";
  marker.setAttribute("data-".concat(side), "");

  marker.style.setProperty("--marker-color", "rgb(".concat(color, ")"));

  marker.style.left = side === "right" ? "".concat(viewportX - MARKER_SIZE, "px") : "".concat(viewportX, "px");
  marker.style.top = side === "bottom" ? "".concat(viewportY - MARKER_SIZE, "px") : "".concat(viewportY, "px");
  marker.title = name;


  const label = document.createElement("div");
  label.className = "navi_debug_marker_label";
  label.textContent = name;
  marker.appendChild(label);
  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};
const createObstacleMarker = (obstacleObj, scrollContainer) => {
  const width = obstacleObj.bounds.right - obstacleObj.bounds.left;
  const height = obstacleObj.bounds.bottom - obstacleObj.bounds.top;


  const [x, y] = getDebugMarkerPos(obstacleObj.bounds.left, obstacleObj.bounds.top, scrollContainer, "obstacle");
  const marker = document.createElement("div");
  marker.className = "navi_obstacle_marker";
  marker.style.left = "".concat(x, "px");
  marker.style.top = "".concat(y, "px");
  marker.style.width = "".concat(width, "px");
  marker.style.height = "".concat(height, "px");
  marker.title = obstacleObj.name;


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
  color = "0, 200, 0"
}) => {
  const width = right - left;
  const height = bottom - top;

  const [x, y] = getDebugMarkerPos(left, top, scrollContainer, "element");
  const marker = document.createElement("div");
  marker.className = "navi_element_marker";
  marker.style.left = "".concat(x, "px");
  marker.style.top = "".concat(y, "px");
  marker.style.width = "".concat(width, "px");
  marker.style.height = "".concat(height, "px");
  marker.title = label;


  marker.style.setProperty("--element-color", "rgb(".concat(color, ")"));
  marker.style.setProperty("--element-color-alpha", "rgba(".concat(color, ", 0.3)"));


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
  scrollContainer
}) => {
  const width = right - left;
  const height = bottom - top;

  const [x, y] = getDebugMarkerPos(left, top, scrollContainer, "reference");
  const marker = document.createElement("div");
  marker.className = "navi_reference_element_marker";
  marker.style.left = "".concat(x, "px");
  marker.style.top = "".concat(y, "px");
  marker.style.width = "".concat(width, "px");
  marker.style.height = "".concat(height, "px");
  marker.title = "Reference Element";


  const label = document.createElement("div");
  label.className = "navi_reference_element_marker_label";
  label.textContent = "Reference Element";
  marker.appendChild(label);
  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};
import.meta.css =          "\n  .navi_debug_markers_container {\n    position: fixed;\n    top: 0;\n    left: 0;\n    width: 100vw;\n    height: 100vh;\n    overflow: hidden;\n    pointer-events: none;\n    z-index: 999998;\n    --marker-size: ".concat(MARKER_SIZE, "px;\n  }\n\n  .navi_debug_marker {\n    position: absolute;\n    pointer-events: none;\n  }\n\n  /* Markers based on side rather than orientation */\n  .navi_debug_marker[data-left],\n  .navi_debug_marker[data-right] {\n    width: var(--marker-size);\n    height: 100vh;\n  }\n\n  .navi_debug_marker[data-top],\n  .navi_debug_marker[data-bottom] {\n    width: 100vw;\n    height: var(--marker-size);\n  }\n\n  /* Gradient directions based on side, using CSS custom properties for color */\n  .navi_debug_marker[data-left] {\n    background: linear-gradient(\n      to right,\n      rgba(from var(--marker-color) r g b / 0.9) 0%,\n      rgba(from var(--marker-color) r g b / 0.7) 30%,\n      rgba(from var(--marker-color) r g b / 0.3) 70%,\n      rgba(from var(--marker-color) r g b / 0) 100%\n    );\n  }\n\n  .navi_debug_marker[data-right] {\n    background: linear-gradient(\n      to left,\n      rgba(from var(--marker-color) r g b / 0.9) 0%,\n      rgba(from var(--marker-color) r g b / 0.7) 30%,\n      rgba(from var(--marker-color) r g b / 0.3) 70%,\n      rgba(from var(--marker-color) r g b / 0) 100%\n    );\n  }\n\n  .navi_debug_marker[data-top] {\n    background: linear-gradient(\n      to bottom,\n      rgba(from var(--marker-color) r g b / 0.9) 0%,\n      rgba(from var(--marker-color) r g b / 0.7) 30%,\n      rgba(from var(--marker-color) r g b / 0.3) 70%,\n      rgba(from var(--marker-color) r g b / 0) 100%\n    );\n  }\n\n  .navi_debug_marker[data-bottom] {\n    background: linear-gradient(\n      to top,\n      rgba(from var(--marker-color) r g b / 0.9) 0%,\n      rgba(from var(--marker-color) r g b / 0.7) 30%,\n      rgba(from var(--marker-color) r g b / 0.3) 70%,\n      rgba(from var(--marker-color) r g b / 0) 100%\n    );\n  }\n\n  .navi_debug_marker_label {\n    position: absolute;\n    font-size: 12px;\n    font-weight: bold;\n    background: rgba(255, 255, 255, 0.9);\n    padding: 2px 6px;\n    border-radius: 3px;\n    border: 1px solid;\n    white-space: nowrap;\n    pointer-events: none;\n    color: rgb(from var(--marker-color) r g b / 1);\n    border-color: rgb(from var(--marker-color) r g b / 1);\n  }\n\n  /* Label positioning based on side data attributes */\n\n  /* Left side markers - vertical with 90\xB0 rotation */\n  .navi_debug_marker[data-left] .navi_debug_marker_label {\n    left: 10px;\n    top: 20px;\n    transform: rotate(90deg);\n    transform-origin: left center;\n  }\n\n  /* Right side markers - vertical with -90\xB0 rotation */\n  .navi_debug_marker[data-right] .navi_debug_marker_label {\n    right: 10px;\n    left: auto;\n    top: 20px;\n    transform: rotate(-90deg);\n    transform-origin: right center;\n  }\n\n  /* Top side markers - horizontal, label on the line */\n  .navi_debug_marker[data-top] .navi_debug_marker_label {\n    top: 0px;\n    left: 20px;\n  }\n\n  /* Bottom side markers - horizontal, label on the line */\n  .navi_debug_marker[data-bottom] .navi_debug_marker_label {\n    bottom: 0px;\n    top: auto;\n    left: 20px;\n  }\n\n  .navi_obstacle_marker {\n    position: absolute;\n    background-color: orange;\n    opacity: 0.6;\n    z-index: 9999;\n    pointer-events: none;\n  }\n\n  .navi_obstacle_marker_label {\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    transform: translate(-50%, -50%);\n    font-size: 12px;\n    font-weight: bold;\n    color: white;\n    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);\n    pointer-events: none;\n  }\n\n  .navi_element_marker {\n    position: absolute;\n    background-color: var(--element-color-alpha, rgba(255, 0, 150, 0.3));\n    border: 2px solid var(--element-color, rgb(255, 0, 150));\n    opacity: 0.9;\n    z-index: 9997;\n    pointer-events: none;\n  }\n\n  .navi_element_marker_label {\n    position: absolute;\n    top: -25px;\n    right: 0;\n    font-size: 11px;\n    font-weight: bold;\n    color: var(--element-color, rgb(255, 0, 150));\n    background: rgba(255, 255, 255, 0.9);\n    padding: 2px 6px;\n    border-radius: 3px;\n    border: 1px solid var(--element-color, rgb(255, 0, 150));\n    white-space: nowrap;\n    pointer-events: none;\n  }\n\n  .navi_reference_element_marker {\n    position: absolute;\n    background-color: rgba(0, 150, 255, 0.3);\n    border: 2px dashed rgba(0, 150, 255, 0.7);\n    opacity: 0.8;\n    z-index: 9998;\n    pointer-events: none;\n  }\n\n  .navi_reference_element_marker_label {\n    position: absolute;\n    top: -25px;\n    left: 0;\n    font-size: 11px;\n    font-weight: bold;\n    color: rgba(0, 150, 255, 1);\n    background: rgba(255, 255, 255, 0.9);\n    padding: 2px 6px;\n    border-radius: 3px;\n    border: 1px solid rgba(0, 150, 255, 0.7);\n    white-space: nowrap;\n    pointer-events: none;\n  }\n");

const initDragConstraints = (dragGesture, {
  areaConstraint,
  obstaclesContainer,
  obstacleAttributeName,
  showConstraintFeedbackLine,
  showDebugMarkers,
  referenceElement
}) => {
  const dragGestureName = dragGesture.gestureInfo.name;
  const direction = dragGesture.gestureInfo.direction;
  const scrollContainer = dragGesture.gestureInfo.scrollContainer;
  const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
  const topAtGrab = dragGesture.gestureInfo.topAtGrab;
  const constraintFunctions = [];
  const addConstraint = constraint => {
    constraintFunctions.push(constraint);
  };
  if (showConstraintFeedbackLine) {
    const constraintFeedbackLine = setupConstraintFeedbackLine();
    dragGesture.addDragCallback(gestureInfo => {
      constraintFeedbackLine.onDrag(gestureInfo);
    });
    dragGesture.addReleaseCallback(() => {
      constraintFeedbackLine.onRelease();
    });
  }
  let dragDebugMarkers;
  if (showDebugMarkers) {
    dragDebugMarkers = setupDragDebugMarkers(dragGesture, {
      referenceElement
    });
    dragGesture.addReleaseCallback(() => {
      dragDebugMarkers.onRelease();
    });
  }
  {
    const areaConstraintFunction = createAreaConstraint(areaConstraint, {
      scrollContainer
    });
    if (areaConstraintFunction) {
      addConstraint(areaConstraintFunction);
    }
  }
  obstacles: {
    if (!obstacleAttributeName || !obstaclesContainer) {
      break obstacles;
    }
    const obstacleConstraintFunctions = createObstacleConstraintsFromQuerySelector(obstaclesContainer, {
      obstacleAttributeName,
      gestureInfo: dragGesture.gestureInfo,
      isDraggedElementSticky: false

    });
    for (const obstacleConstraintFunction of obstacleConstraintFunctions) {
      addConstraint(obstacleConstraintFunction);
    }
  }
  const applyConstraints = (layoutRequested, currentLayout, limitLayout, {
    elementWidth,
    elementHeight,
    scrollArea,
    scrollport,
    hasCrossedScrollportLeftOnce,
    hasCrossedScrollportTopOnce,
    autoScrollArea,
    dragEvent
  }) => {
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
      dragEvent
    };
    const constraints = constraintFunctions.map(fn => fn(constraintInitParams));
    const logConstraintEnforcement = (axis, constraint) => {
      if (constraint.type === "obstacle") {
        return;
      }
      const requested = axis === "x" ? elementLeftRequested : elementTopRequested;
      const constrained = axis === "x" ? elementLeft : elementTop;
      const action = constrained > requested ? "increased" : "capped";
      const property = axis === "x" ? "left" : "top";
      console.debug("Drag by ".concat(dragEvent.type, ": ").concat(property, " ").concat(action, " from ").concat(requested.toFixed(2), " to ").concat(constrained.toFixed(2), " by ").concat(constraint.type, ":").concat(constraint.name), constraint.element);
    };



    for (const constraint of constraints) {
      const result = constraint.apply({


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
        hasCrossedScrollportTopOnce
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
        autoScrollArea
      });
    }
    const leftModified = elementLeft !== elementLeftRequested;
    const topModified = elementTop !== elementTopRequested;
    if (!leftModified && !topModified) {
      {
        console.debug("Drag by ".concat(dragEvent.type, ": no constraint enforcement needed (").concat(elementLeftRequested.toFixed(2), ", ").concat(elementTopRequested.toFixed(2), ")"));
      }
      return;
    }
    limitLayout(elementLeft, elementTop);
  };
  return {
    applyConstraints
  };
};
const createAreaConstraint = (areaConstraint, {
  scrollContainer
}) => {
  if (!areaConstraint || areaConstraint === "none") {
    return null;
  }
  if (areaConstraint === "scrollport") {
    const scrollportConstraintFunction = ({
      scrollport
    }) => {
      return createBoundConstraint(scrollport, {
        element: scrollContainer,
        name: "scrollport"
      });
    };
    return scrollportConstraintFunction;
  }
  if (areaConstraint === "scroll") {
    const scrollAreaConstraintFunction = ({
      scrollArea
    }) => {
      return createBoundConstraint(scrollArea, {
        element: scrollContainer,
        name: "scroll_area"
      });
    };
    return scrollAreaConstraintFunction;
  }
  if (typeof areaConstraint === "function") {
    const dynamicAreaConstraintFunction = params => {
      const bounds = areaConstraint(params);
      return createBoundConstraint(bounds, {
        name: "dynamic_area"
      });
    };
    return dynamicAreaConstraintFunction;
  }
  if (typeof areaConstraint === "object") {
    const {
      left,
      top,
      right,
      bottom
    } = areaConstraint;
    const turnSidePropertyInToGetter = (value, side) => {
      if (value === "scrollport") {
        return ({
          scrollport
        }) => scrollport[side];
      }
      if (value === "scroll") {
        return ({
          scrollArea
        }) => scrollArea[side];
      }
      if (typeof value === "function") {
        return value;
      }
      if (value === undefined) {

        return ({
          scrollport
        }) => scrollport[side];
      }
      return () => value;
    };
    const getLeft = turnSidePropertyInToGetter(left, "left");
    const getRight = turnSidePropertyInToGetter(right, "right");
    const getTop = turnSidePropertyInToGetter(top, "top");
    const getBottom = turnSidePropertyInToGetter(bottom, "bottom");
    const dynamicAreaConstraintFunction = params => {
      const bounds = {
        left: getLeft(params),
        right: getRight(params),
        top: getTop(params),
        bottom: getBottom(params)
      };
      return createBoundConstraint(bounds, {
        name: "dynamic_area"
      });
    };
    return dynamicAreaConstraintFunction;
  }
  console.warn("Unknown areaConstraint value: ".concat(areaConstraint, ". Expected \"scrollport\", \"scroll\", \"none\", an object with boundary definitions, or a function returning boundary definitions."));
  return null;
};
const createObstacleConstraintsFromQuerySelector = (scrollableElement, {
  obstacleAttributeName,
  gestureInfo,
  isDraggedElementSticky = false
}) => {
  const dragGestureName = gestureInfo.name;
  const obstacles = scrollableElement.querySelectorAll("[".concat(obstacleAttributeName, "]"));
  const obstacleConstraintFunctions = [];
  for (const obstacle of obstacles) {
    if (obstacle.closest("[data-drag-ignore]")) {
      continue;
    }
    if (dragGestureName) {
      const obstacleAttributeValue = obstacle.getAttribute(obstacleAttributeName);
      if (obstacleAttributeValue) {
        const obstacleNames = obstacleAttributeValue.split(",");
        const found = obstacleNames.some(obstacleName => obstacleName.trim().toLowerCase() === dragGestureName.toLowerCase());
        if (!found) {
          continue;
        }
      }
    }
    obstacleConstraintFunctions.push(({
      hasCrossedVisibleAreaLeftOnce,
      hasCrossedVisibleAreaTopOnce
    }) => {


      const useOriginalPositionEvenIfSticky = isDraggedElementSticky ? !hasCrossedVisibleAreaLeftOnce && !hasCrossedVisibleAreaTopOnce : true;
      const obstacleScrollRelativeRect = getScrollRelativeRect(obstacle, scrollableElement, {
        useOriginalPositionEvenIfSticky
      });
      let obstacleBounds;
      if (useOriginalPositionEvenIfSticky && obstacleScrollRelativeRect.isSticky) {
        obstacleBounds = obstacleScrollRelativeRect;
      } else {
        obstacleBounds = addScrollToRect(obstacleScrollRelativeRect);
      }


      const obstacleObject = createObstacleContraint(obstacleBounds, {
        name: "".concat(obstacleBounds.isSticky ? "sticky " : "", "obstacle (").concat(getElementSelector(obstacle), ")"),
        element: obstacle
      });
      return obstacleObject;
    });
  }
  return obstacleConstraintFunctions;
};
const createBoundConstraint = (bounds, {
  name,
  element
} = {}) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;
  const apply = ({
    left,
    top,
    right,
    bottom,
    width,
    height
  }) => {
    let leftConstrained = left;
    let topConstrained = top;

    if (leftBound !== undefined && left < leftBound) {
      leftConstrained = leftBound;
    }

    if (rightBound !== undefined && right > rightBound) {
      leftConstrained = rightBound - width;
    }

    if (topBound !== undefined && top < topBound) {
      topConstrained = topBound;
    }

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
    bounds
  };
};
const createObstacleContraint = (bounds, {
  element,
  name
}) => {
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
    currentTop
  }) => {

    {

      const currentLeftRounded = roundForConstraints(currentLeft);
      const currentRightRounded = roundForConstraints(currentLeft + width);
      const currentTopRounded = roundForConstraints(currentTop);
      const currentBottomRounded = roundForConstraints(currentTop + height);
      const isOnTheLeft = currentRightRounded <= leftBoundRounded;
      const isOnTheRight = currentLeftRounded >= rightBoundRounded;
      const isAbove = currentBottomRounded <= topBoundRounded;
      const isBelow = currentTopRounded >= bottomBoundRounded;


      if (isOnTheLeft) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const maxLeft = leftBound - width;
          if (left > maxLeft) {
            return [maxLeft, top];
          }
        }
      }

      else if (isOnTheRight) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const minLeft = rightBound;
          if (left < minLeft) {
            return [minLeft, top];
          }
        }
      }

      else if (isAbove) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const maxTop = topBound - height;
          if (top > maxTop) {
            return [left, maxTop];
          }
        }
      }

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



    const distanceToLeft = right - leftBound;
    const distanceToRight = rightBound - left;
    const distanceToTop = bottom - topBound;
    const distanceToBottom = bottomBound - top;

    const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
    if (minDistance === distanceToLeft) {

      const maxLeft = leftBound - width;
      if (left > maxLeft) {
        return [maxLeft, top];
      }
    } else if (minDistance === distanceToRight) {

      const minLeft = rightBound;
      if (left < minLeft) {
        return [minLeft, top];
      }
    } else if (minDistance === distanceToTop) {

      const maxTop = topBound - height;
      if (top > maxTop) {
        return [left, maxTop];
      }
    } else if (minDistance === distanceToBottom) {

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
    bounds
  };
};


















const roundForConstraints = value => {
  return Math.round(value * 100) / 100;
};

const applyStickyFrontiersToAutoScrollArea = (autoScrollArea, {
  direction,
  scrollContainer,
  dragName
}) => {
  let {
    left,
    right,
    top,
    bottom
  } = autoScrollArea;
  if (direction.x) {
    const horizontalStickyFrontiers = createStickyFrontierOnAxis(scrollContainer, {
      name: dragName,
      scrollContainer,
      primarySide: "left",
      oppositeSide: "right"
    });
    for (const horizontalStickyFrontier of horizontalStickyFrontiers) {
      const {
        side,
        bounds,
        element
      } = horizontalStickyFrontier;
      if (side === "left") {
        if (bounds.right <= left) {
          continue;
        }
        left = bounds.right;
        continue;
      }

      if (bounds.left >= right) {
        continue;
      }
      right = bounds.left;
      continue;
    }
  }
  if (direction.y) {
    const verticalStickyFrontiers = createStickyFrontierOnAxis(scrollContainer, {
      name: dragName,
      scrollContainer,
      primarySide: "top",
      oppositeSide: "bottom"
    });
    for (const verticalStickyFrontier of verticalStickyFrontiers) {
      const {
        side,
        bounds,
        element
      } = verticalStickyFrontier;


      if (side === "top") {
        if (bounds.bottom <= top) {
          continue;
        }
        top = bounds.bottom;
        continue;
      }


      if (bounds.top >= bottom) {
        continue;
      }
      bottom = bounds.top;
      continue;
    }
  }
  return {
    left,
    right,
    top,
    bottom
  };
};
const createStickyFrontierOnAxis = (element, {
  name,
  scrollContainer,
  primarySide,
  oppositeSide
}) => {
  const primaryAttrName = "data-drag-sticky-".concat(primarySide, "-frontier");
  const oppositeAttrName = "data-drag-sticky-".concat(oppositeSide, "-frontier");
  const frontiers = element.querySelectorAll("[".concat(primaryAttrName, "], [").concat(oppositeAttrName, "]"));
  const matchingStickyFrontiers = [];
  for (const frontier of frontiers) {
    if (frontier.closest("[data-drag-ignore]")) {
      continue;
    }
    const hasPrimary = frontier.hasAttribute(primaryAttrName);
    const hasOpposite = frontier.hasAttribute(oppositeAttrName);

    if (hasPrimary && hasOpposite) {
      const elementSelector = getElementSelector(frontier);
      console.warn("Sticky frontier element (".concat(elementSelector, ") has both ").concat(primarySide, " and ").concat(oppositeSide, " attributes. \n  A sticky frontier should only have one side attribute."));
      continue;
    }
    const attrName = hasPrimary ? primaryAttrName : oppositeAttrName;
    const attributeValue = frontier.getAttribute(attrName);
    if (attributeValue && name) {
      const frontierNames = attributeValue.split(",");
      const isMatching = frontierNames.some(frontierName => frontierName.trim().toLowerCase() === name.toLowerCase());
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
      name: "sticky_frontier_".concat(hasPrimary ? primarySide : oppositeSide, " (").concat(getElementSelector(frontier), ")")
    };
    matchingStickyFrontiers.push(stickyFrontierObject);
  }
  return matchingStickyFrontiers;
};

const dragStyleController = createStyleController("drag_to_move");
const createDragToMoveGestureController = ({
  stickyFrontiers = true,


  autoScrollAreaPadding = 0,

  areaConstraint = "scroll",

  obstaclesContainer,
  obstacleAttributeName = "data-drag-obstacle",





  showConstraintFeedbackLine = true,
  showDebugMarkers = true,
  resetPositionAfterRelease = false,
  ...options
} = {}) => {
  const initGrabToMoveElement = (dragGesture, {
    element,
    referenceElement,
    elementToMove,
    convertScrollablePosition
  }) => {
    const direction = dragGesture.gestureInfo.direction;
    dragGesture.gestureInfo.name;
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;
    const elementImpacted = elementToMove || element;
    const translateXAtGrab = dragStyleController.getUnderlyingValue(elementImpacted, "transform.translateX");
    const translateYAtGrab = dragStyleController.getUnderlyingValue(elementImpacted, "transform.translateY");
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


      scrollArea = {
        left: 0,
        top: 0,
        right: scrollContainer.scrollWidth,
        bottom: scrollContainer.scrollHeight
      };
    }
    let scrollport;
    let autoScrollArea;
    {


      const scrollBox = getScrollBox(scrollContainer);
      const updateScrollportAndAutoScrollArea = () => {
        scrollport = getScrollport(scrollBox, scrollContainer);
        autoScrollArea = scrollport;
        if (stickyFrontiers) {
          autoScrollArea = applyStickyFrontiersToAutoScrollArea(autoScrollArea, {
            scrollContainer,
            direction});
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
            bottom: autoScrollArea.bottom - autoScrollAreaPadding
          };
        }
      };
      updateScrollportAndAutoScrollArea();
      dragGesture.addBeforeDragCallback(updateScrollportAndAutoScrollArea);
    }


    element.setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      element.removeAttribute("data-grabbed");
    });


    let hasCrossedScrollportLeftOnce = false;
    let hasCrossedScrollportTopOnce = false;
    const dragConstraints = initDragConstraints(dragGesture, {
      areaConstraint,
      obstaclesContainer: obstaclesContainer || scrollContainer,
      obstacleAttributeName,
      showConstraintFeedbackLine,
      showDebugMarkers,
      referenceElement
    });
    dragGesture.addBeforeDragCallback((layoutRequested, currentLayout, limitLayout, {
      dragEvent
    }) => {
      dragConstraints.applyConstraints(layoutRequested, currentLayout, limitLayout, {
        elementWidth,
        elementHeight,
        scrollArea,
        scrollport,
        hasCrossedScrollportLeftOnce,
        hasCrossedScrollportTopOnce,
        autoScrollArea,
        dragEvent
      });
    });
    const dragToMove = gestureInfo => {
      const {
        isGoingDown,
        isGoingUp,
        isGoingLeft,
        isGoingRight,
        layout
      } = gestureInfo;
      const left = layout.left;
      const top = layout.top;
      const right = left + elementWidth;
      const bottom = top + elementHeight;
      {
        hasCrossedScrollportLeftOnce = hasCrossedScrollportLeftOnce || left < scrollport.left;
        hasCrossedScrollportTopOnce = hasCrossedScrollportTopOnce || top < scrollport.top;
        const getScrollMove = axis => {
          const isGoingPositive = axis === "x" ? isGoingRight : isGoingDown;
          if (isGoingPositive) {
            const elementEnd = axis === "x" ? right : bottom;
            const autoScrollAreaEnd = axis === "x" ? autoScrollArea.right : autoScrollArea.bottom;
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
          const canAutoScrollNegative = axis === "x" ? !referenceOrEl.hasAttribute("data-sticky-left") || hasCrossedScrollportLeftOnce : !referenceOrEl.hasAttribute("data-sticky-top") || hasCrossedScrollportTopOnce;
          if (!canAutoScrollNegative) {
            return 0;
          }
          const elementStart = axis === "x" ? left : top;
          const autoScrollAreaStart = axis === "x" ? autoScrollArea.left : autoScrollArea.top;
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
            scrollLeftTarget = scrollContainer.scrollLeft + containerScrollLeftMove;
          }
        }
        if (direction.y) {
          const containerScrollTopMove = getScrollMove("y");
          if (containerScrollTopMove) {
            scrollTopTarget = scrollContainer.scrollTop + containerScrollTopMove;
          }
        }

        if (scrollLeftTarget !== undefined) {
          scrollContainer.scrollLeft = scrollLeftTarget;
        }
        if (scrollTopTarget !== undefined) {
          scrollContainer.scrollTop = scrollTopTarget;
        }
      }
      {
        const {
          scrollableLeft,
          scrollableTop
        } = layout;
        const [positionedLeft, positionedTop] = convertScrollablePosition(scrollableLeft, scrollableTop);
        const transform = {};
        if (direction.x) {
          const leftTarget = positionedLeft;
          const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
          const leftDelta = leftTarget - leftAtGrab;
          const translateX = translateXAtGrab ? translateXAtGrab + leftDelta : leftDelta;
          transform.translateX = translateX;






        }
        if (direction.y) {
          const topTarget = positionedTop;
          const topAtGrab = dragGesture.gestureInfo.topAtGrab;
          const topDelta = topTarget - topAtGrab;
          const translateY = translateYAtGrab ? translateYAtGrab + topDelta : topDelta;
          transform.translateY = translateY;
        }
        dragStyleController.set(elementImpacted, {
          transform
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
    const [elementScrollableLeft, elementScrollableTop, convertScrollablePosition] = createDragElementPositioner(element, referenceElement, elementToMove);
    const dragGesture = grab({
      element,
      scrollContainer,
      layoutScrollableLeft: elementScrollableLeft,
      layoutScrollableTop: elementScrollableTop,
      ...rest
    });
    initGrabToMoveElement(dragGesture, {
      element,
      referenceElement,
      elementToMove,
      convertScrollablePosition
    });
    return dragGesture;
  };
  return dragGestureController;
};

const startDragToResizeGesture = (pointerdownEvent, {
  onDragStart,
  onDrag,
  onRelease,
  ...options
}) => {
  const target = pointerdownEvent.target;
  if (!target.closest) {
    return null;
  }
  const elementWithDataResizeHandle = target.closest("[data-resize-handle]");
  if (!elementWithDataResizeHandle) {
    return null;
  }
  let elementToResize;
  const dataResizeHandle = elementWithDataResizeHandle.getAttribute("data-resize-handle");
  if (!dataResizeHandle || dataResizeHandle === "true") {
    elementToResize = elementWithDataResizeHandle.closest("[data-resize]");
  } else {
    elementToResize = document.querySelector("#".concat(dataResizeHandle));
  }
  if (!elementToResize) {
    console.warn("No element to resize found");
    return null;
  }


  const resizeDirection = getResizeDirection(elementToResize);
  if (!resizeDirection.x && !resizeDirection.y) {
    return null;
  }
  const dragToResizeGestureController = createDragGestureController({
    onDragStart: (...args) => {
      onDragStart?.(...args);
    },
    onDrag,
    onRelease: (...args) => {
      elementWithDataResizeHandle.removeAttribute("data-active");
      onRelease?.(...args);
    }
  });
  elementWithDataResizeHandle.setAttribute("data-active", "");
  const dragToResizeGesture = dragToResizeGestureController.grabViaPointer(pointerdownEvent, {
    element: elementToResize,
    direction: resizeDirection,
    cursor: resizeDirection.x && resizeDirection.y ? "nwse-resize" : resizeDirection.x ? "ew-resize" : "ns-resize",
    ...options
  });
  return dragToResizeGesture;
};
const getResizeDirection = element => {
  const direction = element.getAttribute("data-resize");
  const x = direction === "horizontal" || direction === "both";
  const y = direction === "vertical" || direction === "both";
  return {
    x,
    y
  };
};









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

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const clientX = dragElementCenterX < 0 ? 0 : dragElementCenterX > viewportWidth ? viewportWidth - 1 : dragElementCenterX;
  const clientY = dragElementCenterY < 0 ? 0 : dragElementCenterY > viewportHeight ? viewportHeight - 1 : dragElementCenterY;


  const elementsUnderDragElement = document.elementsFromPoint(clientX, clientY);
  let targetElement = null;
  let targetIndex = -1;
  for (const element of elementsUnderDragElement) {

    const directIndex = intersectingTargets.indexOf(element);
    if (directIndex !== -1) {
      targetElement = element;
      targetIndex = directIndex;
      break;
    }


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


  const targetRect = targetElement.getBoundingClientRect();
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const result = {
    index: targetIndex,
    element: targetElement,
    elementSide: {
      x: dragElementRect.left < targetCenterX ? "start" : "end",
      y: dragElementRect.top < targetCenterY ? "start" : "end"
    },
    intersecting: intersectingTargets
  };
  return result;
};
const rectangleAreIntersecting = (r1, r2) => {
  return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
};
const isTableCell = el => {
  return el.tagName === "TD" || el.tagName === "TH";
};







const findTableCellCol = cellElement => {
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

const getPositionedParent = element => {
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const position = window.getComputedStyle(parent).position;
    if (position === "relative" || position === "absolute" || position === "fixed") {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.body;
};

const getHeight = element => {
  const {
    height
  } = element.getBoundingClientRect();
  return height;
};

const getWidth = element => {
  const {
    width
  } = element.getBoundingClientRect();
  return width;
};

installImportMetaCss(import.meta);import.meta.css =          "\n  [data-position-sticky-placeholder] {\n    opacity: 0 !important;\n    position: static !important;\n    width: auto !important;\n    height: auto !important;\n  }\n";
const initPositionSticky = element => {
  const computedStyle = getComputedStyle(element);
  const topCssValue = computedStyle.top;
  const top = parseFloat(topCssValue);
  if (isNaN(top)) {
    return () => {};
  }


  const scrollContainerSet = getScrollContainerSet(element);
  {
    let hasOverflowHiddenOrAuto = false;
    for (const scrollContainer of scrollContainerSet) {
      const scrollContainerComputedStyle = getComputedStyle(scrollContainer);
      const overflowX = scrollContainerComputedStyle.overflowX;
      if (overflowX === "auto" || overflowX === "hidden") {
        hasOverflowHiddenOrAuto = true;
        break;
      }
      const overflowY = scrollContainerComputedStyle.overflowY;
      if (overflowY === "auto" || overflowY === "hidden") {
        hasOverflowHiddenOrAuto = true;
        break;
      }
    }
    if (!hasOverflowHiddenOrAuto) {
      return () => {};
    }
  }
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  const parentElement = element.parentElement;
  const createPlaceholderClone = () => {
    const clone = element.cloneNode(true);
    clone.setAttribute("data-position-sticky-placeholder", "");
    clone.removeAttribute("data-sticky");
    return clone;
  };
  let placeholder = createPlaceholderClone();
  parentElement.insertBefore(placeholder, element);
  cleanupCallbackSet.add(() => {
    placeholder.remove();
  });
  let width = getWidth(element);
  let height = getHeight(element);
  const updateSize = () => {
    const newPlaceholder = createPlaceholderClone();
    parentElement.replaceChild(newPlaceholder, placeholder);
    placeholder = newPlaceholder;
    width = getWidth(placeholder);
    height = getHeight(placeholder);
    updatePosition();
  };
  const updatePosition = () => {

    setStyles(placeholder, {
      width: "".concat(width, "px"),
      height: "".concat(height, "px")
    });
    const placeholderRect = placeholder.getBoundingClientRect();
    const parentRect = parentElement.getBoundingClientRect();


    const leftPosition = placeholderRect.left;
    element.style.left = "".concat(Math.round(leftPosition), "px");


    let topPosition;
    let isStuck = false;


    if (placeholderRect.top <= top) {

      topPosition = top;
      isStuck = true;


      const parentBottom = parentRect.bottom;
      const elementBottom = top + height;
      if (elementBottom > parentBottom) {

        topPosition = parentBottom - height;
      }
    } else {

      topPosition = placeholderRect.top;
    }
    element.style.top = "".concat(topPosition, "px");
    element.style.width = "".concat(width, "px");
    element.style.height = "".concat(height, "px");


    if (isStuck) {
      element.setAttribute("data-sticky", "");
    } else {
      element.removeAttribute("data-sticky");
    }
  };
  {
    const restorePositionStyle = forceStyles(element, {
      "position": "fixed",
      "z-index": 1,
      "will-change": "transform"
    });
    cleanupCallbackSet.add(restorePositionStyle);
  }
  updatePosition();
  {
    const handleScroll = () => {
      updatePosition();
    };
    for (const scrollContainer of scrollContainerSet) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true
      });
      cleanupCallbackSet.add(() => {
        scrollContainer.removeEventListener("scroll", handleScroll, {
          passive: true
        });
      });
    }
  }
  {
    let animationFrame = null;
    const resizeObserver = new ResizeObserver(() => {
      if (animationFrame !== null) {
        return;
      }
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        updateSize();
      });
    });
    resizeObserver.observe(parentElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    });
  }
  {
    const mutationObserver = new MutationObserver(() => {
      updateSize();
    });
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }
  return cleanup;
};

const stickyAsRelativeCoords = (element, referenceElement, {
  scrollContainer = getScrollContainer(element)
} = {}) => {
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


    if (hasStickyLeftAttribute) {
      const cssLeftValue = parseFloat(computedStyle.left) || 0;
      const isStuckLeft = elementRect.left <= cssLeftValue;
      if (isStuckLeft) {
        const elementOffsetRelative = elementRect.left - referenceElementRect.left;
        leftPosition = elementOffsetRelative - cssLeftValue;
      } else {
        leftPosition = 0;
      }
    }
    if (hasTopStickyAttribute) {
      const cssTopValue = parseFloat(computedStyle.top) || 0;
      const isStuckTop = elementRect.top <= cssTopValue;
      if (isStuckTop) {
        const elementOffsetRelative = elementRect.top - referenceElementRect.top;
        topPosition = elementOffsetRelative - cssTopValue;
      } else {
        topPosition = 0;
      }
    }
    return [leftPosition, topPosition];
  }


  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  if (hasStickyLeftAttribute) {
    const cssLeftValue = parseFloat(computedStyle.left) || 0;

    const isStuckLeft = elementRect.left <= scrollContainerRect.left + cssLeftValue;
    if (isStuckLeft) {

      const elementOffsetRelative = elementRect.left - referenceElementRect.left;
      leftPosition = elementOffsetRelative - cssLeftValue;
    } else {

      leftPosition = 0;
    }
  }
  if (hasTopStickyAttribute) {
    const cssTopValue = parseFloat(computedStyle.top) || 0;

    const isStuckTop = elementRect.top <= scrollContainerRect.top + cssTopValue;
    if (isStuckTop) {

      const elementOffsetRelative = elementRect.top - referenceElementRect.top;
      topPosition = elementOffsetRelative - cssTopValue;
    } else {

      topPosition = 0;
    }
  }
  return [leftPosition, topPosition];
};













const visibleRectEffect = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollContainer = getScrollContainer(element);
  const scrollContainerIsDocument = scrollContainer === document.documentElement;
  const check = reason => {


    const {
      scrollLeft,
      scrollTop
    } = scrollContainer;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;


    let elementAbsoluteLeft;
    let elementAbsoluteTop;
    if (scrollContainerIsDocument) {

      const rect = element.getBoundingClientRect();
      elementAbsoluteLeft = rect.left + scrollLeft;
      elementAbsoluteTop = rect.top + scrollTop;
    } else {

      const elementRect = element.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      elementAbsoluteLeft = elementRect.left - scrollContainerRect.left + scrollLeft;
      elementAbsoluteTop = elementRect.top - scrollContainerRect.top + scrollTop;
    }
    const leftVisible = visibleAreaLeft < elementAbsoluteLeft ? elementAbsoluteLeft - visibleAreaLeft : 0;
    const topVisible = visibleAreaTop < elementAbsoluteTop ? elementAbsoluteTop - visibleAreaTop : 0;

    let overlayLeft = leftVisible;
    let overlayTop = topVisible;
    if (!scrollContainerIsDocument) {
      const {
        left: scrollableLeft,
        top: scrollableTop
      } = scrollContainer.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }


    const {
      width,
      height
    } = element.getBoundingClientRect();
    const visibleAreaWidth = scrollContainer.clientWidth;
    const visibleAreaHeight = scrollContainer.clientHeight;
    const visibleAreaRight = visibleAreaLeft + visibleAreaWidth;
    const visibleAreaBottom = visibleAreaTop + visibleAreaHeight;

    let widthVisible;
    {
      const maxVisibleWidth = visibleAreaWidth - leftVisible;
      const elementAbsoluteRight = elementAbsoluteLeft + width;
      const elementLeftIsVisible = elementAbsoluteLeft >= visibleAreaLeft;
      const elementRightIsVisible = elementAbsoluteRight <= visibleAreaRight;
      if (elementLeftIsVisible && elementRightIsVisible) {

        widthVisible = width;
      } else if (elementLeftIsVisible && !elementRightIsVisible) {

        widthVisible = visibleAreaRight - elementAbsoluteLeft;
      } else if (!elementLeftIsVisible && elementRightIsVisible) {

        widthVisible = elementAbsoluteRight - visibleAreaLeft;
      } else {

        widthVisible = maxVisibleWidth;
      }
    }

    let heightVisible;
    {
      const maxVisibleHeight = visibleAreaHeight - topVisible;
      const elementAbsoluteBottom = elementAbsoluteTop + height;
      const elementTopIsVisible = elementAbsoluteTop >= visibleAreaTop;
      const elementBottomIsVisible = elementAbsoluteBottom <= visibleAreaBottom;
      if (elementTopIsVisible && elementBottomIsVisible) {

        heightVisible = height;
      } else if (elementTopIsVisible && !elementBottomIsVisible) {

        heightVisible = visibleAreaBottom - elementAbsoluteTop;
      } else if (!elementTopIsVisible && elementBottomIsVisible) {

        heightVisible = elementAbsoluteBottom - visibleAreaTop;
      } else {

        heightVisible = maxVisibleHeight;
      }
    }


    const scrollVisibilityRatio = widthVisible * heightVisible / (width * height);

    let documentVisibilityRatio;
    if (scrollContainerIsDocument) {
      documentVisibilityRatio = scrollVisibilityRatio;
    } else {

      const elementRect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const elementLeft = Math.max(0, elementRect.left);
      const elementTop = Math.max(0, elementRect.top);
      const elementRight = Math.min(viewportWidth, elementRect.right);
      const elementBottom = Math.min(viewportHeight, elementRect.bottom);
      const documentVisibleWidth = Math.max(0, elementRight - elementLeft);
      const documentVisibleHeight = Math.max(0, elementBottom - elementTop);
      documentVisibilityRatio = documentVisibleWidth * documentVisibleHeight / (width * height);
    }
    const visibleRect = {
      left: overlayLeft,
      top: overlayTop,
      right: overlayLeft + widthVisible,
      bottom: overlayTop + heightVisible,
      width: widthVisible,
      height: heightVisible,
      visibilityRatio: documentVisibilityRatio,
      scrollVisibilityRatio
    };
    update(visibleRect, {
      width,
      height
    });
  };
  check();
  const [publishBeforeAutoCheck, onBeforeAutoCheck] = createPubSub();
  {
    const autoCheck = reason => {
      const beforeCheckResults = publishBeforeAutoCheck(reason);
      check();
      for (const beforeCheckResult of beforeCheckResults) {
        if (typeof beforeCheckResult === "function") {
          beforeCheckResult();
        }
      }
    };











    {


      const onDocumentScroll = () => {
        autoCheck("document_scroll");
      };
      document.addEventListener("scroll", onDocumentScroll, {
        passive: true
      });
      addTeardown(() => {
        document.removeEventListener("scroll", onDocumentScroll, {
          passive: true
        });
      });
      if (!scrollContainerIsDocument) {
        const onScroll = () => {
          autoCheck("scrollable_parent_scroll");
        };
        scrollContainer.addEventListener("scroll", onScroll, {
          passive: true
        });
        addTeardown(() => {
          scrollContainer.removeEventListener("scroll", onScroll, {
            passive: true
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

      onBeforeAutoCheck(() => {
        resizeObserver.unobserve(element);
        return () => {


          resizeObserver.observe(element);
        };
      });
      addTeardown(() => {
        resizeObserver.disconnect();
      });
    }
    {
      const documentIntersectionObserver = new IntersectionObserver(() => {
        autoCheck("element_intersection_with_document_change");
      }, {
        root: null,
        rootMargin: "0px",
        threshold: [0, 0.1, 0.9, 1]
      });
      documentIntersectionObserver.observe(element);
      addTeardown(() => {
        documentIntersectionObserver.disconnect();
      });
      if (!scrollContainerIsDocument) {
        const scrollIntersectionObserver = new IntersectionObserver(() => {
          autoCheck("element_intersection_with_scroll_change");
        }, {
          root: scrollContainer,
          rootMargin: "0px",
          threshold: [0, 0, 1, 0.9, 1]
        });
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
        passive: true
      });
      addTeardown(() => {
        window.removeEventListener("touchmove", onWindowTouchMove, {
          passive: true
        });
      });
    }
  }
  return {
    check,
    onBeforeAutoCheck,
    disconnect: () => {
      teardown();
    }
  };
};
const pickPositionRelativeTo = (element, target, {
  alignToViewportEdgeWhenTargetNearEdge = 0,
  forcePosition
} = {}) => {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const elementRect = element.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const {
    left: elementLeft,
    right: elementRight,
    top: elementTop,
    bottom: elementBottom
  } = elementRect;
  const {
    left: targetLeft,
    right: targetRight,
    top: targetTop,
    bottom: targetBottom
  } = targetRect;
  const elementWidth = elementRight - elementLeft;
  const elementHeight = elementBottom - elementTop;
  const targetWidth = targetRight - targetLeft;


  let elementPositionLeft;
  {

    const targetIsWiderThanViewport = targetWidth > viewportWidth;
    if (targetIsWiderThanViewport) {
      const targetLeftIsVisible = targetLeft >= 0;
      const targetRightIsVisible = targetRight <= viewportWidth;
      if (!targetLeftIsVisible && targetRightIsVisible) {

        const viewportCenter = viewportWidth / 2;
        const distanceFromRightEdge = viewportWidth - targetRight;
        elementPositionLeft = viewportCenter - distanceFromRightEdge / 2 - elementWidth / 2;
      } else if (targetLeftIsVisible && !targetRightIsVisible) {

        const viewportCenter = viewportWidth / 2;
        const distanceFromLeftEdge = -targetLeft;
        elementPositionLeft = viewportCenter - distanceFromLeftEdge / 2 - elementWidth / 2;
      } else {

        elementPositionLeft = viewportWidth / 2 - elementWidth / 2;
      }
    } else {

      elementPositionLeft = targetLeft + targetWidth / 2 - elementWidth / 2;

      if (alignToViewportEdgeWhenTargetNearEdge) {
        const elementIsWiderThanTarget = elementWidth > targetWidth;
        const targetIsNearLeftEdge = targetLeft < alignToViewportEdgeWhenTargetNearEdge;
        if (elementIsWiderThanTarget && targetIsNearLeftEdge) {
          elementPositionLeft = 0;
        }
      }
    }

    if (elementPositionLeft < 0) {
      elementPositionLeft = 0;
    } else if (elementPositionLeft + elementWidth > viewportWidth) {
      elementPositionLeft = viewportWidth - elementWidth;
    }
  }


  let position;
  const spaceAboveTarget = targetTop;
  const spaceBelowTarget = viewportHeight - targetBottom;
  determine_position: {
    if (forcePosition) {
      position = forcePosition;
      break determine_position;
    }
    const preferredPosition = element.getAttribute("data-position");
    const minContentVisibilityRatio = 0.6;
    if (preferredPosition) {

      const visibleRatio = preferredPosition === "above" ? spaceAboveTarget / elementHeight : spaceBelowTarget / elementHeight;
      const canShowMinimumContent = visibleRatio >= minContentVisibilityRatio;
      if (canShowMinimumContent) {
        position = preferredPosition;
        break determine_position;
      }
    }

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

      const idealTopWhenBelow = targetBottom;
      elementPositionTop = idealTopWhenBelow % 1 === 0 ? idealTopWhenBelow : Math.floor(idealTopWhenBelow) + 1;
    } else {

      const idealTopWhenAbove = targetTop - elementHeight;
      const minimumTopInViewport = 0;
      elementPositionTop = idealTopWhenAbove < minimumTopInViewport ? minimumTopInViewport : idealTopWhenAbove;
    }
  }


  const {
    scrollLeft,
    scrollTop
  } = document.documentElement;
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
    spaceBelowTarget
  };
};

const parseTransform = transform => {
  if (!transform || transform === "none") return new Map();
  const transformMap = new Map();
  if (transform.startsWith("matrix(")) {

    const values = transform.match(/matrix\((.*?)\)/)?.[1].split(",").map(Number);
    if (values) {
      const translateX = values[4];
      transformMap.set("translateX", {
        value: translateX,
        unit: "px"
      });
      return transformMap;
    }
  }


  const matches = transform.matchAll(/(\w+)\(([-\d.]+)(%|px|deg)?\)/g);
  for (const match of matches) {
    const [, func, value, unit = ""] = match;
    transformMap.set(func, {
      value: parseFloat(value),
      unit
    });
  }
  return transformMap;
};

const EASING = {
  LINEAR: x => x,
  EASE: x => {
    return cubicBezier(x, 0.25, 0.1, 0.25, 1.0);
  },
  EASE_IN: x => {
    return cubicBezier(x, 0.42, 0, 1.0, 1.0);
  },
  EASE_OUT: x => {
    return cubicBezier(x, 0, 0, 0.58, 1.0);
  },
  EASE_IN_OUT: x => {
    return cubicBezier(x, 0.42, 0, 0.58, 1.0);
  },
  EASE_IN_OUT_CUBIC: x => {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
  EASE_IN_EXPO: x => {
    return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
  },
  EASE_OUT_EXPO: x => {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  },
  EASE_OUT_ELASTIC: x => {
    const c4 = 2 * Math.PI / 3;
    if (x === 0) {
      return 0;
    }
    if (x === 1) {
      return 1;
    }
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  },
  EASE_OUT_CUBIC: x => {
    return 1 - Math.pow(1 - x, 3);
  }
};
const cubicBezier = (t, initial, p1, p2, final) => {
  return (1 - t) * (1 - t) * (1 - t) * initial + 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t * final;
};

const getTimelineCurrentTime = () => {
  return document.timeline.currentTime;
};
const visualCallbackSet = new Set();
const backgroundCallbackSet = new Set();
const addOnTimeline = (callback, isVisual) => {
  if (isVisual) {
    visualCallbackSet.add(callback);
  } else {
    backgroundCallbackSet.add(callback);
  }
};
const removeFromTimeline = (callback, isVisual) => {
  if (isVisual) {
    visualCallbackSet.delete(callback);
  } else {
    backgroundCallbackSet.delete(callback);
  }
};



const createBackgroundUpdateLoop = () => {
  let timeout;
  const update = () => {
    for (const backgroundCallback of backgroundCallbackSet) {
      backgroundCallback();
    }
    timeout = setTimeout(update, 16);
  };
  return {
    start: () => {
      timeout = setTimeout(update, 16);
    },
    stop: () => {
      clearTimeout(timeout);
    }
  };
};

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
    }
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


const LIFECYCLE_DEFAULT = {
  setup: () => {},
  pause: () => {},
  cancel: () => {},
  finish: () => {},
  updateTarget: () => {}
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
    finish: finishCallbacks
  };
  if (onUpdate) {
    updateCallbacks.add(onUpdate);
  }
  let playState = "idle";
  let isFirstUpdate = false;
  let resume;
  let executionLifecycle = null;
  const start = () => {
    isFirstUpdate = true;
    playState = "running";
    executionLifecycle = lifecycle.setup(transition);


    if (transition.from === undefined && executionLifecycle.from !== undefined) {
      transition.from = executionLifecycle.from;
    }
    const diff = Math.abs(transition.to - transition.from);
    if (diff === 0) {
      console.warn("".concat(constructor.name, " transition has identical from and to values (").concat(transition.from, "). This transition will have no effect."));
    } else if (typeof minDiff === "number" && diff < minDiff) {
      console.warn("".concat(constructor.name, " transition difference is very small (").concat(diff, "). Consider if this transition is necessary (minimum threshold: ").concat(minDiff, ")."));
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


      const originalFrom = transition.from;
      const originalTo = transition.to;
      transition.from = originalTo;
      transition.to = originalFrom;


      if (lifecycle.reverse) {
        lifecycle.reverse(transition);
      }
    },
    updateTarget: newTarget => {
      if (typeof newTarget !== "number" || isNaN(newTarget) || !isFinite(newTarget)) {
        throw new Error("updateTarget: newTarget must be a finite number, got ".concat(newTarget));
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


      lifecycle.updateTarget(transition);
    },
    ...rest
  };
  return transition;
};


const createTimelineTransition = ({
  isVisual,
  duration,
  fps = 60,
  easing = EASING.EASE_OUT,
  lifecycle,
  startProgress = 0,

  ...options
}) => {
  if (typeof duration !== "number" || duration <= 0) {
    throw new Error("Invalid duration: ".concat(duration, ". Duration must be a positive number."));
  }
  let lastUpdateTime = -1;
  const timeChangeCallback = () => {
    const timelineCurrentTime = getTimelineCurrentTime();
    const msElapsedSinceStart = timelineCurrentTime - transition.startTime;
    const msRemaining = transition.duration - msElapsedSinceStart;
    if (

    msRemaining < 0 ||

    msRemaining <= transition.frameDuration) {
      transition.frameRemainingCount = 0;
      transition.progress = 1;
      transition.update(transition.to, true);
      transition.finish();
      return;
    }
    if (lastUpdateTime === -1) ; else {
      const timeSinceLastUpdate = timelineCurrentTime - lastUpdateTime;


      const frameTimeTolerance = 3;
      const targetFrameTime = transition.frameDuration - frameTimeTolerance;


      if (timeSinceLastUpdate < targetFrameTime) {
        return;
      }
    }
    lastUpdateTime = timelineCurrentTime;
    const rawProgress = Math.min(msElapsedSinceStart / transition.duration, 1);

    const progress = startProgress + rawProgress * (1 - startProgress);
    transition.progress = progress;
    const easedProgress = transition.easing(progress);
    const value = transition.from + (transition.to - transition.from) * easedProgress;
    transition.frameRemainingCount = Math.ceil(msRemaining / transition.frameDuration);
    transition.update(value);
  };
  const onTimelineNeeded = () => {
    addOnTimeline(timeChangeCallback, isVisual);
  };
  const onTimelineNotNeeded = () => {
    removeFromTimeline(timeChangeCallback, isVisual);
  };
  const {
    setup
  } = lifecycle;
  const transition = createTransition({
    ...options,
    startTime: null,
    progress: startProgress,

    duration,
    easing,
    fps,
    get frameDuration() {
      return 1000 / fps;
    },
    frameRemainingCount: 0,
    startProgress,

    lifecycle: {
      ...lifecycle,
      setup: transition => {

        lastUpdateTime = -1;
        transition.startTime = getTimelineCurrentTime();

        const remainingProgress = 1 - startProgress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(remainingDuration / transition.frameDuration);
        onTimelineNeeded();

        return setup(transition);
      },
      pause: transition => {
        const pauseTime = getTimelineCurrentTime();
        onTimelineNotNeeded();
        return () => {
          const pausedDuration = getTimelineCurrentTime() - pauseTime;
          transition.startTime += pausedDuration;

          if (lastUpdateTime !== -1) {
            lastUpdateTime += pausedDuration;
          }
          onTimelineNeeded();
        };
      },
      updateTarget: transition => {
        transition.startTime = getTimelineCurrentTime();


        const remainingProgress = 1 - transition.progress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(remainingDuration / transition.frameDuration);
      },
      cancel: () => {
        onTimelineNotNeeded();
      },
      finish: () => {
        onTimelineNotNeeded();
      }
    }
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
    add: callback => {
      if (typeof callback !== "function") {
        throw new TypeError("Callback must be a function");
      }
      callbackSet.add(callback);
      return () => {
        callbackSet.delete(callback);
      };
    }
  };
  return [callbacks, execute];
};

installImportMetaCss(import.meta);import.meta.css =          "\n  /* Transition data attributes override inline styles using CSS custom properties */\n  *[data-transition-opacity] {\n    opacity: var(--ui-transition-opacity) !important;\n  }\n\n  *[data-transition-translate-x] {\n    transform: translateX(var(--ui-transition-translate-x)) !important;\n  }\n\n  *[data-transition-width] {\n    width: var(--ui-transition-width) !important;\n  }\n\n  *[data-transition-height] {\n    height: var(--ui-transition-height) !important;\n  }\n";
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
          update: ({
            value
          }) => {
            const valueWithUnit = "".concat(value, "px");
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
          }
        };
      }
    }
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
          update: ({
            value
          }) => {
            const valueWithUnit = "".concat(value, "px");
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
          }
        };
      }
    }
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
          update: ({
            value
          }) => {
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
          }
        };
      }
    }
  });
  return opacityTransition;
};
const getOpacity = element => {
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
          update: ({
            value
          }) => {
            const valueWithUnit = "".concat(value).concat(unit);
            element.setAttribute("data-transition-translate-x", valueWithUnit);
            element.style.setProperty("--ui-transition-translate-x", valueWithUnit);
          },
          teardown: () => {
            restoreWillChange();
            element.removeAttribute("data-transition-translate-x");
            element.style.removeProperty("--ui-transition-translate-x");
          },
          restore: () => {
            element.removeAttribute("data-transition-translate-x");
            element.style.removeProperty("--ui-transition-translate-x");
          }
        };
      }
    }
  });
  return translateXTransition;
};
const getTranslateX = element => {
  const transform = getComputedStyle(element).transform;
  const transformMap = parseTransform(transform);
  return transformMap.get("translateX")?.value || 0;
};


const getOpacityWithoutTransition = element => {
  const transitionOpacity = element.getAttribute("data-transition-opacity");


  element.removeAttribute("data-transition-opacity");
  const naturalValue = parseFloat(getComputedStyle(element).opacity) || 0;


  if (transitionOpacity !== null) {
    element.setAttribute("data-transition-opacity", transitionOpacity);
  }
  return naturalValue;
};
const getTranslateXWithoutTransition = element => {
  const transitionTranslateX = element.getAttribute("data-transition-translate-x");


  element.removeAttribute("data-transition-translate-x");
  const transform = getComputedStyle(element).transform;
  const transformMap = parseTransform(transform);
  const naturalValue = transformMap.get("translateX")?.value || 0;


  if (transitionTranslateX !== null) {
    element.setAttribute("data-transition-translate-x", transitionTranslateX);
  }
  return naturalValue;
};


const createGroupTransition = transitionArray => {
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
      setup: transition => {
        finishedCount = 0;
        const cleanupCallbackSet = new Set();
        for (const childTransition of transitionArray) {
          const removeFinishListener = childTransition.channels.finish.add(

          () => {
            finishedCount++;
            const allFinished = finishedCount === childCount;
            if (allFinished) {
              transition.finish();
            }
          });
          cleanupCallbackSet.add(removeFinishListener);
          childTransition.play();
          const removeUpdateListener = childTransition.channels.update.add(() => {

            let totalProgress = 0;
            let progressCount = 0;
            for (const t of transitionArray) {
              if (typeof t.progress === "number") {
                totalProgress += t.progress;
                progressCount++;
              }
            }
            const averageProgress = progressCount > 0 ? totalProgress / progressCount : 0;

            transition.progress = averageProgress;

            const isLast = averageProgress >= 1;
            transition.update(averageProgress, isLast);
          });
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
          restore: () => {}
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
          if (childTransition.playState === "running" || childTransition.playState === "paused") {
            childTransition.reverse();
          }
        }
      }
    }
  });
  return groupTransition;
};





const createGroupTransitionController = () => {

  const activeTransitions = new Set();
  return {









    animate: (transitions, options = {}) => {
      const {
        onChange,
        onFinish
      } = options;
      if (transitions.length === 0) {

        if (onFinish) {
          onFinish([]);
        }
        return {
          play: () => {},
          pause: () => {},
          cancel: () => {},
          finish: () => {},
          playState: "idle",
          channels: {
            update: {
              add: () => {}
            },
            finish: {
              add: () => {}
            }
          }
        };
      }
      const newTransitions = [];
      const updatedTransitions = [];


      for (const transition of transitions) {

        let existingTransition = null;
        for (const transitionCandidate of activeTransitions) {
          if (transitionCandidate.constructor === transition.constructor && transitionCandidate.key === transition.key) {
            existingTransition = transitionCandidate;
            break;
          }
        }
        if (existingTransition && existingTransition.playState === "running") {

          if (existingTransition.updateTarget) {
            existingTransition.updateTarget(transition.to);
          }
          updatedTransitions.push(existingTransition);
        } else {

          activeTransitions.add(transition);

          transition.channels.finish.add(() => {
            activeTransitions.delete(transition);
          });
          newTransitions.push(transition);
        }
      }


      if (newTransitions.length === 0) {
        return {
          play: () => {},

          pause: () => updatedTransitions.forEach(transition => transition.pause()),
          cancel: () => updatedTransitions.forEach(transition => transition.cancel()),
          finish: () => updatedTransitions.forEach(transition => transition.finish()),
          reverse: () => updatedTransitions.forEach(transition => transition.reverse()),
          playState: "running",

          channels: {
            update: {
              add: () => {}
            },

            finish: {
              add: () => {}
            }
          }
        };
      }


      const groupTransition = createGroupTransition(newTransitions);


      if (onChange) {
        groupTransition.channels.update.add(transition => {

          const changeEntries = [...newTransitions, ...updatedTransitions].map(transition => ({
            transition,
            value: transition.value
          }));
          const isLast = transition.value >= 1;
          onChange(changeEntries, isLast);
        });
      }


      if (onFinish) {
        groupTransition.channels.finish.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(transition => ({
            transition,
            value: transition.value
          }));
          onFinish(changeEntries);
        });
      }
      return groupTransition;
    },



    cancel: () => {

      for (const transition of activeTransitions) {
        if (transition.playState === "running" || transition.playState === "paused") {
          transition.cancel();
        }
      }

      activeTransitions.clear();
    }
  };
};

const getPaddingSizes = element => {
  const {
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom
  } = window.getComputedStyle(element, null);
  return {
    left: parseFloat(paddingLeft),
    right: parseFloat(paddingRight),
    top: parseFloat(paddingTop),
    bottom: parseFloat(paddingBottom)
  };
};

const getInnerHeight = element => {

  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const height = getHeight(element);
  const verticalSpaceTakenByPaddings = paddingSizes.top + paddingSizes.bottom;
  const verticalSpaceTakenByBorders = borderSizes.top + borderSizes.bottom;
  const innerHeight = height - verticalSpaceTakenByPaddings - verticalSpaceTakenByBorders;
  return innerHeight;
};

const getMarginSizes = element => {
  const {
    marginLeft,
    marginRight,
    marginTop,
    marginBottom
  } = window.getComputedStyle(element, null);
  return {
    left: parseFloat(marginLeft),
    right: parseFloat(marginRight),
    top: parseFloat(marginTop),
    bottom: parseFloat(marginBottom)
  };
};

const getAvailableHeight = (element, parentHeight = getHeight(element.parentElement)) => {
  const parentElement = element.parentElement;
  const paddingSizes = getPaddingSizes(parentElement);
  const borderSizes = getBorderSizes(parentElement);
  let availableHeight = parentHeight;
  availableHeight -= paddingSizes.top + paddingSizes.bottom + borderSizes.top + borderSizes.bottom;
  if (availableHeight < 0) {
    availableHeight = 0;
  }
  return availableHeight;
};

const resolveCSSSize = (size, {
  availableSize,
  fontSize,
  autoIsRelativeToFont
} = {}) => {
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
      return parseFloat(size) * getComputedStyle(document.documentElement).fontSize;
    }
    if (size.endsWith("vw")) {
      return parseFloat(size) / 100 * window.innerWidth;
    }
    if (size.endsWith("vh")) {
      return parseFloat(size) / 100 * window.innerHeight;
    }
    return parseFloat(size);
  }
  return size;
};

const getMinHeight = (element, availableHeight) => {
  const computedStyle = window.getComputedStyle(element);
  const {
    minHeight,
    fontSize
  } = computedStyle;
  return resolveCSSSize(minHeight, {
    availableSize: availableHeight === undefined ? getAvailableHeight(element) : availableHeight,
    fontSize
  });
};






const HEIGHT_TRANSITION_DURATION = 300;
const ANIMATE_TOGGLE = true;
const ANIMATE_RESIZE_AFTER_MUTATION = true;
const ANIMATION_THRESHOLD_PX = 10;
const DEBUG$1 = false;
const initFlexDetailsSet = (container, {
  onSizeChange,
  onResizableDetailsChange,
  onMouseResizeEnd,
  onRequestedSizeChange,
  debug = DEBUG$1
} = {}) => {
  const flexDetailsSet = {
    cleanup: null
  };


  const transitionController = createGroupTransitionController();
  const cleanupCallbackSet = new Set();
  const cleanup = () => {

    transitionController.cancel();
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  flexDetailsSet.cleanup = cleanup;
  const spaceMap = new Map();
  const marginSizeMap = new Map();
  const requestedSpaceMap = new Map();
  const minSpaceMap = new Map();
  let allocatedSpaceMap = new Map();
  const canGrowSet = new Set();
  const canShrinkSet = new Set();
  let availableSpace;
  let remainingSpace;
  let lastChild;
  const openedDetailsArray = [];
  const spaceToSize = (space, element) => {
    const marginSize = marginSizeMap.get(element);
    return space - marginSize;
  };
  const sizeToSpace = (size, element) => {
    const marginSize = marginSizeMap.get(element);
    return size + marginSize;
  };
  const prepareSpaceDistribution = () => {
    spaceMap.clear();
    marginSizeMap.clear();
    requestedSpaceMap.clear();
    minSpaceMap.clear();
    allocatedSpaceMap.clear();
    canGrowSet.clear();
    canShrinkSet.clear();
    availableSpace = getInnerHeight(container);
    remainingSpace = availableSpace;
    openedDetailsArray.length = 0;
    lastChild = null;
    if (debug) {
      console.debug("\uD83D\uDCD0 Container space: ".concat(availableSpace, "px"));
    }
    for (const child of container.children) {
      lastChild = child;
      const marginSizes = getMarginSizes(child);
      const marginSize = marginSizes.top + marginSizes.bottom;
      marginSizeMap.set(child, marginSize);
      if (!isDetailsElement(child)) {
        const size = getHeight(child);
        spaceMap.set(child, size + marginSize);
        requestedSpaceMap.set(child, size + marginSize);
        minSpaceMap.set(child, size + marginSize);
        continue;
      }
      const details = child;
      let size;
      let requestedSize;
      let requestedSizeSource;
      let minSize;
      const summary = details.querySelector("summary");
      const summaryHeight = getHeight(summary);
      size = getHeight(details);
      if (details.open) {
        openedDetailsArray.push(details);
        canGrowSet.add(details);
        canShrinkSet.add(details);
        const detailsContent = summary.nextElementSibling;
        let detailsHeight;
        if (detailsContent) {
          const preserveScroll = captureScrollState(detailsContent);
          const restoreSizeStyle = forceStyles(detailsContent, {
            height: "auto"
          });
          const detailsContentHeight = getHeight(detailsContent);
          restoreSizeStyle();

          preserveScroll();
          detailsHeight = summaryHeight + detailsContentHeight;
        } else {




          detailsHeight = size;
        }
        if (details.hasAttribute("data-requested-height")) {
          const requestedHeightAttribute = details.getAttribute("data-requested-height");
          requestedSize = resolveCSSSize(requestedHeightAttribute);
          if (isNaN(requestedSize) || !isFinite(requestedSize)) {
            console.warn("details ".concat(details.id, " has invalid data-requested-height attribute: ").concat(requestedHeightAttribute));
          }
          requestedSizeSource = "data-requested-height attribute";
        } else {
          requestedSize = detailsHeight;
          requestedSizeSource = "summary and content height";
        }
        const dataMinHeight = details.getAttribute("data-min-height");
        if (dataMinHeight) {
          minSize = parseFloat(dataMinHeight, 10);
        } else {
          minSize = getMinHeight(details, availableSpace);
        }
      } else {
        requestedSize = summaryHeight;
        requestedSizeSource = "summary height";
        minSize = summaryHeight;
      }
      spaceMap.set(details, size + marginSize);
      requestedSpaceMap.set(details, requestedSize + marginSize);
      minSpaceMap.set(details, minSize + marginSize);
      if (debug) {
        const currentSizeFormatted = spaceToSize(size + marginSize, details);
        const requestedSizeFormatted = spaceToSize(requestedSize + marginSize, details);
        const minSizeFormatted = spaceToSize(minSize + marginSize, details);
        console.debug("  ".concat(details.id, ": ").concat(currentSizeFormatted, "px \u2192 wants ").concat(requestedSizeFormatted, "px (min: ").concat(minSizeFormatted, "px) [").concat(requestedSizeSource, "]"));
      }
    }
  };
  const applyAllocatedSpaces = resizeDetails => {
    const changeSet = new Set();
    let maxChange = 0;
    for (const child of container.children) {
      const allocatedSpace = allocatedSpaceMap.get(child);
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const space = spaceMap.get(child);
      const size = spaceToSize(space, child);
      const sizeChange = Math.abs(size - allocatedSize);
      if (size === allocatedSize) {
        continue;
      }


      maxChange = Math.max(maxChange, sizeChange);
      if (isDetailsElement(child) && child.open) {
        const syncDetailsContentHeight = prepareSyncDetailsContentHeight(child);
        changeSet.add({
          element: child,
          target: allocatedSize,
          sideEffect: (height, {
            isAnimationEnd
          } = {}) => {
            syncDetailsContentHeight(height, {
              isAnimation: true,
              isAnimationEnd
            });
          }
        });
      } else {
        changeSet.add({
          element: child,
          target: allocatedSize
        });
      }
    }
    if (changeSet.size === 0) {
      return;
    }


    const shouldAnimate = resizeDetails.animated && maxChange >= ANIMATION_THRESHOLD_PX;
    if (debug && resizeDetails.animated && !shouldAnimate) {
      console.debug("\uD83D\uDEAB Skipping animation: max change ".concat(maxChange.toFixed(2), "px < ").concat(ANIMATION_THRESHOLD_PX, "px threshold"));
    }
    if (!shouldAnimate) {
      const sizeChangeEntries = [];
      for (const {
        element,
        target,
        sideEffect
      } of changeSet) {
        element.style.height = "".concat(target, "px");
        spaceMap.set(element, sizeToSpace(target, element));
        if (sideEffect) {
          sideEffect(target);
        }
        sizeChangeEntries.push({
          element,
          value: target
        });
      }
      onSizeChange?.(sizeChangeEntries, resizeDetails);
      return;
    }


    const transitions = Array.from(changeSet).map(({
      element,
      target
    }) => {
      const transition = createHeightTransition(element, target, {
        duration: HEIGHT_TRANSITION_DURATION
      });
      return transition;
    });
    const transition = transitionController.animate(transitions, {
      onChange: (changeEntries, isLast) => {

        for (const {
          transition,
          value
        } of changeEntries) {
          for (const change of changeSet) {
            if (change.element === transition.key) {
              if (change.sideEffect) {
                change.sideEffect(value, {
                  isAnimationEnd: isLast
                });
              }
              break;
            }
          }
        }
        if (onSizeChange) {

          const sizeChangeEntries = changeEntries.map(({
            transition,
            value
          }) => ({
            element: transition.key,

            value
          }));
          onSizeChange(sizeChangeEntries, isLast ? {
            ...resizeDetails,
            animated: false
          } : resizeDetails);
        }
      }
    });
    transition.play();
  };
  const allocateSpace = (child, spaceToAllocate, requestSource) => {
    const requestedSpace = requestedSpaceMap.get(child);
    const canShrink = canShrinkSet.has(child);
    const canGrow = canGrowSet.has(child);
    let allocatedSpace;
    let allocatedSpaceSource;
    allocate: {
      const minSpace = minSpaceMap.get(child);
      if (spaceToAllocate > remainingSpace) {
        if (remainingSpace < minSpace) {
          allocatedSpace = minSpace;
          allocatedSpaceSource = "min space";
          break allocate;
        }
        allocatedSpace = remainingSpace;
        allocatedSpaceSource = "remaining space";
        break allocate;
      }
      if (spaceToAllocate < minSpace) {
        allocatedSpace = minSpace;
        allocatedSpaceSource = "min space";
        break allocate;
      }
      allocatedSpace = spaceToAllocate;
      allocatedSpaceSource = requestSource;
      break allocate;
    }
    if (allocatedSpace < requestedSpace) {
      if (!canShrink) {
        allocatedSpace = requestedSpace;
        allocatedSpaceSource = "".concat(requestSource, " + cannot shrink");
      }
    } else if (allocatedSpace > requestedSpace) {
      if (!canGrow) {
        allocatedSpace = requestedSpace;
        allocatedSpaceSource = "".concat(requestSource, " + cannot grow");
      }
    }
    remainingSpace -= allocatedSpace;
    if (debug) {
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const sourceInfo = allocatedSpaceSource === requestSource ? "" : " (".concat(allocatedSpaceSource, ")");
      if (allocatedSpace === spaceToAllocate) {
        console.debug("  \u2192 ".concat(allocatedSize, "px to \"").concat(child.id, "\"").concat(sourceInfo, " | ").concat(remainingSpace, "px remaining"));
      } else {
        const requestedSize = spaceToSize(spaceToAllocate, child);
        console.debug("  \u2192 ".concat(allocatedSize, "px -out of ").concat(requestedSize, "px wanted- to \"").concat(child.id, "\"").concat(sourceInfo, " | ").concat(remainingSpace, "px remaining"));
      }
    }
    allocatedSpaceMap.set(child, allocatedSpace);
    const space = spaceMap.get(child);
    return allocatedSpace - space;
  };
  const applyDiffOnAllocatedSpace = (child, diff, source) => {
    if (diff === 0) {
      return 0;
    }
    const allocatedSpace = allocatedSpaceMap.get(child);
    remainingSpace += allocatedSpace;
    const spaceToAllocate = allocatedSpace + diff;
    if (debug) {
      console.debug("\uD83D\uDD04 ".concat(child.id, ": ").concat(allocatedSpace, "px + ").concat(diff, "px = ").concat(spaceToAllocate, "px (").concat(source, ")"));
    }
    allocateSpace(child, spaceToAllocate, source);
    const reallocatedSpace = allocatedSpaceMap.get(child);
    return reallocatedSpace - allocatedSpace;
  };
  const distributeAvailableSpace = source => {
    if (debug) {
      console.debug("\uD83D\uDCE6 Distributing ".concat(availableSpace, "px among ").concat(container.children.length, " children:"));
    }
    for (const child of container.children) {
      allocateSpace(child, requestedSpaceMap.get(child), source);
    }
    if (debug) {
      console.debug("\uD83D\uDCE6 After distribution: ".concat(remainingSpace, "px remaining"));
    }
  };
  const distributeRemainingSpace = ({
    childToGrow,
    childToShrinkFrom
  }) => {
    if (!remainingSpace) {
      return;
    }
    if (remainingSpace < 0) {
      const spaceToSteal = -remainingSpace;
      if (debug) {
        console.debug("\u26A0\uFE0F  Deficit: ".concat(remainingSpace, "px, stealing ").concat(spaceToSteal, "px from elements before ").concat(childToShrinkFrom.id));
      }
      updatePreviousSiblingsAllocatedSpace(childToShrinkFrom, -spaceToSteal, "remaining space is negative: ".concat(remainingSpace, "px"));
      return;
    }
    if (childToGrow) {
      if (debug) {
        console.debug("\u2728 Bonus: giving ".concat(remainingSpace, "px to ").concat(childToGrow.id));
      }
      applyDiffOnAllocatedSpace(childToGrow, remainingSpace, "remaining space is positive: ".concat(remainingSpace, "px"));
    }
  };
  const updatePreviousSiblingsAllocatedSpace = (child, diffToApply, source, mapRemainingDiffToApply) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diffToApply;
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      const spaceDiff = applyDiffOnAllocatedSpace(previousSibling, remainingDiffToApply, source);
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (!remainingDiffToApply) {
          break;
        }
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return spaceDiffSum;
  };
  const updateNextSiblingsAllocatedSpace = (child, diffToApply, reason, mapRemainingDiffToApply) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diffToApply;
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (mapRemainingDiffToApply) {
        remainingDiffToApply = mapRemainingDiffToApply(nextSibling, remainingDiffToApply);
      }
      const spaceDiff = applyDiffOnAllocatedSpace(nextSibling, remainingDiffToApply, reason);
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (!remainingDiffToApply) {
          break;
        }
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    return spaceDiffSum;
  };
  const updateSiblingAllocatedSpace = (child, diff, reason) => {
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (!isDetailsElement(nextSibling)) {
        nextSibling = nextSibling.nextElementSibling;
        continue;
      }
      const spaceDiff = applyDiffOnAllocatedSpace(nextSibling, diff, reason);
      if (spaceDiff) {
        return spaceDiff;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    if (debug) {
      console.debug("coult not update next sibling allocated space, try on previous siblings");
    }
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      if (!isDetailsElement(previousSibling)) {
        previousSibling = previousSibling.previousElementSibling;
        continue;
      }
      const spaceDiff = applyDiffOnAllocatedSpace(previousSibling, diff, reason);
      if (spaceDiff) {
        return spaceDiff;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return 0;
  };
  const saveCurrentSizeAsRequestedSizes = ({
    replaceExistingAttributes
  } = {}) => {
    for (const child of container.children) {
      if (canGrowSet.has(child) || canShrinkSet.has(child)) {
        if (child.hasAttribute("data-requested-height") && !replaceExistingAttributes) {
          continue;
        }
        const allocatedSpace = allocatedSpaceMap.get(child);
        child.setAttribute("data-requested-height", allocatedSpace);
      }
    }
  };
  const updateSpaceDistribution = resizeDetails => {
    if (debug) {
      console.group("updateSpaceDistribution: ".concat(resizeDetails.reason));
    }
    prepareSpaceDistribution();
    distributeAvailableSpace(resizeDetails.reason);
    distributeRemainingSpace({
      childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
      childToShrinkFrom: lastChild
    });
    if (resizeDetails.reason === "initial_space_distribution" || resizeDetails.reason === "content_change") {
      spaceMap.clear();
    }
    applyAllocatedSpaces(resizeDetails);
    saveCurrentSizeAsRequestedSizes();
    if (debug) {
      console.groupEnd();
    }
  };
  const resizableDetailsIdSet = new Set();
  const updateResizableDetails = () => {
    const currentResizableDetailsIdSet = new Set();
    let hasPreviousOpen = false;
    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      if (!child.open) {
        continue;
      }
      if (hasPreviousOpen) {
        currentResizableDetailsIdSet.add(child.id);
      }
      if (!hasPreviousOpen && child.open) {
        hasPreviousOpen = true;
      }
    }
    let someNew;
    let someOld;
    for (const currentId of currentResizableDetailsIdSet) {
      if (!resizableDetailsIdSet.has(currentId)) {
        resizableDetailsIdSet.add(currentId);
        someNew = true;
      }
    }
    for (const id of resizableDetailsIdSet) {
      if (!currentResizableDetailsIdSet.has(id)) {
        resizableDetailsIdSet.delete(id);
        someOld = true;
      }
    }
    if (someNew || someOld) {
      onResizableDetailsChange?.(resizableDetailsIdSet);
    }
  };
  {
    updateSpaceDistribution({
      reason: "initial_space_distribution"
    });
    updateResizableDetails();
  }
  {
    const distributeSpaceAfterToggle = details => {
      const reason = details.open ? "".concat(details.id, " just opened") : "".concat(details.id, " just closed");
      if (debug) {
        console.group("distributeSpaceAfterToggle: ".concat(reason));
      }
      prepareSpaceDistribution();
      distributeAvailableSpace(reason);
      const requestedSpace = requestedSpaceMap.get(details);
      const allocatedSpace = allocatedSpaceMap.get(details);
      const spaceToSteal = requestedSpace - allocatedSpace - remainingSpace;
      if (spaceToSteal === 0) {
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
          childToShrinkFrom: lastChild
        });
        return;
      }
      if (debug) {
        console.debug("".concat(details.id, " would like to take ").concat(requestedSpace, "px (").concat(reason, "). Trying to steal ").concat(spaceToSteal, "px from sibling, remaining space: ").concat(remainingSpace, "px"));
      }
      const spaceStolenFromSibling = -updateSiblingAllocatedSpace(details, -spaceToSteal, reason);
      if (spaceStolenFromSibling) {
        if (debug) {
          console.debug("".concat(spaceStolenFromSibling, "px space stolen from sibling"));
        }
        applyDiffOnAllocatedSpace(details, requestedSpace, reason);
      } else {
        if (debug) {
          console.debug("no space could be stolen from sibling, remaining space: ".concat(remainingSpace, "px"));
        }
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[0],
          childToShrinkFrom: lastChild
        });
      }
      if (debug) {
        console.groupEnd();
      }
    };
    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      const details = child;
      const ontoggle = () => {
        distributeSpaceAfterToggle(details);
        applyAllocatedSpaces({
          reason: details.open ? "details_opened" : "details_closed",
          animated: ANIMATE_TOGGLE
        });
        updateResizableDetails();
      };
      if (details.open) {
        setTimeout(() => {
          details.addEventListener("toggle", ontoggle);
        });
      } else {
        details.addEventListener("toggle", ontoggle);
      }
      cleanupCallbackSet.add(() => {
        details.removeEventListener("toggle", ontoggle);
      });
    }
  }
  {
    const prepareResize = () => {
      let resizedElement;

      let startAllocatedSpaceMap;
      let currentAllocatedSpaceMap;
      const start = element => {
        updateSpaceDistribution({
          reason: "mouse_resize_start"
        });
        resizedElement = element;

        startAllocatedSpaceMap = new Map(allocatedSpaceMap);
      };
      const applyMoveDiffToSizes = (moveDiff, reason) => {
        let spaceDiff = 0;
        let remainingMoveToApply;
        if (moveDiff > 0) {
          remainingMoveToApply = moveDiff;
          {



            const spaceGivenToNextSiblings = updateNextSiblingsAllocatedSpace(resizedElement, remainingMoveToApply, reason, nextSibling => {
              const requestedSpace = requestedSpaceMap.get(nextSibling);
              const space = spaceMap.get(nextSibling);
              return requestedSpace - space;
            });
            if (spaceGivenToNextSiblings) {
              spaceDiff -= spaceGivenToNextSiblings;
              remainingMoveToApply -= spaceGivenToNextSiblings;
              if (debug) {
                console.debug("".concat(spaceGivenToNextSiblings, "px given to previous siblings"));
              }
            }
          }
          {
            const spaceStolenFromPreviousSiblings = -updatePreviousSiblingsAllocatedSpace(resizedElement, -remainingMoveToApply, reason);
            if (spaceStolenFromPreviousSiblings) {
              spaceDiff += spaceStolenFromPreviousSiblings;
              remainingMoveToApply -= spaceStolenFromPreviousSiblings;
              if (debug) {
                console.debug("".concat(spaceStolenFromPreviousSiblings, "px stolen from previous siblings"));
              }
            }
          }
          {
            applyDiffOnAllocatedSpace(resizedElement, spaceDiff, reason);
          }
        }
        remainingMoveToApply = -moveDiff;
        {
          const selfShrink = -applyDiffOnAllocatedSpace(resizedElement, -remainingMoveToApply, reason);
          remainingMoveToApply -= selfShrink;
          spaceDiff += selfShrink;
        }
        {
          const nextSiblingsShrink = -updateNextSiblingsAllocatedSpace(resizedElement, -remainingMoveToApply, reason);
          if (nextSiblingsShrink) {
            remainingMoveToApply -= nextSiblingsShrink;
            spaceDiff += nextSiblingsShrink;
          }
        }
        {
          updatePreviousSiblingsAllocatedSpace(resizedElement, spaceDiff, reason);
        }
      };
      const move = (yMove, gesture) => {






        const reason = "applying ".concat(yMove, "px move on ").concat(resizedElement.id);
        if (debug) {
          console.group(reason);
        }
        const moveDiff = -yMove;
        applyMoveDiffToSizes(moveDiff, reason);
        applyAllocatedSpaces({
          reason: gesture.isMouseUp ? "mouse_resize_end" : "mouse_resize"
        });
        currentAllocatedSpaceMap = new Map(allocatedSpaceMap);
        allocatedSpaceMap = new Map(startAllocatedSpaceMap);
        if (debug) {
          console.groupEnd();
        }
      };
      const end = () => {
        if (currentAllocatedSpaceMap) {
          allocatedSpaceMap = currentAllocatedSpaceMap;
          saveCurrentSizeAsRequestedSizes({
            replaceExistingAttributes: true
          });
          if (onRequestedSizeChange) {
            for (const [child, allocatedSpace] of allocatedSpaceMap) {
              const size = spaceToSize(allocatedSpace, child);
              onRequestedSizeChange(child, size);
            }
          }
          onMouseResizeEnd?.();
        }
      };
      return {
        start,
        move,
        end
      };
    };
    const onmousedown = event => {
      const {
        start,
        move,
        end
      } = prepareResize();
      startDragToResizeGesture(event, {
        onDragStart: gesture => {
          start(gesture.element);
        },
        onDrag: gesture => {
          const yMove = gesture.yMove;
          move(yMove, gesture);
        },
        onRelease: () => {
          end();
        },
        constrainedFeedbackLine: false
      });
    };
    container.addEventListener("mousedown", onmousedown);
    cleanupCallbackSet.add(() => {
      container.removeEventListener("mousedown", onmousedown);
    });
  }
  {















    const resizeObserver = new ResizeObserver(() => {
      updateSpaceDistribution({
        reason: "container_resize"
      });
    });
    resizeObserver.observe(container);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
    });
  }
  {




    const mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          updateSpaceDistribution({
            reason: "content_change",
            animated: ANIMATE_RESIZE_AFTER_MUTATION
          });
          return;
        }
        if (mutation.type === "characterData") {
          updateSpaceDistribution({
            reason: "content_change",
            animated: ANIMATE_RESIZE_AFTER_MUTATION
          });
          return;
        }
      }
    });
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }
  return flexDetailsSet;
};
const prepareSyncDetailsContentHeight = details => {
  const getHeightCssValue = height => {
    return "".concat(height, "px");
  };
  const summary = details.querySelector("summary");
  const summaryHeight = getHeight(summary);
  details.style.setProperty("--summary-height", getHeightCssValue(summaryHeight));
  const content = summary.nextElementSibling;
  if (!content) {
    return detailsHeight => {
      details.style.setProperty("--details-height", getHeightCssValue(detailsHeight));
      details.style.setProperty("--content-height", getHeightCssValue(detailsHeight - summaryHeight));
    };
  }


  const preserveScroll = captureScrollState(content);
  content.style.height = "var(--content-height)";
  const contentComputedStyle = getComputedStyle(content);
  const scrollbarMightTakeHorizontalSpace = contentComputedStyle.overflowY === "auto" && contentComputedStyle.scrollbarGutter !== "stable";
  return (detailsHeight, {
    isAnimation,
    isAnimationEnd
  } = {}) => {
    const contentHeight = detailsHeight - summaryHeight;
    details.style.setProperty("--details-height", getHeightCssValue(detailsHeight));
    details.style.setProperty("--content-height", getHeightCssValue(contentHeight));
    if (!isAnimation || isAnimationEnd) {
      if (scrollbarMightTakeHorizontalSpace) {










        const restoreOverflow = forceStyles(content, {
          "overflow-y": "hidden"
        });

        content.offsetHeight;
        restoreOverflow();
      }
    }



    preserveScroll();
  };
};
const isDetailsElement = element => {
  return element && element.tagName === "DETAILS";
};

const getAvailableWidth = (element, parentWidth = getWidth(element.parentElement)) => {
  const parentElement = element.parentElement;
  const paddingSizes = getPaddingSizes(parentElement);
  const borderSizes = getBorderSizes(parentElement);
  let availableWidth = parentWidth;
  availableWidth -= paddingSizes.left + paddingSizes.right + borderSizes.left + borderSizes.right;
  if (availableWidth < 0) {
    availableWidth = 0;
  }
  return availableWidth;
};

const getInnerWidth = element => {

  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const width = getWidth(element);
  const horizontalSpaceTakenByPaddings = paddingSizes.left + paddingSizes.right;
  const horizontalSpaceTakenByBorders = borderSizes.left + borderSizes.right;
  const innerWidth = width - horizontalSpaceTakenByPaddings - horizontalSpaceTakenByBorders;
  return innerWidth;
};

const getMaxHeight = (element, availableHeight = getAvailableHeight(element)) => {
  let maxHeight = availableHeight;
  const marginSizes = getMarginSizes(element);
  maxHeight -= marginSizes.top;
  maxHeight -= marginSizes.bottom;
  const parentElement = element.parentElement;
  const parentElementComputedStyle = window.getComputedStyle(parentElement);
  if (parentElementComputedStyle.display === "flex" && parentElementComputedStyle.flexDirection === "column") {
    let previousSibling = element.previousElementSibling;
    while (previousSibling) {
      if (canTakeSpace(previousSibling)) {
        const previousSiblingHeight = getHeight(previousSibling);
        maxHeight -= previousSiblingHeight;
        const previousSiblingMarginSizes = getMarginSizes(previousSibling);
        maxHeight -= previousSiblingMarginSizes.top;
        maxHeight -= previousSiblingMarginSizes.bottom;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      if (canTakeSpace(nextSibling)) {
        const nextSiblingMinHeight = getMinHeight(nextSibling, availableHeight);
        maxHeight -= nextSiblingMinHeight;
        const nextSiblingMarginSizes = getMarginSizes(nextSibling);
        maxHeight -= nextSiblingMarginSizes.top;
        maxHeight -= nextSiblingMarginSizes.bottom;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxHeight;
};
const canTakeSpace = element => {
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.display === "none") {
    return false;
  }
  if (computedStyle.position === "absolute") {
    return false;
  }
  return true;
};

const canTakeSize = element => {
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.display === "none") {
    return false;
  }
  if (computedStyle.position === "absolute") {
    return false;
  }
  return true;
};

const getMinWidth = (element, availableWidth) => {
  const computedStyle = window.getComputedStyle(element);
  const {
    minWidth,
    fontSize
  } = computedStyle;
  return resolveCSSSize(minWidth, {
    availableSize: availableWidth === undefined ? getAvailableWidth(element) : availableWidth,
    fontSize
  });
};

const getMaxWidth = (element, availableWidth = getAvailableWidth(element)) => {
  let maxWidth = availableWidth;
  const marginSizes = getMarginSizes(element);
  maxWidth -= marginSizes.left;
  maxWidth -= marginSizes.right;
  const parentElement = element.parentElement;
  const parentElementComputedStyle = window.getComputedStyle(parentElement);
  if (parentElementComputedStyle.display === "flex" && parentElementComputedStyle.flexDirection === "row") {
    let previousSibling = element.previousElementSibling;
    while (previousSibling) {
      if (canTakeSize(previousSibling)) {
        const previousSiblingWidth = getWidth(previousSibling);
        maxWidth -= previousSiblingWidth;
        const previousSiblingMarginSizes = getMarginSizes(previousSibling);
        maxWidth -= previousSiblingMarginSizes.left;
        maxWidth -= previousSiblingMarginSizes.right;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      if (canTakeSize(nextSibling)) {
        const nextSiblingMinWidth = getMinWidth(nextSibling, availableWidth);
        maxWidth -= nextSiblingMinWidth;
        const nextSiblingMarginSizes = getMarginSizes(nextSibling);
        maxWidth -= nextSiblingMarginSizes.left;
        maxWidth -= nextSiblingMarginSizes.right;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxWidth;
};

const useAvailableHeight = elementRef => {
  const [availableHeight, availableHeightSetter] = d$1(-1);
  _(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    let raf;
    const resizeObserver = new ResizeObserver(entries => {
      const [entry] = entries;
      const parentHeight = entry.contentRect.height;
      const availableH = getAvailableHeight(element, parentHeight);
      raf = requestAnimationFrame(() => {
        availableHeightSetter(availableH);
      });
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return availableHeight;
};

const useAvailableWidth = elementRef => {
  const [availableWidth, availableWidthSetter] = d$1(-1);
  _(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    let raf;
    const resizeObserver = new ResizeObserver(entries => {
      const [entry] = entries;
      const parentWidth = entry.contentRect.width;
      const availableW = getAvailableWidth(element, parentWidth);
      raf = requestAnimationFrame(() => {
        availableWidthSetter(availableW);
      });
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return availableWidth;
};

const useMaxHeight = (elementRef, availableHeight) => {
  const element = elementRef.current;
  if (!element) {
    return -1;
  }
  const maxWidth = getMaxHeight(element, availableHeight);
  return maxWidth;
};

const useMaxWidth = (elementRef, availableWidth) => {
  const element = elementRef.current;
  if (!element) {
    return -1;
  }
  const maxWidth = getMaxWidth(element, availableWidth);
  return maxWidth;
};

const useResizeStatus = (elementRef, {
  as = "number"
} = {}) => {
  const [resizing, setIsResizing] = d$1(false);
  const [resizeWidth, setResizeWidth] = d$1(null);
  const [resizeHeight, setResizeHeight] = d$1(null);
  _(() => {
    const element = elementRef.current;
    const onresizestart = e => {
      const sizeInfo = e.detail;
      setResizeWidth(as === "number" ? sizeInfo.width : sizeInfo.widthAsPercentage);
      setResizeHeight(as === "number" ? sizeInfo.height : sizeInfo.heightAsPercentage);
      setIsResizing(true);
    };
    const onresize = e => {
      const sizeInfo = e.detail;
      setResizeWidth(as === "number" ? sizeInfo.width : sizeInfo.widthAsPercentage);
      setResizeHeight(as === "number" ? sizeInfo.height : sizeInfo.heightAsPercentage);
    };
    const onresizeend = () => {
      setIsResizing(false);
    };
    element.addEventListener("resizestart", onresizestart);
    element.addEventListener("resize", onresize);
    element.addEventListener("resizeend", onresizeend);
    return () => {
      element.removeEventListener("resizestart", onresizestart);
      element.removeEventListener("resize", onresize);
      element.removeEventListener("resizeend", onresizeend);
    };
  }, [as]);
  return {
    resizing,
    resizeWidth,
    resizeHeight
  };
};

installImportMetaCss(import.meta);import.meta.css =          "\n  .ui_transition_container {\n    display: inline-flex;\n    flex: 1;\n    position: relative;\n    overflow: hidden;\n  }\n\n  .ui_transition_outer_wrapper {\n    display: inline-flex;\n    flex: 1;\n  }\n\n  .ui_transition_measure_wrapper {\n    overflow: hidden;\n    display: inline-flex;\n    flex: 1;\n  }\n\n  .ui_transition_slot {\n    position: relative;\n    display: inline-flex;\n    flex: 1;\n  }\n\n  .ui_transition_phase_overlay {\n    position: absolute;\n    inset: 0;\n    pointer-events: none;\n  }\n\n  .ui_transition_content_overlay {\n    position: absolute;\n    inset: 0;\n    pointer-events: none;\n  }\n";
const DEBUG = {
  size: false,
  transition: false,
  transition_updates: false
};


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
  return "[data-content-key=\"".concat(contentKey, "\"]");
};
const SIZE_TRANSITION_DURATION = 150;
const SIZE_DIFF_EPSILON = 0.5;
const CONTENT_TRANSITION = "cross-fade";
const CONTENT_TRANSITION_DURATION = 300;
const PHASE_TRANSITION = "cross-fade";
const PHASE_TRANSITION_DURATION = 300;

const initUITransition = container => {
  const localDebug = {
    ...DEBUG,
    transition: container.hasAttribute("data-debug-transition")
  };
  const debug = (type, ...args) => {
    if (localDebug[type]) {
      console.debug("[".concat(type, "]"), ...args);
    }
  };
  if (!container.classList.contains("ui_transition_container")) {
    console.error("Element must have ui_transition_container class");
    return {
      cleanup: () => {}
    };
  }
  const outerWrapper = container.querySelector(".ui_transition_outer_wrapper");
  const measureWrapper = container.querySelector(".ui_transition_measure_wrapper");
  const slot = container.querySelector(".ui_transition_slot");
  let phaseOverlay = measureWrapper.querySelector(".ui_transition_phase_overlay");
  let contentOverlay = container.querySelector(".ui_transition_content_overlay");
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
  if (!outerWrapper || !measureWrapper || !slot || !phaseOverlay || !contentOverlay) {
    console.error("Missing required ui-transition structure");
    return {
      cleanup: () => {}
    };
  }
  const transitionController = createGroupTransitionController();


  let activeContentTransition = null;
  let activeContentTransitionType = null;
  let activePhaseTransition = null;
  let activePhaseTransitionType = null;
  let isPaused = false;


  let naturalContentWidth = 0;
  let naturalContentHeight = 0;
  let constrainedWidth = 0;
  let constrainedHeight = 0;
  let sizeTransition = null;
  let resizeObserver = null;
  let sizeHoldActive = false;


  let suppressResizeObserver = false;
  let pendingResizeSync = false;


  let hasSizeTransitions = container.hasAttribute("data-size-transition");
  const initialTransitionEnabled = container.hasAttribute("data-initial-transition");
  let hasPopulatedOnce = false;


  let lastContentKey = null;
  let previousChild = null;
  let isContentPhase = false;
  let wasContentPhase = false;

  const measureContentSize = () => {
    return [getWidth(measureWrapper), getHeight(measureWrapper)];
  };
  const updateContentDimensions = () => {
    const [newWidth, newHeight] = measureContentSize();
    debug("size", "Content size changed:", {
      width: "".concat(naturalContentWidth, " \u2192 ").concat(newWidth),
      height: "".concat(naturalContentHeight, " \u2192 ").concat(newHeight)
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
  const releaseConstraints = reason => {
    debug("size", "Releasing constraints (".concat(reason, ")"));
    const [beforeWidth, beforeHeight] = measureContentSize();
    outerWrapper.style.width = "";
    outerWrapper.style.height = "";
    outerWrapper.style.overflow = "";
    const [afterWidth, afterHeight] = measureContentSize();
    debug("size", "Size after release:", {
      width: "".concat(beforeWidth, " \u2192 ").concat(afterWidth),
      height: "".concat(beforeHeight, " \u2192 ").concat(afterHeight)
    });
    constrainedWidth = afterWidth;
    constrainedHeight = afterHeight;
    naturalContentWidth = afterWidth;
    naturalContentHeight = afterHeight;

    if (!suppressResizeObserver && pendingResizeSync) {
      pendingResizeSync = false;
      updateContentDimensions();
    }
  };
  const updateToSize = (targetWidth, targetHeight) => {
    if (constrainedWidth === targetWidth && constrainedHeight === targetHeight) {
      return;
    }
    const shouldAnimate = container.hasAttribute("data-size-transition");
    const widthDiff = Math.abs(targetWidth - constrainedWidth);
    const heightDiff = Math.abs(targetHeight - constrainedHeight);
    if (widthDiff <= SIZE_DIFF_EPSILON && heightDiff <= SIZE_DIFF_EPSILON) {

      if (widthDiff > 0) {
        outerWrapper.style.width = "".concat(targetWidth, "px");
        constrainedWidth = targetWidth;
      }
      if (heightDiff > 0) {
        outerWrapper.style.height = "".concat(targetHeight, "px");
        constrainedHeight = targetHeight;
      }
      debug("size", "Skip size animation entirely (diffs width:".concat(widthDiff.toFixed(4), "px height:").concat(heightDiff.toFixed(4), "px)"));
      return;
    }
    if (!shouldAnimate) {

      debug("size", "Updating size instantly:", {
        width: "".concat(constrainedWidth, " \u2192 ").concat(targetWidth),
        height: "".concat(constrainedHeight, " \u2192 ").concat(targetHeight)
      });
      suppressResizeObserver = true;
      outerWrapper.style.width = "".concat(targetWidth, "px");
      outerWrapper.style.height = "".concat(targetHeight, "px");
      constrainedWidth = targetWidth;
      constrainedHeight = targetHeight;

      requestAnimationFrame(() => {
        suppressResizeObserver = false;
        if (pendingResizeSync) {
          pendingResizeSync = false;
          updateContentDimensions();
        }
      });
      return;
    }


    debug("size", "Animating size:", {
      width: "".concat(constrainedWidth, " \u2192 ").concat(targetWidth),
      height: "".concat(constrainedHeight, " \u2192 ").concat(targetHeight)
    });
    const duration = parseInt(container.getAttribute("data-size-transition-duration") || SIZE_TRANSITION_DURATION);
    outerWrapper.style.overflow = "hidden";
    const transitions = [];


    if (heightDiff <= SIZE_DIFF_EPSILON) {

      if (heightDiff > 0) {
        debug("size", "Skip height transition (negligible diff ".concat(heightDiff.toFixed(4), "px)"));
      }
      outerWrapper.style.height = "".concat(targetHeight, "px");
      constrainedHeight = targetHeight;
    } else if (targetHeight !== constrainedHeight) {
      transitions.push(createHeightTransition(outerWrapper, targetHeight, {
        duration,
        onUpdate: ({
          value
        }) => {
          constrainedHeight = value;
        }
      }));
    }
    if (widthDiff <= SIZE_DIFF_EPSILON) {
      if (widthDiff > 0) {
        debug("size", "Skip width transition (negligible diff ".concat(widthDiff.toFixed(4), "px)"));
      }
      outerWrapper.style.width = "".concat(targetWidth, "px");
      constrainedWidth = targetWidth;
    } else if (targetWidth !== constrainedWidth) {
      transitions.push(createWidthTransition(outerWrapper, targetWidth, {
        duration,
        onUpdate: ({
          value
        }) => {
          constrainedWidth = value;
        }
      }));
    }
    if (transitions.length > 0) {
      suppressResizeObserver = true;
      sizeTransition = transitionController.animate(transitions, {
        onFinish: () => {
          releaseConstraints("animated size transition completed");

          requestAnimationFrame(() => {
            suppressResizeObserver = false;
            if (pendingResizeSync) {
              pendingResizeSync = false;
              updateContentDimensions();
            }
          });
        }
      });
      sizeTransition.play();
    } else {
      debug("size", "No size transitions created (identical or negligible differences)");
    }
  };
  const applySizeConstraints = (targetWidth, targetHeight) => {
    debug("size", "Applying size constraints:", {
      width: "".concat(constrainedWidth, " \u2192 ").concat(targetWidth),
      height: "".concat(constrainedHeight, " \u2192 ").concat(targetHeight)
    });
    outerWrapper.style.width = "".concat(targetWidth, "px");
    outerWrapper.style.height = "".concat(targetHeight, "px");
    outerWrapper.style.overflow = "hidden";
    constrainedWidth = targetWidth;
    constrainedHeight = targetHeight;
  };
  const updateNaturalContentSize = (newWidth, newHeight) => {
    debug("size", "Updating natural content size:", {
      width: "".concat(naturalContentWidth, " \u2192 ").concat(newWidth),
      height: "".concat(naturalContentHeight, " \u2192 ").concat(newHeight)
    });
    naturalContentWidth = newWidth;
    naturalContentHeight = newHeight;
  };
  let isUpdating = false;


  const setupTransition = ({
    isPhaseTransition = false,
    overlay,
    existingOldContents,
    needsOldChildClone,
    previousChild,
    firstChild,
    attributeToRemove = []
  }) => {
    let oldChild = null;
    let cleanup = () => {};
    const currentTransitionElement = existingOldContents[0];
    if (currentTransitionElement) {
      oldChild = currentTransitionElement;
      debug("transition", "Continuing from current ".concat(isPhaseTransition ? "phase" : "content", " transition element"));
      cleanup = () => oldChild.remove();
    } else if (needsOldChildClone) {
      overlay.innerHTML = "";


      oldChild = previousChild.cloneNode(true);


      attributeToRemove.forEach(attr => oldChild.removeAttribute(attr));
      oldChild.setAttribute("data-ui-transition-old", "");
      overlay.appendChild(oldChild);
      debug("transition", "Cloned previous child for ".concat(isPhaseTransition ? "phase" : "content", " transition:"), previousChild.getAttribute("data-ui-name") || "unnamed");
      cleanup = () => oldChild.remove();
    } else {
      overlay.innerHTML = "";
      debug("transition", "No old child to clone for ".concat(isPhaseTransition ? "phase" : "content", " transition"));
    }




    let oldElement;
    let newElement;
    if (isPhaseTransition) {

      oldElement = oldChild;
      newElement = firstChild;
    } else {

      oldElement = oldChild ? overlay : null;
      newElement = firstChild ? measureWrapper : null;
    }
    return {
      oldChild,
      cleanup,
      oldElement,
      newElement
    };
  };


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
        const updateLabel = childUIName || (firstChild ? "data-ui-name not specified" : "cleared/empty");
        console.group("UI Update: ".concat(updateLabel, " (reason: ").concat(reason, ")"));
      }


      const hasTextNode = Array.from(slot.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (hasTextNode) {
        console.warn("UI Transition: Text nodes in transition slots are not supported. Please wrap text content in an element.", {
          slot,
          textContent: slot.textContent.trim()
        });
      }


      const hasMultipleElements = slot.children.length > 1;
      if (hasMultipleElements) {
        console.warn("UI Transition: Multiple elements in transition slots are not supported yet. Please use a single container element.", {
          slot,
          elementCount: slot.children.length
        });
      }


      let currentContentKey = null;
      let slotContentKey = slot.getAttribute("data-content-key");
      let childContentKey = firstChild?.getAttribute("data-content-key");
      if (childContentKey && slotContentKey) {
        console.warn("Both data-content-key found on child and ui_transition_slot. Using child value.", {
          childContentKey,
          slotContentKey
        });
      }
      currentContentKey = childContentKey || slotContentKey || null;


      const hadChild = previousChild !== null;
      const hasChild = firstChild !== null;


      const hadTextNode = previousChild && previousChild.nodeType === Node.TEXT_NODE;


      const previousContentKeyState = formatContentKeyState(lastContentKey, hadChild, hadTextNode);
      const currentContentKeyState = formatContentKeyState(currentContentKey, hasChild, hasTextNode);


      const prevKeyBeforeRegistration = lastContentKey;


      wasContentPhase = isContentPhase;
      isContentPhase = firstChild ? firstChild.hasAttribute("data-content-phase") : true;

      const previousIsContentPhase = !hadChild || wasContentPhase;
      const currentIsContentPhase = !hasChild || isContentPhase;


      const shouldGiveUpEarlyAndJustRegister = !hadChild && !hasChild && !hasTextNode || hasTextNode || hasMultipleElements;
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

      }


      const conceptualPrevDisplay = prevKeyBeforeRegistration === null ? "[unkeyed]" : "[data-content-key=\"".concat(prevKeyBeforeRegistration, "\"]");
      const conceptualCurrentDisplay = currentContentKey === null ? "[unkeyed]" : "[data-content-key=\"".concat(currentContentKey, "\"]");
      const previousDisplay = shouldGiveUpEarlyAndJustRegister ? conceptualPrevDisplay : previousContentKeyState;
      const currentDisplay = shouldGiveUpEarlyAndJustRegister ? conceptualCurrentDisplay : currentContentKeyState;


      let contentKeysSentence = "Content key: ".concat(previousDisplay, " \u2192 ").concat(currentDisplay);
      debug("transition", contentKeysSentence);
      if (shouldGiveUpEarlyAndJustRegister) {

        debug("transition", "Decision: EARLY_RETURN (".concat(earlyAction, ")"));

        lastContentKey = currentContentKey;
        if (localDebug.transition) {
          console.groupEnd();
        }
        return;
      }
      debug("size", "Update triggered, size: ".concat(constrainedWidth, "x").concat(constrainedHeight));
      if (sizeTransition) {
        sizeTransition.cancel();
      }
      const [newWidth, newHeight] = measureContentSize();
      debug("size", "Measured size: ".concat(newWidth, "x").concat(newHeight));
      outerWrapper.style.width = "".concat(constrainedWidth, "px");
      outerWrapper.style.height = "".concat(constrainedHeight, "px");


      stopResizeObserver();
      if (firstChild && !isContentPhase) {
        startResizeObserver();
        debug("size", "Observing child resize");
      }





















      let shouldDoContentTransition = false;
      if ((slot.getAttribute("data-content-key") || firstChild?.getAttribute("data-content-key")) && lastContentKey !== null) {
        shouldDoContentTransition = currentContentKey !== lastContentKey;
      }
      const becomesEmpty = hadChild && !hasChild;
      const becomesPopulated = !hadChild && hasChild;
      const isInitialPopulationWithoutTransition = becomesPopulated && !hasPopulatedOnce && !initialTransitionEnabled;



      const shouldDoPhaseTransition = !shouldDoContentTransition && (becomesPopulated || becomesEmpty || hadChild && hasChild && (previousIsContentPhase !== currentIsContentPhase || previousIsContentPhase && currentIsContentPhase));
      const contentChange = hadChild && hasChild && shouldDoContentTransition;
      const phaseChange = hadChild && hasChild && shouldDoPhaseTransition;


      const preserveOnlyContentTransition = activeContentTransition !== null && !shouldDoContentTransition && !shouldDoPhaseTransition && !becomesPopulated && !becomesEmpty;


      const shouldDoContentTransitionIncludingPopulation = shouldDoContentTransition || becomesPopulated && !shouldDoPhaseTransition;
      const decisions = [];
      if (shouldDoContentTransition) decisions.push("CONTENT TRANSITION");
      if (shouldDoPhaseTransition) decisions.push("PHASE TRANSITION");
      if (preserveOnlyContentTransition) decisions.push("PRESERVE CONTENT TRANSITION");
      if (decisions.length === 0) decisions.push("NO TRANSITION");
      debug("transition", "Decision: ".concat(decisions.join(" + ")));
      if (preserveOnlyContentTransition) {
        const progress = (activeContentTransition.progress * 100).toFixed(1);
        debug("transition", "Preserving existing content transition (progress ".concat(progress, "%)"));
      }




      if (decisions.length === 1 && decisions[0] === "NO TRANSITION" && activeContentTransition === null && activePhaseTransition === null) {
        debug("transition", "Early return: no transition or continuation required");

      }


      if (isInitialPopulationWithoutTransition) {
        debug("transition", "Initial population detected: skipping transitions (opt-in with data-initial-transition)");


        if (isContentPhase) {
          applySizeConstraints(newWidth, newHeight);
        } else {
          updateNaturalContentSize(newWidth, newHeight);
          releaseConstraints("initial population - skip transitions");
        }


        previousChild = firstChild;
        lastContentKey = currentContentKey;
        hasPopulatedOnce = true;
        if (localDebug.transition) {
          console.groupEnd();
        }
        return;
      }


      let sizePlan = {
        action: "none",
        targetWidth: constrainedWidth,
        targetHeight: constrainedHeight
      };
      size_transition: {
        const getTargetDimensions = () => {
          if (!isContentPhase) {
            return [newWidth, newHeight];
          }
          const shouldUseNewDimensions = naturalContentWidth === 0 && naturalContentHeight === 0;
          const targetWidth = shouldUseNewDimensions ? newWidth : naturalContentWidth || newWidth;
          const targetHeight = shouldUseNewDimensions ? newHeight : naturalContentHeight || newHeight;
          return [targetWidth, targetHeight];
        };
        const [targetWidth, targetHeight] = getTargetDimensions();
        sizePlan.targetWidth = targetWidth;
        sizePlan.targetHeight = targetHeight;
        if (targetWidth === constrainedWidth && targetHeight === constrainedHeight) {
          debug("size", "No size change required");

          break size_transition;
        }
        debug("size", "Size change needed:", {
          width: "".concat(constrainedWidth, " \u2192 ").concat(targetWidth),
          height: "".concat(constrainedHeight, " \u2192 ").concat(targetHeight)
        });
        if (isContentPhase) {

          sizePlan.action = hasSizeTransitions ? "animate" : "applyConstraints";
        } else {

          updateNaturalContentSize(targetWidth, targetHeight);
          sizePlan.action = hasSizeTransitions ? "animate" : "release";
        }
      }
      content_transition: {

        if (decisions.length === 1 && decisions[0] === "NO TRANSITION" && activeContentTransition === null && activePhaseTransition === null) {

        } else if (shouldDoContentTransitionIncludingPopulation && !preserveOnlyContentTransition) {
          const existingOldContents = contentOverlay.querySelectorAll("[data-ui-transition-old]");
          const animationProgress = activeContentTransition?.progress || 0;
          if (animationProgress > 0) {
            debug("transition", "Preserving content transition progress: ".concat((animationProgress * 100).toFixed(1), "%"));
          }
          const newTransitionType = container.getAttribute("data-content-transition") || CONTENT_TRANSITION;
          const canContinueSmoothly = activeContentTransitionType === newTransitionType && activeContentTransition;
          if (canContinueSmoothly) {
            debug("transition", "Continuing with same content transition type (restarting due to actual change)");
            activeContentTransition.cancel();
          } else if (activeContentTransition && activeContentTransitionType !== newTransitionType) {
            debug("transition", "Different content transition type, keeping both", "".concat(activeContentTransitionType, " \u2192 ").concat(newTransitionType));
          } else if (activeContentTransition) {
            debug("transition", "Cancelling current content transition");
            activeContentTransition.cancel();
          }
          const needsOldChildClone = (contentChange || becomesEmpty) && previousChild && !existingOldContents[0];
          const duration = parseInt(container.getAttribute("data-content-transition-duration") || CONTENT_TRANSITION_DURATION);
          const type = container.getAttribute("data-content-transition") || CONTENT_TRANSITION;
          const setupContentTransition = () => setupTransition({
            isPhaseTransition: false,
            overlay: contentOverlay,
            existingOldContents,
            needsOldChildClone,
            previousChild,
            firstChild,
            attributeToRemove: ["data-content-key"]
          });



          if (!hasSizeTransitions) {
            const willShrinkWidth = constrainedWidth > newWidth;
            const willShrinkHeight = constrainedHeight > newHeight;
            sizeHoldActive = willShrinkWidth || willShrinkHeight;
            if (sizeHoldActive) {
              debug("size", "Holding previous size during content transition: ".concat(constrainedWidth, "x").concat(constrainedHeight));
              applySizeConstraints(constrainedWidth, constrainedHeight);
            }
          }
          activeContentTransition = animateTransition(transitionController, firstChild, setupContentTransition, {
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

                releaseConstraints("content transition completed - release size hold");
                sizeHoldActive = false;
              }
            },
            debug
          });
          if (activeContentTransition) {
            activeContentTransition.play();
          }
          activeContentTransitionType = type;
        } else if (!shouldDoContentTransition && !preserveOnlyContentTransition) {

          contentOverlay.innerHTML = "";
          activeContentTransition = null;
          activeContentTransitionType = null;
        }


        if (shouldDoPhaseTransition) {
          const phaseTransitionType = container.getAttribute("data-phase-transition") || PHASE_TRANSITION;
          const existingOldPhaseContents = phaseOverlay.querySelectorAll("[data-ui-transition-old]");
          const phaseAnimationProgress = activePhaseTransition?.progress || 0;
          if (phaseAnimationProgress > 0) {
            debug("transition", "Preserving phase transition progress: ".concat((phaseAnimationProgress * 100).toFixed(1), "%"));
          }
          const canContinueSmoothly = activePhaseTransitionType === phaseTransitionType && activePhaseTransition;
          if (canContinueSmoothly) {
            debug("transition", "Continuing with same phase transition type");
            activePhaseTransition.cancel();
          } else if (activePhaseTransition && activePhaseTransitionType !== phaseTransitionType) {
            debug("transition", "Different phase transition type, keeping both", "".concat(activePhaseTransitionType, " \u2192 ").concat(phaseTransitionType));
          } else if (activePhaseTransition) {
            debug("transition", "Cancelling current phase transition");
            activePhaseTransition.cancel();
          }
          const needsOldPhaseClone = (becomesEmpty || becomesPopulated || phaseChange) && previousChild && !existingOldPhaseContents[0];
          const phaseDuration = parseInt(container.getAttribute("data-phase-transition-duration") || PHASE_TRANSITION_DURATION);
          const setupPhaseTransition = () => setupTransition({
            isPhaseTransition: true,
            overlay: phaseOverlay,
            existingOldContents: existingOldPhaseContents,
            needsOldChildClone: needsOldPhaseClone,
            previousChild,
            firstChild,
            attributeToRemove: ["data-content-key", "data-content-phase"]
          });
          const fromPhase = !hadChild ? "null" : wasContentPhase ? "content-phase" : "content";
          const toPhase = !hasChild ? "null" : isContentPhase ? "content-phase" : "content";
          debug("transition", "Starting phase transition: ".concat(fromPhase, " \u2192 ").concat(toPhase));
          activePhaseTransition = animateTransition(transitionController, firstChild, setupPhaseTransition, {
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
            debug
          });
          if (activePhaseTransition) {
            activePhaseTransition.play();
          }
          activePhaseTransitionType = phaseTransitionType;
        }
      }


      previousChild = firstChild;
      lastContentKey = currentContentKey;
      if (becomesPopulated) {
        hasPopulatedOnce = true;
      }


      if (!sizeHoldActive) {
        if (sizePlan.targetWidth === constrainedWidth && sizePlan.targetHeight === constrainedHeight) {

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


  handleChildSlotMutation("init");


  const mutationObserver = new MutationObserver(mutations => {
    let childListMutation = false;
    const attributeMutationSet = new Set();
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        childListMutation = true;
        continue;
      }
      if (mutation.type === "attributes") {
        const {
          attributeName,
          target
        } = mutation;
        if (attributeName === "data-content-key" || attributeName === "data-content-phase") {
          attributeMutationSet.add(attributeName);
          debug("transition", "Attribute change detected: ".concat(attributeName, " on"), target.getAttribute("data-ui-name") || "element");
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
        reasonParts.push("[".concat(attr, "] change"));
      }
    }
    const reason = reasonParts.join("+");
    handleChildSlotMutation(reason);
  });
  mutationObserver.observe(slot, {
    childList: true,
    attributes: true,
    attributeFilter: ["data-content-key", "data-content-phase"],
    characterData: false
  });


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
      phaseTransitionInProgress: activePhaseTransition !== null
    })
  };
};
const animateTransition = (transitionController, newChild, setupTransition, {
  type,
  duration,
  animationProgress = 0,
  isPhaseTransition,
  onComplete,
  fromContentKeyState,
  toContentKeyState,
  debug
}) => {
  let transitionType;
  if (type === "cross-fade") {
    transitionType = crossFade;
  } else if (type === "slide-left") {
    transitionType = slideLeft;
  } else {
    return null;
  }
  const {
    cleanup,
    oldElement,
    newElement
  } = setupTransition();

  const fromContentKey = fromContentKeyState;
  const toContentKey = toContentKeyState;
  debug("transition", "Setting up animation:", {
    type,
    from: fromContentKey,
    to: toContentKey,
    progress: "".concat((animationProgress * 100).toFixed(1), "%")
  });
  const remainingDuration = Math.max(100, duration * (1 - animationProgress));
  debug("transition", "Animation duration: ".concat(remainingDuration, "ms"));
  const transitions = transitionType.apply(oldElement, newElement, {
    duration: remainingDuration,
    startProgress: animationProgress,
    isPhaseTransition,
    debug
  });
  debug("transition", "Created ".concat(transitions.length, " transition(s) for animation"));
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
    }
  });
  return groupTransition;
};
const slideLeft = {
  name: "slide-left",
  apply: (oldElement, newElement, {
    duration,
    startProgress = 0,
    isPhaseTransition = false,
    debug
  }) => {
    if (!oldElement && !newElement) {
      return [];
    }
    if (!newElement) {

      const currentPosition = getTranslateX(oldElement);
      const containerWidth = getInnerWidth(oldElement.parentElement);
      const from = currentPosition;
      const to = -containerWidth;
      debug("transition", "Slide out to empty:", {
        from,
        to
      });
      return [createTranslateXTransition(oldElement, to, {
        from,
        duration,
        startProgress,
        onUpdate: ({
          value,
          timing
        }) => {
          debug("transition_updates", "Slide out progress:", value);
          if (timing === "end") {
            debug("transition", "Slide out complete");
          }
        }
      })];
    }
    if (!oldElement) {

      const containerWidth = getInnerWidth(newElement.parentElement);
      const from = containerWidth;
      const to = getTranslateXWithoutTransition(newElement);
      debug("transition", "Slide in from empty:", {
        from,
        to
      });
      return [createTranslateXTransition(newElement, to, {
        from,
        duration,
        startProgress,
        onUpdate: ({
          value,
          timing
        }) => {
          debug("transition_updates", "Slide in progress:", value);
          if (timing === "end") {
            debug("transition", "Slide in complete");
          }
        }
      })];
    }






    const containerWidth = getInnerWidth(newElement.parentElement);
    const oldContentPosition = getTranslateX(oldElement);
    const currentNewPosition = getTranslateX(newElement);
    const naturalNewPosition = getTranslateXWithoutTransition(newElement);



    let startNewPosition;
    if (currentNewPosition !== 0 && naturalNewPosition === 0) {
      startNewPosition = currentNewPosition + containerWidth;
      debug("transition", "Calculated seamless position:", "".concat(currentNewPosition, " + ").concat(containerWidth, " = ").concat(startNewPosition));
    } else {
      startNewPosition = naturalNewPosition || containerWidth;
    }


    const effectiveFromPosition = isPhaseTransition ? containerWidth : startNewPosition;
    debug("transition", "Slide transition:", {
      oldContent: "".concat(oldContentPosition, " \u2192 ").concat(-containerWidth),
      newContent: "".concat(effectiveFromPosition, " \u2192 ").concat(naturalNewPosition)
    });
    const transitions = [];


    transitions.push(createTranslateXTransition(oldElement, -containerWidth, {
      from: oldContentPosition,
      duration,
      startProgress,
      onUpdate: ({
        value
      }) => {
        debug("transition_updates", "Old content slide out:", value);
      }
    }));


    transitions.push(createTranslateXTransition(newElement, naturalNewPosition, {
      from: effectiveFromPosition,
      duration,
      startProgress,
      onUpdate: ({
        value,
        timing
      }) => {
        debug("transition_updates", "New content slide in:", value);
        if (timing === "end") {
          debug("transition", "Slide complete");
        }
      }
    }));
    return transitions;
  }
};
const crossFade = {
  name: "cross-fade",
  apply: (oldElement, newElement, {
    duration,
    startProgress = 0,
    isPhaseTransition = false,
    debug
  }) => {
    if (!oldElement && !newElement) {
      return [];
    }
    if (!newElement) {

      const from = getOpacity(oldElement);
      const to = 0;
      debug("transition", "Fade out to empty:", {
        from,
        to
      });
      return [createOpacityTransition(oldElement, to, {
        from,
        duration,
        startProgress,
        onUpdate: ({
          value,
          timing
        }) => {
          debug("transition_updates", "Content fade out:", value.toFixed(3));
          if (timing === "end") {
            debug("transition", "Fade out complete");
          }
        }
      })];
    }
    if (!oldElement) {

      const from = 0;
      const to = getOpacityWithoutTransition(newElement);
      debug("transition", "Fade in from empty:", {
        from,
        to
      });
      return [createOpacityTransition(newElement, to, {
        from,
        duration,
        startProgress,
        onUpdate: ({
          value,
          timing
        }) => {
          debug("transition_updates", "Fade in progress:", value.toFixed(3));
          if (timing === "end") {
            debug("transition", "Fade in complete");
          }
        }
      })];
    }



    const oldOpacity = getOpacity(oldElement);
    const newOpacity = getOpacity(newElement);
    const newNaturalOpacity = getOpacityWithoutTransition(newElement);



    let effectiveFromOpacity;
    if (isPhaseTransition) {
      effectiveFromOpacity = 0;
    } else {



      const hasOngoingTransition = newOpacity !== newNaturalOpacity && newOpacity > 0;
      effectiveFromOpacity = hasOngoingTransition ? newOpacity : 0;
    }
    debug("transition", "Cross-fade transition:", {
      oldOpacity: "".concat(oldOpacity, " \u2192 0"),
      newOpacity: "".concat(effectiveFromOpacity, " \u2192 ").concat(newNaturalOpacity),
      isPhaseTransition
    });
    return [createOpacityTransition(oldElement, 0, {
      from: oldOpacity,
      duration,
      startProgress,
      onUpdate: ({
        value
      }) => {
        if (value > 0) {
          debug("transition_updates", "Old content fade out:", value.toFixed(3));
        }
      }
    }), createOpacityTransition(newElement, newNaturalOpacity, {
      from: effectiveFromOpacity,
      duration,
      startProgress: isPhaseTransition ? 0 : startProgress,

      onUpdate: ({
        value,
        timing
      }) => {
        debug("transition_updates", "New content fade in:", value.toFixed(3));
        if (timing === "end") {
          debug("transition", "Cross-fade complete");
        }
      }
    })];
  }
};

export { EASING, activeElementSignal, addActiveElementEffect, addAttributeEffect, addWillChange, allowWheelThrough, canInterceptKeys, captureScrollState, createDragGestureController, createDragToMoveGestureController, createHeightTransition, createIterableWeakSet, createOpacityTransition, createPubSub, createStyleController, createTimelineTransition, createTransition, createTranslateXTransition, createWidthTransition, cubicBezier, dragAfterThreshold, elementIsFocusable, elementIsVisible, findAfter, findAncestor, findBefore, findDescendant, findFocusable, getAvailableHeight, getAvailableWidth, getBorderSizes, getDragCoordinates, getDropTargetInfo, getHeight, getInnerHeight, getInnerWidth, getMarginSizes, getMaxHeight, getMaxWidth, getMinHeight, getMinWidth, getPaddingSizes, getPositionedParent, getScrollContainer, getScrollContainerSet, getScrollRelativeRect, getSelfAndAncestorScrolls, getStyle, getWidth, initFlexDetailsSet, initFocusGroup, initPositionSticky, initUITransition, isScrollable, pickPositionRelativeTo, preventFocusNav, preventFocusNavViaKeyboard, resolveCSSSize, setAttribute, setAttributes, setStyles, startDragToResizeGesture, stickyAsRelativeCoords, trapFocusInside, trapScrollInside, useActiveElement, useAvailableHeight, useAvailableWidth, useMaxHeight, useMaxWidth, useResizeStatus, visibleRectEffect };