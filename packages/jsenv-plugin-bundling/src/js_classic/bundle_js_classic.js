/*
 * TODO:
 * js classic might contain importScripts or self.importScripts calls
 * (when it's inside worker, service worker, etc...)
 * ideally we should bundle it when urlInfo.subtype === "worker"
 */

// import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

export const bundleJsClassic = () => {
  return {}
}
