// frontend/js/api.js

export async function fetchAllData() {
    try {
        const response = await fetch('/v1/alldata');
        if (!response.ok) throw new Error('API-Fehler');
        return await response.ok ? response.json() : null;
    } catch (error) {
        console.error("Fehler beim API-Fetch:", error);
        return null;
    }
}

export async function fetchThreadData() {
    try {
        const response = await fetch('/v1/threads');
        return response.ok ? response.json() : null;
    } catch (error) {
        return null;
    }
}
