/*
 * See callback_race.md
 */

export const raceCallbacks = (raceDescription, winnerCallback) => {
  let cleanCallbacks = [];
  let status = "racing";

  const clean = () => {
    cleanCallbacks.forEach((clean) => {
      clean();
    });
    cleanCallbacks = null;
  };

  const cancel = () => {
    if (status !== "racing") {
      return;
    }
    status = "cancelled";
    clean();
  };

  Object.keys(raceDescription).forEach((candidateName) => {
    const register = raceDescription[candidateName];
    const returnValue = register((data) => {
      if (status !== "racing") {
        return;
      }
      status = "done";
      clean();
      winnerCallback({
        name: candidateName,
        data,
      });
    });
    if (typeof returnValue === "function") {
      cleanCallbacks.push(returnValue);
    }
  });

  return cancel;
};
