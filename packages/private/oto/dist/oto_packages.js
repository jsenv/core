import { A, d, _, q, y, T } from "/oto_node_modules.js";

const useFontFace = (
  family,
  { url, style = "normal", weight = "normal", stretch = "condensed" },
) => {
  const fontRef = A(false);
  const [fontReady, fontReadySetter] = d(false);
  if (!fontRef.current) {
    const font = new FontFace(family, `url(${url})`, {
      style,
      weight,
      stretch,
    });
    fontRef.current = font;
    font.load().then(() => {
      document.fonts.add(font);
      fontReadySetter(true);
    });
  }
  return fontReady;







};

const useResizeObserver = (
  {
    ref,
    getElementToObserve = (refElement) => refElement,
    onResize,
    ignoreInitial = false,
  },
  deps = [],
) => {
  const [size, sizeSetter] = d({
    width: undefined,
    height: undefined,
  });
  const isMountedRef = A(false);
  const previousSizeRef = A(size);
  const getElementToObserveRef = A(getElementToObserve);
  const elementToObserveRef = A(null);

  _(() => {
    let elementToObserve = ref.current;
    if (!elementToObserve) {
      isMountedRef.current = false;
      return null;
    }
    elementToObserve = getElementToObserveRef.current(elementToObserve);
    if (!elementToObserve) {
      isMountedRef.current = false;
      return null;
    }
    elementToObserveRef.current = elementToObserve;
    if (!isMountedRef.current) {
      const boundingClientRect = elementToObserve.getBoundingClientRect();
      const currentSize = {
        width: boundingClientRect.width,
        height: boundingClientRect.height,
      };
      previousSizeRef.current = currentSize;
      if (ignoreInitial) ; else if (onResize) {
        onResize(currentSize, elementToObserve);
      } else {
        sizeSetter(currentSize);
      }
      isMountedRef.current = true;
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [ref, ignoreInitial]);

  const resizeObserverRef = A(null);
  const resizeObserverStateRef = A("idle");
  const observe = q(() => {
    if (resizeObserverStateRef.state === "observing") {
      return;
    }
    let resizeObserver = resizeObserverRef.current;
    const elementToObserve = elementToObserveRef.current;
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(([entry]) => {
        if (!entry) {
          return;
        }
        if (!isMountedRef.current) {

          return;
        }
        const boundingClientRect = elementToObserve.getBoundingClientRect();
        const newSize = {
          width: boundingClientRect.width,
          height: boundingClientRect.height,
        };
        const hasChanged =
          previousSizeRef.current.width !== newSize.width ||
          previousSizeRef.current.height !== newSize.height;
        if (!hasChanged) {
          return;
        }
        previousSizeRef.current = newSize;
        if (onResize) {
          unobserve();
          onResize(newSize, elementToObserve);
          observe();
        } else if (isMountedRef.current) {
          sizeSetter(newSize);
        }
      });
      resizeObserverRef.current = resizeObserver;
    }
    const boundingClientRect = elementToObserve.getBoundingClientRect();
    const currentSize = {
      width: boundingClientRect.width,
      height: boundingClientRect.height,
    };
    previousSizeRef.current = currentSize;
    resizeObserverStateRef.current = "observing";
    resizeObserver.observe(elementToObserve);
  }, [onResize]);
  const unobserve = q(() => {
    if (resizeObserverStateRef.current === "idle") {
      return;
    }
    const resizeObserver = resizeObserverRef.current;
    if (!resizeObserver) {
      return;
    }
    const elementToObserve = elementToObserveRef.current;
    resizeObserverStateRef.current = "idle";
    resizeObserver.unobserve(elementToObserve);
  }, []);

  const performSizeSideEffects = q((callback) => {
    unobserve();
    callback();
    observe();
  }, []);

  y(() => {
    observe();
    return () => {
      const resizeObserver = resizeObserverRef.current;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [ref, observe, unobserve, ...deps]);

  return [size.width, size.height, performSizeSideEffects];
};

const useKeyEffect = (keyCallbacks) => {
  const deps = [];
  const keys = Object.keys(keyCallbacks);
  const effects = {};
  for (const key of keys) {
    deps.push(key);
    const keyEffect = keyCallbacks[key];
    if (typeof keyEffect === "function") {
      deps.push(keyEffect);
      effects[key] = { enabled: true, callback: keyEffect };
    } else {
      const { enabled, callback } = keyEffect;
      deps.push(enabled, callback);
      effects[key] = keyEffect;
    }
  }

  y(() => {
    const onKeyDown = (keydownEvent) => {
      const eventKey = keydownEvent.key;
      const keyEffect = effects[eventKey];
      if (keyEffect?.enabled) {
        keydownEvent.preventDefault();
        keyEffect.callback(keydownEvent);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, deps);
};

const useStructuredMemo = (props) => {
  return T(
    () => props,
    Object.keys(props).map((key) => props[key]),
  );
};

const useDrawImage = (
  canvas,
  source,
  { x = 0, y = 0, width, height, opacity = 1, onFirstDraw, onDraw, debug } = {},
) => {
  const firstDrawRef = A(true);
  const draw = () => {
    if (!canvas) return;
    if (typeof source === "function") source = source();
    if (!source) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (width === undefined) {
      width = canvas.width;
    }
    if (height === undefined) {
      height = canvas.height;
    }
    if (debug) {
      console.log("draw image", {
        sx: x,
        sy: y,
        sWidth: width,
        sHeight: height,
        dx: 0,
        dy: 0,
        dWidth: canvas.width,
        dHeight: canvas.height,
      });
    }
    context.globalAlpha = opacity;
    context.drawImage(
      source,
      x,
      y,
      width,
      height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    if (onDraw) {
      onDraw();
    }
    if (firstDrawRef.current) {
      firstDrawRef.current = false;
      if (onFirstDraw) {
        onFirstDraw();
      }
    }
  };

  _(() => {
    draw();
  }, [canvas, source, x, y, width, height, opacity, onDraw]);

  return draw;
};

const useSubscription = (get, subscribe) => {
  const [value, valueSetter] = d(get());
  const cleanupRef = A(null);
  if (cleanupRef.current === null) {
    const subscribeReturnValue = subscribe(() => {
      valueSetter(get());
    });
    if (typeof subscribeReturnValue === "function") {
      cleanupRef.current = subscribeReturnValue;
    } else {
      cleanupRef.current = true;
    }
  }
  y(() => {
    return () => {
      const cleanup = cleanupRef.current;
      if (typeof cleanup === "function") {
        cleanup();
      }
      cleanupRef.current = null;
    };
  }, []);
  return value;
};

const useImageLoader = (source) => {
  const dataRef = A({
    image: null,
    loading: false,
    error: null,
  });
  const onLoadStart = () => {
    dataRef.current.loading = true;
  };
  const onLoadError = (image, error) => {
    dataRef.current.image = image;
    dataRef.current.loading = false;
    dataRef.current.error = error;
  };
  const onLoadEnd = (image) => {
    dataRef.current.image = image;
    dataRef.current.loading = false;
  };

  let subscribe;
  if (typeof source === "string" || source instanceof URL) {
    onLoadStart();
    subscribe = (update) => {
      const image = new Image();
      const onerror = (errorEvent) => {
        image.removeEventListener("error", onerror);
        image.removeEventListener("load", onload);
        onLoadError(image, errorEvent);
        update();
      };
      const onload = () => {
        image.removeEventListener("error", onerror);
        image.removeEventListener("load", onload);
        onLoadEnd(image);
        update();
      };
      image.addEventListener("error", onerror);
      image.addEventListener("load", onload);
      image.src = source;
      return () => {
        image.removeEventListener("error", onerror);
        image.removeEventListener("load", onload);
      };
    };
  } else if (
    source instanceof HTMLImageElement ||
    source instanceof SVGImageElement ||
    source instanceof HTMLCanvasElement ||
    source instanceof OffscreenCanvas
  ) {
    onLoadEnd(source);
    subscribe = () => {};
  } else {
    throw new Error("unknown source");
  }

  return useSubscription(() => {
    const { image, loading, error } = dataRef.current;
    if (loading) {
      return [null, null];
    }
    if (error) {
      return [null, error];
    }
    return [image, null];
  }, subscribe);
};



const fromTransformations = ({ flip, translate, rotate, scale }) => {
  let _a = 1;
  let _b = 0;
  let _c = 0;
  let _d = 1;
  let _e = 0;
  let _f = 0;
  const transform = (a, b, c, d, e, f) => {
    _a = _a * a + _c * b;
    _b = _b * a + _d * b;
    _c = _a * c + _c * d;
    _d = _b * c + _d * d;
    _e = _a * e + _c * f + _e;
    _f = _b * e + _d * f + _f;
  };

  if (flip) {
    const { x, y } = flip;
    if (x) {
      transform(-1, 0, 0, 1, 0, 0);
    }
    if (y) {
      transform(1, 0, 0, -1, 0, 0);
    }
  }
  if (translate) {
    const { x, y } = translate;
    if (x !== undefined) {
      transform(1, 0, 0, 1, x, 0);
    }
    if (y !== undefined) {
      transform(1, 0, 0, 1, 0, y);
    }
  }
  if (rotate) {
    const angle = rotate * 0.017453292519943295;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    transform(cos, sin, -sin, cos, 0, 0);
  }
  if (scale) {
    if (typeof scale === "object") {
      const { x, y } = scale;
      if (x !== undefined) {
        transform(x, 0, 0, 1, 0, 0);
      }
      if (y !== undefined) {
        transform(1, 0, 0, y, 0, 0);
      }
    } else {
      transform(scale, 0, 0, scale, 0, 0);
    }
  }

  return [_a, _b, _c, _d, _e, _f];
};

export { fromTransformations, useDrawImage, useFontFace, useImageLoader, useKeyEffect, useResizeObserver, useStructuredMemo };