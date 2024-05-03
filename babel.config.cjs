module.exports = {
  plugins: [
    "@babel/plugin-syntax-import-assertions",
    [
      "@babel/plugin-syntax-optional-chaining-assign",
      {
        version: "2023-07",
      },
    ],
  ],
};
