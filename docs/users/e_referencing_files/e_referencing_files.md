<!-- TITLE: E) Referencing files -->

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../d_test/d_test.md">&lt; D) Test</a>
    </td>
    <td width="2000px" align="center" nowrap>
      E) Referencing files
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../f_features/f_features.md">&gt; F) Features</a>
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->

This page explains how to reference files within different types of files (e.g., referencing a CSS file from a JavaScript module).
Jsenv relies on web standards for file referencing, so this guide focuses on standard practices.

<!-- PLACEHOLDER_START:TOC_INLINE -->

# Table of contents

<ol>
  <li>
    <a href="#1-general-notes">
      General notes
    </a>
      <ul>
        <li>
          <a href="#11-leading-slash">
            Leading slash
          </a>
        </li>
        <li>
          <a href="#12-external-urls">
            External urls
          </a>
        </li>
        <li>
          <a href="#13-browser-compatibility">
            Browser compatibility
          </a>
        </li>
      </ul>
  </li>
  <li>
    <a href="#2-html">
      HTML
    </a>
      <ul>
        <li>
          <a href="#21-inline">
            Inline 
          </a>
        </li>
      </ul>
  </li>
  <li>
    <a href="#3-css">
      CSS
    </a>
  </li>
  <li>
    <a href="#4-javascript-modules">
      JavaScript modules
    </a>
      <ul>
        <li>
          <a href="#41-css-import">
            CSS import
          </a>
        </li>
        <li>
          <a href="#42-urls">
            Urls
          </a>
        </li>
        <li>
          <a href="#43-worker-urls">
            Worker URLs
          </a>
        </li>
        <li>
          <a href="#45-json-import">
            JSON import
          </a>
        </li>
        <li>
          <a href="#46-text-import">
            Text import
          </a>
        </li>
      </ul>
  </li>
  <li>
    <a href="#5-classic-javascript">
      Classic JavaScript
    </a>
  </li>
</ol>

<!-- PLACEHOLDER_END -->

# 1. General notes

## 1.1 Leading slash

Prefer using a leading slash (/) over relative paths (../) for file references. This ensures consistency and avoids complex path structures.

```css
/* Avoid */
background-image: url("../../logo.png");

/* Prefer */
background-image: url("/logo.png");
```

## 1.2 External urls

External URLs (e.g., `https://fonts.googleapis.com/css2?family=Roboto`) are preserved during development and in build outputs.

## 1.3 Browser compatibility

Jsenv transforms modern features (e.g., import, import.meta, document.adoptedStyleSheets) to ensure compatibility with older browsers.

# 2. HTML

In HTML, file references are recognized in elements like `<link>`, `<script>`, `<img>`, and `<a>`. Inline `<script>` and `<style>` tags are also detected.

**Example:**

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="preload" href="./image.jpg" />
    <link rel="preload" href="./script.js" as="script" />
    <link rel="modulepreload" href="./module.js" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Roboto"
      crossorigin="anonymous"
    />
  </head>

  <body>
    Hello world
    <iframe href="./iframe.html"></iframe>
    <a href="./page.html">page</a>
    <picture>
      <source srcset="image_320.jpg 320w, image_640.jpg 640w" />
      <img src="image.jpg" alt="logo" />
    </picture>
    <script src="script.js"></script>
    <script type="module" src="module.js"></script>
  </body>
</html>
```

## 2.1 Inline `<script>` and `<style>`

Inline `<script>` and `<style>` tags are supported.

**Example:**

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <style>
      body {
        background: green;
      }
    </style>
  </head>

  <body>
    <script>
      console.log("hello world");
    </script>
    <script type="module">
      try {
        await import("./main.js");
      } catch (e) {
        console.error(`error while importing "main.js"`);
      }
    </script>
  </body>
</html>
```

# 3. CSS

In CSS, use `@import` to reference other CSS files and `url()` for assets like images.

**Example:**

```css
@import "./file.css";

body {
  background-image: url(./logo.png);
}
```

> **Note**  
> `@import` is not supported in [CSS module scripts](#41-css-import). This is documented in https://web.dev/css-module-scripts/#@import-rules-not-yet-allowed<sup>↗</sup>

# 4. JavaScript modules

JavaScript modules refers to js executed in a context where is has access to `import` and `import.meta`.  
In these files the following is recognized:

## 4.1 CSS import

Import CSS files as modules using the `type: "css"` attribute.

**Example:**

```js
import sheetA from "./a.css" with { type: "css" };
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheetA];

// And the dynamic import equivalent
const sheetB = await import("./b.css", {
  with: { type: "css" },
});
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheetB];
```

## 4.2 Urls

Use the `URL` constructor or `import.meta.resolve` to reference files.

**Example:**

```js
const imageUrl = new URL("./image.png", import.meta.url);
const textUrl = import.meta.resolve("./file.txt");
```

The way you want to use that url afterwards is up to you; some prevalant uses cases:

```js
// inject css in the document
const cssUrl = new URL("./style.css", import.meta.url);
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = cssUrl;
document.head.appendChild(link);

// inject an image in the document
const imageUrl = new URL("./img.png", import.meta.url);
const img = document.createElement("img");
img.src = imageUrl;
document.body.appendChild(img);
```

## 4.3 Worker URLs

Depending how the worker file is written one of the 2 solutions below must be used

1. Classic worker

```js
const worker = new Worker(new URL("/worker.js", import.meta.url));
```

2. Module worker

```js
const worker = new Worker(new URL("/worker.js", import.meta.url), {
  type: "module",
});
```

Jsenv also recognize [serviceWorker.register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)<sup>↗</sup> and [new SharedWorker()](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker)<sup>↗</sup>.

Here again `import.meta.resolve` can be used

```diff
-   new URL("/worker.js", import.meta.url);
+   import.meta.resolve("/worker.js");
```

## 4.5 JSON import

Import JSON files using the `type: "json"` attribute.

**Example:**

```js
import data from "./data.json" with { type: "json" };

console.log(data);

// or the dynamic import equivalent
const jsonModule = await import("./data.json", {
  with: { type: "json" },
});

console.log(jsonModule.default);
```

## 4.6 Text import

Import text files using the type: "text" attribute (non-standard, supported by Jsenv).

**Example:**

```js
import text from "./data.txt" with { type: "text" };

console.log(text);
```

# 5. Classic JavaScript

For classic JavaScript (loaded via `<script>` tags), use `document.currentScript.src` or `window.location` to reference files.

**Example:**

```html
<script src="./file.js"></script>
```

_file.js_:

```js
const imageUrl = new URL("./img.png", document.currentScript.src);

const img = document.createElement("img");
img.src = imageUrl;
document.body.appendChild(img);
```

When js is inlined between `<script>` tags inside html `window.location` must be used.

```diff
<script>
-   const jsonUrl = new URL("./data.json", document.currentScript.src);
+   const jsonUrl = new URL('./file.json', window.location);
</script>
```

It is because `document.currentScript.src` is `undefined` for inline JavaScript.

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../d_test/d_test.md">&lt; D) Test</a>
    </td>
    <td width="2000px" align="center" nowrap>
      E) Referencing files
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../f_features/f_features.md">&gt; F) Features</a>
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->
