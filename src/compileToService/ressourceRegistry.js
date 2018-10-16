import { createLockRegistry } from "../createLock/createLock.js"

const { lockForRessource } = createLockRegistry()

export { lockForRessource }
