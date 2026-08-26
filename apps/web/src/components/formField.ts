interface FormFieldOptions {
  id: string;
  label: string;
  type: string;
  autocomplete?: string;
}

export interface FormField {
  wrapper: HTMLDivElement;
  input: HTMLInputElement;
  setError(message: string | null): void;
}

export function createFormField(options: FormFieldOptions): FormField {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.htmlFor = options.id;
  label.textContent = options.label;
  wrapper.appendChild(label);

  const input = document.createElement('input');
  input.id = options.id;
  input.name = options.id;
  input.type = options.type;
  if (options.autocomplete) input.setAttribute('autocomplete', options.autocomplete);
  input.setAttribute('data-testid', `${options.id}-input`);
  wrapper.appendChild(input);

  const error = document.createElement('p');
  error.className = 'form-field__error';
  error.setAttribute('data-testid', `${options.id}-error`);
  error.hidden = true;
  wrapper.appendChild(error);

  return {
    wrapper,
    input,
    setError(message: string | null) {
      if (message) {
        error.textContent = message;
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
      } else {
        error.textContent = '';
        error.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    },
  };
}
