import { fetchUrl } from "./fetch_url_browser.js";

export const fetchJson = async (url, options = {}) => {
  const response = await fetchUrl(url, options);
  const object = await response.json();
  return object;
};
