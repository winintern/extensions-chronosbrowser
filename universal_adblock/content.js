(function () {
    // CSS уже прячет статически присутствующую рекламу; здесь добираем то,
    // что рекламные сети подставляют в DOM уже после загрузки страницы —
    // MutationObserver ловит такие вставки в реальном времени и убирает
    // элемент из DOM целиком (не просто display:none, чтобы сеть не могла
    // тем же JS-скриптом вернуть видимость обратно).
    var SELECTORS = [
        'ins.adsbygoogle',
        'iframe[id^="google_ads_iframe"]',
        'div[id^="div-gpt-ad"]',
        '.trc_rbox_container',
        '.ob-widget',
        '.OUTBRAIN',
        '.mgbox',
        '.mgline',
        '[class~="ad-banner"]',
        '[id~="ad-banner"]',
        '[class~="advertisement"]',
        '[id~="advertisement"]',
    ];
    var COMBINED_SELECTOR = SELECTORS.join(',');

    function removeAds(root) {
        var found = root.querySelectorAll(COMBINED_SELECTOR);
        for (var i = 0; i < found.length; i++) {
            try { found[i].remove(); } catch (e) {}
        }
    }

    function init() {
        removeAds(document);

        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (node.nodeType !== 1) continue; // интересуют только элементы, не текстовые узлы
                    try {
                        if (node.matches && node.matches(COMBINED_SELECTOR)) {
                            node.remove();
                            continue;
                        }
                        if (node.querySelectorAll) {
                            removeAds(node);
                        }
                    } catch (e) {}
                }
            }
        });

        observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
