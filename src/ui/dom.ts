export interface ElOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: ElOptions,
  children?: Array<Node | null | undefined>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts?.className) node.className = opts.className;
  if (opts?.text !== undefined) node.textContent = opts.text;
  if (opts?.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  }
  if (children) {
    for (const c of children) {
      if (c) node.appendChild(c);
    }
  }
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
