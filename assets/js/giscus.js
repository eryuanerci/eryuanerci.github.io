// 留言区：使用 giscus（基于 GitHub 讨论区，免费无广告）
(function () {
  var config = {
    repo: "eryuanerci/eryuanerci.github.io",
    repoId: "R_kgDOTtoOKQ",
    category: "General",
    categoryId: "DIC_kwDOTtoOKc4DCpp6",
    mapping: "pathname",
    strict: "0",
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "top",
    lang: "zh-CN",
  };

  function insertGiscus() {
    // 在每页正文末尾追加留言区
    var content = document.querySelector(".md-content__inner");
    if (!content) return;
    if (content.querySelector(".notfound")) return; // 404 页不加留言区
    if (content.querySelector(".giscus-frame")) return; // 已注入过，防止重复

    var container = document.createElement("div");
    container.style.marginTop = "40px";
    container.style.paddingTop = "24px";
    container.style.borderTop = "1px solid var(--md-default-fg-color--lightest)";

    var title = document.createElement("h2");
    title.textContent = "留言区";
    container.appendChild(title);

    var script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.setAttribute("data-repo", config.repo);
    script.setAttribute("data-repo-id", config.repoId);
    script.setAttribute("data-category", config.category);
    script.setAttribute("data-category-id", config.categoryId);
    script.setAttribute("data-mapping", config.mapping);
    script.setAttribute("data-strict", config.strict);
    script.setAttribute("data-reactions-enabled", config.reactionsEnabled);
    script.setAttribute("data-emit-metadata", config.emitMetadata);
    script.setAttribute("data-input-position", config.inputPosition);
    script.setAttribute("data-theme", "preferred_color_scheme");
    script.setAttribute("data-lang", config.lang);
    script.setAttribute("crossorigin", "anonymous");
    script.async = true;

    container.appendChild(script);
    content.appendChild(container);
  }

  // 夜间模式切换时，同步切换留言区的主题
  function watchTheme() {
    var radios = document.querySelectorAll('input[name="__palette"]');
    radios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        var scheme = radio.getAttribute("data-md-color-scheme");
        var theme = scheme === "slate" ? "dark" : "light";
        var iframe = document.querySelector("iframe.giscus-frame");
        if (iframe) {
          iframe.contentWindow.postMessage(
            { giscus: { setConfig: { theme: theme } } },
            "https://giscus.app"
          );
        }
      });
    });
  }

  function init() {
    insertGiscus();
    watchTheme();
  }

  // 首次加载时执行一次
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // 站点开启了「即时加载」（navigation.instant），站内跳转不整页刷新，
  // 脚本不会重新执行。extra.js 会检测地址栏变化并派发
  // xuyan:page-switched 事件，这里监听它重新注入留言区
  document.addEventListener("xuyan:page-switched", init);
})();
