/* ============================================================
   History as a replay simulator — the interactive figure in §03.

   The point the static Figure 2 can only assert, this one demonstrates:
   ONE online run is paid for, and then every alternative exploration
   policy is scored by walking the SAME stored tree for free.

   Nothing here is hand-animated. The recorded tree is data; the four
   policies are real decision rules; the visit orders and the numbers in
   the rail are whatever simulating them produces. If you edit a score,
   the story changes with it — which is the honest way to build a figure
   that claims to be a simulation.

   Drawn as inline SVG rather than canvas so every colour is a CSS custom
   property and dark mode needs no repaint hook.
   ============================================================ */
(() => {
  const root = document.querySelector('[data-rsim]');
  if (!root) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  /* ── the recorded discovery tree ────────────────────────────────────
     Only the root and the current leaves are continuable — A(T) = {r} ∪
     {leaves} — so the tree the discovery agent leaves behind is a set of
     chains hanging off one root, not an arbitrary branching tree. Each
     chain ends where its own stopping rule fired, hence the ragged
     lengths. Scores are illustrative; the shapes are the point:
       A  looks best early, then plateaus      → the trap
       B  starts worst, ends best              → the prize
       C  never goes anywhere                  → the waste          */
  const CHAINS = [
    { id: 'A', scores: [.31, .42, .44, .45, .46, .47] },
    { id: 'B', scores: [.18, .29, .58, .79, .86] },
    { id: 'C', scores: [.24, .26, .30] },
  ];
  const IDS = CHAINS.map(c => c.id);
  const LEN = Object.fromEntries(CHAINS.map(c => [c.id, c.scores.length]));
  const SCORE = Object.fromEntries(CHAINS.map(c => [c.id, c.scores]));
  const TOTAL = CHAINS.reduce((n, c) => n + c.scores.length, 0);
  const TARGET = Math.max(...CHAINS.flatMap(c => c.scores));

  /* ── the simulator ──────────────────────────────────────────────────
     A policy never sees the tree. It sees the eligible set and the
     scores it has already been handed back, and it returns the next
     CONTINUE. That is the whole interface, and it is why a policy can be
     evaluated without running anything: every answer is already stored. */
  const newState = () => ({ depth: { A: 0, B: 0, C: 0 }, log: [] });

  const eligible = (st) => {
    const acts = [];
    if (IDS.some(id => st.depth[id] === 0)) acts.push('r');
    for (const id of IDS) if (st.depth[id] > 0 && st.depth[id] < LEN[id]) acts.push(id);
    return acts;
  };
  /* score the policy currently sees at an eligible action — the root has
     nothing behind it yet, so it is worth 0 until a chain is opened */
  const seen = (st, a) => (a === 'r' ? 0 : SCORE[a][st.depth[a] - 1]);

  const step = (st, a) => {
    const id = a === 'r' ? IDS.find(i => st.depth[i] === 0) : a;
    const i = st.depth[id]++;
    const rec = { key: id + (i + 1), chain: id, idx: i, score: SCORE[id][i], via: a };
    st.log.push(rec);
    return rec;
  };

  /* ── the four candidate policies ────────────────────────────────────
     π⁰ is the one that produced the tree, so replaying it reproduces the
     run exactly — which is also why the winner can never be worse than
     what is already deployed: π⁰ is in the candidate set. */
  const POLICIES = [
    {
      id: 'pi0', tag: 'π⁰', name: 'parallel refine',
      note: 'the deployed policy — opens three branches and refines all of them in lock&nbsp;step',
      pick(st) {
        if (st.depth.A === 0 || st.depth.B === 0 || st.depth.C === 0) return 'r';
        const open = IDS.filter(id => st.depth[id] > 0 && st.depth[id] < LEN[id]);
        if (!open.length) return null;
        this.cur = ((this.cur ?? -1) + 1);
        return open[this.cur % open.length];
      },
      reset() { this.cur = -1; },
    },
    {
      id: 'pi1', tag: 'π¹', name: 'greedy',
      note: 'always continues whatever scored best so far — and so cannot let go of&nbsp;A',
      pick(st) {
        const acts = eligible(st);
        if (!acts.length) return null;
        return acts.reduce((b, a) => (seen(st, a) > seen(st, b) ? a : b));
      },
      reset() {},
    },
    {
      id: 'pi2', tag: 'π²', name: 'explore → exploit',
      note: 'opens every branch before committing, then never reconsiders the&nbsp;order',
      pick(st) {
        const acts = eligible(st);
        if (!acts.length) return null;
        if (acts.includes('r')) return 'r';
        return acts.reduce((b, a) => (seen(st, a) > seen(st, b) ? a : b));
      },
      reset() {},
    },
    {
      id: 'pi3', tag: 'π³', name: 'adaptive width',
      note: 'refines every live branch once per wave, then drops the ones that stopped&nbsp;paying',
      pick(st) {
        if (IDS.some(id => st.depth[id] === 0)) return 'r';
        if (!this.alive) this.alive = [...IDS];
        for (;;) {
          if (!this.wave || !this.wave.length) {
            // prune: a branch that gained less than 0.05 last wave is done
            if (this.gains) {
              this.alive = this.alive.filter(id =>
                st.depth[id] < LEN[id] && (this.gains[id] ?? 1) >= .05);
            }
            if (!this.alive.length) return null;
            this.wave = this.alive.filter(id => st.depth[id] < LEN[id]);
            this.gains = {};
            if (!this.wave.length) return null;
          }
          const id = this.wave.shift();
          if (st.depth[id] >= LEN[id]) continue;
          const prev = SCORE[id][st.depth[id] - 1];
          this.gains[id] = SCORE[id][st.depth[id]] - prev;
          return id;
        }
      },
      reset() { this.alive = null; this.wave = null; this.gains = null; },
    },
  ];

  /* run a policy to exhaustion over the recorded tree, offline, free */
  const replay = (p) => {
    const st = newState();
    p.reset();
    let a, guard = 0;
    while ((a = p.pick(st)) && guard++ < 200) step(st, a);
    let best = 0, atTarget = null, best10 = 0;
    st.log.forEach((rec, i) => {
      best = Math.max(best, rec.score);
      if (i < 10) best10 = best;
      if (atTarget === null && best >= TARGET - 1e-9) atTarget = i + 1;
    });
    return { log: st.log, ops: st.log.length, best, atTarget, best10 };
  };

  const RUNS = Object.fromEntries(POLICIES.map(p => [p.id, replay(p)]));
  const RECORD = RUNS.pi0;                 /* the tree was produced by π⁰ */

  /* ── geometry ───────────────────────────────────────────────────────
     Rows are chains; columns are depth. The root sits on the middle row
     because it is the only node all three chains hang from. */
  const VB = { w: 600, h: 320 };
  const ROW = { A: 62, B: 160, C: 258 };
  const COL = d => 122 + d * 78;
  const RX = 40, RY = 160, R = 16, RR = 13;

  const el = (name, attrs) => {
    const n = document.createElementNS(SVG_NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const fmt = s => s.toFixed(2).replace(/^0/, '');

  const svg = root.querySelector('[data-rsim-svg]');
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);

  const gEdge = el('g', { class: 'rsim-edges' });
  const gNode = el('g', { class: 'rsim-nodes' });
  svg.append(gEdge, gNode);

  const NODE = {}, EDGE = {};

  // root
  const gr = el('g', { class: 'rn rn-root is-rec', transform: `translate(${RX},${RY})` });
  gr.append(el('circle', { r: RR }));
  const rt = el('text', { class: 'rn-s', y: 4 }); rt.textContent = 'r';
  gr.append(rt);
  gNode.append(gr);

  for (const { id, scores } of CHAINS) {
    const y = ROW[id];
    scores.forEach((s, d) => {
      const x = COL(d), key = id + (d + 1);
      // edge from the previous node (or a curve out of the root)
      const path = d === 0
        ? `M ${RX + RR} ${RY} C ${RX + 54} ${RY}, ${x - 54} ${y}, ${x - R} ${y}`
        : `M ${COL(d - 1) + R} ${y} L ${x - R} ${y}`;
      const e = el('path', { class: 're', d: path });
      EDGE[key] = e; gEdge.append(e);

      const g = el('g', { class: 'rn', transform: `translate(${x},${y})` });
      g.append(el('circle', { r: R }));
      const t = el('text', { class: 'rn-s', y: 4 }); t.textContent = fmt(s);
      const o = el('text', { class: 'rn-o', x: 0, y: -R - 7 });
      g.append(t, o);
      NODE[key] = { g, order: o }; gNode.append(g);
    });
    /* ends before the first node's order badge starts, and high enough to
       clear it — the badge is the one label that must never be occluded */
    const lab = el('text', { class: 'rn-lab', x: COL(0) - R, y: y - 38,
                             'text-anchor': 'end' });
    lab.textContent = 'branch ' + id;
    gNode.append(lab);
  }

  /* ── acts ───────────────────────────────────────────────────────────
     Act 0 is the one that costs money. Acts 1..4 are free. */
  const ACTS = [
    { kind: 'record', title: 'Record it once', run: RECORD },
    ...POLICIES.map(p => ({ kind: 'replay', policy: p, title: 'Replay ' + p.name, run: RUNS[p.id] })),
  ];

  /* the transport controls are siblings of .rsim inside the <figure>, so
     anything below the board has to be looked up from the figure, not the
     board. Playing state lives on the figure for the same reason — the
     play/pause icon swap is a control, not part of the panel. */
  const fig = root.closest('figure');
  const $ = s => root.querySelector(s) || fig.querySelector(s);
  const rail = {
    mode: $('[data-r-mode]'), name: $('[data-r-name]'), note: $('[data-r-note]'),
    calls: $('[data-r-calls]'), cont: $('[data-r-cont]'), best: $('[data-r-best]'),
    nodes: $('[data-r-nodes]'),
  };
  rail.nodes.textContent = TOTAL;

  /* comparison strip, filled in as each replay finishes */
  const cmp = $('[data-r-cmp]');
  const maxOps = Math.max(...POLICIES.map(p => RUNS[p.id].atTarget ?? RUNS[p.id].ops));
  const BAR = {};
  for (const p of POLICIES) {
    const run = RUNS[p.id];
    const row = document.createElement('div');
    row.className = 'rc-row';
    row.dataset.pol = p.id;
    row.innerHTML =
      `<span class="rc-tag">${p.tag}</span>` +
      `<span class="rc-name">${p.name}</span>` +
      `<span class="rc-track"><i style="width:${(100 * (run.atTarget ?? run.ops) / maxOps).toFixed(1)}%"></i></span>` +
      `<span class="rc-n">${run.atTarget ?? '—'}</span>`;
    BAR[p.id] = row; cmp.append(row);
  }

  /* ── chips ──────────────────────────────────────────────────────────*/
  const chips = [...fig.querySelectorAll('[data-r-chip]')];

  /* ── playback ───────────────────────────────────────────────────────*/
  let act = 0, cursor = 0, timer = 0, speed = 1, playing = !still.matches;

  const clearBoard = () => {
    for (const k in NODE) { NODE[k].g.setAttribute('class', 'rn'); NODE[k].order.textContent = ''; }
    for (const k in EDGE) EDGE[k].setAttribute('class', 're');
  };

  /* paint the first n steps of the current act */
  const paint = (n) => {
    const a = ACTS[act], rec = a.kind === 'record';
    clearBoard();
    gr.setAttribute('class', 'rn rn-root is-rec');
    svg.dataset.mode = a.kind;

    if (!rec) {                     // the stored tree is always on screen
      for (const k in NODE) NODE[k].g.classList.add('is-rec');
      for (const k in EDGE) EDGE[k].classList.add('is-rec');
    }
    let best = 0, bestKey = null;
    for (let i = 0; i < n; i++) {
      const s = a.run.log[i];
      const cls = rec ? 'is-paid' : 'is-dreamt';
      NODE[s.key].g.classList.add(cls, 'is-rec');
      NODE[s.key].order.textContent = i + 1;
      EDGE[s.key].classList.add(cls, 'is-rec');
      if (s.score > best) { best = s.score; bestKey = s.key; }
      if (i === n - 1) NODE[s.key].g.classList.add('is-live');
    }
    if (bestKey) NODE[bestKey].g.classList.add('is-best');

    rail.mode.textContent = rec ? 'online · paid' : 'replay · free';
    rail.mode.dataset.kind = a.kind;
    rail.name.innerHTML = rec
      ? 'Discovery run'
      : `<span class="rn-tag">${a.policy.tag}</span> ${a.policy.name}`;
    rail.note.innerHTML = rec
      ? 'One real rollout of the deployed policy. Every node here is a discovery&#8209;agent call that actually ran, and its score is now stored forever.'
      : a.policy.note;
    rail.calls.textContent = rec ? n : 0;
    rail.calls.classList.toggle('real', rec);
    rail.calls.classList.toggle('dream', !rec);
    rail.cont.textContent = n;
    rail.best.textContent = best ? fmt(best) : '—';

    for (const p of POLICIES) {
      const done = ACTS.findIndex(x => x.policy === p) < act ||
                   (ACTS[act].policy === p && n >= (RUNS[p.id].atTarget ?? RUNS[p.id].ops));
      BAR[p.id].classList.toggle('is-on', done);
      BAR[p.id].classList.toggle('is-cur', ACTS[act].policy === p);
    }
    chips.forEach((c, i) => c.setAttribute('aria-current', String(i === act)));
  };

  const goto = (i, autoplay) => {
    act = ((i % ACTS.length) + ACTS.length) % ACTS.length;
    cursor = 0; paint(0);
    if (autoplay !== false && playing) schedule(520);
  };

  const tick = () => {
    const a = ACTS[act];
    if (cursor < a.run.log.length) { cursor++; paint(cursor); schedule(430); }
    else { schedule(1500, () => goto(act + 1)); }
  };

  function schedule(ms, fn) {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(fn || tick, ms / speed);
  }

  /* ── controls ───────────────────────────────────────────────────────*/
  const playBtn = $('[data-r-play]');
  const setPlaying = (v) => {
    playing = v; root.dataset.playing = fig.dataset.playing = String(v);
    playBtn.setAttribute('aria-label', v ? 'Pause' : 'Play');
    if (v) schedule(220); else clearTimeout(timer);
  };
  playBtn.addEventListener('click', () => setPlaying(!playing));
  chips.forEach((c, i) => c.addEventListener('click', () => { goto(i); }));

  const speedBtn = $('[data-r-speed]');
  speedBtn.addEventListener('click', () => {
    speed = speed === 1 ? 2 : speed === 2 ? .5 : 1;
    speedBtn.textContent = (speed === .5 ? '0.5' : speed) + '×';
    speedBtn.setAttribute('aria-label', speedBtn.textContent + ', playback speed');
  });

  /* only animate while on screen — and for reduced motion, never: show the
     finished adaptive replay, which is the frame the caption talks about */
  if (still.matches) {
    setPlaying(false);
    act = ACTS.length - 1; cursor = ACTS[act].run.log.length; paint(cursor);
    POLICIES.forEach(p => BAR[p.id].classList.add('is-on'));
  } else {
    paint(0);
    let wasPlaying = true;
    new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting) { if (wasPlaying) setPlaying(true); }
        else { wasPlaying = playing; clearTimeout(timer); }
      }
    }, { threshold: .2 }).observe(root);
  }
})();
