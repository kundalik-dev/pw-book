import { mountNavbar } from './components/navbar';
import { defineStarRatingElement } from './components/starRatingElement';
import { mountToastHost } from './components/toast';
import { renderAdminPage } from './pages/admin';
import { renderAdminAddBookPage } from './pages/adminAddBook';
import { renderAdminOrderHistoryBookPage } from './pages/adminOrderHistoryBook';
import { renderAdminOrderHistoryUserPage } from './pages/adminOrderHistoryUser';
import { renderAdminOrdersPage } from './pages/adminOrders';
import { renderBookDetailPage } from './pages/bookDetail';
import { renderBooksPage } from './pages/books';
import { renderBorrowPage } from './pages/borrow';
import { renderDeleteAccountPage } from './pages/deleteAccount';
import { renderLoginPage } from './pages/login';
import { renderOrdersPage } from './pages/orders';
import { renderRegisterPage } from './pages/register';
import { renderSettingsPage } from './pages/settings';
import { renderWishlistPage } from './pages/wishlist';
import { initRouter, registerRoute } from './router/router';
import { initTheme } from './state/theme';

initTheme();
defineStarRatingElement();

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
registerRoute('/books/:id', renderBookDetailPage);
registerRoute('/borrow/:bookId', renderBorrowPage);
registerRoute('/wishlist', renderWishlistPage);
registerRoute('/orders', renderOrdersPage);
registerRoute('/admin', renderAdminPage);
registerRoute('/admin/add-book', renderAdminAddBookPage);
registerRoute('/admin/orders', renderAdminOrdersPage);
registerRoute('/admin/orders/user/:id/history', renderAdminOrderHistoryUserPage);
registerRoute('/admin/orders/book/:id/history', renderAdminOrderHistoryBookPage);
registerRoute('/settings', renderSettingsPage);
registerRoute('/account/delete', renderDeleteAccountPage);
registerRoute('/login', renderLoginPage);
registerRoute('/register', renderRegisterPage);
registerRoute('*', renderBooksPage);

initRouter(pageContainer);
