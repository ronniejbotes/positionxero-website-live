import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';

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

export default defineConfig({
  plugins: [clarity(), footerYear()],
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
