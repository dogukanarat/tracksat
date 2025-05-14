// TleManager.js

class TleManager {
    constructor() {
        this.tleData = new Map();
        this.loadFromCache();
    }

    loadFromCache() {
        try {
            const cachedData = localStorage.getItem('tleData');
            if (cachedData) {
                const parsedData = JSON.parse(cachedData);
                this.tleData = new Map(Object.entries(parsedData));
                console.log('TLE data loaded from cache:', this.tleData);
            }
            else {
                console.log('No cached TLE data found.');
            }

        } catch (error) {
            console.error('Error loading TLE data from cache:', error);
        }
    }

    saveToCache() {
        try {
            const dataObject = Object.fromEntries(this.tleData);
            localStorage.setItem('tleData', JSON.stringify(dataObject));
            console.log('TLE data saved to cache:', dataObject);
        } catch (error) {
            console.error('Error saving TLE data to cache:', error);
        }
    }

    addTle(tleEntry) {
        const normalizedName = tleEntry.name.trim().toLowerCase();
        if (this.tleData.has(normalizedName)) {
            return false;
        }

        this.tleData.set(normalizedName, {
            name: tleEntry.name.trim(),
            tle1: tleEntry.tle1.trim(),
            tle2: tleEntry.tle2.trim(),
            visibleOnMap: true // Add default visibility state
        });

        this.saveToCache();
        return true;
    }

    toggleVisibility(name) {
        const normalizedName = name.trim().toLowerCase();
        const entry = this.tleData.get(normalizedName);
        if (entry) {
            entry.visibleOnMap = !entry.visibleOnMap;
            this.saveToCache();
            return true;
        }
        return false;
    }

    removeTle(name) {
        const normalizedName = name.trim().toLowerCase();
        const result = this.tleData.delete(normalizedName);
        if (result) {
            this.saveToCache();
        }
        return result;
    }

    clearAll() {
        this.tleData.clear();
        this.saveToCache();
    }

    getAllTles() {
        return Array.from(this.tleData.values()).filter(entry => entry.visibleOnMap);
    }

    // ... rest of the methods remain unchanged
}

export const tleManager = new TleManager();
