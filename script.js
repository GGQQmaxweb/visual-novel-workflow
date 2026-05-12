document.addEventListener('DOMContentLoaded', () => {
    const editor = new NodeEditor();
    
    // UI Elements
    const addNodeBtn = document.getElementById('add-node');
    const exportBtn = document.getElementById('export-btn');
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
        noSelectionMsg.classList.add('hidden');
        nodeForm.classList.remove('hidden');
        
        // Populate form
        inputSpeaker.value = currentNode.speaker;
        inputText.value = currentNode.text;
        inputBg.value = currentNode.image || '';
        inputChar.value = currentNode.character || '';
        
        renderOptionsEditor();
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
    });

    exportBtn.addEventListener('click', () => {
        const data = editor.exportData();
        exportOutput.textContent = data;
        exportModal.classList.remove('hidden');
    });

    // Modal Actions
    closeModal.addEventListener('click', () => {
        exportModal.classList.add('hidden');
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(exportOutput.textContent);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy to Clipboard', 2000);
    });

    // Initial State
    editor.selectNode(1);
});
