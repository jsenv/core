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
    headers: responseToHeaders(response),
    text: () => response.text(),
    json: () => response.json(),
    blob: () => response.blob(),
    arrayBuffer: () => response.arrayBuffer(),
    formData: () => response.formData()
  };
};

const responseToHeaders = response => {
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
};

const fetchUrl = typeof window.fetch === "function" && typeof window.AbortController === "function" ? fetchNative : fetchUsingXHR;

const fetchJson = async (url, options = {}) => {
  const response = await fetchUrl(url, options);
  const object = await response.json();
  return object;
};

const fetchExploringJson = async ({
  signal
} = {}) => {
  try {
    const exploringInfo = await fetchJson("/.jsenv/exploring.json", {
      signal
    });
    return exploringInfo;
  } catch (e) {
    if (signal && signal.aborted && e.name === "AbortError") {
      throw e;
    }

    throw new Error(`Cannot communicate with exploring server due to a network error
--- error stack ---
${e.stack}`);
  }
};

const setStyles = (element, styles) => {
  const elementStyle = element.style;
  const restoreStyles = Object.keys(styles).map(styleName => {
    let restore;

    if (styleName in elementStyle) {
      const currentStyle = elementStyle[styleName];

      restore = () => {
        elementStyle[styleName] = currentStyle;
      };
    } else {
      restore = () => {
        delete elementStyle[styleName];
      };
    }

    elementStyle[styleName] = styles[styleName];
    return restore;
  });
  return () => {
    restoreStyles.forEach(restore => restore());
  };
};
const setAttributes = (element, attributes) => {
  Object.keys(attributes).forEach(name => {
    element.setAttribute(name, attributes[name]);
  });
};

/* eslint-disable no-undef */

const TOOLBAR_HTML_RELATIVE_URL = __TOOLBAR_BUILD_RELATIVE_URL_;
/* eslint-enable no-undef */

const jsenvLogoSvgUrl = new URL("assets/jsenv_logo_192011c2.svg", document.currentScript && document.currentScript.src || document.baseURI);

const injectToolbar = async () => {
  await new Promise(resolve => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(resolve, {
        timeout: 400
      });
    } else {
      window.requestAnimationFrame(resolve);
    }
  });
  const exploringJSON = await fetchExploringJson();
  const placeholder = getToolbarPlaceholder();
  const iframe = document.createElement("iframe");
  setAttributes(iframe, {
    tabindex: -1,
    // sandbox: "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation",
    // allow: "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; vr",
    allowtransparency: true
  });
  setStyles(iframe, {
    "position": "fixed",
    "zIndex": 1000,
    "bottom": 0,
    "left": 0,
    "width": "100%",
    "height": 0,

    /* ensure toolbar children are not focusable when hidden */
    "visibility": "hidden",
    "transition-duration": "300ms",
    "transition-property": "height, visibility",
    "border": "none"
  });
  const iframeLoadedPromise = iframeToLoadedPromise(iframe);
  const jsenvCoreDirectoryServerUrl = new URL(exploringJSON.jsenvCoreDirectoryRelativeUrl, document.location.origin).href;
  const jsenvToolbarHtmlServerUrl = new URL(TOOLBAR_HTML_RELATIVE_URL, jsenvCoreDirectoryServerUrl); // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)

  iframe.setAttribute("src", jsenvToolbarHtmlServerUrl);
  placeholder.parentNode.replaceChild(iframe, placeholder);
  addToolbarEventCallback(iframe, "toolbar_ready", () => {
    sendCommandToToolbar(iframe, "renderToolbar", {
      exploringJSON
    });
  });
  await iframeLoadedPromise;
  iframe.removeAttribute("tabindex");
  const div = document.createElement("div");
  div.innerHTML = `
<div id="jsenv-toolbar-trigger">
  <svg id="jsenv-toolbar-trigger-icon">
    <use xlink:href="${jsenvLogoSvgUrl}#jsenv_logo"></use>
  </svg>
  <style>
    #jsenv-toolbar-trigger {
      display: block;
      overflow: hidden;
      position: fixed;
      z-index: 1000;
      bottom: -32px;
      right: 20px;
      height: 40px;
      width: 40px;
      padding: 0;
      margin: 0;
      border-radius: 5px 5px 0 0;
      border: 1px solid rgba(0, 0, 0, 0.33);
      border-bottom: none;
      box-shadow: 0px 0px 6px 2px rgba(0, 0, 0, 0.46);
      background: transparent;
      text-align: center;
      transition: 600ms;
    }

    #jsenv-toolbar-trigger:hover {
      cursor: pointer;
    }

    #jsenv-toolbar-trigger[data-expanded] {
      bottom: 0;
    }

    #jsenv-toolbar-trigger-icon {
      width: 35px;
      height: 35px;
      opacity: 0;
      transition: 600ms;
    }

    #jsenv-toolbar-trigger[data-expanded] #jsenv-toolbar-trigger-icon {
      opacity: 1;
    }
  </style>
</div>`;
  const toolbarTrigger = div.firstElementChild;
  iframe.parentNode.appendChild(toolbarTrigger);
  let timer;

  toolbarTrigger.onmouseenter = () => {
    toolbarTrigger.setAttribute("data-animate", "");
    timer = setTimeout(expandToolbarTrigger, 500);
  };

  toolbarTrigger.onmouseleave = () => {
    clearTimeout(timer);
    collapseToolbarTrigger();
  };

  toolbarTrigger.onfocus = () => {
    toolbarTrigger.removeAttribute("data-animate");
    expandToolbarTrigger();
  };

  toolbarTrigger.onblur = () => {
    toolbarTrigger.removeAttribute("data-animate");
    clearTimeout(timer);
    collapseToolbarTrigger();
  };

  toolbarTrigger.onclick = () => {
    sendCommandToToolbar(iframe, "showToolbar");
  };

  const showToolbarTrigger = () => {
    toolbarTrigger.style.display = "block";
  };

  const hideToolbarTrigger = () => {
    toolbarTrigger.style.display = "none";
  };

  const expandToolbarTrigger = () => {
    toolbarTrigger.setAttribute("data-expanded", "");
  };

  const collapseToolbarTrigger = () => {
    toolbarTrigger.removeAttribute("data-expanded", "");
  };

  hideToolbarTrigger();
  addToolbarEventCallback(iframe, "toolbar-visibility-change", visible => {
    if (visible) {
      hideToolbarTrigger();
    } else {
      showToolbarTrigger();
    }
  });
  return iframe;
};

const addToolbarEventCallback = (iframe, eventName, callback) => {
  const messageEventCallback = messageEvent => {
    const {
      data
    } = messageEvent;

    if (typeof data !== "object") {
      return;
    }

    const {
      __jsenv__
    } = data;

    if (!__jsenv__) {
      return;
    }

    if (__jsenv__.event !== eventName) {
      return;
    }

    callback(__jsenv__.data);
  };

  window.addEventListener("message", messageEventCallback, false);
  return () => {
    window.removeEventListener("message", messageEventCallback, false);
  };
};

const sendCommandToToolbar = (iframe, command, ...args) => {
  iframe.contentWindow.postMessage({
    __jsenv__: {
      command,
      args
    }
  }, window.origin);
};

const getToolbarPlaceholder = () => {
  const placeholder = queryPlaceholder();

  if (placeholder) {
    if (document.body.contains(placeholder)) {
      return placeholder;
    } // otherwise iframe would not be visible because in <head>


    console.warn("element with [data-jsenv-toolbar-placeholder] must be inside document.body");
    return createTooolbarPlaceholder();
  }

  return createTooolbarPlaceholder();
};

const queryPlaceholder = () => {
  return document.querySelector("[data-jsenv-toolbar-placeholder]");
};

const createTooolbarPlaceholder = () => {
  const placeholder = document.createElement("span");
  document.body.appendChild(placeholder);
  return placeholder;
};

const iframeToLoadedPromise = iframe => {
  return new Promise(resolve => {
    const onload = () => {
      iframe.removeEventListener("load", onload, true);
      resolve();
    };

    iframe.addEventListener("load", onload, true);
  });
};

if (document.readyState === "complete") {
  injectToolbar();
} else {
  window.addEventListener("load", injectToolbar); // document.addEventListener("readystatechange", () => {
  //   if (document.readyState === "complete") {
  //     injectToolbar()
  //   }
  // })
}
})();

//# sourceMappingURL=toolbar_injector.js.map