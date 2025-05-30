import { setBaseUrl, SPACheckbox, SPAInputDateAndTime, SPAInputInteger, SPAInputText, registerRoute, registerAction, Route, useRouteParam, useAction, SPADeleteButton, ErrorBoundaryContext, useRouteUrl, SPALink, valueInLocalStorage, useDetails, useRouteIsMatching } from "@jsenv/router";
import { u, d, b, E, A, k, H, D, F, _, d$1, q, T, E$1 } from "../jsenv_plugin_database_manager_node_modules.js";
import { arraySignalStore, connectStoreAndRoute } from "@jsenv/sigi";
import { useResizeStatus } from "@jsenv/dom";
import "@jsenv/dom/resize";
import "@jsenv/dom/details_content_full_height";
import "@jsenv/dom/details_toggle_animation";
import { useInputConstraint, SINGLE_SPACE_CONSTRAINT } from "@jsenv/form";
import { createTable, getCoreRowModel } from "@tanstack/table-core";

setBaseUrl(new URL("/.internal/database/", window.location.href));

const DatabaseValue = ({
  column,
  ...rest
}) => {
  const columnName = column.column_name;
  if (column.name === "tablename") {
    const {
      value
    } = rest;
    return u(TableNameValue, {
      name: value
    });
  }
  if (column.data_type === "boolean") {
    const {
      value,
      ...props
    } = rest;
    return u(SPACheckbox, {
      name: columnName,
      checked: value,
      ...props
    });
  }
  if (column.data_type === "timestamp with time zone") {
    const props = rest;
    return u(SPAInputDateAndTime, {
      name: columnName,
      ...props
    });
  }
  if (column.data_type === "integer") {
    const props = rest;
    return u(SPAInputInteger, {
      name: columnName,
      ...props
    });
  }
  if (column.data_type === "name") {
    const props = rest;
    return u(SPAInputText, {
      required: true,
      name: columnName,
      ...props
    });
  }
  if (column.data_type === "oid") {
    return u("span", {
      children: [u("span", {
        children: [column.column_name, ": "]
      }), u("span", {
        children: rest.value
      })]
    });
  }
  if (column.column_name === "rolpassword") {
    return u(SPAInputText, {
      name: columnName,
      ...rest
    });
  }
  if (column.column_name === "rolconfig") {
    // rolconfig something custom like client_min_messages
    // see https://www.postgresql.org/docs/14/config-setting.html#CONFIG-SETTING-NAMES-VALUES
    return u("span", {
      children: [u("span", {
        children: [column.column_name, ": "]
      }), u("span", {
        children: String(rest.value)
      })]
    });
  }
  if (column.data_type === "xid") {
    return u(SPAInputText, {
      readOnly: true,
      name: columnName,
      ...rest
    });
  }
  if (column.column_name === "datacl") {
    // datacl is a custom type
    // see https://www.postgresql.org/docs/14/sql-grant.html
    return u("span", {
      children: [u("span", {
        children: [column.column_name, ": "]
      }), u("span", {
        children: String(rest.value)
      })]
    });
  }
  const {
    value
  } = rest;
  return String(value);
};
const TableNameValue = ({
  name
}) => {
  return u("span", {
    children: name
  });
};

const databaseStore = arraySignalStore([], "oid");

const roleStore = arraySignalStore([], "oid");

const useRoleList = () => {
  return roleStore.arraySignal.value;
};
const activeRoleIdSignal = d(null);
const useActiveRole = () => {
  const activeRoleId = activeRoleIdSignal.value;
  const activeRole = roleStore.select(activeRoleId);
  return activeRole;
};
const setActiveRole = role => {
  role = roleStore.upsert(role);
  activeRoleIdSignal.value = role.oid;
};
const activeRoleColumnsSignal = d([]);
const useActiveRoleColumns = () => {
  return activeRoleColumnsSignal.value;
};
const setActiveRoleColumns = value => {
  activeRoleColumnsSignal.value = value;
};
const activeRoleDatabaseIdArraySignal = d([]);
const useActiveRoleDatabases = () => {
  const databaseIdArray = activeRoleDatabaseIdArraySignal.value;
  const databases = databaseStore.selectAll(databaseIdArray);
  return databases;
};
const setActiveRoleDatabases = databases => {
  databaseStore.upsert(databases);
  const databaseIdArray = databases.map(database => database.oid);
  activeRoleDatabaseIdArraySignal.value = databaseIdArray;
};
const currentRoleIdSignal = d(null);
const useCurrentRole = () => {
  const currentRoleId = currentRoleIdSignal.value;
  return roleStore.select(currentRoleId);
};
const setCurrentRole = role => {
  if (role) {
    roleStore.upsert(role);
    currentRoleIdSignal.value = role.oid;
  } else {
    currentRoleIdSignal.value = null;
  }
};

const errorFromResponse = async (response, message) => {
  const serverErrorInfo = await response.json();
  let serverMessage = typeof serverErrorInfo === "string" ? serverErrorInfo : serverErrorInfo.message;
  let errorMessage = message ? "".concat(message, ": ").concat(serverMessage) : serverMessage;
  const error = new Error(errorMessage);
  if (serverErrorInfo && typeof serverErrorInfo === "object") {
    error.stack = serverErrorInfo.stack || serverErrorInfo.message;
  }
  throw error;
};
const GET_ROLE_ROUTE = registerRoute("/roles/:rolname", async ({
  params,
  signal
}) => {
  const rolname = params.rolname;
  const response = await fetch("/.internal/database/api/roles/".concat(rolname), {
    signal
  });
  if (!response.ok) {
    throw await errorFromResponse(response, "Failed to get role");
  }
  const {
    role,
    databases,
    columns
  } = await response.json();
  setActiveRole(role);
  setActiveRoleDatabases(databases);
  setActiveRoleColumns(columns);
});
connectStoreAndRoute(roleStore, GET_ROLE_ROUTE, "rolname");
const PUT_ROLE_ACTION = registerAction(async ({
  rolname,
  columnName,
  formData,
  signal
}) => {
  let value = formData.get(columnName);
  if (columnName === "rolconnlimit") {
    value = parseInt(value, 10);
  }
  const response = await fetch("/.internal/database/api/roles/".concat(rolname, "/").concat(columnName), {
    signal,
    method: "PUT",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(value)
  });
  if (!response.ok) {
    throw await errorFromResponse(response, "Failed to update role");
  }
  roleStore.upsert("rolname", rolname, {
    [columnName]: value
  });
});
const POST_ROLE_ACTION = registerAction(async ({
  signal,
  formData
}) => {
  const rolname = formData.get("rolname");
  const response = await fetch("/.internal/database/api/roles", {
    signal,
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      rolname
    })
  });
  if (!response.ok) {
    throw await errorFromResponse(response, "Failed to create role");
  }
  const role = await response.json();
  roleStore.upsert(role);
});
const DELETE_ROLE_ACTION = registerAction(async ({
  rolname,
  signal
}) => {
  const response = await fetch("/.internal/database/api/roles/".concat(rolname), {
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
  roleStore.drop("rolname", rolname);
});

const useDatabaseList = () => {
  return databaseStore.arraySignal.value;
};
const activeDatabaseIdSignal = d(null);
const activeDatabaseColumnsSignal = d([]);
const activeDatabaseOwnerRoleIdSignal = d(null);
const useActiveDatabase = () => {
  const activeDatabaseId = activeDatabaseIdSignal.value;
  const activeDatabase = databaseStore.select(activeDatabaseId);
  return activeDatabase;
};
const useActiveDatabaseColumns = () => {
  return activeDatabaseColumnsSignal.value;
};
const useActiveDatabaseOwnerRole = () => {
  const ownerRoleId = activeDatabaseOwnerRoleIdSignal.value;
  const ownerRole = roleStore.select(ownerRoleId);
  return ownerRole;
};
const setActiveDatabase = database => {
  if (database) {
    databaseStore.upsert(database);
    activeDatabaseIdSignal.value = database.oid;
  } else {
    activeDatabaseIdSignal.value = null;
  }
};
const setActiveDatabaseColumns = columns => {
  activeDatabaseColumnsSignal.value = columns;
};
const setActiveDatabaseOwnerRole = ownerRole => {
  if (ownerRole) {
    roleStore.upsert(ownerRole);
    activeDatabaseOwnerRoleIdSignal.value = ownerRole.oid;
  } else {
    activeDatabaseOwnerRoleIdSignal.value = null;
  }
};
const currentDatabaseIdSignal = d(null);
const useCurrentDatabase = () => {
  const currentDatabaseId = currentDatabaseIdSignal.value;
  return databaseStore.select(currentDatabaseId);
};
const setCurrentDatabase = database => {
  if (database) {
    databaseStore.upsert(database);
    currentDatabaseIdSignal.value = database.oid;
  } else {
    currentDatabaseIdSignal.value = null;
  }
};

const GET_DATABASE_ROUTE = registerRoute("/databases/:datname", async ({
  params,
  signal
}) => {
  const datname = params.datname;
  const response = await fetch("/.internal/database/api/databases/".concat(datname), {
    signal
  });
  if (!response.ok) {
    const error = await response.json();
    const getError = new Error("Failed to get database: ".concat(error.message));
    getError.stack = error.stack || error.message;
    throw getError;
  }
  const {
    database,
    ownerRole,
    columns
  } = await response.json();
  setActiveDatabase(database);
  setActiveDatabaseColumns(columns);
  setActiveDatabaseOwnerRole(ownerRole);
});
connectStoreAndRoute(databaseStore, GET_DATABASE_ROUTE, "datname");
const POST_DATABASE_ACTION = registerAction(async ({
  signal,
  formData
}) => {
  const datname = formData.get("datname");
  const response = await fetch("/.internal/database/api/databases", {
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
    const error = await response.json();
    const postError = new Error("Failed to create database: ".concat(error.message));
    postError.stack = error.stack || error.message;
    throw postError;
  }
  const database = await response.json();
  databaseStore.upsert(database);
});
const PUT_DATABASE_ACTION = registerAction(async ({
  datname,
  columnName,
  formData,
  signal
}) => {
  let value = formData.get(columnName);
  const response = await fetch("/.internal/database/api/databases/".concat(datname, "/").concat(value), {
    signal,
    method: "PUT",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(value)
  });
  if (!response.ok) {
    const error = await response.json();
    const putError = new Error("Failed to update database: ".concat(error.message));
    putError.stack = error.stack || error.message;
    throw putError;
  }
  roleStore.upsert("datname", datname, {
    [columnName]: value
  });
});
const DELETE_DATABASE_ACTION = registerAction(async ({
  datname,
  signal
}) => {
  const response = await fetch("/.internal/database/api/databases/".concat(datname), {
    signal,
    method: "DELETE",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    }
  });
  if (!response.ok) {
    const error = await response.json();
    const deleteError = new Error("Failed to delete database: ".concat(error.message));
    deleteError.stack = error.stack || error.message;
    throw deleteError;
  }
  roleStore.drop("datname", datname);
});

const DatabaseRoutes = () => {
  return u(Route, {
    route: GET_DATABASE_ROUTE,
    loaded: DatabasePage
  });
};
const DatabasePage = () => {
  const [error, resetError] = b();
  const datname = useRouteParam(GET_DATABASE_ROUTE, "datname");
  const deleteAction = useAction(DELETE_DATABASE_ACTION, {
    datname
  });
  const database = useActiveDatabase();
  return u(ErrorBoundaryContext.Provider, {
    value: resetError,
    children: [error && u(ErrorDetails$1, {
      error: error
    }), u("h1", {
      children: datname
    }), u(DatabaseFields, {
      database: database
    }), u(SPADeleteButton, {
      action: deleteAction,
      children: "Delete"
    }), u("a", {
      href: "https://www.postgresql.org/docs/14/sql-alterdatabase.html",
      target: "_blank",
      children: "ALTER DATABASE documentation"
    })]
  });
};
const ErrorDetails$1 = ({
  error
}) => {
  return u("details", {
    children: [u("summary", {
      children: error.message
    }), u("pre", {
      children: u("code", {
        children: error.stack
      })
    })]
  });
};
const DatabaseFields = ({
  database
}) => {
  const columns = useActiveDatabaseColumns();
  const ownerRole = useActiveDatabaseOwnerRole();
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  return u("ul", {
    children: columns.map(column => {
      const columnName = column.column_name;
      const value = database ? database[columnName] : "";
      const action = useAction(PUT_DATABASE_ACTION, {
        datname: database.datname,
        columnName
      });
      const roleRouteUrl = useRouteUrl(GET_ROLE_ROUTE, {
        rolname: ownerRole.rolname
      });
      if (columnName === "datdba") {
        // we will display this elswhere
        return u(SPALink, {
          href: roleRouteUrl,
          children: ownerRole.rolname
        }, columnName);
      }
      return u("li", {
        children: u(DatabaseValue, {
          label: u("span", {
            children: [columnName, ":"]
          }),
          column: column,
          value: value,
          action: action
        })
      }, columnName);
    })
  });
};

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

const inlineContent$3 = new __InlineContent__("body {\n  scrollbar-gutter: stable;\n  overflow-x: hidden;\n}\n\n#app {\n  flex-direction: row;\n  display: flex;\n}\n\naside {\n  z-index: 0;\n  border-right: 1px solid #e0e0e0;\n  flex-shrink: 0;\n  width: 250px;\n  min-width: 100px;\n  height: 100vh;\n  position: -webkit-sticky;\n  position: sticky;\n  top: 0;\n}\n\naside > [data-resize-handle] {\n  z-index: 1;\n  cursor: ew-resize;\n  width: 5px;\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  right: -2.5px;\n}\n\naside > [data-resize-handle]:hover, aside[data-resizing] > [data-resize-handle] {\n  opacity: .5;\n  background-color: #00f;\n}\n\nmain {\n  box-sizing: border-box;\n  scrollbar-gutter: stable;\n  flex: 1;\n  min-width: 200px;\n  min-height: 100vh;\n  padding-bottom: 0;\n  overflow-x: auto;\n}\n\n.main_body {\n  width: -moz-fit-content;\n  width: fit-content;\n  padding: 20px;\n}\n\nmain h1 {\n  margin-top: 0;\n}\n", {
  type: "text/css"
});
const stylesheet$3 = new CSSStyleSheet();
stylesheet$3.replaceSync(inlineContent$3.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$3];

const inlineContent$2 = new __InlineContent__("body {\n  color: #333;\n  background-color: #fff;\n  margin: 0;\n  font-family: system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica Neue, Arial, sans-serif;\n  line-height: 1.5;\n  transition: background-color .3s, color .3s;\n}\n\n* {\n  box-sizing: border-box;\n}\n\n[data-hidden] {\n  display: none !important;\n}\n", {
  type: "text/css"
});
const stylesheet$2 = new CSSStyleSheet();
stylesheet$2.replaceSync(inlineContent$2.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$2];

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
  const {
    resizing,
    resizeWidth
  } = useResizeStatus(asideRef, {
    as: "number"
  });
  return u("aside", {
    ref: asideRef,
    "data-resize": "horizontal",
    style: {
      width: resizing ? resizeWidth : widthSetting,
      // Disable transition during resize to make it responsive
      transition: resizing ? "none" : undefined
    }
    // eslint-disable-next-line react/no-unknown-property
    ,

    onresizeend: e => {
      setAsideWidth(e.detail.width);
    },
    children: [children, u("div", {
      "data-resize-handle": true
    })]
  });
};

const inlineContent$1 = new __InlineContent__(".explorer {\n  background: #f5f5f5;\n  flex-direction: column;\n  flex: 1;\n  width: 100%;\n  height: 100%;\n  margin-bottom: 20px;\n  display: flex;\n  overflow: auto;\n}\n\n.explorer_head {\n  flex-direction: row;\n  align-items: center;\n  display: flex;\n}\n\n.explorer_head h2 {\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  user-select: none;\n  margin-top: .5em;\n  margin-bottom: .5em;\n  margin-left: 24px;\n  font-size: 16px;\n}\n\n.explorer_body {\n  flex-direction: column;\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  overflow: hidden;\n}\n\n.explorer_group {\n  z-index: 1;\n  flex-direction: column;\n  min-height: 0;\n  display: flex;\n  position: relative;\n  overflow: hidden;\n}\n\n.explorer_group[open] {\n  flex: 1;\n  min-height: 150px;\n}\n\n.explorer_group > summary {\n  cursor: pointer;\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  user-select: none;\n  border: 1px solid #0000;\n  border-top-color: #e0e0e0;\n  flex-direction: column;\n  flex-shrink: 0;\n  font-size: 14px;\n  font-weight: 500;\n  display: flex;\n}\n\n.explorer_group:first-of-type > summary {\n  border-top-color: #0000;\n}\n\n.explorer_group > summary:focus {\n  border-color: #00f;\n}\n\n.summary_body {\n  flex-direction: row;\n  align-items: center;\n  width: 100%;\n  display: flex;\n}\n\n.explorer_group .summary_marker {\n  transform: rotate(-90deg);\n}\n\n.explorer_group[open] .summary_marker {\n  transform: rotate(0);\n}\n\n.summary_action_icon {\n  border: 0;\n  padding: 0;\n  display: none;\n}\n\n.explorer_group[open] .summary_action_icon {\n  display: block;\n}\n\n.summary_action_icon:hover {\n  background: #0000001a;\n}\n\n.summary_label {\n  flex: 1;\n  align-items: center;\n  gap: .2em;\n  padding-right: .5em;\n  display: flex;\n}\n\n.explorer_group + [data-resize-handle] {\n  z-index: 2;\n  cursor: ns-resize;\n  justify-content: center;\n  align-items: center;\n  width: 100%;\n  height: 5px;\n  min-height: 5px;\n  margin-top: -2.5px;\n  margin-bottom: -2.5px;\n  display: flex;\n  position: relative;\n}\n\n.explorer_group + [data-resize-handle]:hover, .explorer_group[data-resizing] + [data-resize-handle] {\n  opacity: .5;\n  background-color: #00f;\n}\n\n.explorer_group + [data-resize-handle]:hover > *, .explorer_group[data-resizing] + [data-resize-handle] > * {\n  background-color: #0000;\n}\n\n.explorer_group_content {\n  scrollbar-gutter: stable;\n  overscroll-behavior: contain;\n  scrollbar-width: thin;\n  flex: 1;\n  height: 100%;\n  min-height: 0;\n  overflow-y: auto;\n}\n\n.explorer_group_list {\n  margin-top: 0;\n  margin-bottom: 0;\n  padding-left: 24px;\n}\n\n.explorer_group_item {\n  display: flex;\n}\n\n.explorer_group_item_content {\n  white-space: nowrap;\n  align-items: center;\n  gap: .3em;\n  min-width: 0;\n  display: flex;\n  overflow: hidden;\n}\n", {
  type: "text/css"
});
const stylesheet$1 = new CSSStyleSheet();
stylesheet$1.replaceSync(inlineContent$1.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet$1];

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

/**
 * SVGComposition Component
 *
 * Creates composite SVGs by combining independent SVG elements with masking.
 *
 * This component solves the challenge of combining independently created SVGs into
 * a single visual composition. Each SVG can have its own coordinate system, viewBox,
 * and styling, allowing for maximum reusability of individual icons or graphics.
 *
 * When overlaying SVGs, each subsequent overlay "cuts out" its portion from the base SVG,
 * creating a seamless integration where SVGs appear to interact with each other visually.
 *
 * Key benefits:
 * - Maintains each SVG's independence - use them individually elsewhere
 * - Handles different viewBox dimensions automatically
 * - Works with any SVG components regardless of internal implementation
 * - Supports unlimited overlay elements
 * - Creates proper masking between elements for visual integration
 *
 * Usage example combining two independent icon components:
 * ```jsx
 * <SVGMaskOverlay viewBox="0 0 24 24">
 *   <DatabaseSvg />
 *   <svg x="12" y="12" width="16" height="16" overflow="visible">
 *     <PlusSvg />
 *   </svg>
 * </SVGMaskOverlay>
 * ```
 *
 * @param {Object} props - Component properties
 * @param {string} props.viewBox - The main viewBox for the composition (required)
 * @param {ReactNode[]} props.children - SVG elements (first is base, rest are overlays)
 * @returns {ReactElement} A composed SVG with all elements properly masked
 */

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

  // Get viewBox from baseSvg
  const baseViewBox = findViewBox(baseSvg);
  if (!baseViewBox) {
    console.error("Could not find viewBox in baseSvg");
    return null;
  }

  // Generate masks for each overlay
  const masks = overlaySvgs.map((overlaySvg, index) => {
    // Get viewBox from current overlay
    const overlayViewBox = findViewBox(overlaySvg);
    if (!overlayViewBox) {
      console.error("Could not find viewBox in overlay SVG at index ".concat(index + 1));
      return null;
    }
    const overlaySvgProps = overlaySvg.props;
    const overlayPosition = {
      x: parseFloat(overlaySvgProps.x || 0),
      y: parseFloat(overlaySvgProps.y || 0),
      width: parseFloat(overlaySvgProps.width || viewBox.split(" ")[2]),
      height: parseFloat(overlaySvgProps.height || viewBox.split(" ")[3])
    };
    const uniqueId = "mask-".concat(index, "-").concat(Math.random().toString(36).slice(2, 9));
    const maskId = "overlay-mask-".concat(uniqueId);
    const secondId = "second-".concat(uniqueId);
    const [,, overlayWidth, overlayHeight] = overlayViewBox.split(" ").map(parseFloat);
    return {
      maskId,
      secondId,
      overlayPosition,
      overlayWidth,
      overlayHeight,
      overlaySvg
    };
  }).filter(mask => mask !== null);

  // Create nested masked elements
  let maskedElement = baseSvg;

  // Apply each mask in sequence
  for (const mask of masks) {
    maskedElement = u("g", {
      mask: "url(#".concat(mask.maskId, ")"),
      children: maskedElement
    });
  }
  return u("svg", {
    viewBox: viewBox,
    width: "100%",
    height: "100%",
    children: [u("defs", {
      children: masks.map(mask => u(k, {
        children: [u("svg", {
          id: mask.secondId,
          children: u("rect", {
            width: "100%",
            height: "100%",
            fill: "black"
          })
        }), u("mask", {
          id: mask.maskId,
          children: [u("rect", {
            width: "100%",
            height: "100%",
            fill: "white"
          }), u("svg", {
            x: mask.overlayPosition.x,
            y: mask.overlayPosition.y,
            width: mask.overlayPosition.width,
            height: mask.overlayPosition.height,
            viewBox: "0 0 ".concat(mask.overlayWidth, " ").concat(mask.overlayHeight),
            overflow: "visible",
            children: u("use", {
              href: "#".concat(mask.secondId)
            })
          })]
        })]
      }))
    }), maskedElement, masks.map(mask => mask.overlaySvg)]
  });
};
const findViewBox = element => {
  if (!element) return null;

  // If it's a function component that returns an SVG
  if (typeof element.type === "function") {
    try {
      // Try to render the component and check its output
      const rendered = element.type(element.props);
      return findViewBox(rendered);
    } catch (e) {
      // Silently fail if render fails
      console.warn("Failed to render component to find viewBox", e);
    }
  }

  // Check if the element itself has a viewBox
  if (element.props && element.props.viewBox) {
    return element.props.viewBox;
  }

  // Check children
  if (element.props && element.props.children) {
    const children = H(element.props.children);

    // Try to find viewBox in any child
    for (const child of children) {
      const childViewBox = findViewBox(child);
      if (childViewBox) {
        return childViewBox;
      }
    }
  }
  return null;
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
      fill: "#1C274C"
    })
  });
};
const DatabaseWithPlusSvg = ({
  color
}) => {
  return u(SVGMaskOverlay, {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    children: [u(DatabaseSvg, {
      color: color
    }), u("svg", {
      x: "12",
      y: "12",
      width: "16",
      height: "16",
      overflow: "visible",
      children: [u("circle", {
        cx: "12",
        cy: "12",
        r: "10",
        fill: "transparent"
      }), u(PlusSvg, {
        color: "green"
      })]
    })]
  });
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
      justifySelf: "center"
    },
    children: children
  });
};

/**
 *
 */

const createExplorerGroupController = id => {
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
    setHeightSetting
  };
};
const ExplorerGroup = D(({
  controller,
  resizable,
  urlParam,
  idKey,
  nameKey,
  children,
  labelChildren,
  ItemComponent,
  createNewButtonChildren,
  useItemList,
  useItemRouteUrl,
  useItemRouteIsActive,
  useRenameItemAction,
  useCreateItemAction,
  useDeleteItemAction,
  onOpen,
  onClose
}, ref) => {
  const innerRef = A();
  F(ref, () => innerRef.current);
  const {
    open,
    onToggle
  } = useDetails(urlParam);
  _(() => {
    setTimeout(() => {
      innerRef.current.setAttribute("data-details-toggle-animation", "");
    });
  }, []);
  const {
    useHeightSetting,
    setHeightSetting
  } = controller;
  const heightSetting = useHeightSetting();
  const {
    resizing,
    resizeHeight
  } = useResizeStatus(innerRef, {
    as: "number"
  });
  const [isCreatingNew, setIsCreatingNew] = d$1(false);
  const startCreatingNew = q(() => {
    setIsCreatingNew(true);
  }, [setIsCreatingNew]);
  const stopCreatingNew = q(() => {
    setIsCreatingNew(false);
  }, [setIsCreatingNew]);
  return u(k, {
    children: [u("details", {
      ref: innerRef,
      id: controller.id,
      className: "explorer_group",
      "data-resize": resizable ? "vertical" : undefined,
      "data-height": resizable ? resizing ? resizeHeight : heightSetting : undefined,
      "data-details-content-full-height": true
      // eslint-disable-next-line react/no-unknown-property
      ,

      onresize: e => {
        setHeightSetting(e.detail.height);
      },
      onToggle: toggleEvent => {
        onToggle(toggleEvent);
        if (toggleEvent.newState === "open") {
          if (onOpen) {
            onOpen();
          }
        } else if (onClose) {
          onClose();
        }
      },
      open: open,
      children: [u("summary", {
        children: u("div", {
          className: "summary_body",
          children: [u("span", {
            className: "summary_marker",
            style: "width: 24px; height: 24px",
            children: u(ArrowDown, {})
          }), u("span", {
            className: "summary_label",
            children: [labelChildren, u("span", {
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
              children: createNewButtonChildren
            })]
          })]
        })
      }), u("div", {
        className: "explorer_group_content",
        children: u("ul", {
          className: "explorer_group_list",
          children: [children.map(item => {
            return u("li", {
              className: "explorer_group_item",
              children: u(ExplorerGroupItem, {
                idKey: idKey,
                nameKey: nameKey,
                item: item,
                ItemComponent: ItemComponent,
                useItemList: useItemList,
                useItemRouteUrl: useItemRouteUrl,
                useItemRouteIsActive: useItemRouteIsActive,
                useRenameItemAction: useRenameItemAction,
                useDeleteItemAction: useDeleteItemAction
              })
            }, item[idKey]);
          }), isCreatingNew && u("li", {
            className: "explorer_group_item",
            children: u(NewItem, {
              nameKey: nameKey,
              useCreateItemAction: useCreateItemAction,
              onCancel: () => {
                // si on a rien rentré on le cré pas, sinon oui on le cré
                stopCreatingNew();
              },
              onSubmitEnd: () => {
                stopCreatingNew();
              }
            })
          })]
        })
      })]
    }), resizable && u("div", {
      "data-resize-handle": controller.id
    })]
  });
});
const ArrowDown = () => {
  return u("svg", {
    viewBox: "0 -960 960 960",
    fill: "currentColor",
    xmlns: "http://www.w3.org/2000/svg",
    children: u("path", {
      d: "M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"
    })
  });
};
const ExplorerGroupItem = ({
  idKey,
  nameKey,
  item,
  ItemComponent,
  useItemList,
  useItemRouteUrl,
  useItemRouteIsActive,
  useRenameItemAction,
  useDeleteItemAction
}) => {
  const itemName = item[nameKey];
  const deleteAction = useDeleteItemAction(item);
  const routeUrl = useItemRouteUrl(item);
  const linkRef = A();
  const [isRenaming, setIsRenaming] = d$1(false);
  const startRenaming = q(() => {
    setIsRenaming(true);
  }, [setIsRenaming]);
  const stopRenaming = q(() => {
    setIsRenaming(false);
  }, [setIsRenaming]);
  const prevIsRenamingRef = A(isRenaming);
  const autoFocus = prevIsRenamingRef.current && !isRenaming;
  prevIsRenamingRef.current = isRenaming;
  return u(SPALink, {
    ref: linkRef,
    href: routeUrl,
    autoFocus: autoFocus,
    className: "explorer_group_item_content",
    deleteShortcutAction: deleteAction,
    deleteShortcutConfirmContent: "Are you sure you want to delete \"".concat(itemName, "\"?"),
    onKeydown: e => {
      if (e.key === "Enter" && !isRenaming) {
        e.preventDefault();
        e.stopPropagation();
        startRenaming();
      }
    },
    children: [u(ItemComponent, {
      item: item
    }), u(ItemNameOrRenameInput, {
      nameKey: nameKey,
      item: item,
      useItemList: useItemList,
      useItemRouteUrl: useItemRouteUrl,
      useItemRouteIsActive: useItemRouteIsActive,
      useRenameItemAction: useRenameItemAction,
      isRenaming: isRenaming,
      stopRenaming: stopRenaming
    })]
  }, item[idKey]);
};
const ItemNameOrRenameInput = ({
  nameKey,
  item,
  useItemList,
  useItemRouteIsActive,
  useRenameItemAction,
  isRenaming,
  stopRenaming
}) => {
  const itemName = item[nameKey];
  const itemRouteIsActive = useItemRouteIsActive(item);
  if (isRenaming) {
    return u(ItemRenameInput, {
      nameKey: nameKey,
      item: item,
      useItemList: useItemList,
      useRenameItemAction: useRenameItemAction,
      stopRenaming: stopRenaming
    });
  }
  return u("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      background: itemRouteIsActive ? "lightgrey" : "none"
    },
    children: itemName
  });
};
const ItemRenameInput = ({
  nameKey,
  item,
  useItemList,
  useRenameItemAction,
  stopRenaming
}) => {
  const itemList = useItemList();
  const renameAction = useRenameItemAction(item);
  const itemName = item[nameKey];
  const inputRef = A();
  const otherNameSet = new Set();
  for (const itemCandidate of itemList) {
    if (itemCandidate === item) {
      continue;
    }
    otherNameSet.add(itemCandidate[nameKey]);
  }
  useInputConstraint(inputRef, input => {
    const inputValue = input.value;
    const hasConflict = otherNameSet.has(inputValue);
    // console.log({
    //   inputValue,
    //   names: Array.from(otherNameSet.values()),
    //   hasConflict,
    // });
    if (hasConflict) {
      return "\"".concat(inputValue, "\" already exists. Please choose another name.");
    }
    return "";
  });
  useInputConstraint(inputRef, SINGLE_SPACE_CONSTRAINT);
  return u(SPAInputText, {
    ref: inputRef,
    name: nameKey,
    autoFocus: true,
    autoSelect: true,
    required: true,
    value: itemName,
    action: renameAction,
    onCancel: () => {
      stopRenaming();
    },
    onSubmitEnd: () => {
      stopRenaming();
    },
    onBlur: e => {
      if (e.target.value === itemName) {
        stopRenaming();
      }
    }
  });
};
const NewItem = ({
  nameKey,
  useCreateItemAction,
  ...rest
}) => {
  const action = useCreateItemAction();
  return u("span", {
    className: "explorer_group_item_content",
    children: [u(FontSizedSvg, {
      children: u(EnterNameIconSvg, {})
    }), u(SPAInputText, {
      name: nameKey,
      action: action,
      autoFocus: true,
      required: true,
      ...rest
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

const databaseExplorerGroupController = createExplorerGroupController("databases");
const ExplorerDatabases = props => {
  const databases = useDatabaseList();
  return u(ExplorerGroup, {
    ...props,
    controller: databaseExplorerGroupController,
    urlParam: "databases",
    idKey: "oid",
    nameKey: "datname",
    labelChildren: u("span", {
      style: "display: flex; align-items: center; gap: 3px",
      children: ["DATABASES", u("span", {
        style: "color: rgba(28, 43, 52, 0.4)",
        children: ["(", databases.length, ")"]
      })]
    }),
    createNewButtonChildren: u(DatabaseWithPlusSvg, {}),
    ItemComponent: DatabaseItem,
    useItemList: useDatabaseList,
    useItemRouteUrl: database => useRouteUrl(GET_DATABASE_ROUTE, {
      datname: database.datname
    }),
    useItemRouteIsActive: database => useRouteIsMatching(GET_DATABASE_ROUTE, {
      datname: database.datname
    }),
    useRenameItemAction: database => useAction(PUT_DATABASE_ACTION, {
      datname: database.datname,
      columnName: "datname"
    }),
    useCreateItemAction: () => useAction(POST_DATABASE_ACTION),
    useDeleteItemAction: database => useAction(DELETE_DATABASE_ACTION, {
      datname: database.datname
    }),
    children: databases
  });
};
const DatabaseItem = ({
  item: database
}) => {
  const currentDatabase = useCurrentDatabase();
  const isCurrent = currentDatabase && database.datname === currentDatabase.datname;
  return u(k, {
    children: [u(FontSizedSvg, {
      children: u(DatabaseSvg, {
        color: "#333"
      })
    }), isCurrent ? u(FontSizedSvg, {
      children: u(CurrentSvg, {})
    }) : null]
  });
};

// https://www.svgrepo.com/collection/zest-interface-icons/12
// https://flowbite.com/icons/

const UserSvg = ({
  color = "currentColor"
}) => {
  return u("svg", {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: u("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M8 9C8 6.79086 9.79086 5 12 5C14.2091 5 16 6.79086 16 9C16 11.2091 14.2091 13 12 13C9.79086 13 8 11.2091 8 9ZM15.8243 13.6235C17.1533 12.523 18 10.8604 18 9C18 5.68629 15.3137 3 12 3C8.68629 3 6 5.68629 6 9C6 10.8604 6.84668 12.523 8.17572 13.6235C4.98421 14.7459 3 17.2474 3 20C3 20.5523 3.44772 21 4 21C4.55228 21 5 20.5523 5 20C5 17.7306 7.3553 15 12 15C16.6447 15 19 17.7306 19 20C19 20.5523 19.4477 21 20 21C20.5523 21 21 20.5523 21 20C21 17.2474 19.0158 14.7459 15.8243 13.6235Z",
      fill: color
    })
  });
};
const UserWithPlusSvg = ({
  color
}) => {
  return u(SVGMaskOverlay, {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    children: [u(UserSvg, {
      color: color
    }), u("svg", {
      x: "12",
      y: "12",
      width: "16",
      height: "16",
      overflow: "visible",
      children: [u("circle", {
        cx: "12",
        cy: "12",
        r: "10",
        fill: "transparent"
      }), u(PlusSvg, {
        color: "green"
      })]
    })]
  });
};
const UserWithCheckSvg = ({
  color = "currentColor"
}) => {
  return u("svg", {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: u("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M10 5C8.34315 5 7 6.34315 7 8C7 9.65685 8.34315 11 10 11C11.6569 11 13 9.65685 13 8C13 6.34315 11.6569 5 10 5ZM13.5058 11.565C14.4281 10.6579 15 9.39576 15 8C15 5.23858 12.7614 3 10 3C7.23858 3 5 5.23858 5 8C5 9.39827 5.57396 10.6625 6.49914 11.5699C3.74942 12.5366 2 14.6259 2 17C2 17.5523 2.44772 18 3 18C3.55228 18 4 17.5523 4 17C4 15.2701 5.93073 13 10 13C12.6152 13 14.4051 13.9719 15.2988 15.1157C15.6389 15.5509 16.2673 15.628 16.7025 15.288C17.1377 14.9479 17.2148 14.3195 16.8748 13.8843C16.0904 12.8804 14.9401 12.0686 13.5058 11.565ZM22.6139 15.2106C23.0499 15.5497 23.1284 16.178 22.7894 16.6139L18.1227 22.6139C17.9485 22.8379 17.6875 22.9773 17.4045 22.9975C17.1216 23.0177 16.8434 22.9167 16.6392 22.7198L14.3059 20.4698C13.9083 20.0865 13.8968 19.4534 14.2802 19.0559C14.6635 18.6583 15.2966 18.6468 15.6941 19.0302L17.2268 20.5081L21.2106 15.3861C21.5497 14.9501 22.178 14.8716 22.6139 15.2106Z",
      fill: color
    })
  });
};
const UserWithHatSvg = ({
  color = "currentColor"
}) => {
  return u("svg", {
    viewBox: "0 0 24 24",
    width: "100%",
    height: "100%",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: u("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M12.4472 1.10557C12.1657 0.964809 11.8343 0.964809 11.5528 1.10557L4.55279 4.60557C4.214 4.77496 4 5.12123 4 5.5C4 5.87877 4.214 6.22504 4.55279 6.39443L6.58603 7.41105C6.21046 8.19525 6 9.07373 6 10C6 11.8604 6.84668 13.523 8.17572 14.6235C4.98421 15.7459 3 18.2474 3 21C3 21.5523 3.44772 22 4 22C4.55228 22 5 21.5523 5 21C5 18.7306 7.3553 16 12 16C16.6447 16 19 18.7306 19 21C19 21.5523 19.4477 22 20 22C20.5523 22 21 21.5523 21 21C21 18.2474 19.0158 15.7459 15.8243 14.6235C17.1533 13.523 18 11.8604 18 10C18 9.07373 17.7895 8.19525 17.414 7.41105L19.4472 6.39443C19.786 6.22504 20 5.87877 20 5.5C20 5.12123 19.786 4.77496 19.4472 4.60557L12.4472 1.10557ZM12 14C14.2091 14 16 12.2091 16 10C16 9.39352 15.8656 8.81975 15.6248 8.30566L12.4472 9.89443C12.1657 10.0352 11.8343 10.0352 11.5528 9.89443L8.37525 8.30566C8.13443 8.81975 8 9.39352 8 10C8 12.2091 9.79086 14 12 14ZM8.44695 6.10544L7.23607 5.5L12 3.11803L16.7639 5.5L15.5531 6.10544L12 7.88197L8.44695 6.10544Z",
      fill: color
    })
  });
};

const rolesExplorerGroupController = createExplorerGroupController("roles");
const ExplorerRoles = props => {
  const roles = useRoleList();
  return u(ExplorerGroup, {
    ...props,
    controller: rolesExplorerGroupController,
    urlParam: "roles",
    idKey: "oid",
    nameKey: "rolname",
    labelChildren: u("span", {
      style: "display: flex; align-items: center; gap: 3px",
      children: ["ROLES", u("span", {
        style: "color: rgba(28, 43, 52, 0.4)",
        children: ["(", roles.length, ")"]
      })]
    }),
    createNewButtonChildren: u(UserWithPlusSvg, {}),
    ItemComponent: RoleItem,
    useItemList: useRoleList,
    useItemRouteUrl: role => useRouteUrl(GET_ROLE_ROUTE, {
      rolname: role.rolname
    }),
    useItemRouteIsActive: role => useRouteIsMatching(GET_ROLE_ROUTE, {
      rolname: role.rolname
    }),
    useRenameItemAction: role => useAction(PUT_ROLE_ACTION, {
      rolname: role.rolname,
      columnName: "rolname"
    }),
    useCreateItemAction: () => useAction(POST_ROLE_ACTION),
    useDeleteItemAction: role => useAction(DELETE_ROLE_ACTION, {
      rolname: role.rolname
    }),
    children: roles
  });
};
const RoleItem = ({
  item: role
}) => {
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && role.rolname === currentRole.rolname;
  return u(k, {
    children: [u(FontSizedSvg, {
      children: role.rolname.startsWith("pg_") ? u(UserWithCheckSvg, {
        color: "#333"
      }) : role.rolsuper ? u(UserWithHatSvg, {
        color: "#333"
      }) : u(UserSvg, {
        color: "#333"
      })
    }), isCurrent ? u(FontSizedSvg, {
      children: u(CurrentSvg, {})
    }) : null]
  });
};

/**
 * each section should have its own scrollbar
 * right now it does not work, the content is not scrollable and gets hidden
 */

E(async () => {
  const response = await fetch("/.internal/database/api/nav");
  const {
    currentRole,
    roles,
    currentDatabase,
    databases
  } = await response.json();
  setCurrentRole(currentRole);
  setCurrentDatabase(currentDatabase);
  databaseStore.upsert(databases);
  roleStore.upsert(roles);
});
const Explorer = () => {
  return u("nav", {
    className: "explorer",
    children: [u("div", {
      className: "explorer_head",
      children: u("h2", {
        children: "Explorer"
      })
    }), u(ExplorerBody, {})]
  });
};
const ExplorerBody = () => {
  const [detailsOpenCount, setDetailsOpenCount] = d$1(0);
  const resizable = detailsOpenCount > 1;
  const onOpen = q(() => {
    setDetailsOpenCount(count => count + 1);
  }, []);
  const onClose = q(() => {
    setDetailsOpenCount(count => count - 1);
  }, []);

  // first thing: I need to repartir la hauteur aux groupes ouvert
  // si plus d'un groupe est ouvert alors on peut les resize

  return u("div", {
    className: "explorer_body",
    onToggle: toggleEvent => {
      if (toggleEvent.newState === "open") {
        setDetailsOpenCount(count => count + 1);
      } else {
        setDetailsOpenCount(count => count - 1);
      }
    },
    children: [u(ExplorerDatabases, {
      onOpen: onOpen,
      onClose: onClose,
      resizable: resizable
    }), u(ExplorerRoles, {
      onOpen: onOpen,
      onClose: onClose,
      resizable: false
    })]
  });
};

const RoleRoutes = () => {
  return u(Route, {
    route: GET_ROLE_ROUTE,
    loaded: RolePage
  });
};
const RolePage = () => {
  const [error, resetError] = b();
  const rolname = useRouteParam(GET_ROLE_ROUTE, "rolname");
  const deleteRoleAction = useAction(DELETE_ROLE_ACTION, {
    rolname
  });
  const role = useActiveRole();
  return u(ErrorBoundaryContext.Provider, {
    value: resetError,
    children: [error && u(ErrorDetails, {
      error: error
    }), u("h1", {
      children: rolname
    }), u(RoleFields, {
      role: role
    }), u(RoleDatabases, {}), u(SPADeleteButton, {
      action: deleteRoleAction,
      children: "Delete"
    }), u("a", {
      href: "https://www.postgresql.org/docs/14/sql-alterrole.html",
      target: "_blank",
      children: "ALTER ROLE documentation"
    })]
  });
};
const ErrorDetails = ({
  error
}) => {
  return u("details", {
    children: [u("summary", {
      children: error.message
    }), u("pre", {
      children: u("code", {
        children: error.stack
      })
    })]
  });
};
const RoleFields = ({
  role
}) => {
  const columns = useActiveRoleColumns();
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const fields = columns.map(column => {
    const columnName = column.column_name;
    const value = role ? role[columnName] : "";
    return {
      column,
      value
    };
  });
  return u("ul", {
    children: fields.map(({
      column,
      value
    }) => {
      const columnName = column.column_name;
      const action = useAction(PUT_ROLE_ACTION, {
        rolname: role.rolname,
        columnName
      });
      return u("li", {
        children: u(DatabaseValue, {
          label: u("span", {
            children: [columnName, ":"]
          }),
          column: column,
          value: value,
          action: action
        })
      }, columnName);
    })
  });
};
const RoleDatabases = () => {
  const databases = useActiveRoleDatabases();
  return u("div", {
    children: [u("h2", {
      children: "Databases"
    }), u("ul", {
      children: databases.map(database => {
        const datname = database.datname;
        const databaseRouteUrl = useRouteUrl(GET_DATABASE_ROUTE, {
          datname
        });
        return u("li", {
          children: u(SPALink, {
            href: databaseRouteUrl,
            children: datname
          })
        }, datname);
      })
    })]
  });
};

const inlineContent = new __InlineContent__("table {\n  border-spacing: 0;\n  border: 1px solid #000;\n}\n\ntr:last-child td {\n  border-bottom: 0;\n}\n\nth, td {\n  border-bottom: 1px solid #000;\n  border-right: 1px solid #000;\n  margin: 0;\n  padding: .5rem;\n}\n\nth:last-child, td:last-child {\n  border-right: 0;\n}\n", {
  type: "text/css"
});
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

// see https://github.com/TanStack/table/blob/main/packages/react-table/src/index.tsx

const useTable = options => {
  // Compose in the generic options to the user options
  const resolvedOptions = {
    state: {},
    // Dummy state
    onStateChange: () => {},
    // noop
    renderFallbackValue: null,
    ...options
  };
  // Create a new table and store it in state
  const [tableRef] = d$1(() => ({
    current: createTable(resolvedOptions)
  }));

  // By default, manage table state here using the table's initial state
  const [state, setState] = d$1(() => tableRef.current.initialState);

  // Compose the default state above with any user state. This will allow the user
  // to only control a subset of the state if desired.
  tableRef.current.setOptions(prev => ({
    ...prev,
    ...options,
    state: {
      ...state,
      ...options.state
    },
    // Similarly, we'll maintain both our internal state and any user-provided
    // state.
    onStateChange: updater => {
      setState(updater);
      options.onStateChange?.(updater);
    }
  }));
  return tableRef.current;
};

/**
 *
 *  https://tanstack.com/table/v8/docs/framework/react/examples/basic
 */

const Table = ({
  columns,
  data
}) => {
  const extraColumns = T(() => getExtraColumns(columns, data), [columns, data]);
  const {
    getHeaderGroups,
    getRowModel
    // getFooterGroups
  } = useTable({
    columns: extraColumns ? [...columns, ...extraColumns] : columns,
    data,
    getCoreRowModel: getCoreRowModel()
  });
  return u("table", {
    children: [u("thead", {
      children: getHeaderGroups().map(headerGroup => u("tr", {
        children: headerGroup.headers.map(header => u("th", {
          children: header.isPlaceholder ? null : u(header.column.columnDef.header, {
            ...header.getContext()
          })
        }, header.id))
      }, headerGroup.id))
    }), u(TableBody, {
      rows: getRowModel().rows
    })]
  });
};
const getExtraColumns = (columns, values) => {
  const columnSet = new Set();
  for (const {
    accessor
  } of columns) {
    if (typeof accessor !== "string") {
      // when an accessor is not a string we can't detect extra columns
      // because accessor might be refering to a nested property or a propery we might
      // detect as extra but is not
      return null;
    }
    columnSet.add(accessor);
  }
  const extraColumnSet = new Set();
  for (const value of values) {
    if (value && typeof value === "object") {
      for (const key in Object.keys(value)) {
        if (columnSet.has(key)) {
          continue;
        }
        if (extraColumnSet.has(key)) {
          continue;
        }
        extraColumnSet.add(key);
      }
    }
  }
  if (extraColumnSet.size === 0) {
    return null;
  }
  const extraColumns = [];
  for (const extraColumnKey of extraColumnSet) {
    const extraColumn = {
      accessor: extraColumnKey,
      id: extraColumnKey,
      cell: info => info.getValue(),
      header: () => u("span", {
        children: extraColumnKey
      }),
      footer: info => info.column.id
    };
    extraColumns.push(extraColumn);
  }
  return extraColumns;
};
const TableBody = ({
  rows
}) => {
  return u("tbody", {
    children: rows.map(row => u(TableBodyRow, {
      cells: row.getVisibleCells()
    }, row.id))
  });
};
const TableBodyRow = ({
  cells
}) => {
  return u("tr", {
    children: cells.map(cell => u(TableBodyCell, {
      cell: cell
    }, cell.id))
  });
};
const TableBodyCell = ({
  cell
}) => {
  const CellComponent = cell.column.columnDef.cell;
  const cellProps = cell.getContext();
  return u("td", {
    children: u(CellComponent, {
      ...cellProps
    })
  });
};

const DatabaseTable = ({
  columns,
  action,
  data
}) => {
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const tableColumns = columns.map(column => {
    const columnName = column.column_name;
    return {
      accessorKey: columnName,
      header: () => u("span", {
        children: columnName
      }),
      cell: info => {
        const value = info.getValue();
        const tableName = info.row.original.tablename;
        return u(DatabaseValue, {
          tableName: tableName,
          column: column,
          action: useAction(action, {
            tableName,
            columnName
          }),
          value: value
        });
      },
      footer: info => info.column.id
    };
  });
  return u(Table, {
    columns: tableColumns,
    data: data
  });
};

const tablePublicFilterSignal = d(false);
const tableInfoSignal = d({
  columns: [],
  data: []
});

const GET_TABLES_ROUTE = registerRoute("/tables", async ({
  signal
}) => {
  const tablePublicFilter = tablePublicFilterSignal.value;
  const response = await fetch("/.internal/database/api/tables?public=".concat(tablePublicFilter), {
    signal
  });
  const tables = await response.json();
  tableInfoSignal.value = tables;
});
const UPDATE_TABLE_ACTION = registerAction(async ({
  tableName,
  columnName,
  formData
}) => {
  const value = formData.get("value");
  await fetch("/.internal/database/api/tables/".concat(tableName, "/").concat(columnName), {
    method: "PUT",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(value)
  });
  const {
    data,
    ...rest
  } = tableInfoSignal.value;
  const tableClient = data.find(table => table.tablename === tableName);
  if (tableClient) {
    tableClient[columnName] = value;
    tableInfoSignal.value = {
      ...rest,
      data: [...data]
    };
  }
});

const TableRoutes = () => {
  return u(Route, {
    route: GET_TABLES_ROUTE,
    loaded: TablePage
  });
};
const TablePage = () => {
  const tablePublicFilter = tablePublicFilterSignal.value;
  const {
    columns,
    data
  } = tableInfoSignal.value;
  return u(k, {
    children: [u(DatabaseTable, {
      column: columns,
      data: data,
      action: UPDATE_TABLE_ACTION
    }), u("form", {
      children: u("label", {
        children: [u("input", {
          type: "checkbox",
          checked: tablePublicFilter,
          onChange: e => {
            if (e.target.checked) {
              tablePublicFilterSignal.value = true;
            } else {
              tablePublicFilterSignal.value = false;
            }
          }
        }), "Public"]
      })
    })]
  });
};

// organize-imports-ignore
const App = () => {
  return u("div", {
    id: "app",
    children: [u(Aside, {
      children: u(Explorer, {})
    }), u("main", {
      children: u("div", {
        className: "main_body",
        children: [u(RoleRoutes, {}), u(DatabaseRoutes, {}), u(TableRoutes, {})]
      })
    })]
  });
};
E$1(u(App, {}), document.querySelector("#root"));
