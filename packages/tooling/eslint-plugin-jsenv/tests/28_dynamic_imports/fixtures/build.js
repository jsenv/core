// build.js - the actual build function
export const build = ({ logLevel, bundling, minification }) => {
  return {
    logLevel,
    bundling,
    minification,
    result: "built",
  };
};
