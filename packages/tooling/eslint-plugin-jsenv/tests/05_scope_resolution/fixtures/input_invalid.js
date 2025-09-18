// Invalid: extra property passed but not declared in parameters
const simpleFunction = ({ used }) => {
  return used;
};

simpleFunction({ used: "test", extraParam: "should error" });