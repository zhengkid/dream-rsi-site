/* DREAM-RSI project page — theme, reveal, tabs, copy, scroll-spy. No dependencies. */

/* ---------- colour theme ----------
   The inline script in <head> already set data-theme before first paint; this
   only handles the toggle. dream.js listens for 'themechange' to repaint the
   canvas, which CSS can't do for it. */
{
  const root = document.documentElement;
  const btn = document.querySelector('[data-theme-toggle]');

  const label = () => {
    if (!btn) return;
    const dark = root.dataset.theme === 'dark';
    btn.textContent = dark ? 'Light' : 'Dark';
    btn.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  };
  label();

  btn?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('dreamrsi-theme', root.dataset.theme); } catch {}
    label();
    window.dispatchEvent(new CustomEvent('themechange', { detail: root.dataset.theme }));
  });
}

/* ---------- HUD goes solid once it leaves the top ---------- */
{
  const hud = document.querySelector('.hud');
  if (hud) {
    const sync = () => hud.classList.toggle('scrolled', window.scrollY > 8);
    sync();
    window.addEventListener('scroll', sync, { passive: true });
  }
}

/* ---------- reveal on scroll ---------- */
{
  const items = [...document.querySelectorAll('.rv:not(.in)')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (still || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    items.forEach((el) => io.observe(el));
  }
}

/* ---------- copy buttons ---------- */
document.querySelectorAll('.copy').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = document.querySelector(btn.dataset.copy)?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
      btn.dataset.done = '';
    } catch {
      btn.textContent = 'Press ⌘C';
    }
    setTimeout(() => {
      btn.textContent = 'Copy';
      delete btn.dataset.done;
    }, 1600);
  });
});

/* ---------- scroll-spy on the HUD nav ---------- */
{
  const navLinks = [...document.querySelectorAll('.hud nav a[href^="#"]')];
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const seen = new Set();
    let queued = false;

    const update = () => {
      queued = false;
      // No intersection fires over the last few scroll pixels, so the final
      // section would never light up without this override.
      const atBottom =
        Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
      const active = atBottom
        ? sections[sections.length - 1]
        : sections.filter((s) => seen.has(s.id)).pop();
      navLinks.forEach((a) =>
        a.classList.toggle('is-active', !!active && a.getAttribute('href') === `#${active.id}`)
      );
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
        update();
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  }
}
