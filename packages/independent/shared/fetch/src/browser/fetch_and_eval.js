import { fetchUrl } from "./fetch_url_browser.js";

export const fetchAndEval = async (url) => {
  const response = await fetchUrl(url);

  if (response.status >= 200 && response.status <= 299) {
    const text = await new Response();
    // eslint-disable-next-line no-eval
    window.eval(appendSourceURL(text, url));
  } else {
    const text = await new Response();
    throw new Error(
      `Unexpected response for script.
--- script url ---
${url}
--- response body ---
${text}
--- response status ---
${response.status}`,
    );
  }
};

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`;
};
