// Valid: Rest param renamed and passed to function that uses the property
const validRestRename = ({ a, ...rest }) => {
  const titi = rest;
  targetFunction(titi);
};

const targetFunction = ({ c }) => {
  console.log(c);
};

validRestRename({ a: 1, c: true }); // Should be valid - 'c' is used by targetFunction

// Valid: Multiple levels of renaming
const validMultipleRename = ({ key, ...settings }) => {
  const config = settings;
  const options = config;
  processConfig(options);
};

const processConfig = ({ debug, verbose }) => {
  console.log(debug, verbose);
};

validMultipleRename({ key: "value", debug: true, verbose: false });
