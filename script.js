document.addEventListener('DOMContentLoaded', () => {
    const editor = new NodeEditor();
    
    // UI Elements
    const addNodeBtn = document.getElementById('add-node');
    const saveJsonBtn = document.getElementById('save-json');
    const importBtn = document.getElementById('import-btn');
    const exportTxtBtn = document.getElementById('export-txt');
    const fileInput = document.getElementById('file-input');
    
    const propertiesPanel = document.getElementById('properties-panel');
    const noSelectionMsg = document.getElementById('no-selection-msg');
    const nodeForm = document.getElementById('node-form');
    
    const inputSpeaker = document.getElementById('node-speaker');
    const inputText = document.getElementById('node-text');
    const inputBg = document.getElementById('node-bg');
    const inputChar = document.getElementById('node-char');
    const optionsList = document.getElementById('options-list');
    const addOptionBtn = document.getElementById('add-option');

    const exportModal = document.getElementById('export-modal');
    const exportOutput = document.getElementById('export-output');
    const copyBtn = document.getElementById('copy-btn');
    const closeModal = document.getElementById('close-modal');

    let currentNode = null;

    // Node Selection Handler
    window.addEventListener('node-selected', (e) => {
        currentNode = e.detail;
        if (!currentNode) {
            noSelectionMsg.classList.remove('hidden');
            nodeForm.classList.add('hidden');
            return;
        }
        noSelectionMsg.classList.add('hidden');
        nodeForm.classList.remove('hidden');
        
        // Populate form
        inputSpeaker.value = currentNode.speaker;
        inputText.value = currentNode.text;
        inputBg.value = currentNode.image || '';
        inputChar.value = currentNode.character || '';
        
        renderOptionsEditor();
    });

    window.addEventListener('node-deleted', () => {
        autoSave();
    });

    // Form Change Handlers
    const updateNode = () => {
        if (!currentNode) return;
        currentNode.speaker = inputSpeaker.value;
        currentNode.text = inputText.value;
        currentNode.image = inputBg.value;
        currentNode.character = inputChar.value;
        currentNode.updateElement();
        editor.renderConnections();
        autoSave();
    };

    [inputSpeaker, inputText, inputBg, inputChar].forEach(input => {
        input.addEventListener('input', updateNode);
    });

    // Options Management
    addOptionBtn.addEventListener('click', () => {
        if (!currentNode) return;
        // If transitioning from "next" to "options", clear existing links
        if (currentNode.options.length === 0) {
            editor.connections = editor.connections.filter(c => !(c.fromId === currentNode.id && c.type === 'next'));
            currentNode.nextText = null;
        }
        
        currentNode.options.push({ text: 'New Option', nextText: null });
        currentNode.updateElement();
        renderOptionsEditor();
        editor.renderConnections();
    });

    function renderOptionsEditor() {
        optionsList.innerHTML = '';
        currentNode.options.forEach((opt, index) => {
            const div = document.createElement('div');
            div.className = 'option-item';
            div.innerHTML = `
                <input type="text" value="${opt.text}" placeholder="Option text">
                <button class="remove-option" data-index="${index}">×</button>
            `;
            
            const input = div.querySelector('input');
            input.addEventListener('input', (e) => {
                currentNode.options[index].text = e.target.value;
                currentNode.updateElement();
                editor.renderConnections();
            });

            div.querySelector('.remove-option').addEventListener('click', () => {
                currentNode.options.splice(index, 1);
                // Cleanup connections
                editor.connections = editor.connections.filter(c => 
                    !(c.fromId === currentNode.id && c.type === 'option' && c.optionIndex === index)
                );
                // Shift indices for remaining connections
                editor.connections.forEach(c => {
                    if (c.fromId === currentNode.id && c.type === 'option' && c.optionIndex > index) {
                        c.optionIndex--;
                    }
                });
                
                currentNode.updateElement();
                renderOptionsEditor();
                editor.renderConnections();
            });

            optionsList.appendChild(div);
        });
    }

    // Header Actions
    addNodeBtn.addEventListener('click', () => {
        const x = editor.container.scrollLeft + 50;
        const y = editor.container.scrollTop + 50;
        const node = editor.addNode(x, y);
        editor.selectNode(node.id);
        autoSave();
    });

    saveJsonBtn.addEventListener('click', () => {
        const state = editor.getFullState();
        const blob = new Blob([JSON.stringify(state, null, 4)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vn_flow_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const state = JSON.parse(event.target.result);
                editor.loadFullState(state);
                autoSave();
            } catch (err) {
                alert('Failed to parse file: ' + err.message);
            }
        };
        reader.readAsText(file);
    });

    exportTxtBtn.addEventListener('click', () => {
        const data = editor.exportData();
        exportOutput.textContent = data;
        exportModal.classList.remove('hidden');
    });

    // Auto-save & Restore
    function autoSave() {
        const state = editor.getFullState();
        localStorage.setItem('vn_flow_temp_data', JSON.stringify(state));
    }

    function restore() {
        const saved = localStorage.getItem('vn_flow_temp_data');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                editor.loadFullState(state);
            } catch (err) {
                console.error('Failed to restore:', err);
            }
        }
    }

    // Modal Actions
    closeModal.addEventListener('click', () => {
        exportModal.classList.add('hidden');
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(exportOutput.textContent);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy to Clipboard', 2000);
    });

    // Global listeners for auto-save
    window.addEventListener('mouseup', () => {
        if (editor.isDragging || editor.isLinking) {
            // Wait for next tick to ensure state is updated
            setTimeout(autoSave, 0);
        }
    });

    // Keyboard Shortcuts
    let lastMousePos = { x: 100, y: 100 };
    window.addEventListener('mousemove', (e) => {
        const rect = editor.canvas.getBoundingClientRect();
        lastMousePos.x = e.clientX - rect.left;
        lastMousePos.y = e.clientY - rect.top;
    });

    let copiedNodeData = null;

    window.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();
        
        if (key === 'n') {
            e.preventDefault();
            const node = editor.addNode(lastMousePos.x - 50, lastMousePos.y - 20);
            editor.selectNode(node.id);
            autoSave();
        } else if (key === 'c') {
            if (editor.selectedNodeId) {
                const node = editor.nodes.get(editor.selectedNodeId);
                copiedNodeData = {
                    speaker: node.speaker,
                    text: node.text,
                    image: node.image,
                    character: node.character,
                    options: JSON.parse(JSON.stringify(node.options))
                };
                // Reset next links in copied options
                copiedNodeData.options.forEach(opt => opt.nextText = null);
                console.log('Node copied:', copiedNodeData);
            }
        } else if (key === 'p') {
            if (copiedNodeData) {
                e.preventDefault();
                const node = editor.addNode(lastMousePos.x - 50, lastMousePos.y - 20);
                node.speaker = copiedNodeData.speaker;
                node.text = copiedNodeData.text;
                node.image = copiedNodeData.image;
                node.character = copiedNodeData.character;
                node.options = JSON.parse(JSON.stringify(copiedNodeData.options));
                node.updateElement();
                editor.selectNode(node.id);
                autoSave();
                console.log('Node pasted at', lastMousePos);
            }
        } else if (key === 's') {
            e.preventDefault();
            saveJsonBtn.click();
        } else if (key === 'e') {
            e.preventDefault();
            exportTxtBtn.click();
        } else if (key === 'delete' || key === 'backspace') {
            if (editor.selectedNodeId) {
                e.preventDefault();
                editor.deleteNode(editor.selectedNodeId);
            }
        }
    });

    // Initial State
    restore();
    if (editor.nodes.size === 0) {
        editor.addNode(100, 100);
        editor.selectNode(1);
    }
});
