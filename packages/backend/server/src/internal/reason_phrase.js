// An HTTP/1.1 reason phrase allows HTAB, SP, VCHAR and obs-text (0x80-0xFF),
// see RFC 9112 section 4. Node's writeHead and the Response constructor both
// throw on anything else. A status text often echoes a request (a file path
// decoded from the url for instance), so the characters outside that set are
// percent-encoded rather than dropped: the text stays readable and reversible.
export const asReasonPhrase = (value) => {
  return String(value).replace(/[^\t\x20-\x7e\x80-\xff]/g, encodeChar);
};

const encodeChar = (char) => {
  try {
    return encodeURIComponent(char);
  } catch {
    // lone surrogate
    return "%3F";
  }
};
