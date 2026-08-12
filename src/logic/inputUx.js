const REPLACEABLE_TYPES = new Set(["text", "number", "search", "email", "tel", "url"]);

export function isReplaceableInput(element) {
  return element?.tagName === "INPUT" && REPLACEABLE_TYPES.has(element.type || "text") && !element.readOnly && !element.disabled;
}

export function shouldSelectExistingValue(element) {
  return isReplaceableInput(element) && String(element.value || "").length > 0;
}

export function handleInputPointerDownCapture(event) {
  const input = event.target;
  if (shouldSelectExistingValue(input) && document.activeElement !== input) input.dataset.replaceOnPointerUp = "true";
}

export function handleInputFocusCapture(event) {
  if (shouldSelectExistingValue(event.target)) event.target.select();
}

export function handleInputPointerUpCapture(event) {
  const input = event.target;
  if (input?.dataset?.replaceOnPointerUp !== "true") return;
  event.preventDefault();
  input.select();
  delete input.dataset.replaceOnPointerUp;
}
