Promise.all([import("./a/a.js"), import("./b/b.js")]).then(([{ a }, { b }]) => {
  window.resolveResultPromise({
    a,
    b,
  });
});
