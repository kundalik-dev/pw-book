import { navigate } from '../router/router';
import { clearAuthState, getAuthState, onAuthChange } from '../state/auth';
import { getTheme, toggleTheme } from '../state/theme';
import '../styles/phase9.css';
import { showToast } from './toast';

export function mountNavbar(target: HTMLElement): void {
  const nav = document.createElement('nav');
  nav.className = 'navbar';
  target.appendChild(nav);

  const render = () => {
    nav.innerHTML = '';

    const brand = document.createElement('a');
    brand.href = '/books';
    brand.dataset.link = '';
    brand.className = 'navbar__brand';
    brand.textContent = 'pw-books';
    nav.appendChild(brand);

    const links = document.createElement('div');
    links.className = 'navbar__links';
    nav.appendChild(links);

    links.appendChild(createNavLink('/books', 'Books'));

    const auth = getAuthState();
    if (auth) {
      links.appendChild(createNavLink('/wishlist', 'Wishlist'));
      if (auth.user.role === 'admin') {
        links.appendChild(createNavLink('/admin', 'Admin'));
        links.appendChild(createNavLink('/admin/orders', 'All orders'));
        links.appendChild(createNavLink('/settings', 'Settings'));
      } else {
        links.appendChild(createNavLink('/orders', 'Orders'));
      }
      links.appendChild(createApiDocsLink());
    }

    const themeToggle = document.createElement('button');
    themeToggle.type = 'button';
    themeToggle.className = 'theme-toggle';
    themeToggle.setAttribute('data-testid', 'theme-toggle');
    themeToggle.setAttribute('aria-label', 'Toggle light/dark theme');
    themeToggle.textContent = getTheme() === 'dark' ? '☀️' : '🌙';
    themeToggle.addEventListener('click', () => {
      const next = toggleTheme();
      themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
    });
    links.appendChild(themeToggle);

    if (auth) {
      const account = document.createElement('div');
      account.className = 'navbar__account';
      account.setAttribute('data-testid', 'account-menu');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'navbar__account-toggle';
      toggle.textContent = auth.user.name;
      toggle.setAttribute('aria-expanded', 'false');
      account.appendChild(toggle);

      const dropdown = document.createElement('div');
      dropdown.className = 'navbar__dropdown';
      dropdown.hidden = true;

      const emailItem = document.createElement('div');
      emailItem.className = 'navbar__dropdown-email';
      emailItem.textContent = auth.user.email;
      dropdown.appendChild(emailItem);

      const logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'navbar__dropdown-item';
      logoutBtn.textContent = 'Log out';
      logoutBtn.setAttribute('data-testid', 'logout-button');
      logoutBtn.addEventListener('click', () => {
        clearAuthState();
        showToast('Logged out.', 'success');
        navigate('/login');
      });
      dropdown.appendChild(logoutBtn);

      const deleteAccountLink = document.createElement('a');
      deleteAccountLink.href = '/account/delete';
      deleteAccountLink.dataset.link = '';
      deleteAccountLink.className = 'navbar__dropdown-item';
      deleteAccountLink.textContent = 'Delete account';
      deleteAccountLink.setAttribute('data-testid', 'delete-account-link');
      dropdown.appendChild(deleteAccountLink);

      account.appendChild(dropdown);

      toggle.addEventListener('click', () => {
        const isOpen = !dropdown.hidden;
        dropdown.hidden = isOpen;
        toggle.setAttribute('aria-expanded', String(!isOpen));
      });

      links.appendChild(account);
    } else {
      links.appendChild(createNavLink('/login', 'Log in'));
      links.appendChild(createNavLink('/register', 'Register'));
    }
  };

  document.addEventListener('click', (event) => {
    const account = nav.querySelector('.navbar__account');
    const dropdown = nav.querySelector<HTMLElement>('.navbar__dropdown');
    const toggle = nav.querySelector<HTMLButtonElement>('.navbar__account-toggle');
    if (!account || !dropdown || !toggle || dropdown.hidden) return;
    if (!account.contains(event.target as Node)) {
      dropdown.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  onAuthChange(render);
  window.addEventListener('app:routechange', render);
  render();
}

function createApiDocsLink(): HTMLAnchorElement {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  const link = document.createElement('a');
  link.href = `${apiBaseUrl}/docs`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'navbar__link';
  link.textContent = 'API Docs';
  link.setAttribute('data-testid', 'api-docs-link');
  return link;
}

function createNavLink(path: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = path;
  link.dataset.link = '';
  link.className = 'navbar__link';
  link.textContent = label;
  if (window.location.pathname === path) {
    link.classList.add('navbar__link--active');
    link.setAttribute('aria-current', 'page');
  }
  return link;
}
