const databaseName = "encrypted-notes-session"
const storeName = "vault-session"
const sessionKey = "active"
const sessionMarker = "encryptedNotesUnlocked"

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1)

        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(storeName)) {
                request.result.createObjectStore(storeName)
            }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

function runTransaction(mode, operation) {
    return openDatabase().then(database => new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode)
        const store = transaction.objectStore(storeName)
        const request = operation(store)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => database.close()
        transaction.onerror = () => reject(transaction.error)
    }))
}

export async function saveVaultSession(session) {
    await runTransaction("readwrite", store => store.put(session, sessionKey))
    sessionStorage.setItem(sessionMarker, "1")
}

export async function loadVaultSession() {
    if (sessionStorage.getItem(sessionMarker) !== "1") {
        return null
    }

    try {
        return await runTransaction("readonly", store => store.get(sessionKey))
    } catch {
        sessionStorage.removeItem(sessionMarker)
        return null
    }
}

export async function clearVaultSession() {
    sessionStorage.removeItem(sessionMarker)

    try {
        await runTransaction("readwrite", store => store.delete(sessionKey))
    } catch {
        // The in-memory session is still cleared even if browser storage is unavailable.
    }
}
