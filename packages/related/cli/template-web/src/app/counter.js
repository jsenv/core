let clicks = 0;

export const initCounter = () => {
  const counterButton = document.querySelector("#counter_button");
  const counterOutput = document.querySelector("#counter_output");
  counterOutput.innerHTML = clicks;
  counterButton.onclick = () => {
    clicks++;
    counterOutput.innerHTML = clicks;
  };
};
