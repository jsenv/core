import path from "path"
import { writeSourceMapBase64, writeSourceMapComment } from "./writeSourceInfo.js"

export const sourceMapper = ({ code, map, ...rest }, { sourceMapLocation }, context) => {
  if (typeof map === "object") {
    // delete map.sourcesContent
    // we could remove sources content, they can be fetched from server
    // removing them will decrease size of sourceMap BUT force
    // the client to fetch the source resulting in an additional http request

    // we could delete map.sourceRoot to ensure clientLocation is absolute
    // but it's not set anyway because not passed to babel during compilation

    if (sourceMapLocation === "inline") {
      return {
        code: writeSourceMapBase64(code, map, context),
        map,
        ...rest,
      }
    }
    if (sourceMapLocation === "comment") {
      // folder/file.js -> file.js.map
      const name = `${path.basename(context.inputRelativeLocation)}.map`

      return {
        code: writeSourceMapComment(code, name, context),
        map,
        mapName: name,
        ...rest,
      }
    }
  }

  return { code, map, ...rest }
}
