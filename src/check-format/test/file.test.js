import { projectFolder } from "../../../projectFolder.js"
import { checkFormat } from "../checkFormat.js"

checkFormat({
  projectFolder,
  formattableDescription: {
    "/src/check-format/test/file.js": true,
  },
})
