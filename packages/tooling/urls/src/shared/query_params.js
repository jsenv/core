export const asUrlWithoutSearch = (url) => {
  url = String(url);
  if (url.includes("?")) {
    const urlObject = new URL(url);
    urlObject.search = "";
    return urlObject.href;
  }
  return url;
};

export const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const asSpecifierWithoutSearch = (specifier) => {
  if (isValidUrl(specifier)) {
    return asUrlWithoutSearch(specifier);
  }
  const [beforeQuestion] = specifier.split("?");
  return beforeQuestion;
};

// normalize url search params:
// Using URLSearchParams to alter the url search params
// can result into "file:///file.css?css_module"
// becoming "file:///file.css?css_module="
// we want to get rid of the "=" and consider it's the same url
export const normalizeUrl = (url) => {
  const calledWithString = typeof url === "string";
  const urlObject = calledWithString ? new URL(url) : url;
  let urlString = urlObject.href;

  if (!urlString.includes("?")) {
    return url;
  }
  // disable on data urls (would mess up base64 encoding)
  if (urlString.startsWith("data:")) {
    return url;
  }
  urlString = urlString.replace(/[=](?=&|$)/g, "");
  if (calledWithString) {
    return urlString;
  }
  urlObject.href = urlString;
  return urlObject;
};

export const injectQueryParamsIntoSpecifier = (specifier, params) => {
  if (isValidUrl(specifier)) {
    return injectQueryParams(specifier, params);
  }
  const [beforeQuestion, afterQuestion = ""] = specifier.split("?");
  const searchParams = new URLSearchParams(afterQuestion);
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  });
  let paramsString = searchParams.toString();
  if (paramsString) {
    paramsString = paramsString.replace(/[=](?=&|$)/g, "");
    return `${beforeQuestion}?${paramsString}`;
  }
  return beforeQuestion;
};

export const injectQueryParams = (url, params) => {
  const calledWithString = typeof url === "string";
  const urlObject = calledWithString ? new URL(url) : url;
  const { searchParams } = urlObject;
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === undefined) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  }
  return normalizeUrl(calledWithString ? urlObject.href : urlObject);
};

export const injectQueryParamWithoutEncoding = (url, key, value) => {
  const urlObject = new URL(url);
  let { origin, pathname, search, hash } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  if (search === "") {
    search = `?${key}=${value}`;
  } else {
    search += `${key}=${value}`;
  }
  return `${origin}${pathname}${search}${hash}`;
};
export const injectQueryParamIntoSpecifierWithoutEncoding = (
  specifier,
  key,
  value,
) => {
  if (isValidUrl(specifier)) {
    return injectQueryParamWithoutEncoding(specifier, key, value);
  }
  const [beforeQuestion, afterQuestion = ""] = specifier.split("?");
  const searchParams = new URLSearchParams(afterQuestion);
  let search = searchParams.toString();
  if (search === "") {
    search = `?${key}=${value}`;
  } else {
    search = `?${search}&${key}=${value}`;
  }
  return `${beforeQuestion}${search}`;
};

export const renderUrlOrRelativeUrlFilename = (urlOrRelativeUrl, renderer) => {
  const questionIndex = urlOrRelativeUrl.indexOf("?");
  const beforeQuestion =
    questionIndex === -1
      ? urlOrRelativeUrl
      : urlOrRelativeUrl.slice(0, questionIndex);
  const afterQuestion =
    questionIndex === -1 ? "" : urlOrRelativeUrl.slice(questionIndex);
  const beforeLastSlash = beforeQuestion.endsWith("/")
    ? beforeQuestion.slice(0, -1)
    : beforeQuestion;
  const slashLastIndex = beforeLastSlash.lastIndexOf("/");
  const beforeFilename =
    slashLastIndex === -1 ? "" : beforeQuestion.slice(0, slashLastIndex + 1);
  const filename =
    slashLastIndex === -1
      ? beforeQuestion
      : beforeQuestion.slice(slashLastIndex + 1);
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  const extension = dotLastIndex === -1 ? "" : filename.slice(dotLastIndex);
  const newFilename = renderer({
    basename,
    extension,
  });
  return `${beforeFilename}${newFilename}${afterQuestion}`;
};
