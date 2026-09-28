export function handleEnterFlowKeyDown(e) {
  if (e.key !== 'Enter') return;
  const wrap = e.target.closest('.enter-flow');
  if (!wrap) return;
  if (e.target.tagName === 'TEXTAREA' && e.shiftKey) return;
  if (e.target.type === 'file') return;
  // If user hits Enter on a button, let the default click behavior happen
  if (e.target.tagName === 'BUTTON' || e.target.type === 'submit') return;

  e.preventDefault();
  const focusables = [...wrap.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea, button')].filter(
    (x) => !x.disabled && x.offsetParent !== null
  );
  const index = focusables.indexOf(e.target);
  if (index >= 0 && focusables[index + 1]) {
    focusables[index + 1].focus();
  }
}
