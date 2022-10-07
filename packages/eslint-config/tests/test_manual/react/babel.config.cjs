const babelPluginSyntaxJSX = require("@babel/plugin-syntax-jsx")

module.exports = {
  plugins: [
    [
      babelPluginSyntaxJSX,
      {
        pragma: "React.createElement",
        pragmaFrag: "React.Fragment",
      },
    ],
  ],
}
