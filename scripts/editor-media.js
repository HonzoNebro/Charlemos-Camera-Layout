import { overlayMediaKind } from "./camera-layout-style.js";

export function inspectOverlayResource(ownerDocument, path, { signal, timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted || !path) { resolve("unavailable"); return; }
    const video = overlayMediaKind(path) === "video";
    const element = ownerDocument.createElement(video ? "video" : "img");
    const ready = video ? "loadedmetadata" : "load";
    let timer;
    let finished = false;
    const finish = (state) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      element.removeEventListener(ready, onReady);
      element.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      element.removeAttribute("src");
      element.remove();
      resolve(state);
    };
    const onReady = () => finish("available");
    const onError = () => finish("unavailable");
    const onAbort = () => finish("unavailable");
    element.addEventListener(ready, onReady);
    element.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => finish("unavailable"), timeout);
    if (video) element.preload = "metadata";
    element.src = path;
  });
}
