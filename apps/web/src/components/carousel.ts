export interface CarouselOptions {
  slides: HTMLElement[];
  testId?: string;
}

export interface Carousel {
  element: HTMLDivElement;
}

/** A minimal image/slide carousel: prev/next buttons plus clickable dot indicators. */
export function createCarousel(options: CarouselOptions): Carousel {
  const { slides } = options;
  const testId = options.testId ?? 'carousel';
  let current = 0;

  const root = document.createElement('div');
  root.className = 'carousel';
  root.setAttribute('data-testid', testId);

  const track = document.createElement('div');
  track.className = 'carousel__track';
  root.appendChild(track);

  for (const slide of slides) {
    slide.classList.add('carousel__slide');
    slide.setAttribute('data-testid', `${testId}-slide`);
    track.appendChild(slide);
  }

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'carousel__nav carousel__nav--prev';
  prevBtn.setAttribute('aria-label', 'Previous image');
  prevBtn.setAttribute('data-testid', `${testId}-prev`);
  prevBtn.textContent = '‹';
  root.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'carousel__nav carousel__nav--next';
  nextBtn.setAttribute('aria-label', 'Next image');
  nextBtn.setAttribute('data-testid', `${testId}-next`);
  nextBtn.textContent = '›';
  root.appendChild(nextBtn);

  const dots = document.createElement('div');
  dots.className = 'carousel__dots';
  root.appendChild(dots);

  const dotButtons: HTMLButtonElement[] = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel__dot';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.setAttribute('data-testid', `${testId}-dot-${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dots.appendChild(dot);
    return dot;
  });

  function goTo(index: number): void {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    for (let i = 0; i < dotButtons.length; i++) {
      dotButtons[i].classList.toggle('carousel__dot--active', i === current);
    }
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  goTo(0);

  return { element: root };
}
