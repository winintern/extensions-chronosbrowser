// Тест реального content.js из universal_dark_theme/ — файл не меняется,
// подсовывается минимальная DOM/localStorage-заглушка.

const fs = require('fs');
const path = require('path');

function makeClassList(initial) {
    const set = new Set(initial || []);
    return {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
    };
}

function makeStyleStore() {
    const store = {};
    return new Proxy(store, {
        set(target, prop, value) { target[prop] = value; return true; },
        get(target, prop) { return target[prop]; }
    });
}

function makeLocalStorage() {
    const store = {};
    return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v; },
        _dump: () => ({ ...store }),
    };
}

function runScenario(name, { bodyBgColor, htmlBgColor, storedPreference }) {
    const styleElements = [];
    const appendedChildren = [];

    const htmlEl = {
        classList: makeClassList(),
        _bg: htmlBgColor,
        appendChild(el) { appendedChildren.push(el); if (el._isStyle) styleElements.push(el); },
    };
    const bodyEl = {
        _bg: bodyBgColor,
        appendChild(el) { appendedChildren.push(el); },
    };

    let readyState = 'complete';
    const listeners = {};

    global.document = {
        get readyState() { return readyState; },
        documentElement: htmlEl,
        body: bodyEl,
        addEventListener(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
        getElementById(id) {
            return styleElements.find(s => s.id === id) ||
                   (toggleBtnRef && toggleBtnRef.id === id ? toggleBtnRef : null) || null;
        },
        createElement(tag) {
            if (tag === 'style') {
                const el = { _isStyle: true, id: '', textContent: '', remove() {
                    const idx = styleElements.indexOf(el);
                    if (idx !== -1) styleElements.splice(idx, 1);
                } };
                return el;
            }
            // <div> для кнопки-переключателя
            const el = {
                id: '', style: {}, _listeners: {},
                addEventListener(evt, fn) { (el._listeners[evt] = el._listeners[evt] || []).push(fn); },
                click() { (el._listeners['click'] || []).forEach(fn => fn()); },
            };
            toggleBtnRef = el;
            return el;
        },
    };
    let toggleBtnRef = null;

    global.getComputedStyle = (el) => ({ backgroundColor: el._bg });
    global.location = { hostname: 'test.example.com' };
    global.localStorage = makeLocalStorage();
    if (storedPreference) {
        global.localStorage.setItem('chronos_darkmode_test.example.com', storedPreference);
    }

    const modPath = path.join(__dirname, 'universal_dark_theme', 'content.js');
    delete require.cache[require.resolve(modPath)];
    require(modPath);

    const isDarkApplied = styleElements.some(s => s.id === 'chronos-dark-mode-style');
    const buttonExists = toggleBtnRef !== null;

    console.log(`\n=== ${name} ===`);
    console.log(`  Тёмная тема применена: ${isDarkApplied}`);
    console.log(`  Кнопка-переключатель создана: ${buttonExists}`);

    return { isDarkApplied, toggleBtnRef, htmlEl };
}

// Сценарий 1: светлая страница (белый фон) — тема должна включиться сама
const r1 = runScenario('Светлый сайт (rgb(255,255,255))', { bodyBgColor: 'rgb(255, 255, 255)', htmlBgColor: 'rgb(255, 255, 255)' });
console.assert(r1.isDarkApplied === true, 'ОШИБКА: на светлом сайте тема должна включиться автоматически');

// Сценарий 2: уже тёмный сайт — трогать не должны
const r2 = runScenario('Уже тёмный сайт (rgb(18,18,18))', { bodyBgColor: 'rgb(18, 18, 18)', htmlBgColor: 'rgb(18, 18, 18)' });
console.assert(r2.isDarkApplied === false, 'ОШИБКА: уже тёмный сайт не должен перекрашиваться');

// Сценарий 3: пользователь явно выключил тему на этом сайте ранее — должно остаться выключено, даже если сайт светлый
const r3 = runScenario('Светлый сайт, но пользователь выключил вручную', { bodyBgColor: 'rgb(255, 255, 255)', htmlBgColor: 'rgb(255, 255, 255)', storedPreference: 'off' });
console.assert(r3.isDarkApplied === false, 'ОШИБКА: явный выбор пользователя "off" должен уважаться');

// Сценарий 4: клик по кнопке переключает состояние
const r4 = runScenario('Клик по кнопке на тёмном сайте (ручное включение)', { bodyBgColor: 'rgb(18, 18, 18)', htmlBgColor: 'rgb(18, 18, 18)' });
console.assert(r4.isDarkApplied === false, 'до клика тема должна быть выключена (сайт и так тёмный)');
r4.toggleBtnRef.click();
const afterClickApplied = r4.htmlEl.classList.contains('chronos-dark-root');
console.log(`  После клика по кнопке тема включена: ${afterClickApplied}`);
console.assert(afterClickApplied === true, 'ОШИБКА: клик по кнопке должен включить тему вручную');

console.log('\nВсе проверки пройдены (см. console.assert выше — если бы что-то не совпало, было бы видно "ОШИБКА").');
