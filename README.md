# dream-rsi.com

**Dream-RSI: Recursive Self-Improvement through Evolving Worlds** 的论文项目主页。
纯静态，无构建步骤、无框架依赖（只有 MathJax 走 CDN）。

```
dream-rsi-site/
├── index.html      # 全站内容
├── styles.css      # 设计 token 在最顶上，明/暗两套，整站跟着变
├── script.js       # 主题开关、滚动渐显、BibTeX 复制、导航高亮
├── dream.js        # 「做梦」动画：canvas 画的 agent 和它脑子里的策略版本，无视频文件
├── 404.html
├── robots.txt / sitemap.xml
└── assets/
    ├── dream-rsi.pdf              # 论文 PDF（Paper 按钮指向它）
    ├── fig1-overview.png          # Figure 1，从 PDF 200 dpi 渲染裁切
    ├── fig2-simulator.png         # Figure 2
    ├── fig3-lasso-dynamics.png    # Figure 3(b)
    ├── fig4-kernels.png           # Figure 4
    ├── fig6-evolution.png         # Figure 6
    └── favicon.svg
```

## 视觉风格

参考 [envharness.com](https://envharness.com/) 的排版体系做的，三种字体各有各的岗位，
不许串台（`styles.css` 最上面那段注释就是这个约定）：

| 变量 | 字体 | 用在哪 |
|---|---|---|
| `--display` / `--sans` | Google Sans Flex | 标题、导航、按钮、正文 |
| `--read` | Literata | `.lead` / `.abstext` / `figcaption` —— 只给长文阅读，不给界面 |
| `--mono` | Google Sans Code | `.eyebrow` / `.secno` / 数字 / 表头 / 代码 / BibTeX |

字号越大字距越紧（`.papertitle -.026em`、`h2 -.022em`），mono 的界面文字反过来放宽
（`+.03em ~ +.15em`）；所有数字都带 `font-variant-numeric: tabular-nums`。
正文 16.5px/1.7 是无衬线，衬线只出现在导语、摘要和图注里。

**明暗两套**是 `<html data-theme="light|dark">` 切的，不是 `prefers-color-scheme`
—— 右上角有个按钮，选择存在 `localStorage` 的 `dreamrsi-theme` 里。
首屏闪烁靠 `<head>` 里那段内联脚本在首次绘制前就把 `data-theme` 写好。
唯一不能靠 CSS 变量自动跟随的是 canvas，所以 `script.js` 切主题时会
`dispatchEvent(new CustomEvent('themechange'))`，`dream.js` 收到后重建调色板
（见下一节）。

`--ink-3` 比参考站略深/略浅了一档（`#6A7079` / `#7D8794`），否则 10–13px 的小字
过不了 4.5:1。浅色这档取 `#6A7079` 而不是更浅的 `#6F767F`，是因为卡片有底色：
同一个灰在纯白上是 4.99:1，在 `.mitem` / `.dr-stats` 的浅灰面板上只剩 4.40:1。
其余 token 与参考站一致。

区块结构统一是 `.sec > .sec-head > .secno + h2 + .lead`，`.secno` 是 `01 — THE IDEA`
这样的 mono kicker，后面拖一条渐隐的横线；图注前缀 `.fnum` 同理。
`.rv` 是滚动渐显，`prefers-reduced-motion: reduce` 时直接全部显示。

### 排版的三条规矩

这三条是后来重排版面时定下来的，改样式时别破坏：

**一、读的东西只有一个栏宽。**（宽度后来改成 800px 并加了居中，见下面「两个尺度，一根轴」。）
`--measure` 管住所有在行文里读的段落
——`.lead`、`.abstext`、`.prose p`、`.callout`、`.bib`、MathJax 的行间公式。
在此之前它们各是 760 / 860 / 940 / 1180，一页上四种栏宽，看着就是"差一点"。
摘要原来还是 `text-align: justify` 的 860px，一行 118 个字符、词距被拉到自然宽的
2.5 倍；现在左对齐、右边自然参差。

**二、图注的宽度 = 它所说明的那个东西的宽度。** `figcaption` / `.figcap` 不设
`max-width`，宽度由它所在的 `<figure>` 决定。原来写死 940px，而图版是 1128px，
于是每条图注每一行都提前 188px 换行（首屏那张提前 240px），看起来像没排完。
`.figure-narrow` 是把 `<figure>` 本身收到 660px，图注跟着一起收——不要去给图注
单独设宽度，那样两者必然对不齐。参考站的 `figcaption` 也是一个 `max-width` 都没设。

**三、每个区块标题后面只有一个节奏。** `.sec-head { margin-bottom: 38px }`，
靠外边距合并（margin collapsing）跟区块里第一个元素的上边距取大值，所以
`.kcards` 的 34px、`.dreamer` 的 26px、`.abstext` 的 16px、`.bib` 的 26px 全都被
它吸收成同一个 38px，不用为每个区块单独写规则。同理 `.res-h`（小标题）统一
`50px / 18px`，后面紧跟图时用 `.res-h + figure { margin-top: 0 }` 让图版自己的
上边距让位。

还有几处是同一类毛病，一起修了：

- `h3` / `h4` / `.res-h` 显式 `line-height: 1.3`。标题不该继承 body 给阅读用的 1.7。
- `.navbtn` 和 `.tbtn` 都钉死 `height: 32px` + `inline-flex`。`<a>` 继承 body 的 1.7
  行高、`<button>` 拿的是 UA 的 `normal`，不钉高度这两个胶囊就是 37.25 和 30。
- `thead th.num` 要显式写字号：`.num` 的特指度 (0,1,0) 会盖过 `thead th` 的 (0,0,2)，
  表头于是一行里出现两种字号。
- 表格的说明文字用 `<p class="tbl-cap">` 放在 `.table-scroll` **外面**，靠
  `aria-describedby` 跟 `<table>` 关联。放里面的话它会跟着表格一起横向滚走。
- 作者名和 `College Park` 里的空格都是 `&nbsp;`，防止在名和姓之间断行。
  标语和 `.mitem span` 用 `text-wrap: balance`，正文段落用 `text-wrap: pretty`。
- 首屏 `.hero` 的左右内边距和 `.sec` 对齐（桌面 26px、窄屏 18px），`.herofigs`
  是 1128px（= `.sec` 的内容宽），否则首屏那张图会比后面每一张都往外探出 26px。
- 首屏那句标语要在桌面**排成一行**。字号 25px / `max-width: 1000px` 是量出来的：
  整句在 25px 下自然宽 972px，刚好进 1000 的框，并且一直到 ~820px 视口都还是一行；
  27px 时是 1045px，放得下，但会比 1020px 的标题还宽，主次就倒了。改动标语文字后
  必须重新量（克隆节点、`white-space: nowrap; max-width: none`，读 `offsetWidth`）。
- 标语里每一句各包一层 `<span class="s">`（`display: inline-block`）。窄屏放不下
  两句时，断行就落在句号处，而不是把 “recursively / self-improve” 劈开；宽屏两句
  仍然同一行，手机上每句自己再内部折行。

### 版式：两个尺度，一根轴（2026-09-14）

页面上任何一块只能是两个宽度之一，而且**两个都居中**：

- **阅读尺度** `--measure: 800px` —— lead / abstext / prose / callout / 公式 / bib / `.sec-head`
- **满宽** `.sec` 的 1128px —— figure、表格、kcards、demo、`.mgrid`、`.res-h`

实现就是 `.sec > *, .sec-head { margin-inline: auto; }` 加上 `--measure`。

之前是 760 的正文**左对齐**塞在 1180 的 section 里，下面的图又拉满宽：
一页上出现 760 / 860 / 1128 三条互不相干的右边界，正文右边三分之一全是死白，
图一到就突然冲出去。看上去像没排过版，其实每一块单独看都没问题——问题只在右边界。
所以改任何一块的 `max-width` 前先问：它是阅读尺度还是满宽？没有第三种。
（`.figure-narrow` 660 是唯一例外，它也是居中的，所以不破坏轴。）

### 章节主线（2026-09-14 重排）

页面的骨架是一条论证线，不是论文目录的镜像。改任何一节前先确认它还在自己的位子上：

| # | id | 承担什么 |
|---|---|---|
| 01 | `#idea` | **问题**一段讲完（lead），**idea** 单独进一个 `.callout` 框 |
| 02 | `#insight` | 核心洞察：History is *already* a simulator；Figure 2 放这一节 |
| 03 | `#method` | The RSI loop on the meta-exploration layer（只有公式和正文，交互图已下线） |
| 04 | `#demos` | 只有那个 live dreaming loop（per-task 录屏已下线） |
| 05 | `#results` | Highlight results：三个大数字打头，再上表和图 |
| 06 | `#analysis` | | 
| 07 | `#cite` | |

- **§02 顶掉了原来的 Abstract**（`id` 从 `#abstract` 改成 `#insight`，导航文案 Abstract → Insight）。
  原摘要第一段是「问题」，已并进 §01 的 lead；第二段是「系统」，留在 §02 结尾当收口。
  正式摘要现在只在 PDF 里。
- **Figure 2 在 §02，不在 §03。** 它画的是「历史 = 重放模拟器」这个洞察本身，
  跟 §02 的论证是同一句话；§03 只留那张交互图（讲 loop 怎么转）。两张放一起会互相抵消。
  插入点在第二段 abstext 之后、「Dream-RSI is what falls out of that」之前——
  先讲清洞察，看图，再落到系统。
- §01 的三张 kcard **不要**再出现 "History as a simulator"——那是 §02 一整节的标题，
  重复了就等于把洞察提前剧透一遍还讲得更浅。现在三张卡是三个**别的**性质：
  off-policy / agent 不动 / 不会退化。
- 三个大数字（2.43× / 2.09× / 162×）从 §01 移到了 §05 开头。§01 讲问题和 idea，
  不该用结果收尾。

### dreaming 时重放的是子树，不是一条路径（2026-09-14）

`dream.js` 的 `rollout()` 返回 `{chains, n, ret}`，不再是 `{path, ret}`：

一个 exploration policy 不是寻路器。它决定**从根开哪几条分支、哪几条并行养着、
各自什么时候停**——所以一次 replay 覆盖的是录好的树的一个**连通子树**，
并且要为里面**每一个**节点付费（`ret = best − LAMBDA × n`）。
原来画成一条路径，等于把重放的开销少算了，也把「并行分支」这个决策维度整个抹掉了。

- `greed` 同时驱动两个旋钮，方向相反：贪的 policy 开的分支少、扎得深；
  怂的铺得宽、扎得浅。这是替代 policy 之间真正的差别，也是分数能拉开的原因。
- 选分支只能看**第一个节点**的分数。`node.sub`（子树最优）是事后视角，
  `rollout()` 里任何地方都不许读它——读了就是作弊。
- 根以下不分叉（`A(T)={r}∪{leaves}` 的直接后果），所以延长一条链是单选：继续或砍掉。
- 画法：`chainPts()` 返回折线数组；一次 replay 的所有分支**共用一个时钟**推进，
  每条分支各有一个彗星头——它们是同时活着的尝试，不是依次走过的路线。
  分支越多线越细（`/(1 + .22*(chains-1))`），否则舞台会糊成一片紫。
- `drawBestSubtree()`（原 `drawBestPath`）点亮赢家开过的**每一条**分支，
  不只是碰巧含最优节点的那条；根在每条链里都出现，画节点时要去重。
- 图注里那句 "what it covers is a subtree … charged for every node in it" 是手写的，
  跟这套语义绑死，改 `rollout()` 就要回头看它。

### archive/ 里躺着什么

`archive/` 不进页面，也不被任何东西引用，留着是因为重做一遍代价很大：

- **`per-task-tabs.html` + `demos.css` + `tabs.js`** —— §04 那四个 per-task recording 标签页
  （ConvDiv / VGG16 / Lasso / Circle packing，2026-09-14 下线）。里面的 `.screen` 占位框一直是空的，
  真录屏从来没做。`.screen` 这条规则留在 `styles.css` 里没删，因为 live dreaming loop 的
  `.dr-screen` 还挂在它上面；其余 `.tablist` / `.demo` / `.demo-meta` / `.stats` 全部移走了。
  §04 现在只有那个 live loop。
- **`replay.js` + `replay.css` + `fig-replay.html`** —— §03 那张「一次录制、四个 policy 重放」
  的交互图（2026-09-14 按要求下线）。要装回去：把 html 片段插回 `#method`、
  css 追加到 `.dr-*` 那一段之后、`index.html` 末尾加回 `<script src="replay.js">`。
  下面这段是它的设计约束，改任何一条之前先读：

### 重放模拟器那张交互图（`replay.js`，§03 `#fig-replay`）

这张图不是动画，是**真的在跑模拟**。树是数据，四个 policy 是真的决策函数，
访问顺序和右栏的数字全是 `replay()` 跑出来的——改一个分数，结论跟着变。
这是一张自称"模拟"的图唯一诚实的做法，不要退化成手写死的关键帧。

- 树的形状受方法约束：可继续的只有根和当前叶子，`A(T) = {r} ∪ {leaves}`，
  所以录下来的树是**挂在一个根上的若干条链**，不是任意分叉树。三条链长度不等，
  因为各自的停止规则在不同时候触发。
- 分数是编出来的，但形状是论点：A 前期最好然后停滞（陷阱）、B 起步最差收尾最好
  （奖品）、C 一直没起色（浪费）。改分数前先想清楚这三个角色还在不在，
  否则 greedy 会莫名其妙赢，整张图就白做了。
- 四条结论（13 / 11 / 14 / 10 次 continue 到 0.86）**不要写死在 HTML 里**，
  它们是模拟出来的，图注里引用的 "10 continues instead of 13" 才是手写的——
  改数据就要回头改图注。
- 用 inline SVG 不用 canvas：颜色全部走 CSS 变量，深色模式不需要重绘钩子。
  `dream.js` 那个是 canvas，所以它要监听 `themechange`，这个不用。
- 语义配色沿用全站约定：`--env` 蓝＝花了钱的（online），`--mid` 紫＝白嫖的
  （replay）。`.is-paid` / `.is-dreamt` 两个类扛着整个论点。
- 控件复用了 `.dr-play` / `.dr-speed` 的样式类，所以**页面上有两个 `.dr-speed`**。
  写测试时要用 `.dreamer .dr-speed` 限定，否则点到的是 §03 这张图
  （`/tmp/eh_verify.py` 踩过这个坑）。播放状态挂在 `#fig-replay` 上而不是
  `.rsim` 上，因为控件是 `.rsim` 的兄弟节点，不在它里面。
- ≤620px 时棋盘横向滚动、SVG 给 `min-width: 520px`：再缩下去节点里的分数就看不清了，
  这个代价比滚动大。页面本身不溢出。

### 机构 logo

首屏 eyebrow 和标题**之间**那一条是四个机构的**主标志**（primary logo，带徽记的那版，
不是纯文字 wordmark），源文件在 `assets/logos/`。UMD 和 UVA 直接取自校方
品牌站自己的 CDN，不是 Wikimedia 的二手字标——后者在 Google 彩色标和
DeepMind 漩涡旁边只像一行衬线字，立不住：

| 文件 | 来源 | viewBox |
|---|---|---|
| `google.svg` | Wikimedia, File:Google 2015 logo.svg | `0 0 272 92` |
| `deepmind.svg` | Wikimedia, File:Google DeepMind logo.svg | `0 0 2201 363` |
| `umd.svg` | `umd-main.files.svdcdn.com/…/default/primary-logo-dark.svg` | `0 0 314 50` |
| `uva.svg` | `brand.virginia.edu/…/images/uva_logo_footer.svg` | `0 0 218.19 52.74` |

标志本身是各机构的商标，这里属于标明作者单位的指名使用。

**不要给它加底板或者边框。** 中途试过白底卡片（`background:#FFFFFF` + hairline 边 +
圆角），浅色下等于看不见，深色下就是一块悬空的白砖，反而更像个「框」。
现在 `.orgs` 是全透明的，标志直接压在页面上：浅色页本身就是白底，满足品牌规范；
深色下字标跟着 `var(--ink)` 变浅，徽记保留品牌色，实测不刺眼。

**为什么是内联 sprite 而不是 `<img>`。** UMD、UVA 和 DeepMind 的文字部分都改成了
`fill="currentColor"`，所以跟着 `.orgs` 的 `color`（= `var(--ink)`）走主题；徽记部分
保留品牌色：UMD 的 `#E03A3E`/`#FFD520`，UVA 的 `#F37C20`。
`<img src="xxx.svg">` 做不到——外部 SVG 是独立文档，不继承页面的
`color`。所以四个标志放在 `index.html` 末尾的一个 `<svg class="logo-sprite">` 里做成
`<symbol>`，首屏用 `<use href="#lg-umd">` 引用。顺带也省掉四个首屏请求。
改完源文件后跑 `/tmp/build_sprite.py` 重建 sprite，它会顺带同步首屏 `<svg>` 的
`width`/`height`/`viewBox`——只给 CSS 高度、不给这三个属性的话，内联 SVG 会按 300px 默认宽度铺开。

**为什么在标题上面。** 论文页的惯例是把 logo 放在单位脚注下面，但那样第一眼
看到的是标题，机构要往下找。这里的取舍是「一眼看出是谁做的」优先，所以把整条
提到 eyebrow 和标题之间——eyebrow 里原来的 `· GOOGLE` 也就跟着删了，
正下方就是 Google 的标，重复。

排版上这条是 `width:fit-content` 居中，一行实测 940px，页面左右各留 26px 槽，
所以折叠断点是 **1000px**（不是按估算拍的，改 logo 尺寸后要重新量）。
≤1000px 折成 2×2 并关掉竖线；≤560px 时最宽的 UMD 已经塞不进自己那一列，
改成等宽列 + `.lg{width:100%}`：给定高度再加 `width:100%` 是「装进盒子」不是
「拉伸」，`preserveAspectRatio` 仍然生效。

处理源文件时踩到的两个坑，改的时候注意：

1. **不要删 `id`。** DeepMind 的漩涡是 `fill:url(#_Linear1)`，把 `id="_Linear1"`
   当成冗余属性清掉，漩涡就整个不画了（只剩文字）。
2. **不要压 UMD / UVA 的坐标精度。** 这两条路径用的是小写（相对）指令，
   每个坐标四舍五入的误差会沿路径累积；压到两位小数时字形直接散架，
   "UNIVERSITY OF MARYLAND" 只剩下几个残缺字母。已经用 Playwright 逐像素比过，
   现在的文件跟原始文件在 44px 和 132px 下渲染结果逐字节相同。

排布上 `.orgs` 是一行 flex + 发丝分隔线；整行需要约 916px，所以 940px 以下切成
两列 grid 并去掉分隔线——否则换行后的第二行会以一条悬空的竖线开头。
每个标志的高度是单独调的（27 / 30 / 36 / 43px），因为四个 viewBox 里真正是字形的
比例各不相同，统一高度反而看着不齐。

## 本地预览

```bash
cd dream-rsi-site && python3 -m http.server 8000
# http://localhost:8000
```

## 内容来源

标题、作者、单位、abstract、两张表格的全部数字、四张图，都直接取自
`Dream_RSI__Off_Policy_Meta_Learning_for_Recursive_Self_Improvement__Arxiv_.pdf`。

图是这样从 PDF 里抠出来的（无损矢量渲染，不是截图）：

```bash
pdftoppm -png -r 200 -f 2 -l 2 -x 172 -y 222 -W 1380 -H 620 paper.pdf fig1
```

论文改版后重新跑一遍即可，`-x/-y/-W/-H` 是 200 dpi 下的像素裁切框。

## 「做梦」动画 (`dream.js`)

`#demos` 顶部那块是**实时算出来的**，不是录屏也不是 GIF：canvas 画 agent 和树，右侧栏是普通 DOM。
它演的就是论文 Figure 1 的一圈：online exploration → simulator construction → dreaming-based
policy improvement，术语和画面上的字都跟论文对齐。

**只有两个颜色。** 蓝 = 线上真花钱的（`--env`），紫 = 脑子里免费想的（`--mid`），
赢家是紫色被推到底。绿色、灰色梯度、装饰性的光晕全删了 —— 画面上出现颜色就一定有含义。

调色板在 `dream.js` 顶部的 `THEMES`，明暗各一套，`applyTheme()` 按
`document.documentElement.dataset.theme` 选，并监听 `themechange` 事件。
两套不是简单反色：明色是**墨压在纸上**，叠加模式 `multiply`，`PAPER` 当成橡皮用来
在赢家路径后面打一圈 knockout；暗色是**光加在暗底上**，叠加模式 `lighter`，
赢家的颜色往亮走而不是往深走。改哪个值都在 `THEMES` 里，别散到函数里。

画面左边是 **agent 本人**：一个机器人，脚下标着它当前跑的策略 `π3`，头顶一个虚线思考气泡。
气泡里每个框框是**一个策略版本**，左下角 `π0 0.36` = 版本号 + 它的 replay 分数，
分数最高的那个描亮边。非 dream 幕气泡里只有一个宽框（`carry`）—— 上一圈选出来的赢家，
也就是它此刻正在外面跑的那个策略，所以气泡永远不是空的。气泡标题三种：
`RUNNING π3` / `REVISION 3/4` / `BEST OF 4`。

右边那块大的是**舞台**。线上阶段是实线框，标 `ONLINE · EVERY NODE IS ONE AGENT CALL`；
dream / update 阶段整块变紫色虚线框，标 `ℋ3 REPLAY SIMULATOR · ZERO EXECUTION COST` ——
同一棵树，前半程每个节点都是一次真实的 agent call，后半程只是在 ℋ 里重放，一次调用都不花。

**树的形状跟方法对齐**：论文里唯一的原子操作是 `CONTINUE(v)`，可选集合
`A(𝒯) = {root} ∪ {𝒯 的叶子}`。从 root 展开 = 开一条新 branch，从叶子展开 = 把那条 branch
往深里推，所以路径中间的节点永远只有一个 child，整棵树是 root 散出来的一把链子
（`buildTree()` 里的 `BUDGET / MAXD / MINBR / MAXBR`）。节点出现的顺序就是它被买下来的顺序，
不是按层铺开的。每条链有自己的一条慢正弦（振幅 < 半个 slot），这样链子之间不会交叉 ——
交叉看起来就像分叉。

因为唯一的分叉点是 root，一条候选策略其实只做两个决定：**走哪条 branch**（按 `n.sub`，
也就是那条链能到的最好分数来抽，`greed` 越大越贪）、**走多深**（不涨了就更容易收手）。
这两个决定的方差就是 dream 阶段 replay 分数分布的来源（`rollout()`）。

**外层 = RSI loop**，四幕，就是 Figure 1 那三条带箭头的边加上最后的回填：

| 幕 | 时长 | 画面 |
|---|---|---|
| 1 Online explore  | 7.0s | 树一个节点一个节点长出来，每个节点 = 一次真实 agent call；机器人睁眼，`explore` 箭头指进树根 |
| 2 Store to history | 2.2s | 扫描线扫过，`store` 箭头把这棵 𝒯ₜ 送回气泡 —— `ℋ_t = ℋ_(t−1) ∪ {𝒯_t}` |
| 3 Dream   | 9.0s | 舞台变成 replay simulator，上千条紫色轨迹重放，气泡里一个一个多出策略版本；机器人闭眼冒 z |
| 4 Update policy | 5.8s | 赢家框框脱离网格、变大、**沿气泡尾巴掉进机器人脑袋**；机器人脚下从 π3 变 π4 |

第四条边不是箭头而是那个掉下去的框框 —— 「递归」那一下是能看见的物理动作。

**内层 = offline 那一段，是 M 次代码改写，不是采样搜索。** 论文里是一个
LLM policy-development agent 读当前版本的 replay 轨迹和分数，把策略的代码改一遍，
得到 `π^0 = π_t, π^1, … π^(M−1)`；每个版本在**整个 ℋ_t**（不是只在最新那棵树）上重放打分，
`π_(t+1) = π^(m*)`。画面上对应 `REVS = 4`（跟 `NF` 绑在一起，窄画布降到 3）：dream 幕里
框框是**一个一个累加**出来的（`addRevision()`），标题从 `REVISION 1/4` 走到 `4/4`，
`revGreed` 一版比一版更贪，因为开发 agent 手上多了前几版的分数。
**因为 π^0 就是现在正在跑的那个策略，它本来就在候选集里，所以选出来的 π_(t+1) 不可能比 π_t 更差**
—— 这是论文里那条 never-worse 保证，气泡里那个不动的 `π0` 框就是它。

右栏三个数：`agent calls`（蓝，线上买的节点数）、`replays dreamed`（紫，脑内重放次数，
按真实速率累加到上万，屏幕上只抽样画 ≤68 条）、`replay score`（`0.476 → 0.576`，
左边是当前策略，右边是这一轮改写出来的最好版本）。

右栏底部的 **score per round** 是这一切的目的：每轮一根柱子，蓝 = 线上跑到的分，
紫尖 = 做梦额外拿到的。8 个槽位，满了就往左滚。曲线一直在涨但涨幅递减
（`buildTree` 里 `ceil = 0.97 − 0.40 × 0.86^(t−1)`），这是自我改进真实的形状。
页面一进来是 **t = 3** 而不是 t = 1：`seedHistory()` 先把前两轮补出来，
不然要等 24 秒才看得出「这是个循环」。

设计上的几个决定：

- **能砍的都砍了**。删掉的有：假的浏览器 chrome、图例、进度条、幕副标题、代码 diff 面板、
  气泡底下那排 `ℋ 𝒯12 𝒯13` chip、背景星云、舞台的径向渐变、柱状图的色块图例。
  「零执行成本」这件事由舞台标题说一次就够，不再用一个数字重复说一遍。
- **分数只有一个公式**：`最高分 − 0.006 × 执行次数`（`LAMBDA`）。这是论文 Eq. 1 的前两项
  （discovery quality − execution cost）；第三项并行度奖励 `β2·N/k*` 在这个画面上没有对应物，
  因为画面里没有画并发的批，所以没画出来。线上那次跑要为整棵树买单，重放的策略只为自己
  走过的路径买单 —— 所以 `0.476 → 0.576` 这个箭头是同一把尺子量出来的。
- **计数器和画面解耦**。真的画上万条轨迹会糊成一片，所以 `stats.roll` 按真实速率
  （峰值 ~2.8k/s）累加，屏幕上只抽样画。
- **窄画布上文字先让路**。`store` / `explore` 两个标签只在左右间距 > 40px 时画，
  气泡标题和框框里的 `πm` 都是 `measureText` 量出来的（量不下就只画分数），
  所以不会糊在一起。注意 `AW` 的上限要跟 `S` 的上限配套 —— 字号跟着 `S` 长、
  气泡宽度却被 `AW` 卡住的话，标题会缩成只剩 `3/4`。

改参数的地方都在文件顶部：`ACTS`（幕长）、`REVS`（M，改写次数）、`LAMBDA`（执行代价）、
`SLOTS`（柱子槽位）；树的形状在 `buildTree()` 里的 `BUDGET / MAXD / MINBR / MAXBR`。
左栏宽度 / 框框数量在 `resize()` 里的 `AW` 和 `NF`（`REVS` 跟着 `NF` 走），
机器人和气泡的位置在 `geom()`。

`prefers-reduced-motion: reduce` 时不自动播放，只渲染一帧静态的 Dream 画面。
元素滚出视口会自动暂停（IntersectionObserver），不烧 CPU。

画面上的数字是示意，真实数字在 `#results` 那两张表里（Lasso 317 vs 550 calls 之类）。

## 还剩下的 TODO

`index.html` 里搜 `TODO`：

- **arXiv 链接** —— 现在是 `#`，发出去后填真实 abs 链接，同时更新 `#bibtex` 里的 `arXiv:XXXX.XXXXX`
- **4 个 demo 录屏** —— ConvDiv / VGG16 / Lasso / Circle packing（在「Per-task recordings」那一栏，
  顶部的做梦动画不需要录屏）

放录屏时，把对应的 `<div class="screen screen-empty">…</div>` 整块换成：

```html
<video class="screen" controls muted playsinline preload="metadata"
       poster="assets/demo-convdiv.jpg">
  <source src="assets/demo-convdiv.mp4" type="video/mp4">
</video>
```

样式已经写好了，`video.screen` 会自动套用同样的圆角、阴影和 16:9 比例。录屏建议压到 720p / 10 MB 以内：

```bash
ffmpeg -i raw.mov -vf scale=1280:-2 -c:v libx264 -crf 28 -preset slow -an assets/demo-convdiv.mp4
```

## 部署到 www.dream-rsi.com

域名已在 Porkbun 注册（2027-09-11 到期，记得开 auto-renew）。

1. **DNS 交给 Cloudflare**：Cloudflare 免费账号 → Add a domain → `dream-rsi.com` → 拿到两个
   nameserver → 回 Porkbun 的 Authoritative Nameservers 里替换掉 4 个 `*.ns.porkbun.com`
2. **代码上 GitHub**：本目录推成一个 public 仓库（根目录就是站点根目录）
3. **Cloudflare Pages**：Workers & Pages → Create → Pages → 连仓库 →
   Framework preset **None**，build command **留空**，output directory **`/`** → Deploy
4. **绑域名**：项目 → Custom domains → 加 `www.dream-rsi.com` 和 `dream-rsi.com`，
   DNS 记录和 HTTPS 证书自动配好

验证：

```bash
dig NS dream-rsi.com +short
curl -sI https://www.dream-rsi.com | head -3
```

不想用 GitHub 也可以直接传：

```bash
npx wrangler pages deploy . --project-name dream-rsi
```
