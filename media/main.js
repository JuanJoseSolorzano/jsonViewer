// JSON Form Viewer - WebView frontend logic.
// Parses a JSON document and renders it as an editable HTML form, then
// serializes it back to JSON on save. Uses only the VS Code WebView API
// (acquireVsCodeApi) and plain DOM - no external frameworks.

/* global acquireVsCodeApi */
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  const editorEl = document.getElementById('editor');
  const emptyStateEl = document.getElementById('empty-state');
  const statusEl = document.getElementById('status');

  let parseError = null;
  let statusTimer = null;

  // -------------------------------------------------------------------------
  // Type helpers
  // -------------------------------------------------------------------------

  function jsonType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value; // 'string' | 'number' | 'boolean' | 'object'
  }

  function literalText(value, type) {
    if (type === 'null') return 'null';
    if (type === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  // Matches the JSON number grammar.
  function isNumberLiteral(text) {
    return /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text);
  }

  // Auto-detect the type of a user-entered string.
  function detectTypedValue(text) {
    const trimmed = text.trim();
    if (trimmed === 'true') return { type: 'boolean', value: true };
    if (trimmed === 'false') return { type: 'boolean', value: false };
    if (trimmed === 'null') return { type: 'null', value: null };
    if (trimmed === '') return { type: 'string', value: '' };
    if (isNumberLiteral(trimmed)) return { type: 'number', value: Number(trimmed) };
    return { type: 'string', value: text };
  }

  function restoreOriginal(type, literal) {
    switch (type) {
      case 'null': return null;
      case 'boolean': return literal === 'true';
      case 'number': return Number(literal);
      default: return literal; // string
    }
  }

  function valueFromInput(input) {
    const text = input.value;
    if (text === input.getAttribute('data-original-text')) {
      return restoreOriginal(input.getAttribute('data-original-type'), text);
    }
    return detectTypedValue(text).value;
  }

  function typeFromInput(input) {
    const text = input.value;
    if (text === input.getAttribute('data-original-text')) {
      return input.getAttribute('data-original-type');
    }
    return detectTypedValue(text).type;
  }

  function directChildren(el, selector) {
    return Array.prototype.filter.call(el.children, (c) => c.matches(selector));
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  function makeHeader(title, extraButtons) {
    const header = document.createElement('div');
    header.className = 'section-header';

    const toggle = document.createElement('button');
    toggle.className = 'collapse-toggle';
    toggle.textContent = '\u25BE'; // ▾
    toggle.title = 'Collapse / Expand';
    toggle.addEventListener('click', () => {
      const body = header.nextElementSibling;
      if (!body) return;
      const collapsed = body.classList.toggle('collapsed');
      toggle.textContent = collapsed ? '\u25B8' : '\u25BE'; // ▸ / ▾
      toggle.classList.toggle('collapsed', collapsed);
    });

    const label = document.createElement('span');
    label.className = 'section-title';
    label.textContent = title;

    header.appendChild(toggle);
    header.appendChild(label);
    (extraButtons || []).forEach((b) => header.appendChild(b));

    return header;
  }

  function createPrimitive(value) {
    const type = jsonType(value);
    const literal = literalText(value, type);

    const wrap = document.createElement('span');
    wrap.className = 'json-primitive';

    const badge = document.createElement('span');
    badge.className = 'type-badge type-' + type;
    badge.textContent = type;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'json-input';
    input.value = literal;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.setAttribute('data-original-type', type);
    input.setAttribute('data-original-text', literal);
    if (type === 'number') {
      input.inputMode = 'decimal';
    }

    input.addEventListener('input', () => {
      const detected = typeFromInput(input);
      badge.textContent = detected;
      badge.className = 'type-badge type-' + detected;
    });

    wrap.appendChild(badge);
    wrap.appendChild(input);
    return wrap;
  }

  function createObject(obj) {
    const root = document.createElement('div');
    root.className = 'json-object';

    root.appendChild(makeHeader('object'));
    const body = document.createElement('div');
    body.className = 'section-body';
    root.appendChild(body);

    const keys = Object.keys(obj);
    if (keys.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-note';
      empty.textContent = '{}';
      body.appendChild(empty);
    } else {
      keys.forEach((key) => {
        const field = document.createElement('div');
        field.className = 'json-field';

        const label = document.createElement('label');
        label.className = 'json-key';
        label.textContent = key;
        label.title = key;

        const valueWrap = document.createElement('div');
        valueWrap.className = 'json-value';
        valueWrap.appendChild(renderValue(obj[key]));

        field.appendChild(label);
        field.appendChild(valueWrap);
        body.appendChild(field);
      });
    }

    return root;
  }

  // Sensible default for a newly added array item, based on the first item.
  function defaultNewItem(arr) {
    if (arr.length === 0) return null;
    const first = arr[0];
    if (Array.isArray(first)) return [];
    if (first !== null && typeof first === 'object') {
      const clone = {};
      Object.keys(first).forEach((k) => {
        clone[k] = null;
      });
      return clone;
    }
    return first;
  }

  function createArray(arr) {
    const root = document.createElement('div');
    root.className = 'json-array';

    const addButton = document.createElement('button');
    addButton.className = 'add-item';
    addButton.textContent = '+ Add Item';
    addButton.title = 'Add a new item to the array';

    const header = makeHeader('array', [addButton]);
    root.appendChild(header);
    const body = document.createElement('div');
    body.className = 'section-body';
    root.appendChild(body);

    function refreshMeta() {
      directChildren(body, '.json-array-item').forEach((item, i) => {
        const idx = item.querySelector('.json-item-index');
        if (idx) idx.textContent = '[' + i + ']';
      });
    }

    function addItem(value) {
      const item = document.createElement('div');
      item.className = 'json-array-item';

      const index = document.createElement('span');
      index.className = 'json-item-index';

      const valueWrap = document.createElement('div');
      valueWrap.className = 'json-value';
      valueWrap.appendChild(renderValue(value));

      const remove = document.createElement('button');
      remove.className = 'remove-item';
      remove.textContent = '\u2715'; // ✕
      remove.title = 'Remove item';
      remove.addEventListener('click', () => {
        item.remove();
        refreshMeta();
      });

      item.appendChild(index);
      item.appendChild(valueWrap);
      item.appendChild(remove);
      body.appendChild(item);
      refreshMeta();
    }

    addButton.addEventListener('click', () => addItem(defaultNewItem(arr)));
    arr.forEach((v) => addItem(v));

    return root;
  }

  function renderValue(value) {
    const type = jsonType(value);
    if (type === 'array') return createArray(value);
    if (type === 'object') return createObject(value);
    return createPrimitive(value);
  }

  // -------------------------------------------------------------------------
  // Serialization (form -> JS value)
  // -------------------------------------------------------------------------

  function serializeNode(node) {
    if (!node) return null;
    if (node.classList.contains('json-object')) return serializeObject(node);
    if (node.classList.contains('json-array')) return serializeArray(node);
    if (node.classList.contains('json-primitive')) return serializePrimitive(node);
    return null;
  }

  function serializeObject(node) {
    const result = {};
    const body = node.querySelector('.section-body');
    directChildren(body, '.json-field').forEach((field) => {
      const key = field.querySelector('.json-key').textContent;
      result[key] = serializeNode(
        field.querySelector('.json-value').firstElementChild
      );
    });
    return result;
  }

  function serializeArray(node) {
    const result = [];
    const body = node.querySelector('.section-body');
    directChildren(body, '.json-array-item').forEach((item) => {
      result.push(
        serializeNode(item.querySelector('.json-value').firstElementChild)
      );
    });
    return result;
  }

  function serializePrimitive(node) {
    const input = node.querySelector('input.json-input');
    return input ? valueFromInput(input) : null;
  }

  // -------------------------------------------------------------------------
  // Top-level render / save
  // -------------------------------------------------------------------------

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showEmpty(html) {
    emptyStateEl.innerHTML = html;
    emptyStateEl.classList.remove('hidden');
  }

  function hideEmpty() {
    emptyStateEl.classList.add('hidden');
  }

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', !!isError);
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.textContent = '';
      statusEl.classList.remove('error');
    }, 3000);
  }

  function render(text) {
    editorEl.innerHTML = '';
    parseError = null;

    if (text.trim() === '') {
      editorEl.classList.add('hidden');
      showEmpty('<p>Empty document &mdash; nothing to display.</p>');
      return;
    }

    try {
      const value = JSON.parse(text);
      editorEl.appendChild(renderValue(value));
      editorEl.classList.remove('hidden');
      hideEmpty();
    } catch (err) {
      parseError = err;
      editorEl.classList.add('hidden');
      showEmpty(
        '<p class="error">Invalid JSON: ' + escapeHtml(err.message) + '</p>'
      );
    }
  }

  function setAllCollapsed(collapsed) {
    editorEl.querySelectorAll('.section-header').forEach((header) => {
      const body = header.nextElementSibling;
      if (!body) return;
      body.classList.toggle('collapsed', collapsed);
      const toggle = header.querySelector('.collapse-toggle');
      if (toggle) {
        toggle.textContent = collapsed ? '\u25B8' : '\u25BE';
        toggle.classList.toggle('collapsed', collapsed);
      }
    });
  }

  function save() {
    if (parseError) {
      setStatus('Cannot save: JSON is invalid.', true);
      return;
    }
    if (!editorEl.firstElementChild) {
      setStatus('Nothing to save.', true);
      return;
    }
    const value = serializeNode(editorEl.firstElementChild);
    const text = JSON.stringify(value, null, 2) + '\n';
    vscode.postMessage({ type: 'save', text });
    setStatus('Saved', false);
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  document.getElementById('save').addEventListener('click', save);
  document
    .getElementById('expand-all')
    .addEventListener('click', () => setAllCollapsed(false));
  document
    .getElementById('collapse-all')
    .addEventListener('click', () => setAllCollapsed(true));

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'update':
        render(message.text);
        return;
      default:
        return;
    }
  });

  // Ask the extension for the current document content on load.
  vscode.postMessage({ type: 'ready' });
})();
