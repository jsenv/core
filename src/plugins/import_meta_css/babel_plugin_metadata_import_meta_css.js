export const babelPluginMetadataImportMetaCss = () => {
  return {
    name: "metadata-import-meta-css",
    visitor: {
      Program(programPath, state) {
        Object.assign(state.file.metadata, collectImportMetaCss(programPath));
      },
    },
  };
};
const collectImportMetaCss = (programPath) => {
  const importMetaCssPaths = [];
  programPath.traverse({
    MemberExpression(path) {
      const { node } = path;
      const { object } = node;
      if (object.type !== "MetaProperty") {
        return;
      }
      const { property: objectProperty } = object;
      if (objectProperty.name !== "meta") {
        return;
      }
      const { property } = node;
      const { name } = property;
      if (name === "css") {
        importMetaCssPaths.push(path);
      }
    },
  });
  return {
    importMetaCssPaths,
  };
};
