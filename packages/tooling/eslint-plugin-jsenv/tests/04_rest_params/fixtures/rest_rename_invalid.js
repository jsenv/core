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

// Invalid: Rest param renamed but target function doesn't exist
const invalidNoTarget = ({ b, ...config }) => {
  const settings = config;
  nonExistentFunction(settings);
};

// Should error - nonExistentFunction doesn't exist, so we can't verify usage
invalidNoTarget({ b: 2, unused: "value" });
