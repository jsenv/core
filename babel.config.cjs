module.exports = {
  plugins: [
    [
      "@babel/plugin-syntax-optional-chaining-assign",
      {
        version: "2023-07",
      },
    ],
    [
      "@babel/plugin-transform-react-jsx",
      {
        runtime: "classic",
        pragma: "React.createElement",
        pragmaFrag: "React.Fragment",
      },
    ],
    [
      "@babel/plugin-syntax-decorators",
      {
        version: "2023-11",
      },
    ],
  ],
};
