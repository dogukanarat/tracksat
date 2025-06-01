import { EventEmitter } from './events';

class ObserverManager extends EventEmitter {
    constructor() {
        super();
        this.observers = this.loadObservers();
    }

    loadObservers() {
        const stored = localStorage.getItem('observers');
        return stored ? JSON.parse(stored) : [];
    }

    saveObservers() {
        localStorage.setItem('observers', JSON.stringify(this.observers));
        this.emit('observers-updated', this.observers);
    }

    addObserver(observer) {
        if (!observer.name || !observer.latitude || !observer.longitude) {
            throw new Error('Observer must have name, latitude, and longitude');
        }
        
        if (this.observers.find(o => o.name === observer.name)) {
            throw new Error('Observer with this name already exists');
        }

        this.observers.push(observer);
        this.saveObservers();
        this.emit('observer-added', observer);
    }

    removeObserver(name) {
        const observer = this.observers.find(o => o.name === name);
        if (observer) {
            this.observers = this.observers.filter(o => o.name !== name);
            this.saveObservers();
            this.emit('observer-removed', observer);
        }
    }

    getAllObservers() {
        return this.observers;
    }
}

export const observerManager = new ObserverManager();
