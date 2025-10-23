// Valid: Rest param renamed and passed to function that uses the property
const validRestRename = ({ a, ...rest }) => {
  console.log(a);
  const titi = rest;
  targetFunction(titi);
};

const targetFunction = ({ c }) => {
  console.log(c);
};

validRestRename({ a: 1, c: true }); // Should be valid - 'c' is used by targetFunction

// Valid: Multiple levels of renaming
const validMultipleRename = ({ key, ...settings }) => {
  console.log(key);
  const config = settings;
  const options = config;
  processConfig(options);
};

const processConfig = ({ debug, verbose }) => {
  console.log(debug, verbose);
};

validMultipleRename({ key: "value", debug: true, verbose: false });

// Valid: Rest param renamed but not propagated to trackable function
const validNoTarget = ({ b, ...config }) => {
  console.log(b);
  const settings = config;
  global.settings = settings; // Use settings without passing to a trackable function
};

// Should be valid - not propagated to trackable function, so no-unknown-params doesn't check
validNoTarget({ b: 2, unused: "value" });
