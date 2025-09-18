const toto = (a, { b, c }) => {
  console.log(a, b, c);
};
toto("hello", { b: 1, c: 2, d: 3 });
