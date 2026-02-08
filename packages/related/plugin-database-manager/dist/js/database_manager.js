import { v, u, useSignal, M, F, T, h, A, b, k, m, O, q, F$1 } from "../jsenv_plugin_database_manager_node_modules.js";
import { initFlexDetailsSet, startDragToResizeGesture, getInnerWidth, getWidth, initPositionSticky } from "@jsenv/dom";
import { useEditionController, createAvailableConstraint, Input, SINGLE_SPACE_CONSTRAINT, useSignalSync, Editable, useSelectionController, useKeyboardShortcuts, createSelectionKeyboardShortcuts, Details, Button, valueInLocalStorage, SVGMaskOverlay, resource, useActionData, setBaseUrl, setupRoutes, createAction, useRouteStatus, useRunOnMount, Form, Select, Label, ErrorBoundaryContext, Route, useNavState, Table, TabList, Tab, UITransition } from "@jsenv/navi";

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

const inlineContent$2 = new __InlineContent__("body {\n  color: #333;\n  background-color: #fff;\n  margin: 0;\n  font-family: system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica Neue, Arial, sans-serif;\n  line-height: 1.5;\n  transition: background-color .3s, color .3s;\n}\n\n* {\n  box-sizing: border-box;\n}\n\n[data-hidden] {\n  display: none !important;\n}\n", {
  type: "text/css"
});
const stylesheet$2 = new CSSStyleSheet({
  baseUrl: "/client/database_manager.css?side_effect"
});
stylesheet$2.replaceSync(inlineContent$2.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$2];

const roleCanLoginCountSignal = v(0);
const setRoleCanLoginCount = count => {
  roleCanLoginCountSignal.value = count;
};
const useRoleCanLoginCount = () => {
  return roleCanLoginCountSignal.value;
};
const roleGroupCountSignal = v(0);
const useRoleGroupCount = () => {
  return roleGroupCountSignal.value;
};
const setRoleGroupCount = count => {
  roleGroupCountSignal.value = count;
};
const roleWithOwnershipCountSignal = v(0);
const useRoleWithOwnershipCount = () => {
  return roleWithOwnershipCountSignal.value;
};
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
const databaseCountSignal = v(0);
const setDatabaseCount = count => {
  databaseCountSignal.value = count;
};
const useDatabaseCount = () => {
  return databaseCountSignal.value;
};
const tableCountSignal = v(0);
const setTableCount = count => {
  tableCountSignal.value = count;
};
const useTableCount = () => {
  return tableCountSignal.value;
};

const Overflow = () => {};
const FontSizedSvg$1 = () => {};
const ExplorerItem = ({
  nameKey,
  item,
  renderItem,
  selectionController,
  deletedItems,
  useItemArrayInStore,
  useRenameItemAction,
  useDeleteItemAction
}) => {
  const itemName = item[nameKey];
  const {
    editing,
    startEditing,
    stopEditing
  } = useEditionController();
  const deleteItemAction = useDeleteItemAction ? useDeleteItemAction(item) : null;
  const itemRendered = renderItem(item, {
    selectionController,
    deletedItems,
    className: "explorer_item_content",
    shortcuts: [{
      key: "enter",
      enabled: !editing,
      action: startEditing,
      description: "Edit item name"
    }, ...(deleteItemAction ? [{
      key: "command+delete",
      action: deleteItemAction,
      description: "Delete item",
      confirmMessage: "Are you sure you want to delete \"".concat(itemName, "\"?")
    }] : [])],
    children: useRenameItemAction ? u(RenameInputOrName, {
      nameKey: nameKey,
      item: item,
      useItemArrayInStore: useItemArrayInStore,
      useRenameItemAction: useRenameItemAction,
      stopEditing: stopEditing
    }) : u(Overflow, {
      children: itemName
    })
  });
  return itemRendered;
};
const RenameInputOrName = ({
  nameKey,
  item,
  useItemArrayInStore,
  useRenameItemAction,
  editing,
  stopEditing
}) => {
  const itemName = item[nameKey];
  const nameSignal = useSignalSync(itemName);
  const renameAction = useRenameItemAction(item, nameSignal);
  const itemArrayInStore = useItemArrayInStore();
  const otherValueSet = new Set();
  for (const itemCandidate of itemArrayInStore) {
    if (itemCandidate === item) {
      continue;
    }
    otherValueSet.add(itemCandidate[nameKey]);
  }
  const availableNameConstraint = createAvailableConstraint(otherValueSet, "\"{value}\" already exist, please choose another name.");
  return u(Editable, {
    editing: editing,
    onEditEnd: stopEditing,
    value: itemName,
    valueSignal: nameSignal,
    action: renameAction,
    required: true,
    constraints: [SINGLE_SPACE_CONSTRAINT, availableNameConstraint],
    children: u(Overflow, {
      children: itemName
    })
  });
};
const ExplorerNewItem = ({
  nameKey,
  useItemArrayInStore,
  useCreateItemAction,
  cancelOnBlurInvalid,
  onCancel,
  onActionEnd
}) => {
  const nameSignal = useSignal("");
  const createItemAction = useCreateItemAction(nameSignal);
  const itemArrayInStore = useItemArrayInStore();
  const valueSet = new Set();
  for (const item of itemArrayInStore) {
    valueSet.add(item[nameKey]);
  }
  const availableNameConstraint = createAvailableConstraint(valueSet, "\"{value}\" already exists. Please choose an other name.");
  return u("span", {
    className: "explorer_item_content",
    children: [u(FontSizedSvg$1, {
      children: u(EnterNameIconSvg, {})
    }), u(Input, {
      action: createItemAction,
      valueSignal: nameSignal,
      cancelOnEscape: true,
      cancelOnBlurInvalid: cancelOnBlurInvalid,
      onCancel: onCancel,
      onActionEnd: onActionEnd,
      autoFocus: true,
      required: true,
      constraints: [SINGLE_SPACE_CONSTRAINT, availableNameConstraint]
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

const ExplorerItemList = M((props, ref) => {
  const {
    idKey,
    nameKey,
    itemArray,
    renderItem,
    useItemArrayInStore,
    useRenameItemAction,
    useDeleteManyItemAction,
    useDeleteItemAction,
    isCreatingNew,
    useCreateItemAction,
    stopCreatingNew
  } = props;
  const innerRef = F();
  T(ref, () => innerRef.current);
  const itemSelectionSignal = useSignal([]);
  const [deletedItems, setDeletedItems] = h([]);
  const deleteManyAction = useDeleteManyItemAction?.(itemSelectionSignal);
  const selection = itemSelectionSignal.value;
  const selectionLength = selection.length;
  const selectionController = useSelectionController({
    elementRef: innerRef,
    layout: "vertical",
    value: selection,
    onChange: newValue => {
      itemSelectionSignal.value = newValue;
    },
    multiple: Boolean(deleteManyAction)
  });
  useKeyboardShortcuts(innerRef, [...createSelectionKeyboardShortcuts(selectionController), {
    enabled: deleteManyAction && selectionLength > 0,
    key: ["command+delete"],
    action: deleteManyAction,
    description: "Delete selected items",
    confirmMessage: selectionLength === 1 ? "Are you sure you want to delete \"".concat(selection[0], "\"?") : "Are you sure you want to delete the ".concat(selectionLength, " selected items?"),
    onStart: () => {
      setDeletedItems(selection);
    },
    onAbort: () => {
      setDeletedItems([]);
    },
    onError: () => {
      setDeletedItems([]);
    },
    onEnd: () => {
      setDeletedItems([]);
    }
  }]);
  return u("ul", {
    ref: innerRef,
    className: "explorer_item_list",
    children: [itemArray.map(item => {
      return u("li", {
        className: "explorer_item",
        children: u(ExplorerItem, {
          nameKey: nameKey,
          item: item,
          deletedItems: deletedItems,
          renderItem: renderItem,
          selectionController: selectionController,
          useItemArrayInStore: useItemArrayInStore,
          useRenameItemAction: useRenameItemAction,
          useDeleteItemAction: deleteManyAction ? () => null : useDeleteItemAction
        })
      }, item[idKey]);
    }), isCreatingNew && u("li", {
      className: "explorer_item",
      children: u(ExplorerNewItem, {
        nameKey: nameKey,
        useItemArrayInStore: useItemArrayInStore,
        useCreateItemAction: useCreateItemAction,
        cancelOnBlurInvalid: true,
        onCancel: (e, reason) => {
          stopCreatingNew({
            shouldRestoreFocus: reason === "escape_key"
          });
        },
        onActionEnd: e => {
          const input = e.target;
          const eventCausingAction = e.detail.event;
          const actionRequestedByKeyboard = eventCausingAction && eventCausingAction.type === "keydown" && eventCausingAction.key === "Enter";
          const shouldRestoreFocus = actionRequestedByKeyboard &&
          // If user focuses something else while action is running, respect it
          document.activeElement === input;
          stopCreatingNew({
            shouldRestoreFocus
          });
        }
      })
    }, "new_item")]
  });
});

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
  const heightSettingSignal = v(restoreHeight());
  m(() => {
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
const ExplorerGroup = M((props, ref) => {
  const {
    controller,
    detailsAction,
    idKey,
    nameKey,
    labelChildren,
    renderNewButtonChildren,
    renderItem,
    useItemArrayInStore,
    useRenameItemAction,
    useCreateItemAction,
    useDeleteItemAction,
    useDeleteManyItemAction,
    onOpen,
    onClose,
    resizable,
    ...rest
  } = props;
  const innerRef = F();
  T(ref, () => innerRef.current);
  A(() => {
    setTimeout(() => {
      innerRef.current.setAttribute("data-details-toggle-animation", "");
    });
  }, []);
  const [isCreatingNew, setIsCreatingNew] = h(false);
  const startCreatingNew = b(() => {
    setIsCreatingNew(true);
  }, [setIsCreatingNew]);
  const stopCreatingNew = b(({
    shouldRestoreFocus
  }) => {
    if (shouldRestoreFocus) {
      createButtonRef.current.focus();
    }
    setIsCreatingNew(false);
  }, [setIsCreatingNew]);
  const heightSetting = controller.useHeightSetting();
  const createButtonRef = F(null);
  return u(k, {
    children: [resizable && u("div", {
      "data-resize-handle": controller.id,
      id: "".concat(controller.id, "_resize_handle")
    }), u(Details, {
      ...rest,
      ref: innerRef,
      id: controller.id,
      open: controller.detailsOpenAtStart,
      focusGroup: true,
      focusGroupDirection: "vertical",
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
      label: u(k, {
        children: [labelChildren, renderNewButtonChildren ? u(k, {
          children: [u("span", {
            style: "display: flex; flex: 1"
          }), u(Button, {
            ref: createButtonRef,
            className: "summary_action_icon",
            discrete: true,
            style: {
              width: "22px",
              height: "22px",
              cursor: "pointer",
              padding: "4px"
            },
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
      }),
      children: itemArray => {
        return u("div", {
          className: "explorer_group_content",
          children: u(ExplorerItemList, {
            idKey: idKey,
            nameKey: nameKey,
            itemArray: itemArray,
            renderItem: renderItem,
            useItemArrayInStore: useItemArrayInStore,
            useRenameItemAction: useRenameItemAction,
            useCreateItemAction: useCreateItemAction,
            useDeleteItemAction: useDeleteItemAction,
            useDeleteManyItemAction: useDeleteManyItemAction,
            isCreatingNew: isCreatingNew,
            stopCreatingNew: stopCreatingNew
          })
        });
      }
    })]
  });
});

const [readDatabaseListDetailsOpened, storeDatabaseListDetailsOpened, eraseDatabaseListDetailsOpened] = valueInLocalStorage("databases_details_opened", {
  type: "boolean"
});
const databaseListDetailsOpenAtStart = readDatabaseListDetailsOpened();
const databaseListDetailsOnToggle = detailsOpen => {
  if (detailsOpen) {
    storeDatabaseListDetailsOpened(true);
  } else {
    eraseDatabaseListDetailsOpened();
  }
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

const SvgIconGroup = ({
  children
}) => {
  return u(SVGMaskOverlay, {
    viewBox: "0 0 24 24",
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

const DatabaseSvg = () => {
  return u("svg", {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: u("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M3.25 6C3.25 4.45831 4.48029 3.26447 6.00774 2.50075C7.58004 1.7146 9.69967 1.25 12 1.25C14.3003 1.25 16.42 1.7146 17.9923 2.50075C19.5197 3.26447 20.75 4.45831 20.75 6V18C20.75 19.5417 19.5197 20.7355 17.9923 21.4992C16.42 22.2854 14.3003 22.75 12 22.75C9.69967 22.75 7.58004 22.2854 6.00774 21.4992C4.48029 20.7355 3.25 19.5417 3.25 18V6ZM4.75 6C4.75 5.33255 5.31057 4.52639 6.67856 3.84239C8.00168 3.18083 9.88205 2.75 12 2.75C14.118 2.75 15.9983 3.18083 17.3214 3.84239C18.6894 4.52639 19.25 5.33255 19.25 6C19.25 6.66745 18.6894 7.47361 17.3214 8.15761C15.9983 8.81917 14.118 9.25 12 9.25C9.88205 9.25 8.00168 8.81917 6.67856 8.15761C5.31057 7.47361 4.75 6.66745 4.75 6ZM4.75 18C4.75 18.6674 5.31057 19.4736 6.67856 20.1576C8.00168 20.8192 9.88205 21.25 12 21.25C14.118 21.25 15.9983 20.8192 17.3214 20.1576C18.6894 19.4736 19.25 18.6674 19.25 18V14.7072C18.8733 15.0077 18.4459 15.2724 17.9923 15.4992C16.42 16.2854 14.3003 16.75 12 16.75C9.69967 16.75 7.58004 16.2854 6.00774 15.4992C5.55414 15.2724 5.12675 15.0077 4.75 14.7072V18ZM19.25 8.70722V12C19.25 12.6674 18.6894 13.4736 17.3214 14.1576C15.9983 14.8192 14.118 15.25 12 15.25C9.88205 15.25 8.00168 14.8192 6.67856 14.1576C5.31057 13.4736 4.75 12.6674 4.75 12V8.70722C5.12675 9.00772 5.55414 9.27245 6.00774 9.49925C7.58004 10.2854 9.69967 10.75 12 10.75C14.3003 10.75 16.42 10.2854 17.9923 9.49925C18.4459 9.27245 18.8733 9.00772 19.25 8.70722Z",
      fill: "currentColor"
    })
  });
};
const DatabaseWithPlusSvg = () => {
  return u(SvgWithPlus, {
    children: u(DatabaseSvg, {})
  });
};

const errorFromResponse = async (response, message) => {
  const status = response.status;
  const statusText = response.statusText;
  const responseContentType = response.headers.get("content-type") || "";
  let serverErrorMessage;
  let serverErrorStack;
  if (responseContentType.includes("application/json")) {
    try {
      const serverResponseJson = await response.json();
      if (typeof serverResponseJson === "string") {
        serverErrorMessage = serverResponseJson;
      } else {
        serverErrorMessage = serverResponseJson.message;
        serverErrorStack = serverResponseJson.stack;
      }
    } catch (_unused) {
      serverErrorMessage = statusText;
    }
  } else {
    const serverResponseText = await response.text();
    if (serverResponseText) {
      serverErrorMessage = serverResponseText;
    } else {
      serverErrorMessage = statusText;
    }
  }
  const errorMessage = message && serverErrorMessage ? "".concat(message, ": ").concat(serverErrorMessage) : message ? message : serverErrorMessage;
  const error = new Error(errorMessage);
  if (serverErrorStack) {
    error.stack = serverErrorStack;
  }
  error.status = status;
  throw error;
};

const DATABASE = resource("database", {
  idKey: "oid",
  mutableIdKeys: ["datname"],
  GET_MANY: async (_, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/databases"), {
      signal
    });
    const {
      data
      // { currentRole }
      // meta,
    } = await response.json();
    return data;
  },
  GET: async ({
    datname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/databases/").concat(datname), {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get database");
    }
    const {
      data,
      meta
    } = await response.json();
    const {
      columns,
      ownerRole
    } = meta;
    return {
      ...data,
      ownerRole,
      meta: {
        columns
      }
    };
  },
  POST: async ({
    datname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/databases"), {
      signal,
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        datname
      })
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to create database");
    }
    const {
      data,
      meta
    } = await response.json();
    const {
      count
    } = meta;
    setDatabaseCount(count);
    return data;
  },
  DELETE: async ({
    datname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/databases/").concat(datname), {
      signal,
      method: "DELETE",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      }
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to delete database");
    }
    const {
      meta
    } = await response.json();
    const {
      count
    } = meta;
    setDatabaseCount(count);
    return {
      datname
    };
  },
  PUT: async ({
    datname,
    columnName,
    columnValue,
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/databases/").concat(datname, "/").concat(columnValue), {
      signal,
      method: "PUT",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(columnValue)
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to update database");
    }
    return ["datname", datname, {
      [columnName]: columnValue
    }];
  }
});
const useDatabaseArrayInStore = DATABASE.useArray;
const useDatabaseArray = () => {
  const databaseArray = useActionData(DATABASE.GET_MANY);
  return databaseArray;
};
const currentDatabaseIdSignal = v(window.DB_MANAGER_CONFIG.currentDatabase.oid);
const useCurrentDatabase = () => {
  const currentDatabaseId = currentDatabaseIdSignal.value;
  const currentDatabase = DATABASE.store.select(currentDatabaseId);
  return currentDatabase;
};

const ROLE = resource("role", {
  idKey: "oid",
  mutableIdKeys: ["rolname"],
  GET_MANY: async ({
    canlogin,
    owners
  }, {
    signal
  }) => {
    const getManyRoleUrl = new URL("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles"));
    if (canlogin !== undefined) {
      getManyRoleUrl.searchParams.set("can_login", canlogin);
    }
    if (owners) {
      getManyRoleUrl.searchParams.set("owners", owners);
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
      meta
    } = await response.json();
    const {
      databases,
      members,
      columns
    } = meta;
    return {
      ...data,
      databases,
      members,
      meta: {
        columns
      }
    };
  },
  POST: async ({
    canlogin,
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
        rolcanlogin: canlogin
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
    return ["rolname", rolname, {
      [columnName]: columnValue
    }];
  }
});
const useRoleArrayInStore = ROLE.useArray;
const ROLE_CAN_LOGIN = ROLE.withParams({
  canlogin: true
});
const ROLE_CANNOT_LOGIN = ROLE.withParams({
  canlogin: false
});
const useRoleCanLoginArray = () => {
  const roleCanLoginArray = useActionData(ROLE_CAN_LOGIN.GET_MANY);
  return roleCanLoginArray;
};
const useRoleCannotLoginArray = () => {
  const roleCannotLoginArray = useActionData(ROLE_CANNOT_LOGIN.GET_MANY);
  return roleCannotLoginArray;
};
const currentRoleIdSignal = v(window.DB_MANAGER_CONFIG.currentRole.oid);
const useCurrentRole = () => {
  const currentRoleId = currentRoleIdSignal.value;
  const currentRole = ROLE.store.select(currentRoleId);
  return currentRole;
};

const TABLE = resource("table", {
  idKey: "tableoid",
  mutableIdKeys: ["tablename"],
  GET_MANY: async (_, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/tables"), {
      signal
    });
    const {
      data
    } = await response.json();
    return data;
  },
  GET: async ({
    tablename
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/tables/").concat(tablename), {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get table");
    }
    const {
      data,
      meta
    } = await response.json();
    const table = data;
    const {
      ownerRole,
      columns,
      schemaColumns
    } = meta;
    return {
      ...table,
      ownerRole,
      meta: {
        columns,
        schemaColumns
      }
    };
  },
  POST: async ({
    tablename
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/tables"), {
      signal,
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        tablename
      })
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to create table");
    }
    const {
      data,
      meta
    } = await response.json();
    const {
      count
    } = meta;
    setTableCount(count);
    return data;
  },
  DELETE: async ({
    tablename
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/tables/").concat(tablename), {
      signal,
      method: "DELETE",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      }
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to delete table");
    }
    const {
      meta
    } = await response.json();
    const {
      count
    } = meta;
    setTableCount(count);
    return {
      tablename
    };
  },
  PUT: async ({
    tablename,
    columnName,
    columnValue,
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/tables/").concat(tablename, "/").concat(columnName), {
      signal,
      method: "PUT",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(columnValue)
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to update table");
    }
    return ["tablename", tablename, {
      [columnName]: columnValue
    }];
  },
  DELETE_MANY: async ({
    tablenames
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/tables"), {
      signal,
      method: "DELETE",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(tablenames)
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to delete table");
    }
    const {
      meta
    } = await response.json();
    const {
      count
    } = meta;
    setTableCount(count);
    return tablenames.map(tablename => ({
      tablename
    }));
  }
});
const useTableArrayInStore = TABLE.useArray;
const useTableArray = () => {
  const tableArray = useActionData(TABLE.GET_MANY);
  return tableArray;
};
const TABLE_ROW = resource("table_row", {
  GET_MANY: async ({
    tablename
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/tables/").concat(tablename, "/rows"), {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get table rows");
    }
    const {
      data
    } = await response.json();
    return data;
  },
  POST: async ({
    tablename
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/tables/").concat(tablename, "/rows"), {
      signal,
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to create row in \"".concat(tablename, "\" table"));
    }
    const {
      data
    } = await response.json();
    return data;
  }
});

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);
let [ROLE_ROUTE, DATABASE_ROUTE, TABLE_ROUTE, TABLE_DATA_ROUTE, TABLE_SETTINGS_ROUTE] = setupRoutes({
  "/roles/:rolname": ROLE.GET,
  "/databases/:datname": DATABASE.GET,
  "/tables/:tablename/*?": TABLE.GET,
  "/tables/:tablename": TABLE_ROW.GET_MANY,
  "/tables/:tablename/settings": createAction(() => {}, {
    name: "get table settings"
  })
});

const LinkWithIcon$3 = props => props;
const DatabaseLink = ({
  database,
  children,
  ...rest
}) => {
  const datname = database.datname;
  const databaseUrl = DATABASE_ROUTE.buildUrl({
    datname
  });
  const {
    params
  } = useRouteStatus(DATABASE_ROUTE);
  const activeDatname = params.datname;
  const currentDatabase = useCurrentDatabase();
  const isCurrent = currentDatabase && datname === currentDatabase.datname;
  return u(LinkWithIcon$3, {
    icon: u(DatabaseSvg, {}),
    isCurrent: isCurrent,
    href: databaseUrl,
    active: activeDatname === datname,
    ...rest,
    children: children
  });
};

const TextAndCount$4 = props => props;
const databasesDetailsController = createExplorerGroupController("databases", {
  detailsOpenAtStart: databaseListDetailsOpenAtStart,
  detailsOnToggle: databaseListDetailsOnToggle
});
const DatabasesDetails = props => {
  const databaseCount = useDatabaseCount();
  const databaseArray = useDatabaseArray();
  return u(ExplorerGroup, {
    ...props,
    controller: databasesDetailsController,
    detailsAction: DATABASE.GET_MANY,
    idKey: "oid",
    nameKey: "datname",
    labelChildren: u(TextAndCount$4, {
      text: "DATABASES",
      count: databaseCount
    }),
    renderNewButtonChildren: () => u(DatabaseWithPlusSvg, {}),
    renderItem: (database, props) => u(DatabaseLink, {
      draggable: false,
      value: database.datname,
      database: database,
      ...props
    }, database.oid),
    useItemArrayInStore: useDatabaseArrayInStore,
    useCreateItemAction: valueSignal => DATABASE.POST({
      datname: valueSignal
    }),
    useDeleteItemAction: database => DATABASE.DELETE.bindParams({
      datname: database.datname
    }),
    useRenameItemAction: (database, valueSignal) => DATABASE.PUT.bindParams({
      datname: database.datname,
      columnName: "datname",
      columnValue: valueSignal
    }),
    children: databaseArray
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
const RoleGroupWithPlusSvg = ({
  color
}) => {
  return u(SvgWithPlus, {
    children: u(RoleGroupSvg, {
      color: color
    })
  });
};

const LinkWithIcon$2 = props => props;
const RoleLink = ({
  role,
  children,
  ...rest
}) => {
  const rolname = role.rolname;
  const roleUrl = ROLE_ROUTE.buildUrl({
    rolname
  });
  const {
    params
  } = useRouteStatus(ROLE_ROUTE);
  const activeRolname = params.rolname;
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && rolname === currentRole.rolname;
  const RoleIcon = pickRoleIcon(role);
  return u(LinkWithIcon$2, {
    icon: u(RoleIcon, {
      color: "#333"
    }),
    isCurrent: isCurrent,
    active: activeRolname === rolname,
    href: roleUrl,
    ...rest,
    children: children
  });
};

const [readRoleCanLoginListDetailsOpened, storeRoleCanLoginListDetailsOpened, eraseRoleCanLoginListDetailsOpened] = valueInLocalStorage("role_can_login_list_details_opened", {
  type: "boolean"
});
const roleCanLoginListDetailsOpenAtStart = readRoleCanLoginListDetailsOpened();
if (roleCanLoginListDetailsOpenAtStart) {
  ROLE_CAN_LOGIN.GET_MANY.prerun(); // et encore c'est seulement si on est sur la bonne page sinon c'est con
}
const roleCanLoginListDetailsOnToggle = detailsOpen => {
  if (detailsOpen) {
    storeRoleCanLoginListDetailsOpened(true);
  } else {
    eraseRoleCanLoginListDetailsOpened();
  }
};

const TextAndCount$3 = props => props;
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
    detailsAction: ROLE_CAN_LOGIN.GET_MANY,
    idKey: "oid",
    nameKey: "rolname",
    labelChildren: u(TextAndCount$3, {
      text: "ROLE LOGINS",
      count: roleCanLoginCount
    }),
    renderNewButtonChildren: () => u(RoleCanLoginWithPlusSvg, {}),
    renderItem: (role, props) => u(RoleLink, {
      draggable: false,
      role: role,
      ...props
    }),
    useItemArrayInStore: useRoleArrayInStore,
    useCreateItemAction: valueSignal => ROLE_CAN_LOGIN.POST.bindParams({
      rolname: valueSignal
    }),
    useDeleteItemAction: role => ROLE_CAN_LOGIN.DELETE.bindParams({
      rolname: role.rolname
    }),
    useRenameItemAction: (role, valueSignal) => ROLE_CAN_LOGIN.PUT.bindParams({
      rolname: role.rolname,
      columnName: "rolname",
      columnValue: valueSignal
    }),
    children: roleCanLoginArray
  });
};

const [readRoleGroupListDetailsOpened, storeRoleGroupListDetailsOpened, eraseRoleGroupListDetailsOpened] = valueInLocalStorage("role_group_list_details_opened", {
  type: "boolean"
});
const roleGroupListDetailsOpenAtStart = readRoleGroupListDetailsOpened();
const roleGroupListDetailsOnToggle = detailsOpen => {
  if (detailsOpen) {
    storeRoleGroupListDetailsOpened(true);
  } else {
    eraseRoleGroupListDetailsOpened();
  }
};

const TextAndCount$2 = props => props;
const roleGroupListDetailsController = createExplorerGroupController("role_group_list", {
  detailsOpenAtStart: roleGroupListDetailsOpenAtStart,
  detailsOnToggle: roleGroupListDetailsOnToggle
});
const RoleGroupListDetails = props => {
  const roleCannotLoginCount = useRoleGroupCount();
  const roleCannotLoginArray = useRoleCannotLoginArray();
  return u(ExplorerGroup, {
    ...props,
    controller: roleGroupListDetailsController,
    detailsAction: ROLE_CANNOT_LOGIN.GET_MANY,
    idKey: "oid",
    nameKey: "rolname",
    labelChildren: u(TextAndCount$2, {
      text: "ROLE GROUPS",
      count: roleCannotLoginCount
    }),
    renderNewButtonChildren: () => u(RoleGroupWithPlusSvg, {}),
    renderItem: (role, {
      children,
      ...props
    }) => u(RoleLink, {
      draggable: false,
      role: role,
      ...props,
      children: children
    }),
    useItemArrayInStore: useRoleArrayInStore,
    useCreateItemAction: valueSignal => ROLE_CANNOT_LOGIN.POST.bindParams({
      rolname: valueSignal
    }),
    useDeleteItemAction: role => ROLE_CANNOT_LOGIN.DELETE.bindParams({
      rolname: role.rolname
    }),
    useRenameItemAction: (role, valueSignal) => ROLE_CANNOT_LOGIN.PUT.bindParams({
      rolname: role.rolname,
      columnName: "rolname",
      columnValue: valueSignal
    }),
    children: roleCannotLoginArray
  });
};

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

const ROLE_WITH_OWNERSHIP = ROLE.withParams({
  owners: true
}, {
  dependencies: [ROLE, DATABASE, TABLE]
});
const useRoleWithOwnershipArray = () => {
  const roleWithOwnershipArray = useActionData(ROLE_WITH_OWNERSHIP.GET_MANY);
  return roleWithOwnershipArray;
};
const ROLE_MEMBERS = ROLE.many("members", ROLE, {
  GET_MANY: async ({
    rolname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles/").concat(rolname, "/members"), {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get members for ".concat(rolname));
    }
    const {
      data
    } = await response.json();
    const members = data;
    return {
      rolname,
      members
    };
  },
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
const ROLE_DATABASES = ROLE.many("databases", DATABASE, {
  GET_MANY: async ({
    rolname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles/").concat(rolname, "/databases"), {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get databases for ".concat(rolname));
    }
    const {
      data
    } = await response.json();
    const databases = data;
    return {
      rolname,
      databases
    };
  }
});
const ROLE_TABLES = ROLE.many("tables", TABLE, {
  GET_MANY: async ({
    rolname
  }, {
    signal
  }) => {
    const response = await fetch("".concat(window.DB_MANAGER_CONFIG.apiUrl, "/roles/").concat(rolname, "/tables"), {
      signal
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get tables for ".concat(rolname));
    }
    const {
      data
    } = await response.json();
    const tables = data;
    return {
      rolname,
      tables
    };
  }
});
DATABASE.one("ownerRole", ROLE);
ROLE.store.upsert(window.DB_MANAGER_CONFIG.currentRole);

// https://www.svgrepo.com/collection/zest-interface-icons/12
// https://flowbite.com/icons/

const TableSvg = ({
  color = "currentColor"
}) => {
  return u("svg", {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    xmlns: "http://www.w3.org/2000/svg",
    children: [u("rect", {
      x: "3",
      y: "4",
      width: "18",
      height: "16",
      rx: "1"
    }), u("line", {
      x1: "3",
      y1: "10",
      x2: "21",
      y2: "10"
    }), u("line", {
      x1: "9",
      y1: "4",
      x2: "9",
      y2: "20"
    }), u("line", {
      x1: "15",
      y1: "4",
      x2: "15",
      y2: "20"
    })]
  });
};
const TableWithPlusSvg = ({
  color
}) => {
  return u(SvgWithPlus, {
    children: u(TableSvg, {
      color: color
    })
  });
};

const LinkWithIcon$1 = props => props;
const TableLink = ({
  table,
  children,
  ...rest
}) => {
  const tablename = table.tablename;
  const tableUrl = TABLE_ROUTE.buildUrl({
    tablename
  });
  const {
    params
  } = useRouteStatus(TABLE_ROUTE);
  const activeTablename = params.tablename;
  return u(LinkWithIcon$1, {
    icon: u(TableSvg, {
      color: "#333"
    }),
    href: tableUrl,
    active: activeTablename === tablename,
    ...rest,
    children: children
  });
};

const [readRoleWithOwnershipListDetailsOpened, storeRoleWithOwnershipListDetailsOpened, eraseRoleWithOwnsershipListDetailsOpened] = valueInLocalStorage("role_with_ownership_list_details_opened", {
  type: "boolean"
});
const roleWithOwnershipListDetailsOpenAtStart = readRoleWithOwnershipListDetailsOpened();
const roleWithOwnershipListDetailsOnToggle = detailsOpen => {
  if (detailsOpen) {
    storeRoleWithOwnershipListDetailsOpened(true);
  } else {
    eraseRoleWithOwnsershipListDetailsOpened();
  }
};

installImportMetaCss(import.meta);const IconAndText$1 = props => props;
const TextAndCount$1 = props => props;
import.meta.css = /* css */"\n  .explorer_details {\n    flex: 1;\n  }\n\n  .explorer_details summary {\n    padding-left: calc(16px + var(--details-depth, 0) * 16px);\n  }\n\n  .explorer_details .explorer_item_content {\n    padding-left: calc(32px + var(--details-depth, 0) * 16px);\n  }\n";
const roleWithOwnershipListDetailsController = createExplorerGroupController("role_with_ownership_list", {
  detailsOpenAtStart: roleWithOwnershipListDetailsOpenAtStart,
  detailsOnToggle: roleWithOwnershipListDetailsOnToggle
});
const RoleWithOwnershipListDetails = props => {
  const roleWithOwnershipCount = useRoleWithOwnershipCount();
  const roleWithOwnershipArray = useRoleWithOwnershipArray();
  return u(ExplorerGroup, {
    ...props,
    controller: roleWithOwnershipListDetailsController,
    detailsAction: ROLE_WITH_OWNERSHIP.GET_MANY,
    idKey: "oid",
    nameKey: "rolname",
    labelChildren: u(TextAndCount$1, {
      text: "OWNERSHIP",
      count: roleWithOwnershipCount
    }),
    renderItem: role => {
      return u(Details, {
        id: "role_".concat(role.rolname, "_ownership_details"),
        className: "explorer_details",
        style: {
          "--details-depth": 0
        },
        label: u(TextAndCount$1, {
          text: u(IconAndText$1, {
            icon: pickRoleIcon(role),
            children: role.rolname
          }),
          count: role.object_count
        }),
        children: u(ExplorerItemList, {
          idKey: "id",
          nameKey: "name",
          itemArray: [...(role.database_count > 0 ? [{
            id: "databases",
            name: "databases",
            item: role
          }] : []), ...(role.table_count > 0 ? [{
            id: "tables",
            name: "tables",
            item: role
          }] : [])],
          renderItem: subitem => {
            if (subitem.id === "tables") {
              return u(Details, {
                id: "role_".concat(role.rolname, "_tables_details"),
                className: "explorer_details",
                style: {
                  "--details-depth": 1
                },
                action: ROLE_TABLES.GET_MANY.bindParams({
                  rolname: role.rolname
                }),
                label: u(TextAndCount$1, {
                  text: "tables",
                  count: role.table_count
                }),
                children: tableArray => {
                  return u(ExplorerItemList, {
                    itemArray: tableArray,
                    renderItem: table => u(TableLink, {
                      className: "explorer_item_content",
                      table: table,
                      children: table.tablename
                    })
                  });
                }
              });
            }
            if (subitem.id === "databases") {
              return u(Details, {
                id: "role_".concat(role.rolname, "_databases_details"),
                className: "explorer_details",
                style: {
                  "--details-depth": 1
                },
                label: u(TextAndCount$1, {
                  text: "databases",
                  count: role.database_count
                }),
                action: ROLE_DATABASES.GET_MANY.bindParams({
                  rolname: role.rolname
                }),
                children: databaseArray => {
                  return u(ExplorerItemList, {
                    itemArray: databaseArray,
                    renderItem: database => u(DatabaseLink, {
                      className: "explorer_item_content",
                      database: database,
                      children: database.datname
                    })
                  });
                }
              });
            }
            return null;
          }
        })
      });
    },
    useItemArrayInStore: useRoleArrayInStore,
    children: roleWithOwnershipArray
  });
};

const [readTableListDetailsOpened, storeTableListDetailsOpened, eraseTableListDetailsOpened] = valueInLocalStorage("table_list_details_opened", {
  type: "boolean",
  default: true
});
const tableListDetailsOpenAtStart = readTableListDetailsOpened();
const tableListDetailsOnToggle = detailsOpen => {
  if (detailsOpen) {
    eraseTableListDetailsOpened();
  } else {
    storeTableListDetailsOpened(false);
  }
};

// const [readTablesDetailsOpened, storeTablesDetailsOpened] = valueInLocalStorage(
//   "table_details_opened",
//   {
//     type: "boolean",
//     default: true,
//   },
// );
// export const TABLES_DETAILS_ROUTE = registerRoute({
//   match: () => readTablesDetailsOpened(),
//   enter: () => {
//     storeTablesDetailsOpened(true);
//   },
//   leave: () => {
//     storeTablesDetailsOpened(false);
//   },
//   load: async () => {
//     const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/tables`);
//     const { data } = await response.json();
//     const tables = data;
//     tableStore.upsert(tables);
//   },
//   name: "tables_details",
// });

const TextAndCount = props => props;
const tablesDetailsController = createExplorerGroupController("tables", {
  detailsOpenAtStart: tableListDetailsOpenAtStart,
  detailsOnToggle: tableListDetailsOnToggle
});
const TablesDetails = props => {
  const tableCount = useTableCount();
  const tableArray = useTableArray();
  return u(ExplorerGroup, {
    ...props,
    controller: tablesDetailsController,
    detailsAction: TABLE.GET_MANY,
    idKey: "oid",
    nameKey: "tablename",
    labelChildren: u(TextAndCount, {
      text: "TABLES",
      count: tableCount
    }),
    renderNewButtonChildren: () => u(TableWithPlusSvg, {}),
    renderItem: (table, props) => u(TableLink, {
      value: table.tablename,
      readOnly: props.deletedItems.includes(table.tablename),
      loading: props.deletedItems.includes(table.tablename),
      table: table,
      draggable: false,
      ...props
    }, table.oid),
    useItemArrayInStore: useTableArrayInStore,
    useCreateItemAction: nameSignal => TABLE.POST.bindParams({
      tablename: nameSignal
    }),
    useRenameItemAction: (table, valueSignal) => TABLE.PUT.bindParams({
      tablename: table.tablename,
      columnName: "tablename",
      columnValue: valueSignal
    }),
    useDeleteItemAction: table => TABLE.DELETE.bindParams({
      tablename: table.tablename
    }),
    useDeleteManyItemAction: itemNamesSignal => TABLE.DELETE_MANY.bindParams({
      tablenames: itemNamesSignal
    }),
    children: tableArray
  });
};

const inlineContent$1 = new __InlineContent__(".explorer {\n  background: #f5f5f5;\n  flex-direction: column;\n  flex: 1;\n  width: 100%;\n  height: 100%;\n  margin-bottom: 20px;\n  display: flex;\n  overflow: auto;\n}\n\n.explorer_head {\n  flex-direction: row;\n  align-items: center;\n  padding-left: 6px;\n  display: flex;\n}\n\n.explorer_head h2 {\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  user-select: none;\n  margin-top: .5em;\n  margin-bottom: .5em;\n  margin-left: 24px;\n  font-size: 16px;\n}\n\n.explorer_body {\n  flex-direction: column;\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  overflow: hidden;\n}\n\n.explorer_group > summary {\n  cursor: pointer;\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  user-select: none;\n  border: 1px solid #0000;\n  border-top-color: #e0e0e0;\n  flex-shrink: 0;\n  font-size: 14px;\n}\n\n.explorer_group:first-of-type > summary {\n  border-top-color: #0000;\n}\n\n.explorer_group > summary:focus {\n  border-color: #00f;\n}\n\n.summary_action_icon {\n  visibility: hidden;\n  pointer-events: none;\n  padding: 0;\n}\n\n.explorer_group[open] .summary_action_icon {\n  visibility: visible;\n  pointer-events: auto;\n}\n\n.summary_label {\n  flex: 1;\n  align-items: center;\n  gap: .2em;\n  padding-right: 10px;\n  display: flex;\n}\n\n.explorer_group > summary .summary_label {\n  font-weight: 500;\n}\n\n.explorer_body > [data-resize-handle] {\n  z-index: 2;\n  opacity: 0;\n  cursor: ns-resize;\n  background-color: #0000;\n  flex-shrink: 0;\n  justify-content: center;\n  align-items: center;\n  width: 100%;\n  height: 5px;\n  margin-top: -2.5px;\n  margin-bottom: -2.5px;\n  transition: background-color .15s, opacity .15s;\n  display: flex;\n  position: relative;\n}\n\n.explorer_body > [data-resize-handle]:hover, .explorer_body > [data-resize-handle][data-active] {\n  opacity: .5;\n  background-color: #00f;\n  transition-delay: .3s;\n}\n\n.explorer_group_content {\n  overscroll-behavior: contain;\n  scrollbar-width: thin;\n  flex: 1;\n  height: 100%;\n  min-height: 0;\n  overflow-y: auto;\n}\n\n.explorer_group[data-size-animated] .explorer_group_content {\n  overflow-y: hidden;\n}\n\n.explorer_item_list {\n  margin-top: 0;\n  margin-bottom: 0;\n  padding-left: 0;\n}\n\n.explorer_item {\n  display: flex;\n}\n\n.explorer_item .navi_link {\n  border-radius: 0;\n}\n\n.explorer_item_content {\n  flex: 1;\n  padding-left: 16px;\n}\n\n.explorer_item input {\n  flex: 1;\n  margin-left: -3.5px;\n  padding-top: .1em;\n  padding-bottom: 0;\n  font-size: 16px;\n}\n\n.explorer_item_content {\n  white-space: nowrap;\n  align-items: center;\n  gap: .3em;\n  min-width: 0;\n  display: flex;\n}\n\n.explorer_foot {\n  height: 10px;\n}\n", {
  type: "text/css"
});
const stylesheet$1 = new CSSStyleSheet({
  baseUrl: "/client/explorer/explorer.css?side_effect"
});
stylesheet$1.replaceSync(inlineContent$1.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$1];

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
      roleCounts,
      databaseCount,
      tableCount
    } = data;
    setRoleCounts(roleCounts);
    setDatabaseCount(databaseCount);
    setTableCount(tableCount);
    return {};
  }
});

const FontSizedSvg = props => props;
const Explorer = () => {
  useRunOnMount(EXPLORER.GET, Explorer);
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
  const flexDetailsSetRef = F();
  const [resizableDetailsIdSet, setResizableDetailsIdSet] = h(new Set());
  A(() => {
    const flexDetailsSet = initFlexDetailsSet(flexDetailsSetRef.current, {
      onResizableDetailsChange: resizableDetailsIdSet => {
        setResizableDetailsIdSet(new Set(resizableDetailsIdSet));
      },
      onRequestedSizeChange: (element, requestedHeight) => {
        if (element.id === tablesDetailsController.id) {
          tablesDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === databasesDetailsController.id) {
          databasesDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === roleCanLoginListDetailsController.id) {
          roleCanLoginListDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === roleGroupListDetailsController.id) {
          roleGroupListDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === roleWithOwnershipListDetailsController.id) {
          roleWithOwnershipListDetailsController.setHeightSetting(requestedHeight);
        }
      }
    });
    return flexDetailsSet.cleanup;
  }, []);
  return u("div", {
    ref: flexDetailsSetRef,
    className: "explorer_body",
    children: [u(RoleCanLoginListDetails, {
      resizable: resizableDetailsIdSet.has(roleCanLoginListDetailsController.id)
    }), u(RoleGroupListDetails, {
      resizable: resizableDetailsIdSet.has(roleGroupListDetailsController.id)
    }), u(DatabasesDetails, {
      resizable: resizableDetailsIdSet.has(databasesDetailsController.id)
    }), u(TablesDetails, {
      resizable: resizableDetailsIdSet.has(tablesDetailsController.id)
    }), u(RoleWithOwnershipListDetails, {
      resizable: resizableDetailsIdSet.has(roleWithOwnershipListDetailsController.id)
    })]
  });
};

/*

 */

const [restoreAsideWidth, storeAsideWidth] = valueInLocalStorage("aside_width", {
  type: "positive_number"
});
const asideWidthSignal = v(restoreAsideWidth());
m(() => {
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
  const asideRef = F(null);
  const widthSetting = useAsideWidth();
  const [resizeWidth, resizeWidthSetter] = h(null);
  const resizeWidthRef = F(resizeWidth);
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
      startDragToResizeGesture(e, {
        onDragStart: gesture => {
          elementToResize = gesture.element;
          widthAtStart = getWidth(elementToResize);
        },
        onDrag: gesture => {
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
        onRelease: () => {
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

const inlineContent = new __InlineContent__("body {\n  scrollbar-gutter: stable;\n  overflow-x: hidden;\n}\n\n#app {\n  flex-direction: row;\n  display: flex;\n}\n\naside {\n  z-index: 1;\n  border-right: 1px solid #e0e0e0;\n  flex-shrink: 0;\n  width: 250px;\n  min-width: 100px;\n  height: 100vh;\n  min-height: 600px;\n  position: -webkit-sticky;\n  position: sticky;\n  top: 0;\n}\n\naside > [data-resize-handle] {\n  z-index: 1;\n  cursor: ew-resize;\n  width: 5px;\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  right: -2.5px;\n}\n\naside > [data-resize-handle]:hover, aside[data-resizing] > [data-resize-handle] {\n  opacity: .5;\n  background-color: #00f;\n}\n\nmain {\n  z-index: 0;\n  box-sizing: border-box;\n  flex: 1;\n  min-width: 200px;\n  min-height: 100vh;\n  padding-bottom: 0;\n  position: relative;\n  overflow-x: auto;\n}\n\n.main_body {\n  flex: 1;\n  min-width: 100%;\n  display: flex;\n}\n", {
  type: "text/css"
});
const stylesheet = new CSSStyleSheet({
  baseUrl: "/client/layout/layout.css?side_effect"
});
stylesheet.replaceSync(inlineContent.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

const DatabaseFieldset = ({
  item,
  columns,
  usePutAction,
  customFields = {},
  ignoredFields = []
}) => {
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  return u("ul", {
    children: columns.map(column => {
      const columnName = column.column_name;
      if (ignoredFields.includes(columnName)) {
        return null;
      }
      const customField = customFields?.[columnName];
      const dbField = customField ? customField(item) : u(DatabaseFieldWrapper, {
        item: item,
        column: column,
        usePutAction: usePutAction
      });
      return u("li", {
        children: dbField
      }, columnName);
    })
  });
};
const RoleField = ({
  role
}) => {
  const [editing, setEditing] = h(false);
  const startEditing = b(() => {
    setEditing(true);
  }, []);
  const stopEditing = b(() => {
    setEditing(false);
  }, []);
  return u(Label, {
    children: ["Owner:", u("div", {
      style: "display: inline-flex; flex-direction: row; gap: 0.5em;",
      children: editing ? u(Form, {
        action: () => {
          // TODO
        },
        onReset: stopEditing,
        children: [u(Select, {
          value: role.rolname,
          children: [{
            label: role.rolname,
            value: role.rolname
          }]
        }), u(Button, {
          type: "submit",
          children: "Validate"
        }), u(Button, {
          type: "reset",
          children: "Cancel"
        })]
      }) : u(k, {
        children: [u(RoleLink, {
          role: role,
          children: role.rolname
        }), u(Button, {
          action: startEditing,
          children: "Change"
        })]
      })
    })]
  });
};
const DatabaseFieldWrapper = ({
  item,
  column,
  usePutAction
}) => {
  const columnName = column.column_name;
  const value = item ? item[columnName] : "";
  const valueSignal = useSignalSync(value);
  const putAction = usePutAction(columnName, valueSignal);
  return u(DatabaseField, {
    label: u("span", {
      children: [columnName, ":"]
    }),
    column: column,
    action: putAction,
    valueSignal: valueSignal
  });
};
const useDatabaseInputProps = ({
  column,
  valueSignal
}) => {
  const columnName = column.column_name;
  if (column.data_type === "boolean") {
    return {
      type: "checkbox",
      name: columnName,
      valueSignal
    };
  }
  if (column.data_type === "timestamp with time zone") {
    return {
      type: "datetime-local",
      name: columnName,
      valueSignal
    };
  }
  if (column.data_type === "integer") {
    return {
      type: "number",
      name: columnName,
      valueSignal,
      min: 0,
      step: 1
    };
  }
  if (column.data_type === "name") {
    return {
      type: "text",
      name: columnName,
      valueSignal,
      required: true
    };
  }
  if (column.data_type === "text") {
    return {
      type: "text",
      name: columnName,
      valueSignal
    };
  }
  if (column.data_type === "oid") {
    return {
      type: "text",
      name: columnName,
      valueSignal,
      readOnly: true
    };
  }
  if (column.column_name === "rolpassword") {
    return {
      type: "text",
      name: columnName,
      valueSignal
    };
  }
  if (column.column_name === "rolconfig") {
    // rolconfig something custom like client_min_messages
    // see https://www.postgresql.org/docs/14/config-setting.html#CONFIG-SETTING-NAMES-VALUES
    return {
      type: "hidden",
      name: columnName,
      valueSignal
    };
  }
  if (column.data_type === "xid") {
    return {
      type: "text",
      valueSignal,
      name: columnName,
      readOnly: true
    };
  }
  if (column.column_name === "datacl") {
    // datacl is a custom type
    // see https://www.postgresql.org/docs/14/sql-grant.html
    return {
      type: "hidden",
      name: columnName,
      valueSignal
    };
  }
  return {
    type: "hidden",
    name: columnName,
    valueSignal
  };
};
const DatabaseInput = ({
  column,
  valueSignal,
  ...rest
}) => {
  const inputProps = useDatabaseInputProps({
    column,
    valueSignal
  });
  return u(Input, {
    ...inputProps,
    ...rest
  });
};
const DatabaseField = ({
  column,
  label,
  ...rest
}) => {
  const columnName = column.column_name;
  if (label === undefined) {
    if (column.data_type === "oid") {
      label = u("span", {
        children: [columnName, ": "]
      });
    } else if (columnName === "rolconfig") {
      label = u("span", {
        children: [columnName, ": "]
      });
    } else {
      label = u("span", {
        children: [columnName, ":"]
      });
    }
  }
  return u(Label, {
    children: [label, u(DatabaseInput, {
      column: column,
      ...rest
    })]
  });
};

installImportMetaCss(import.meta);const IconAndText = props => props;
import.meta.css = /* css */"\n  .page {\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n  }\n\n  .page_head {\n    position: sticky;\n    top: 0;\n    display: flex;\n\n    padding: 20px;\n    flex-direction: column;\n    justify-content: space-between;\n    gap: 10px;\n    background: white;\n\n    background-color: rgb(239, 242, 245);\n    border-bottom: 1px solid rgb(69, 76, 84);\n  }\n\n  .page_head h1 {\n    margin: 0;\n    line-height: 1em;\n  }\n\n  .page_head_with_actions {\n    display: flex;\n    flex-direction: row;\n  }\n\n  .page_head > .actions {\n  }\n\n  .page_body {\n    padding-top: 20px;\n    padding-right: 20px;\n    padding-bottom: 20px;\n    padding-left: 20px;\n  }\n\n  .page_error {\n    margin-top: 0;\n    margin-bottom: 20px;\n    padding: 20px;\n    background: #fdd;\n    border: 1px solid red;\n  }\n";
const Page = ({
  children,
  ...props
}) => {
  const [error, resetError] = O();
  return u(ErrorBoundaryContext.Provider, {
    value: resetError,
    children: [error && u(PageError, {
      error: error
    }), u("div", {
      className: "page",
      ...props,
      children: children
    })]
  });
};
const PageError = ({
  error
}) => {
  return u("div", {
    className: "page_error",
    children: ["An error occured: ", error.message, u("details", {
      children: [u("summary", {
        children: "More info"
      }), u("pre", {
        children: u("code", {
          children: error.stack
        })
      })]
    })]
  });
};
const PageHead = ({
  children,
  spacingBottom,
  ...rest
}) => {
  const headerRef = F(null);
  A(() => {
    return initPositionSticky(headerRef.current);
  }, []);
  return u("header", {
    ref: headerRef,
    className: "page_head",
    style: {
      ...(spacingBottom === undefined ? {} : {
        paddingBottom: "".concat(spacingBottom, "px")
      })
    },
    ...rest,
    children: children
  });
};
const PageHeadLabel = ({
  icon,
  label,
  children,
  actions = []
}) => {
  const title = u("h1", {
    style: "display: flex; align-items: stretch; gap: 0.2em;",
    children: [u(IconAndText, {
      icon: icon,
      style: {
        color: "lightgrey",
        userSelect: "none",
        whiteSpace: "nowrap"
      },
      children: label
    }), u("span", {
      children: children
    })]
  });
  if (actions.length === 0) {
    return title;
  }
  return u("div", {
    className: "page_head_with_actions",
    children: [title, u("div", {
      className: "actions",
      children: actions.map(action => {
        return action.component;
      })
    })]
  });
};
PageHead.Label = PageHeadLabel;
const PageBody = ({
  children
}) => {
  return u("section", {
    className: "page_body",
    children: children
  });
};

const DatabasePage = ({
  database
}) => {
  const datname = database.datname;
  const deleteDatabaseAction = DATABASE.DELETE.bindParams({
    datname
  });
  return u(Page, {
    "data-ui-name": "<DatabasePage />",
    children: [u(PageHead, {
      actions: [{
        component: u(Button, {
          "data-confirm-message": "Are you sure you want to delete the database \"".concat(datname, "\"?"),
          action: deleteDatabaseAction,
          children: "Delete"
        })
      }],
      children: u(PageHead.Label, {
        icon: u(DatabaseSvg, {}),
        label: "Database:",
        children: datname
      })
    }), u(PageBody, {
      children: [u(DatabaseFieldset, {
        item: database,
        columns: database.meta.columns,
        usePutAction: (columnName, valueSignal) => DATABASE.PUT.bindParams({
          datname: database.datname,
          columnName,
          columnValue: valueSignal
        }),
        customFields: {
          datdba: () => {
            const ownerRole = database.ownerRole;
            return u(RoleField, {
              role: ownerRole
            });
          }
        }
      }), u("a", {
        href: "https://www.postgresql.org/docs/14/sql-alterdatabase.html",
        target: "_blank",
        children: "ALTER DATABASE documentation"
      })]
    })]
  });
};

const DatabaseRoutes = () => {
  return u(Route, {
    route: DATABASE_ROUTE,
    children: database => u(DatabasePage, {
      database: database
    })
  });
};

const RoleDatabaseList = ({
  role
}) => {
  const databases = role.databases;
  return u("div", {
    children: [u("h2", {
      children: ["Databases owned by ", role.rolname]
    }), databases.length === 0 ? u("span", {
      children: "No databases"
    }) : u("ul", {
      children: databases.map(database => {
        return u("li", {
          children: u(DatabaseLink, {
            database: database,
            children: database.datname
          })
        }, database.oid);
      })
    })]
  });
};

const RoleCanLoginPage = ({
  role
}) => {
  const rolname = role.rolname;
  const deleteRoleAction = ROLE.DELETE.bindParams({
    rolname
  });
  const RoleIcon = pickRoleIcon(role);
  return u(Page, {
    "data-ui-name": "<RoleCanLoginPage />",
    children: [u(PageHead, {
      actions: [{
        component: u(Button, {
          "data-confirm-message": "Are you sure you want to delete the role \"".concat(rolname, "\"?"),
          action: deleteRoleAction,
          children: "Delete"
        })
      }],
      children: u(PageHead.Label, {
        icon: u(RoleIcon, {}),
        label: "Role Login:",
        children: rolname
      })
    }), u(PageBody, {
      children: [u(DatabaseFieldset, {
        item: role,
        columns: role.meta.columns,
        usePutAction: (columnName, valueSignal) => {
          return ROLE.PUT.bindParams({
            rolname: role.tablename,
            columnName,
            columnValue: valueSignal
          });
        },
        ignoredFields: ["rolcanlogin"]
      }), u(RoleDatabaseList, {
        role: role
      }), u("a", {
        href: "https://www.postgresql.org/docs/current/sql-createrole.html",
        target: "_blank",
        children: "ROLE documentation"
      })]
    })]
  });
};

const RoleGroupMemberList = ({
  role
}) => {
  const memberList = role.members;
  const [navState] = useNavState("group_member_list_opened");
  const [isAdding, isAddingSetter] = h(navState);
  return u("div", {
    children: [u("h2", {
      style: "gap: 10px; display: flex; align-items: center;",
      children: [u("span", {
        children: "Members of this group"
      }), u("div", {
        className: "actions",
        children: u("button", {
          onClick: () => {
            isAddingSetter(prev => !prev);
          },
          children: isAdding ? "Cancel" : "Add"
        })
      })]
    }), isAdding && u("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        background: "lightgrey",
        padding: "10px"
      },
      children: [u("h3", {
        style: {
          display: "flex",
          alignItems: "center",
          margin: "0px",
          gap: "10px"
        },
        children: "Adding member"
      }), u(Form, {
        action: ROLE_MEMBERS.POST.bindParams({
          rolname: role.rolname
        }),
        errorTarget: "input",
        children: [u("label", {
          children: [u("span", {
            children: "Role name: "
          }), u(Input, {
            type: "text",
            id: "membername",
            name: "membername",
            autoFocus: true,
            placeholder: "Role name"
          })]
        }), u(Button, {
          type: "submit",
          children: "Submit"
        })]
      })]
    }), memberList.length === 0 ? u("span", {
      children: "No members"
    }) : u("ul", {
      children: memberList.map(memberRole => {
        return u("li", {
          style: "display: flex; gap: 10px;",
          children: [u(RoleLink, {
            role: memberRole,
            children: memberRole.rolname
          }), u(Button, {
            action: ROLE_MEMBERS.DELETE.bindParams({
              rolname: role.rolname,
              memberRolname: memberRole.rolname
            }),
            children: "Remove"
          })]
        }, memberRole.oid);
      })
    })]
  });
};

const RoleGroupPage = ({
  role
}) => {
  const rolname = role.rolname;
  const deleteRoleAction = ROLE.DELETE.bindParams({
    rolname
  });
  const RoleIcon = pickRoleIcon(role);
  return u(Page, {
    "data-ui-name": "<RoleGroupPage />",
    children: [u(PageHead, {
      actions: [{
        component: u(Button, {
          "data-confirm-message": "Are you sure you want to delete the role \"".concat(rolname, "\"?"),
          action: deleteRoleAction,
          children: "Delete"
        })
      }],
      children: u(PageHead.Label, {
        icon: u(RoleIcon, {}),
        label: "Role Group:",
        children: rolname
      })
    }), u(PageBody, {
      children: [u(DatabaseFieldset, {
        item: role,
        columns: role.meta.columns,
        usePutAction: (columnName, valueSignal) => ROLE.PUT.bindParams({
          rolname: role.tablename,
          columnName,
          columnValue: valueSignal
        }),
        ignoredFields: ["rolcanlogin"]
      }), u(RoleGroupMemberList, {
        role: role
      }), u(RoleDatabaseList, {
        role: role
      }), u("a", {
        href: "https://www.postgresql.org/docs/current/sql-createrole.html",
        target: "_blank",
        children: "ROLE documentation"
      })]
    })]
  });
};

const RolePage = ({
  role
}) => {
  if (role.rolcanlogin) {
    return u(RoleCanLoginPage, {
      role: role
    });
  }
  return u(RoleGroupPage, {
    role: role
  });
};

const RoleRoutes = () => {
  return u(Route, {
    route: ROLE_ROUTE,
    children: role => u(RolePage, {
      role: role
    })
  });
};

const DataSvg = () => {
  return u("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: [u("path", {
      d: "M9 7H7V9H9V7Z",
      fill: "currentColor"
    }), u("path", {
      d: "M7 13V11H9V13H7Z",
      fill: "currentColor"
    }), u("path", {
      d: "M7 15V17H9V15H7Z",
      fill: "currentColor"
    }), u("path", {
      d: "M11 15V17H17V15H11Z",
      fill: "currentColor"
    }), u("path", {
      d: "M17 13V11H11V13H17Z",
      fill: "currentColor"
    }), u("path", {
      d: "M17 7V9H11V7H17Z",
      fill: "currentColor"
    })]
  });
};

const SettingsSvg = () => {
  return u("svg", {
    width: "800px",
    height: "800px",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: [u("circle", {
      cx: "12",
      cy: "12",
      r: "3",
      stroke: "currentColor",
      "stroke-width": "1.5"
    }), u("path", {
      d: "M13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74457 2.35523 9.35522 2.74458 9.15223 3.23463C9.05957 3.45834 9.0233 3.7185 9.00911 4.09799C8.98826 4.65568 8.70226 5.17189 8.21894 5.45093C7.73564 5.72996 7.14559 5.71954 6.65219 5.45876C6.31645 5.2813 6.07301 5.18262 5.83294 5.15102C5.30704 5.08178 4.77518 5.22429 4.35436 5.5472C4.03874 5.78938 3.80577 6.1929 3.33983 6.99993C2.87389 7.80697 2.64092 8.21048 2.58899 8.60491C2.51976 9.1308 2.66227 9.66266 2.98518 10.0835C3.13256 10.2756 3.3397 10.437 3.66119 10.639C4.1338 10.936 4.43789 11.4419 4.43786 12C4.43783 12.5581 4.13375 13.0639 3.66118 13.3608C3.33965 13.5629 3.13248 13.7244 2.98508 13.9165C2.66217 14.3373 2.51966 14.8691 2.5889 15.395C2.64082 15.7894 2.87379 16.193 3.33973 17C3.80568 17.807 4.03865 18.2106 4.35426 18.4527C4.77508 18.7756 5.30694 18.9181 5.83284 18.8489C6.07289 18.8173 6.31632 18.7186 6.65204 18.5412C7.14547 18.2804 7.73556 18.27 8.2189 18.549C8.70224 18.8281 8.98826 19.3443 9.00911 19.9021C9.02331 20.2815 9.05957 20.5417 9.15223 20.7654C9.35522 21.2554 9.74457 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8477 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.902C15.0117 19.3443 15.2977 18.8281 15.781 18.549C16.2643 18.2699 16.8544 18.2804 17.3479 18.5412C17.6836 18.7186 17.927 18.8172 18.167 18.8488C18.6929 18.9181 19.2248 18.7756 19.6456 18.4527C19.9612 18.2105 20.1942 17.807 20.6601 16.9999C21.1261 16.1929 21.3591 15.7894 21.411 15.395C21.4802 14.8691 21.3377 14.3372 21.0148 13.9164C20.8674 13.7243 20.6602 13.5628 20.3387 13.3608C19.8662 13.0639 19.5621 12.558 19.5621 11.9999C19.5621 11.4418 19.8662 10.9361 20.3387 10.6392C20.6603 10.4371 20.8675 10.2757 21.0149 10.0835C21.3378 9.66273 21.4803 9.13087 21.4111 8.60497C21.3592 8.21055 21.1262 7.80703 20.6602 7C20.1943 6.19297 19.9613 5.78945 19.6457 5.54727C19.2249 5.22436 18.693 5.08185 18.1671 5.15109C17.9271 5.18269 17.6837 5.28136 17.3479 5.4588C16.8545 5.71959 16.2644 5.73002 15.7811 5.45096C15.2977 5.17191 15.0117 4.65566 14.9909 4.09794C14.9767 3.71848 14.9404 3.45833 14.8477 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224Z",
      stroke: "currentColor",
      "stroke-width": "1.5"
    })]
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */"\n  .table_data_actions {\n    margin-bottom: 15px;\n  }\n\n  .database_table_cell {\n    padding: 0;\n  }\n\n  .database_table[data-multi-selection] .database_table_cell[data-selected] {\n    background-color: light-dark(\n      rgba(0, 120, 212, 0.08),\n      rgba(59, 130, 246, 0.15)\n    );\n  }\n\n  .database_table_cell:focus {\n    /* Table cell border size impacts the visual appeareance of the outline */\n    /* (It's kinda melted into the table border, as if it was 1.5 px instead of 2) */\n    /* To avoid this we display outline on .database_table_cell_content  */\n    outline: none;\n  }\n\n  .database_table_cell:focus .database_table_cell_content {\n    outline: 2px solid #0078d4;\n    outline-color: light-dark(#355fcc, #3b82f6);\n    outline-offset: -2px;\n  }\n\n  .database_table_cell[data-editing] .database_table_cell_content {\n    outline: 2px solid #a8c7fa;\n    outline-offset: 0px;\n  }\n\n  .database_table_cell_content {\n    display: inline-flex;\n    width: 100%;\n    height: 100%;\n    flex-grow: 1;\n  }\n\n  .database_table_cell_value {\n    display: inline-flex;\n    padding: 8px;\n    flex-grow: 1;\n    user-select: none;\n  }\n\n  .database_table_cell_content input {\n    display: inline-flex;\n    width: 100%;\n    height: 100%;\n    padding-left: 8px;\n    flex-grow: 1;\n    border-radius: 0; /* match table cell border-radius */\n  }\n\n  .database_table_cell_content input[type=\"number\"]::-webkit-inner-spin-button {\n    width: 14px;\n    height: 30px;\n  }\n\n  .database_table *[data-focus-within] {\n    background-color: light-dark(\n      rgba(0, 120, 212, 0.08),\n      rgba(59, 130, 246, 0.15)\n    );\n  }\n";
const DatabaseTableHeaderCell = props => props;
const DatabaseTableCell = props => props;
const TableData = ({
  table,
  rows
}) => {
  const tableRef = F(null);
  const tableName = table.tablename;
  const createRow = TABLE_ROW.POST.bindParams({
    tablename: tableName
  });
  const {
    schemaColumns
  } = table.meta;

  // Stable column definitions - only recreate when schema changes
  const columns = q(() => {
    return schemaColumns.map((column, index) => {
      const columnName = column.column_name;
      const columnIndex = index + 1; // +1 because number column is first

      return {
        enableResizing: true,
        accessorKey: columnName,
        header: ({
          header
        }) => u(DatabaseTableHeaderCell, {
          header: header,
          columnName: columnName,
          columnIndex: columnIndex
        }),
        cell: info => u(DatabaseTableCell, {
          columnName: columnName,
          column: column,
          value: info.getValue(),
          row: info.row
        }),
        footer: info => info.column.id
      };
    });
  }, [schemaColumns]); // Only depend on schema, not dynamic state

  const data = rows;
  const [selection, setSelection] = h([]);
  return u("div", {
    children: [u(Table, {
      ref: tableRef,
      className: "database_table",
      selection: selection,
      onSelectionChange: setSelection,
      idKey: "id",
      columns: columns,
      data: data,
      style: {
        height: "fit-content"
      }
    }), data.length === 0 ? u("div", {
      children: "No data"
    }) : null, u("div", {
      className: "table_data_actions",
      children: u(Button, {
        action: createRow,
        children: "Add row"
      })
    })]
  });
};

const TableSettings = ({
  table
}) => {
  const tablename = table.tablename;
  const deleteTableAction = TABLE.DELETE.bindParams({
    tablename
  });
  return u("div", {
    children: [u(DatabaseFieldset, {
      item: table,
      columns: table.meta.columns,
      usePutAction: (columnName, valueSignal) => TABLE.PUT.bindParams({
        tablename: table.tablename,
        columnName,
        columnValue: valueSignal
      }),
      customFields: {
        tableowner: () => {
          const ownerRole = table.ownerRole;
          return u(RoleField, {
            role: ownerRole
          });
        }
      }
    }), u("a", {
      href: "https://www.postgresql.org/docs/14/ddl-basics.html",
      target: "_blank",
      children: "TABLE documentation"
    }), u("div", {
      children: u("p", {
        children: u(Button, {
          "data-confirm-message": "Are you sure you want to delete the table \"".concat(tablename, "\"?"),
          action: deleteTableAction,
          children: "Delete this table"
        })
      })
    })]
  });
};

/**
 * ce qui me parait le mieux:
 *
 *
 * c'est pas vraiment intéréssant de voir tout les base de données en vrai donc:
 *
 * -> on affiche la base de données courant + un moyen d'en changer
 * -> on affiche les tables de la base de données courante
 * -> un moyen de modifier la base de données courante "chaispascomment"
 *
 * - une icone gear en haut a droite fait apparaitre un menu de réglage dans le header
 * qui permet de renommer la table et modifier ses params genre son owner etc
 *
 * - la page elle se concentre sur l'affiche du contenu de la table
 * on commencera par les colones de la table elle-meme
 * qu'on peut bouger, renommer, supprimer, modifier le type etc
 *
 *
 */

const LinkWithIcon = props => props;
const TablePage = ({
  table
}) => {
  const tablename = table.tablename;
  const tableDataUrl = TABLE_DATA_ROUTE.buildUrl({
    tablename
  });
  const tableSettingUrl = TABLE_SETTINGS_ROUTE.buildUrl({
    tablename
  });
  const {
    matching: tableDataRouteIsMatching
  } = useRouteStatus(TABLE_DATA_ROUTE);
  const {
    matching: tableSettingsRouteIsMatching
  } = useRouteStatus(TABLE_SETTINGS_ROUTE);
  return u(Page, {
    "data-ui-name": "<TablePage />",
    children: [u(PageHead, {
      spacingBottom: 0,
      children: [u(PageHead.Label, {
        icon: u(TableSvg, {}),
        label: "Table:",
        children: tablename
      }), u(TabList, {
        children: [u(Tab, {
          selected: tableDataRouteIsMatching,
          children: u(LinkWithIcon, {
            icon: u(DataSvg, {}),
            href: tableDataUrl,
            "data-no-text-decoration": true,
            children: "Data"
          })
        }), u(Tab, {
          selected: tableSettingsRouteIsMatching,
          children: u(LinkWithIcon, {
            icon: u(SettingsSvg, {}),
            href: tableSettingUrl,
            "data-no-text-decoration": true,
            children: "Settings"
          })
        })]
      })]
    }), u(PageBody, {
      children: u(UITransition, {
        children: [u(Route, {
          route: TABLE_DATA_ROUTE,
          children: rows => u(TableData, {
            table: table,
            rows: rows
          })
        }), u(Route, {
          route: TABLE_SETTINGS_ROUTE,
          children: () => u(TableSettings, {
            table: table
          })
        })]
      })
    })]
  });
};

const TableRoutes = () => {
  return u(Route, {
    route: TABLE_ROUTE,
    children: table => u(TablePage, {
      table: table
    })
  });
};

const MainRoutes = () => {
  return u(UITransition, {
    children: [u(RoleRoutes, {}), u(DatabaseRoutes, {}), u(TableRoutes, {})]
  });
};

const App = () => {
  return u("div", {
    id: "app",
    children: [u(Aside, {
      children: u(Explorer, {})
    }), u("main", {
      children: u("div", {
        className: "main_body",
        children: u(MainRoutes, {})
      })
    })]
  });
};
F$1(u(App, {}), document.querySelector("#root"));
