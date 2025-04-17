import { useRef } from "preact/hooks";
import { useSubscription } from "/utils/use_subscription.js";

export const useImageLoader = (source) => {
  const dataRef = useRef({
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
