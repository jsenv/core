const collectAll = ({ ...everything }) => {
  console.log(everything);
};
collectAll({ a: 1, b: 2, c: 3, anything: "works" });
