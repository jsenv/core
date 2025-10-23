const toto = ({ a, ...rest }) => {
  console.log(a);
  tata({ ...rest, b: true });
};

const tata = ({ b }) => {
  console.log(b);
};

toto({ a: true, c: true }); // Invalid: c is not used by tata
