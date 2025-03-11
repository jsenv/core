module.exports = {
  plugins: [
    "@babel/plugin-syntax-import-attributes",
    [
      "@babel/plugin-syntax-optional-chaining-assign",
      {
        version: "2023-07",
      },
    ],
    [
      "@babel/plugin-transform-react-jsx",
      {
        pragma: "React.createElement",
        pragmaFrag: "React.Fragment",
      },
    ],
    [
      "@babel/plugin-syntax-decorators",
      {
        decoratorsBeforeExport: true,
      },
    ],
  ],
};
