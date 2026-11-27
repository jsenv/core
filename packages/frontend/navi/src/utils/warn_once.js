// A warning about how the app is written is one fact, said once: repeated at
// every render, every change or every navigation, it buries the rest of the
// console. Said once per `key` — the message itself, or the name of one that
// carries values (which element, which route).
const warningsSaid = new Set();

export const warnOnce = (key, message = key) => {
  if (warningsSaid.has(key)) {
    return;
  }
  warningsSaid.add(key);
  console.warn(message);
};
