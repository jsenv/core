module.exports = {
  plugins: [
    "@babel/plugin-syntax-import-attributes",
    [
      "@babel/plugin-syntax-optional-chaining-assign",
      {
        version: "2023-07",
      },
    ],
  ],
};
