export const pickRequestContentType = (request, acceptedContentTypeArray) => {
  const requestBodyContentType = request.headers["content-type"];
  if (!requestBodyContentType) {
    return null;
  }
  for (const acceptedContentType of acceptedContentTypeArray) {
    if (requestBodyContentType.includes(acceptedContentType)) {
      return acceptedContentType;
    }
  }
  return null;
};

export const createUnsupportedMediaTypeResponse = (
  request,
  acceptedContentTypeArray = [],
) => {
  return {
    status: 415,
    [`accept-${request.method}`]: acceptedContentTypeArray.join(", "),
  };
};
