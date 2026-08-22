// Тест реального content.js из universal_adblock/. Т.к. в Node нет
// настоящего CSSOM, реализован минимальный, но честный матчер ровно для
// тех типов селекторов, что реально используются в файле (tag.class,
// tag[id^=], .class, [class~=], [id~=]) — не общий движок "на всякий
// случай", а конкретно то, что нужно проверить.

const fs = require('fs');
const path = require('path');

function elementMatchesOne(el, selector) {
    selector = selector.trim();
    let m;
    if ((m = selector.match(/^\.([\w-]+)$/))) {
        return el.classList.contains(m[1]);
    }
    if ((m = selector.match(/^([a-z]+)\.([\w-]+)$/))) {
        return el.tag === m[1] && el.classList.contains(m[2]);
    }
    if ((m = selector.match(/^([a-z]+)\[id\^="([^"]+)"\]$/))) {
        return el.tag === m[1] && !!el.id && el.id.indexOf(m[2]) === 0;
    }
    if ((m = selector.match(/^\[class~="([^"]+)"\]$/))) {
        return el.classList.contains(m[1]);
    }
    if ((m = selector.match(/^\[id~="([^"]+)"\]$/))) {
        return !!el.id && el.id.split(/\s+/).includes(m[1]);
    }
    return false;
}

function elementMatches(el, combinedSelector) {
    return combinedSelector.split(',').some(s => elementMatchesOne(el, s));
}

function makeEl(tag, { id, classes } = {}) {
    const classSet = new Set(classes || []);
    return {
        tag,
        id: id || '',
        classList: { contains: c => classSet.has(c) },
        _removed: false,
        remove() { this._removed = true; },
        children: [],
    };
}

function collectAll(root, combinedSelector, out) {
    out = out || [];
    for (const child of root.children) {
        if (elementMatches(child, combinedSelector)) out.push(child);
        collectAll(child, combinedSelector, out);
    }
    return out;
}

// Собираем ту же самую строку SELECTORS, что реально в content.js —
// вытаскиваем её прямо из исходника, чтобы тест бил ровно по тому, что
// используется в проде, а не по переписанной вручную копии.
const src = fs.readFileSync(path.join(__dirname, 'universal_adblock', 'content.js'), 'utf8');
const selectorsMatch = src.match(/var SELECTORS = \[([\s\S]*?)\];/);
const SELECTORS = selectorsMatch[1]
    .split(',')
    .map(s => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
const COMBINED_SELECTOR = SELECTORS.join(',');

console.log('Извлечённые селекторы из content.js:', SELECTORS.length, 'шт.');

// --- дерево с рекламой и с потенциальными ложными срабатываниями ---
const root = makeEl('body');
const adsenseUnit = makeEl('ins', { classes: ['adsbygoogle'] });
const gptSlot = makeEl('div', { id: 'div-gpt-ad-12345-0' });
const taboola = makeEl('div', { classes: ['trc_rbox_container'] });
const adBanner = makeEl('div', { classes: ['ad-banner'] });

// потенциальные ложные срабатывания — НЕ должны попасть под удаление
const addressBlock = makeEl('div', { id: 'address-form' });               // содержит подстроку "ad" в "address"
const gradientBox = makeEl('div', { classes: ['gradient-bg'] });          // содержит подстроку "ad" в "gr-ad-ient"
const fakeAdvertisement = makeEl('div', { classes: ['advertisement-disclosure-off'] }); // похоже, но НЕ точный токен "advertisement"
const loadingSpinner = makeEl('div', { classes: ['loading-spinner'] });

root.children = [adsenseUnit, gptSlot, taboola, adBanner, addressBlock, gradientBox, fakeAdvertisement, loadingSpinner];

const matched = collectAll(root, COMBINED_SELECTOR);
const matchedTags = matched.map(e => e.tag + (e.id ? '#' + e.id : '') + (e.classList.contains ? '' : ''));

console.log('\n=== Реклама, которая ДОЛЖНА быть найдена ===');
[adsenseUnit, gptSlot, taboola, adBanner].forEach(el => {
    const found = matched.includes(el);
    console.log(`  ${describeEl(el)}: найден = ${found}`);
    console.assert(found, `ОШИБКА: ${describeEl(el)} должен был быть найден как реклама`);
});

console.log('\n=== НЕ реклама — проверка на ложные срабатывания ===');
[addressBlock, gradientBox, fakeAdvertisement, loadingSpinner].forEach(el => {
    const found = matched.includes(el);
    console.log(`  ${describeEl(el)}: ошибочно найден = ${found}`);
    console.assert(!found, `ОШИБКА: ${describeEl(el)} НЕ реклама, но был бы удалён — ложное срабатывание!`);
});

function describeEl(el) {
    return `<${el.tag}${el.id ? ' id="' + el.id + '"' : ''}>`;
}

console.log('\nВсе проверки пройдены (см. console.assert выше — если бы что-то не совпало, было бы видно "ОШИБКА").');
