const encoder = new TextEncoder()
const decoder = new TextDecoder()
const verifierText = "notes-app-verifier"
const keyIterations = 250000

function bytesToBase64(bytes) {
    let binary = ""
    const byteArray = new Uint8Array(bytes)

    for (let i = 0; i < byteArray.length; i++) {
        binary += String.fromCharCode(byteArray[i])
    }

    return btoa(binary)
}

function base64ToBytes(base64) {
    return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

function normalizeUsername(username) {
    return username.trim().toLowerCase()
}

export async function createUserId(username) {
    const hash = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(normalizeUsername(username))
    )
    return bytesToBase64(hash)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "")
}

export function createSalt() {
    return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(username, password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(`${normalizeUsername(username)}:${password}`),
        "PBKDF2",
        false,
        ["deriveKey"]
    )

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: base64ToBytes(salt),
            iterations: keyIterations,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    )
}

export async function encryptText(text, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(text)
    )

    return {
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(ciphertext)
    }
}

export async function decryptText(encryptedValue, key) {
    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(encryptedValue.iv) },
        key,
        base64ToBytes(encryptedValue.ciphertext)
    )

    return decoder.decode(plaintext)
}

export async function createVerifier(key) {
    return encryptText(verifierText, key)
}

export async function verifyPassword(key, verifier) {
    try {
        return await decryptText(verifier, key) === verifierText
    } catch {
        return false
    }
}
