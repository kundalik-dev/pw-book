const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: inline-flex;
      gap: 2px;
    }
    .star {
      font-size: 1.1rem;
      color: var(--star-empty-color, #d0d0d6);
    }
    .star--filled {
      color: var(--star-filled-color, #f2a900);
    }
  </style>
  <div id="stars" part="stars"></div>
`;

/**
 * Read-only star-rating rendered inside a Shadow DOM, so Playwright locators
 * must pierce the shadow root (`page.locator('star-rating').locator('.star')`
 * won't match — needs `>>>` / shadow-piercing helpers or `shadowRoot` access).
 *
 * Usage: `<star-rating value="4" max="5"></star-rating>`
 */
export class StarRatingElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['value', 'max'];
  }

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(TEMPLATE.content.cloneNode(true));
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;
    const holder = shadow.getElementById('stars');
    if (!holder) return;

    const max = Number(this.getAttribute('max') ?? 5);
    const value = Number(this.getAttribute('value') ?? 0);

    holder.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const span = document.createElement('span');
      span.className = i < value ? 'star star--filled' : 'star';
      span.textContent = '★';
      span.setAttribute('data-testid', `shadow-star-${i + 1}`);
      holder.appendChild(span);
    }
  }
}

export function defineStarRatingElement(): void {
  if (!customElements.get('star-rating')) {
    customElements.define('star-rating', StarRatingElement);
  }
}
