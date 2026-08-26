import { apiClient } from '../api/client';
import type { Author, Book, BookInput, Category } from '../api/types';

export interface BookFormHandle {
  element: HTMLFormElement;
  focusFirst(): void;
  /** Validates, saves via the API, and reports errors inline. Returns the saved book, or null on failure. */
  save(): Promise<Book | null>;
}

function field(id: string, labelText: string, control: HTMLElement): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'book-form__field';

  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  wrapper.appendChild(label);
  wrapper.appendChild(control);

  return wrapper;
}

/** Builds the shared add/edit book form used by both the `/admin/add-book` page and the edit-book modal. */
export function createBookForm(
  book: Book | null,
  authors: Author[],
  categories: Category[],
): BookFormHandle {
  const isEdit = book !== null;

  const form = document.createElement('form');
  form.className = 'book-form';
  form.setAttribute('data-testid', 'book-form');
  form.noValidate = true;

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'book-form-title';
  titleInput.name = 'title';
  titleInput.required = true;
  titleInput.autocomplete = 'off';
  titleInput.value = book?.title ?? '';
  titleInput.setAttribute('data-testid', 'book-form-title');
  form.appendChild(field('book-form-title', 'Title', titleInput));

  const isbnInput = document.createElement('input');
  isbnInput.type = 'text';
  isbnInput.id = 'book-form-isbn';
  isbnInput.name = 'isbn';
  isbnInput.required = true;
  isbnInput.autocomplete = 'off';
  isbnInput.value = book?.isbn ?? '';
  isbnInput.setAttribute('data-testid', 'book-form-isbn');
  form.appendChild(field('book-form-isbn', 'ISBN', isbnInput));

  const authorSelect = document.createElement('select');
  authorSelect.id = 'book-form-author';
  authorSelect.name = 'authorId';
  authorSelect.required = true;
  authorSelect.setAttribute('data-testid', 'book-form-author');
  for (const author of authors) {
    const opt = document.createElement('option');
    opt.value = String(author.id);
    opt.textContent = author.name;
    if (book?.authorId === author.id) opt.selected = true;
    authorSelect.appendChild(opt);
  }
  form.appendChild(field('book-form-author', 'Author', authorSelect));

  const categoriesFieldset = document.createElement('fieldset');
  categoriesFieldset.className = 'book-form__categories';
  const categoriesLegend = document.createElement('legend');
  categoriesLegend.textContent = 'Categories';
  categoriesFieldset.appendChild(categoriesLegend);
  const categoryCheckboxes: HTMLInputElement[] = [];
  for (const category of categories) {
    const optLabel = document.createElement('label');
    const checkboxId = `book-form-category-${category.id}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.name = 'categoryIds';
    checkbox.value = String(category.id);
    checkbox.checked = book?.categoryIds.includes(category.id) ?? false;
    checkbox.setAttribute('data-testid', checkboxId);
    categoryCheckboxes.push(checkbox);
    optLabel.htmlFor = checkboxId;
    optLabel.appendChild(checkbox);
    optLabel.append(` ${category.name}`);
    categoriesFieldset.appendChild(optLabel);
  }
  form.appendChild(categoriesFieldset);

  const descInput = document.createElement('textarea');
  descInput.id = 'book-form-description';
  descInput.name = 'description';
  descInput.value = book?.description ?? '';
  descInput.setAttribute('data-testid', 'book-form-description');
  form.appendChild(field('book-form-description', 'Description', descInput));

  const fieldRow = document.createElement('div');
  fieldRow.className = 'book-form__row';

  const yearInput = document.createElement('input');
  yearInput.type = 'number';
  yearInput.id = 'book-form-published-year';
  yearInput.name = 'publishedYear';
  yearInput.value = book?.publishedYear ? String(book.publishedYear) : '';
  yearInput.setAttribute('data-testid', 'book-form-published-year');
  fieldRow.appendChild(field('book-form-published-year', 'Published year', yearInput));

  const copiesInput = document.createElement('input');
  copiesInput.type = 'number';
  copiesInput.id = 'book-form-total-copies';
  copiesInput.name = 'totalCopies';
  copiesInput.min = '0';
  copiesInput.required = true;
  copiesInput.value = String(book?.totalCopies ?? 1);
  copiesInput.setAttribute('data-testid', 'book-form-total-copies');
  fieldRow.appendChild(field('book-form-total-copies', 'Total copies', copiesInput));

  form.appendChild(fieldRow);

  const errorText = document.createElement('p');
  errorText.className = 'book-form__error';
  errorText.hidden = true;
  errorText.setAttribute('role', 'alert');
  errorText.setAttribute('data-testid', 'book-form-error');
  form.appendChild(errorText);

  async function save(): Promise<Book | null> {
    errorText.hidden = true;
    if (!titleInput.value.trim() || !isbnInput.value.trim() || !authorSelect.value) {
      errorText.textContent = 'Title, ISBN, and author are required.';
      errorText.hidden = false;
      return null;
    }
    const input: BookInput = {
      title: titleInput.value.trim(),
      isbn: isbnInput.value.trim(),
      authorId: Number(authorSelect.value),
      categoryIds: categoryCheckboxes.filter((c) => c.checked).map((c) => Number(c.value)),
      description: descInput.value.trim() || undefined,
      publishedYear: yearInput.value ? Number(yearInput.value) : undefined,
      totalCopies: Number(copiesInput.value),
    };
    try {
      return isEdit && book
        ? await apiClient.updateBook(book.id, input)
        : await apiClient.createBook(input);
    } catch (err) {
      errorText.textContent = err instanceof Error ? err.message : 'Could not save book.';
      errorText.hidden = false;
      return null;
    }
  }

  return {
    element: form,
    focusFirst: () => titleInput.focus(),
    save,
  };
}
