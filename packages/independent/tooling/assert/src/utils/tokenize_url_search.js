export const tokenizeUrlSearch = (search) => {
  // we don't use new URLSearchParams to preserve plus signs, see
  // see https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#preserving_plus_signs
  const params = search.slice(1).split("&");
  const paramsMap = new Map();
  for (const param of params) {
    let [urlSearchParamKey, urlSearchParamValue] = param.split("=");
    urlSearchParamKey = decodeURIComponent(urlSearchParamKey);
    urlSearchParamValue = decodeURIComponent(urlSearchParamValue);
    const existingUrlSearchParamValue = paramsMap.get(urlSearchParamKey);
    if (existingUrlSearchParamValue) {
      urlSearchParamValue = [
        ...existingUrlSearchParamValue,
        urlSearchParamValue,
      ];
    } else {
      urlSearchParamValue = [urlSearchParamValue];
    }
    paramsMap.set(urlSearchParamKey, urlSearchParamValue);
  }
  return paramsMap;
};
