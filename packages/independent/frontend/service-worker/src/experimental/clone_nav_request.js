/* eslint-env serviceworker */

export const cloneNavRequest = async (request) => {
  const requestClone = request.clone();
  const {
    method,
    body,
    credentials,
    headers,
    integrity,
    referrer,
    referrerPolicy,
  } = requestClone;
  if (method === "GET" || method === "HEAD") {
    return new Request(request.url, {
      credentials,
      headers,
      integrity,
      referrer,
      referrerPolicy,
      mode: "same-origin",
      redirect: "manual",
    });
  }
  const bodyPromise = body ? Promise.resolve(body) : requestClone.blob();
  const bodyValue = await bodyPromise;
  return new Request(request.url, {
    body: bodyValue,
    credentials,
    headers,
    integrity,
    referrer,
    referrerPolicy,
    mode: "same-origin",
    redirect: "manual",
  });
};
