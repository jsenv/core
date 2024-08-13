export const setNpmConfig = (configString, configObject) => {
  return Object.keys(configObject).reduce((previous, key) => {
    return setOrUpdateNpmConfig(previous, key, configObject[key]);
  }, configString);
};

const setOrUpdateNpmConfig = (config, key, value) => {
  const assignmentIndex = config.indexOf(`${key}=`);
  if (assignmentIndex === -1) {
    if (config === "") {
      return `${key}=${value}`;
    }
    return `${config}
${key}=${value}`;
  }

  const beforeAssignment = config.slice(0, assignmentIndex);
  const nextLineIndex = config.indexOf("\n", assignmentIndex);
  if (nextLineIndex === -1) {
    return `${beforeAssignment}${key}=${value}`;
  }

  const afterAssignment = config.slice(nextLineIndex);
  return `${beforeAssignment}${key}=${value}${afterAssignment}`;
};
