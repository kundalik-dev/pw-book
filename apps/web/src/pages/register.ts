import { apiClient } from '../api/client';
import { ApiError } from '../api/types';
import { createFormField } from '../components/formField';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { setAuthState } from '../state/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function renderRegisterPage(container: HTMLElement): void {
  const page = document.createElement('div');
  page.className = 'auth-page';

  const heading = document.createElement('h1');
  heading.textContent = 'Create an account';
  page.appendChild(heading);

  const form = document.createElement('form');
  form.className = 'auth-form';
  form.setAttribute('data-testid', 'register-form');
  page.appendChild(form);

  const name = createFormField({ id: 'name', label: 'Name', type: 'text', autocomplete: 'name' });
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
    autocomplete: 'new-password',
  });
  const confirmPassword = createFormField({
    id: 'confirm-password',
    label: 'Confirm password',
    type: 'password',
    autocomplete: 'new-password',
  });
  form.appendChild(name.wrapper);
  form.appendChild(email.wrapper);
  form.appendChild(password.wrapper);
  form.appendChild(confirmPassword.wrapper);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Register';
  submit.className = 'btn btn--primary';
  form.appendChild(submit);

  const switchLink = document.createElement('p');
  switchLink.className = 'auth-form__switch';
  switchLink.innerHTML = `Already have an account? <a href="/login" data-link>Log in</a>`;
  page.appendChild(switchLink);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    name.setError(null);
    email.setError(null);
    password.setError(null);
    confirmPassword.setError(null);

    let hasError = false;
    if (name.input.value.trim().length === 0) {
      name.setError('Name is required.');
      hasError = true;
    }
    if (!EMAIL_RE.test(email.input.value.trim())) {
      email.setError('Enter a valid email address.');
      hasError = true;
    }
    if (password.input.value.length < MIN_PASSWORD_LENGTH) {
      password.setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      hasError = true;
    }
    if (confirmPassword.input.value !== password.input.value) {
      confirmPassword.setError('Passwords do not match.');
      hasError = true;
    }
    if (hasError) return;

    submit.disabled = true;
    try {
      const result = await apiClient.register({
        name: name.input.value.trim(),
        email: email.input.value.trim(),
        password: password.input.value,
      });
      setAuthState(result);
      showToast(`Welcome, ${result.user.name}.`, 'success');
      navigate('/books');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        email.setError(message);
      } else {
        showToast(message, 'error');
      }
    } finally {
      submit.disabled = false;
    }
  });

  container.appendChild(page);
}
