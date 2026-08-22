(function () {
    if (window.self !== window.top) return; // не дублируем виджет внутри iframe

    var CITY_KEY = 'chronos_weather_city';
    var CACHE_KEY_PREFIX = 'chronos_weather_cache_';
    var CACHE_TTL_MS = 20 * 60 * 1000; // 20 минут — не дёргаем API на каждой странице подряд

    var WMO_CODES = {
        0: ['Ясно', '☀️'],
        1: ['В основном ясно', '🌤️'],
        2: ['Переменная облачность', '⛅'],
        3: ['Пасмурно', '☁️'],
        45: ['Туман', '🌫️'],
        48: ['Изморозь', '🌫️'],
        51: ['Лёгкая морось', '🌦️'],
        53: ['Морось', '🌦️'],
        55: ['Сильная морось', '🌧️'],
        61: ['Небольшой дождь', '🌧️'],
        63: ['Дождь', '🌧️'],
        65: ['Сильный дождь', '🌧️'],
        71: ['Небольшой снег', '🌨️'],
        73: ['Снег', '🌨️'],
        75: ['Сильный снег', '❄️'],
        80: ['Ливень', '🌧️'],
        81: ['Сильный ливень', '⛈️'],
        82: ['Очень сильный ливень', '⛈️'],
        95: ['Гроза', '⛈️'],
        96: ['Гроза с градом', '⛈️'],
        99: ['Сильная гроза с градом', '⛈️'],
    };

    function describeCode(code) {
        return WMO_CODES[code] || ['Неизвестно', '🌡️'];
    }

    function getSavedCity() {
        try { return localStorage.getItem(CITY_KEY); } catch (e) { return null; }
    }
    function saveCity(city) {
        try { localStorage.setItem(CITY_KEY, city); } catch (e) {}
    }
    function getCache(city) {
        try {
            var raw = localStorage.getItem(CACHE_KEY_PREFIX + city);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (Date.now() - data.ts > CACHE_TTL_MS) return null;
            return data;
        } catch (e) { return null; }
    }
    function setCache(city, payload) {
        try {
            payload.ts = Date.now();
            localStorage.setItem(CACHE_KEY_PREFIX + city, JSON.stringify(payload));
        } catch (e) {}
    }

    function geocodeCity(city) {
        var url = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=' + encodeURIComponent(city);
        return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            if (!data.results || !data.results.length) throw new Error('Город не найден');
            var r = data.results[0];
            return { lat: r.latitude, lon: r.longitude, name: r.name };
        });
    }

    function fetchWeather(lat, lon) {
        var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current_weather=true';
        return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            return data.current_weather; // {temperature, windspeed, weathercode, ...}
        });
    }

    function loadWeatherForCity(city, onResult, onError) {
        var cached = getCache(city);
        if (cached) {
            onResult(cached.name, cached.weather);
            return;
        }
        geocodeCity(city).then(function (loc) {
            return fetchWeather(loc.lat, loc.lon).then(function (weather) {
                setCache(city, { name: loc.name, weather: weather });
                onResult(loc.name, weather);
            });
        }).catch(function (err) {
            onError(err.message || 'Ошибка загрузки погоды');
        });
    }

    // --- UI ---
    var btn = document.createElement('div');
    btn.title = 'Погода (ChronosBrowser)';
    btn.style.cssText =
        'position:fixed;bottom:16px;left:16px;z-index:2147483647;' +
        'min-width:36px;height:36px;padding:0 10px;border-radius:18px;' +
        'background:#1d2030;color:#e7c377;border:1px solid #2b2f45;' +
        'display:flex;align-items:center;justify-content:center;gap:6px;' +
        'font-size:13px;font-family:Arial,sans-serif;cursor:pointer;' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.4);user-select:none;';
    btn.textContent = '🌤️';

    var panel = document.createElement('div');
    panel.style.cssText =
        'position:fixed;bottom:60px;left:16px;z-index:2147483647;width:220px;' +
        'background:#181a26;border:1px solid #2b2f45;border-radius:10px;padding:12px;' +
        'color:#ece7da;font-family:Arial,sans-serif;font-size:13px;display:none;' +
        'box-shadow:0 8px 24px rgba(0,0,0,0.5);';

    function renderCityInput() {
        panel.innerHTML = '';
        var label = document.createElement('div');
        label.textContent = 'Введите город:';
        label.style.cssText = 'margin-bottom:6px;color:#a9adc4;';
        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Москва';
        input.style.cssText = 'width:100%;box-sizing:border-box;padding:6px;border-radius:6px;border:1px solid #2b2f45;background:#1a1c29;color:#ece7da;';
        var saveBtn = document.createElement('button');
        saveBtn.textContent = 'Сохранить';
        saveBtn.style.cssText = 'margin-top:8px;width:100%;padding:6px;border-radius:6px;border:none;background:#c99a3d;color:#14161f;font-weight:600;cursor:pointer;';
        saveBtn.addEventListener('click', function () {
            var city = input.value.trim();
            if (!city) return;
            saveCity(city);
            renderLoading();
            loadWeatherForCity(city, renderWeather, renderError);
        });
        panel.appendChild(label);
        panel.appendChild(input);
        panel.appendChild(saveBtn);
    }

    function renderLoading() {
        panel.innerHTML = '<div style="color:#8b8fa3;">Загрузка погоды...</div>';
    }

    function renderError(msg) {
        panel.innerHTML = '';
        var err = document.createElement('div');
        err.style.cssText = 'color:#e05a4b;margin-bottom:8px;';
        err.textContent = '❌ ' + msg;
        var changeBtn = document.createElement('button');
        changeBtn.textContent = 'Изменить город';
        changeBtn.style.cssText = 'width:100%;padding:6px;border-radius:6px;border:1px solid #2b2f45;background:#1d2030;color:#ece7da;cursor:pointer;';
        changeBtn.addEventListener('click', renderCityInput);
        panel.appendChild(err);
        panel.appendChild(changeBtn);
    }

    function renderWeather(cityName, weather) {
        var info = describeCode(weather.weathercode);
        panel.innerHTML = '';
        var title = document.createElement('div');
        title.style.cssText = 'font-weight:600;margin-bottom:6px;color:#e7c377;';
        title.textContent = cityName;
        var temp = document.createElement('div');
        temp.style.cssText = 'font-size:22px;margin-bottom:4px;';
        temp.textContent = info[1] + '  ' + Math.round(weather.temperature) + '°C';
        var desc = document.createElement('div');
        desc.style.cssText = 'color:#a9adc4;margin-bottom:8px;';
        desc.textContent = info[0] + ' · ветер ' + Math.round(weather.windspeed) + ' км/ч';
        var changeBtn = document.createElement('button');
        changeBtn.textContent = 'Изменить город';
        changeBtn.style.cssText = 'width:100%;padding:5px;border-radius:6px;border:1px solid #2b2f45;background:#1d2030;color:#8b8fa3;font-size:11px;cursor:pointer;';
        changeBtn.addEventListener('click', renderCityInput);
        panel.appendChild(title);
        panel.appendChild(temp);
        panel.appendChild(desc);
        panel.appendChild(changeBtn);
        btn.textContent = info[1] + ' ' + Math.round(weather.temperature) + '°';
    }

    btn.addEventListener('click', function () {
        var visible = panel.style.display !== 'none';
        panel.style.display = visible ? 'none' : 'block';
        if (!visible) {
            var city = getSavedCity();
            if (!city) {
                renderCityInput();
            } else if (panel.innerHTML === '') {
                renderLoading();
                loadWeatherForCity(city, renderWeather, renderError);
            }
        }
    });

    (document.body || document.documentElement).appendChild(btn);
    (document.body || document.documentElement).appendChild(panel);

    // если город уже сохранён — тихо подгружаем погоду в фон, чтобы
    // на кнопке сразу была видна температура, не дожидаясь клика
    var savedCity = getSavedCity();
    if (savedCity) {
        loadWeatherForCity(savedCity, renderWeather, function () {});
    }
})();
