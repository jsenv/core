import { require } from "internal/require.js"

const { buildExternalHelpers } = require("@babel/core")
const { getDependencies } = require("@babel/helpers")

export const generateBabelHelper = (name) => {
  const helpersToBuild = [name]

  /**
   * we have to ensure we generate helper dependencies too because
   * some helper contains import like
   * import "setPrototypeOf"
   * and babel deletes them somehow during buildExternalHelpers
   *
   * To fix that we could for instance extract babel helpers into
   * actual files like we already do for global-this
   * or regenerator-runtime
   *
   * But it means every babel update means updating thoose files too.
   * for now let's keep it like that
   */

  const ensureDependencies = (name) => {
    const dependencies = getDependencies(name)
    dependencies.forEach((name) => {
      if (helpersToBuild.includes(name)) {
        return
      }
      helpersToBuild.push(name)
      ensureDependencies(name)
    })
  }
  ensureDependencies(name)

  return buildExternalHelpers(helpersToBuild, "module")
}
