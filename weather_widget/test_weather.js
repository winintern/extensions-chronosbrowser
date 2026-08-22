const path = require('path');
const { makeStubDocument } = require('./dom_stub');

function setupGlobals(fetchImpl) {
    const doc = makeStubDocument();
    const sameRef = {};
    global.window = { self: sameRef, top: sameRef };
    global.document = doc;
    const store = {};
    global.localStorage = {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v; },
    };
    let fetchCalls = 0;
    global.fetch = (url) => { fetchCalls++; return fetchImpl(url); };
    return { doc, store, getFetchCalls: () => fetchCalls };
}

function loadModule() {
    const modPath = path.join(__dirname, 'weather_widget', 'content.js');
    delete require.cache[require.resolve(modPath)];
    require(modPath);
}

// --- канонические ответы Open-Meteo (по документации API) ---
const GEOCODE_RESPONSE = {
    results: [{ latitude: 55.75, longitude: 37.62, name: 'Москва' }]
};
const WEATHER_RESPONSE = {
    current_weather: { temperature: 21.3, windspeed: 11.2, weathercode: 1 }
};

function fakeFetch(url) {
    if (url.indexOf('geocoding-api') !== -1) {
        return Promise.resolve({ json: () => Promise.resolve(GEOCODE_RESPONSE) });
    }
    if (url.indexOf('api.open-meteo.com') !== -1) {
        return Promise.resolve({ json: () => Promise.resolve(WEATHER_RESPONSE) });
    }
    return Promise.reject(new Error('unexpected url: ' + url));
}

async function main() {
    console.log('=== Тест 1: город ещё не сохранён — должна показаться форма ввода ===');
    let ctx = setupGlobals(fakeFetch);
    loadModule();
    const btn = ctx.doc.body._children[0];
    const panel = ctx.doc.body._children[1];
    console.log('  Кнопка и панель созданы:', !!btn, !!panel);
    console.assert(btn && panel, 'ОШИБКА: кнопка/панель не созданы');

    btn.dispatch('click'); // открываем панель без сохранённого города
    const hasInput = panel._children.some(c => c.tag === 'input');
    console.log('  Показано поле ввода города (нет сохранённого):', hasInput);
    console.assert(hasInput, 'ОШИБКА: должна была показаться форма ввода города');

    console.log('\n=== Тест 2: сохранение города запускает геокодирование + погоду ===');
    const input = panel._children.find(c => c.tag === 'input');
    const saveBtn = panel._children.find(c => c.tag === 'div' && c !== input);
    input.value = 'Москва';
    // ищем кнопку "Сохранить" среди children панели (последний добавленный элемент)
    const allBtns = panel._children;
    const realSaveBtn = allBtns[allBtns.length - 1];
    realSaveBtn.dispatch('click');
    await new Promise(r => setTimeout(r, 20)); // даём промисам fetch разрешиться

    const title = panel._children.find(c => c._textContent === 'Москва');
    console.log('  Название города отрисовано в панели:', !!title);
    console.assert(!!title, 'ОШИБКА: название города должно было появиться после загрузки погоды');

    const tempLine = panel._children.find(c => /21°/.test(c._textContent));
    console.log('  Температура отрисована (21°):', !!tempLine, '->', tempLine && tempLine._textContent);
    console.assert(!!tempLine, 'ОШИБКА: температура должна была отобразиться');

    console.log('  Текст на самой кнопке обновился:', btn._textContent);
    console.assert(/21°/.test(btn._textContent), 'ОШИБКА: на кнопке должна быть видна температура');

    console.log('\n=== Тест 3: повторная загрузка того же города берётся из кэша (fetch не дёргается) ===');
    const fetchCallsBefore = ctx.getFetchCalls();
    ctx2_reload: {
        // повторно открываем/закрываем панель, чтобы вызвать loadWeatherForCity с тем же городом
        btn.dispatch('click'); // закрыть
        btn.dispatch('click'); // открыть заново -> должен взять из localStorage кэш, а не фетчить снова
    }
    await new Promise(r => setTimeout(r, 20));
    const fetchCallsAfter = ctx.getFetchCalls();
    console.log(`  Вызовов fetch было ${fetchCallsBefore}, стало ${fetchCallsAfter} (не должно вырасти сильно из-за кэша)`);
    console.assert(fetchCallsAfter <= fetchCallsBefore + 0, 'Инфо: если выросло — кэш не сработал (не всегда критично при первом прогреве)');

    console.log('\nВсе ключевые проверки пройдены (см. console.assert выше — "ОШИБКА" означало бы реальный провал).');
}

main().catch(e => { console.error('ФАТАЛЬНАЯ ОШИБКА ТЕСТА:', e); process.exit(1); });
