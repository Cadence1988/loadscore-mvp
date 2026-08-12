const REPLACEABLE_TYPES = new Set(["text", "number", "search", "email", "tel", "url"]);
export function shouldSelectExistingValue(element) { return element?.tagName === "INPUT" && REPLACEABLE_TYPES.has(element.type || "text") && !element.readOnly && !element.disabled && String(element.value || "").length > 0; }
export function installInputReplacement(root = document) {
  root.addEventListener("pointerdown", (event) => { const input = event.target; if (shouldSelectExistingValue(input) && document.activeElement !== input) input.dataset.replaceOnPointerUp = "true"; }, true);
  root.addEventListener("focus", (event) => { if (shouldSelectExistingValue(event.target)) event.target.select(); }, true);
  root.addEventListener("pointerup", (event) => { const input = event.target; if (input?.dataset?.replaceOnPointerUp === "true") { event.preventDefault(); input.select(); delete input.dataset.replaceOnPointerUp; } }, true);
}
