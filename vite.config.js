import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { transform } from 'esbuild';

// import.meta.dirname rather than __dirname: this package is "type": "module",
// so __dirname only resolved because Vite pre-bundled the config through
// esbuild's CJS shim on every load — which writes a temp file into the project
// root that the config watcher then sees as a change. Loading natively removes
// that round trip. (Node 20.11+; this project runs 24.)
const root = import.meta.dirname;

// Microsoft Clarity (heatmaps and session recordings), approved by the owner on
// 14 October 2026 and disclosed on /privacy. The tag is added once, at build
// time, to every .html file in the output: the three Vite entries and every page
// copied from public/. Adding it here rather than by hand means a new page in
// public/ gets it automatically. Do not paste the tag into a page as well; a page
// that already carries it is skipped, so it never appears twice. Build only, so
// `npm run dev` sends nothing to Clarity.
const CLARITY_TAG = '<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "yxiba6izmq");</script>';

function clarity() {
  let outDir;
  let logger;
  const htmlFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.name.endsWith('.html') ? [path] : [];
    });
  return {
    name: 'px-clarity',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      logger = config.logger;
    },
    // closeBundle runs after Vite has written the entries and copied public/.
    closeBundle() {
      if (!existsSync(outDir)) return;
      for (const file of htmlFiles(outDir)) {
        const html = readFileSync(file, 'utf8');
        if (html.includes('www.clarity.ms/tag/')) continue;
        if (!html.includes('</head>')) {
          logger.warn(`[px-clarity] no </head> in ${file}, Clarity tag not added`);
          continue;
        }
        writeFileSync(file, html.replace('</head>', () => `${CLARITY_TAG}\n</head>`));
      }
    }
  };
}

// Google Analytics 4 (property "Position Xero" in the agency's "Position Xero
// clients" Analytics account), switched on 15 October 2026 and disclosed on
// /privacy, section 6. Like Clarity, Google's standard gtag.js snippet is added
// once, at build time, to every .html file in the output (the three Vite
// entries and every page copied from public/), straight after the viewport meta
// (or after <head> on a page without one). A page that already carries the ID is
// skipped. Do not paste the tag into a page by hand. Build only, so
// `npm run dev` sends nothing to Google.
const GA_ID = 'G-SJ2ZVCFNTR';
const GA_TAG =
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>\n` +
  `<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GA_ID}');</script>`;

function googleAnalytics() {
  let outDir;
  let logger;
  const htmlFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.name.endsWith('.html') ? [path] : [];
    });
  const viewport = /<meta\b[^>]*\bname=["']?viewport["']?[^>]*>/i;
  const head = /<head\b[^>]*>/i;
  return {
    name: 'px-google-analytics',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      logger = config.logger;
    },
    closeBundle() {
      if (!existsSync(outDir)) return;
      for (const file of htmlFiles(outDir)) {
        const html = readFileSync(file, 'utf8');
        if (html.includes(`gtag/js?id=${GA_ID}`)) continue;
        const at = viewport.test(html) ? viewport : head.test(html) ? head : null;
        if (!at) {
          logger.warn(`[px-google-analytics] no <head> in ${file}, GA tag not added`);
          continue;
        }
        writeFileSync(file, html.replace(at, (tag) => `${tag}\n${GA_TAG}`));
      }
    }
  };
}

// Footer year. Every page's footer prints its copyright year inside
// <span data-year>, the three Vite entries and every page in public/ alike.
// At build time this writes the build year into that span, so the raw HTML
// (what crawlers and no-JS visitors read) is current after every deploy, and
// adds one tiny inline script that sets the visitor's own current year when
// the page loads, so the footer turns over at New Year even if nothing is
// deployed. A page copied from an older template that still prints a bare
// "© 2026 Position Xero" gets the span added here, so it is covered too.
// Added 14 October 2026.
const YEAR_SCRIPT = '<script>document.querySelectorAll("[data-year]").forEach(function(e){e.textContent=new Date().getFullYear()})</script>';

function footerYear() {
  let outDir;
  const year = String(new Date().getFullYear());
  const span = /(<span data-year>)\s*\d{4}\s*(<\/span>)/g;
  const bare = /(©|&copy;) (\d{4}) (Position Xero|POSITION XERO)/g;
  const htmlFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.name.endsWith('.html') ? [path] : [];
    });
  return {
    name: 'px-footer-year',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!existsSync(outDir)) return;
      for (const file of htmlFiles(outDir)) {
        const html = readFileSync(file, 'utf8');
        let out = html.replace(bare, (m, mark, y, name) => `${mark} <span data-year>${y}</span> ${name}`);
        if (!out.includes('<span data-year>')) continue;
        out = out.replace(span, (m, open, close) => `${open}${year}${close}`);
        if (!out.includes(YEAR_SCRIPT) && out.includes('</body>')) {
          out = out.replace(/<\/body>(?![\s\S]*<\/body>)/, () => `${YEAR_SCRIPT}\n</body>`);
        }
        if (out !== html) writeFileSync(file, out);
      }
    }
  };
}

// Table cell labels. On a phone (640px and under) every comparison table is
// shown as one card per row (public/css/style.css, "Comparison tables on
// phones"), and each cell after the first is printed under its column
// heading. This copies each <thead> heading's text into a data-label on that
// column's body cells, in every built .html page, public/ included, so the
// card can show it with CSS alone and a new table needs nothing by hand. The
// first cell of a row is the card's title and gets no label; a cell that
// already has one keeps it. Added 15 October 2026 (mobile review).
function tableLabels() {
  let outDir;
  const text = (html) =>
    html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().replace(/"/g, '&quot;');
  const label = (table) => {
    const head = table.match(/<thead\b[\s\S]*?<\/thead>/i);
    if (!head) return table;
    const labels = [...head[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => text(m[1]));
    if (labels.length < 2) return table;
    return table.replace(/<tbody\b[\s\S]*?<\/tbody>/gi, (body) =>
      body.replace(/<tr\b[\s\S]*?<\/tr>/gi, (row) => {
        let i = -1;
        return row.replace(/<(td|th)\b([^>]*)>/gi, (tag, name, attrs) => {
          i += 1;
          if (i === 0 || !labels[i] || /\bdata-label=/i.test(attrs)) return tag;
          return `<${name}${attrs} data-label="${labels[i]}">`;
        });
      })
    );
  };
  const htmlFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.name.endsWith('.html') ? [path] : [];
    });
  return {
    name: 'px-table-labels',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!existsSync(outDir)) return;
      for (const file of htmlFiles(outDir)) {
        const html = readFileSync(file, 'utf8');
        if (!html.includes('<table')) continue;
        const out = html.replace(/<table\b[\s\S]*?<\/table>/gi, label);
        if (out !== html) writeFileSync(file, out);
      }
    }
  };
}

// Minify the stylesheet and scripts copied from public/. Vite copies public/
// verbatim, so /css/style.css, /js/main.js and /js/immersive.js went out with
// every comment and indent (Lighthouse "Minify CSS" and "Minify JavaScript" on
// /blog/, 11 October 2026). This minifies the copies in dist/ with esbuild,
// which comes with Vite, and leaves the sources in public/ readable: always
// edit those, never the built files. dist/assets/ is Vite's own output, already
// minified, and is skipped. esbuild is given the build's own browser targets,
// so the output uses no syntax those browsers cannot read. The ?v= bump on
// every page is still needed whenever style.css or main.js changes (CLAUDE.md).
// Added 16 October 2026 (T-52).
function minifyPublic() {
  let outDir;
  let jsTarget;
  let cssTarget;
  let logger;
  const files = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return path === join(outDir, 'assets') ? [] : files(path);
      }
      return /\.(css|js)$/.test(entry.name) ? [path] : [];
    });
  return {
    name: 'px-minify-public',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      jsTarget = config.build.target || 'es2020';
      cssTarget = config.build.cssTarget || jsTarget;
      logger = config.logger;
    },
    async closeBundle() {
      if (!existsSync(outDir)) return;
      for (const file of files(outDir)) {
        const isCss = file.endsWith('.css');
        const result = await transform(readFileSync(file, 'utf8'), {
          loader: isCss ? 'css' : 'js',
          minify: true,
          target: isCss ? cssTarget : jsTarget,
          sourcefile: file
        });
        for (const w of result.warnings) logger.warn(`[px-minify-public] ${file}: ${w.text}`);
        writeFileSync(file, result.code);
      }
    }
  };
}

export default defineConfig({
  plugins: [clarity(), googleAnalytics(), footerYear(), tableLabels(), minifyPublic()],
  // Absolute base, and this is load-bearing rather than cosmetic. The legacy
  // pages ship as flat files served extensionless via .htaccess, and Apache
  // also answers the trailing-slash variant (/services/) from the same file.
  // Under base: './' that variant would resolve assets against /services/ and
  // 404 every one of them. Absolute paths make the slash variant irrelevant.
  // Deployment target is Hostinger/Apache, not a GitHub Pages subpath.
  base: '/',
  server: {
    watch: {
      // Everything here lives inside the project root but is not source. The
      // build output alone is 129 files, and the screen recordings are 22MB —
      // all of it fed the watcher for nothing.
      ignored: [
        '**/dist/**',
        '**/content/**',
        '**/tools/**',
        '**/*.mp4',
        '**/.git/**'
      ]
    },
    // Transform the entry graphs up front so the first request after a start
    // is not a cold transform of three.js + gsap.
    warmup: {
      clientFiles: ['./src/js/main.js', './src/js/subpage.js']
    }
  },
  optimizeDeps: {
    // Heavy and stable. Declaring them keeps the dep cache deterministic
    // instead of Vite discovering them mid-request and re-optimizing, which
    // is what leaves a page showing unstyled HTML while it waits.
    include: ['three', 'gsap', 'gsap/ScrollTrigger', 'lenis']
  },
  build: {
    rollupOptions: {
      // Only the pages built from src/ are listed here. The 52 legacy pages
      // live in public/ and are copied verbatim, which keeps Vite away from
      // free-audit.html's 2,140 lines of inline JS.
      //
      // No 'index.html' entry: dist/index.html comes from public/index.html
      // (the legacy home page). experience.html carries the immersive build
      // until Phase 5 merges it onto / — see .migration/MIGRATION-PLAN.md.
      input: {
        // The merged immersive home page. It absorbed the legacy home page's
        // content and both schema nodes, so this entry now produces dist/index.html
        // and supersedes the copy that used to come from public/index.html.
        main: resolve(root, 'index.html'),
        works: resolve(root, 'works.html'),
        cognexa: resolve(root, 'cognexa.html')
      }
    }
  }
});
