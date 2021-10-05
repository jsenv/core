module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          safari: "10",
          edge: "17",
          chrome: "47",
          firefox: "48",
        },
      },
    ],
  ],
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
