import { apiClient } from '../api/client';
import { ApiError } from '../api/types';
import { createFormField } from '../components/formField';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { setAuthState } from '../state/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function renderLoginPage(container: HTMLElement): void {
  const page = document.createElement('div');
  page.className = 'auth-page';

  const heading = document.createElement('h1');
  heading.textContent = 'Log in';
  page.appendChild(heading);

  const form = document.createElement('form');
  form.className = 'auth-form';
  form.setAttribute('data-testid', 'login-form');
  page.appendChild(form);

  const email = createFormField({
    id: 'email',
    label: 'Email',
    type: 'email',
    autocomplete: 'email',
  });
  const password = createFormField({
    id: 'password',
    label: 'Password',
    type: 'password',
    autocomplete: 'current-password',
  });
  form.appendChild(email.wrapper);
  form.appendChild(password.wrapper);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Log in';
  submit.className = 'btn btn--primary';
  form.appendChild(submit);

  const switchLink = document.createElement('p');
  switchLink.className = 'auth-form__switch';
  switchLink.innerHTML = `Don't have an account? <a href="/register" data-link>Register</a>`;
  page.appendChild(switchLink);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    email.setError(null);
    password.setError(null);

    let hasError = false;
    if (!EMAIL_RE.test(email.input.value.trim())) {
      email.setError('Enter a valid email address.');
      hasError = true;
    }
    if (password.input.value.length === 0) {
      password.setError('Password is required.');
      hasError = true;
    }
    if (hasError) return;

    submit.disabled = true;
    try {
      const result = await apiClient.login({
        email: email.input.value.trim(),
        password: password.input.value,
      });
      setAuthState(result);
      showToast(`Welcome back, ${result.user.name}.`, 'success');
      navigate('/books');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
      showToast(message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  container.appendChild(page);
}
