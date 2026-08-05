# -*- coding: utf-8 -*-
"""构建时钩子（MkDocs 自动调用）：
1. 文章页自动追加「上一篇 / 下一篇」导航
2. 构建结束自动生成 sitemap.xml（供搜索引擎收录）
以后每写一篇新文章（随笔/课程），这些都会自动更新，不需要手动维护。
"""
import os
import re

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


def _read_list_order(prefix):
    """读取板块首页（index.md）里的文章列表顺序。

    例：course/index.md 里按顺序写了 `- [标题](文章名.md)`，
    就按这个顺序返回 ["course/文章名.md", ...]，作为「上一篇/下一篇」的依据。
    """
    order = []
    index_path = os.path.join("docs", prefix, "index.md")
    try:
        with open(index_path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return order
    for m in re.finditer(r"\]\(([^)]+\.md)\)", text):
        link = m.group(1).strip()
        if link.startswith("http"):
            continue
        link = link.lstrip("./")
        order.append(prefix + link)
    return order


def _collect_posts(files, config, prefix=None):
    """收集某个板块（essay/ course/ resource/）下的文章。

    排序规则：优先按板块首页 index.md 里的列表顺序（用户手动排好的），
    没有出现在列表里的文章追加到最后面（按日期从旧到新）。
    """
    order = _read_list_order(prefix) if prefix else []
    index_map = {uri: i for i, uri in enumerate(order)}
    posts = []
    for f in files.documentation_pages():
        uri = f.src_uri
        if not uri.endswith(".md"):
            continue
        if not (uri.startswith("essay/") or uri.startswith("course/") or uri.startswith("resource/")):
            continue
        if uri.endswith("index.md"):
            continue
        if prefix and not uri.startswith(prefix):
            continue
        meta = _read_meta(f.abs_src_path)
        posts.append({
            "uri": uri,
            "title": meta.get("title") or _extract_h1(f.abs_src_path) or "未命名",
            "date": str(meta.get("date", "") or ""),
        })
    if index_map:
        # 列表里的按列表顺序；列表外的排最后（按日期升序）
        posts.sort(key=lambda p: (p["uri"] not in index_map,
                                  index_map.get(p["uri"], 10**9),
                                  p["date"], p["uri"]))
    else:
        # 没有列表时：日期从旧到新，没日期的排最后；同日期按文件名排
        posts.sort(key=lambda p: (p["date"] == "", p["date"], p["uri"]))
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
    if (src.startswith("essay/") or src.startswith("course/") or src.startswith("resource/")) and not src.endswith("index.md"):
        return _inject_prev_next(markdown, page, files, config)
    return markdown


def _inject_prev_next(markdown, page, files, config):
    src = page.file.src_uri
    # 确定当前文章属于哪个板块，上一篇/下一篇只在该板块内部衔接
    prefix = None
    for pfx in ("essay/", "course/", "resource/"):
        if src.startswith(pfx):
            prefix = pfx
            break
    posts = _collect_posts(files, config, prefix)
    uris = [p["uri"] for p in posts]
    cur = src
    if cur not in uris:
        return markdown
    idx = uris.index(cur)
    prev = posts[idx - 1] if idx - 1 >= 0 else None      # 上一篇：更早发布的
    older = posts[idx + 1] if idx + 1 < len(posts) else None  # 下一篇：更晚发布的
    if not prev and not older:
        return markdown
    lines = ["", '<nav class="page-nav">']
    if prev:
        lines.append('<div class="page-nav-item page-nav-prev"><span>上一篇</span>'
                     '<a href="{u}">{t}</a></div>'.format(
                         u=_src_to_url(prev["uri"], config), t=prev["title"]))
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
