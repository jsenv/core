import { checkFormat } from "../../index.js"

const { projectFolder } = import.meta.require("../../jsenv.config.js")

checkFormat({
  projectFolder,
  formattableDescription: {
    "/src/check-format/test/file.js": true,
  },
})
