const { buildExternalHelpers } = import.meta.require("@babel/core")

export const generateBabelHelper = (name) => buildExternalHelpers([name], "module")
