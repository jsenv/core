module.exports = {
  plugins: [
    [
      "@babel/plugin-syntax-jsx",
      {
        pragma: "React.createElement",
        pragmaFrag: "React.Fragment",
      },
    ],
  ],
}
