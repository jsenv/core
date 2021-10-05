module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false,
        targets: {
          safari: "10",
          edge: "17",
          chrome: "47",
          firefox: "48",
        },
        exclude: ["transform-async-to-generator", "transform-regenerator"],
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
    "babel-plugin-transform-async-to-promises",
  ],
}
