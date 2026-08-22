// Тест реального content.js из youtube_adblock/ — файл не модифицируется,
// подсовывается минимальный DOM-стаб, достаточный для выполнения именно
// тех вызовов, которые в нём есть (querySelector, classList.contains, click).

const fs = require('fs');
const path = require('path');

function makeElement(tag, opts = {}) {
    return {
        tagName: tag,
        classList: {
            _classes: new Set((opts.classes || [])),
            contains(c) { return this._classes.has(c); }
        },
        clicked: false,
        click() { this.clicked = true; },
        muted: opts.muted || false,
        duration: opts.duration,
        currentTime: 0,
    };
}

function runScenario(name, { skipButtonPresent, adShowing, duration }) {
    const skipBtn = skipButtonPresent ? makeElement('button') : null;
    const player = makeElement('div', { classes: adShowing ? ['html5-video-player', 'ad-showing'] : ['html5-video-player'] });
    const video = makeElement('video', { duration });

    const selectorMap = {
        '.ytp-ad-skip-button': skipBtn,
        '.ytp-skip-ad-button': null,
        '.ytp-ad-skip-button-modern': null,
        '.ytp-ad-skip-button-container button': null,
        '.html5-video-player': player,
        'video.html5-main-video, video': video,
        'video': video,
    };

    global.document = {
        querySelector(sel) {
            return selectorMap[sel] !== undefined ? selectorMap[sel] : null;
        }
    };
    global.setInterval = (fn) => { fn(); return 1; }; // выполняем "тик" сразу, без реального таймера

    // сбрасываем модуль из require-кэша, чтобы IIFE выполнился заново с новым document
    const modPath = path.join(__dirname, 'youtube_adblock', 'content.js');
    delete require.cache[require.resolve(modPath)];
    require(modPath);

    const skipClicked = skipBtn ? skipBtn.clicked : false;
    const wasFastForwarded = video.duration && video.currentTime === video.duration;
    const wasMuted = video.muted === true;

    console.log(`\n=== ${name} ===`);
    console.log(`  Кнопка "Пропустить" нажата: ${skipClicked}`);
    console.log(`  Видео домотано до конца:    ${wasFastForwarded}`);
    console.log(`  Видео заглушено:            ${wasMuted}`);
    return { skipClicked, wasFastForwarded, wasMuted };
}

// Сценарий 1: реклама идёт, кнопка "Пропустить" уже появилась
const r1 = runScenario('Реклама с кнопкой "Пропустить"', { skipButtonPresent: true, adShowing: true, duration: 15 });
console.assert(r1.skipClicked === true, 'ОШИБКА: кнопка должна была быть нажата');

// Сценарий 2: реклама идёт, кнопки пропуска ещё нет (неотключаемый ролик)
const r2 = runScenario('Неотключаемая реклама (пока без кнопки)', { skipButtonPresent: false, adShowing: true, duration: 20 });
console.assert(r2.wasFastForwarded === true, 'ОШИБКА: видео должно было домотаться до конца');
console.assert(r2.wasMuted === true, 'ОШИБКА: видео должно было заглушиться');

// Сценарий 3: рекламы нет вообще — скрипт не должен ничего трогать
const r3 = runScenario('Реклама не идёт (обычное видео)', { skipButtonPresent: false, adShowing: false, duration: 300 });
console.assert(r3.wasFastForwarded === false, 'ОШИБКА: обычное видео не должно перематываться');
console.assert(r3.wasMuted === false, 'ОШИБКА: обычное видео не должно заглушаться');

console.log('\nВсе проверки пройдены (см. console.assert выше — если бы что-то не совпало, было бы видно "ОШИБКА").');
