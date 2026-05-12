class VNNode {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.speaker = "???";
        this.text = "New dialogue block...";
        this.image = "";
        this.character = "";
        this.options = []; // { text: string, nextText: id }
        this.nextText = null; // for single path nodes

        this.element = this.createHTMLElement();
        this.updateElement();
    }

    createHTMLElement() {
        const div = document.createElement('div');
        div.className = 'vn-node glass';
        div.id = `node-${this.id}`;
        div.style.left = `${this.x}px`;
        div.style.top = `${this.y}px`;

        div.innerHTML = `
            <div class="input-handle"></div>
            <div class="node-header">
                <span class="node-id">#${this.id}</span>
                <span class="node-speaker"></span>
            </div>
            <div class="node-content"></div>
            <div class="node-outputs"></div>
        `;

        return div;
    }

    updateElement() {
        this.element.querySelector('.node-speaker').textContent = this.speaker;
        this.element.querySelector('.node-content').textContent = this.text;

        const outputs = this.element.querySelector('.node-outputs');
        outputs.innerHTML = '';

        if (this.options.length > 0) {
            this.options.forEach((opt, index) => {
                const port = document.createElement('div');
                port.className = 'output-port';
                port.dataset.index = index;
                port.innerHTML = `
                    <span>${opt.text || `Option ${index + 1}`}</span>
                    <div class="port-handle" data-id="${this.id}" data-type="option" data-index="${index}"></div>
                `;
                outputs.appendChild(port);
            });
        } else {
            const port = document.createElement('div');
            port.className = 'output-port';
            port.innerHTML = `
                <span>Next</span>
                <div class="port-handle" data-id="${this.id}" data-type="next"></div>
            `;
            outputs.appendChild(port);
        }
    }
}

class NodeEditor {
    constructor() {
        this.nodes = new Map();
        this.connections = []; // { fromId: number, toId: number, type: 'next'|'option', optionIndex?: number }
        this.selectedNodeId = null;
        this.nextNodeId = 1;

        this.canvas = document.getElementById('canvas');
        this.svg = document.getElementById('svg-connections');
        this.container = document.getElementById('canvas-container');

        this.isDragging = false;
        this.dragNode = null;
        this.dragOffset = { x: 0, y: 0 };

        this.isLinking = false;
        this.linkStart = null; // { nodeId, type, optionIndex, handlePos }

        this.init();
    }

    init() {
        this.addNode(100, 100);

        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));

        // Canvas panning (simulated)
        this.container.addEventListener('mousedown', (e) => {
            if (e.target === this.container || e.target === this.canvas) {
                this.isPanning = true;
                this.lastPan = { x: e.clientX, y: e.clientY };
            }
        });
    }

    addNode(x, y) {
        const node = new VNNode(this.nextNodeId++, x, y);
        this.nodes.set(node.id, node);
        this.canvas.appendChild(node.element);

        node.element.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('port-handle')) {
                this.startLinking(e, node, e.target);
            } else {
                this.startDragging(e, node);
            }
            this.selectNode(node.id);
            e.stopPropagation();
        });

        // Target for linking
        node.element.querySelector('.input-handle').addEventListener('mouseup', (e) => {
            if (this.isLinking) {
                this.completeLink(node.id);
                e.stopPropagation();
            }
        });

        return node;
    }

    selectNode(id) {
        if (this.selectedNodeId) {
            this.nodes.get(this.selectedNodeId).element.classList.remove('selected');
        }
        this.selectedNodeId = id;
        this.nodes.get(id).element.classList.add('selected');

        // Update properties panel
        window.dispatchEvent(new CustomEvent('node-selected', { detail: this.nodes.get(id) }));
    }

    startDragging(e, node) {
        this.isDragging = true;
        this.dragNode = node;
        const rect = node.element.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startLinking(e, node, handle) {
        this.isLinking = true;
        const rect = handle.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();

        this.linkStart = {
            nodeId: node.id,
            type: handle.dataset.type,
            optionIndex: handle.dataset.index ? parseInt(handle.dataset.index) : null,
            x: rect.left + rect.width / 2 - canvasRect.left,
            y: rect.top + rect.height / 2 - canvasRect.top
        };
    }

    onMouseMove(e) {
        const canvasRect = this.canvas.getBoundingClientRect();

        if (this.isDragging && this.dragNode) {
            const x = e.clientX - canvasRect.left - this.dragOffset.x;
            const y = e.clientY - canvasRect.top - this.dragOffset.y;
            this.dragNode.x = x;
            this.dragNode.y = y;
            this.dragNode.element.style.left = `${x}px`;
            this.dragNode.element.style.top = `${y}px`;
            this.renderConnections();
        }

        if (this.isLinking) {
            this.renderTempLink(e.clientX - canvasRect.left, e.clientY - canvasRect.top);
        }

        if (this.isPanning) {
            const dx = e.clientX - this.lastPan.x;
            const dy = e.clientY - this.lastPan.y;
            this.container.scrollLeft -= dx;
            this.container.scrollTop -= dy;
            this.lastPan = { x: e.clientX, y: e.clientY };
        }
    }

    onMouseUp() {
        this.isDragging = false;
        this.isPanning = false;
        if (this.isLinking) {
            this.isLinking = false;
            this.removeTempLink();
        }
    }

    completeLink(toId) {
        if (!this.isLinking || this.linkStart.nodeId === toId) return;

        // Remove existing link from this source
        this.connections = this.connections.filter(conn =>
            !(conn.fromId === this.linkStart.nodeId &&
                conn.type === this.linkStart.type &&
                conn.optionIndex === this.linkStart.optionIndex)
        );

        this.connections.push({
            fromId: this.linkStart.nodeId,
            toId: toId,
            type: this.linkStart.type,
            optionIndex: this.linkStart.optionIndex
        });

        // Update node data
        const fromNode = this.nodes.get(this.linkStart.nodeId);
        if (this.linkStart.type === 'next') {
            fromNode.nextText = toId;
        } else {
            fromNode.options[this.linkStart.optionIndex].nextText = toId;
        }

        this.isLinking = false;
        this.removeTempLink();
        this.renderConnections();
    }

    renderConnections() {
        this.svg.innerHTML = '';
        this.connections.forEach(conn => {
            const fromNode = this.nodes.get(conn.fromId);
            const toNode = this.nodes.get(conn.toId);
            if (!fromNode || !toNode) return;

            const startPos = this.getPortPosition(fromNode, conn.type, conn.optionIndex);
            const endPos = this.getInputPosition(toNode);

            this.drawCurve(startPos.x, startPos.y, endPos.x, endPos.y);
        });
    }

    renderTempLink(tx, ty) {
        this.removeTempLink();
        const path = this.drawCurve(this.linkStart.x, this.linkStart.y, tx, ty, true);
        path.id = 'temp-link';
    }

    removeTempLink() {
        const temp = document.getElementById('temp-link');
        if (temp) temp.remove();
    }

    drawCurve(x1, y1, x2, y2, isTemp = false) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const cp1x = x1 + (x2 - x1) / 2;
        const cp2x = x1 + (x2 - x1) / 2;

        const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
        path.setAttribute("d", d);
        path.setAttribute("class", "connection-line");
        if (isTemp) path.style.opacity = '0.4';
        this.svg.appendChild(path);
        return path;
    }

    getPortPosition(node, type, optionIndex) {
        const handle = node.element.querySelector(
            type === 'next' ? '.port-handle' : `.port-handle[data-index="${optionIndex}"]`
        );
        const rect = handle.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - canvasRect.left,
            y: rect.top + rect.height / 2 - canvasRect.top
        };
    }

    getInputPosition(node) {
        const handle = node.element.querySelector('.input-handle');
        const rect = handle.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - canvasRect.left,
            y: rect.top + rect.height / 2 - canvasRect.top
        };
    }

    exportData() {
        const data = Array.from(this.nodes.values()).map(node => {
            const item = {
                id: node.id,
                speaker: node.speaker,
                text: node.text,
                image: node.image,
                character: node.character
            };

            if (node.options.length > 0) {
                item.options = node.options.map(opt => ({
                    text: opt.text,
                    nextText: opt.nextText
                }));
            } else if (node.nextText) {
                item.nextText = node.nextText;
            }

            return item;
        });
        return JSON.stringify(data, null, 4);
    }
}
