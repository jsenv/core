const meta = import.meta;

const url = import.meta.url;

const { url: urlDestructured } = import.meta;

if (import.meta.hot) {
  import.meta.hot.accept(() => {});
  import.meta.hot.accept("file.js", () => {});
  import.meta.hot.accept(["a.js", "b.js"], () => {});
}

const metaCopy = { ...meta };
metaCopy.url = metaCopy.url.replace(window.origin, "window.origin");
window.resolveResultPromise({
  meta: metaCopy,
  url: url.replace(window.origin, "window.origin"),
  urlDestructured: urlDestructured.replace(window.origin, "window.origin"),
  importMetaDev: import.meta.dev,
  importMetaTest: import.meta.test,
  importMetaBuild: import.meta.build,
});
