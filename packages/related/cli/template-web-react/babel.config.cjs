module.exports = {
  plugins: [
    "@babel/plugin-syntax-import-attributes",
    [
      "@babel/plugin-transform-react-jsx",
      {
        pragma: "React.createElement",
        pragmaFrag: "React.Fragment",
      },
    ],
  ],
};
