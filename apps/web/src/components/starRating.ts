export interface StarRatingOptions {
  max?: number;
  value?: number;
  readonly?: boolean;
  onChange?: (value: number) => void;
  testId?: string;
}

export interface StarRating {
  element: HTMLDivElement;
  getValue(): number;
  setValue(value: number): void;
}

/** Plain (non-native) star-rating control: a row of buttons, not a Shadow DOM element. */
export function createStarRating(options: StarRatingOptions = {}): StarRating {
  const max = options.max ?? 5;
  let value = options.value ?? 0;
  const readonly = options.readonly ?? false;

  const container = document.createElement('div');
  container.className = 'star-rating';
  container.setAttribute('role', readonly ? 'img' : 'radiogroup');
  container.setAttribute('aria-label', `Rating: ${value} out of ${max} stars`);
  if (options.testId) container.setAttribute('data-testid', options.testId);

  const stars: HTMLButtonElement[] = [];

  function paint(): void {
    for (let i = 0; i < stars.length; i++) {
      const filled = i < value;
      stars[i].classList.toggle('star-rating__star--filled', filled);
      stars[i].setAttribute('aria-checked', String(filled && i === value - 1));
    }
    container.setAttribute('aria-label', `Rating: ${value} out of ${max} stars`);
  }

  for (let i = 0; i < max; i++) {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'star-rating__star';
    star.textContent = '★';
    star.setAttribute('data-testid', `star-${i + 1}`);
    star.setAttribute('role', readonly ? 'presentation' : 'radio');
    star.disabled = readonly;
    if (!readonly) {
      star.addEventListener('click', () => {
        value = i + 1;
        paint();
        options.onChange?.(value);
      });
    }
    stars.push(star);
    container.appendChild(star);
  }

  paint();

  return {
    element: container,
    getValue: () => value,
    setValue(next: number) {
      value = Math.max(0, Math.min(max, next));
      paint();
    },
  };
}
