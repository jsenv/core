// https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#getpackageversion
// https://github.com/npm/registry-issue-archive/issues/34
// https://stackoverflow.com/questions/53212849/querying-information-about-specific-version-of-scoped-npm-package

export const fetchLatestInRegistry = async ({
  registryUrl,
  packageName,
  token,
}) => {
  const requestUrl = `${registryUrl}/${packageName}`;
  const response = await fetchWithRetryOnTransientError(requestUrl, {
    method: "GET",
    headers: {
      // "user-agent": "jsenv",
      accept:
        "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
      ...(token
        ? {
            authorization: `token ${token}`,
          }
        : {}),
    },
  });
  const responseStatus = response.status;
  if (responseStatus === 404) {
    return null;
  }
  if (responseStatus !== 200) {
    throw new Error(
      writeUnexpectedResponseStatus({
        requestUrl,
        responseStatus,
        responseText: await response.text(),
      }),
    );
  }
  const packageObject = await response.json();
  return packageObject.versions[packageObject["dist-tags"].latest];
};

// The registry (or a middlebox) sometimes closes a keep-alive socket while a
// request is in flight, surfacing as "fetch failed" with ECONNRESET. Fetching a
// whole workspace fires many requests at once so one reset per run is common.
// These failures are transient by nature and cannot be prevented client-side,
// so retry a couple of times before giving up.
const TRANSIENT_NETWORK_ERROR_CODES = [
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
];
const fetchWithRetryOnTransientError = async (url, options) => {
  let attemptCount = 0;
  while (true) {
    attemptCount++;
    try {
      return await fetch(url, options);
    } catch (e) {
      const errorCode = e.cause?.code;
      if (
        attemptCount >= 3 ||
        !TRANSIENT_NETWORK_ERROR_CODES.includes(errorCode)
      ) {
        throw e;
      }
      const delay = attemptCount * 500;
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }
};

const writeUnexpectedResponseStatus = ({
  requestUrl,
  responseStatus,
  responseText,
}) => `package registry response status should be 200.
--- request url ----
${requestUrl}
--- response status ---
${responseStatus}
--- response text ---
${responseText}`;
