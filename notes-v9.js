if(window.FakeDevToolsActive) return;
    window.FakeDevToolsActive = true;

    const d = document,
          b = d.body,
          isDarkMode = localStorage.getItem('fakeDevToolsTheme') !== 'light',
          savedState = JSON.parse(localStorage.getItem('fakeDevToolsNotesGlobal') || '{}');

    if(!savedState.top) savedState.top = [];

    let currentTopTab = null,
        topTabs = [],
        topCount = 0,
        dockedLeft = false;

    // Inject Styles
    const style = d.createElement('style');
    style.textContent = `
        .fdt-container { all: initial }
        .fdt-panel {
            font-family: -apple-system, BlinkMacSystemFont, monospace;
            z-index: 2147483647 !important;
            position: fixed !important;
            display: flex !important;
            flex-direction: column !important;
            box-shadow: 0 0 15px rgba(0,0,0,0.5) !important;
            overflow: hidden !important;
            top: 0 !important;
            height: 100vh !important;
            width: 500px;
            min-width: 300px;
            max-width: 80vw;
            transition: left 0.2s ease, right 0.2s ease;
        }
        .fdt-docked-left { left: 0 !important; right: auto !important; }
        .fdt-docked-right { right: 0 !important; left: auto !important; }
        .fdt-resize-handle-left,
        .fdt-resize-handle-right {
            position: absolute;
            top: 0; bottom: 0; width: 8px; z-index: 9999;
            cursor: ew-resize; background: transparent;
        }
        .fdt-resize-handle-left { left: 0; }
        .fdt-resize-handle-right { right: 0; }
        .fdt-header {
            display: flex !important;
            align-items: center !important;
            padding: 6px 8px !important;
            background: var(--bg-header) !important;
            color: var(--text) !important;
            gap: 4px;
            min-height: 36px;
            overflow-x: auto;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .fdt-close-btn {
            background: #ff5555 !important;
            color: white !important;
            border: none !important;
            border-radius: 4px !important;
            padding: 2px 8px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            margin-left: auto !important;
        }
        .fdt-theme-toggle,
        .fdt-dock-toggle,
        .fdt-add-tab {
            background: var(--bg-accent) !important;
            color: var(--text) !important;
            border: none !important;
            border-radius: 4px !important;
            padding: 2px 8px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            margin-left: 4px !important;
        }
        .fdt-dock-toggle { color: white !important; }
        .fdt-tab-container {
            display: flex;
            gap: 2px;
            overflow-x: auto;
            flex-shrink: 0;
            padding: 4px 0;
            max-height: 120px;
        }
        .fdt-tab {
            padding: 4px 10px !important;
            margin: 0 2px !important;
            background: var(--bg-tab-inactive) !important;
            color: var(--text) !important;
            border-radius: 4px 4px 0 0 !important;
            cursor: pointer !important;
            font-size: 12px !important;
            position: relative !important;
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .fdt-tab.active { background: var(--bg-tab-active) !important; }
        .fdt-tab .delete {
            opacity: 0;
            margin-left: 6px;
            cursor: pointer;
            color: #ff7777;
        }
        .fdt-tab:hover .delete { opacity: 1; }
        .fdt-content {
            flex: 1 !important;
            padding: 12px !important;
            background: var(--bg-content) !important;
            overflow: auto !important;
            min-height: 0;
        }
        .fdt-editor {
            width: 100% !important;
            height: 100% !important;
            background: transparent !important;
            color: var(--text) !important;
            border: none !important;
            outline: none !important;
            font-family: monospace !important;
            resize: vertical !important;
            min-height: 200px;
            padding: 8px !important;
            white-space: pre-wrap !important;
            line-height: 1.5;
        }
        /* NEW: Page Wrapper */
        #fdt-page-wrapper {
            display: flex;
            height: 100%;
            transition: margin-left 0.2s ease, margin-right 0.2s ease;
        }
        #fdt-page-wrapper.fdt-pushed-left { margin-left: 500px; }
        #fdt-page-wrapper.fdt-pushed-right { margin-right: 500px; }
        .fdt-dark {
            --bg-header: #2d2d2d;
            --bg-content: #1e1e1e;
            --bg-tab-active: #141414;
            --bg-tab-inactive: #3c3c3c;
            --bg-accent: #4a6ee0;
            --text: #e0e0e0;
        }
        .fdt-light {
            --bg-header: #f0f0f0;
            --bg-content: #ffffff;
            --bg-tab-active: #e0e0e0;
            --bg-tab-inactive: #d0d0d0;
            --bg-accent: #2a5ae0;
            --text: #222222;
        }
    `;
    d.head.appendChild(style);

    // Create Wrapper Around Page Content
    function createPageWrapper() {
        if (d.getElementById('fdt-page-wrapper')) return;
        const wrapper = d.createElement('div');
        wrapper.id = 'fdt-page-wrapper';
        // Move all body children into wrapper
        while (b.firstChild) {
            wrapper.appendChild(b.firstChild);
        }
        b.appendChild(wrapper);
    }

    function setTheme(dark) {
        localStorage.setItem('fakeDevToolsTheme', dark ? 'dark' : 'light');
        topPanel.className = `fdt-panel fdt-${dockedLeft ? 'docked-left' : 'docked-right'} fdt-${dark ? 'dark' : 'light'}`;
        updateLayout();
    }

    function toggleDock() {
        dockedLeft = !dockedLeft;
        localStorage.setItem('fakeDevToolsDock', dockedLeft ? 'left' : 'right');
        topPanel.className = `fdt-panel fdt-${dockedLeft ? 'docked-left' : 'docked-right'} fdt-${isDarkMode ? 'dark' : 'light'}`;
        updateLayout();
    }

    function updateLayout() {
        const wrapper = d.getElementById('fdt-page-wrapper');
        if (!wrapper) return;

        wrapper.classList.remove('fdt-pushed-left', 'fdt-pushed-right');
        if (dockedLeft) {
            wrapper.classList.add('fdt-pushed-left');
        } else {
            wrapper.classList.add('fdt-pushed-right');
        }

        // Sync wrapper margin with actual panel width (for resize support)
        const panelWidth = parseInt(getComputedStyle(topPanel).width) || 500;
        if (dockedLeft) {
            wrapper.style.marginLeft = panelWidth + 'px';
            wrapper.style.marginRight = '';
        } else {
            wrapper.style.marginRight = panelWidth + 'px';
            wrapper.style.marginLeft = '';
        }
    }

    // Create Panel
    dockedLeft = localStorage.getItem('fakeDevToolsDock') === 'left';
    const topPanel = d.createElement('div');
    topPanel.className = `fdt-panel fdt-${dockedLeft ? 'docked-left' : 'docked-right'} fdt-${isDarkMode ? 'dark' : 'light'}`;
    topPanel.innerHTML = `
        <div class="fdt-header">
            <button class="fdt-close-btn">×</button>
            <button class="fdt-theme-toggle">🌓</button>
            <button class="fdt-dock-toggle">↔</button>
            <div class="fdt-tab-container"></div>
            <button class="fdt-add-tab">+</button>
        </div>
        <div class="fdt-content"></div>
    `;

    // Inject wrapper BEFORE appending panel
    createPageWrapper();
    b.appendChild(topPanel);
    updateLayout();

    // Resize Handles
    const leftHandle = d.createElement('div'),
          rightHandle = d.createElement('div');
    leftHandle.className = 'fdt-resize-handle-left';
    rightHandle.className = 'fdt-resize-handle-right';
    topPanel.appendChild(leftHandle);
    topPanel.appendChild(rightHandle);

    const topHeader = topPanel.querySelector('.fdt-header'),
          topContent = topPanel.querySelector('.fdt-content'),
          topTabContainer = topHeader.querySelector('.fdt-tab-container');

    topHeader.querySelector('.fdt-theme-toggle').addEventListener('click', () => setTheme(!isDarkMode));
    topHeader.querySelector('.fdt-close-btn').addEventListener('click', destroy);
    topHeader.querySelector('.fdt-dock-toggle').addEventListener('click', toggleDock);
    topHeader.querySelector('.fdt-add-tab').addEventListener('click', () => {
        if (topCount < 5) addTab();
        else alert('Max 5 tabs.');
    });

    function addTab() {
        const id = Math.random().toString(36).slice(2),
              name = `Note ${topCount + 1}`,
              tab = d.createElement('div');
        tab.className = 'fdt-tab';
        tab.dataset.id = id;
        tab.innerHTML = `<span contenteditable="true" spellcheck="false">${name}</span><span class="delete">×</span>`;

        const editor = d.createElement('textarea');
        editor.className = 'fdt-editor';
        editor.placeholder = 'Write your note...';

        const container = d.createElement('div');
        container.style.display = 'none';
        container.appendChild(editor);

        topTabs.push({ id, tab, container, name });
        topCount++;
        topTabContainer.appendChild(tab);
        topContent.appendChild(container);

        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete')) return;
            switchTab(id);
        });

        tab.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this tab? This cannot be undone.')) deleteTab(id);
        });

        const titleSpan = tab.querySelector('span[contenteditable]');
        titleSpan.addEventListener('input', saveState);
        editor.addEventListener('input', saveState);

        switchTab(id);
        saveState();
    }

    function switchTab(id) {
        const target = topTabs.find(t => t.id === id);
        if (!target) return;
        topTabs.forEach(t => {
            t.tab.classList.remove('active');
            t.container.style.display = 'none';
        });
        target.tab.classList.add('active');
        target.container.style.display = 'block';
        currentTopTab = id;
    }

    function deleteTab(id) {
        const idx = topTabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        const target = topTabs[idx];
        target.tab.remove();
        target.container.remove();
        topTabs.splice(idx, 1);
        topCount--;
        if (currentTopTab === id) {
            currentTopTab = null;
            if (topCount > 0) switchTab(topTabs[0].id);
            else topContent.innerHTML = '';
        }
        saveState();
    }

    function saveState() {
        const state = {
            top: topTabs.map(t => ({
                id: t.id,
                name: t.tab.querySelector('span').textContent,
                content: t.container.querySelector('textarea').value
            }))
        };
        localStorage.setItem('fakeDevToolsNotesGlobal', JSON.stringify(state));
    }

    function restoreState() {
        savedState.top.forEach(note => createRestoredTab(note));
    }

    function createRestoredTab(note) {
        const id = note.id,
              tab = d.createElement('div');
        tab.className = 'fdt-tab';
        tab.dataset.id = id;
        tab.innerHTML = `<span contenteditable="true" spellcheck="false">${note.name}</span><span class="delete">×</span>`;

        const editor = d.createElement('textarea');
        editor.className = 'fdt-editor';
        editor.placeholder = 'Write your note...';
        editor.value = note.content;

        const container = d.createElement('div');
        container.style.display = 'none';
        container.appendChild(editor);

        topTabs.push({ id, tab, container, name: note.name });
        topTabContainer.appendChild(tab);
        topContent.appendChild(container);

        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete')) return;
            switchTab(id);
        });

        tab.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this tab? This cannot be undone.')) deleteTab(id);
        });

        const titleSpan = tab.querySelector('span[contenteditable]');
        titleSpan.addEventListener('input', saveState);
        editor.addEventListener('input', saveState);

        topCount++;
        if (topCount === 1) switchTab(id);
    }

    function destroy() {
        const wrapper = d.getElementById('fdt-page-wrapper');
        if (wrapper) {
            // Unwrap content
            while (wrapper.firstChild) {
                b.appendChild(wrapper.firstChild);
            }
            wrapper.remove();
        }
        topPanel.remove();
        style.remove();
        window.FakeDevToolsActive = false;
    }

    // Resizing Logic
    let startX, startWidth;
    function initResize(handle, leftSide) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            startWidth = parseInt(getComputedStyle(topPanel).width);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            function onMouseMove(e) {
                let delta = e.clientX - startX;
                if (leftSide) delta = -delta;
                let newWidth = startWidth + delta;
                if (newWidth >= 300 && newWidth <= window.innerWidth * 0.8) {
                    topPanel.style.width = newWidth + 'px';
                    updateLayout(); // 👈 Updates wrapper margin to match panel width
                }
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                savePanelWidth(newWidth); // Optional: persist width in localStorage
            }
        });
    }

    function savePanelWidth(width) {
        localStorage.setItem('fakeDevToolsWidth', width);
    }

    function loadPanelWidth() {
        const saved = localStorage.getItem('fakeDevToolsWidth');
        if (saved) {
            const width = parseInt(saved);
            if (width >= 300 && width <= window.innerWidth * 0.8) {
                topPanel.style.width = width + 'px';
                updateLayout();
            }
        }
    }

    initResize(leftHandle, true);
    initResize(rightHandle, false);

    setTheme(isDarkMode);
    restoreState();
    loadPanelWidth(); // Load saved width if exists
