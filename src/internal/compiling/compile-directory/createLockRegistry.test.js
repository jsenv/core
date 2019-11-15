import { assert } from "@jsenv/assert"
import { createLockRegistry } from "./createLockRegistry.js"

{
  const lockRegistry = createLockRegistry()
  const lockA1 = lockRegistry.lockForRessource()
  const lockA2 = lockRegistry.lockForRessource()

  let a2Resolved = false
  lockA2.then(() => {
    a2Resolved = true
  })

  const unlockA1 = await lockA1
  assert({ actual: a2Resolved, expected: false })
  unlockA1()
  await lockA2
  assert({ actual: a2Resolved, expected: true })
}

{
  const lockRegistry = createLockRegistry()
  const lockA = lockRegistry.lockForRessource("a")
  const lockB = lockRegistry.lockForRessource("b")

  await lockA
  await lockB
}
