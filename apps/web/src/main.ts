import { mountNavbar } from './components/navbar';
import { mountToastHost } from './components/toast';
import { renderBooksPage } from './pages/books';
import { renderLoginPage } from './pages/login';
import { renderRegisterPage } from './pages/register';
import { initRouter, registerRoute } from './router/router';

const app = document.getElementById('app');
if (!app) throw new Error('Missing #app root element.');

if (window.location.pathname === '/') {
  window.history.replaceState({}, '', '/books');
}

mountNavbar(app);

const pageContainer = document.createElement('main');
pageContainer.className = 'page-container';
pageContainer.id = 'page-container';
app.appendChild(pageContainer);

mountToastHost(app);

registerRoute('/books', renderBooksPage);
registerRoute('/login', renderLoginPage);
registerRoute('/register', renderRegisterPage);
registerRoute('*', renderBooksPage);

initRouter(pageContainer);
