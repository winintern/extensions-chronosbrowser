// Универсальная лёгкая DOM-заглушка для тестов виджетов. Поддерживает
// ровно то, что реально используется в content.js: createElement,
// appendChild (с отслеживанием children), textContent, style (no-op
// объект), addEventListener/click, innerHTML-сброс, а для select/option —
// value/selected.

function makeStyle() {
    const state = { display: undefined };
    return {
        get display() { return state.display; },
        set display(v) { state.display = v; },
        set cssText(v) {
            const m = v.match(/display\s*:\s*([a-z-]+)/i);
            if (m) state.display = m[1];
        },
        get cssText() { return ''; },
    };
}

function makeStubDocument() {
    function makeElement(tag) {
        const el = {
            tag,
            _children: [],
            _listeners: {},
            _textContent: '',
            style: makeStyle(),
            get textContent() { return this._textContent; },
            set textContent(v) { this._textContent = v; this._children = []; },
            get innerHTML() { return this._children.length ? '1' : ''; },
            set innerHTML(v) { if (v === '') this._children = []; },
            addEventListener(evt, fn) { (this._listeners[evt] = this._listeners[evt] || []).push(fn); },
            dispatch(evt) { (this._listeners[evt] || []).forEach(fn => fn()); },
            value: '',
            selected: false,
        };
        if (tag === 'select') {
            // Настоящий <select> отражает в .value значение того <option>,
            // у которого selected=true (а если явно никто не выбран —
            // первый добавленный option, как в реальном HTML).
            el.appendChild = function (child) {
                this._children.push(child);
                if (child.selected || this._children.length === 1) {
                    this.value = child.value;
                }
                return child;
            };
        } else {
            el.appendChild = function (child) { this._children.push(child); return child; };
        }
        return el;
    }

    const body = makeElement('body');
    return {
        body,
        documentElement: makeElement('html'),
        createElement: makeElement,
        self: {},
        top: {},
    };
}

module.exports = { makeStubDocument };
