// Functions with complex destructuring patterns
export function processUser({
  name,
  email,
  profile: { age, preferences: { theme, notifications = {} } = {} } = {},
  settings: { privacy = "public", ...restSettings } = {},
}) {
  return { name, email, age, theme, notifications, privacy, restSettings };
}

export function handleNestedData({
  data: {
    user: { id, username },
    metadata: { created, modified = null },
    ...extraData
  },
  options: { validate = true, transform = false } = {},
}) {
  return { id, username, created, modified, extraData, validate, transform };
}

export function arrayDestructuring(
  [first, second, ...rest],
  { mode = "default" } = {},
) {
  return { first, second, rest, mode };
}
