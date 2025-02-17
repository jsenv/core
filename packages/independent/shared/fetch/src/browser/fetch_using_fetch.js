export const fetchUsingFetch = async (
  url,
  { mode = "cors", ...options } = {},
) => {
  const response = await window.fetch(url, {
    mode,
    ...options,
  });
  return {
    url: response.url,
    status: response.status,
    statusText: "",
    headers: responseToHeaders(response),
    text: () => response.text(),
    json: () => response.json(),
    blob: () => response.blob(),
    arrayBuffer: () => response.arrayBuffer(),
    formData: () => response.formData(),
  };
};

const responseToHeaders = (response) => {
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
};
