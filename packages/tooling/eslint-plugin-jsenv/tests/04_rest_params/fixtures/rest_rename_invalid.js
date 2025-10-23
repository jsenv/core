// Invalid: Rest param renamed but passed properties not used by target function
const invalidRestRename = ({ a, ...rest }) => {
  const titi = rest;
  targetFunction(titi);
};

const targetFunction = ({ c }) => {
  console.log(c);
};

// Should error - 'd' is not used by targetFunction (only 'c' is accepted)
invalidRestRename({ a: 1, d: true });
