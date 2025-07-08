export const NOT_BUSY_CONSTRAINT = {
  name: "not_busy",
  check: (element, { skipBusy }) => {
    if (skipBusy) {
      return null;
    }
    if (element.getAttribute("aria-busy") === "true") {
      const busyMessage = element.getAttribute("data-busy-message");
      return {
        message:
          busyMessage || `Cette action est en cours. Veuillez patienter.`,
        level: "info",
      };
    }
    return null;
  },
};
