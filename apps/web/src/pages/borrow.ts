import { apiClient } from '../api/client';
import type { Book } from '../api/types';
import { ApiError } from '../api/types';
import { showToast } from '../components/toast';
import { navigate } from '../router/router';
import { getAuthState } from '../state/auth';
import '../styles/phase9.css';

const LOAN_PERIOD_DAYS = 14; // Mirrors apps/api's LOAN_PERIOD_DAYS in repositories/loans.ts

type StepId = 'select' | 'confirm' | 'due-date' | 'success';
const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'select', label: 'Select book' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'due-date', label: 'Due date' },
  { id: 'success', label: 'Done' },
];

export function renderBorrowPage(container: HTMLElement, params: Record<string, string>): void {
  if (!getAuthState()) {
    showToast('Log in to borrow a book.', 'error');
    navigate('/login');
    return;
  }

  const bookId = Number(params.bookId);
  let stepIndex = 0;
  let agreed = false;
  let loanResult: { id: number; dueAt: string } | null = null;

  const page = document.createElement('div');
  page.className = 'borrow-wizard';
  page.setAttribute('data-testid', 'borrow-wizard');
  container.appendChild(page);

  const stepper = document.createElement('ol');
  stepper.className = 'wizard-steps';
  stepper.setAttribute('data-testid', 'wizard-steps');
  page.appendChild(stepper);

  const stepBody = document.createElement('div');
  stepBody.className = 'wizard-step-body';
  page.appendChild(stepBody);

  const loading = document.createElement('p');
  loading.textContent = 'Loading book…';
  page.appendChild(loading);

  let book: Book | null = null;

  function renderStepper(): void {
    stepper.innerHTML = '';
    STEPS.forEach((step, i) => {
      const li = document.createElement('li');
      li.className = 'wizard-steps__item';
      li.textContent = step.label;
      li.setAttribute('data-testid', `wizard-step-${step.id}`);
      if (i === stepIndex) li.classList.add('wizard-steps__item--active');
      if (i < stepIndex) li.classList.add('wizard-steps__item--done');
      stepper.appendChild(li);
    });
  }

  function goToStep(index: number): void {
    stepIndex = index;
    renderStepper();
    renderStepBody();
  }

  function renderStepBody(): void {
    stepBody.innerHTML = '';
    if (!book) return;
    const step = STEPS[stepIndex].id;
    if (step === 'select') renderSelectStep();
    else if (step === 'confirm') renderConfirmStep();
    else if (step === 'due-date') renderDueDateStep();
    else renderSuccessStep();
  }

  function renderSelectStep(): void {
    if (!book) return;
    const heading = document.createElement('h2');
    heading.textContent = book.title;
    stepBody.appendChild(heading);

    const meta = document.createElement('p');
    meta.textContent =
      book.availableCopies > 0
        ? `${book.availableCopies} of ${book.totalCopies} copies available.`
        : 'No copies currently available.';
    stepBody.appendChild(meta);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn--primary';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = book.availableCopies <= 0;
    nextBtn.setAttribute('data-testid', 'wizard-next');
    nextBtn.addEventListener('click', () => goToStep(1));
    stepBody.appendChild(nextBtn);
  }

  function renderConfirmStep(): void {
    const label = document.createElement('label');
    label.className = 'wizard-agree';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = agreed;
    checkbox.setAttribute('data-testid', 'wizard-agree-checkbox');
    checkbox.addEventListener('change', () => {
      agreed = checkbox.checked;
      nextBtn.disabled = !agreed;
    });
    label.appendChild(checkbox);
    label.append(` I agree to return this book within ${LOAN_PERIOD_DAYS} days.`);
    stepBody.appendChild(label);

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    stepBody.appendChild(nav);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn--secondary';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => goToStep(0));
    nav.appendChild(backBtn);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn--primary';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = !agreed;
    nextBtn.setAttribute('data-testid', 'wizard-next');
    nextBtn.addEventListener('click', () => goToStep(2));
    nav.appendChild(nextBtn);
  }

  function renderDueDateStep(): void {
    const estimatedDue = new Date(Date.now() + LOAN_PERIOD_DAYS * 86_400_000);

    const summary = document.createElement('p');
    summary.setAttribute('data-testid', 'wizard-estimated-due-date');
    summary.textContent = `Estimated due date: ${estimatedDue.toLocaleDateString()}`;
    stepBody.appendChild(summary);

    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    stepBody.appendChild(nav);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn--secondary';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => goToStep(1));
    nav.appendChild(backBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn--primary';
    confirmBtn.textContent = 'Confirm borrow';
    confirmBtn.setAttribute('data-testid', 'wizard-confirm-borrow');
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      try {
        const loan = await apiClient.createLoan(bookId);
        loanResult = { id: loan.id, dueAt: loan.dueAt };
        goToStep(3);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Could not borrow this book.';
        showToast(message, 'error');
        confirmBtn.disabled = false;
      }
    });
    nav.appendChild(confirmBtn);
  }

  function renderSuccessStep(): void {
    if (!loanResult) return;
    const heading = document.createElement('h2');
    heading.textContent = 'Borrowed!';
    stepBody.appendChild(heading);

    const summary = document.createElement('p');
    summary.setAttribute('data-testid', 'wizard-success-message');
    summary.textContent = `Loan #${loanResult.id} is due back on ${new Date(loanResult.dueAt).toLocaleDateString()}.`;
    stepBody.appendChild(summary);

    const backToBooks = document.createElement('a');
    backToBooks.href = '/books';
    backToBooks.dataset.link = '';
    backToBooks.className = 'btn btn--primary';
    backToBooks.textContent = 'Back to books';
    stepBody.appendChild(backToBooks);
  }

  async function init(): Promise<void> {
    try {
      book = await apiClient.getBook(bookId);
      loading.remove();
      renderStepper();
      renderStepBody();
    } catch {
      loading.textContent = 'Could not load this book.';
    }
  }

  init();
}
