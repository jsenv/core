const meta = import.meta;

const url = import.meta.url;

const { url: urlDestructured } = import.meta;

if (import.meta.hot) {
  import.meta.hot.accept(() => {});
  import.meta.hot.accept("file.js", () => {});
  import.meta.hot.accept(["a.js", "b.js"], () => {});
}

window.resolveResultPromise({
  meta,
  url,
  urlDestructured,
  importMetaDev: import.meta.dev,
  importMetaTest: import.meta.test,
  importMetaBuild: import.meta.build,
});
