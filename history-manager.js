class HistoryManager {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.stack = [];
        this.pointer = -1;
    }

    loadFromStorage(data) {
        if (data && data.stack && data.pointer !== undefined) {
            this.stack = data.stack;
            this.pointer = data.pointer;
        }
    }

    exportForStorage() {
        return {
            stack: this.stack,
            pointer: this.pointer
        };
    }

    /**
     * Push a new state to the history.
     * If the pointer is not at the end of the stack, remove all states after the pointer.
     * @param {Object} state - The state to save.
     */
    push(state) {
        // Remove any future states if we were in the middle of undoing
        if (this.pointer < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.pointer + 1);
        }

        // Deep copy the state to prevent mutations affecting history
        const stateCopy = JSON.parse(JSON.stringify(state));

        // Avoid pushing identical consecutive states
        if (this.stack.length > 0 && JSON.stringify(this.stack[this.pointer]) === JSON.stringify(stateCopy)) {
            return;
        }

        this.stack.push(stateCopy);
        
        // Limit stack size
        if (this.stack.length > this.maxSize) {
            this.stack.shift();
        } else {
            this.pointer++;
        }
    }

    undo() {
        if (this.pointer > 0) {
            this.pointer--;
            return JSON.parse(JSON.stringify(this.stack[this.pointer]));
        }
        return null;
    }

    redo() {
        if (this.pointer < this.stack.length - 1) {
            this.pointer++;
            return JSON.parse(JSON.stringify(this.stack[this.pointer]));
        }
        return null;
    }

    getCurrentState() {
        if (this.pointer >= 0) {
            return JSON.parse(JSON.stringify(this.stack[this.pointer]));
        }
        return null;
    }

    canUndo() {
        return this.pointer > 0;
    }

    canRedo() {
        return this.pointer < this.stack.length - 1;
    }

    clear() {
        this.stack = [];
        this.pointer = -1;
    }
}
