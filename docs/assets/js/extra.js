// ============================================================
// XuYan 主页动效脚本
// 1. 打字机副标题（循环）
// 2. 粒子海流背景（Canvas，鼠标轻微交互）
// 3. 动态名牌入口（漂浮，可点击）
// 4. 文章统计（字数 / 代码行 / 图片数 / 阅读时长）
// 5. 页脚自定义信息行（版权 / 建站时间 / 站点地图入口）
//
// 注意：站点开启了「即时加载」（navigation.instant），站内跳转不整页刷新，
// 脚本不会自动重新执行。这里用 MutationObserver 监听内容区被替换，
// 替换完成后派发 xuyan:page-switched 事件，通知本脚本和留言区脚本重新初始化。
// ============================================================
function initAll() {
  var hero = document.querySelector('.hero-section');
  if (hero) {
    initTypewriter(hero);
    initParticles(hero);
    initFloatingNames(hero);
  }
  injectPageStats();
  injectFooter();
}

document.addEventListener('DOMContentLoaded', initAll);
document.addEventListener('xuyan:page-switched', initAll);

// 即时加载（navigation.instant）下，Material 会用新页面替换「内容区」节点
// （[data-md-component="container"]）。监听这个节点被替换的那一刻——
// 此时新页面的内容已经完整就位，再重新初始化才是正确的时机。
(function watchPageSwitch() {
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      if (!added) continue;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType === 1 && node.matches && node.matches('[data-md-component="container"]')) {
          document.dispatchEvent(new CustomEvent('xuyan:page-switched'));
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ----------------------------------------------------------
// 1. 打字机副标题
// ----------------------------------------------------------
function initTypewriter(scope) {
  var el = scope.querySelector('#typewriter');
  if (!el) return;
  if (el.getAttribute('data-init')) return; // 防止重复启动打字机
  el.setAttribute('data-init', '1');
  var phrase = '徐延个人网页，记录其生平の赛博传记';
  var charIndex = 0;
  var deleting = false;

  function loop() {
    if (!deleting) {
      charIndex++;
      el.textContent = phrase.slice(0, charIndex);
      if (charIndex === phrase.length) {
        deleting = true;
        setTimeout(loop, 4200); // 打完停留一会儿
        return;
      }
      setTimeout(loop, 150 + Math.random() * 120);
    } else {
      charIndex--;
      el.textContent = phrase.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        setTimeout(loop, 1500);
        return;
      }
      setTimeout(loop, 55);
    }
  }
  loop();
}

// ----------------------------------------------------------
// 2. 粒子海流背景：淡雅流动、星空连线、鼠标轻微推开
// ----------------------------------------------------------
function initParticles(scope) {
  var canvas = scope.querySelector('.particles-layer');
  if (!canvas) return;
  if (canvas.getAttribute('data-init')) return; // 防止重复启动粒子动画
  canvas.setAttribute('data-init', '1');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0;
  var parts = [];
  var mouse = { x: -9999, y: -9999 };
  var running = true;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = canvas.width = Math.max(1, Math.floor(rect.width));
    H = canvas.height = Math.max(1, Math.floor(rect.height));
    // 粒子数量随面积变化，保持稀疏淡雅
    var count = Math.min(130, Math.max(40, Math.floor(W * H / 15000)));
    parts = [];
    for (var i = 0; i < count; i++) {
      parts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.7 + 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function isDark() {
    return document.body.getAttribute('data-md-color-scheme') === 'slate';
  }

  function draw() {
    if (!running) return;
    if (!canvas.isConnected) return; // 页面已被替换，停止旧动画
    ctx.clearRect(0, 0, W, H);
    var dark = isDark();
    var color = dark ? '150,170,255' : '63,81,181';

    var i, j, p;
    // 画连线（星空网）
    for (i = 0; i < parts.length; i++) {
      for (j = i + 1; j < parts.length; j++) {
        var a = parts[i], b = parts[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var dist = dx * dx + dy * dy;
        if (dist < 110 * 110) {
          var alpha = (1 - Math.sqrt(dist) / 110) * 0.14;
          ctx.strokeStyle = 'rgba(' + color + ',' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // 更新并绘制粒子（带海流漂移 + 鼠标轻微推开）
    var t = Date.now() / 1000;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      // 海流：缓慢的整体漂移 + 正弦扰动
      p.x += p.vx + Math.sin(t * 0.3 + p.phase) * 0.06;
      p.y += p.vy + Math.cos(t * 0.24 + p.phase) * 0.05;

      // 鼠标交互：靠近的粒子被轻轻推开
      var mdx = p.x - mouse.x;
      var mdy = p.y - mouse.y;
      var md2 = mdx * mdx + mdy * mdy;
      if (md2 < 90 * 90 && md2 > 0.01) {
        var md = Math.sqrt(md2);
        var force = (90 - md) / 90 * 0.35;
        p.x += (mdx / md) * force;
        p.y += (mdy / md) * force;
      }

      // 边界环绕
      if (p.x < -5) p.x = W + 5;
      if (p.x > W + 5) p.x = -5;
      if (p.y < -5) p.y = H + 5;
      if (p.y > H + 5) p.y = -5;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + color + ',0.32)';
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', function () { resize(); });

  var hero = canvas.closest('.hero-section');
  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  hero.addEventListener('mouseleave', function () {
    mouse.x = -9999;
    mouse.y = -9999;
  });
}

// ----------------------------------------------------------
// 3. 动态名牌入口：4 个入口随机漂浮在主页上
// ----------------------------------------------------------
function initFloatingNames(scope) {
  var layer = scope.querySelector('.hero-names');
  if (!layer) return;
  if (layer.getAttribute('data-init')) return; // 防止重复生成名牌
  layer.setAttribute('data-init', '1');
  var names = [
    { text: '课程', href: 'course/' },
    { text: '随笔', href: 'essay/' },
    { text: '资源', href: 'resource/' },
    { text: '友链', href: 'friends/' },
    { text: '关于', href: 'about/' }
  ];

  names.forEach(function (n, idx) {
    var a = document.createElement('a');
    a.className = 'hero-name';
    a.href = n.href;
    a.textContent = n.text;
    layer.appendChild(a);

    // 随机位置，避开中央标题区域（占位后重掷）
    var left = 0, top = 0;
    for (var attempt = 0; attempt < 12; attempt++) {
      left = 6 + Math.random() * 84;
      top = 10 + Math.random() * 76;
      // 中央 38%-62% 宽、28%-62% 高区域留给标题
      if (left > 38 && left < 62 && top > 28 && top < 62) continue;
      break;
    }
    a.style.left = left + '%';
    a.style.top = top + '%';
    a.style.animationDelay = (idx * 0.8 + Math.random() * 1.5).toFixed(1) + 's';
  });
}

// ----------------------------------------------------------
// 4. 文章统计：标题下注入 字数 / 代码行 / 图片数 / 阅读时长
// ----------------------------------------------------------
function injectPageStats() {
  var article = document.querySelector('.md-content__inner');
  if (!article) return;
  if (article.querySelector('.hero-section')) return; // 主页不加
  if (article.querySelector('.notfound')) return; // 404 页不加
  if (article.querySelector('.page-stats')) return; // 已注入过，防止重复
  var firstH1 = article.querySelector('h1');
  if (!firstH1) return;

  // 复制正文做字数统计，剔除代码块，避免把代码算进字数
  var clone = article.cloneNode(true);
  clone.querySelectorAll('pre, code, .page-stats, .hero-section').forEach(function (el) {
    el.remove();
  });
  var text = clone.textContent || '';

  var cjk = (text.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
  var latinWords = (text.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, ' ')
    .match(/[A-Za-z0-9]+/g) || []).length;
  var wordCount = cjk + latinWords;

  var codeLines = 0;
  article.querySelectorAll('pre').forEach(function (pre) {
    var t = (pre.textContent || '').replace(/\n+$/, '');
    if (t) codeLines += t.split('\n').length;
  });

  var imageCount = article.querySelectorAll('img:not(.twemoji)').length;
  var minutes = Math.max(1, Math.ceil(wordCount / 400));

  var items = ['约 ' + wordCount + ' 个字'];
  if (codeLines > 0) items.push(codeLines + ' 行代码');
  if (imageCount > 0) items.push(imageCount + ' 张图片');
  items.push('预计阅读 ' + minutes + ' 分钟');

  var stats = document.createElement('p');
  stats.className = 'page-stats';
  stats.innerHTML = items.map(function (s) {
    return '<span class="page-stats-item">' + s + '</span>';
  }).join('');
  firstH1.insertAdjacentElement('afterend', stats);
}

// ----------------------------------------------------------
// 5. 页脚信息行：版权 / 建站时间 / 站点地图入口
// ----------------------------------------------------------
function injectFooter() {
  var footer = document.querySelector('.md-footer');
  if (!footer) return;
  if (footer.querySelector('.md-footer-custom')) return;

  var bar = document.createElement('div');
  bar.className = 'md-footer-custom';
  bar.innerHTML = '© 2026 XuYan 徐延 · 建站于 2026 年 8 月 · ' +
    '<a href="/sitemap.xml">站点地图</a> · 由 MkDocs + Material 驱动';

  var meta = document.querySelector('.md-footer-meta');
  if (meta) {
    meta.appendChild(bar);
  } else {
    footer.appendChild(bar);
  }
}
