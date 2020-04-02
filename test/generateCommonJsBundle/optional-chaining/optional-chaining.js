const adventurer = {
  name: "Alice",
  cat: {
    name: "Dinah",
  },
}

const dogName = adventurer.dog?.name
if (dogName !== undefined) {
  throw new Error(`dogName should be undefined, got ${dogName}`)
}

const nonExistentMethodReturnValue = adventurer.someNonExistentMethod?.()

if (nonExistentMethodReturnValue !== undefined) {
  throw new Error(
    `nonExistentMethodReturnValue should be undefined, got ${nonExistentMethodReturnValue}`,
  )
}
