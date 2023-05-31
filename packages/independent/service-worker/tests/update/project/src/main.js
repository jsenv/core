/* eslint-env browser */
import { swFacade } from "./sw_facade.js";

const animalUrl = new URL("./animal.svg", import.meta.url);
const imageHotUpdateCheckbox = document.querySelector("#image_hot_update");

const img = document.querySelector("img");

document.querySelector("img").src = animalUrl;

/*
 * In theory it's possible to hot replace resources used by a service worker
 * In practice it's very easy to do incorrectly and end up with outdated resources.
 * Moreover 99% of things happens in JS where code can do anything
 * so it would be quite hard to detect what has changed and apply only these changes
 * That being said, code written with react or such frameworks could be easier
 * to frameworks like react ensure things are easier to update
 * framework like react or anything concrete example wherecode that can do anything so it's very
 * hard to ensure the replacement can be done
 */
swFacade.defineResourceUpdateHandler(import.meta.url, () => {
  return {
    replace: () => {},
  };
});
swFacade.defineResourceUpdateHandler(animalUrl, () => {
  if (!imageHotUpdateCheckbox.checked) {
    return null;
  }
  return {
    replace: async ({ toUrl }) => {
      const src = img.src;
      if (src && src.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
      img.src = "";
      const response = await window.fetch(toUrl);
      const blob = await response.blob();
      const urlAsBlobString = URL.createObjectURL(blob);
      await new Promise((resolve) => setTimeout(resolve, 150));
      img.src = urlAsBlobString;
    },
    remove: () => URL.revokeObjectURL(img.src),
  };
});
