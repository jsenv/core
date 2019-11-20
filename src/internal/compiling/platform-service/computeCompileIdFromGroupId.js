import { COMPILE_ID_OTHERWISE } from "../../CONSTANTS.js"

export const computeCompileIdFromGroupId = ({ groupId, groupMap }) => {
  if (typeof groupId === "undefined") {
    if (COMPILE_ID_OTHERWISE in groupMap) return COMPILE_ID_OTHERWISE

    const keys = Object.keys(groupMap)
    if (keys.length === 1) return keys[0]

    throw new Error(createUnexpectedGroupIdMessage({ groupMap }))
  }

  if (groupId in groupMap === false)
    throw new Error(createUnexpectedGroupIdMessage({ groupId, groupMap }))

  return groupId
}

const createUnexpectedGroupIdMessage = ({ compileId, groupMap }) => `unexpected groupId.
--- expected compiled id ----
${Object.keys(groupMap)}
--- received compile id ---
${compileId}`
