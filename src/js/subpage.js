import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '../styles/main.css';
import { initHeader, initHeaderRetract } from './ui.js';

/**
 * Subpage boot: shared header + a static dark backdrop.
 * The heavy top-page scene stays off subpages — a CSS gradient stands in.
 */

document.body.classList.add('js-enabled');
document.body.classList.add('no-3d');
initHeader();
// phones and tablets: the header (with its "Book Free Audit" row) tucks away
// on the way down and returns on any scroll back up, as on the other pages
initHeaderRetract({ belowTop: true, media: window.matchMedia('(max-width: 768px)') });

// Category filter rows (works page): client-side filter over list items.
const filterRow = document.querySelector('[data-filter-row]');
if (filterRow) {
  const buttons = filterRow.querySelectorAll('button');
  const items = document.querySelectorAll('[data-cats]');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      buttons.forEach((b) => {
        b.setAttribute('data-active', String(b === btn));
        b.setAttribute('aria-pressed', String(b === btn));
      });
      items.forEach((item) => {
        const cats = (item.dataset.cats || '').split(',');
        item.style.display = cat === 'all' || cats.includes(cat) ? '' : 'none';
      });
    });
  });
}
