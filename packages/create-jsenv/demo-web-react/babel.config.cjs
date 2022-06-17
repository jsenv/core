module.exports = {
  plugins: [
    "@babel/plugin-syntax-import-assertions",
    [
      "@babel/plugin-transform-react-jsx",
      {
        pragma: "React.createElement",
        pragmaFrag: "React.Fragment",
      },
    ],
  ],
}
