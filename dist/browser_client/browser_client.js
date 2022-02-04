(function () {
'use strict';
const fetchUsingXHR = async (url, {
  signal,
  method = "GET",
  credentials = "same-origin",
  headers = {},
  body = null
} = {}) => {
  const headersPromise = createPromiseAndHooks();
  const bodyPromise = createPromiseAndHooks();
  const xhr = new XMLHttpRequest();

  const failure = error => {
    // if it was already resolved, we must reject the body promise
    if (headersPromise.settled) {
      bodyPromise.reject(error);
    } else {
      headersPromise.reject(error);
    }
  };

  const cleanup = () => {
    xhr.ontimeout = null;
    xhr.onerror = null;
    xhr.onload = null;
    xhr.onreadystatechange = null;
  };

  xhr.ontimeout = () => {
    cleanup();
    failure(new Error(`xhr request timeout on ${url}.`));
  };

  xhr.onerror = error => {
    cleanup(); // unfortunately with have no clue why it fails
    // might be cors for instance

    failure(createRequestError(error, {
      url
    }));
  };

  xhr.onload = () => {
    cleanup();
    bodyPromise.resolve();
  };

  signal.addEventListener("abort", () => {
    xhr.abort();
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    failure(abortError);
  });

  xhr.onreadystatechange = () => {
    // https://developer.mozilla.org/fr/docs/Web/API/XMLHttpRequest/readyState
    const {
      readyState
    } = xhr;

    if (readyState === 2) {
      headersPromise.resolve();
    } else if (readyState === 4) {
      cleanup();
      bodyPromise.resolve();
    }
  };

  xhr.open(method, url, true);
  Object.keys(headers).forEach(key => {
    xhr.setRequestHeader(key, headers[key]);
  });
  xhr.withCredentials = computeWithCredentials({
    credentials,
    url
  });

  if ("responseType" in xhr && hasBlob) {
    xhr.responseType = "blob";
  }

  xhr.send(body);
  await headersPromise; // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL

  const responseUrl = "responseURL" in xhr ? xhr.responseURL : headers["x-request-url"];
  let responseStatus = xhr.status;
  const responseStatusText = xhr.statusText;
  const responseHeaders = getHeadersFromXHR(xhr);

  const readBody = async () => {
    await bodyPromise;
    const {
      status
    } = xhr; // in Chrome on file:/// URLs, status is 0

    if (status === 0) {
      responseStatus = 200;
    }

    const body = "response" in xhr ? xhr.response : xhr.responseText;
    return {
      responseBody: body,
      responseBodyType: detectBodyType(body)
    };
  };

  const text = async () => {
    const {
      responseBody,
      responseBodyType
    } = await readBody();

    if (responseBodyType === "blob") {
      return blobToText(responseBody);
    }

    if (responseBodyType === "formData") {
      throw new Error("could not read FormData body as text");
    }

    if (responseBodyType === "dataView") {
      return arrayBufferToText(responseBody.buffer);
    }

    if (responseBodyType === "arrayBuffer") {
      return arrayBufferToText(responseBody);
    } // if (responseBodyType === "text" || responseBodyType === 'searchParams') {
    //   return body
    // }


    return String(responseBody);
  };

  const json = async () => {
    const responseText = await text();
    return JSON.parse(responseText);
  };

  const blob = async () => {
    if (!hasBlob) {
      throw new Error(`blob not supported`);
    }

    const {
      responseBody,
      responseBodyType
    } = await readBody();

    if (responseBodyType === "blob") {
      return responseBody;
    }

    if (responseBodyType === "dataView") {
      return new Blob([cloneBuffer(responseBody.buffer)]);
    }

    if (responseBodyType === "arrayBuffer") {
      return new Blob([cloneBuffer(responseBody)]);
    }

    if (responseBodyType === "formData") {
      throw new Error("could not read FormData body as blob");
    }

    return new Blob([String(responseBody)]);
  };

  const arrayBuffer = async () => {
    const {
      responseBody,
      responseBodyType
    } = await readBody();

    if (responseBodyType === "arrayBuffer") {
      return cloneBuffer(responseBody);
    }

    const responseBlob = await blob();
    return blobToArrayBuffer(responseBlob);
  };

  const formData = async () => {
    if (!hasFormData) {
      throw new Error(`formData not supported`);
    }

    const responseText = await text();
    return textToFormData(responseText);
  };

  return {
    url: responseUrl,
    status: responseStatus,
    statusText: responseStatusText,
    headers: responseHeaders,
    text,
    json,
    blob,
    arrayBuffer,
    formData
  };
};

const canUseBlob = () => {
  if (typeof window.FileReader !== "function") return false;
  if (typeof window.Blob !== "function") return false;

  try {
    // eslint-disable-next-line no-new
    new Blob();
    return true;
  } catch (e) {
    return false;
  }
};

const hasBlob = canUseBlob();
const hasFormData = typeof window.FormData === "function";
const hasArrayBuffer = typeof window.ArrayBuffer === "function";
const hasSearchParams = typeof window.URLSearchParams === "function";

const createRequestError = (error, {
  url
}) => {
  return new Error(`error during xhr request on ${url}.
--- error stack ---
${error.stack}`);
};

const createPromiseAndHooks = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = value => {
      promise.settled = true;
      res(value);
    };

    reject = value => {
      promise.settled = true;
      rej(value);
    };
  });
  promise.resolve = resolve;
  promise.reject = reject;
  return promise;
}; // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch


const computeWithCredentials = ({
  credentials,
  url
}) => {
  if (credentials === "same-origin") {
    return originSameAsGlobalOrigin(url);
  }

  return credentials === "include";
};

const originSameAsGlobalOrigin = url => {
  // if we cannot read globalOrigin from window.location.origin, let's consider it's ok
  if (typeof window !== "object") return true;
  if (typeof window.location !== "object") return true;
  const globalOrigin = window.location.origin;
  if (globalOrigin === "null") return true;
  return hrefToOrigin(url) === globalOrigin;
};

const detectBodyType = body => {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return "text";
  }

  if (hasBlob && Blob.prototype.isPrototypeOf(body)) {
    return "blob";
  }

  if (hasFormData && FormData.prototype.isPrototypeOf(body)) {
    return "formData";
  }

  if (hasArrayBuffer) {
    if (hasBlob && isDataView(body)) {
      return `dataView`;
    }

    if (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body)) {
      return `arrayBuffer`;
    }
  }

  if (hasSearchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
    return "searchParams";
  }

  return "";
}; // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/getAllResponseHeaders#Example


const getHeadersFromXHR = xhr => {
  const headerMap = {};
  const headersString = xhr.getAllResponseHeaders();
  if (headersString === "") return headerMap;
  const lines = headersString.trim().split(/[\r\n]+/);
  lines.forEach(line => {
    const parts = line.split(": ");
    const name = parts.shift();
    const value = parts.join(": ");
    headerMap[name.toLowerCase()] = value;
  });
  return headerMap;
};

const hrefToOrigin = href => {
  const scheme = hrefToScheme(href);

  if (scheme === "file") {
    return "file://";
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = href.indexOf("/", secondProtocolSlashIndex);
    if (pathnameSlashIndex === -1) return href;
    return href.slice(0, pathnameSlashIndex);
  }

  return href.slice(0, scheme.length + 1);
};

const hrefToScheme = href => {
  const colonIndex = href.indexOf(":");
  if (colonIndex === -1) return "";
  return href.slice(0, colonIndex);
};

const isDataView = obj => {
  return obj && DataView.prototype.isPrototypeOf(obj);
};

const isArrayBufferView = ArrayBuffer.isView || (() => {
  const viewClasses = ["[object Int8Array]", "[object Uint8Array]", "[object Uint8ClampedArray]", "[object Int16Array]", "[object Uint16Array]", "[object Int32Array]", "[object Uint32Array]", "[object Float32Array]", "[object Float64Array]"];
  return value => {
    return value && viewClasses.includes(Object.prototype.toString.call(value));
  };
})();

const textToFormData = text => {
  const form = new FormData();
  text.trim().split("&").forEach(function (bytes) {
    if (bytes) {
      const split = bytes.split("=");
      const name = split.shift().replace(/\+/g, " ");
      const value = split.join("=").replace(/\+/g, " ");
      form.append(decodeURIComponent(name), decodeURIComponent(value));
    }
  });
  return form;
};

const blobToArrayBuffer = async blob => {
  const reader = new FileReader();
  const promise = fileReaderReady(reader);
  reader.readAsArrayBuffer(blob);
  return promise;
};

const blobToText = blob => {
  const reader = new FileReader();
  const promise = fileReaderReady(reader);
  reader.readAsText(blob);
  return promise;
};

const arrayBufferToText = arrayBuffer => {
  const view = new Uint8Array(arrayBuffer);
  const chars = new Array(view.length);
  let i = 0;

  while (i < view.length) {
    chars[i] = String.fromCharCode(view[i]);
    i++;
  }

  return chars.join("");
};

const fileReaderReady = reader => {
  return new Promise(function (resolve, reject) {
    reader.onload = function () {
      resolve(reader.result);
    };

    reader.onerror = function () {
      reject(reader.error);
    };
  });
};

const cloneBuffer = buffer => {
  if (buffer.slice) {
    return buffer.slice(0);
  }

  const view = new Uint8Array(buffer.byteLength);
  view.set(new Uint8Array(buffer));
  return view.buffer;
};

const fetchNative = async (url, {
  mode = "cors",
  ...options
} = {}) => {
  const response = await window.fetch(url, {
    mode,
    ...options
  });
  return {
    url: response.url,
    status: response.status,
    statusText: "",
    headers: responseToHeaders$1(response),
    text: () => response.text(),
    json: () => response.json(),
    blob: () => response.blob(),
    arrayBuffer: () => response.arrayBuffer(),
    formData: () => response.formData()
  };
};

const responseToHeaders$1 = response => {
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
};

const fetchUrl = typeof window.fetch === "function" && typeof window.AbortController === "function" ? fetchNative : fetchUsingXHR;

const createDetailedMessage = (message, details = {}) => {
  let string = `${message}`;
  Object.keys(details).forEach(key => {
    const value = details[key];
    string += `
--- ${key} ---
${Array.isArray(value) ? value.join(`
`) : value}`;
  });
  return string;
};

const fetchAndEval = async url => {
  const response = await fetchUrl(url);

  if (response.status >= 200 && response.status <= 299) {
    const text = await response.text(); // eslint-disable-next-line no-eval

    window.eval(appendSourceURL(text, url));
  } else {
    const text = await response.text();
    throw new Error(createDetailedMessage(`Unexpected response for script.`, {
      ["script url"]: url,
      ["response body"]: text,
      ["response status"]: response.status
    }));
  }
};

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`;
};

// https://developer.mozilla.org/en-US/docs/Glossary/Primitive
const isComposite = value => {
  if (value === null) {
    return false;
  }

  const type = typeof value;

  if (type === "object") {
    return true;
  }

  if (type === "function") {
    return true;
  }

  return false;
};

const compositeWellKnownMap = new WeakMap();
const primitiveWellKnownMap = new Map();
const getCompositeGlobalPath = value => compositeWellKnownMap.get(value);
const getPrimitiveGlobalPath = value => primitiveWellKnownMap.get(value);

const visitGlobalObject = value => {
  const visitValue = (value, path) => {
    if (isComposite(value)) {
      // prevent infinite recursion
      if (compositeWellKnownMap.has(value)) {
        return;
      }

      compositeWellKnownMap.set(value, path);

      const visitProperty = property => {
        let descriptor;

        try {
          descriptor = Object.getOwnPropertyDescriptor(value, property);
        } catch (e) {
          if (e.name === "SecurityError") {
            return;
          }

          throw e;
        }

        if (!descriptor) {
          // it's apparently possible to have getOwnPropertyNames returning
          // a property that later returns a null descriptor
          // for instance window.showModalDialog in webkit 13.0
          return;
        } // do not trigger getter/setter


        if ("value" in descriptor) {
          const propertyValue = descriptor.value;
          visitValue(propertyValue, [...path, property]);
        }
      };

      Object.getOwnPropertyNames(value).forEach(name => visitProperty(name));
      Object.getOwnPropertySymbols(value).forEach(symbol => visitProperty(symbol));
    }

    primitiveWellKnownMap.set(value, path);
    return;
  };

  visitValue(value, []);
};

if (typeof window === "object") visitGlobalObject(window);
if (typeof global === "object") visitGlobalObject(global);

/**
 * transforms a javascript value into an object describing it.
 *
 */
const decompose = (mainValue, {
  functionAllowed,
  prototypeStrict,
  ignoreSymbols
}) => {
  const valueMap = {};
  const recipeArray = [];

  const valueToIdentifier = (value, path = []) => {
    if (!isComposite(value)) {
      const existingIdentifier = identifierForPrimitive(value);

      if (existingIdentifier !== undefined) {
        return existingIdentifier;
      }

      const identifier = identifierForNewValue(value);
      recipeArray[identifier] = primitiveToRecipe(value);
      return identifier;
    }

    if (typeof Promise === "function" && value instanceof Promise) {
      throw new Error(createPromiseAreNotSupportedMessage({
        path
      }));
    }

    if (typeof WeakSet === "function" && value instanceof WeakSet) {
      throw new Error(createWeakSetAreNotSupportedMessage({
        path
      }));
    }

    if (typeof WeakMap === "function" && value instanceof WeakMap) {
      throw new Error(createWeakMapAreNotSupportedMessage({
        path
      }));
    }

    if (typeof value === "function" && !functionAllowed) {
      throw new Error(createForbiddenFunctionMessage({
        path
      }));
    }

    const existingIdentifier = identifierForComposite(value);

    if (existingIdentifier !== undefined) {
      return existingIdentifier;
    }

    const identifier = identifierForNewValue(value);
    const compositeGlobalPath = getCompositeGlobalPath(value);

    if (compositeGlobalPath) {
      recipeArray[identifier] = createGlobalReferenceRecipe(compositeGlobalPath);
      return identifier;
    }

    const propertyDescriptionArray = [];
    Object.getOwnPropertyNames(value).forEach(propertyName => {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
      const propertyNameIdentifier = valueToIdentifier(propertyName, [...path, propertyName]);
      const propertyDescription = computePropertyDescription(propertyDescriptor, propertyName, path);
      propertyDescriptionArray.push({
        propertyNameIdentifier,
        propertyDescription
      });
    });
    const symbolDescriptionArray = [];

    if (!ignoreSymbols) {
      Object.getOwnPropertySymbols(value).forEach(symbol => {
        const propertyDescriptor = Object.getOwnPropertyDescriptor(value, symbol);
        const symbolIdentifier = valueToIdentifier(symbol, [...path, `[${symbol.toString()}]`]);
        const propertyDescription = computePropertyDescription(propertyDescriptor, symbol, path);
        symbolDescriptionArray.push({
          symbolIdentifier,
          propertyDescription
        });
      });
    }

    const methodDescriptionArray = computeMethodDescriptionArray(value, path);
    const extensible = Object.isExtensible(value);
    recipeArray[identifier] = createCompositeRecipe({
      propertyDescriptionArray,
      symbolDescriptionArray,
      methodDescriptionArray,
      extensible
    });
    return identifier;
  };

  const computePropertyDescription = (propertyDescriptor, propertyNameOrSymbol, path) => {
    if (propertyDescriptor.set && !functionAllowed) {
      throw new Error(createForbiddenPropertySetterMessage({
        path,
        propertyNameOrSymbol
      }));
    }

    if (propertyDescriptor.get && !functionAllowed) {
      throw new Error(createForbiddenPropertyGetterMessage({
        path,
        propertyNameOrSymbol
      }));
    }

    return {
      configurable: propertyDescriptor.configurable,
      writable: propertyDescriptor.writable,
      enumerable: propertyDescriptor.enumerable,
      getIdentifier: "get" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.get, [...path, String(propertyNameOrSymbol), "[[descriptor:get]]"]) : undefined,
      setIdentifier: "set" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.set, [...path, String(propertyNameOrSymbol), "[[descriptor:set]]"]) : undefined,
      valueIdentifier: "value" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.value, [...path, String(propertyNameOrSymbol), "[[descriptor:value]]"]) : undefined
    };
  };

  const computeMethodDescriptionArray = (value, path) => {
    const methodDescriptionArray = [];

    if (typeof Set === "function" && value instanceof Set) {
      const callArray = [];
      value.forEach((entryValue, index) => {
        const entryValueIdentifier = valueToIdentifier(entryValue, [...path, `[[SetEntryValue]]`, index]);
        callArray.push([entryValueIdentifier]);
      });
      methodDescriptionArray.push({
        methodNameIdentifier: valueToIdentifier("add"),
        callArray
      });
    }

    if (typeof Map === "function" && value instanceof Map) {
      const callArray = [];
      value.forEach((entryValue, entryKey) => {
        const entryKeyIdentifier = valueToIdentifier(entryKey, [...path, "[[MapEntryKey]]", entryKey]);
        const entryValueIdentifier = valueToIdentifier(entryValue, [...path, "[[MapEntryValue]]", entryValue]);
        callArray.push([entryKeyIdentifier, entryValueIdentifier]);
      });
      methodDescriptionArray.push({
        methodNameIdentifier: valueToIdentifier("set"),
        callArray
      });
    }

    return methodDescriptionArray;
  };

  const identifierForPrimitive = value => {
    return Object.keys(valueMap).find(existingIdentifier => {
      const existingValue = valueMap[existingIdentifier];
      if (Object.is(value, existingValue)) return true;
      return value === existingValue;
    });
  };

  const identifierForComposite = value => {
    return Object.keys(valueMap).find(existingIdentifier => {
      const existingValue = valueMap[existingIdentifier];
      return value === existingValue;
    });
  };

  const identifierForNewValue = value => {
    const identifier = nextIdentifier();
    valueMap[identifier] = value;
    return identifier;
  };

  let currentIdentifier = -1;

  const nextIdentifier = () => {
    const identifier = String(parseInt(currentIdentifier) + 1);
    currentIdentifier = identifier;
    return identifier;
  };

  const mainIdentifier = valueToIdentifier(mainValue); // prototype, important to keep after the whole structure was visited
  // so that we discover if any prototype is part of the value

  const prototypeValueToIdentifier = prototypeValue => {
    // prototype is null
    if (prototypeValue === null) {
      return valueToIdentifier(prototypeValue);
    } // prototype found somewhere already


    const prototypeExistingIdentifier = identifierForComposite(prototypeValue);

    if (prototypeExistingIdentifier !== undefined) {
      return prototypeExistingIdentifier;
    } // mark prototype as visited


    const prototypeIdentifier = identifierForNewValue(prototypeValue); // prototype is a global reference ?

    const prototypeGlobalPath = getCompositeGlobalPath(prototypeValue);

    if (prototypeGlobalPath) {
      recipeArray[prototypeIdentifier] = createGlobalReferenceRecipe(prototypeGlobalPath);
      return prototypeIdentifier;
    } // otherwise prototype is unknown


    if (prototypeStrict) {
      throw new Error(createUnknownPrototypeMessage({
        prototypeValue
      }));
    }

    return prototypeValueToIdentifier(Object.getPrototypeOf(prototypeValue));
  };

  const identifierForValueOf = (value, path = []) => {
    if (value instanceof Array) {
      return valueToIdentifier(value.length, [...path, "length"]);
    }

    if ("valueOf" in value === false) {
      return undefined;
    }

    if (typeof value.valueOf !== "function") {
      return undefined;
    }

    const valueOfReturnValue = value.valueOf();

    if (!isComposite(valueOfReturnValue)) {
      return valueToIdentifier(valueOfReturnValue, [...path, "valueOf()"]);
    }

    if (valueOfReturnValue === value) {
      return undefined;
    }

    throw new Error(createUnexpectedValueOfReturnValueMessage());
  };

  recipeArray.slice().forEach((recipe, index) => {
    if (recipe.type === "composite") {
      const value = valueMap[index];

      if (typeof value === "function") {
        const valueOfIdentifier = nextIdentifier();
        recipeArray[valueOfIdentifier] = {
          type: "primitive",
          value
        };
        recipe.valueOfIdentifier = valueOfIdentifier;
        return;
      }

      if (value instanceof RegExp) {
        const valueOfIdentifier = nextIdentifier();
        recipeArray[valueOfIdentifier] = {
          type: "primitive",
          value
        };
        recipe.valueOfIdentifier = valueOfIdentifier;
        return;
      } // valueOf, mandatory to uneval new Date(10) for instance.


      recipe.valueOfIdentifier = identifierForValueOf(value);
      const prototypeValue = Object.getPrototypeOf(value);
      recipe.prototypeIdentifier = prototypeValueToIdentifier(prototypeValue);
    }
  });
  return {
    recipeArray,
    mainIdentifier,
    valueMap
  };
};

const primitiveToRecipe = value => {
  if (typeof value === "symbol") {
    return symbolToRecipe(value);
  }

  return createPimitiveRecipe(value);
};

const symbolToRecipe = symbol => {
  const globalSymbolKey = Symbol.keyFor(symbol);

  if (globalSymbolKey !== undefined) {
    return createGlobalSymbolRecipe(globalSymbolKey);
  }

  const symbolGlobalPath = getPrimitiveGlobalPath(symbol);

  if (!symbolGlobalPath) {
    throw new Error(createUnknownSymbolMessage({
      symbol
    }));
  }

  return createGlobalReferenceRecipe(symbolGlobalPath);
};

const createPimitiveRecipe = value => {
  return {
    type: "primitive",
    value
  };
};

const createGlobalReferenceRecipe = path => {
  const recipe = {
    type: "global-reference",
    path
  };
  return recipe;
};

const createGlobalSymbolRecipe = key => {
  return {
    type: "global-symbol",
    key
  };
};

const createCompositeRecipe = ({
  prototypeIdentifier,
  valueOfIdentifier,
  propertyDescriptionArray,
  symbolDescriptionArray,
  methodDescriptionArray,
  extensible
}) => {
  return {
    type: "composite",
    prototypeIdentifier,
    valueOfIdentifier,
    propertyDescriptionArray,
    symbolDescriptionArray,
    methodDescriptionArray,
    extensible
  };
};

const createPromiseAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) {
    return `promise are not supported.`;
  }

  return `promise are not supported.
promise found at: ${path.join("")}`;
};

const createWeakSetAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) {
    return `weakSet are not supported.`;
  }

  return `weakSet are not supported.
weakSet found at: ${path.join("")}`;
};

const createWeakMapAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) {
    return `weakMap are not supported.`;
  }

  return `weakMap are not supported.
weakMap found at: ${path.join("")}`;
};

const createForbiddenFunctionMessage = ({
  path
}) => {
  if (path.length === 0) {
    return `function are not allowed.`;
  }

  return `function are not allowed.
function found at: ${path.join("")}`;
};

const createForbiddenPropertyGetterMessage = ({
  path,
  propertyNameOrSymbol
}) => `property getter are not allowed.
getter found on property: ${String(propertyNameOrSymbol)}
at: ${path.join("")}`;

const createForbiddenPropertySetterMessage = ({
  path,
  propertyNameOrSymbol
}) => `property setter are not allowed.
setter found on property: ${String(propertyNameOrSymbol)}
at: ${path.join("")}`;

const createUnexpectedValueOfReturnValueMessage = () => `valueOf() must return a primitive of the object itself.`;

const createUnknownSymbolMessage = ({
  symbol
}) => `symbol must be global, like Symbol.iterator, or created using Symbol.for().
symbol: ${symbol.toString()}`;

const createUnknownPrototypeMessage = ({
  prototypeValue
}) => `prototype must be global, like Object.prototype, or somewhere in the value.
prototype constructor name: ${prototypeValue.constructor.name}`;

// be carefull because this function is mutating recipe objects inside the recipeArray.
// this is not an issue because each recipe object is not accessible from the outside
// when used internally by uneval
const sortRecipe = recipeArray => {
  const findInRecipePrototypeChain = (recipe, callback) => {
    let currentRecipe = recipe; // eslint-disable-next-line no-constant-condition

    while (true) {
      if (currentRecipe.type !== "composite") {
        break;
      }

      const prototypeIdentifier = currentRecipe.prototypeIdentifier;

      if (prototypeIdentifier === undefined) {
        break;
      }

      currentRecipe = recipeArray[prototypeIdentifier];

      if (callback(currentRecipe, prototypeIdentifier)) {
        return prototypeIdentifier;
      }
    }

    return undefined;
  };

  const recipeArrayOrdered = recipeArray.slice();
  recipeArrayOrdered.sort((leftRecipe, rightRecipe) => {
    const leftType = leftRecipe.type;
    const rightType = rightRecipe.type;

    if (leftType === "composite" && rightType === "composite") {
      const rightRecipeIsInLeftRecipePrototypeChain = findInRecipePrototypeChain(leftRecipe, recipeCandidate => recipeCandidate === rightRecipe); // if left recipe requires right recipe, left must be after right

      if (rightRecipeIsInLeftRecipePrototypeChain) {
        return 1;
      }

      const leftRecipeIsInRightRecipePrototypeChain = findInRecipePrototypeChain(rightRecipe, recipeCandidate => recipeCandidate === leftRecipe); // if right recipe requires left recipe, right must be after left

      if (leftRecipeIsInRightRecipePrototypeChain) {
        return -1;
      }
    }

    if (leftType !== rightType) {
      // if left is a composite, left must be after right
      if (leftType === "composite") {
        return 1;
      } // if right is a composite, right must be after left


      if (rightType === "composite") {
        return -1;
      }
    }

    const leftIndex = recipeArray.indexOf(leftRecipe);
    const rightIndex = recipeArray.indexOf(rightRecipe); // left was before right, don't change that

    if (leftIndex < rightIndex) {
      return -1;
    } // right was after left, don't change that


    return 1;
  });
  return recipeArrayOrdered;
};

// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const escapeString = value => {
  const string = String(value);
  let i = 0;
  const j = string.length;
  var escapedString = "";

  while (i < j) {
    const char = string[i];
    let escapedChar;

    if (char === '"' || char === "'" || char === "\\") {
      escapedChar = `\\${char}`;
    } else if (char === "\n") {
      escapedChar = "\\n";
    } else if (char === "\r") {
      escapedChar = "\\r";
    } else if (char === "\u2028") {
      escapedChar = "\\u2028";
    } else if (char === "\u2029") {
      escapedChar = "\\u2029";
    } else {
      escapedChar = char;
    }

    escapedString += escapedChar;
    i++;
  }

  return escapedString;
};

const uneval = (value, {
  functionAllowed = false,
  prototypeStrict = false,
  ignoreSymbols = false
} = {}) => {
  const {
    recipeArray,
    mainIdentifier,
    valueMap
  } = decompose(value, {
    functionAllowed,
    prototypeStrict,
    ignoreSymbols
  });
  const recipeArraySorted = sortRecipe(recipeArray);
  let source = `(function () {
var globalObject
try {
  globalObject = Function('return this')() || (42, eval)('this');
} catch(e) {
  globalObject = window;
}

function safeDefineProperty(object, propertyNameOrSymbol, descriptor) {
  var currentDescriptor = Object.getOwnPropertyDescriptor(object, propertyNameOrSymbol);
  if (currentDescriptor && !currentDescriptor.configurable) return
  Object.defineProperty(object, propertyNameOrSymbol, descriptor)
};
`;
  const variableNameMap = {};
  recipeArray.forEach((recipe, index) => {
    const indexSorted = recipeArraySorted.indexOf(recipe);
    variableNameMap[index] = `_${indexSorted}`;
  });

  const identifierToVariableName = identifier => variableNameMap[identifier];

  const recipeToSetupSource = recipe => {
    if (recipe.type === "primitive") return primitiveRecipeToSetupSource(recipe);
    if (recipe.type === "global-symbol") return globalSymbolRecipeToSetupSource(recipe);
    if (recipe.type === "global-reference") return globalReferenceRecipeToSetupSource(recipe);
    return compositeRecipeToSetupSource(recipe);
  };

  const primitiveRecipeToSetupSource = ({
    value
  }) => {
    const type = typeof value;

    if (type === "string") {
      return `"${escapeString(value)}";`;
    }

    if (type === "bigint") {
      return `${value.toString()}n`;
    }

    if (Object.is(value, -0)) {
      return "-0;";
    }

    return `${String(value)};`;
  };

  const globalSymbolRecipeToSetupSource = recipe => {
    return `Symbol.for("${escapeString(recipe.key)}");`;
  };

  const globalReferenceRecipeToSetupSource = recipe => {
    const pathSource = recipe.path.map(part => `["${escapeString(part)}"]`).join("");
    return `globalObject${pathSource};`;
  };

  const compositeRecipeToSetupSource = ({
    prototypeIdentifier,
    valueOfIdentifier
  }) => {
    if (prototypeIdentifier === undefined) {
      return identifierToVariableName(valueOfIdentifier);
    }

    const prototypeValue = valueMap[prototypeIdentifier];

    if (prototypeValue === null) {
      return `Object.create(null);`;
    }

    const prototypeConstructor = prototypeValue.constructor;

    if (prototypeConstructor === Object) {
      return `Object.create(${identifierToVariableName(prototypeIdentifier)});`;
    }

    if (valueOfIdentifier === undefined) {
      return `new ${prototypeConstructor.name}();`;
    }

    if (prototypeConstructor.name === "BigInt") {
      return `Object(${identifierToVariableName(valueOfIdentifier)})`;
    }

    return `new ${prototypeConstructor.name}(${identifierToVariableName(valueOfIdentifier)});`;
  };

  recipeArraySorted.forEach(recipe => {
    const recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
    source += `var ${recipeVariableName} = ${recipeToSetupSource(recipe)}
`;
  });

  const recipeToMutateSource = (recipe, recipeVariableName) => {
    if (recipe.type === "composite") {
      return compositeRecipeToMutateSource(recipe, recipeVariableName);
    }

    return ``;
  };

  const compositeRecipeToMutateSource = ({
    propertyDescriptionArray,
    symbolDescriptionArray,
    methodDescriptionArray,
    extensible
  }, recipeVariableName) => {
    let mutateSource = ``;
    propertyDescriptionArray.forEach(({
      propertyNameIdentifier,
      propertyDescription
    }) => {
      mutateSource += generateDefinePropertySource(recipeVariableName, propertyNameIdentifier, propertyDescription);
    });
    symbolDescriptionArray.forEach(({
      symbolIdentifier,
      propertyDescription
    }) => {
      mutateSource += generateDefinePropertySource(recipeVariableName, symbolIdentifier, propertyDescription);
    });
    methodDescriptionArray.forEach(({
      methodNameIdentifier,
      callArray
    }) => {
      mutateSource += generateMethodCallSource(recipeVariableName, methodNameIdentifier, callArray);
    });

    if (!extensible) {
      mutateSource += generatePreventExtensionSource(recipeVariableName);
    }

    return mutateSource;
  };

  const generateDefinePropertySource = (recipeVariableName, propertyNameOrSymbolIdentifier, propertyDescription) => {
    const propertyOrSymbolVariableName = identifierToVariableName(propertyNameOrSymbolIdentifier);
    const propertyDescriptorSource = generatePropertyDescriptorSource(propertyDescription);
    return `safeDefineProperty(${recipeVariableName}, ${propertyOrSymbolVariableName}, ${propertyDescriptorSource});`;
  };

  const generatePropertyDescriptorSource = ({
    configurable,
    writable,
    enumerable,
    getIdentifier,
    setIdentifier,
    valueIdentifier
  }) => {
    if (valueIdentifier === undefined) {
      return `{
  configurable: ${configurable},
  enumerable: ${enumerable},
  get: ${getIdentifier === undefined ? undefined : identifierToVariableName(getIdentifier)},
  set: ${setIdentifier === undefined ? undefined : identifierToVariableName(setIdentifier)},
}`;
    }

    return `{
  configurable: ${configurable},
  writable: ${writable},
  enumerable: ${enumerable},
  value: ${valueIdentifier === undefined ? undefined : identifierToVariableName(valueIdentifier)}
}`;
  };

  const generateMethodCallSource = (recipeVariableName, methodNameIdentifier, callArray) => {
    let methodCallSource = ``;
    const methodVariableName = identifierToVariableName(methodNameIdentifier);
    callArray.forEach(argumentIdentifiers => {
      const argumentVariableNames = argumentIdentifiers.map(argumentIdentifier => identifierToVariableName(argumentIdentifier));
      methodCallSource += `${recipeVariableName}[${methodVariableName}](${argumentVariableNames.join(",")});`;
    });
    return methodCallSource;
  };

  const generatePreventExtensionSource = recipeVariableName => {
    return `Object.preventExtensions(${recipeVariableName});`;
  };

  recipeArraySorted.forEach(recipe => {
    const recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
    source += `${recipeToMutateSource(recipe, recipeVariableName)}`;
  });
  source += `return ${identifierToVariableName(mainIdentifier)}; })()`;
  return source;
};

const unevalException = value => {
  if (value && value.hasOwnProperty("toString")) {
    delete value.toString;
  }

  return uneval(value, {
    ignoreSymbols: true
  });
};

const memoize = compute => {
  let memoized = false;
  let memoizedValue;

  const fnWithMemoization = (...args) => {
    if (memoized) {
      return memoizedValue;
    } // if compute is recursive wait for it to be fully done before storing the lockValue
    // so set locked later


    memoizedValue = compute(...args);
    memoized = true;
    return memoizedValue;
  };

  fnWithMemoization.forget = () => {
    const value = memoizedValue;
    memoized = false;
    memoizedValue = undefined;
    return value;
  };

  return fnWithMemoization;
};

const assertImportMap = value => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`);
  }

  const type = typeof value;

  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`);
  }

  if (Array.isArray(value)) {
    throw new TypeError(`an importMap must be an object, received array ${value}`);
  }
};

const hasScheme = string => {
  return /^[a-zA-Z]{2,}:/.test(string);
};

const urlToScheme = urlString => {
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) return "";
  return urlString.slice(0, colonIndex);
};

const urlToPathname$1 = urlString => {
  return ressourceToPathname(urlToRessource(urlString));
};

const urlToRessource = urlString => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return urlString.slice("file://".length);
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex);
  }

  return urlString.slice(scheme.length + 1);
};

const ressourceToPathname = ressource => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex);
};

const urlToOrigin = urlString => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return "file://";
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);
    if (pathnameSlashIndex === -1) return urlString;
    return urlString.slice(0, pathnameSlashIndex);
  }

  return urlString.slice(0, scheme.length + 1);
};

const pathnameToParentPathname = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");

  if (slashLastIndex === -1) {
    return "/";
  }

  return pathname.slice(0, slashLastIndex + 1);
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous
const resolveUrl = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString({
        baseUrl,
        specifier
      }));
    }

    if (!hasScheme(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute({
        baseUrl,
        specifier
      }));
    }
  }

  if (hasScheme(specifier)) {
    return specifier;
  }

  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired({
      baseUrl,
      specifier
    }));
  } // scheme relative


  if (specifier.slice(0, 2) === "//") {
    return `${urlToScheme(baseUrl)}:${specifier}`;
  } // origin relative


  if (specifier[0] === "/") {
    return `${urlToOrigin(baseUrl)}${specifier}`;
  }

  const baseOrigin = urlToOrigin(baseUrl);
  const basePathname = urlToPathname$1(baseUrl);

  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}`;
  } // pathname relative inside


  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}${specifier.slice(2)}`;
  } // pathname relative outside


  if (specifier.slice(0, 3) === "../") {
    let unresolvedPathname = specifier;
    const importerFolders = basePathname.split("/");
    importerFolders.pop();

    while (unresolvedPathname.slice(0, 3) === "../") {
      unresolvedPathname = unresolvedPathname.slice(3); // when there is no folder left to resolved
      // we just ignore '../'

      if (importerFolders.length) {
        importerFolders.pop();
      }
    }

    const resolvedPathname = `${importerFolders.join("/")}/${unresolvedPathname}`;
    return `${baseOrigin}${resolvedPathname}`;
  } // bare


  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`;
  }

  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`;
  }

  return `${baseOrigin}${pathnameToParentPathname(basePathname)}${specifier}`;
};

const writeBaseUrlMustBeAString = ({
  baseUrl,
  specifier
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlMustBeAbsolute = ({
  baseUrl,
  specifier
}) => `baseUrl must be absolute.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlRequired = ({
  baseUrl,
  specifier
}) => `baseUrl required to resolve relative specifier.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const tryUrlResolution = (string, url) => {
  const result = resolveUrl(string, url);
  return hasScheme(result) ? result : null;
};

const resolveSpecifier = (specifier, importer) => {
  if (specifier === "." || specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveUrl(specifier, importer);
  }

  if (hasScheme(specifier)) {
    return specifier;
  }

  return null;
};

const sortImports = imports => {
  const mappingsSorted = {};
  Object.keys(imports).sort(compareLengthOrLocaleCompare).forEach(name => {
    mappingsSorted[name] = imports[name];
  });
  return mappingsSorted;
};
const sortScopes = scopes => {
  const scopesSorted = {};
  Object.keys(scopes).sort(compareLengthOrLocaleCompare).forEach(scopeSpecifier => {
    scopesSorted[scopeSpecifier] = sortImports(scopes[scopeSpecifier]);
  });
  return scopesSorted;
};

const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b);
};

const normalizeImportMap = (importMap, baseUrl) => {
  assertImportMap(importMap);

  if (!isStringOrUrl(baseUrl)) {
    throw new TypeError(formulateBaseUrlMustBeStringOrUrl({
      baseUrl
    }));
  }

  const {
    imports,
    scopes
  } = importMap;
  return {
    imports: imports ? normalizeMappings(imports, baseUrl) : undefined,
    scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined
  };
};

const isStringOrUrl = value => {
  if (typeof value === "string") {
    return true;
  }

  if (typeof URL === "function" && value instanceof URL) {
    return true;
  }

  return false;
};

const normalizeMappings = (mappings, baseUrl) => {
  const mappingsNormalized = {};
  Object.keys(mappings).forEach(specifier => {
    const address = mappings[specifier];

    if (typeof address !== "string") {
      console.warn(formulateAddressMustBeAString({
        address,
        specifier
      }));
      return;
    }

    const specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;
    const addressUrl = tryUrlResolution(address, baseUrl);

    if (addressUrl === null) {
      console.warn(formulateAdressResolutionFailed({
        address,
        baseUrl,
        specifier
      }));
      return;
    }

    if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
      console.warn(formulateAddressUrlRequiresTrailingSlash({
        addressUrl,
        address,
        specifier
      }));
      return;
    }

    mappingsNormalized[specifierResolved] = addressUrl;
  });
  return sortImports(mappingsNormalized);
};

const normalizeScopes = (scopes, baseUrl) => {
  const scopesNormalized = {};
  Object.keys(scopes).forEach(scopeSpecifier => {
    const scopeMappings = scopes[scopeSpecifier];
    const scopeUrl = tryUrlResolution(scopeSpecifier, baseUrl);

    if (scopeUrl === null) {
      console.warn(formulateScopeResolutionFailed({
        scope: scopeSpecifier,
        baseUrl
      }));
      return;
    }

    const scopeValueNormalized = normalizeMappings(scopeMappings, baseUrl);
    scopesNormalized[scopeUrl] = scopeValueNormalized;
  });
  return sortScopes(scopesNormalized);
};

const formulateBaseUrlMustBeStringOrUrl = ({
  baseUrl
}) => `baseUrl must be a string or an url.
--- base url ---
${baseUrl}`;

const formulateAddressMustBeAString = ({
  specifier,
  address
}) => `Address must be a string.
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateAdressResolutionFailed = ({
  address,
  baseUrl,
  specifier
}) => `Address url resolution failed.
--- address ---
${address}
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const formulateAddressUrlRequiresTrailingSlash = ({
  addressURL,
  address,
  specifier
}) => `Address must end with /.
--- address url ---
${addressURL}
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateScopeResolutionFailed = ({
  scope,
  baseUrl
}) => `Scope url resolution failed.
--- scope ---
${scope}
--- base url ---
${baseUrl}`;

const pathnameToExtension$1 = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");

  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return ""; // if (dotLastIndex === pathname.length - 1) return ""

  return pathname.slice(dotLastIndex);
};

const applyImportMap = ({
  importMap,
  specifier,
  importer,
  createBareSpecifierError = ({
    specifier,
    importer
  }) => {
    return new Error(createDetailedMessage(`Unmapped bare specifier.`, {
      specifier,
      importer
    }));
  },
  onImportMapping = () => {}
}) => {
  assertImportMap(importMap);

  if (typeof specifier !== "string") {
    throw new TypeError(createDetailedMessage("specifier must be a string.", {
      specifier,
      importer
    }));
  }

  if (importer) {
    if (typeof importer !== "string") {
      throw new TypeError(createDetailedMessage("importer must be a string.", {
        importer,
        specifier
      }));
    }

    if (!hasScheme(importer)) {
      throw new Error(createDetailedMessage(`importer must be an absolute url.`, {
        importer,
        specifier
      }));
    }
  }

  const specifierUrl = resolveSpecifier(specifier, importer);
  const specifierNormalized = specifierUrl || specifier;
  const {
    scopes
  } = importMap;

  if (scopes && importer) {
    const scopeSpecifierMatching = Object.keys(scopes).find(scopeSpecifier => {
      return scopeSpecifier === importer || specifierIsPrefixOf(scopeSpecifier, importer);
    });

    if (scopeSpecifierMatching) {
      const scopeMappings = scopes[scopeSpecifierMatching];
      const mappingFromScopes = applyMappings(scopeMappings, specifierNormalized, scopeSpecifierMatching, onImportMapping);

      if (mappingFromScopes !== null) {
        return mappingFromScopes;
      }
    }
  }

  const {
    imports
  } = importMap;

  if (imports) {
    const mappingFromImports = applyMappings(imports, specifierNormalized, undefined, onImportMapping);

    if (mappingFromImports !== null) {
      return mappingFromImports;
    }
  }

  if (specifierUrl) {
    return specifierUrl;
  }

  throw createBareSpecifierError({
    specifier,
    importer
  });
};

const applyMappings = (mappings, specifierNormalized, scope, onImportMapping) => {
  const specifierCandidates = Object.keys(mappings);
  let i = 0;

  while (i < specifierCandidates.length) {
    const specifierCandidate = specifierCandidates[i];
    i++;

    if (specifierCandidate === specifierNormalized) {
      const address = mappings[specifierCandidate];
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: address
      });
      return address;
    }

    if (specifierIsPrefixOf(specifierCandidate, specifierNormalized)) {
      const address = mappings[specifierCandidate];
      const afterSpecifier = specifierNormalized.slice(specifierCandidate.length);
      const addressFinal = tryUrlResolution(afterSpecifier, address);
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: addressFinal
      });
      return addressFinal;
    }
  }

  return null;
};

const specifierIsPrefixOf = (specifierHref, href) => {
  return specifierHref[specifierHref.length - 1] === "/" && href.startsWith(specifierHref);
};

const resolveImport = ({
  specifier,
  importer,
  importMap,
  defaultExtension = false,
  createBareSpecifierError,
  onImportMapping = () => {}
}) => {
  let url;

  if (importMap) {
    url = applyImportMap({
      importMap,
      specifier,
      importer,
      createBareSpecifierError,
      onImportMapping
    });
  } else {
    url = resolveUrl(specifier, importer);
  }

  if (defaultExtension) {
    url = applyDefaultExtension$1({
      url,
      importer,
      defaultExtension
    });
  }

  return url;
};

const applyDefaultExtension$1 = ({
  url,
  importer,
  defaultExtension
}) => {
  if (urlToPathname$1(url).endsWith("/")) {
    return url;
  }

  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension$1(url);

    if (extension === "") {
      return `${url}${defaultExtension}`;
    }

    return url;
  }

  if (defaultExtension === true) {
    const extension = pathnameToExtension$1(url);

    if (extension === "" && importer) {
      const importerPathname = urlToPathname$1(importer);
      const importerExtension = pathnameToExtension$1(importerPathname);
      return `${url}${importerExtension}`;
    }
  }

  return url;
};

const getJavaScriptModuleResponseError = async (response, {
  url,
  importerUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  jsonContentTypeAccepted
}) => {
  if (response.status === 404) {
    return new Error(createDetailedMessage(`JavaScript module file cannot be found`, getModuleDetails({
      url,
      importerUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      notFound: true
    })));
  }

  const contentType = response.headers["content-type"] || "";

  if (response.status === 500 && contentType === "application/json") {
    const bodyAsJson = await response.json();

    if (bodyAsJson.message && bodyAsJson.filename && "columnNumber" in bodyAsJson) {
      const error = new Error(createDetailedMessage(`JavaScript module file cannot be parsed`, {
        ["parsing error message"]: bodyAsJson.message,
        ...getModuleDetails({
          url,
          importerUrl,
          compileServerOrigin,
          compileDirectoryRelativeUrl
        })
      }));
      error.parsingError = bodyAsJson;
      return error;
    }
  }

  if (response.status < 200 || response.status >= 300) {
    return new Error(createDetailedMessage(`JavaScript module file response status is unexpected`, {
      ["status"]: response.status,
      ["allowed status"]: "200 to 299",
      ["statusText"]: response.statusText,
      ...getModuleDetails({
        url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl
      })
    }));
  }

  if (jsonContentTypeAccepted && (contentType === "application/json" || contentType.endsWith("+json"))) {
    return null;
  }

  if (contentType !== "application/javascript" && contentType !== "text/javascript") {
    return new Error(createDetailedMessage(`Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "${contentType}". Strict MIME type checking is enforced for module scripts per HTML spec.`, { ...getModuleDetails({
        url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl
      }),
      suggestion: `Use import.meta.url or import assertions as documented in https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md#How-to-reference-assets`
    }));
  }

  return null;
};
const getModuleDetails = ({
  url,
  importerUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  notFound = false
}) => {
  const relativeUrl = tryToFindProjectRelativeUrl(url, {
    compileServerOrigin,
    compileDirectoryRelativeUrl
  });
  const importerRelativeUrl = tryToFindProjectRelativeUrl(importerUrl, {
    compileServerOrigin,
    compileDirectoryRelativeUrl
  });
  const details = notFound ? { ...(importerUrl ? {
      ["import declared in"]: importerRelativeUrl || importerUrl
    } : {}),
    ...(relativeUrl ? {
      file: relativeUrl
    } : {}),
    ["file url"]: url
  } : { ...(relativeUrl ? {
      file: relativeUrl
    } : {}),
    ["file url"]: url,
    ...(importerUrl ? {
      ["imported by"]: importerRelativeUrl || importerUrl
    } : {})
  };
  return details;
};
const tryToFindProjectRelativeUrl = (url, {
  compileServerOrigin,
  compileDirectoryRelativeUrl
}) => {
  if (!url) {
    return null;
  }

  if (!url.startsWith(`${compileServerOrigin}/`)) {
    return null;
  }

  if (url === compileServerOrigin) {
    return null;
  }

  const afterOrigin = url.slice(`${compileServerOrigin}/`.length);

  if (!afterOrigin.startsWith(compileDirectoryRelativeUrl)) {
    return null;
  }

  const afterCompileDirectory = afterOrigin.slice(compileDirectoryRelativeUrl.length);
  return afterCompileDirectory;
}; // const textToBase64 =
//   typeof window === "object"
//     ? (text) => window.btoa(window.unescape(window.encodeURIComponent(text)))
//     : (text) => Buffer.from(text, "utf8").toString("base64")

const applyDefaultExtension = (specifier, importer) => {
  if (!importer) {
    return specifier;
  }

  const importerExtension = urlToExtension(importer);
  const fakeUrl = new URL(specifier, importer).href;
  const specifierExtension = urlToExtension(fakeUrl);

  if (specifierExtension !== "") {
    return specifier;
  } // I guess typescript still expect default extension to be .ts
  // in a tsx file.


  if (importerExtension === "tsx") {
    return `${specifier}.ts`;
  } // extension magic


  return `${specifier}${importerExtension}`;
};

const urlToExtension = url => {
  return pathnameToExtension(urlToPathname(url));
};

const urlToPathname = url => new URL(url).pathname;

const pathnameToExtension = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");

  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return ""; // if (dotLastIndex === pathname.length - 1) return ""

  const extension = pathname.slice(dotLastIndex);
  return extension;
};

const createImportResolverForImportmap = async ({
  // projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  importMap,
  importMapUrl,
  importDefaultExtension,
  onBareSpecifierError = () => {}
}) => {
  const _resolveImport = (specifier, importer) => {
    if (importDefaultExtension) {
      specifier = applyDefaultExtension(specifier, importer);
    }

    return resolveImport({
      specifier,
      importer,
      importMap,
      createBareSpecifierError: ({
        specifier,
        importer
      }) => {
        const bareSpecifierError = createBareSpecifierError({
          specifier,
          importer: tryToFindProjectRelativeUrl(importer, {
            compileServerOrigin,
            compileDirectoryRelativeUrl
          }) || importer,
          importMapUrl: tryToFindProjectRelativeUrl(importMapUrl, {
            compileServerOrigin,
            compileDirectoryRelativeUrl
          }) || importMapUrl,
          importMap
        });
        onBareSpecifierError(bareSpecifierError);
        return bareSpecifierError;
      }
    });
  };

  return {
    resolveImport: _resolveImport
  };
};

const createBareSpecifierError = ({
  specifier,
  importer,
  importMapUrl
}) => {
  const detailedMessage = createDetailedMessage("Unmapped bare specifier.", {
    specifier,
    importer,
    ...(importMapUrl ? {
      "how to fix": `Add a mapping for "${specifier}" into the importmap file at "${importMapUrl}"`
    } : {
      "how to fix": `Add an importmap with a mapping for "${specifier}"`,
      "suggestion": `Generate importmap using https://github.com/jsenv/importmap-node-module`
    })
  });
  return new Error(detailedMessage);
};

/*
* SJS 6.11.0
* Minimal SystemJS Build
*/
(function () {
  function errMsg(errCode, msg) {
    return (msg || "") + " (SystemJS https://git.io/JvFET#" + errCode + ")";
  }

  var hasSymbol = typeof Symbol !== 'undefined';
  var hasSelf = typeof self !== 'undefined';
  var hasDocument = typeof document !== 'undefined';
  var envGlobal = hasSelf ? self : global;
  var baseUrl;

  if (hasDocument) {
    var baseEl = document.querySelector('base[href]');
    if (baseEl) baseUrl = baseEl.href;
  }

  if (!baseUrl && typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    var lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1) baseUrl = baseUrl.slice(0, lastSepIndex + 1);
  }

  var backslashRegEx = /\\/g;

  function resolveIfNotPlainOrUrl(relUrl, parentUrl) {
    if (relUrl.indexOf('\\') !== -1) relUrl = relUrl.replace(backslashRegEx, '/'); // protocol-relative

    if (relUrl[0] === '/' && relUrl[1] === '/') {
      return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
    } // relative-url
    else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) || relUrl.length === 1 && (relUrl += '/')) || relUrl[0] === '/') {
      var parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1); // Disabled, but these cases will give inconsistent results for deep backtracking
      //if (parentUrl[parentProtocol.length] !== '/')
      //  throw Error('Cannot resolve');
      // read pathname from parent URL
      // pathname taken to be part after leading "/"

      var pathname;

      if (parentUrl[parentProtocol.length + 1] === '/') {
        // resolving to a :// so we need to read out the auth and host
        if (parentProtocol !== 'file:') {
          pathname = parentUrl.slice(parentProtocol.length + 2);
          pathname = pathname.slice(pathname.indexOf('/') + 1);
        } else {
          pathname = parentUrl.slice(8);
        }
      } else {
        // resolving to :/ so pathname is the /... part
        pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
      }

      if (relUrl[0] === '/') return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl; // join together and split for removal of .. and . segments
      // looping the string instead of anything fancy for perf reasons
      // '../../../../../z' resolved to 'x/y' is just 'z'

      var segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;
      var output = [];
      var segmentIndex = -1;

      for (var i = 0; i < segmented.length; i++) {
        // busy reading a segment - only terminate on '/'
        if (segmentIndex !== -1) {
          if (segmented[i] === '/') {
            output.push(segmented.slice(segmentIndex, i + 1));
            segmentIndex = -1;
          }
        } // new segment - check if it is relative
        else if (segmented[i] === '.') {
          // ../ segment
          if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
            output.pop();
            i += 2;
          } // ./ segment
          else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
            i += 1;
          } else {
            // the start of a new segment as below
            segmentIndex = i;
          }
        } // it is the start of a new segment
        else {
          segmentIndex = i;
        }
      } // finish reading out the last segment


      if (segmentIndex !== -1) output.push(segmented.slice(segmentIndex));
      return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
    }
  }
  /*
   * Import maps implementation
   *
   * To make lookups fast we pre-resolve the entire import map
   * and then match based on backtracked hash lookups
   *
   */


  function resolveUrl(relUrl, parentUrl) {
    return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (relUrl.indexOf(':') !== -1 ? relUrl : resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
  }

  function resolveAndComposePackages(packages, outPackages, baseUrl, parentMap, parentUrl) {
    for (var p in packages) {
      var resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p;
      var rhs = packages[p]; // package fallbacks not currently supported

      if (typeof rhs !== 'string') continue;
      var mapped = resolveImportMap(parentMap, resolveIfNotPlainOrUrl(rhs, baseUrl) || rhs, parentUrl);

      if (!mapped) {
        targetWarning('W1', p, rhs);
      } else outPackages[resolvedLhs] = mapped;
    }
  }

  function resolveAndComposeImportMap(json, baseUrl, outMap) {
    if (json.imports) resolveAndComposePackages(json.imports, outMap.imports, baseUrl, outMap, null);
    var u;

    for (u in json.scopes || {}) {
      var resolvedScope = resolveUrl(u, baseUrl);
      resolveAndComposePackages(json.scopes[u], outMap.scopes[resolvedScope] || (outMap.scopes[resolvedScope] = {}), baseUrl, outMap, resolvedScope);
    }

    for (u in json.depcache || {}) outMap.depcache[resolveUrl(u, baseUrl)] = json.depcache[u];

    for (u in json.integrity || {}) outMap.integrity[resolveUrl(u, baseUrl)] = json.integrity[u];
  }

  function getMatch(path, matchObj) {
    if (matchObj[path]) return path;
    var sepIndex = path.length;

    do {
      var segment = path.slice(0, sepIndex + 1);
      if (segment in matchObj) return segment;
    } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1);
  }

  function applyPackages(id, packages) {
    var pkgName = getMatch(id, packages);

    if (pkgName) {
      var pkg = packages[pkgName];
      if (pkg === null) return;

      if (id.length > pkgName.length && pkg[pkg.length - 1] !== '/') {
        targetWarning('W2', pkgName, pkg);
      } else return pkg + id.slice(pkgName.length);
    }
  }

  function targetWarning(code, match, target, msg) {
    console.warn(errMsg(code, [target, match].join(', ')));
  }

  function resolveImportMap(importMap, resolvedOrPlain, parentUrl) {
    var scopes = importMap.scopes;
    var scopeUrl = parentUrl && getMatch(parentUrl, scopes);

    while (scopeUrl) {
      var packageResolution = applyPackages(resolvedOrPlain, scopes[scopeUrl]);
      if (packageResolution) return packageResolution;
      scopeUrl = getMatch(scopeUrl.slice(0, scopeUrl.lastIndexOf('/')), scopes);
    }

    return applyPackages(resolvedOrPlain, importMap.imports) || resolvedOrPlain.indexOf(':') !== -1 && resolvedOrPlain;
  }
  /*
   * SystemJS Core
   *
   * Provides
   * - System.import
   * - System.register support for
   *     live bindings, function hoisting through circular references,
   *     reexports, dynamic import, import.meta.url, top-level await
   * - System.getRegister to get the registration
   * - Symbol.toStringTag support in Module objects
   * - Hookable System.createContext to customize import.meta
   * - System.onload(err, id, deps) handler for tracing / hot-reloading
   *
   * Core comes with no System.prototype.resolve or
   * System.prototype.instantiate implementations
   */


  var toStringTag = hasSymbol && Symbol.toStringTag;
  var REGISTRY = hasSymbol ? Symbol() : '@';

  function SystemJS() {
    this[REGISTRY] = {};
  }

  var systemJSPrototype = SystemJS.prototype;

  systemJSPrototype.import = function (id, parentUrl) {
    var loader = this;
    return Promise.resolve(loader.prepareImport()).then(function () {
      return loader.resolve(String(id), parentUrl);
    }).then(function (id) {
      var load = getOrCreateLoad(loader, id);
      return load.C || topLevelLoad(loader, load);
    });
  }; // Hookable createContext function -> allowing eg custom import meta


  systemJSPrototype.createContext = function (parentId) {
    var loader = this;
    return {
      url: parentId,
      resolve: function (id, parentUrl) {
        return Promise.resolve(loader.resolve(id, parentUrl || parentId));
      }
    };
  };

  var lastRegister;

  systemJSPrototype.register = function (deps, declare) {
    lastRegister = [deps, declare];
  };
  /*
   * getRegister provides the last anonymous System.register call
   */


  systemJSPrototype.getRegister = function () {
    var _lastRegister = lastRegister;
    lastRegister = undefined;
    return _lastRegister;
  };

  function getOrCreateLoad(loader, id, firstParentUrl) {
    var load = loader[REGISTRY][id];
    if (load) return load;
    var importerSetters = [];
    var ns = Object.create(null);
    if (toStringTag) Object.defineProperty(ns, toStringTag, {
      value: 'Module'
    });
    var instantiatePromise = Promise.resolve().then(function () {
      return loader.instantiate(id, firstParentUrl);
    }).then(function (registration) {
      if (!registration) throw Error(errMsg(2, id));

      function _export(name, value) {
        // note if we have hoisted exports (including reexports)
        load.h = true;
        var changed = false;

        if (typeof name === 'string') {
          if (!(name in ns) || ns[name] !== value) {
            ns[name] = value;
            changed = true;
          }
        } else {
          for (var p in name) {
            var value = name[p];

            if (!(p in ns) || ns[p] !== value) {
              ns[p] = value;
              changed = true;
            }
          }

          if (name && name.__esModule) {
            ns.__esModule = name.__esModule;
          }
        }

        if (changed) for (var i = 0; i < importerSetters.length; i++) {
          var setter = importerSetters[i];
          if (setter) setter(ns);
        }
        return value;
      }

      var declared = registration[1](_export, registration[1].length === 2 ? {
        import: function (importId) {
          return loader.import(importId, id);
        },
        meta: loader.createContext(id)
      } : undefined);

      load.e = declared.execute || function () {};

      return [registration[0], declared.setters || []];
    }, function (err) {
      load.e = null;
      load.er = err;
      throw err;
    });
    var linkPromise = instantiatePromise.then(function (instantiation) {
      return Promise.all(instantiation[0].map(function (dep, i) {
        var setter = instantiation[1][i];
        return Promise.resolve(loader.resolve(dep, id)).then(function (depId) {
          var depLoad = getOrCreateLoad(loader, depId, id); // depLoad.I may be undefined for already-evaluated

          return Promise.resolve(depLoad.I).then(function () {
            if (setter) {
              depLoad.i.push(setter); // only run early setters when there are hoisted exports of that module
              // the timing works here as pending hoisted export calls will trigger through importerSetters

              if (depLoad.h || !depLoad.I) setter(depLoad.n);
            }

            return depLoad;
          });
        });
      })).then(function (depLoads) {
        load.d = depLoads;
      });
    }); // Capital letter = a promise function

    return load = loader[REGISTRY][id] = {
      id: id,
      // importerSetters, the setters functions registered to this dependency
      // we retain this to add more later
      i: importerSetters,
      // module namespace object
      n: ns,
      // instantiate
      I: instantiatePromise,
      // link
      L: linkPromise,
      // whether it has hoisted exports
      h: false,
      // On instantiate completion we have populated:
      // dependency load records
      d: undefined,
      // execution function
      e: undefined,
      // On execution we have populated:
      // the execution error if any
      er: undefined,
      // in the case of TLA, the execution promise
      E: undefined,
      // On execution, L, I, E cleared
      // Promise for top-level completion
      C: undefined,
      // parent instantiator / executor
      p: undefined
    };
  }

  function instantiateAll(loader, load, parent, loaded) {
    if (!loaded[load.id]) {
      loaded[load.id] = true; // load.L may be undefined for already-instantiated

      return Promise.resolve(load.L).then(function () {
        if (!load.p || load.p.e === null) load.p = parent;
        return Promise.all(load.d.map(function (dep) {
          return instantiateAll(loader, dep, parent, loaded);
        }));
      }).catch(function (err) {
        if (load.er) throw err;
        load.e = null;
        throw err;
      });
    }
  }

  function topLevelLoad(loader, load) {
    return load.C = instantiateAll(loader, load, load, {}).then(function () {
      return postOrderExec(loader, load, {});
    }).then(function () {
      return load.n;
    });
  } // the closest we can get to call(undefined)


  var nullContext = Object.freeze(Object.create(null)); // returns a promise if and only if a top-level await subgraph
  // throws on sync errors

  function postOrderExec(loader, load, seen) {
    if (seen[load.id]) return;
    seen[load.id] = true;

    if (!load.e) {
      if (load.er) throw load.er;
      if (load.E) return load.E;
      return;
    } // deps execute first, unless circular


    var depLoadPromises;
    load.d.forEach(function (depLoad) {
      try {
        var depLoadPromise = postOrderExec(loader, depLoad, seen);
        if (depLoadPromise) (depLoadPromises = depLoadPromises || []).push(depLoadPromise);
      } catch (err) {
        load.e = null;
        load.er = err;
        throw err;
      }
    });
    if (depLoadPromises) return Promise.all(depLoadPromises).then(doExec);
    return doExec();

    function doExec() {
      try {
        var execPromise = load.e.call(nullContext);

        if (execPromise) {
          execPromise = execPromise.then(function () {
            load.C = load.n;
            load.E = null; // indicates completion

            if (!true) ;
          }, function (err) {
            load.er = err;
            load.E = null;
            if (!true) ;
            throw err;
          });
          return load.E = execPromise;
        } // (should be a promise, but a minify optimization to leave out Promise.resolve)


        load.C = load.n;
        load.L = load.I = undefined;
      } catch (err) {
        load.er = err;
        throw err;
      } finally {
        load.e = null;
      }
    }
  }

  envGlobal.System = new SystemJS();
  /*
   * SystemJS browser attachments for script and import map processing
   */

  var importMapPromise = Promise.resolve();
  var importMap = {
    imports: {},
    scopes: {},
    depcache: {},
    integrity: {}
  };
  systemJSPrototype.importMap = importMap;
  systemJSPrototype.baseUrl = baseUrl; // Scripts are processed immediately, on the first System.import, and on DOMReady.
  // Import map scripts are processed only once (by being marked) and in order for each phase.
  // This is to avoid using DOM mutation observers in core, although that would be an alternative.

  var processFirst = hasDocument;

  systemJSPrototype.prepareImport = function (doProcessScripts) {
    if (processFirst || doProcessScripts) {
      processScripts();
      processFirst = false;
    }

    return importMapPromise;
  };

  if (hasDocument) {
    processScripts();
    window.addEventListener('DOMContentLoaded', processScripts);
  }

  function processScripts() {
    [].forEach.call(document.querySelectorAll('script'), function (script) {
      if (script.sp) // sp marker = systemjs processed
        return; // TODO: deprecate systemjs-module in next major now that we have auto import

      if (script.type === 'systemjs-module') {
        script.sp = true;
        if (!script.src) return;
        System.import(script.src.slice(0, 7) === 'import:' ? script.src.slice(7) : resolveUrl(script.src, baseUrl)).catch(function (e) {
          // if there is a script load error, dispatch an "error" event
          // on the script tag.
          if (e.message.indexOf('https://git.io/JvFET#3') > -1) {
            var event = document.createEvent('Event');
            event.initEvent('error', false, false);
            script.dispatchEvent(event);
          }

          return Promise.reject(e);
        });
      } else if (script.type === 'systemjs-importmap') {
        script.sp = true;
        var fetchPromise = script.src ? fetch(script.src, {
          integrity: script.integrity
        }).then(function (res) {
          if (!res.ok) throw Error(res.status);
          return res.text();
        }).catch(function (err) {
          err.message = errMsg('W4', script.src) + '\n' + err.message;
          console.warn(err);

          if (typeof script.onerror === 'function') {
            script.onerror();
          }

          return '{}';
        }) : script.innerHTML;
        importMapPromise = importMapPromise.then(function () {
          return fetchPromise;
        }).then(function (text) {
          extendImportMap(importMap, text, script.src || baseUrl);
          return importMap;
        });
      }
    });
  }

  function extendImportMap(importMap, newMapText, newMapUrl) {
    var newMap = {};

    try {
      newMap = JSON.parse(newMapText);
    } catch (err) {
      console.warn(Error(errMsg('W5')));
    }

    resolveAndComposeImportMap(newMap, newMapUrl, importMap);
  }

  System.extendImportMap = extendImportMap;
  /*
   * Script instantiation loading
   */

  if (hasDocument) {
    window.addEventListener('error', function (evt) {
      lastWindowErrorUrl = evt.filename;
      lastWindowError = evt.error;
    });
    var baseOrigin = location.origin;
  }

  systemJSPrototype.createScript = function (url) {
    var script = document.createElement('script');
    script.async = true; // Only add cross origin for actual cross origin
    // this is because Safari triggers for all
    // - https://bugs.webkit.org/show_bug.cgi?id=171566

    if (url.indexOf(baseOrigin + '/')) script.crossOrigin = 'anonymous';
    var integrity = importMap.integrity[url];
    if (integrity) script.integrity = integrity;
    script.src = url;
    return script;
  }; // Auto imports -> script tags can be inlined directly for load phase


  var lastAutoImportDeps, lastAutoImportTimeout;
  var autoImportCandidates = {};
  var systemRegister = systemJSPrototype.register;
  var inlineScriptCount = 0;

  systemJSPrototype.register = function (deps, declare, autoUrl) {
    if (hasDocument && document.readyState === 'loading' && typeof deps !== 'string') {
      var scripts = document.querySelectorAll('script[src]');
      var lastScript = scripts[scripts.length - 1];
      var lastAutoImportUrl;
      lastAutoImportDeps = deps;

      if (lastScript && lastScript.src) {
        lastAutoImportUrl = lastScript.src;
      } else if (autoUrl) {
        lastAutoImportUrl = autoUrl;
      } else {
        inlineScriptCount++;
        lastAutoImportUrl = document.location.href + "__inline_script__" + inlineScriptCount;
      } // if this is already a System load, then the instantiate has already begun
      // so this re-import has no consequence


      var loader = this;
      lastAutoImportTimeout = setTimeout(function () {
        autoImportCandidates[lastAutoImportUrl] = [deps, declare];
        loader.import(lastAutoImportUrl);
      });
    } else {
      lastAutoImportDeps = undefined;
    }

    return systemRegister.call(this, deps, declare);
  };

  var lastWindowErrorUrl, lastWindowError;

  systemJSPrototype.instantiate = function (url, firstParentUrl) {
    var autoImportRegistration = autoImportCandidates[url];

    if (autoImportRegistration) {
      delete autoImportCandidates[url];
      return autoImportRegistration;
    }

    var loader = this;
    return Promise.resolve(systemJSPrototype.createScript(url)).then(function (script) {
      return new Promise(function (resolve, reject) {
        script.addEventListener('error', function () {
          reject(Error(errMsg(3, [url, firstParentUrl].join(', '))));
        });
        script.addEventListener('load', function () {
          document.head.removeChild(script); // Note that if an error occurs that isn't caught by this if statement,
          // that getRegister will return null and a "did not instantiate" error will be thrown.

          if (lastWindowErrorUrl === url) {
            reject(lastWindowError);
          } else {
            var register = loader.getRegister(url); // Clear any auto import registration for dynamic import scripts during load

            if (register && register[0] === lastAutoImportDeps) clearTimeout(lastAutoImportTimeout);
            resolve(register);
          }
        });
        document.head.appendChild(script);
      });
    });
  };
  /*
   * Fetch loader, sets up shouldFetch and fetch hooks
   */


  systemJSPrototype.shouldFetch = function () {
    return false;
  };

  if (typeof fetch !== 'undefined') systemJSPrototype.fetch = fetch;
  var instantiate = systemJSPrototype.instantiate;
  var jsContentTypeRegEx = /^(text|application)\/(x-)?javascript(;|$)/;

  systemJSPrototype.instantiate = function (url, parent) {
    var loader = this;
    if (!this.shouldFetch(url)) return instantiate.apply(this, arguments);
    return this.fetch(url, {
      credentials: 'same-origin',
      integrity: importMap.integrity[url]
    }).then(function (res) {
      if (!res.ok) throw Error(errMsg(7, [res.status, res.statusText, url, parent].join(', ')));
      var contentType = res.headers.get('content-type');
      if (!contentType || !jsContentTypeRegEx.test(contentType)) throw Error(errMsg(4, contentType));
      return res.text().then(function (source) {
        if (source.indexOf('//# sourceURL=') < 0) source += '\n//# sourceURL=' + url;
        (0, eval)(source);
        return loader.getRegister(url);
      });
    });
  };

  systemJSPrototype.resolve = function (id, parentUrl) {
    parentUrl = parentUrl || !true || baseUrl;
    return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
  };

  function throwUnresolved(id, parentUrl) {
    throw Error(errMsg(8, [id, parentUrl].join(', ')));
  }

  var systemInstantiate = systemJSPrototype.instantiate;

  systemJSPrototype.instantiate = function (url, firstParentUrl) {
    var preloads = importMap.depcache[url];

    if (preloads) {
      for (var i = 0; i < preloads.length; i++) getOrCreateLoad(this, this.resolve(preloads[i], url), url);
    }

    return systemInstantiate.call(this, url, firstParentUrl);
  };
  /*
   * Supports loading System.register in workers
   */


  if (hasSelf && typeof importScripts === 'function') {
    systemJSPrototype.instantiate = function (url) {
      var loader = this;
      return self.fetch(url, {
        credentials: 'same-origin'
      }).then(function (response) {
        if (!response.ok) {
          throw Error(errMsg(7, [response.status, response.statusText, url].join(', ')));
        }

        return response.text();
      }).then(function (source) {
        if (source.indexOf('//# sourceURL=') < 0) source += '\n//# sourceURL=' + url;
        (0, eval)(source);
        return loader.getRegister(url);
      });
    };
  }
})();

(function () {
  var envGlobal = typeof self !== 'undefined' ? self : global;
  var System = envGlobal.System;
  var registerRegistry = Object.create(null);
  var register = System.register;
  System.registerRegistry = registerRegistry;

  System.register = function (name, deps, declare) {
    if (typeof name !== 'string') return register.apply(this, arguments);
    var define = [deps, declare];
    return System.prepareImport().then(function () {
      var url = System.resolve(`./${name}`);
      registerRegistry[url] = define;
      return register.call(System, deps, declare, url);
    });
  };

  var instantiate = System.instantiate;

  System.instantiate = function (url, firstParentUrl) {
    var result = registerRegistry[url];

    if (result) {
      registerRegistry[url] = null;
      return result;
    } else {
      return instantiate.call(this, url, firstParentUrl);
    }
  };

  var getRegister = System.getRegister;

  System.getRegister = function (url) {
    // Calling getRegister() because other extras need to know it was called so they can perform side effects
    var register = getRegister.call(this, url);
    var result = registerRegistry[url] || register;
    return result;
  };
})();

(function () {
  // worker or service worker
  if (typeof WorkerGlobalScope === 'function' && self instanceof WorkerGlobalScope) {
    var importMapFromParentPromise = new Promise(resolve => {
      var importmapMessageCallback = function (e) {
        if (e.data === "__importmap_init__") {
          self.removeEventListener("message", importmapMessageCallback);

          e.ports[0].onmessage = message => {
            resolve(message.data);
          };

          e.ports[0].postMessage('__importmap_request__');
        }
      };

      self.addEventListener("message", importmapMessageCallback);
    }); // var prepareImport = System.prepareImport

    System.prepareImport = function () {
      return importMapFromParentPromise.then(function (importmap) {
        System.extendImportMap(System.importMap, JSON.stringify(importmap), System.baseUrl);
      });
    }; // auto import first register


    var messageEvents = [];

    var messageCallback = event => {
      messageEvents.push(event);
    };

    self.addEventListener('message', messageCallback);
    var register = System.register;

    System.register = function (deps, declare) {
      System.register = register;
      System.registerRegistry[self.location.href] = [deps, declare];
      return System.import(self.location.href).then(result => {
        self.removeEventListener('message', messageCallback);
        messageEvents.forEach(messageEvent => {
          self.dispatchEvent(messageEvent);
        });
        messageEvents = null;
        return result;
      });
    };
  } else if (typeof window === 'object') {
    var WorkerConstructor = window.Worker;

    if (typeof WorkerConstructor === 'function') {
      window.Worker = function (url, options) {
        var worker = new WorkerConstructor(url, options);
        var importmapChannel = new MessageChannel();

        importmapChannel.port1.onmessage = function (message) {
          System.prepareImport().then(function (importmap) {
            message.target.postMessage(importmap);
          });
        };

        worker.postMessage('__importmap_init__', [importmapChannel.port2]);
        return worker;
      };
    }

    var serviceWorker = navigator.serviceWorker;

    if (serviceWorker) {
      var register = serviceWorker.register;

      serviceWorker.register = function (url, options) {
        var registrationPromise = register.call(this, url, options);
        registrationPromise.then(function (registration) {
          var installing = registration.installing;
          var waiting = registration.waiting;
          var active = registration.active;
          var worker = installing || waiting || active;
          var importmapChannel = new MessageChannel();

          importmapChannel.port1.onmessage = function (message) {
            System.prepareImport().then(function (importmap) {
              message.target.postMessage(importmap);
            });
          };

          worker.postMessage('__importmap_init__', [importmapChannel.port2]);
        });
        return registrationPromise;
      };
    }
  }
})();

const createBrowserSystem = ({
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  importResolver,
  fetchSource
}) => {
  if (typeof window.System === "undefined") {
    throw new Error(`window.System is undefined`);
  }

  const browserSystem = window.System;

  const resolve = (specifier, importer = document.location.href) => {
    return importResolver.resolveImport(specifier, importer);
  };

  browserSystem.resolve = resolve;
  const instantiate = browserSystem.instantiate;

  browserSystem.instantiate = async function (url, importerUrl) {
    const {
      importType,
      urlWithoutImportType
    } = extractImportTypeFromUrl(url);

    if (importType === "json") {
      const jsonModule = await instantiateAsJsonModule(urlWithoutImportType, {
        browserSystem,
        fetchSource
      });
      return jsonModule;
    }

    if (importType === "css") {
      const cssModule = await instantiateAsCssModule(urlWithoutImportType, {
        browserSystem,
        importerUrl,
        compileDirectoryRelativeUrl,
        fetchSource
      });
      return cssModule;
    }

    try {
      const registration = await instantiate.call(this, url, importerUrl);

      if (!registration) {
        throw new Error(`no registration found for JS at ${url}
--- importer url ---
${importerUrl}
--- navigator.vendor ---
${window.navigator.vendor}`);
      }

      return registration;
    } catch (e) {
      const jsenvError = await createDetailedInstantiateError({
        instantiateError: e,
        url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
        fetchSource
      });
      throw jsenvError;
    }
  };

  browserSystem.createContext = importerUrl => {
    return {
      url: importerUrl,
      resolve: specifier => resolve(specifier, importerUrl)
    };
  };

  return browserSystem;
};

const extractImportTypeFromUrl = url => {
  const urlObject = new URL(url);
  const {
    search
  } = urlObject;
  const searchParams = new URLSearchParams(search);
  const importType = searchParams.get("import_type");

  if (!importType) {
    return {};
  }

  searchParams.delete("import_type");
  urlObject.search = String(searchParams);
  return {
    importType,
    urlWithoutImportType: urlObject.href
  };
};

const instantiateAsJsonModule = async (url, {
  browserSystem,
  fetchSource
}) => {
  const response = await fetchSource(url, {
    contentTypeExpected: "application/json"
  });
  const json = await response.json();
  browserSystem.register([], _export => {
    return {
      execute: () => {
        _export("default", json);
      }
    };
  });
  const registration = browserSystem.getRegister(url);

  if (!registration) {
    throw new Error(`no registration found for JSON at ${url}. Navigator.vendor: ${window.navigator.vendor}. JSON text: ${json}`);
  }

  return registration;
};

const instantiateAsCssModule = async (url, {
  importerUrl,
  browserSystem,
  fetchSource
}) => {
  const response = await fetchSource(url, {
    contentTypeExpected: "text/css"
  }); // There is a logic inside "file_changes.js" which is reloading
  // all link rel="stylesheet" when a file ending with ".css" is modified
  // But here it would not work because we have to replace the css in
  // the adopted stylesheet + all module importing this css module
  // should be reinstantiated
  // -> the default behaviour for this CSS file should be a page reload

  const {
    reloadMetas
  } = window.__jsenv_event_source_client__; // if below is to respect if import.meta.hot is called for this CSS file
  // TODO: it's not the right way to check
  // because code would do

  /*
  import style from "./style.css" assert { type: 'css' }
  
  if (import.meta.hot) {
    let currentStyle = style
    import.meta.hot.accept('./style.css', (newStyle) => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== currentStyle);
      document.adoptedStylesheets = [...document.adoptedStyleSheets, newStyle]
      currentStyle = newStyle
    })
  }
  */

  if (!reloadMetas[url]) {
    reloadMetas[url] = "decline";
  }

  const cssText = await response.text();
  const cssTextWithBaseUrl = cssWithBaseUrl({
    cssText,
    cssUrl: url,
    baseUrl: importerUrl
  });
  browserSystem.register([], _export => {
    return {
      execute: () => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssTextWithBaseUrl);

        _export("default", sheet);
      }
    };
  });
  const registration = browserSystem.getRegister(url);

  if (!registration) {
    throw new Error(`no registration found for CSS at ${url}. Navigator.vendor: ${window.navigator.vendor}. CSS text: ${cssTextWithBaseUrl}`);
  }

  return registration;
}; // CSSStyleSheet accepts a "baseUrl" parameter
// as documented in https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet#parameters
// Unfortunately the polyfill do not seems to implement it
// So we reuse "systemjs" strategy from https://github.com/systemjs/systemjs/blob/98609dbeef01ec62447e4b21449ce47e55f818bd/src/extras/module-types.js#L37


const cssWithBaseUrl = ({
  cssUrl,
  cssText,
  baseUrl
}) => {
  const cssDirectoryUrl = new URL("./", cssUrl).href;
  const baseDirectoryUrl = new URL("./", baseUrl).href;

  if (cssDirectoryUrl === baseDirectoryUrl) {
    return cssText;
  }

  const cssTextRelocated = cssText.replace(/url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g, (match, quotes, relUrl1, relUrl2) => {
    const absoluteUrl = new URL(relUrl1 || relUrl2, cssUrl).href;
    return `url(${quotes}${absoluteUrl}${quotes})`;
  });
  return cssTextRelocated;
};

const createDetailedInstantiateError = async ({
  instantiateError,
  url,
  importerUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  fetchSource
}) => {
  let response;

  try {
    response = await fetchSource(url, {
      importerUrl,
      contentTypeExpected: "application/javascript"
    });
  } catch (e) {
    e.code = "NETWORK_FAILURE";
    return e;
  }

  const jsModuleResponseError = await getJavaScriptModuleResponseError(response, {
    url,
    importerUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl
  });
  return jsModuleResponseError || instantiateError;
};

const {
  performance: performance$1
} = window;
const measureAsyncFnPerf = performance$1 ? async (fn, name) => {
  const perfMarkStartName = `${name}_start`;
  performance$1.mark(perfMarkStartName);

  try {
    const value = await fn();
    return value;
  } finally {
    performance$1.measure(name, perfMarkStartName);
  }
} : async fn => {
  return fn();
};

const makeModuleNamespaceTransferable = namespace => {
  const transferableNamespace = {};
  Object.keys(namespace).forEach(key => {
    const value = namespace[key];
    transferableNamespace[key] = isTransferable(value) ? value : hideNonTransferableValue(value);
  });
  return transferableNamespace;
};

const hideNonTransferableValue = value => {
  if (typeof value === "function") {
    return `[[HIDDEN: ${value.name} function cannot be transfered]]`;
  }

  if (typeof value === "symbol") {
    return `[[HIDDEN: symbol function cannot be transfered]]`;
  }

  return `[[HIDDEN: ${value.constructor ? value.constructor.name : "object"} cannot be transfered]]`;
}; // https://stackoverflow.com/a/32673910/2634179


const isTransferable = value => {
  const seenArray = [];

  const visit = () => {
    if (typeof value === "function") return false;
    if (typeof value === "symbol") return false;
    if (value === null) return false;

    if (typeof value === "object") {
      const constructorName = value.constructor.namespace;

      if (supportedTypes.includes(constructorName)) {
        return true;
      }

      const maybe = maybeTypes.includes(constructorName);

      if (maybe) {
        const visited = seenArray.includes(value);

        if (visited) {
          // we don't really know until we are done visiting the object
          // implementing it properly means waiting for the recursion to be done
          // let's just
          return true;
        }

        seenArray.push(value);

        if (constructorName === "Array" || constructorName === "Object") {
          return Object.keys(value).every(key => isTransferable(value[key]));
        }

        if (constructorName === "Map") {
          return [...value.keys()].every(isTransferable) && [...value.values()].every(isTransferable);
        }

        if (constructorName === "Set") {
          return [...value.keys()].every(isTransferable);
        }
      } // Error, DOM Node and others


      return false;
    }

    return true;
  };

  return visit(value);
};

const supportedTypes = ["Boolean", "Number", "String", "Date", "RegExp", "Blob", "FileList", "ImageData", "ImageBitmap", "ArrayBuffer"];
const maybeTypes = ["Array", "Object", "Map", "Set"];

const memoizedCreateBrowserSystem = memoize(createBrowserSystem);
const createBrowserClient = async ({
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,
  compileId
}) => {
  const fetchSource = (url, {
    contentTypeExpected
  }) => {
    return fetchUrl(url, {
      credentials: "same-origin",
      contentTypeExpected
    });
  };

  const fetchJson = async url => {
    const response = await fetchSource(url, {
      contentTypeExpected: "application/json"
    });
    const json = await response.json();
    return json;
  };

  const compileServerMetaUrl = String(new URL("__jsenv_compile_profile__", `${compileServerOrigin}/`));
  const {
    importDefaultExtension
  } = await fetchJson(compileServerMetaUrl);
  const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/`; // if there is an importmap in the document we use it instead of fetching.
  // systemjs style with systemjs-importmap

  const importmapScript = document.querySelector(`script[type="systemjs-importmap"]`);
  let importMap;
  let importMapUrl;

  if (importmapScript) {
    let importmapRaw;

    if (importmapScript.src) {
      importMapUrl = importmapScript.src;
      const importmapFileResponse = await fetchSource(importMapUrl, {
        contentTypeExpected: "application/importmap+json"
      });
      importmapRaw = importmapFileResponse.status === 404 ? {} : await importmapFileResponse.json();
    } else {
      importMapUrl = document.location.href;
      importmapRaw = JSON.parse(importmapScript.textContent) || {};
    }

    importMap = normalizeImportMap(importmapRaw, importMapUrl);
  }

  const importResolver = await createImportResolverForImportmap({
    // projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
    importMap,
    importMapUrl,
    importDefaultExtension
  });

  const importFile = async specifier => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      fetchSource,
      importResolver
    });
    return browserSystem.import(specifier);
  };

  const executeFile = async (specifier, {
    transferableNamespace = false,
    executionExposureOnWindow = false,
    errorTransform = error => error,
    measurePerformance
  } = {}) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      fetchSource,
      importResolver
    });

    const importUsingSystemJs = async () => {
      try {
        let namespace = await browserSystem.import(specifier);

        if (transferableNamespace) {
          namespace = makeModuleNamespaceTransferable(namespace);
        }

        return {
          status: "completed",
          namespace,
          coverage: readCoverage$1()
        };
      } catch (error) {
        let transformedError;

        try {
          transformedError = await errorTransform(error);
        } catch (e) {
          transformedError = error;
        }

        return {
          status: "errored",
          error: transformedError,
          coverage: readCoverage$1()
        };
      }
    };

    const executionResult = await (measurePerformance ? measureAsyncFnPerf(importUsingSystemJs, `jsenv_file_import`) : importUsingSystemJs());

    if (executionExposureOnWindow) {
      window.__executionResult__ = executionResult;
    }

    return executionResult;
  };

  return {
    compileDirectoryRelativeUrl,
    importFile,
    executeFile
  };
};

const readCoverage$1 = () => window.__coverage__;

/* eslint-env browser, node */
const DataUrl = {
  parse: (string, {
    as = "raw"
  } = {}) => {
    const afterDataProtocol = string.slice("data:".length);
    const commaIndex = afterDataProtocol.indexOf(",");
    const beforeComma = afterDataProtocol.slice(0, commaIndex);
    let mediaType;
    let base64Flag;

    if (beforeComma.endsWith(`;base64`)) {
      mediaType = beforeComma.slice(0, -`;base64`.length);
      base64Flag = true;
    } else {
      mediaType = beforeComma;
      base64Flag = false;
    }

    const afterComma = afterDataProtocol.slice(commaIndex + 1);
    return {
      mediaType: mediaType === "" ? "text/plain;charset=US-ASCII" : mediaType,
      base64Flag,
      data: as === "string" && base64Flag ? base64ToString(afterComma) : afterComma
    };
  },
  stringify: ({
    mediaType,
    base64Flag = true,
    data
  }) => {
    if (!mediaType || mediaType === "text/plain;charset=US-ASCII") {
      // can be a buffer or a string, hence check on data.length instead of !data or data === ''
      if (data.length === 0) {
        return `data:,`;
      }

      if (base64Flag) {
        return `data:,${data}`;
      }

      return `data:,${dataToBase64(data)}`;
    }

    if (base64Flag) {
      return `data:${mediaType};base64,${dataToBase64(data)}`;
    }

    return `data:${mediaType},${data}`;
  }
};
const dataToBase64 = typeof window === "object" ? window.atob : data => Buffer.from(data).toString("base64");
const base64ToString = typeof window === "object" ? window.btoa : base64String => Buffer.from(base64String, "base64").toString("utf8");

const getJavaScriptSourceMappingUrl = javaScriptSource => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, value => {
    sourceMappingUrl = value;
  });
  return sourceMappingUrl;
};
const javascriptSourceMappingUrlCommentRegexp = /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;

const replaceSourceMappingUrl = (source, regexp, callback) => {
  let lastSourceMappingUrl;
  let matchSourceMappingUrl;

  while (matchSourceMappingUrl = regexp.exec(source)) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }

  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index;
    const before = source.slice(0, index);
    const after = source.slice(index);
    const mappedAfter = after.replace(regexp, (match, firstGroup) => {
      return callback(firstGroup);
    });
    return `${before}${mappedAfter}`;
  }

  return source;
};

const startsWithWindowsDriveLetter = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};
const windowsFilePathToUrl = windowsFilePath => {
  return `file:///${replaceBackSlashesWithSlashes(windowsFilePath)}`;
};
const replaceBackSlashesWithSlashes = string => string.replace(/\\/g, "/");

const remapCallSite = async (callSite, {
  urlToSourcemapConsumer,
  resolveFile,
  readErrorStack,
  onFailure
}) => {
  if (callSite.isNative()) {
    return callSite;
  } // Most call sites will return the source file from getFileName(), but code
  // passed to eval() ending in "//# sourceURL=..." will return the source file
  // from getScriptNameOrSourceURL() instead


  const source = callSite.getFileName() || callSite.getScriptNameOrSourceURL();

  if (source) {
    const line = callSite.getLineNumber();
    const column = callSite.getColumnNumber() - 1;
    const originalPosition = await remapSourcePosition({
      source,
      line,
      column,
      resolveFile,
      urlToSourcemapConsumer,
      readErrorStack,
      onFailure
    });
    const callSiteClone = cloneCallSite(callSite);

    callSiteClone.getFunctionName = () => originalPosition.name || callSite.getFunctionName();

    callSiteClone.getFileName = () => originalPosition.source;

    callSiteClone.getLineNumber = () => originalPosition.line;

    callSiteClone.getColumnNumber = () => originalPosition.column + 1;

    callSiteClone.getScriptNameOrSourceURL = () => originalPosition.source;

    return callSiteClone;
  } // Code called using eval() needs special handling


  if (callSite.isEval()) {
    const origin = callSite.getEvalOrigin();

    if (origin) {
      const callSiteClone = cloneCallSite(callSite);
      const originalEvalOrigin = await remapEvalOrigin(origin, {
        resolveFile,
        urlToSourcemapConsumer,
        readErrorStack,
        onFailure
      });

      callSiteClone.getEvalOrigin = () => originalEvalOrigin;

      return callSiteClone;
    }

    return callSite;
  } // If we get here then we were unable to change the source position


  return callSite;
};

const cloneCallSite = callSite => {
  const callSiteClone = {};
  methods.forEach(name => {
    callSiteClone[name] = () => callSite[name]();
  });

  callSiteClone.toString = () => callSiteToFunctionCall(callSiteClone);

  return callSiteClone;
};

const methods = ["getColumnNumber", "getEvalOrigin", "getFileName", "getFunction", "getFunctionName", "getLineNumber", "getMethodName", "getPosition", "getScriptNameOrSourceURL", "getThis", "getTypeName", "isConstructor", "isEval", "isNative", "isToplevel", "toString"];

const callSiteToFunctionCall = callSite => {
  const fileLocation = callSiteToFileLocation(callSite);
  const isConstructor = callSite.isConstructor();
  const isMethodCall = !callSite.isToplevel() && !isConstructor;

  if (isMethodCall) {
    return `${callSiteToMethodCall(callSite)} (${fileLocation})`;
  }

  const functionName = callSite.getFunctionName();

  if (isConstructor) {
    return `new ${functionName || "<anonymous>"} (${fileLocation})`;
  }

  if (functionName) {
    return `${functionName} (${fileLocation})`;
  }

  return `${fileLocation}`;
};

const callSiteToMethodCall = callSite => {
  const functionName = callSite.getFunctionName();
  const typeName = callSiteToType(callSite);

  if (!functionName) {
    return `${typeName}.<anonymous>`;
  }

  const methodName = callSite.getMethodName();
  const as = generateAs({
    methodName,
    functionName
  });

  if (typeName && !functionName.startsWith(typeName)) {
    return `${typeName}.${functionName}${as}`;
  }

  return `${functionName}${as}`;
};

const generateAs = ({
  methodName,
  functionName
}) => {
  if (!methodName) return "";
  if (functionName.indexOf(`.${methodName}`) === functionName.length - methodName.length - 1) return "";
  return ` [as ${methodName}]`;
};

const callSiteToType = callSite => {
  const typeName = callSite.getTypeName(); // Fixes shim to be backward compatible with Node v0 to v4

  if (typeName === "[object Object]") {
    return "null";
  }

  return typeName;
};

const callSiteToFileLocation = callSite => {
  if (callSite.isNative()) return "native";
  const sourceFile = callSiteToSourceFile(callSite);
  const lineNumber = callSite.getLineNumber();

  if (lineNumber === null) {
    return sourceFile;
  }

  const columnNumber = callSite.getColumnNumber();

  if (!columnNumber) {
    return `${sourceFile}:${lineNumber}`;
  }

  return `${sourceFile}:${lineNumber}:${columnNumber}`;
};

const callSiteToSourceFile = callSite => {
  const fileName = callSite.getScriptNameOrSourceURL();

  if (fileName) {
    return fileName;
  } // Source code does not originate from a file and is not native, but we
  // can still get the source position inside the source string, e.g. in
  // an eval string.


  if (callSite.isEval()) {
    return `${callSite.getEvalOrigin()}, <anonymous>`;
  }

  return "<anonymous>";
}; // Parses code generated by FormatEvalOrigin(), a function inside V8:
// https://code.google.com/p/v8/source/browse/trunk/src/messages.js


const remapEvalOrigin = async (origin, {
  resolveFile,
  urlToSourcemapConsumer,
  onFailure
}) => {
  // Most eval() calls are in this format
  const topLevelEvalMatch = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(origin);

  if (topLevelEvalMatch) {
    const source = topLevelEvalMatch[2];
    const line = Number(topLevelEvalMatch[3]);
    const column = topLevelEvalMatch[4] - 1;
    const originalPosition = await remapSourcePosition({
      source,
      line,
      column,
      resolveFile,
      urlToSourcemapConsumer,
      onFailure
    });
    return `eval at ${topLevelEvalMatch[1]} (${originalPosition.source}:${originalPosition.line}:${originalPosition.column + 1})`;
  } // Parse nested eval() calls using recursion


  const nestedEvalMatch = /^eval at ([^(]+) \((.+)\)$/.exec(origin);

  if (nestedEvalMatch) {
    const originalEvalOrigin = await remapEvalOrigin(nestedEvalMatch[2], {
      resolveFile,
      urlToSourcemapConsumer,
      onFailure
    });
    return `eval at ${nestedEvalMatch[1]} (${originalEvalOrigin})`;
  } // Make sure we still return useful information if we didn't find anything


  return origin;
};

const remapSourcePosition = async ({
  source,
  line,
  column,
  resolveFile,
  urlToSourcemapConsumer,
  readErrorStack,
  onFailure
}) => {
  const position = {
    source,
    line,
    column
  };
  const url = sourceToUrl(source, {
    resolveFile
  });
  if (!url) return position;
  const sourceMapConsumer = await urlToSourcemapConsumer(url);
  if (!sourceMapConsumer) return position;

  try {
    const originalPosition = sourceMapConsumer.originalPositionFor(position); // Only return the original position if a matching line was found. If no
    // matching line is found then we return position instead, which will cause
    // the stack trace to print the path and line for the compiled file. It is
    // better to give a precise location in the compiled file than a vague
    // location in the original file.

    const originalSource = originalPosition.source;
    if (originalSource === null) return position;
    originalPosition.source = resolveFile(originalSource, url, {
      type: "file-original"
    });
    return originalPosition;
  } catch (e) {
    onFailure(createDetailedMessage(`error while remapping position.`, {
      ["error stack"]: readErrorStack(e),
      ["source"]: source,
      ["line"]: line,
      ["column"]: column
    }));
    return position;
  }
};

const sourceToUrl = (source, {
  resolveFile
}) => {
  if (startsWithScheme(source)) {
    return source;
  } // linux filesystem path


  if (source[0] === "/") {
    return resolveFile(source);
  } // be careful, due to babel or something like that we might receive paths like
  // C:/directory/file.js (without backslashes we would expect on windows)
  // In that case we consider C: is the signe we are on windows
  // And I avoid to rely on process.platform === "win32" because this file might be executed in chrome


  if (startsWithWindowsDriveLetter(source)) {
    return windowsFilePathToUrl(source);
  } // I don't think we will ever encounter relative file in the stack trace
  // but if it ever happens we are safe :)


  if (source.slice(0, 2) === "./" || source.slice(0, 3) === "../") {
    return resolveFile(source);
  } // we have received a "bare specifier" for the source
  // it happens for internal/process/task_queues.js for instance
  // if we do return resolveFile(source) it will be converted to
  // file:///C:/project-directory/internal/process/task_queues.js in node
  // and
  // http://domain.com/internal/process/task_queues.js
  // but the file will certainly be a 404
  // and if not it won't be the right file anyway
  // for now we assume "bare specifier" in the stack trace
  // are internal files that are pointless to try to remap


  return null;
};

const startsWithScheme = string => {
  return /^[a-zA-Z]{2,}:/.test(string);
};

const remapStack = async ({
  stack,
  resolveFile,
  fetchFile,
  SourceMapConsumer,
  readErrorStack,
  onFailure
}) => {
  const urlToSourcemapConsumer = memoizeByFirstArgStringValue(async stackTraceFileUrl => {
    if (stackTraceFileUrl.startsWith("node:")) {
      return null;
    }

    try {
      let text;

      try {
        const fileResponse = await fetchFile(stackTraceFileUrl);
        const {
          status
        } = fileResponse;

        if (status !== 200) {
          if (status === 404) {
            onFailure(`stack trace file not found at ${stackTraceFileUrl}`);
          } else {
            onFailure(createDetailedMessage(`unexpected response fetching stack trace file.`, {
              ["response status"]: status,
              ["response text"]: fileResponse.body,
              ["stack trace file"]: stackTraceFileUrl
            }));
          }

          return null;
        }

        text = await fileResponse.text();
      } catch (e) {
        onFailure(createDetailedMessage(`error while fetching stack trace file.`, {
          ["fetch error stack"]: readErrorStack(e),
          ["stack trace file"]: stackTraceFileUrl
        }));
        return null;
      }

      const jsSourcemapUrl = getJavaScriptSourceMappingUrl(text);

      if (!jsSourcemapUrl) {
        return null;
      }

      let sourcemapUrl;
      let sourcemapString;

      if (jsSourcemapUrl.startsWith("data:")) {
        sourcemapUrl = stackTraceFileUrl;
        sourcemapString = DataUrl.parse(jsSourcemapUrl, {
          as: "string"
        });
      } else {
        sourcemapUrl = resolveFile(jsSourcemapUrl, stackTraceFileUrl, {
          type: "source-map"
        });

        try {
          const sourcemapResponse = await fetchFile(sourcemapUrl);
          const {
            status
          } = sourcemapResponse;

          if (status !== 200) {
            if (status === 404) {
              onFailure(`sourcemap file not found at ${sourcemapUrl}`);
            } else {
              onFailure(createDetailedMessage(`unexpected response for sourcemap file.`, {
                ["response status"]: status,
                ["response text"]: await sourcemapResponse.text(),
                ["sourcemap url"]: sourcemapUrl
              }));
            }

            return null;
          }

          sourcemapString = await sourcemapResponse.text();
        } catch (e) {
          onFailure(createDetailedMessage(`error while fetching sourcemap.`, {
            ["fetch error stack"]: readErrorStack(e),
            ["sourcemap url"]: sourcemapUrl
          }));
          return null;
        }
      }

      let sourceMap;

      try {
        sourceMap = JSON.parse(sourcemapString);
      } catch (e) {
        onFailure(createDetailedMessage(`error while parsing sourcemap.`, {
          ["parse error stack"]: readErrorStack(e),
          ["sourcemap url"]: sourcemapUrl
        }));
        return null;
      }

      let {
        sourcesContent
      } = sourceMap;

      if (!sourcesContent) {
        sourcesContent = [];
        sourceMap.sourcesContent = sourcesContent;
      }

      let firstSourceMapSourceFailure = null;
      await Promise.all(sourceMap.sources.map(async (source, index) => {
        if (index in sourcesContent) return;
        const sourcemapSourceUrl = resolveFile(source, sourcemapUrl, {
          type: "source"
        });

        try {
          const sourceResponse = await fetchFile(sourcemapSourceUrl);
          const {
            status
          } = sourceResponse;

          if (status !== 200) {
            if (firstSourceMapSourceFailure) return;

            if (status === 404) {
              firstSourceMapSourceFailure = createDetailedMessage(`sourcemap source not found.`, {
                ["sourcemap source url"]: sourcemapSourceUrl,
                ["sourcemap url"]: sourcemapUrl
              });
              return;
            }

            firstSourceMapSourceFailure = createDetailedMessage(`unexpected response for sourcemap source.`, {
              ["response status"]: status,
              ["response text"]: await sourceResponse.text(),
              ["sourcemap source url"]: sourcemapSourceUrl,
              ["sourcemap url"]: sourcemapUrl
            });
            return;
          }

          const sourceString = await sourceResponse.text();
          sourcesContent[index] = sourceString;
        } catch (e) {
          if (firstSourceMapSourceFailure) return;
          firstSourceMapSourceFailure = createDetailedMessage(`error while fetching sourcemap source.`, {
            ["fetch error stack"]: readErrorStack(e),
            ["sourcemap source url"]: sourcemapSourceUrl,
            ["sourcemap url"]: sourcemapUrl
          });
        }
      }));

      if (firstSourceMapSourceFailure) {
        onFailure(firstSourceMapSourceFailure);
        return null;
      }

      return new SourceMapConsumer(sourceMap);
    } catch (e) {
      onFailure(createDetailedMessage(`error while preparing a sourceMap consumer for a stack trace file.`, {
        ["error stack"]: readErrorStack(e),
        ["stack trace file"]: stackTraceFileUrl
      }));
      return null;
    }
  });
  const originalCallsites = await Promise.all(stack.map(callSite => remapCallSite(callSite, {
    resolveFile,
    urlToSourcemapConsumer,
    readErrorStack,
    onFailure
  })));
  return originalCallsites;
};

const memoizeByFirstArgStringValue = fn => {
  const stringValueCache = {};
  return firstArgValue => {
    if (firstArgValue in stringValueCache) return stringValueCache[firstArgValue];
    const value = fn(firstArgValue);
    stringValueCache[firstArgValue] = value;
    return value;
  };
};

const stringifyStack = (stack, {
  error,
  indent
}) => {
  const name = error.name || "Error";
  const message = error.message || "";
  const stackString = stack.map(callSite => `\n${indent}at ${callSite}`).join("");
  return `${name}: ${message}${stackString}`;
};

const installErrorStackRemapping = ({
  fetchFile,
  resolveFile,
  SourceMapConsumer,
  indent = "  "
}) => {
  if (typeof fetchFile !== "function") {
    throw new TypeError(`fetchFile must be a function, got ${fetchFile}`);
  }

  if (typeof SourceMapConsumer !== "function") {
    throw new TypeError(`sourceMapConsumer must be a function, got ${SourceMapConsumer}`);
  }

  if (typeof indent !== "string") {
    throw new TypeError(`indent must be a string, got ${indent}`);
  }

  const errorRemappingCache = new WeakMap();
  const errorRemapFailureCallbackMap = new WeakMap();
  let installed = false;
  const previousPrepareStackTrace = Error.prepareStackTrace;

  const install = () => {
    if (installed) return;
    installed = true;
    Error.prepareStackTrace = prepareStackTrace;
  };

  const uninstall = () => {
    if (!installed) return;
    installed = false;
    Error.prepareStackTrace = previousPrepareStackTrace;
  }; // ensure we do not use prepareStackTrace for thoose error
  // otherwise we would recursively remap error stack
  // and if the reason causing the failure is still here
  // it would create an infinite loop


  const readErrorStack = error => {
    uninstall();
    const stack = error.stack;
    install();
    return stack;
  };

  const prepareStackTrace = (error, stack) => {
    const onFailure = failureData => {
      const failureCallbackArray = errorRemapFailureCallbackMap.get(error);

      if (failureCallbackArray) {
        failureCallbackArray.forEach(callback => callback(failureData));
      }
    };

    const stackRemappingPromise = remapStack({
      stack,
      error,
      resolveFile,
      fetchFile: memoizeFetch(fetchFile),
      SourceMapConsumer,
      readErrorStack,
      indent,
      onFailure
    });
    errorRemappingCache.set(error, stackRemappingPromise);
    return stringifyStack(stack, {
      error,
      indent
    });
  };

  const getErrorOriginalStackString = async (error, {
    onFailure = message => {
      console.warn(message);
    }
  } = {}) => {
    if (onFailure) {
      const remapFailureCallbackArray = errorRemapFailureCallbackMap.get(error);

      if (remapFailureCallbackArray) {
        errorRemapFailureCallbackMap.set(error, [...remapFailureCallbackArray, onFailure]);
      } else {
        errorRemapFailureCallbackMap.set(error, [onFailure]);
      }
    } // ensure Error.prepareStackTrace gets triggered by reading error.stack now


    const {
      stack
    } = error;
    const promise = errorRemappingCache.get(error);

    if (promise) {
      try {
        const originalCallsites = await promise;
        errorRemapFailureCallbackMap.get(error);
        const firstCall = originalCallsites[0];

        if (firstCall) {
          Object.assign(error, {
            filename: firstCall.getFileName(),
            lineno: firstCall.getLineNumber(),
            columnno: firstCall.getColumnNumber()
          });
        }

        return stringifyStack(originalCallsites, {
          error,
          indent
        });
      } catch (e) {
        onFailure(createDetailedMessage(`error while computing original stack.`, {
          ["stack from error while computing"]: readErrorStack(e),
          ["stack from error to remap"]: stack
        }));
        return stack;
      }
    }

    return stack;
  };

  install();
  return {
    getErrorOriginalStackString,
    uninstall
  };
};

const memoizeFetch = fetchUrl => {
  const urlCache = {};
  return async url => {
    if (url in urlCache) {
      return urlCache[url];
    }

    const responsePromise = fetchUrl(url);
    urlCache[url] = responsePromise;
    return responsePromise;
  };
};

const installBrowserErrorStackRemapping = (options = {}) => installErrorStackRemapping({
  fetchFile: async url => {
    // browser having Error.captureStackTrace got window.fetch
    // and this executes only when Error.captureStackTrace exists
    // so no need for polyfill or whatever here
    const response = await window.fetch(url, {
      // by default a script tag is in "no-cors"
      // so we also fetch url with "no-cors"
      mode: "no-cors"
    }); // we read response test before anything because once memoized fetch
    // gets annoying preventing you to read
    // body multiple times, even using response.clone()

    const text = await response.text();
    return {
      status: response.status,
      url: response.url,
      statusText: response.statusText,
      headers: responseToHeaders(response),
      text: () => text,
      json: response.json.bind(response),
      blob: response.blob.bind(response),
      arrayBuffer: response.arrayBuffer.bind(response)
    };
  },
  resolveFile: (specifier, importer = window.location.href) => {
    // browsers having Error.captureStrackTrace got window.URL
    // and this executes only when Error.captureStackTrace exists
    return String(new URL(specifier, importer));
  },
  ...options
});

const responseToHeaders = response => {
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
};

const displayErrorInDocument = error => {
  const title = "An error occured";
  let theme;
  let message;

  if (error && error.parsingError) {
    theme = "light";
    const {
      parsingError
    } = error;
    message = errorToHTML(parsingError.messageHTML || escapeHtml(parsingError.message));
  } else {
    theme = "dark";
    message = errorToHTML(error);
  }

  const css = `
    .jsenv-console {
      background: rgba(0, 0, 0, 0.95);
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 1000;
      box-sizing: border-box;
      padding: 1em;
    }

    .jsenv-console h1 {
      color: red;
      display: flex;
      align-items: center;
    }

    #button-close-jsenv-console {
      margin-left: 10px;
    }

    .jsenv-console pre {
      overflow: auto;
      max-width: 70em;
      /* avoid scrollbar to hide the text behind it */
      padding: 20px;
    }

    .jsenv-console pre[data-theme="dark"] {
      background: #111;
      border: 1px solid #333;
      color: #eee;
    }

    .jsenv-console pre[data-theme="light"] {
      background: #1E1E1E;
      border: 1px solid white;
      color: #EEEEEE;
    }

    .jsenv-console pre a {
      color: inherit;
    }
    `;
  const html = `
      <style type="text/css">${css}></style>
      <div class="jsenv-console">
        <h1>${title} <button id="button-close-jsenv-console">X</button></h1>
        <pre data-theme="${theme}">${message}</pre>
      </div>
      `;
  const removeJsenvConsole = appendHMTLInside(html, document.body);

  document.querySelector("#button-close-jsenv-console").onclick = () => {
    removeJsenvConsole();
  };
};

const escapeHtml = string => {
  return string.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const errorToHTML = error => {
  let html;

  if (error && error instanceof Error) {
    //  stackTrace formatted by V8
    if (Error.captureStackTrace) {
      html = escapeHtml(error.stack);
    } else {
      // other stack trace such as firefox do not contain error.message
      html = escapeHtml(`${error.message}
  ${error.stack}`);
    }
  } else if (typeof error === "string") {
    html = error;
  } else if (error === undefined) {
    html = "undefined";
  } else {
    html = JSON.stringify(error);
  }

  const htmlWithCorrectLineBreaks = html.replace(/\n/g, "\n");
  const htmlWithLinks = stringToStringWithLink(htmlWithCorrectLineBreaks, {
    transform: url => {
      return {
        href: url,
        text: url
      };
    }
  });
  return htmlWithLinks;
}; // `Error: yo
// at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
// at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
// at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
// at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
//   debugger
// })


const stringToStringWithLink = (source, {
  transform = url => {
    return {
      href: url,
      text: url
    };
  }
} = {}) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, match => {
    let linkHTML = "";
    const lastChar = match[match.length - 1]; // hotfix because our url regex sucks a bit

    const endsWithSeparationChar = lastChar === ")" || lastChar === ":";

    if (endsWithSeparationChar) {
      match = match.slice(0, -1);
    }

    const lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
    const lineAndColumMatch = match.match(lineAndColumnPattern);

    if (lineAndColumMatch) {
      const lineAndColumnString = lineAndColumMatch[0];
      const lineNumber = lineAndColumMatch[1];
      const columnNumber = lineAndColumMatch[2];
      const url = match.slice(0, -lineAndColumnString.length);
      const {
        href,
        text
      } = transform(url);
      linkHTML = link({
        href,
        text: `${text}:${lineNumber}:${columnNumber}`
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);

      if (lineMatch) {
        const lineString = lineMatch[0];
        const lineNumber = lineMatch[1];
        const url = match.slice(0, -lineString.length);
        const {
          href,
          text
        } = transform(url);
        linkHTML = link({
          href,
          text: `${text}:${lineNumber}`
        });
      } else {
        const url = match;
        const {
          href,
          text
        } = transform(url);
        linkHTML = link({
          href,
          text
        });
      }
    }

    if (endsWithSeparationChar) {
      return `${linkHTML}${lastChar}`;
    }

    return linkHTML;
  });
};

const link = ({
  href,
  text = href
}) => `<a href="${href}">${text}</a>`;

const appendHMTLInside = (html, parentNode) => {
  const temoraryParent = document.createElement("div");
  temoraryParent.innerHTML = html;
  return transferChildren(temoraryParent, parentNode);
};

const transferChildren = (fromNode, toNode) => {
  const childNodes = [].slice.call(fromNode.childNodes, 0);
  let i = 0;

  while (i < childNodes.length) {
    toNode.appendChild(childNodes[i]);
    i++;
  }

  return () => {
    let c = 0;

    while (c < childNodes.length) {
      fromNode.appendChild(childNodes[c]);
      c++;
    }
  };
};

const {
  Notification
} = window;

const displayErrorNotificationNotAvailable = () => {};

const displayErrorNotificationImplementation = (error, {
  icon
} = {}) => {
  if (Notification.permission === "granted") {
    const notification = new Notification("An error occured", {
      lang: "en",
      body: error ? error.stack : "undefined",
      icon
    });

    notification.onclick = () => {
      window.focus();
    };
  }
};

const displayErrorNotification = typeof Notification === "function" ? displayErrorNotificationImplementation : displayErrorNotificationNotAvailable;

const getNavigationStartTime = () => {
  try {
    return window.performance.timing.navigationStart;
  } catch (e) {
    return Date.now();
  }
};

const navigationStartTime = getNavigationStartTime();
const readyPromise = new Promise(resolve => {
  if (document.readyState === "complete") {
    resolve();
  } else {
    const loadCallback = () => {
      window.removeEventListener("load", loadCallback);
      resolve();
    };

    window.addEventListener("load", loadCallback);
  }
});
const fileExecutionMap = {};
const executionResultPromise = readyPromise.then(async () => {
  const fileExecutionResultMap = {};
  const fileExecutionResultPromises = [];
  let status = "completed";
  let exceptionSource = "";
  Object.keys(fileExecutionMap).forEach(key => {
    fileExecutionResultMap[key] = null; // to get always same order for Object.keys(executionResult)

    const fileExecutionResultPromise = fileExecutionMap[key];
    fileExecutionResultPromises.push(fileExecutionResultPromise);
    fileExecutionResultPromise.then(fileExecutionResult => {
      fileExecutionResultMap[key] = fileExecutionResult;

      if (fileExecutionResult.status === "errored") {
        status = "errored";
        exceptionSource = fileExecutionResult.exceptionSource;
      }
    });
  });
  await Promise.all(fileExecutionResultPromises);
  return {
    status,
    ...(status === "errored" ? {
      exceptionSource
    } : {}),
    startTime: navigationStartTime,
    endTime: Date.now(),
    fileExecutionResultMap
  };
});

const executeFileUsingDynamicImport = async (specifier, identifier = specifier) => {
  const {
    currentScript
  } = document;

  const fileExecutionResultPromise = (async () => {
    try {
      const url = new URL(specifier, document.location.href).href;
      performance.mark(`jsenv_file_import_start`);
      const namespace = await import(url);
      performance.measure(`jsenv_file_import`, `jsenv_file_import_start`);
      const executionResult = {
        status: "completed",
        namespace,
        coverage: readCoverage()
      };
      return executionResult;
    } catch (e) {
      performance.measure(`jsenv_file_import`, `jsenv_file_import_start`);
      const executionResult = {
        status: "errored",
        error: e,
        coverage: readCoverage()
      };
      onExecutionError(executionResult, {
        currentScript
      });
      return executionResult;
    }
  })();

  fileExecutionMap[identifier] = fileExecutionResultPromise;
  return fileExecutionResultPromise;
};

const executeFileUsingSystemJs = specifier => {
  // si on a déja importer ce fichier ??
  // if (specifier in fileExecutionMap) {
  // }
  const {
    currentScript
  } = document;

  const fileExecutionResultPromise = (async () => {
    const browserRuntime = await getBrowserRuntime();
    const executionResult = await browserRuntime.executeFile(specifier, {
      measurePerformance: true,
      collectPerformance: true
    });

    if (executionResult.status === "errored") {
      onExecutionError(executionResult, {
        currentScript
      });
    }

    return executionResult;
  })();

  fileExecutionMap[specifier] = fileExecutionResultPromise;
  return fileExecutionResultPromise;
};

const onExecutionError = (executionResult, {
  currentScript,
  errorExposureInConsole = true,
  errorExposureInNotification = false,
  errorExposureInDocument = true
}) => {
  const error = executionResult.error;

  if (error && error.code === "NETWORK_FAILURE") {
    if (currentScript) {
      const errorEvent = new Event("error");
      currentScript.dispatchEvent(errorEvent);
    }
  } else if (typeof error === "object") {
    const {
      parsingError
    } = error;
    const globalErrorEvent = new Event("error");

    if (parsingError) {
      globalErrorEvent.filename = parsingError.filename;
      globalErrorEvent.lineno = parsingError.lineNumber;
      globalErrorEvent.message = parsingError.message;
      globalErrorEvent.colno = parsingError.columnNumber;
    } else {
      globalErrorEvent.filename = error.filename;
      globalErrorEvent.lineno = error.lineno;
      globalErrorEvent.message = error.message;
      globalErrorEvent.colno = error.columnno;
    }

    window.dispatchEvent(globalErrorEvent);
  }

  if (errorExposureInConsole) {
    console.error(error);
  }

  if (errorExposureInNotification) {
    displayErrorNotification(error);
  }

  if (errorExposureInDocument) {
    displayErrorInDocument(error);
  }

  executionResult.exceptionSource = unevalException(error);
  delete executionResult.error;
};

const getBrowserRuntime = memoize(async () => {
  const compileServerOrigin = document.location.origin;
  const compileServerResponse = await fetchUrl(`${compileServerOrigin}/__jsenv_compile_profile__`);
  const compileServerMeta = await compileServerResponse.json();
  const {
    jsenvDirectoryRelativeUrl,
    errorStackRemapping
  } = compileServerMeta;
  const jsenvDirectoryServerUrl = `${compileServerOrigin}/${jsenvDirectoryRelativeUrl}`;
  const afterJsenvDirectory = document.location.href.slice(jsenvDirectoryServerUrl.length);
  const parts = afterJsenvDirectory.split("/");
  const compileId = parts[0];
  const browserClient = await createBrowserClient({
    compileServerOrigin,
    jsenvDirectoryRelativeUrl,
    compileId
  });

  if (errorStackRemapping && Error.captureStackTrace) {
    const {
      sourcemapMainFileRelativeUrl,
      sourcemapMappingFileRelativeUrl
    } = compileServerMeta;
    await fetchAndEval(`${compileServerOrigin}/${sourcemapMainFileRelativeUrl}`);
    const {
      SourceMapConsumer
    } = window.sourceMap;
    SourceMapConsumer.initialize({
      "lib/mappings.wasm": `${compileServerOrigin}/${sourcemapMappingFileRelativeUrl}`
    });
    const {
      getErrorOriginalStackString
    } = installBrowserErrorStackRemapping({
      SourceMapConsumer
    });

    const errorTransform = async error => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error;
      const originalStack = await getErrorOriginalStackString(error);
      error.stack = originalStack;
      return error;
    };

    const executeFile = browserClient.executeFile;

    browserClient.executeFile = (file, options = {}) => {
      return executeFile(file, {
        errorTransform,
        ...options
      });
    };
  }

  return browserClient;
});

const readCoverage = () => window.__coverage__;

window.__jsenv__ = {
  executionResultPromise,
  executeFileUsingDynamicImport,
  executeFileUsingSystemJs
};
})();

//# sourceMappingURL=browser_client.js.map