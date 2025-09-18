const toto = ({ a, ...rest }) => {
  console.log(a, rest);
};
toto({ a: 1, b: 2, c: 3, d: 4 });
