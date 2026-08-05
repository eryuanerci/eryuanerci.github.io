// 访问统计：使用「不蒜子」免费服务，无需注册
(function () {
  // 加载不蒜子统计脚本
  var s = document.createElement("script");
  s.src = "//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js";
  s.async = true;
  document.head.appendChild(s);

  // 在页脚显示「本站总访问量 X 次」
  function inject() {
    var footer = document.querySelector(".md-footer-meta__inner");
    if (!footer) return;
    var span = document.createElement("span");
    span.id = "busuanzi_container_site_pv";
    span.style.fontSize = "12px";
    span.innerHTML = '本站总访问量 <span id="busuanzi_value_site_pv"></span> 次';
    footer.appendChild(span);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
