# -*- coding: utf-8 -*-
"""构建时钩子（MkDocs 自动调用）：
1. 主页自动追加「最新文章」列表（按日期从新到旧，最多 3 篇）
2. 文章页自动追加「上一篇 / 下一篇」导航
3. 构建结束自动生成 sitemap.xml（供搜索引擎收录）
以后每写一篇新文章（随笔/课程），这些都会自动更新，不需要手动维护。
"""
import os

import yaml


def _read_meta(src_path):
    """读取 markdown 文件开头的 front matter（--- 包起来的 YAML）。"""
    try:
        with open(src_path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return {}
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}
    try:
        meta = yaml.safe_load(parts[1]) or {}
    except Exception:
        return {}
    return meta if isinstance(meta, dict) else {}


def _extract_h1(src_path):
    """回退：front matter 没有 title 时，取正文第一个一级标题（跳过注释区）。"""
    try:
        with open(src_path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return None
    # 跳过开头的 front matter（--- 包起来的区域）
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            text = parts[2]
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return None


def _collect_posts(files, config):
    """收集 essay/ 与 course/ 下的文章，按 date 从新到旧排序。"""
    posts = []
    for f in files.documentation_pages():
        uri = f.src_uri
        if not uri.endswith(".md"):
            continue
        if not (uri.startswith("essay/") or uri.startswith("course/")):
            continue
        if uri.endswith("index.md"):
            continue
        meta = _read_meta(f.abs_src_path)
        posts.append({
            "uri": uri,
            "title": meta.get("title") or _extract_h1(f.abs_src_path) or "未命名",
            "date": str(meta.get("date", "") or ""),
        })
    # 有日期的按日期降序（新的在前），没日期的排最后
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts


def _src_to_url(src_uri, config):
    """把 docs 下的 .md 路径转成站点相对 URL（如 essay/first.md -> essay/first/）。"""
    use_dir = config.get("use_directory_urls", True)
    base = src_uri[:-3] if src_uri.endswith(".md") else src_uri
    if use_dir:
        if base == "index":
            return "./"
        if base.endswith("/index"):
            base = base[:-6]
        return base + "/"
    if base == "index":
        return "./"
    return base + ".html"


def on_page_markdown(markdown, page, config, files, **kwargs):
    src = page.file.src_uri
    if src == "index.md":
        return _inject_latest_posts(markdown, files, config)
    if (src.startswith("essay/") or src.startswith("course/")) and not src.endswith("index.md"):
        return _inject_prev_next(markdown, page, files, config)
    return markdown


def _inject_latest_posts(markdown, files, config):
    posts = _collect_posts(files, config)[:3]
    if not posts:
        return markdown
    lines = ["", '<section class="home-latest">', "", "## 最新文章", ""]
    for p in posts:
        date = p["date"]
        date_part = date + " · " if date else ""
        lines.append("- {d}[{t}]({u})".format(
            d=date_part, t=p["title"], u=_src_to_url(p["uri"], config)))
    lines += ["", "</section>", ""]
    return markdown.rstrip() + "\n" + "\n".join(lines)


def _inject_prev_next(markdown, page, files, config):
    posts = _collect_posts(files, config)
    uris = [p["uri"] for p in posts]
    cur = page.file.src_uri
    if cur not in uris:
        return markdown
    idx = uris.index(cur)
    newer = posts[idx - 1] if idx - 1 >= 0 else None   # 更新的（上一篇）
    older = posts[idx + 1] if idx + 1 < len(posts) else None  # 更旧的（下一篇）
    if not newer and not older:
        return markdown
    lines = ["", '<nav class="page-nav">']
    if newer:
        lines.append('<div class="page-nav-item page-nav-prev"><span>上一篇</span>'
                     '<a href="{u}">{t}</a></div>'.format(
                         u=_src_to_url(newer["uri"], config), t=newer["title"]))
    if older:
        lines.append('<div class="page-nav-item page-nav-next"><span>下一篇</span>'
                     '<a href="{u}">{t}</a></div>'.format(
                         u=_src_to_url(older["uri"], config), t=older["title"]))
    lines.append("</nav>")
    return markdown.rstrip() + "\n" + "\n".join(lines) + "\n"


# 供 sitemap 使用的网址列表（on_files 时收集，on_post_build 时写入）
_SITEMAP_URLS = []


def on_files(files, config):
    """扫描到全部文件时，收集各页面的完整网址，供 sitemap 使用。"""
    global _SITEMAP_URLS
    _SITEMAP_URLS = []
    site_url = config.get("site_url")
    if not site_url:
        return files
    for f in files.documentation_pages():
        if not f.src_uri.endswith(".md") or f.src_uri == "404.md":
            continue
        url = _src_to_url(f.src_uri, config)
        if url in (".", "./"):
            path = ""
        else:
            path = url.lstrip("./")
        _SITEMAP_URLS.append(site_url.rstrip("/") + "/" + path)
    return files


def on_post_build(config, **kwargs):
    """构建完成后生成 sitemap.xml（需要配置 site_url 才会生效）。"""
    if not _SITEMAP_URLS:
        return
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for u in _SITEMAP_URLS:
        xml += "  <url><loc>{}</loc></url>\n".format(u)
    xml += "</urlset>\n"
    site_dir = config.get("site_dir", "site")
    with open(os.path.join(site_dir, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write(xml)
