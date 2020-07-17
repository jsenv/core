import { assert } from "@jsenv/assert"
import { createLockRegistry } from "./createLockRegistry.js"

// a second lock on same ressource await first one to be unlocked
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
}

// concurrent lock on same ressource again
{
  const lockRegistry = createLockRegistry()
  const lockA = lockRegistry.lockForRessource()
  const lockB = lockRegistry.lockForRessource()
  const lockC = lockRegistry.lockForRessource()

  const unlockA = await lockA

  unlockA()
  const unlockB = await lockB
  unlockB()
  const unlockC = await lockC
  unlockC()
  await lockC
}

// lock on different ressources do not have to await each other
{
  const lockRegistry = createLockRegistry()
  const lockA = lockRegistry.lockForRessource("a")
  const lockB = lockRegistry.lockForRessource("b")

  await lockA
  await lockB
}
