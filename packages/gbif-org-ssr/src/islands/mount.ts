import { render, h, type ComponentType } from 'preact';

// Generic island bootstrapper. Finds the placeholder the server rendered
// (data-island="<name>"), reads its JSON props, and mounts the Preact component.
// Replaces the server fallback content on mount.
export function mountIsland<P>(name: string, Component: ComponentType<P>): void {
  const el = document.querySelector(`[data-island="${name}"]`);
  if (!el) return;

  const propsEl = document.getElementById(`island-props-${name}`);
  let props = {} as P;
  if (propsEl?.textContent) {
    try {
      props = JSON.parse(propsEl.textContent) as P;
    } catch {
      /* keep defaults */
    }
  }

  el.innerHTML = '';
  render(h(Component as ComponentType<unknown>, props as object), el);
}
