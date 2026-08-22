(function () {
    if (window.self !== window.top) return; // не дублируем виджет внутри iframe

    var CACHE_KEY_PREFIX = 'chronos_currency_cache_';
    var CACHE_TTL_MS = 60 * 60 * 1000; // 1 час — курсы этого API обновляются раз в сутки, чаще дёргать смысла нет
    var LAST_PAIR_KEY = 'chronos_currency_last_pair';

    var COMMON_CURRENCIES = ['RUB', 'USD', 'EUR', 'GBP', 'CNY', 'JPY', 'KZT', 'TRY', 'AED', 'GEL', 'AMD'];

    function getRates(base) {
        var cacheKey = CACHE_KEY_PREFIX + base;
        try {
            var raw = localStorage.getItem(cacheKey);
            if (raw) {
                var cached = JSON.parse(raw);
                if (Date.now() - cached.ts < CACHE_TTL_MS) {
                    return Promise.resolve(cached.rates);
                }
            }
        } catch (e) {}

        return fetch('https://open.er-api.com/v6/latest/' + base).then(function (r) {
            return r.json();
        }).then(function (data) {
            if (data.result !== 'success') throw new Error('Сервис курсов недоступен');
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ rates: data.rates, ts: Date.now() }));
            } catch (e) {}
            return data.rates;
        });
    }

    function convert(amount, from, to) {
        return getRates(from).then(function (rates) {
            if (!(to in rates)) throw new Error('Валюта ' + to + ' не найдена');
            return amount * rates[to];
        });
    }

    // --- UI ---
    var btn = document.createElement('div');
    btn.textContent = '💱';
    btn.title = 'Конвертер валют (ChronosBrowser)';
    btn.style.cssText =
        'position:fixed;top:16px;right:16px;z-index:2147483647;' +
        'width:36px;height:36px;border-radius:50%;' +
        'background:#1d2030;color:#e7c377;border:1px solid #2b2f45;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-size:16px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);user-select:none;';

    var panel = document.createElement('div');
    panel.style.cssText =
        'position:fixed;top:58px;right:16px;z-index:2147483647;width:240px;' +
        'background:#181a26;border:1px solid #2b2f45;border-radius:10px;padding:12px;' +
        'color:#ece7da;font-family:Arial,sans-serif;font-size:13px;display:none;' +
        'box-shadow:0 8px 24px rgba(0,0,0,0.5);';

    function makeSelect(selected) {
        var select = document.createElement('select');
        select.style.cssText = 'flex:1;padding:5px;border-radius:6px;border:1px solid #2b2f45;background:#1a1c29;color:#ece7da;';
        COMMON_CURRENCIES.forEach(function (code) {
            var opt = document.createElement('option');
            opt.value = code;
            opt.textContent = code;
            if (code === selected) opt.selected = true;
            select.appendChild(opt);
        });
        return select;
    }

    function getLastPair() {
        try {
            var raw = localStorage.getItem(LAST_PAIR_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return { from: 'USD', to: 'RUB' };
    }
    function saveLastPair(from, to) {
        try { localStorage.setItem(LAST_PAIR_KEY, JSON.stringify({ from: from, to: to })); } catch (e) {}
    }

    function buildPanel() {
        panel.innerHTML = '';
        var lastPair = getLastPair();

        var amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.value = '1';
        amountInput.style.cssText = 'width:100%;box-sizing:border-box;padding:6px;margin-bottom:8px;border-radius:6px;border:1px solid #2b2f45;background:#1a1c29;color:#ece7da;';

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;';
        var fromSelect = makeSelect(lastPair.from);
        var swapBtn = document.createElement('span');
        swapBtn.textContent = '⇄';
        swapBtn.style.cssText = 'cursor:pointer;color:#c99a3d;font-size:16px;';
        var toSelect = makeSelect(lastPair.to);
        row.appendChild(fromSelect);
        row.appendChild(swapBtn);
        row.appendChild(toSelect);

        var resultDiv = document.createElement('div');
        resultDiv.style.cssText = 'font-size:16px;font-weight:600;color:#e7c377;min-height:22px;';
        resultDiv.textContent = '...';

        var errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'color:#e05a4b;font-size:11px;margin-top:4px;';

        function doConvert() {
            var amount = parseFloat(amountInput.value) || 0;
            var from = fromSelect.value, to = toSelect.value;
            saveLastPair(from, to);
            errorDiv.textContent = '';
            resultDiv.textContent = 'Загрузка...';
            convert(amount, from, to).then(function (result) {
                resultDiv.textContent = amount + ' ' + from + ' = ' + result.toFixed(2) + ' ' + to;
            }).catch(function (err) {
                resultDiv.textContent = '';
                errorDiv.textContent = '❌ ' + (err.message || 'Ошибка конвертации');
            });
        }

        swapBtn.addEventListener('click', function () {
            var tmp = fromSelect.value;
            fromSelect.value = toSelect.value;
            toSelect.value = tmp;
            doConvert();
        });
        amountInput.addEventListener('input', doConvert);
        fromSelect.addEventListener('change', doConvert);
        toSelect.addEventListener('change', doConvert);

        panel.appendChild(amountInput);
        panel.appendChild(row);
        panel.appendChild(resultDiv);
        panel.appendChild(errorDiv);

        doConvert();
    }

    btn.addEventListener('click', function () {
        var visible = panel.style.display !== 'none';
        panel.style.display = visible ? 'none' : 'block';
        if (!visible && panel.innerHTML === '') {
            buildPanel();
        }
    });

    (document.body || document.documentElement).appendChild(btn);
    (document.body || document.documentElement).appendChild(panel);
})();
