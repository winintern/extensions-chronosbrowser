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
    return { doc, getFetchCalls: () => fetchCalls };
}

function loadModule() {
    const modPath = path.join(__dirname, 'currency_converter', 'content.js');
    delete require.cache[require.resolve(modPath)];
    require(modPath);
}

const RATES_RESPONSE = {
    result: 'success',
    base_code: 'USD',
    rates: { RUB: 95.4, EUR: 0.92, GBP: 0.79 }
};

function fakeFetch(url) {
    if (url.indexOf('open.er-api.com') !== -1) {
        return Promise.resolve({ json: () => Promise.resolve(RATES_RESPONSE) });
    }
    return Promise.reject(new Error('unexpected url: ' + url));
}

async function main() {
    console.log('=== Тест 1: открытие панели по умолчанию (USD -> RUB, 1 единица) считает верно ===');
    const ctx = setupGlobals(fakeFetch);
    loadModule();
    const btn = ctx.doc.body._children[0];
    const panel = ctx.doc.body._children[1];
    console.assert(btn && panel, 'ОШИБКА: кнопка/панель не созданы');

    btn.dispatch('click');
    await new Promise(r => setTimeout(r, 20));

    const resultDiv = panel._children.find(c => /=/.test(c._textContent));
    console.log('  Результат конвертации:', resultDiv && resultDiv._textContent);
    console.assert(resultDiv && /95\.40/.test(resultDiv._textContent), 'ОШИБКА: ожидали "1 USD = 95.40 RUB"');
    console.assert(resultDiv && resultDiv._textContent.indexOf('USD') !== -1 && resultDiv._textContent.indexOf('RUB') !== -1, 'ОШИБКА: в результате должны быть коды валют');

    console.log('\n=== Тест 2: отсутствие нужной валюты в ответе API даёт понятную ошибку, а не падение ===');
    const ctx2 = setupGlobals((url) => Promise.resolve({
        json: () => Promise.resolve({ result: 'success', base_code: 'USD', rates: { EUR: 0.92 } })
    }));
    loadModule();
    const btn2 = ctx2.doc.body._children[0];
    const panel2 = ctx2.doc.body._children[1];
    btn2.dispatch('click');
    await new Promise(r => setTimeout(r, 20));
    const errDiv = panel2._children.find(c => /❌/.test(c._textContent));
    console.log('  Сообщение об ошибке показано:', errDiv && errDiv._textContent);
    console.assert(!!errDiv, 'ОШИБКА: при отсутствии валюты в ответе должна показаться ошибка, а не тихий сбой');

    console.log('\nВсе ключевые проверки пройдены (см. console.assert выше — "ОШИБКА" означало бы реальный провал).');
}

main().catch(e => { console.error('ФАТАЛЬНАЯ ОШИБКА ТЕСТА:', e); process.exit(1); });
