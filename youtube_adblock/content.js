(function () {
    // Работает как content script — просто наблюдает за DOM плеера и
    // манипулирует реальными HTML-элементами страницы (клик по кнопке
    // "Пропустить", домотка видео). Никаких обращений к сети или
    // подмены запросов — сетевую часть рекламы (баннеры/трекеры) блокирует
    // отдельно основной adblock браузера по доменам EasyList.

    function clickSkipIfPresent() {
        var selectors = [
            '.ytp-ad-skip-button',
            '.ytp-skip-ad-button',
            '.ytp-ad-skip-button-modern',
            '.ytp-ad-skip-button-container button'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var btn = document.querySelector(selectors[i]);
            if (btn) {
                try { btn.click(); } catch (e) {}
                return true;
            }
        }
        return false;
    }

    function fastForwardUnskippableAd() {
        var player = document.querySelector('.html5-video-player');
        var video = document.querySelector('video.html5-main-video, video');
        if (!player || !video) return;
        var adShowing = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
        if (!adShowing) return;
        try {
            // приглушаем на время ролика, если он ещё не пропускается кнопкой
            if (!video.muted) video.muted = true;
            if (video.duration && isFinite(video.duration) && video.duration > 0) {
                video.currentTime = video.duration;
            }
        } catch (e) {}
    }

    function tick() {
        try {
            if (!clickSkipIfPresent()) {
                fastForwardUnskippableAd();
            }
        } catch (e) {}
    }

    setInterval(tick, 350);
})();
