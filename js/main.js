(function () {
    "use strict";

    var CONTENT_FILE = "data/content.csv";
    var FALLBACK_THUMB = "img/miko.jpg";
    var ITEMS_PER_PAGE = 10;
    var HOME_LIMIT = 8;

    var content = [];
    var page = document.body.getAttribute("data-page") || "home";
    var archiveSearch = document.getElementById("archive-search");
    var siteSearch = document.getElementById("site-search");
    var activeCategory = "All";
    var activeTag = "";
    var currentArchivePage = 1;

    document.addEventListener("DOMContentLoaded", function () {
        bindSearchForms();
        bindTagCloud();
        loadContent();
    });

    function bindSearchForms() {
        document.querySelectorAll(".search-box").forEach(function (form) {
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                var input = form.querySelector("input[type='search']");
                var keyword = input ? input.value.trim() : "";
                window.location.href = keyword ? "archive.html?q=" + encodeURIComponent(keyword) : "archive.html";
            });
        });

        document.addEventListener("keydown", function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                var target = archiveSearch || siteSearch;
                if (target) {
                    event.preventDefault();
                    target.focus();
                }
            }
        });

        if (archiveSearch) {
            archiveSearch.addEventListener("input", function () {
                currentArchivePage = 1;
                updateArchiveQuery();
                renderArchive();
            });
        }
    }

    function bindTagCloud() {
        document.querySelectorAll(".tag-cloud button").forEach(function (button) {
            button.addEventListener("click", function () {
                var tag = button.textContent.trim();
                if (tag) {
                    window.location.href = "archive.html?tag=" + encodeURIComponent(tag);
                }
            });
        });
    }

    function loadContent() {
        fetch(CONTENT_FILE)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Cannot load data/content.csv");
                }
                return response.text();
            })
            .then(function (csv) {
                content = parseCSV(csv).map(normalizeItem).filter(function (item) {
                    return item.title;
                });
                setupArchiveQuery();
                renderCurrentPage();
            })
            .catch(showLoadError);
    }

    function parseCSV(text) {
        var rows = [];
        var row = [];
        var cell = "";
        var quoted = false;

        for (var i = 0; i < text.length; i += 1) {
            var char = text[i];
            var next = text[i + 1];

            if (char === '"' && quoted && next === '"') {
                cell += '"';
                i += 1;
            } else if (char === '"') {
                quoted = !quoted;
            } else if (char === "," && !quoted) {
                row.push(cell);
                cell = "";
            } else if ((char === "\n" || char === "\r") && !quoted) {
                if (char === "\r" && next === "\n") {
                    i += 1;
                }
                row.push(cell);
                pushRow(rows, row);
                row = [];
                cell = "";
            } else {
                cell += char;
            }
        }

        if (cell || row.length) {
            row.push(cell);
            pushRow(rows, row);
        }

        if (rows.length < 2) {
            return [];
        }

        var headers = rows.shift().map(function (header) {
            return header.trim();
        });

        return rows.map(function (values) {
            var item = {};
            headers.forEach(function (header, index) {
                item[header] = (values[index] || "").trim();
            });
            return item;
        });
    }

    function pushRow(rows, row) {
        if (row.some(function (value) { return value.trim() !== ""; })) {
            rows.push(row);
        }
    }

    function normalizeItem(item) {
        return {
            title: item.title || "",
            url: item.url || "",
            local_path: item.local_path || "",
            slug: item.slug || slugify(item.title || ""),
            category: item.category || "Uncategorized",
            date: item.date || "",
            thumbnail: item.thumbnail || FALLBACK_THUMB,
            tags: item.tags || ""
        };
    }

    function renderCurrentPage() {
        if (page === "home") {
            renderHome();
        } else if (page === "archive") {
            renderArchive();
        } else if (page === "article") {
            renderArticlePage();
        } else if (page === "section") {
            renderSectionPage();
        }
    }

    function renderHome() {
        var latest = sortByDate(content).slice(0, HOME_LIMIT);
        renderCards(document.getElementById("highlight-grid"), latest);
        renderLatestTable(document.getElementById("latest-updates-body"), latest);
    }

    function setupArchiveQuery() {
        if (page !== "archive") {
            return;
        }

        var params = new URLSearchParams(window.location.search);
        var q = params.get("q") || "";
        activeCategory = params.get("category") || "All";
        activeTag = params.get("tag") || "";
        currentArchivePage = parsePositiveInt(params.get("page"), 1);

        if (archiveSearch) {
            archiveSearch.value = q;
        }
    }

    function renderArchive() {
        renderFilters();
        renderArchiveHero();

        var term = archiveSearch ? archiveSearch.value.trim().toLowerCase() : "";
        var filtered = sortByDate(content).filter(function (item) {
            var matchesCategory = activeCategory === "All" || item.category === activeCategory;
            var matchesTag = !activeTag || getTags(item.tags).some(function (tag) {
                return tag.toLowerCase() === activeTag.toLowerCase();
            });
            return matchesCategory && matchesTag && matchesSearch(item, term);
        });
        var totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

        if (currentArchivePage > totalPages) {
            currentArchivePage = totalPages;
            updateArchiveQuery();
        }

        var start = (currentArchivePage - 1) * ITEMS_PER_PAGE;
        var pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

        renderArchiveResultCount(filtered.length, currentArchivePage, totalPages);
        renderArticleList(document.getElementById("archive-list"), pageItems, activeCategory === "All" ? "ยังไม่มีรายการ" : "ยังไม่มีรายการในหมวดนี้");
        renderPagination(filtered.length, currentArchivePage);
    }

    function renderArchiveHero() {
        var titleTarget = document.getElementById("archive-hero-title");
        var descriptionTarget = document.getElementById("archive-hero-description");
        if (!titleTarget || !descriptionTarget) {
            return;
        }

        if (activeCategory === "All") {
            titleTarget.textContent = "All Catalog";
            descriptionTarget.textContent = "สารบัญรวมลิงก์และบทความของ No MiKo No Life";
            if (activeTag) {
                titleTarget.textContent = "Tag: " + activeTag;
                descriptionTarget.textContent = "รายการที่ติดแท็ก " + activeTag;
            }
            return;
        }

        titleTarget.textContent = activeCategory + " Catalog";
        descriptionTarget.textContent = "รวมรายการในหมวด " + activeCategory;
    }

    function renderFilters() {
        var target = document.getElementById("category-filters");
        if (!target) {
            return;
        }

        var categories = ["All"].concat(unique(content.map(function (item) {
            return item.category;
        })));

        target.innerHTML = categories.map(function (category) {
            var active = category === activeCategory ? " active" : "";
            return '<button class="' + active.trim() + '" type="button" data-category="' + escapeHTML(category) + '">' + escapeHTML(category) + "</button>";
        }).join("");

        target.querySelectorAll("button").forEach(function (button) {
            button.addEventListener("click", function () {
                activeCategory = button.getAttribute("data-category") || "All";
                activeTag = "";
                currentArchivePage = 1;
                updateArchiveQuery();
                renderArchive();
            });
        });
    }

    function renderArchiveResultCount(totalItems, currentPage, totalPages) {
        var target = document.getElementById("archive-result-count");
        if (!target) {
            return;
        }

        if (!totalItems) {
            target.textContent = "พบ 0 รายการ";
            return;
        }

        target.textContent = "พบ " + totalItems + " รายการ · หน้า " + currentPage + " จาก " + totalPages;
    }

    function renderPagination(totalItems, currentPage) {
        var target = document.getElementById("pagination");
        if (!target) {
            return;
        }

        var totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (totalItems <= ITEMS_PER_PAGE || totalPages <= 1) {
            target.innerHTML = "";
            return;
        }

        var buttons = [];
        buttons.push(paginationButton("« Prev", currentPage - 1, currentPage === 1));
        for (var i = 1; i <= totalPages; i += 1) {
            buttons.push(paginationButton(String(i), i, false, i === currentPage));
        }
        buttons.push(paginationButton("Next »", currentPage + 1, currentPage === totalPages));
        target.innerHTML = buttons.join("");

        target.querySelectorAll("button[data-page]").forEach(function (button) {
            button.addEventListener("click", function () {
                currentArchivePage = parsePositiveInt(button.getAttribute("data-page"), 1);
                updateArchiveQuery();
                renderArchive();
                var list = document.getElementById("archive-list");
                if (list) {
                    list.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });
    }

    function paginationButton(label, pageNumber, disabled, active) {
        var classes = active ? ' class="active"' : "";
        var disabledAttr = disabled ? " disabled" : "";
        return '<button type="button"' + classes + disabledAttr + ' data-page="' + pageNumber + '">' + escapeHTML(label) + "</button>";
    }

    function renderSectionPage() {
        var target = document.getElementById("section-list");
        var category = document.body.getAttribute("data-filter-category") || "all";
        var items = sortByDate(content).filter(function (item) {
            return category === "all" || item.category === category;
        });

        renderArticleList(target, items, "อยู่ระหว่างจัดทำ");
    }

    function renderCards(target, items) {
        if (!target) {
            return;
        }
        if (!items.length) {
            target.innerHTML = '<p class="empty">ยังไม่มีรายการ</p>';
            return;
        }

        target.innerHTML = items.map(function (item) {
            return [
                '<article class="article-card">',
                '<a ' + linkAttributes(item) + '>',
                '<div class="thumb">',
                thumbHTML(item),
                '<span class="badge">' + escapeHTML(item.category) + '</span>',
                '</div>',
                '<div class="article-body">',
                '<h3>' + escapeHTML(item.title) + '</h3>',
                '<p>' + escapeHTML(formatThaiDate(item.date)) + ' · ' + escapeHTML(linkKind(item)) + '</p>',
                '<div class="mini-tags">' + renderTags(item.tags, false) + '</div>',
                '</div>',
                '</a>',
                '</article>'
            ].join("");
        }).join("");
    }

    function renderLatestTable(target, items) {
        if (!target) {
            return;
        }
        if (!items.length) {
            target.innerHTML = '<tr><td colspan="5">ยังไม่มีรายการอัปเดต</td></tr>';
            return;
        }

        target.innerHTML = items.map(function (item) {
            return [
                '<tr>',
                '<td><a ' + linkAttributes(item) + '>' + escapeHTML(item.title) + '</a></td>',
                '<td><a class="badge-inline" href="archive.html?category=' + encodeURIComponent(item.category) + '">' + escapeHTML(item.category) + '</a></td>',
                '<td><div class="table-tags">' + renderTags(item.tags, true) + '</div></td>',
                '<td>' + escapeHTML(formatThaiDate(item.date)) + '</td>',
                '<td><span class="link-kind">' + escapeHTML(linkKind(item)) + '</span></td>',
                '</tr>'
            ].join("");
        }).join("");
    }

    function renderArticleList(target, items, emptyText) {
        if (!target) {
            return;
        }
        if (!items.length) {
            target.innerHTML = '<p class="empty">' + escapeHTML(emptyText || "ยังไม่มีรายการ") + '</p>';
            return;
        }

        target.innerHTML = items.map(function (item) {
            return [
                '<article class="article-row">',
                '<a class="article-row-thumb" ' + linkAttributes(item) + '>' + thumbHTML(item) + '</a>',
                '<div class="article-row-main">',
                '<a class="badge-inline" href="archive.html?category=' + encodeURIComponent(item.category) + '">' + escapeHTML(item.category) + '</a>',
                '<h3><a ' + linkAttributes(item) + '>' + escapeHTML(item.title) + '</a></h3>',
                '<p>' + escapeHTML(linkDescription(item)) + '</p>',
                '<div class="mini-tags">' + renderTags(item.tags, true) + '</div>',
                '</div>',
                '<time datetime="' + escapeHTML(item.date) + '">' + escapeHTML(formatThaiDate(item.date)) + '</time>',
                '</article>'
            ].join("");
        }).join("");
    }

    function renderArticlePage() {
        var metaTarget = document.getElementById("article-meta");
        var contentTarget = document.getElementById("article-content");
        var params = new URLSearchParams(window.location.search);
        var slug = params.get("slug") || "";
        var item = content.find(function (entry) {
            return entry.slug === slug;
        });

        if (!metaTarget || !contentTarget || !item || !item.local_path) {
            showArticleNotFound();
            return;
        }

        metaTarget.innerHTML = articleMetaTemplate(item);
        contentTarget.innerHTML = '<p class="empty">กำลังโหลดบทความ...</p>';

        fetch(item.local_path)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Cannot load markdown");
                }
                return response.text();
            })
            .then(function (markdown) {
                contentTarget.innerHTML = renderMarkdown(markdown);
            })
            .catch(function () {
                contentTarget.innerHTML = '<p class="empty">ไม่สามารถโหลดบทความได้</p>';
            });
    }

    function articleMetaTemplate(item) {
        return [
            '<div class="article-hero-card" style="background-image: url(\'' + escapeHTML(item.thumbnail || FALLBACK_THUMB) + '\');">',
            '<div class="article-hero-overlay"></div>',
            '<div class="article-hero-content">',
            '<h1>' + escapeHTML(item.title) + '</h1>',
            '<div class="article-detail-line">',
            '<time datetime="' + escapeHTML(item.date) + '">' + escapeHTML(formatThaiDate(item.date)) + '</time>',
            '<a class="article-detail-category" href="archive.html?category=' + encodeURIComponent(item.category) + '">' + escapeHTML(item.category) + '</a>',
            '<div class="article-tags">' + renderTags(item.tags, true) + '</div>',
            '</div>',
            '</div>',
            '</div>',
            '<div class="article-back-row"><a class="back-link" href="archive.html">← Back to Archive</a></div>'
        ].join("");
    }

    function renderMarkdown(markdown) {
        var prepared = normalizeMarkdownImagePaths(stripDuplicateMeta(markdown));

        if (window.marked && typeof window.marked.parse === "function") {
            window.marked.setOptions({
                breaks: false,
                gfm: true
            });
            return window.marked.parse(prepared);
        }

        return fallbackMarkdown(prepared);
    }

    function stripDuplicateMeta(markdown) {
        return String(markdown || "")
            .split(/\r?\n/)
            .filter(function (line) {
                return !/^\s*\*?(category|tags)\s*:/i.test(line.trim());
            })
            .join("\n");
    }

    function normalizeMarkdownImagePaths(markdown) {
        return String(markdown || "").replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, function (match, prefix, src, suffix) {
            var path = src.trim();
            if (path.indexOf("../img/") === 0) {
                path = path.replace("../img/", "img/");
            } else if (path.indexOf("./img/") === 0) {
                path = path.replace("./img/", "img/");
            }
            return prefix + path + suffix;
        });
    }

    function fallbackMarkdown(markdown) {
        var html = [];
        var paragraph = [];
        var list = null;

        String(markdown || "").split(/\r?\n/).forEach(function (line) {
            var trimmed = line.trim();
            var unordered = trimmed.match(/^[-*]\s+(.+)$/);
            var ordered = trimmed.match(/^\d+\.\s+(.+)$/);

            if (!trimmed) {
                flushParagraph();
                flushList();
            } else if (/^---+$/.test(trimmed)) {
                flushParagraph();
                flushList();
                html.push("<hr>");
            } else if (/^>\s?/.test(trimmed)) {
                flushParagraph();
                flushList();
                html.push("<blockquote><p>" + inlineMarkdown(trimmed.replace(/^>\s?/, "")) + "</p></blockquote>");
            } else if (unordered) {
                flushParagraph();
                openList("ul");
                html.push("<li>" + inlineMarkdown(unordered[1]) + "</li>");
            } else if (ordered) {
                flushParagraph();
                openList("ol");
                html.push("<li>" + inlineMarkdown(ordered[1]) + "</li>");
            } else if (/^###\s+/.test(trimmed)) {
                flushParagraph();
                flushList();
                html.push("<h3>" + inlineMarkdown(trimmed.replace(/^###\s+/, "")) + "</h3>");
            } else if (/^##\s+/.test(trimmed)) {
                flushParagraph();
                flushList();
                html.push("<h2>" + inlineMarkdown(trimmed.replace(/^##\s+/, "")) + "</h2>");
            } else if (/^#\s+/.test(trimmed)) {
                flushParagraph();
                flushList();
                html.push("<h1>" + inlineMarkdown(trimmed.replace(/^#\s+/, "")) + "</h1>");
            } else {
                flushList();
                paragraph.push(trimmed);
            }
        });

        flushParagraph();
        flushList();
        return html.join("");

        function openList(type) {
            if (list && list !== type) {
                flushList();
            }
            if (!list) {
                list = type;
                html.push("<" + list + ">");
            }
        }

        function flushList() {
            if (list) {
                html.push("</" + list + ">");
                list = null;
            }
        }

        function flushParagraph() {
            if (paragraph.length) {
                html.push("<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>");
                paragraph = [];
            }
        }
    }

    function inlineMarkdown(text) {
        return escapeHTML(text)
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/`([^`]+)`/g, "<code>$1</code>");
    }

    function getItemHref(item) {
        if (item.local_path) {
            return "article.html?slug=" + encodeURIComponent(item.slug);
        }
        return item.url || "#";
    }

    function linkAttributes(item) {
        var href = getItemHref(item);
        return 'href="' + escapeHTML(href) + '"';
    }

    function linkKind(item) {
        if (item.local_path) {
            return "Article";
        }
        return getHostName(item.url) || "External";
    }

    function linkDescription(item) {
        if (item.local_path) {
            return "บทความภายในเว็บไซต์";
        }
        return "ลิงก์ภายนอก: " + (getHostName(item.url) || item.url || "-");
    }

    function getHostName(url) {
        try {
            return url ? new URL(url, window.location.href).hostname.replace(/^www\./, "") : "";
        } catch (error) {
            return "";
        }
    }

    function thumbHTML(item) {
        return '<img src="' + escapeHTML(item.thumbnail || FALLBACK_THUMB) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + FALLBACK_THUMB + '\';">';
    }

    function renderTags(tags, linked) {
        return getTags(tags).map(function (tag) {
            if (linked) {
                return '<a href="archive.html?tag=' + encodeURIComponent(tag) + '">' + escapeHTML(tag) + "</a>";
            }
            return '<span>' + escapeHTML(tag) + "</span>";
        }).join("");
    }

    function getTags(tags) {
        return String(tags || "")
            .split(/[|,]/)
            .map(function (tag) { return tag.trim(); })
            .filter(Boolean);
    }

    function matchesSearch(item, term) {
        var haystack = [item.title, item.category, item.tags].join(" ").toLowerCase();
        return !term || haystack.indexOf(term) !== -1;
    }

    function updateArchiveQuery() {
        if (!window.history || !window.history.replaceState || page !== "archive") {
            return;
        }

        var params = new URLSearchParams();
        var q = archiveSearch ? archiveSearch.value.trim() : "";
        if (q) {
            params.set("q", q);
        }
        if (activeCategory !== "All") {
            params.set("category", activeCategory);
        }
        if (activeTag) {
            params.set("tag", activeTag);
        }
        if (currentArchivePage > 1) {
            params.set("page", String(currentArchivePage));
        }

        var query = params.toString();
        window.history.replaceState(null, "", query ? "archive.html?" + query : "archive.html");
    }

    function sortByDate(items) {
        return items.slice().sort(function (a, b) {
            var diff = parseDateValue(b.date) - parseDateValue(a.date);
            if (diff !== 0) {
                return diff;
            }
            return String(a.title || "").localeCompare(String(b.title || ""));
        });
    }

    function parseDateValue(dateText) {
        var parts = String(dateText || "").split("-");
        if (parts.length !== 3) {
            return 0;
        }
        return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }

    function parsePositiveInt(value, fallback) {
        var parsed = parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    function unique(values) {
        return values.filter(function (value, index, array) {
            return value && array.indexOf(value) === index;
        }).sort();
    }

    function formatThaiDate(dateText) {
        var date = new Date(dateText + "T00:00:00");
        var months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

        if (Number.isNaN(date.getTime())) {
            return dateText || "-";
        }

        return [
            String(date.getDate()).padStart(2, "0"),
            months[date.getMonth()],
            date.getFullYear()
        ].join(" ");
    }

    function slugify(text) {
        return String(text || "")
            .toLowerCase()
            .trim()
            .replace(/[`~!@#$%^&*()+=[\]{};:'"\\|,.<>/?]+/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-") || "article";
    }

    function showArticleNotFound() {
        var metaTarget = document.getElementById("article-meta");
        var contentTarget = document.getElementById("article-content");
        if (metaTarget) {
            metaTarget.innerHTML = '<div class="article-meta-panel article-not-found"><h1>ไม่พบบทความนี้</h1><p>slug นี้ยังไม่มีรายการใน data/content.csv</p><a class="back-link" href="archive.html">← Back to Archive</a></div>';
        }
        if (contentTarget) {
            contentTarget.innerHTML = "";
        }
    }

    function showLoadError() {
        [
            document.getElementById("highlight-grid"),
            document.getElementById("archive-list"),
            document.getElementById("section-list"),
            document.getElementById("article-content")
        ].forEach(function (target) {
            if (target) {
                target.innerHTML = '<p class="empty">ไม่สามารถโหลดข้อมูลได้</p>';
            }
        });

        var table = document.getElementById("latest-updates-body");
        if (table) {
            table.innerHTML = '<tr><td colspan="4">ไม่สามารถโหลดข้อมูลล่าสุดได้</td></tr>';
        }
    }

    function escapeHTML(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}());
