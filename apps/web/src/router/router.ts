export type RouteRender = (
  container: HTMLElement,
  params: Record<string, string>,
  // biome-ignore lint/suspicious/noConfusingVoidType: page renders either return nothing or a cleanup fn
) => void | (() => void);

interface Route {
  path: string;
  segments: string[];
  render: RouteRender;
}

const routes: Route[] = [];
let container: HTMLElement | null = null;
let cleanup: (() => void) | null = null;

export function registerRoute(path: string, render: RouteRender): void {
  routes.push({ path, segments: path.split('/'), render });
}

/** Matches `/books/:id` style patterns against a real path; returns null on mismatch. */
function matchRoute(route: Route, path: string): Record<string, string> | null {
  if (route.path === '*') return {};
  const pathSegments = path.split('/');
  if (pathSegments.length !== route.segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < route.segments.length; i++) {
    const routeSeg = route.segments[i];
    const pathSeg = pathSegments[i];
    if (routeSeg.startsWith(':')) {
      params[routeSeg.slice(1)] = decodeURIComponent(pathSeg);
    } else if (routeSeg !== pathSeg) {
      return null;
    }
  }
  return params;
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
  let matchedRoute: Route | null = null;
  let matchedParams: Record<string, string> = {};
  for (const r of routes) {
    if (r.path === '*') continue;
    const params = matchRoute(r, path);
    if (params) {
      matchedRoute = r;
      matchedParams = params;
      break;
    }
  }
  const route = matchedRoute ?? routes.find((r) => r.path === '*');
  if (!route) return;

  container.innerHTML = '';
  const result = route.render(container, matchedParams);
  if (typeof result === 'function') cleanup = result;

  window.dispatchEvent(new CustomEvent('app:routechange'));
}
