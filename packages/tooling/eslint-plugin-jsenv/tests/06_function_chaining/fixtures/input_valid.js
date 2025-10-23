const toto = ({ a, ...rest }) => {
  console.log(a);
  tata({ ...rest, b: true });
};

const tata = ({ b }) => {
  console.log(b);
};

toto({ a: true, b: false }); // Valid: b is used by tata
