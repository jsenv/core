import { resolvePath } from "./helpers.js"

export const getMetaLocation = ({ root, into, group, file }) => {
  return resolvePath(root, into, group, `${file}__meta__`, "meta.json")
}

export const getAssetLocation = ({ root, into, group, file, asset }) => {
  return resolvePath(root, into, group, `${file}__meta__`, asset)
}

export const getOutputLocation = ({ root, into, group, file }) => {
  return resolvePath(root, into, group, file)
}

export const getGroupLocation = ({ root, into, group }) => {
  return resolvePath(root, into, group)
}

export const getOutputName = ({ into, group, file }) => {
  return resolvePath(into, group, file)
}
