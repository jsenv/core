## raceCallbacks

Taking different code paths based on different inputs is messy and code oftens forget to clean things behind itself.

"raceCallbacks" helps to do both properly with the following API

```js
import { raceCallbacks } from "somewhere";

raceCallbacks(
  {
    timeout: (cb) => {
      const timeout = setTimeout(cb, 1000);
      return () => {
        clearTimeout(timeout);
      };
    },
    error: () => {
      something.on("error", cb);
      return () => {
        return something.removeListener("error", cb);
      };
    },
    end: () => {
      something.on("end", cb);
      return () => {
        return something.removeListener("end", cb);
      };
    },
  },
  (winner) => {
    const raceEffects = {
      timeout: () => console.log("timeout after 1000ms"),
      error: (e) => console.error("error", e),
      end: (value) => console.log("end", value),
    };
    raceEffects[winner.name](winner.data);
  },
);
```
