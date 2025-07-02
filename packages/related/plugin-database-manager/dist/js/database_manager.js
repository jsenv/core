import { d, E, A, d$1, u, D, F, _, q, k, J, E$1 } from "../jsenv_plugin_database_manager_node_modules.js";
import { startResizeGesture, getInnerWidth, getWidth, initFlexDetailsSet } from "@jsenv/dom";
import { valueInLocalStorage, useEditableController, Form, InputText, EditableText, Details, resource, useActionData } from "@jsenv/navi";
import { createUniqueValueConstraint, SINGLE_SPACE_CONSTRAINT } from "@jsenv/validation";

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

/* eslint-env browser,node */

/*
 * This file does not use export const InlineContent = function() {} on purpose:
 * - An export would be renamed by rollup,
 *   making it harder to statically detect new InlineContent() calls
 * - An export would be renamed by terser
 *   here again it becomes hard to detect new InlineContent() calls
 * Instead it sets "__InlineContent__" on the global object and terser is configured by jsenv
 * to preserve the __InlineContent__ global variable name
 */

const globalObject = typeof self === "object" ? self : process;
globalObject.__InlineContent__ = function (content, {
  type = "text/plain"
}) {
  this.text = content;
  this.type = type;
};

const inlineContent$2 = new __InlineContent__("body {\n  scrollbar-gutter: stable;\n  overflow-x: hidden;\n}\n\n#app {\n  flex-direction: row;\n  display: flex;\n}\n\naside {\n  z-index: 1;\n  border-right: 1px solid #e0e0e0;\n  flex-shrink: 0;\n  width: 250px;\n  min-width: 100px;\n  height: 100vh;\n  min-height: 300px;\n  position: -webkit-sticky;\n  position: sticky;\n  top: 0;\n}\n\naside > [data-resize-handle] {\n  z-index: 1;\n  cursor: ew-resize;\n  width: 5px;\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  right: -2.5px;\n}\n\naside > [data-resize-handle]:hover, aside[data-resizing] > [data-resize-handle] {\n  opacity: .5;\n  background-color: #00f;\n}\n\nmain {\n  box-sizing: border-box;\n  z-index: 0;\n  flex: 1;\n  min-width: 200px;\n  min-height: 100vh;\n  padding-bottom: 0;\n  position: relative;\n  overflow-x: auto;\n}\n\n.main_body {\n  min-width: 100%;\n}\n", {
  type: "text/css"
});
const stylesheet$2 = new CSSStyleSheet();
stylesheet$2.replaceSync(inlineContent$2.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$2];

const inlineContent$1 = new __InlineContent__("body {\n  color: #333;\n  background-color: #fff;\n  margin: 0;\n  font-family: system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica Neue, Arial, sans-serif;\n  line-height: 1.5;\n  transition: background-color .3s, color .3s;\n}\n\n* {\n  box-sizing: border-box;\n}\n\n[data-hidden] {\n  display: none !important;\n}\n", {
  type: "text/css"
});
const stylesheet$1 = new CSSStyleSheet();
stylesheet$1.replaceSync(inlineContent$1.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$1];

/*

 */

const [restoreAsideWidth, storeAsideWidth] = valueInLocalStorage("aside_width", {
  type: "positive_number"
});
const asideWidthSignal = d(restoreAsideWidth());
E(() => {
  const asideWidth = asideWidthSignal.value;
  storeAsideWidth(asideWidth);
});
const useAsideWidth = () => {
  return asideWidthSignal.value;
};
const setAsideWidth = width => {
  asideWidthSignal.value = width;
};
const Aside = ({
  children
}) => {
  const asideRef = A(null);
  const widthSetting = useAsideWidth();
  const [resizeWidth, resizeWidthSetter] = d$1(null);
  const resizeWidthRef = A(resizeWidth);
  resizeWidthRef.current = resizeWidth;
  const resizing = resizeWidth !== null;
  return u("aside", {
    ref: asideRef,
    "data-resize": "horizontal",
    style: {
      width: resizing ? resizeWidth : widthSetting,
      // Disable transition during resize to make it responsive
      transition: resizing ? "none" : undefined
    },
    onMouseDown: e => {
      let elementToResize;
      let widthAtStart;
      startResizeGesture(e, {
        onStart: gesture => {
          elementToResize = gesture.element;
          widthAtStart = getWidth(elementToResize);
        },
        onMove: gesture => {
          const xMove = gesture.xMove;
          const newWidth = widthAtStart + xMove;
          const minWidth =
          // <aside> min-width
          100;
          if (newWidth < minWidth) {
            resizeWidthSetter(minWidth);
            return;
          }
          const availableWidth = getInnerWidth(elementToResize.parentElement);
          const maxWidth = availableWidth -
          // <main> min-width
          200;
          if (newWidth > maxWidth) {
            resizeWidthSetter(maxWidth);
            return;
          }
          resizeWidthSetter(newWidth);
        },
        onEnd: () => {
          const resizeWidth = resizeWidthRef.current;
          if (resizeWidth) {
            setAsideWidth(resizeWidth);
          }
        }
      });
    },
    children: [children, u("div", {
      "data-resize-handle": true
    })]
  });
};

const installImportMetaCss = importMeta => {
  let cssText = "";
  let stylesheet = new CSSStyleSheet();
  let adopted = false;
  const css = {
    toString: () => cssText,
    update: value => {
      cssText = value;
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

installImportMetaCss(import.meta);import.meta.css = /* css */"\n  .text_and_count {\n    display: flex;\n    align-items: center;\n    gap: 3px;\n  }\n\n  .count {\n    color: rgba(28, 43, 52, 0.4);\n  }\n";
const TextAndCount = ({
  text,
  count
}) => {
  return u("span", {
    className: "text_and_count",
    children: [u("span", {
      className: "label",
      children: text
    }), count > 0 && u("span", {
      className: "count",
      children: ["(", count, ")"]
    })]
  });
};

const roleCanLoginCountSignal = d(0);
const setRoleCanLoginCount = count => {
  roleCanLoginCountSignal.value = count;
};
const useRoleCanLoginCount = () => {
  return roleCanLoginCountSignal.value;
};
const roleGroupCountSignal = d(0);
const setRoleGroupCount = count => {
  roleGroupCountSignal.value = count;
};
const roleWithOwnershipCountSignal = d(0);
const setRoleWithOwnershipCount = count => {
  roleWithOwnershipCountSignal.value = count;
};
const setRoleCounts = ({
  canLoginCount,
  groupCount,
  withOwnershipCount
}) => {
  setRoleCanLoginCount(canLoginCount);
  setRoleGroupCount(groupCount);
  setRoleWithOwnershipCount(withOwnershipCount);
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
  children
}) => {
  return u("span", {
    style: {
      display: "flex",
      alignItems: "center",
      width,
      height,
      justifySelf: "center",
      lineHeight: "1em"
    },
    children: children
  });
};

const ExplorerItem = ({
  nameKey,
  item,
  renderItem,
  useItemList,
  useRenameItemAction = () => undefined,
  useDeleteItemAction = () => undefined
}) => {
  const itemName = item[nameKey];
  const deleteAction = useDeleteItemAction(item);
  const renameAction = useRenameItemAction(item);
  const {
    editable,
    startEditing,
    stopEditing
  } = useEditableController();
  return renderItem(item, {
    deleteShortcutAction: deleteAction,
    deleteShortcutConfirmContent: "Are you sure you want to delete \"".concat(itemName, "\"?"),
    onKeydown: e => {
      if (e.key === "Enter" && !editable && renameAction) {
        e.preventDefault();
        e.stopPropagation();
        startEditing();
      }
    },
    children: renameAction ? u(RenameInputOrName, {
      nameKey: nameKey,
      item: item,
      useItemList: useItemList,
      renameAction: renameAction,
      editable: editable,
      stopEditing: stopEditing
    }) : u("span", {
      style: {
        overflow: "hidden",
        textOverflow: "ellipsis"
      },
      children: itemName
    })
  });
};
const RenameInputOrName = ({
  nameKey,
  item,
  useItemList,
  renameAction,
  editable,
  stopEditing
}) => {
  const itemName = item[nameKey];
  const itemList = useItemList();
  const otherValueSet = new Set();
  for (const itemCandidate of itemList) {
    if (itemCandidate === item) {
      continue;
    }
    otherValueSet.add(itemCandidate[nameKey]);
  }
  const uniqueNameConstraint = createUniqueValueConstraint(otherValueSet, "\"{value}\" already exist, please choose another name.");
  return u(EditableText, {
    name: nameKey,
    action: renameAction,
    editable: editable,
    onEditEnd: stopEditing,
    value: itemName,
    constraints: [SINGLE_SPACE_CONSTRAINT, uniqueNameConstraint],
    children: u("span", {
      style: {
        overflow: "hidden",
        textOverflow: "ellipsis"
      },
      children: itemName
    })
  });
};
const ExplorerNewItem = ({
  nameKey,
  useItemList,
  useCreateItemAction,
  cancelOnBlurInvalid,
  onCancel,
  onActionEnd
}) => {
  const createItemAction = useCreateItemAction();
  const itemList = useItemList();
  const valueSet = new Set();
  for (const item of itemList) {
    valueSet.add(item[nameKey]);
  }
  const uniqueNameConstraint = createUniqueValueConstraint(valueSet, "\"{value}\" already exists. Please choose an other name.");
  return u("span", {
    className: "explorer_item_content",
    children: [u(FontSizedSvg, {
      children: u(EnterNameIconSvg, {})
    }), u(Form, {
      action: createItemAction,
      onActionEnd: onActionEnd,
      children: u(InputText, {
        name: nameKey,
        autoFocus: true,
        required: true,
        requestExecuteOnChange: true,
        constraints: [SINGLE_SPACE_CONSTRAINT, uniqueNameConstraint],
        cancelOnEscape: true,
        cancelOnBlurInvalid: cancelOnBlurInvalid,
        onCancel: onCancel
      })
    })]
  });
};
const EnterNameIconSvg = ({
  color = "currentColor"
}) => {
  return u("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: u("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M21.1213 2.70705C19.9497 1.53548 18.0503 1.53547 16.8787 2.70705L15.1989 4.38685L7.29289 12.2928C7.16473 12.421 7.07382 12.5816 7.02986 12.7574L6.02986 16.7574C5.94466 17.0982 6.04451 17.4587 6.29289 17.707C6.54127 17.9554 6.90176 18.0553 7.24254 17.9701L11.2425 16.9701C11.4184 16.9261 11.5789 16.8352 11.7071 16.707L19.5556 8.85857L21.2929 7.12126C22.4645 5.94969 22.4645 4.05019 21.2929 2.87862L21.1213 2.70705ZM18.2929 4.12126C18.6834 3.73074 19.3166 3.73074 19.7071 4.12126L19.8787 4.29283C20.2692 4.68336 20.2692 5.31653 19.8787 5.70705L18.8622 6.72357L17.3068 5.10738L18.2929 4.12126ZM15.8923 6.52185L17.4477 8.13804L10.4888 15.097L8.37437 15.6256L8.90296 13.5112L15.8923 6.52185ZM4 7.99994C4 7.44766 4.44772 6.99994 5 6.99994H10C10.5523 6.99994 11 6.55223 11 5.99994C11 5.44766 10.5523 4.99994 10 4.99994H5C3.34315 4.99994 2 6.34309 2 7.99994V18.9999C2 20.6568 3.34315 21.9999 5 21.9999H16C17.6569 21.9999 19 20.6568 19 18.9999V13.9999C19 13.4477 18.5523 12.9999 18 12.9999C17.4477 12.9999 17 13.4477 17 13.9999V18.9999C17 19.5522 16.5523 19.9999 16 19.9999H5C4.44772 19.9999 4 19.5522 4 18.9999V7.99994Z",
      fill: color
    })
  });
};

const ExplorerItemList = ({
  idKey,
  nameKey,
  renderItem,
  useItemList,
  useRenameItemAction,
  useDeleteItemAction,
  isCreatingNew,
  useCreateItemAction,
  stopCreatingNew,
  children
}) => {
  return u("ul", {
    className: "explorer_item_list",
    children: [children.map(item => {
      return u("li", {
        className: "explorer_item",
        children: u(ExplorerItem, {
          idKey: idKey,
          nameKey: nameKey,
          item: item,
          renderItem: renderItem,
          useItemList: useItemList,
          useRenameItemAction: useRenameItemAction,
          useDeleteItemAction: useDeleteItemAction
        })
      }, item[idKey]);
    }), isCreatingNew && u("li", {
      className: "explorer_item",
      children: u(ExplorerNewItem, {
        nameKey: nameKey,
        useItemList: useItemList,
        useCreateItemAction: useCreateItemAction,
        cancelOnBlurInvalid: true,
        onCancel: () => {
          stopCreatingNew();
        },
        onActionEnd: () => {
          stopCreatingNew();
        }
      })
    })]
  });
};

/**
 *
 */

const createExplorerGroupController = (id, {
  detailsOpenAtStart,
  detailsOnToggle
}) => {
  const [restoreHeight, storeHeight] = valueInLocalStorage("explorer_group_".concat(id, "_height"), {
    type: "positive_number"
  });
  const heightSettingSignal = d(restoreHeight());
  E(() => {
    const height = heightSettingSignal.value;
    storeHeight(height);
  });
  const useHeightSetting = () => {
    return heightSettingSignal.value;
  };
  const setHeightSetting = width => {
    heightSettingSignal.value = width;
  };
  return {
    id,
    useHeightSetting,
    setHeightSetting,
    detailsOpenAtStart,
    detailsOnToggle
  };
};
const ExplorerGroup = D(({
  controller,
  detailsAction,
  idKey,
  nameKey,
  children,
  labelChildren,
  renderNewButtonChildren,
  renderItem,
  useItemList,
  useRenameItemAction,
  useCreateItemAction,
  useDeleteItemAction,
  onOpen,
  onClose,
  resizable,
  ...rest
}, ref) => {
  const innerRef = A();
  F(ref, () => innerRef.current);
  _(() => {
    setTimeout(() => {
      innerRef.current.setAttribute("data-details-toggle-animation", "");
    });
  }, []);
  const [isCreatingNew, setIsCreatingNew] = d$1(false);
  const startCreatingNew = q(() => {
    setIsCreatingNew(true);
  }, [setIsCreatingNew]);
  const stopCreatingNew = q(() => {
    setIsCreatingNew(false);
  }, [setIsCreatingNew]);
  const heightSetting = controller.useHeightSetting();
  return u(k, {
    children: [resizable && u("div", {
      "data-resize-handle": controller.id,
      id: "".concat(controller.id, "_resize_handle")
    }), u(Details, {
      ...rest,
      ref: innerRef,
      id: controller.id,
      open: controller.detailsOpenAtStart,
      className: "explorer_group",
      onToggle: toggleEvent => {
        controller.detailsOnToggle(toggleEvent.newState === "open");
        if (toggleEvent.newState === "open") {
          if (onOpen) {
            onOpen();
          }
        } else if (onClose) {
          onClose();
        }
      },
      "data-resize": resizable ? "vertical" : "none",
      "data-min-height": "150",
      "data-requested-height": heightSetting,
      action: detailsAction,
      actionRenderer: () => {
        return u("div", {
          className: "explorer_group_content",
          children: u(ExplorerItemList, {
            idKey: idKey,
            nameKey: nameKey,
            renderItem: renderItem,
            useItemList: useItemList,
            useRenameItemAction: useRenameItemAction,
            useCreateItemAction: useCreateItemAction,
            useDeleteItemAction: useDeleteItemAction,
            isCreatingNew: isCreatingNew,
            stopCreatingNew: stopCreatingNew,
            children: children
          })
        });
      },
      children: [labelChildren, renderNewButtonChildren ? u(k, {
        children: [u("span", {
          style: "display: flex; flex: 1"
        }), u("button", {
          className: "summary_action_icon",
          style: "width: 22px; height: 22px; cursor: pointer;",
          onMouseDown: e => {
            // ensure when input is focused it stays focused
            // without this preventDefault() the input would be blurred (which might cause creation of an item) and re-opened empty
            e.preventDefault();
          },
          onClick: e => {
            e.preventDefault();
            startCreatingNew();
          },
          children: renderNewButtonChildren()
        })]
      }) : null]
    })]
  });
});

const CurrentSvg = () => {
  return u("svg", {
    viewBox: "0 0 16 16",
    width: "100%",
    height: "100%",
    xmlns: "http://www.w3.org/2000/svg",
    children: u("path", {
      d: "m 8 0 c -3.3125 0 -6 2.6875 -6 6 c 0.007812 0.710938 0.136719 1.414062 0.386719 2.078125 l -0.015625 -0.003906 c 0.636718 1.988281 3.78125 5.082031 5.625 6.929687 h 0.003906 v -0.003906 c 1.507812 -1.507812 3.878906 -3.925781 5.046875 -5.753906 c 0.261719 -0.414063 0.46875 -0.808594 0.585937 -1.171875 l -0.019531 0.003906 c 0.25 -0.664063 0.382813 -1.367187 0.386719 -2.078125 c 0 -3.3125 -2.683594 -6 -6 -6 z m 0 3.691406 c 1.273438 0 2.308594 1.035156 2.308594 2.308594 s -1.035156 2.308594 -2.308594 2.308594 c -1.273438 -0.003906 -2.304688 -1.035156 -2.304688 -2.308594 c -0.003906 -1.273438 1.03125 -2.304688 2.304688 -2.308594 z m 0 0",
      fill: "#2e3436"
    })
  });
};

// https://www.svgrepo.com/svg/437987/plus-circle
const PlusSvg = ({
  circle,
  backgroundColor = "",
  color = "currentColor"
}) => {
  return u("svg", {
    width: "100%",
    height: "100%",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: [backgroundColor && u("rect", {
      x: "0",
      y: "0",
      width: "24",
      height: "24",
      fill: backgroundColor
    }), circle && u("rect", {
      x: "3",
      y: "3",
      width: "18",
      height: "18",
      rx: "9",
      stroke: color,
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }), u("path", {
      d: "M12 7.75732L12 16.2426",
      stroke: color,
      "stroke-width": "2",
      "stroke-linecap": "round"
    }), u("path", {
      d: "M7.75735 12L16.2426 12",
      stroke: color,
      "stroke-width": "2",
      "stroke-linecap": "round"
    })]
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */"\n  .svg_mask_content * {\n    fill: black !important;\n    stroke: black !important;\n    fill-opacity: 1 !important;\n    stroke-opacity: 1 !important;\n    color: black !important;\n    opacity: 1 !important;\n  }\n";
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
  const instanceId = "svgmo-".concat(Math.random().toString(36).slice(2, 9));

  // Create nested masked elements
  let maskedElement = baseSvg;

  // Apply each mask in sequence
  overlaySvgs.forEach((overlaySvg, index) => {
    const maskId = "mask-".concat(instanceId, "-").concat(index);
    maskedElement = u("g", {
      mask: "url(#".concat(maskId, ")"),
      children: maskedElement
    });
  });
  return u("svg", {
    viewBox: viewBox,
    width: "100%",
    height: "100%",
    children: [u("defs", {
      children: overlaySvgs.map((overlaySvg, index) => {
        const maskId = "mask-".concat(instanceId, "-").concat(index);

        // IMPORTANT: clone the overlay SVG exactly as is, just add the mask class
        return u("mask", {
          id: maskId,
          children: [u("rect", {
            width: "100%",
            height: "100%",
            fill: "white"
          }), J(overlaySvg, {
            className: "svg_mask_content" // Apply styling to make it black
          })]
        }, maskId);
      })
    }), maskedElement, overlaySvgs]
  });
};

const SvgIconGroup = ({
  children
}) => {
  return u(SVGMaskOverlay, {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    children: [u("svg", {
      children: [u("svg", {
        x: "2",
        y: "4",
        width: "12",
        height: "12",
        overflow: "visible",
        children: children
      }), u("svg", {
        x: "10",
        y: "4",
        width: "12",
        height: "12",
        overflow: "visible",
        children: children
      })]
    }), u("svg", {
      x: "6",
      y: "8",
      width: "12",
      height: "12",
      overflow: "visible",
      children: children
    })]
  });
};
const SvgWithPlus = ({
  children
}) => {
  return u(SVGMaskOverlay, {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    children: [children, u("svg", {
      x: "12",
      y: "12",
      width: "16",
      height: "16",
      overflow: "visible",
      children: [u("circle", {
        cx: "8",
        cy: "8",
        r: "5",
        fill: "transparent"
      }), u(PlusSvg, {
        color: "green"
      })]
    })]
  });
};

// https://www.svgrepo.com/collection/zest-interface-icons/12
// https://flowbite.com/icons/

const pickRoleIcon = role => {
  if (!role.rolcanlogin) {
    if (role.rolsuper) {
      return SuperRoleGroupSvg;
    }
    return RoleGroupSvg;
  }
  if (role.rolsuper) {
    return SuperRoleCanLoginSvg;
  }
  return RoleCanLoginSvg;
};
const RoleCanLoginSvg = ({
  color = "currentColor",
  headColor = "transparent",
  bodyColor = "transparent"
}) => {
  return u("svg", {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: [bodyColor && u("path", {
      d: "M4.5 19.8C4.5 17.5 6.8 15 12 15C17.2 15 19.5 17.5 19.5 19.8C19.5 20.4 19.2 20.8 18.8 20.8H5.2C4.8 20.8 4.5 20.4 4.5 19.8Z",
      fill: bodyColor
    }), headColor && u("circle", {
      cx: "12",
      cy: "9",
      r: "4",
      fill: headColor
    }), u("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M8 9C8 6.79086 9.79086 5 12 5C14.2091 5 16 6.79086 16 9C16 11.2091 14.2091 13 12 13C9.79086 13 8 11.2091 8 9ZM15.8243 13.6235C17.1533 12.523 18 10.8604 18 9C18 5.68629 15.3137 3 12 3C8.68629 3 6 5.68629 6 9C6 10.8604 6.84668 12.523 8.17572 13.6235C4.98421 14.7459 3 17.2474 3 20C3 20.5523 3.44772 21 4 21C4.55228 21 5 20.5523 5 20C5 17.7306 7.3553 15 12 15C16.6447 15 19 17.7306 19 20C19 20.5523 19.4477 21 20 21C20.5523 21 21 20.5523 21 20C21 17.2474 19.0158 14.7459 15.8243 13.6235Z",
      fill: color,
      "fill-opacity": "1"
    })]
  });
};
const RoleCanLoginWithPlusSvg = ({
  color
}) => {
  return u(SvgWithPlus, {
    children: u(RoleCanLoginSvg, {
      color: color
    })
  });
};
const SuperRoleCanLoginSvg = ({
  color = "currentColor",
  hatColor = "transparent",
  headColor = "transparent"
}) => {
  return u("svg", {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: [headColor && u("path", {
      d: "M8 10C8 12.2091 9.79086 14 12 14C14.2091 14 16 12.2091 16 10C16 9.4 15.87 8.83 15.63 8.31L12.45 9.89C12.17 10.03 11.83 10.03 11.55 9.89L8.37 8.31C8.13 8.83 8 9.4 8 10Z",
      fill: headColor
    }), hatColor && u("path", {
      d: "M4.55279 4.60557L11.5528 1.10557C11.8343 0.964809 12.1657 0.964809 12.4472 1.10557L19.4472 4.60557C19.786 4.77496 20 5.12123 20 5.5C20 5.87877 19.786 6.22504 19.4472 6.39443L12.4472 9.89443C12.1657 10.0352 11.8343 10.0352 11.5528 9.89443L4.55279 6.39443C4.214 6.22504 4 5.87877 4 5.5C4 5.12123 4.214 4.77496 4.55279 4.60557Z",
      fill: hatColor
    }), u("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M12.4472 1.10557C12.1657 0.964809 11.8343 0.964809 11.5528 1.10557L4.55279 4.60557C4.214 4.77496 4 5.12123 4 5.5C4 5.87877 4.214 6.22504 4.55279 6.39443L6.58603 7.41105C6.21046 8.19525 6 9.07373 6 10C6 11.8604 6.84668 13.523 8.17572 14.6235C4.98421 15.7459 3 18.2474 3 21C3 21.5523 3.44772 22 4 22C4.55228 22 5 21.5523 5 21C5 18.7306 7.3553 16 12 16C16.6447 16 19 18.7306 19 21C19 21.5523 19.4477 22 20 22C20.5523 22 21 21.5523 21 21C21 18.2474 19.0158 15.7459 15.8243 14.6235C17.1533 13.523 18 11.8604 18 10C18 9.07373 17.7895 8.19525 17.414 7.41105L19.4472 6.39443C19.786 6.22504 20 5.87877 20 5.5C20 5.12123 19.786 4.77496 19.4472 4.60557L12.4472 1.10557ZM12 14C14.2091 14 16 12.2091 16 10C16 9.39352 15.8656 8.81975 15.6248 8.30566L12.4472 9.89443C12.1657 10.0352 11.8343 10.0352 11.5528 9.89443L8.37525 8.30566C8.13443 8.81975 8 9.39352 8 10C8 12.2091 9.79086 14 12 14ZM8.44695 6.10544L7.23607 5.5L12 3.11803L16.7639 5.5L15.5531 6.10544L12 7.88197L8.44695 6.10544Z",
      fill: color
    })]
  });
};
const SuperRoleGroupSvg = ({
  color = "currentColor"
}) => {
  return u(SvgIconGroup, {
    children: u(SuperRoleCanLoginSvg, {
      color: color
    })
  });
};
const RoleGroupSvg = ({
  color = "currentColor"
}) => {
  return u(SvgIconGroup, {
    children: u(RoleCanLoginSvg, {
      color: color
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */"\n  .link_with_icon {\n    white-space: nowrap;\n    align-items: center;\n    gap: 0.3em;\n    min-width: 0;\n    display: inline-flex;\n    overflow: hidden;\n  }\n\n  .link_with_icon[data-active] {\n    background-color: lightgrey;\n  }\n";
const LinkWithIcon = ({
  icon,
  isCurrent,
  children,
  ...rest
}) => {
  return u("a", {
    className: "link_with_icon",
    ...rest,
    children: [u(FontSizedSvg, {
      children: icon
    }), isCurrent && u(FontSizedSvg, {
      children: u(CurrentSvg, {})
    }), children]
  });
};

const errorFromResponse = async (response, message) => {
  const serverErrorInfo = await response.json();
  let serverMessage = typeof serverErrorInfo === "string" ? serverErrorInfo : serverErrorInfo.message;
  let errorMessage = message ? "".concat(message, ": ").concat(serverMessage) : serverMessage;
  const error = new Error(errorMessage);
  if (serverErrorInfo && typeof serverErrorInfo === "object") {
    error.stack = serverErrorInfo.stack || serverErrorInfo.message;
  }
  error.status = response.status;
  throw error;
};

const ROLE = resource("role", {
  idKey: "oid",
  mutableIdKeys: ["rolname"],
  GET_MANY: async ({
    canlogin
  }, {
    signal
  }) => {
    const getManyRoleUrl = new URL("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles"));
    if (canlogin) {
      getManyRoleUrl.searchParams.set("can_login", "");
    }
    const response = await fetch(getManyRoleUrl, {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get roles");
    }
    const {
      data
      // { currentRole }
      // meta,
    } = await response.json();
    return data;
  },
  GET: async ({
    rolname
  }, {
    signal
  }) => {
    const getRoleUrl = new URL("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles/").concat(rolname));
    const response = await fetch(getRoleUrl, {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get role");
    }
    const {
      data,
      // { databases, columns, members }
      meta
    } = await response.json();
    return {
      ...data,
      ...meta
    };
  },
  POST: async ({
    rolcanlogin,
    rolname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles"), {
      signal,
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        rolname,
        rolcanlogin
      })
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to create role");
    }
    const {
      data,
      meta
    } = await response.json();
    const {
      roleCounts
    } = meta;
    setRoleCounts(roleCounts);
    return data;
  },
  DELETE: async ({
    rolname,
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles/").concat(rolname), {
      signal,
      method: "DELETE",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      }
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to delete role");
    }
    const {
      meta
    } = await response.json();
    const {
      roleCounts
    } = meta;
    setRoleCounts(roleCounts);
    return {
      rolname
    };
  },
  PUT: async ({
    rolname,
    columnName,
    columnValue
  }, {
    signal
  }) => {
    if (columnName === "rolconnlimit") {
      columnValue = parseInt(columnValue, 10);
    }
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles/").concat(rolname, "/").concat(columnName), {
      signal,
      method: "PUT",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(columnValue)
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to update role");
    }
    return {
      rolname,
      [columnName]: columnValue
    };
  }
});
const useRoleArray = ROLE.useArray;
ROLE.GET_MANY_CAN_LOGIN = ROLE.GET_MANY.bindParams({
  canlogin: true
});
const useRoleCanLoginArray = () => {
  const roleCanLoginArray = useActionData(ROLE.GET_MANY_CAN_LOGIN);
  return roleCanLoginArray;
};
const currentRoleIdSignal = d(window.DB_MANAGER_CONFIG.currentRole.oid);
const useCurrentRole = () => {
  const currentRoleId = currentRoleIdSignal.value;
  const currentRole = ROLE.store.select(currentRoleId);
  return currentRole;
};
ROLE.many("members", ROLE, {
  POST: async ({
    rolname,
    memberRolname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles/").concat(rolname, "/members/").concat(memberRolname), {
      signal,
      method: "PUT"
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to add ".concat(memberRolname, " to ").concat(rolname));
    }
    const {
      data
    } = await response.json();
    const member = data;
    return [{
      rolname
    }, member];
  },
  DELETE: async ({
    rolname,
    memberRolname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles/").concat(rolname, "/members/").concat(memberRolname), {
      signal,
      method: "DELETE"
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to remove ".concat(memberRolname, " from ").concat(rolname));
    }
    return [{
      rolname
    }, {
      rolname: memberRolname
    }];
  }
});
ROLE.store.upsert(window.DB_MANAGER_CONFIG.currentRole);

const RoleLink = ({
  role,
  children,
  ...rest
}) => {
  const rolname = role.rolname;
  // const roleRouteIsMatching = useRouteIsMatching(GET_ROLE_ROUTE, { rolname });
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && rolname === currentRole.rolname;
  const RoleIcon = pickRoleIcon(role);
  return u(LinkWithIcon, {
    icon: u(RoleIcon, {
      color: "#333"
    }),
    isCurrent: isCurrent,
    "data-active": undefined,
    href: "TODO",
    ...rest,
    children: children
  });
};

const [readRoleCanLoginListDetailsOpened, storeRoleCanLoginListDetailsOpened, eraseRoleCanLoginListDetailsOpened] = valueInLocalStorage("role_can_login_list_details_opened", {
  type: "boolean"
});
const roleCanLoginListDetailsOpenAtStart = readRoleCanLoginListDetailsOpened();
if (roleCanLoginListDetailsOpenAtStart) {
  ROLE.GET_MANY_CAN_LOGIN.preload(); // et encore c'est seulement si on est sur la bonne page sinon c'est con
}
const roleCanLoginListDetailsOnToggle = detailsOpen => {
  if (detailsOpen) {
    storeRoleCanLoginListDetailsOpened(true);
  } else {
    eraseRoleCanLoginListDetailsOpened();
  }
};

const roleCanLoginListDetailsController = createExplorerGroupController("role_can_login_list", {
  detailsOpenAtStart: roleCanLoginListDetailsOpenAtStart,
  detailsOnToggle: roleCanLoginListDetailsOnToggle
});
const RoleCanLoginListDetails = props => {
  const roleCanLoginCount = useRoleCanLoginCount();
  const roleCanLoginArray = useRoleCanLoginArray();
  return u(ExplorerGroup, {
    ...props,
    controller: roleCanLoginListDetailsController,
    detailsAction: ROLE.GET_MANY_CAN_LOGIN,
    idKey: "oid",
    nameKey: "rolname",
    labelChildren: u(TextAndCount, {
      text: "ROLE LOGINS",
      count: roleCanLoginCount
    }),
    renderNewButtonChildren: () => u(RoleCanLoginWithPlusSvg, {}),
    renderItem: (role, {
      children,
      ...props
    }) => u(RoleLink, {
      role: role,
      ...props,
      children: children
    }),
    useItemList: useRoleArray,
    useRenameItemAction: role => ROLE.PUT.bindParams({
      rolname: role.rolname,
      columnName: "rolname"
    }),
    useCreateItemAction: () => ROLE.POST.bindParams({
      rolcanlogin: true
    }),
    useDeleteItemAction: role => ROLE.DELETE.bindParams({
      rolname: role.rolname
    }),
    children: roleCanLoginArray
  });
};

const inlineContent = new __InlineContent__(".explorer {\n  background: #f5f5f5;\n  flex-direction: column;\n  flex: 1;\n  width: 100%;\n  height: 100%;\n  margin-bottom: 20px;\n  display: flex;\n  overflow: auto;\n}\n\n.explorer_head {\n  flex-direction: row;\n  align-items: center;\n  padding-left: 6px;\n  display: flex;\n}\n\n.explorer_head h2 {\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  user-select: none;\n  margin-top: .5em;\n  margin-bottom: .5em;\n  margin-left: 24px;\n  font-size: 16px;\n}\n\n.explorer_body {\n  flex-direction: column;\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  overflow: hidden;\n}\n\n.explorer_group > summary {\n  cursor: pointer;\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  user-select: none;\n  border: 1px solid #0000;\n  border-top-color: #e0e0e0;\n  flex-shrink: 0;\n  font-size: 14px;\n}\n\n.explorer_group:first-of-type > summary {\n  border-top-color: #0000;\n}\n\n.explorer_group > summary:focus {\n  border-color: #00f;\n}\n\n.summary_action_icon {\n  visibility: hidden;\n  pointer-events: none;\n  background-color: #0000;\n  border: 0;\n  padding: 0;\n}\n\n.explorer_group[open] .summary_action_icon {\n  visibility: visible;\n  pointer-events: auto;\n}\n\n.summary_action_icon:hover {\n  background: #0000001a;\n}\n\n.summary_label {\n  flex: 1;\n  align-items: center;\n  gap: .2em;\n  padding-right: 10px;\n  display: flex;\n}\n\n.explorer_group > summary .summary_label {\n  font-weight: 500;\n}\n\n.explorer_body > [data-resize-handle] {\n  z-index: 2;\n  cursor: ns-resize;\n  flex-shrink: 0;\n  justify-content: center;\n  align-items: center;\n  width: 100%;\n  height: 5px;\n  margin-top: -2.5px;\n  margin-bottom: -2.5px;\n  display: flex;\n  position: relative;\n}\n\n.explorer_body > [data-resize-handle]:hover, .explorer_body > [data-resize-handle][data-active] {\n  opacity: .5;\n  background-color: #00f;\n}\n\n.explorer_group_content {\n  scrollbar-gutter: stable;\n  overscroll-behavior: contain;\n  scrollbar-width: thin;\n  flex: 1;\n  height: 100%;\n  min-height: 0;\n  overflow-y: auto;\n}\n\n.explorer_group[data-size-animated] .explorer_group_content {\n  overflow-y: hidden;\n}\n\n.explorer_item_list {\n  margin-top: 0;\n  margin-bottom: 0;\n  padding-left: 16px;\n}\n\n.explorer_item {\n  display: flex;\n}\n\n.explorer_item_content {\n  white-space: nowrap;\n  align-items: center;\n  gap: .3em;\n  min-width: 0;\n  display: flex;\n  overflow: hidden;\n}\n\n.explorer_foot {\n  height: 10px;\n}\n", {
  type: "text/css"
});
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

const EXPLORER = resource("explorer", {
  GET: async (_, {
    signal
  }) => {
    const explorerApiUrl = new URL("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/explorer"));
    const response = await fetch(explorerApiUrl, {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get explorer data");
    }
    const {
      data
    } = await response.json();
    const {
      roleCounts
    } = data;
    setRoleCounts(roleCounts);
    return {};
  }
});
EXPLORER.GET.load();

const Explorer = () => {
  const role = useCurrentRole();
  // const database = useCurrentDatabase();
  const RoleIcon = pickRoleIcon(role);
  return u("nav", {
    className: "explorer",
    children: [u("div", {
      className: "explorer_head",
      children: [u(FontSizedSvg, {
        children: u(RoleIcon, {})
      }), u("select", {
        style: "margin-top: 10px; margin-bottom: 10px; margin-left: 5px;",
        children: u("option", {
          selected: true,
          children: role.rolname
        })
      }), u("span", {
        style: "width: 10px"
      })]
    }), u(ExplorerBody, {}), u("div", {
      className: "explorer_foot"
    })]
  });
};
const ExplorerBody = () => {
  const flexDetailsSetRef = A();
  const [resizableDetailsIdSet, setResizableDetailsIdSet] = d$1(new Set());
  _(() => {
    const flexDetailsSet = initFlexDetailsSet(flexDetailsSetRef.current, {
      onResizableDetailsChange: resizableDetailsIdSet => {
        setResizableDetailsIdSet(new Set(resizableDetailsIdSet));
      },
      onRequestedSizeChange: (element, requestedHeight) => {
        // if (element.id === tablesDetailsController.id) {
        //   tablesDetailsController.setHeightSetting(requestedHeight);
        // }
        // if (element.id === databasesDetailsController.id) {
        //   databasesDetailsController.setHeightSetting(requestedHeight);
        // }
        if (element.id === roleCanLoginListDetailsController.id) {
          roleCanLoginListDetailsController.setHeightSetting(requestedHeight);
        }
        // if (element.id === roleGroupListDetailsController.id) {
        //   roleGroupListDetailsController.setHeightSetting(requestedHeight);
        // }
        // if (element.id === roleWithOwnershipListDetailsController.id) {
        //   roleWithOwnershipListDetailsController.setHeightSetting(
        //     requestedHeight,
        //   );
        // }
      }
    });
    return flexDetailsSet.cleanup;
  }, []);
  return u("div", {
    ref: flexDetailsSetRef,
    className: "explorer_body",
    children: u(RoleCanLoginListDetails, {
      resizable: resizableDetailsIdSet.has(roleCanLoginListDetailsController.id)
    })
  });
};

// organize-imports-ignore
const App = () => {
  return u("div", {
    id: "app",
    children: u(Aside, {
      children: u(Explorer, {})
    })
  });
};
E$1(u(App, {}), document.querySelector("#root"));
