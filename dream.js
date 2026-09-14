/* ==========================================================================
   dream.js — a live trace of one Dream-RSI outer iteration.

   Four acts, looping:
     1. deploy   a real discovery tree is grown online, one paid node at a time
     2. archive  the finished tree is frozen into the history H_t
     3. dream    thousands of alternative policies replay the frozen tree,
                 scoring themselves at zero execution cost
     4. improve  the winning trajectory is compiled into pi_{t+1}

   Everything is drawn from a seeded RNG, so round t looks the same on every
   machine but different from round t+1. No assets, no video file.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-dream]');
  if (!root) return;

  var q = function (s) { return root.querySelector(s); };
  var canvas = q('.dr-canvas');
  var ctx = canvas.getContext('2d');

  var el = {
    round:    q('[data-round]'),
    actName:  q('[data-act-name]'),
    evals:    q('[data-s-evals]'),
    roll:     q('[data-s-roll]'),
    best:     q('[data-s-best]'),
    play:     q('[data-play]'),
    speed:    q('[data-speed]'),
    rbars:    q('[data-rbars]'),
    chips:    Array.prototype.slice.call(root.querySelectorAll('[data-chip]'))
  };

  /* ---------------------------------------------------------------- acts -- */

  var ACTS = [
    { key: 'deploy',  name: 'Online explore',  dur: 7.0 },
    { key: 'archive', name: 'Store to history', dur: 2.2 },
    { key: 'dream',   name: 'Dream',            dur: 9.0 },
    { key: 'improve', name: 'Update policy',    dur: 5.8 }
  ];
  var STARTS = [], TOTAL = 0;
  for (var ai = 0; ai < ACTS.length; ai++) { STARTS.push(TOTAL); TOTAL += ACTS[ai].dur; }

  /* ----------------------------------------------------------------- rng -- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(u) { return u < 0 ? 0 : u > 1 ? 1 : 1 - Math.pow(1 - u, 3); }

  /* ---------------------------------------------------------------- tree -- */

  var tree = null;

  // Return = best score reached, minus a flat charge per attempt executed.
  // The deployed run pays for the whole tree; a replayed policy only pays for
  // the path it would actually have walked. Same formula, so they compare.
  var LAMBDA = 0.006;


  function buildTree(seed) {
    var rnd = mulberry32(seed * 7919 + 13);
    var quality = Math.min(1, (seed - 1) * 0.22);     // later rounds search better
    // What the round's policy can actually reach. It climbs every lap and never
    // quite closes the gap — the shape self-improvement really has.
    var ceil = 0.97 - 0.40 * Math.pow(0.86, seed - 1);
    var nodes = [{ id: 0, p: -1, d: 0, kids: [], score: 0.2 + 0.06 * quality, jx: 0, jy: 0 }];

    // Only two kinds of node can be expanded: the root, which opens a brand new
    // branch, and a leaf, which extends the branch it already ends. Nothing in
    // the middle of a path ever forks — so every branch is a single chain and
    // the whole tree is a fan of paths out of the root.
    var BUDGET = 32, MAXD = 6, MINBR = 5, MAXBR = 8;
    var leaves = [], i, maxDepth = 1;

    while (nodes.length - 1 < BUDGET) {
      // the two moves compete: open (weighted down once the fan is wide enough)
      // against extend (weighted by how good the branch already looks)
      var wNew = leaves.length >= MAXBR ? 0 : leaves.length < MINBR ? 6 : 1.1;
      var wt = [], tot = wNew;
      for (i = 0; i < leaves.length; i++) {
        var w = leaves[i].d >= MAXD ? 0 : Math.pow(leaves[i].score + 0.08, 1.7) * 1.6;
        wt.push(w); tot += w;
      }
      if (tot <= 0) break;                               // nothing left to grow

      var pick = rnd() * tot, par = nodes[0], slot2 = -1;
      if (pick > wNew) {
        var acc = wNew;
        for (i = 0; i < leaves.length; i++) {
          acc += wt[i];
          if (pick <= acc) { par = leaves[i]; slot2 = i; break; }
        }
      }

      var sc = clamp(par.score + (rnd() - 0.42) * 0.52 + 0.05 * quality, 0.03, 0.99);
      var n = { id: nodes.length, p: par.id, d: par.d + 1, kids: [], score: sc,
                jx: (rnd() - 0.5) * 0.2, jy: 0 };
      par.kids.push(n.id); nodes.push(n);
      if (slot2 < 0) leaves.push(n); else leaves[slot2] = n;
      if (n.d > maxDepth) maxDepth = n.d;
    }

    // Each branch gets its own slow wave rather than per-node jitter: a chain
    // that wanders is still one readable line, whereas independent offsets let
    // neighbouring chains cross and every crossing reads as a fork.
    for (i = 0; i < nodes[0].kids.length; i++) {
      var ph = rnd() * 6.283, am = 0.16 + rnd() * 0.22, fr = 0.55 + rnd() * 0.5;
      for (var c = nodes[nodes[0].kids[i]]; c; c = c.kids.length ? nodes[c.kids[0]] : null)
        c.jy = am * Math.sin(ph + c.d * fr);
    }

    // layered layout: leaves get consecutive slots, parents sit on their mean
    var slot = 0;
    (function place(n) {
      if (!n.kids.length) { n.uy = slot++; return n.uy; }
      var s2 = 0;
      for (var k = 0; k < n.kids.length; k++) s2 += place(nodes[n.kids[k]]);
      n.uy = s2 / n.kids.length;
      return n.uy;
    })(nodes[0]);

    // rescale so the round's best node lands exactly on the round's ceiling
    var maxRaw = 0.05;
    for (i = 0; i < nodes.length; i++) if (nodes[i].score > maxRaw) maxRaw = nodes[i].score;
    for (i = 0; i < nodes.length; i++)
      nodes[i].score = clamp(nodes[i].score * (ceil / maxRaw), 0.02, 1);

    // Best score reachable from each node. The only branch point is the root,
    // so this is what a policy is really choosing between there — the first
    // node of a chain says very little about where the chain ends up.
    for (i = nodes.length - 1; i >= 0; i--) {
      var nb = nodes[i];
      nb.sub = nb.score;
      for (var kb = 0; kb < nb.kids.length; kb++)
        if (nodes[nb.kids[kb]].sub > nb.sub) nb.sub = nodes[nb.kids[kb]].sub;
    }

    // Nodes come out in the order they were bought, which is also the order the
    // search actually made its calls: open a branch here, push that one deeper
    // there. A parent always has a lower id than its child, so nothing appears
    // before the node it hangs off.
    var maxY = Math.max(1, slot - 1);
    for (var r = 0; r < nodes.length; r++) {
      var n2 = nodes[r];
      // a little jitter so the chains do not read as flat rails
      n2.nx = clamp((n2.d + n2.jx) / maxDepth, 0, 1);
      n2.ny = clamp((n2.uy + n2.jy) / maxY, 0, 1);
      n2.birth = (r / Math.max(1, nodes.length - 1)) * (ACTS[0].dur * 0.88) + 0.08;
    }
    return { nodes: nodes, quality: quality };
  }

  // The offline phase is M sequential code revisions, not a population search:
  // a policy-development agent reads the replay traces and scores of the current
  // version and rewrites the policy, pi^0 = pi_t, pi^1, ... pi^(M-1). Every
  // version is replayed over the whole history, and the best-scoring one -- which
  // may still be pi^0 -- becomes pi_(t+1). One frame in the head per revision.
  var REVS = 4;                                      // M, kept equal to NF

  function gauss(rnd) { return (rnd() + rnd() + rnd() + rnd() - 2) * 0.72; }

  function rollout(rnd, greed) {
    // What a replayed policy covers is a SUBTREE, not a single line. An
    // exploration policy is not a route-finder: it decides which branches to
    // open out of the root, which of them to keep paying for in parallel, and
    // when to stop each one. So a replay visits a connected set of recorded
    // nodes, and it is charged for every one of them — that is the whole cost
    // model, and drawing it as one path quietly understated it.
    //
    // greed drives both knobs, in opposite directions: a greedy policy opens
    // few branches and drives them deep, a timid one spreads wide and shallow.
    var nodes = tree.nodes, root = nodes[0];
    var pool = root.kids.slice();
    if (!pool.length) return { chains: [[0]], n: 1, ret: clamp(root.score - LAMBDA, 0, 1) };

    var width = clamp(Math.round(1 + (2.2 / (0.45 + greed)) * (0.45 + rnd())),
                      1, Math.min(pool.length, 5));
    var chains = [], best = root.score, n = 1, i;

    for (var b = 0; b < width && pool.length; b++) {
      // Which branch to open next. The policy is choosing before it knows where
      // the branch ends, so this is weighted by the first node only — .sub is
      // hindsight and nothing here is allowed to see it.
      var w = [], tot = 0;
      for (i = 0; i < pool.length; i++) {
        var v = Math.pow(nodes[pool[i]].score + 0.05, greed * 2.5);
        w.push(v); tot += v;
      }
      var pick = rnd() * tot, acc = 0, k = pool.length - 1;
      for (i = 0; i < w.length; i++) { acc += w[i]; if (pick <= acc) { k = i; break; } }
      var cur = nodes[pool[k]];
      pool.splice(k, 1);

      var chain = [0, cur.id], localBest = cur.score;
      n++;
      if (cur.score > best) best = cur.score;
      // Below the root nothing forks, so extending a branch is a single choice:
      // keep paying, or cut it. Stop sooner once the chain has flattened out,
      // and sooner still if the policy is timid.
      while (cur.kids.length) {
        var nx = nodes[cur.kids[0]];
        var stop = (nx.score >= localBest - 0.01 ? 0.1 : 0.38) - 0.07 * (greed - 1);
        if (rnd() < clamp(stop, 0.04, 0.55)) break;
        cur = nx; chain.push(cur.id); n++;
        if (cur.score > localBest) localBest = cur.score;
        if (cur.score > best) best = cur.score;
      }
      chains.push(chain);
    }
    return { chains: chains, n: n, ret: clamp(best - LAMBDA * n, 0, 1) };
  }

  /* --------------------------------------------------------------- state -- */

  var clock = 0, round = 3, speed = 1, playing = true, visible = true;
  var dreams = [], bestDream = null, dreamRnd = mulberry32(1);
  var stats = { evals: 0, roll: 0, best: 0, next: 0 };
  var lastAct = -1;
  var revIdx = 0, revGreed = 1.0;
  var rounds = [], rbarEls = [];
  var frames = [], NF = 4;
  // The winner of the previous lap, frozen as plain normalised points: the
  // policy the agent is running right now. It outlives the tree it came from,
  // so the head is never an empty box.
  var carry = null;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resetRound(seed) {
    tree = buildTree(seed);
    dreams = []; bestDream = null; dreamRnd = mulberry32(seed * 104729 + 7);
    stats.evals = 0; stats.roll = 0; stats.best = 0; stats.next = 0;
    revIdx = 0; revGreed = 1.0;
    frames = [];
  }
  // Round 3, not round 1: the viewer joins a loop that has already turned twice,
  // and the per-round bars have a staircase to show from the very first frame.
  function seedHistory(upTo) {
    var keep = tree;
    for (var t = 1; t < upTo; t++) {
      tree = buildTree(t);
      var rnd = mulberry32(t * 104729 + 7), top = 0, i;
      for (i = 0; i < tree.nodes.length; i++)
        if (tree.nodes[i].score > top) top = tree.nodes[i].score;
      var dep = clamp(top - LAMBDA * tree.nodes.length, 0, 1), best = dep, top1 = null;
      for (i = 0; i < 900; i++) {
        var r = rollout(rnd, clamp(0.95 + gauss(rnd) * 0.7, 0.05, 2.6));
        if (r.n > 1 && r.ret > best) { best = r.ret; top1 = r; }
      }
      if (top1) carry = { pts: chainPts(top1.chains), ret: best, best: true, solo: true };
      rounds.push({ deploy: dep, dream: best });
    }
    tree = keep;
  }

  resetRound(round);
  seedHistory(round);

  /* --------------------------------------------------------------- sizing -- */

  var W = 0, H = 0, S = 1, AW = 120, PAD = { l: 0, r: 0, t: 0, b: 0 };

  function resize() {
    var rect = canvas.parentNode.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = rect.width; H = rect.height;
    S = clamp(Math.min(W / 560, H / 340), 0.55, 1.5);
    AW = clamp(W * 0.2, 100, 178);                   // left strip: the agent
    NF = AW < 138 ? 3 : 4;                           // one slot per revision
    REVS = NF;
    PAD = { l: AW + 62 * S, r: W * 0.06, t: H * 0.13, b: H * 0.15 };
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentNode);
  window.addEventListener('resize', resize);

  function px(n) { return PAD.l + n.nx * (W - PAD.l - PAD.r); }
  function py(n) { return PAD.t + n.ny * (H - PAD.t - PAD.b); }

  /* -------------------------------------------------------------- palette -- */

  // Two hues, the same two the rail uses: blue = paid for online, violet =
  // imagined for free. Each theme is the same palette re-aimed at its own
  // background -- light lays ink on paper and blends with 'multiply', dark
  // lays light on a dark panel and blends with 'lighter'.
  var THEMES = {
    light: {
      low:   [176, 180, 188],  // a node nobody scored well: light grey
      real:  [50, 115, 220],   // paid, online        (--env)
      dream: [122, 82, 199],   // imagined, free      (--mid)
      win:   [78, 45, 150],    // the winner: the dream hue driven to full ink
      idle:  [104, 108, 118],  // the "store" act, which is neither
      paper: '255,255,255',    // whatever --panel is, so knockouts read as erase
      ink:   '36,41,47',
      blend: 'multiply'
    },
    dark: {
      low:   [96, 104, 118],
      real:  [121, 168, 245],
      dream: [158, 134, 232],
      win:   [212, 200, 255],  // on dark the winner goes up, not down
      idle:  [150, 157, 168],
      paper: '20,26,33',
      ink:   '230,237,243',
      blend: 'lighter'
    }
  };
  var COL, PAPER, INK, BLEND, ACT_COL;
  function applyTheme() {
    var t = THEMES[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
    COL = t; PAPER = t.paper; INK = t.ink; BLEND = t.blend;
    ACT_COL = [t.real, t.idle, t.dream, t.win];
  }
  applyTheme();
  window.addEventListener('themechange', applyTheme);
  function ink(a) { return 'rgba(' + INK + ',' + a + ')'; }
  function mix(a, b, u) {
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * u) + ',' +
                    Math.round(a[1] + (b[1] - a[1]) * u) + ',' +
                    Math.round(a[2] + (b[2] - a[2]) * u) + ')';
  }
  function scoreColor(s) {
    return mix(COL.low, COL.real, clamp(s / 0.8, 0, 1));
  }

  /* --------------------------------------------------------------- canvas -- */

  function edgePath(a, b) {
    var x1 = px(a), y1 = py(a), x2 = px(b), y2 = py(b), mx = (x1 + x2) / 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
  }

  // point along the parent->child bezier, used by the dream trails
  function edgePoint(a, b, u) {
    var x1 = px(a), y1 = py(a), x2 = px(b), y2 = py(b), mx = (x1 + x2) / 2;
    var v = 1 - u, v2 = v * v, u2 = u * u;
    return {
      x: v2 * v * x1 + 3 * v2 * u * mx + 3 * v * u2 * mx + u2 * u * x2,
      y: v2 * v * y1 + 3 * v2 * u * y1 + 3 * v * u2 * y2 + u2 * u * y2
    };
  }

  /* ------------------------------------------------- the agent and its head --
     Left column is the agent itself: the thought bubble it keeps its
     imagination in, the frames it is imagining right now, and the robot. The
     three labelled arrows agent -> stage -> bubble -> agent are the outer RSI
     loop; the circular arrow inside the bubble is the dream's own loop.       */

  var RET_FRAC = 0.24;                        // tail of "improve" spent handing back

  function geom() {
    var hr = clamp(AW * 0.16, 17, 30);
    return {
      bx0: 7 * S, bx1: AW - 9 * S, by0: H * 0.045, by1: H * 0.565,
      cx: AW * 0.46, hy: H * 0.795, hr: hr
    };
  }

  function frameRect(g, i) {
    var p = 6 * S, hdr = 19 * S, ftr = p;
    var cols = NF === 3 ? 1 : 2, rows = NF / cols;
    var x0 = g.bx0 + p, y0 = g.by0 + hdr;
    var w = (g.bx1 - g.bx0 - p * (cols + 1)) / cols;
    var h = (g.by1 - ftr - y0 - p * rows) / rows;
    return { x: x0 + (i % cols) * (w + p), y: y0 + Math.floor(i / cols) * (h + p), w: w, h: h };
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function arrowHead(x, y, ang, size, fill) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.52); ctx.lineTo(-size, size * 0.52);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.restore();
  }

  function labelFont() {
    ctx.font = '600 ' + Math.max(7.2, 8.2 * S).toFixed(1) + 'px Inter, system-ui, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (0.5 * S).toFixed(2) + 'px';
  }

  function label(txt, x, y, col, align) {
    labelFont();
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(txt, x, y);
    var w = ctx.measureText(txt).width;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return w;
  }

  // pick the longest variant that still leaves `room` px
  function fitText(variants, room) {
    labelFont();
    for (var i = 0; i < variants.length; i++)
      if (ctx.measureText(variants[i]).width <= room) return variants[i];
    return variants[variants.length - 1];
  }

  /* ---- one frame per policy revision the agent writes ---- */

  // pi^0 is the policy already deployed, so it is in the candidate set from the
  // start; that is why the version finally picked can never score worse than the
  // one it replaces. Later revisions drift greedier because the development
  // agent has the earlier traces and scores to learn from.
  function addRevision(m) {
    revGreed = m === 0 ? 0.85 : clamp(revGreed + 0.3 + gauss(dreamRnd) * 0.28, 0.2, 2.6);
    var r = rollout(dreamRnd, revGreed);
    frames.push({ chains: r.chains, n: r.n, ret: r.ret, m: m, born: clock, best: false });
    var bi = 0;
    for (var i = 1; i < frames.length; i++) {
      frames[i].best = false;
      if (frames[i].ret > frames[bi].ret) bi = i;
    }
    frames[0].best = bi === 0;
    frames[bi].best = true;
  }

  // a replay is a list of chains, so its geometry is a list of polylines
  function chainPts(chains) {
    var nodes = tree.nodes, out = [];
    for (var c = 0; c < chains.length; c++) {
      var a = [];
      for (var i = 0; i < chains[c].length; i++)
        a.push([nodes[chains[c][i]].nx, nodes[chains[c][i]].ny]);
      out.push(a);
    }
    return out;
  }

  // one imagined trajectory, drawn small inside its frame
  function drawFrame(r, f, pop, opaque) {
    var i, c, pts = f ? (f.pts || chainPts(f.chains)) : null;
    var ix = r.x + 5 * S, iy = r.y + 4 * S;
    var iw = r.w - 10 * S, ih = r.h - 15 * S;
    var col = f && f.best ? COL.win : COL.dream;

    ctx.save();
    ctx.globalAlpha = pop;
    roundRect(r.x, r.y, r.w, r.h, 5 * S);
    ctx.fillStyle = 'rgba(' + PAPER + ',' + (opaque ? 1 : 0.72) + ')';
    ctx.fill();
    ctx.lineWidth = 1 * S;
    ctx.strokeStyle = f
      ? (f.best ? 'rgba(' + COL.win.join(',') + ',0.85)' : 'rgba(' + COL.dream.join(',') + ',0.42)')
      : ink(0.16);
    if (!f) ctx.setLineDash([3 * S, 3 * S]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (f) {
      // the imagined subtree: every branch this version paid to open
      ctx.lineWidth = 1.4 * S;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgb(' + col.join(',') + ')';
      ctx.beginPath();
      for (c = 0; c < pts.length; c++) {
        for (i = 0; i < pts[c].length; i++) {
          var x = ix + pts[c][i][0] * iw, y = iy + pts[c][i][1] * ih;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.fillStyle = 'rgb(' + col.join(',') + ')';
      for (c = 0; c < pts.length; c++) {          // where each branch was cut off
        var last = pts[c][pts[c].length - 1];
        ctx.beginPath();
        ctx.arc(ix + last[0] * iw, iy + last[1] * ih, 1.9 * S, 0, 6.2832);
        ctx.fill();
      }

      // revision id on the left, its replay score on the right; the winner is
      // already obvious from the lit border, so it needs no extra badge
      ctx.font = Math.max(7, 7.8 * S).toFixed(1) + 'px ui-monospace, SFMono-Regular, monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(' + col.join(',') + ',0.95)';
      ctx.textAlign = 'right';
      var sw = ctx.measureText(f.ret.toFixed(2)).width;
      ctx.fillText(f.ret.toFixed(2), r.x + r.w - 5 * S, r.y + r.h - 4 * S);
      if (f.m !== undefined) {
        ctx.font = Math.max(6, 6.4 * S).toFixed(1) + 'px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(' + col.join(',') + ',0.55)';
        var tag = '\u03C0' + f.m;
        // only if it cannot collide with the score -- on a narrow canvas the
        // frames are barely wider than the number itself
        if (ctx.measureText(tag).width + sw + 9 * S < r.w)
          ctx.fillText(tag, r.x + 5 * S, r.y + r.h - 4 * S);
      }
    }
    ctx.restore();
  }

  /* ---- the thought bubble ---- */

  function drawBubble(act, u) {
    var g = geom(), i;
    var dreaming = act === 2;

    roundRect(g.bx0, g.by0, g.bx1 - g.bx0, g.by1 - g.by0, 14 * S);
    ctx.fillStyle = dreaming ? 'rgba(' + COL.dream.join(',') + ',0.045)' : ink(0.015);
    ctx.fill();
    ctx.setLineDash([5 * S, 4.5 * S]);
    ctx.lineWidth = 1.3 * S;
    ctx.strokeStyle = dreaming ? 'rgba(' + COL.dream.join(',') + ',0.55)' : ink(0.22);
    ctx.stroke();
    ctx.setLineDash([]);

    var k = (revIdx + 1) + '/' + REVS;
    var hroom = g.bx1 - g.bx0 - (dreaming ? 25 * S : 14 * S);
    var title = act === 2 ? ['REVISION ' + k, 'REV ' + k, k]
              : act === 3 ? ['BEST OF ' + REVS, 'BEST', '\u2605']
              : ['RUNNING \u03C0' + round, '\u03C0' + round];
    label(fitText(title, hroom), g.bx0 + 9 * S, g.by0 + 10 * S,
          act >= 2 ? 'rgba(' + COL.win.join(',') + ',0.9)' : ink(0.45));

    // the dream's own loop: a circular arrow that turns once per revision
    if (dreaming) {
      var gu = clamp(u * REVS - revIdx, 0, 1);
      var rx = g.bx1 - 9 * S, ry = g.by0 + 10 * S, rr = 5 * S;
      ctx.lineWidth = 1.6 * S;
      ctx.strokeStyle = 'rgba(' + COL.dream.join(',') + ',0.35)';
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = 'rgba(' + COL.dream.join(',') + ',1)';
      ctx.beginPath();
      ctx.arc(rx, ry, rr, -1.5708, -1.5708 + Math.max(0.02, gu) * 6.2832);
      ctx.stroke();
      var oa = -1.5708 + gu * 6.2832;
      arrowHead(rx + Math.cos(oa) * rr, ry + Math.sin(oa) * rr, oa + 1.5708, 3.4 * S,
                'rgba(' + COL.dream.join(',') + ',1)');
    }

    // Dreaming: the generation's four candidates. Otherwise a single frame --
    // the policy it is out there running, which is last lap's winner.
    if (act === 3) {
      drawHandoff(g, u);
    } else if (dreaming) {
      for (i = 0; i < frames.length && i < NF; i++) {
        var pop = clamp((clock - frames[i].born) * 12, 0, 1);
        if (pop > 0) drawFrame(frameRect(g, i), frames[i], pop);
      }
    } else if (carry) {
      // one wide frame, kept at roughly the shape of the four it replaces so the
      // trajectory inside it is not stretched into a different curve
      var a = frameRect(g, 0), b = frameRect(g, NF - 1);
      var fw = b.x + b.w - a.x, fh = Math.min(b.y + b.h - a.y, fw * 0.62);
      drawFrame({ x: a.x, y: a.y + (b.y + b.h - a.y - fh) / 2, w: fw, h: fh }, carry, 1);
    }
  }

  // improve: the winning frame leaves the bubble and lands on the agent
  function drawHandoff(g, u) {
    if (!bestDream) return;
    var e = ease(clamp((u - 0.12) / 0.62, 0, 1));
    var w = (g.bx1 - g.bx0) * 0.74, h = w * 0.6;
    var x = g.cx - w / 2;
    var y0 = g.by0 + (g.by1 - g.by0 - h) * 0.45, y1 = g.hy - g.hr - h - 6 * S;
    var y = y0 + (y1 - y0) * e;
    drawFrame({ x: x, y: y, w: w, h: h },
              { chains: bestDream.chains, ret: bestDream.ret, best: true }, 1, true);
    label('π t+1', g.cx, y - 9 * S,
          'rgba(' + COL.win.join(',') + ',0.95)', 'center');
  }

  /* ---- the agent ---- */

  function drawRobot(act, u) {
    var g = geom(), hr = g.hr, x = g.cx, y = g.hy;
    var col = ACT_COL[act];
    var awake = act !== 2;

    // tail of the thought bubble
    for (var i = 0; i < 3; i++) {
      var t = (i + 1) / 4;
      var ty = g.by1 + (y - hr - g.by1) * t + 2 * S;
      ctx.beginPath();
      ctx.arc(x, ty, (1.6 + i * 1.1) * S, 0, 6.2832);
      ctx.fillStyle = act === 2 ? 'rgba(' + COL.dream.join(',') + ',0.6)'
                                : ink(0.24);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(' + col.join(',') + ',' + (act === 3 ? 0.3 : 0.14) + ')';
    ctx.shadowBlur = (act === 3 ? 14 : 7) * S;

    // antenna
    ctx.strokeStyle = 'rgba(' + col.join(',') + ',0.8)';
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath(); ctx.moveTo(x, y - hr * 0.78); ctx.lineTo(x, y - hr * 1.22); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - hr * 1.3, 2.6 * S, 0, 6.2832);
    ctx.fillStyle = 'rgb(' + col.join(',') + ')'; ctx.fill();

    // head
    roundRect(x - hr, y - hr * 0.78, hr * 2, hr * 1.5, hr * 0.42);
    ctx.fillStyle = 'rgba(' + PAPER + ',0.96)';
    ctx.fill();
    ctx.lineWidth = 1.6 * S;
    ctx.strokeStyle = 'rgba(' + col.join(',') + ',0.85)';
    ctx.stroke();
    ctx.restore();

    // eyes: open while acting, shut while dreaming
    var ex = hr * 0.42, ey = y - hr * 0.04, er = hr * 0.17;
    ctx.fillStyle = 'rgb(' + col.join(',') + ')';
    ctx.strokeStyle = 'rgb(' + col.join(',') + ')';
    ctx.lineWidth = 1.7 * S;
    for (var s = -1; s <= 1; s += 2) {
      if (awake) {
        ctx.beginPath(); ctx.arc(x + s * ex, ey, er, 0, 6.2832); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(x + s * ex, ey - er * 0.3, er * 1.15, 0.45, Math.PI - 0.45);
        ctx.stroke();
      }
    }

    // mouth / status bar
    ctx.fillStyle = 'rgba(' + col.join(',') + ',0.45)';
    var mw = hr * 0.7 * (act === 0 ? 0.5 + 0.5 * Math.abs(Math.sin(clock * 5)) : 1);
    ctx.fillRect(x - mw / 2, y + hr * 0.4, mw, 2.2 * S);

    // shoulders
    ctx.beginPath();
    ctx.moveTo(x - hr * 1.18, y + hr * 1.28);
    ctx.quadraticCurveTo(x, y + hr * 0.6, x + hr * 1.18, y + hr * 1.28);
    ctx.lineWidth = 2 * S;
    ctx.strokeStyle = 'rgba(' + col.join(',') + ',0.55)';
    ctx.stroke();

    if (!awake) {                                   // z z z
      for (var k = 0; k < 3; k++) {
        var p = ((clock * 0.55 + k * 0.33) % 1);
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
        ctx.font = ((7 + k * 2.5) * S).toFixed(1) + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(' + COL.dream.join(',') + ',1)';
        ctx.fillText('z', x + hr * 0.9 + k * 5 * S, y - hr * 0.5 - p * hr * 1.5);
      }
      ctx.globalAlpha = 1;
    }

    label('π' + (act === 3 ? round + 1 : round), x, y + hr * 1.72,
          act === 3 ? 'rgba(' + COL.win.join(',') + ',0.95)' : ink(0.62), 'center');
  }

  /* ---- the arrows that close the loop ---- */

  function dashFlow(on) { ctx.setLineDash([5 * S, 5 * S]); ctx.lineDashOffset = on ? -clock * 26 : 0; }

  function drawArrows(act, u) {
    var g = geom();
    var stageX = PAD.l - 26 * S;
    var mid = (g.bx1 + stageX) / 2;               // the corridor between head and stage

    // 1. archive: the finished tree is filed into the head. Runs along the top
    //    of the corridor, pointing left.
    var on1 = act === 1;
    var ay = H * 0.235, sx1 = stageX - 3 * S, ex1 = g.bx1 + 3 * S;
    ctx.save();
    ctx.lineWidth = (on1 ? 2.2 : 1.2) * S;
    ctx.strokeStyle = on1 ? ink(0.8) : ink(0.17);
    dashFlow(on1);
    ctx.beginPath();
    ctx.moveTo(sx1, ay);
    ctx.bezierCurveTo(mid + 6 * S, ay, mid - 6 * S, ay - 13 * S, ex1, ay - 13 * S);
    ctx.stroke();
    ctx.setLineDash([]);
    arrowHead(ex1 - 2 * S, ay - 13 * S, Math.PI, 5.2 * S,
              on1 ? ink(0.8) : ink(0.26));
    ctx.restore();
    var room = stageX - g.bx1;
    if (room > 40) label('store', mid, ay - 26 * S,
          on1 ? ink(0.85) : ink(0.4), 'center');

    // 2. deploy: the agent acts on the real world. Runs along the bottom,
    //    pointing right into the root of the tree it is about to grow.
    var on0 = act === 0;
    var rootY = tree ? py(tree.nodes[0]) : H * 0.5;
    var sx0 = g.cx + g.hr + 6 * S, sy0 = g.hy - g.hr * 0.35, ex0 = PAD.l - 14 * S;
    ctx.save();
    ctx.lineWidth = (on0 ? 2.2 : 1.2) * S;
    ctx.strokeStyle = on0 ? 'rgba(' + COL.real.join(',') + ',0.95)' : ink(0.17);
    dashFlow(on0);
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.bezierCurveTo(mid, sy0, mid, rootY, ex0, rootY);
    ctx.stroke();
    ctx.setLineDash([]);
    arrowHead(ex0 + 3 * S, rootY, 0, 5.2 * S,
              on0 ? 'rgba(' + COL.real.join(',') + ',0.95)' : ink(0.26));
    ctx.restore();
    if (room > 40) label('explore', mid, (sy0 + rootY) / 2,
          on0 ? 'rgba(' + COL.real.join(',') + ',0.95)' : ink(0.4), 'center');
  }

  // during the dream the stage is not the world any more — it is the head
  function drawStageFrame(act) {
    var x = PAD.l - 26 * S, y = H * 0.045, w = W - x - 5 * S, h = H * 0.86;
    var dreaming = act >= 2;
    roundRect(x, y, w, h, 12 * S);
    ctx.lineWidth = 1.2 * S;
    if (dreaming) {
      ctx.setLineDash([5 * S, 4.5 * S]);
      ctx.strokeStyle = 'rgba(' + COL.dream.join(',') + ',0.45)';
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = ink(0.14);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    label(dreaming ? 'ℋ' + round + ' REPLAY SIMULATOR · ZERO EXECUTION COST'
                   : 'ONLINE · EVERY NODE IS ONE AGENT CALL',
          x + 12 * S, y + 11 * S,
          dreaming ? 'rgba(' + COL.win.join(',') + ',0.85)' : ink(0.5));
  }

  function drawTree(act, u) {
    var nodes = tree.nodes, i, n, par;

    // how "put away" the tree looks: live during deploy, archived afterwards
    var stored = act === 0 ? 0 : act === 1 ? u : 1;

    for (i = 1; i < nodes.length; i++) {
      n = nodes[i];
      if (act === 0 && clock < n.birth - 0.34) continue;
      par = nodes[n.p];
      var grow = act === 0 ? ease((clock - (n.birth - 0.34)) / 0.34) : 1;
      var dim = 0.38 - 0.18 * stored;
      ctx.save();
      ctx.strokeStyle = ink(dim);
      ctx.lineWidth = 1.1 * S;
      if (grow < 1) {
        // draw only the grown fraction by clipping to a sweeping band
        var x1 = px(par), x2 = px(n);
        ctx.beginPath();
        ctx.rect(Math.min(x1, x2) - 2, 0, Math.abs(x2 - x1) * grow + 2, H);
        ctx.clip();
      }
      edgePath(par, n);
      ctx.stroke();
      ctx.restore();
    }

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      var age = clock - n.birth;
      if (act === 0 && age < 0) continue;
      var pop = act === 0 ? ease(age / 0.3) : 1;
      var r = (2.4 + 5.4 * n.score) * S * (0.6 + 0.4 * pop);
      var x = px(n), y = py(n);

      // birth ring — the moment a node was actually executed
      if (act === 0 && age >= 0 && age < 0.7) {
        var ru = age / 0.7;
        ctx.beginPath();
        ctx.arc(x, y, r + ru * 16 * S, 0, 6.2832);
        ctx.strokeStyle = 'rgba(' + COL.real.join(',') + ',' + (0.32 * (1 - ru)) + ')';
        ctx.lineWidth = 1.2 * S;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      if (stored > 0.5 && n.score < 0.75) {
        ctx.fillStyle = 'rgba(' + PAPER + ',0.9)';
        ctx.fill();
        ctx.strokeStyle = scoreColor(n.score);
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.2 * S;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = scoreColor(n.score);
        ctx.globalAlpha = act >= 2 ? 0.75 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawScan(u) {
    var x = PAD.l - 30 + u * (W - PAD.l - PAD.r + 70);
    var g = ctx.createLinearGradient(x - 70, 0, x + 12, 0);
    g.addColorStop(0, 'rgba(' + COL.real.join(',') + ',0)');
    g.addColorStop(1, 'rgba(' + COL.real.join(',') + ',0.20)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, 0, 82, H);
    ctx.fillStyle = 'rgba(' + COL.real.join(',') + ',0.7)';
    ctx.fillRect(x, 0, 1.2, H);
  }

  // One in-flight replay, drawn as the subtree it actually covers. Its branches
  // advance together on a shared clock, because that is what they are: attempts
  // the policy chose to keep alive at the same time, not a route walked in
  // sequence. Each branch therefore gets its own comet head.
  function drawDreams() {
    var nodes = tree.nodes;
    for (var i = 0; i < dreams.length; i++) {
      var d = dreams[i];
      var life = d.u;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = BLEND;

      for (var ci = 0; ci < d.chains.length; ci++) {
        var ch = d.chains[ci];
        var segs = ch.length - 1;
        if (segs < 1) continue;
        var headSeg = Math.min(segs - 1, Math.floor(life * segs));
        var tail = 0.34;

        for (var sgi = 0; sgi <= headSeg; sgi++) {
          var a = nodes[ch[sgi]], b = nodes[ch[sgi + 1]];
          var segStart = sgi / segs, segEnd = (sgi + 1) / segs;
          var to = clamp((life - segStart) / (segEnd - segStart), 0, 1);
          var from = clamp((life - tail - segStart) / (segEnd - segStart), 0, 1);
          if (to <= from) continue;
          ctx.beginPath();
          var steps = 10;
          for (var s2 = 0; s2 <= steps; s2++) {
            var p = edgePoint(a, b, from + (to - from) * (s2 / steps));
            if (s2 === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          var alpha = d.alpha * (0.25 + 0.75 * (sgi + 1) / (headSeg + 1));
          ctx.strokeStyle = 'rgba(' + COL.dream[0] + ',' + COL.dream[1] + ',' + COL.dream[2] + ',' + alpha.toFixed(3) + ')';
          // a wide replay draws more ink than a narrow one, so thin the strokes
          // as it widens or the stage turns into a violet wash
          ctx.lineWidth = (d.good ? 2.1 : 1.15) * S / (1 + 0.22 * (d.chains.length - 1));
          ctx.stroke();
        }

        if (life <= 1.02) {
          var ha = nodes[ch[headSeg]], hb = nodes[ch[headSeg + 1]];
          var hp = edgePoint(ha, hb, clamp((life - headSeg / segs) * segs, 0, 1));
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, (d.good ? 2.6 : 1.7) * S, 0, 6.2832);
          ctx.fillStyle = 'rgba(' + COL.win.join(',') + ',' + (d.alpha * 0.9).toFixed(3) + ')';
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // The winning version, lit over the frozen tree: every branch it opened, not
  // just the one that happened to hold the best node.
  function drawBestSubtree(strength) {
    if (!bestDream) return;
    var nodes = tree.nodes, cs = bestDream.chains, ci, i;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(' + PAPER + ',1)';      // knock the tree out behind it
    ctx.shadowBlur = 7 * strength;
    ctx.strokeStyle = 'rgba(' + COL.win.join(',') + ',' + (0.45 + 0.5 * strength).toFixed(3) + ')';
    ctx.lineWidth = (1.6 + 1.6 * strength) * S;
    ctx.setLineDash([9 * S, 7 * S]);
    ctx.lineDashOffset = -clock * 34;
    for (ci = 0; ci < cs.length; ci++)
      for (i = 0; i < cs[ci].length - 1; i++) { edgePath(nodes[cs[ci][i]], nodes[cs[ci][i + 1]]); ctx.stroke(); }
    ctx.restore();

    ctx.save();
    // the root is in every chain, so mark each node once
    var done = {};
    for (ci = 0; ci < cs.length; ci++) {
      for (i = 0; i < cs[ci].length; i++) {
        if (done[cs[ci][i]]) continue;
        done[cs[ci][i]] = 1;
        var n = nodes[cs[ci][i]];
        ctx.beginPath();
        ctx.arc(px(n), py(n), (3.4 + 4.2 * n.score) * S, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + COL.win.join(',') + ',' + (0.25 + 0.6 * strength).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ hud -- */

  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };

  // The point of the outer loop: every lap should leave the policy better than
  // it found it, so each finished round is kept as a bar in the rail.
  function closeRound() {
    if (bestDream) carry = { pts: chainPts(bestDream.chains), ret: bestDream.ret, best: true, solo: true };
    rounds.push({ deploy: stats.best, dream: Math.max(stats.best, stats.next) });
    while (rounds.length >= SLOTS) rounds.shift();   // always leave the live slot free
  }

  var SLOTS = 8;

  function renderRounds() {
    while (rbarEls.length < SLOTS) {
      var bar = document.createElement('i');
      bar.appendChild(document.createElement('b'));
      el.rbars.appendChild(bar); rbarEls.push(bar);
    }
    var live = rounds.length;                        // the round in flight
    for (var i = 0; i < SLOTS; i++) {
      var state = i < live ? 'done' : i === live ? 'live' : 'todo';
      var r = i < live
        ? rounds[i]
        : { deploy: stats.best, dream: Math.max(stats.best, stats.next) };
      var h = state === 'todo' ? 0 : clamp(r.dream, 0, 1);
      rbarEls[i].style.height = (3 + h * 97).toFixed(1) + '%';
      rbarEls[i].firstChild.style.height = state === 'todo'
        ? '0%' : (100 * clamp(r.deploy / (h || 1), 0, 1)).toFixed(1) + '%';
      rbarEls[i].setAttribute('data-state', state);
    }
  }

  function updateHud(act, u) {
    if (act !== lastAct) {
      lastAct = act;
      el.actName.textContent = ACTS[act].name;
      for (var c = 0; c < el.chips.length; c++)
        el.chips[c].setAttribute('aria-current', c === act ? 'true' : 'false');
      root.setAttribute('data-phase', ACTS[act].key);
    }
    el.round.textContent = 'round t = ' + round;

    el.evals.textContent = fmt(stats.evals);
    el.roll.textContent = fmt(stats.roll);
    el.best.innerHTML = act >= 2
      ? stats.best.toFixed(3) + ' <b>&rarr; ' + stats.next.toFixed(3) + '</b>'
      : stats.best.toFixed(3);

    renderRounds();
  }

  /* ----------------------------------------------------------------- loop -- */

  function step(act, u, dt) {
    var nodes = tree.nodes, i;

    if (act === 0) {
      var n = 0, top = 0;
      for (i = 0; i < nodes.length; i++) {
        if (clock >= nodes[i].birth) { n++; if (nodes[i].score > top) top = nodes[i].score; }
      }
      stats.evals = n;
      stats.best = clamp(top - LAMBDA * n, 0, 1);
      stats.next = stats.best;
    }

    if (act === 2) {
      // ---- the offline phase: REVS successive code revisions of the policy
      var m = Math.min(REVS - 1, Math.floor(u * REVS));
      while (frames.length <= m) addRevision(frames.length);
      revIdx = m;
      // pi_(t+1) is picked from the revisions, so the winner is a whole version,
      // not the single luckiest replay
      for (i = 0; i < frames.length; i++) {
        if (!frames[i].best) continue;
        if (!bestDream || frames[i].ret > bestDream.ret) bestDream = frames[i];
        stats.next = Math.max(stats.next, frames[i].ret);
      }

      // Each version is replayed over every tree in the history, and a replay
      // costs nothing, so the counter runs at the real rate (thousands per
      // second) while only a readable sample is actually drawn on the stage.
      var rate = 90 + 2700 * ease(u * 1.2);
      var want = rate * dt;
      var count = Math.floor(want) + (dreamRnd() < (want % 1) ? 1 : 0);
      var visWant = (5 + 42 * ease(u * 1.3)) * dt;
      var visLeft = Math.floor(visWant) + (dreamRnd() < (visWant % 1) ? 1 : 0);
      for (i = 0; i < count; i++) {
        var r = rollout(dreamRnd, clamp(revGreed + gauss(dreamRnd) * 0.5, 0.05, 2.6));
        if (r.n < 2) continue;
        stats.roll++;
        var good = r.ret >= (bestDream ? bestDream.ret : 1) - 0.005;
        if ((visLeft > 0 || good) && dreams.length < 68) {
          visLeft--;
          dreams.push({ chains: r.chains, u: 0, alpha: 0.55 + (good ? 0.4 : 0), good: good,
                        speed: 1.5 + dreamRnd() * 1.3 });
        }
      }
    }

    // advance and retire the in-flight replays
    for (i = dreams.length - 1; i >= 0; i--) {
      var d = dreams[i];
      d.u += dt * d.speed;
      if (d.u > 1.35) dreams.splice(i, 1);
      else if (d.u > 1) d.alpha *= Math.pow(0.02, dt);
    }
    if (act === 3) { for (i = dreams.length - 1; i >= 0; i--) dreams[i].alpha *= Math.pow(0.05, dt); }
  }

  function draw(act, u) {
    ctx.clearRect(0, 0, W, H);
    drawStageFrame(act);
    drawArrows(act, u);
    drawTree(act, u);
    if (act === 1) drawScan(u);
    if (act >= 2) drawDreams();
    if (act === 2 && u > 0.35) drawBestSubtree((u - 0.35) / 0.65 * 0.45);
    if (act === 3) drawBestSubtree(0.45 + 0.55 * ease(u * 2.2));
    drawBubble(act, u);
    drawRobot(act, u);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!W) resize();
    if (!W) return;

    if (playing && visible) {
      clock += dt * speed;
      if (clock >= TOTAL) {
        clock -= TOTAL;
        closeRound();
        round++;
        resetRound(round);
        lastAct = -1;
      }
    }

    var act = 0;
    for (var i = ACTS.length - 1; i >= 0; i--) if (clock >= STARTS[i]) { act = i; break; }
    var u = clamp((clock - STARTS[act]) / ACTS[act].dur, 0, 1);

    if (playing && visible) step(act, u, dt * speed);
    draw(act, u);
    updateHud(act, u);
  }
  var last = 0, raf = 0;

  /* ------------------------------------------------------------- controls -- */

  function setPlaying(v) {
    playing = v;
    el.play.setAttribute('aria-label', v ? 'Pause' : 'Play');
    root.setAttribute('data-playing', v ? 'true' : 'false');
  }
  el.play.addEventListener('click', function () { setPlaying(!playing); });

  el.speed.addEventListener('click', function () {
    speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
    var label = (speed === 0.5 ? '0.5' : speed) + '\u00d7';
    el.speed.textContent = label;
    // visible label first, so speech-input tools match on it
    el.speed.setAttribute('aria-label', label + ', playback speed');
  });

  el.chips.forEach(function (chip, i) {
    chip.addEventListener('click', function () {
      // rebuild from the top of the round so the state matches the act we jump to
      resetRound(round);
      clock = 0; lastAct = -1;
      var target = STARTS[i] + 0.001;
      var guard = 0;
      while (clock < target && guard++ < 4000) {
        var dt = 1 / 60;
        var a = 0;
        for (var k = ACTS.length - 1; k >= 0; k--) if (clock >= STARTS[k]) { a = k; break; }
        step(a, clamp((clock - STARTS[a]) / ACTS[a].dur, 0, 1), dt);
        clock += dt;
      }
      setPlaying(true);
    });
  });

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; },
      { threshold: 0.15 }).observe(root);
  }

  resize();
  setPlaying(!reduced);
  if (reduced) {
    // one representative still: mid-dream, no motion
    clock = STARTS[2] + ACTS[2].dur * 0.75;
    step(0, 1, 1 / 60);                       // so the online stats are not zero
    for (var w = 0; w < 260; w++) step(2, (w / 260) * 0.75, 1 / 60);
    clock += 1;                               // past every frame's pop-in stamp
    var a0 = 2, u0 = 0.75;
    draw(a0, u0); updateHud(a0, u0);
    // the still is painted once, so it has to be repainted when the webfont
    // arrives --
    // otherwise every label was measured against the fallback face
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(function () { resize(); draw(a0, u0); });
  }
  raf = requestAnimationFrame(frame);
})();
