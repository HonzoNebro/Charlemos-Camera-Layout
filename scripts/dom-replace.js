export function replaceAppContent(content, result) {
  if (!content) return;
  const hasHTMLElement = typeof HTMLElement !== "undefined";
  if (hasHTMLElement && result instanceof HTMLElement) {
    content.replaceChildren(result);
    return;
  }
  if (Array.isArray(result)) {
    content.replaceChildren(...result);
    return;
  }
  content.innerHTML = String(result ?? "");
}
