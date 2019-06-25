export const resolveCompileId = ({ groupId, groupMap }) => {
  if (typeof groupId === "undefined") {
    if ("otherwise" in groupMap) return "otherwise"

    const keys = Object.keys(groupMap)
    if (keys.length === 1) return keys[0]

    throw new Error(createUnexpectedGroupIdMessage({ groupMap }))
  }

  if (groupId in groupMap === false)
    throw new Error(createUnexpectedGroupIdMessage({ groupId, groupMap }))

  return groupId
}

const createUnexpectedGroupIdMessage = ({ compileId, groupMap }) => `unexpected groupId.
must be one of ${Object.keys(groupMap)}
got ${compileId}`
