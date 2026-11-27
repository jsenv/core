// A warning about how the app is written is one fact, said once: repeated at
// every render or every change, it buries the rest of the console.
const warningsSaid = new Set();

export const warnOnce = (message, ...args) => {
  if (warningsSaid.has(message)) {
    return;
  }
  warningsSaid.add(message);
  console.warn(message, ...args);
};
