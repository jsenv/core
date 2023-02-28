/* eslint-env browser */
import { swFacade } from "./sw_facade.js"

const animalUrl = new URL("./animal.svg", import.meta.url)
const imageHotUpdateCheckbox = document.querySelector("#image_hot_update")

const img = document.querySelector("img")

document.querySelector("img").src = animalUrl

swFacade.defineResourceUpdateHandler("animal.svg", () => {
  if (!imageHotUpdateCheckbox.checked) {
    return null
  }
  return {
    replace: async ({ toUrl }) => {
      img.src = ""
      const response = await window.fetch(toUrl)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      await new Promise((resolve) => setTimeout(resolve, 150))
      img.src = objectUrl
    },
    remove: () => URL.revokeObjectURL(img.src),
  }
})
