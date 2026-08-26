// biome-ignore lint/suspicious/noConfusingVoidType: page renders either return nothing or a cleanup fn
export type RouteRender = (container: HTMLElement) => void | (() => void);

interface Route {
  path: string;
  render: RouteRender;
}

const routes: Route[] = [];
let container: HTMLElement | null = null;
let cleanup: (() => void) | null = null;

export function registerRoute(path: string, render: RouteRender): void {
  routes.push({ path, render });
}

export function initRouter(target: HTMLElement): void {
  container = target;

  document.body.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest('a[data-link]');
    if (!(link instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    navigate(link.pathname);
  });

  window.addEventListener('popstate', () => renderCurrentRoute());

  renderCurrentRoute();
}

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  renderCurrentRoute();
}

function renderCurrentRoute(): void {
  if (!container) return;
  cleanup?.();
  cleanup = null;

  const path = window.location.pathname;
  const route = routes.find((r) => r.path === path) ?? routes.find((r) => r.path === '*');
  if (!route) return;

  container.innerHTML = '';
  const result = route.render(container);
  if (typeof result === 'function') cleanup = result;

  window.dispatchEvent(new CustomEvent('app:routechange'));
}
