export interface TabDef {
  id: string;
  label: string;
  render: (panel: HTMLElement) => void;
}

export interface TabsOptions {
  tabs: TabDef[];
  testId?: string;
}

export interface Tabs {
  element: HTMLDivElement;
}

/** ARIA tabs pattern: a tablist of buttons plus one visible tabpanel at a time. */
export function createTabs(options: TabsOptions): Tabs {
  const testId = options.testId ?? 'tabs';
  const root = document.createElement('div');
  root.className = 'tabs';
  root.setAttribute('data-testid', testId);

  const tablist = document.createElement('div');
  tablist.className = 'tabs__list';
  tablist.setAttribute('role', 'tablist');
  root.appendChild(tablist);

  const panelHost = document.createElement('div');
  panelHost.className = 'tabs__panel';
  root.appendChild(panelHost);

  const buttons: HTMLButtonElement[] = [];
  const rendered = new Set<string>();

  function activate(tab: TabDef, index: number): void {
    for (const btn of buttons) {
      const isActive = btn.dataset.tabId === tab.id;
      btn.classList.toggle('tabs__tab--active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.tabIndex = isActive ? 0 : -1;
    }
    panelHost.innerHTML = '';
    panelHost.setAttribute('data-testid', `${testId}-panel-${tab.id}`);
    tab.render(panelHost);
    rendered.add(tab.id);
    buttons[index]?.focus();
  }

  options.tabs.forEach((tab, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tabs__tab';
    btn.textContent = tab.label;
    btn.dataset.tabId = tab.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('data-testid', `${testId}-tab-${tab.id}`);
    btn.addEventListener('click', () => activate(tab, index));
    buttons.push(btn);
    tablist.appendChild(btn);
  });

  if (options.tabs[0]) activate(options.tabs[0], 0);

  return { element: root };
}
