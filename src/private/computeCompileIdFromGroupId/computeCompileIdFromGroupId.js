import { OTHERWISE_ID } from "../GROUP_ID.js"

export const computeCompileIdFromGroupId = ({ groupId, groupMap }) => {
  if (typeof groupId === "undefined") {
    if (OTHERWISE_ID in groupMap) return OTHERWISE_ID

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
