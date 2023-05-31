import { urlToOrigin } from "./url_to_origin.js";
import { urlToResource } from "./url_to_resource.js";

export const urlToParentUrl = (url) => {
  const resource = urlToResource(url);
  const slashLastIndex = resource.lastIndexOf("/");
  if (slashLastIndex === -1) {
    const urlAsString = String(url);
    return urlAsString;
  }

  const lastCharacterIndex = resource.length - 1;
  if (slashLastIndex === lastCharacterIndex) {
    const slashPreviousIndex = resource.lastIndexOf(
      "/",
      lastCharacterIndex - 1,
    );
    if (slashPreviousIndex === -1) {
      const urlAsString = String(url);
      return urlAsString;
    }

    const origin = urlToOrigin(url);
    const parentUrl = `${origin}${resource.slice(0, slashPreviousIndex + 1)}`;
    return parentUrl;
  }

  const origin = urlToOrigin(url);
  const parentUrl = `${origin}${resource.slice(0, slashLastIndex + 1)}`;
  return parentUrl;
};
