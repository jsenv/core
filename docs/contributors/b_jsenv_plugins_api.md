**Disclaimer:** This page is an advanced topic and concerns people who seeks information on jsenv plugin internals.

Jsenv plugins are objects that can be used to hook into jsenv during dev and/or build.  
They are given via `plugins` parameter to [startDevServer](../users/b_dev.md) and [build](../users/c_build.md).

```js
// Example of a jsenv plugin
export const createAJsenvPlugin = () => {
  return {
    name: "my_plugin",
    appliesDuring: "*",
    init: (context) => {},
    destroy: () => {},
    resolveReference: (reference, context) => {},
    redirectReference: (reference, context) => {},
    transformReferenceSearchParams: (reference, context) => {},
    formatReference: (reference, context) => {},
    fetchUrlContent: async (urlInfo, context) => {},
    transformUrlContent: async (urlInfo, context) => {},
    optimizeUrlContent: async (urlInfo, context) => {},
    serverEvents: {
      myEvent: ({ sendServerEvent }) => {},
    },
  };
};
```

☝️ This plugin has no effect; it just shows all properties that have a special meaning for jsenv.

# 1. Properties

## 1.1 name

The name of the plugin, used for log and debug purposes.

## 1.2 appliesDuring

Controls if the plugin applies or is ignored.

| value     | effect                                 |
| --------- | -------------------------------------- |
| `"*"`     | applied during dev and build           |
| `"dev"`   | applied by the dev server (during dev) |
| `"build"` | applied during the build               |

If `appliesDuring` is not set or is `undefined`, the plugin will apply during dev and build (same as `*`)

## 1.3 init and destroy

Usually the logic around the plugin goes at the beginning of the factory function

```js
export const createMyPlugin = () => {
  // some logic, helper functions, etc...

  return {
    name: "my_plugin",
  };
};
```

In rare cases this logic depends on info available in [2.1 context](#21-context), such as `rootDirectoryUrl`.
In that case the combination of `init` and `destroy` and be used as shown below:

```js
export const createMyPlugin = () => {
  let timeout;

  return {
    name: "my_plugin",
    init: (context) => {
      timeout = setTimeout(() => {
        console.log(context.rootDirectoryUrl);
      }, 1000);
    },
    destroy: () => {
      clearTimeout(timeout);
      timeout = null;
    },
  };
};
```

Finally when `init` returns `false` the plugin will be ignored.
This allows to control if a plugin applies according to [2.1 context](#21-context).

## 1.4 resolveReference

Controls how a reference is resolved to an url. Among other things, this is used internally to implement node module resolution.

```js
export const createMyPlugin = () => {
  return {
    name: "my_plugin",
    resolveReference: (reference) => {
      if (reference.specifier === "amazing-package") {
        return "file:///Users/dmail/node_modules/amazing-package/index.js";
      }
    },
  };
};
```

The resolved url will be updated in the code meaning the plugin above has the following effect on code:

```diff
- import "amazing-package";
+ import "/node_modules/amazing-package/index.js";
```

## 1.5 redirectReference

Allow to redirect a resolved url. Among other things, this is used internally to implement filesystem magic redirection (auto append file extension).

```js
export const createMyPlugin = () => {
  return {
    name: "my_plugin",
    redirectReference: (reference) => {
      if (!reference.url.endsWith(".js")) {
        return `${reference.url}.js`;
      }
    },
  };
};
```

The plugin above has the following effect on code:

```diff
- import "file";
+ import "file.js";
```

## 1.6 transformReferenceSearchParams

This hook allow to inject url search params into a reference.

```js
export const createMyPlugin = () => {
  return {
    name: "my_plugin",
    transformReferenceSearchParams: (reference) => {
      if (reference.specifier.includes("demo.js")) {
        return {
          foo: "bar",
        };
      }
    },
  };
};
```

Enabling the plugin above would transform code as follows:

```diff
- import "./demo.js";
+ import "./demo.js?foo=bar";
```

## 1.7 formatReference

This hook allow to control the final url that will be in the code.

```js
export const createMyPlugin = () => {
  return {
    name: "my_plugin",
    formatReference: (reference) => {
      if (reference.specifier.includes("demo.js")) {
        return "/dist/demo.js";
      }
    },
  };
};
```

Enabling the plugin above would transform code as follows:

```diff
- import "./demo.js";
+ import "/dist/demo.js";
```

## 1.8 fetchUrlContent

Retrieve a content + contentType from an url. Among other things, this is used internally to read file from disk.

```js
import { readFileSync } from "node:fs";

export const createMyPlugin = () => {
  return {
    name: "my_plugin",
    fetchUrlContent: (urlInfo) => {
      if (urlInfo.url.startsWith("file:")) {
        const content = readFileSync(new URL(urlInfo.url), {
          encoding: "utf8",
        });
        return {
          content,
          contentType: "text/javascript",
        };
      }
    },
  };
};
```

## 1.8 transformUrlContent

Allow to modify the original content fetched from an url.

```js
export const createMyPlugin = () => {
  return {
    name: "my_plugin",
    transformUrlContent: (urlInfo) => {
      const originalContent = urlInfo.content;
      const content = originalContent.replace("foo", "bar");
      return {
        content,
        sourcemap: null,
      };
    },
  };
};
```

Enabling the plugin above would transform code as follows:

```diff
- console.log("foo");
+ console.log("bar");
```

## 1.10 optimizeUrlContent

Like transformUrlContent but will be called only during build and after all transformUrlContent hooks.

The transformations in this hook should focus on content optimizations:

- Decreasing content size (minification for instance)
- Reducing time to parse or time to execute

## 1.11 serverEvents

This property allows send events from server to client. These events are sent using a websocket.

```js
export const createMyPlugin = () => {
  return {
    name: "my_plugin",
    serverEvents: {
      keepAlive: ({ sendServerEvent }) => {
        setInterval(() => {
          sendServerEvent({ sendTime: Date.now() });
        }, 1_000);
      },
    },
  };
};
```

Event can be listened by client as follows:

```js
window.__server_events__.listenEvents({
  keepAlive: (keepAliveEvent) => {
    console.log(
      "received keepAlive from server at",
      keepAliveEvent.data.sendTime,
    );
  },
});
```

# 2. Arguments

## 2.1 context

It is an object containing some useful information. See some examples below:

```js
export const createAJsenvPlugin = () => {
  return {
    name: "my_plugin",
    init: (context) => {
      console.log(context.rootDirectoryUrl); // logs the rootDirectoryUrl
      if (context.dev) {
        console.log("executed by dev server");
      }
      if (context.build) {
        console.log("executed by build");
      }
      if (context.isSupportedOnCurrentClients("script_type_module")) {
        console.log("script type module are supported");
      }
    },
  };
};
```

### 2.1.1 context.rootDirectoryUrl

An url string that is sourceDirectoryUrl during dev and buildDirectoryUrl during build.

## 2.2 reference

An object representing a reference to an url.

For example if code references "file.js" within "main.js" as follows:

```js
import "./file.js";
```

A corresponding reference object is created that looks like this:

```js
{
  specifier: "./file.js",
  specifierStart: 7,
  specifierEnd: 18,
  specifierLine: 1,
  specifierColumn: 7,
  type: "js_import",
  subtype: "import_static",
  expectedContentType: "text/javascript",
  expectedType: "js_module",
  parentUrl: "file:///Users/dmail/demo/main.js",
}
```

### 2.2.1 reference.type

A string, each value map to a way to reference an url.

| reference.type           | Scenario where it gets created                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `"http_request"`         | dev server receives a request                                                                                            |
| `"entry_point"`          | build [entryPoints](<B)-JavaScript-API#23-entrypoints>)                                                                  |
| `"link_href"`            | `<link href="./favicon.ico">`                                                                                            |
| `"style"`                | `<style>body { background: red; }<style>`                                                                                |
| `"script"`               | `<script src="./file.js">`                                                                                               |
| `"a_href"`               | `<a href="./file.pdf">`                                                                                                  |
| `"iframe_src"`           | `<iframe src="./file.html">`                                                                                             |
| `"img_src"`              | `<img src="./file.png">`                                                                                                 |
| `"img_srcset"`           | `<img srcset="./file_480w.jpg 480w, ./file_800w.jpg 800w">`                                                              |
| `"source_src"`           | `<source src="./file.mp3">`                                                                                              |
| `"source_srcset"`        | `<source srcset="./file_480w.jpg 480w, ./file_800w.jpg 800w">`                                                           |
| `"image_href"`           | `<image href="./file.svg">`                                                                                              |
| `"use_href"`             | `<use href="./file.svg">`                                                                                                |
| `"css_@import"`          | `@import "/file.css"`                                                                                                    |
| `"css_url"`              | `background-image: url("/file.jpg")`                                                                                     |
| `"js_import"`            | `import "./file.js"`                                                                                                     |
| `"js_url"`               | `new URL("./file.json", import.meta.url)`                                                                                |
| `"js_inline_content"`    | `new Blob([".a { color: red; }"], { type: "text/css" })`                                                                 |
| `"sourcemap_comment"`    | `//*# sourceMappingURL=./file.map`                                                                                       |
| `"webmanifest_icon_src"` | icon found inside [webmanifest](https://developer.mozilla.org/en-US/docs/Web/Manifest#deploying_a_manifest)<sup>↗</sup> |
| `"package_json"`         | Represent the implicit dependency to a package.json when importing from node_modules                                     |

Hooks receiving `reference` as first argument can use a special notation as shown below:

```js
return {
  name: "my_plugin",
  resolveReference: (reference) => {
    if (reference.type === "js_import") {
      console.log("js_import");
    } else if (reference.type === "js_url") {
      console.log("js_url");
    } else {
      console.log("something else");
    }
  },
};
```

Can be written as follows:

```js
return {
  name: "my_plugin",
  resolveReference: {
    "js_import": (reference) => {
      console.log("js_import");
    },
    "js_url": (reference) => {
      console.log("js_url");
    },
    "*": (reference) => {
      onsole.log("something else");
    },
  },
};
```

## 2.3 urlInfo

An object representing a resource and its content.

Resource content is populated by [1.6 fetchUrlContent](#16-fetchUrlContent).
Content can be transformed during [1.7 transformUrlContent](#17-transformUrlContent).

Example of an url info object:

```js
{
  url: "file:///Users/dmail/demo/main.js",
  contentType: "text/javascript",
  type: "js_module",
  isWatched: true,
  content: `import "./file.js"`,
  contentEtag: `"12-WVFjnh0qBV6Fmkl3MwQURkLdIwI"`,
  dependencies: new Set(["file:///Users/dmail/demo/file.js"]),
  dependents: new Set(["file:///Users/dmail/demo/main.html"]),
  sourcemap: null,
  originalContent: `import "./file.js"`,
  originalContentEtag: `"12-WVFjnh0qBV6Fmkl3MwQURkLdIwI"`,
  headers: {}, // dev server will send these headers to client during dev
}
```

### 2.3.1 urlInfo.type

A string, it categorize content that can be found in `urlInfo.content`.

| urlInfo.type    | Example                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `"html"`        | `<iframe src="file.html">`                                                                                         |
| `"css"`         | `<link rel="stylesheet" href="file.css" />`                                                                        |
| `"js_classic"`  | `<script src="file.js">`                                                                                           |
| `"js_module"`   | `<script type="module" src="file.js">`                                                                             |
| `"json"`        | `new URL("file.json", import.meta.url)`                                                                            |
| `"webmanifest"` | [`<link rel="manifest">`](https://developer.mozilla.org/en-US/docs/Web/Manifest#deploying_a_manifest)<sup>↗</sup> |

Hooks receiving [2.3 urlInfo](#23-urlInfo) as first argument can use a special notation as shown below:

```js
return {
  name: "my_plugin",
  transformUrlContent: (urlInfo) => {
    if (urlInfo.type === "js_module") {
      console.log("js_module");
    } else if (urlInfo.type === "js_classic") {
      console.log("js_classic");
    } else {
      console.log("something else");
    }
  },
};
```

Can be written as follows:

```js
return {
  name: "my_plugin",
  transformUrlContent: {
    "js_module": (urlInfo) => {
      console.log("js_module");
    },
    "js_classic": (urlInfo) => {
      console.log("js_classic");
    },
    "*": (urlInfo) => {
      console.log("something else");
    },
  },
};
```

### 2.3.2 urlInfo.subtype

A string or `undefined`.

| Value              | Example                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `"worker"`         | `new Worker(import.meta.resolve("./worker.js"))`                   |
| `"service_worker"` | `navigator.serviceWorker.register(import.meta.resolve("./sw.js"))` |
| `"shared_worker"`  | `new SharedWorker(import.meta.resolve("./shared_worker.js"))`      |

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="./a_introduction_for_contributors.md">< A) Introduction</a>
  </td>
  <td width="2000px" align="right" nowrap>
  
  </td>
 </tr>
<table>
