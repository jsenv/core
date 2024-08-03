Promise.all([import(__v__("/js/a.js")), import(__v__("/js/b.js"))]).then(([{ a }, { b }]) => {
  window.resolveResultPromise({
    a,
    b,
  });
});
