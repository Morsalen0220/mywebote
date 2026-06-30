import React from "react"
import Sidebar from "./components/Sidebar"
import Editor from "./components/Editor"
import {
    onSnapshot,
    addDoc,
    doc,
    getDoc,
    deleteDoc,
    setDoc,
    collection
} from "firebase/firestore"
import { db } from "./firebase"
import {
    createSalt,
    createUserId,
    createVerifier,
    decryptText,
    deriveKey,
    encryptText,
    verifyPassword
} from "./crypto"
import {
    clearVaultSession,
    loadVaultSession,
    saveVaultSession
} from "./sessionStore"

function getPurgeAt(deletedAt) {
    const purgeDate = new Date(deletedAt)
    purgeDate.setFullYear(purgeDate.getFullYear() + 3)
    return purgeDate.getTime()
}

function getLegacyTitle(body) {
    const firstLine = body.split("\n").find(line => line.trim()) || "Untitled note"
    return firstLine.replace(/^#+\s*/, "").slice(0, 80) || "Untitled note"
}

export default function App() {
    const [session, setSession] = React.useState(null)
    const [isSessionLoading, setIsSessionLoading] = React.useState(true)
    const [authMode, setAuthMode] = React.useState("unlock")
    const [username, setUsername] = React.useState(
        localStorage.getItem("notesUsername") || ""
    )
    const [password, setPassword] = React.useState("")
    const [authError, setAuthError] = React.useState("")
    const [isUnlocking, setIsUnlocking] = React.useState(false)
    const [notes, setNotes] = React.useState([])
    const [currentNoteId, setCurrentNoteId] = React.useState("")
    const [tempNoteTitle, setTempNoteTitle] = React.useState("")
    const [tempNoteText, setTempNoteText] = React.useState("")
    const [syncError, setSyncError] = React.useState("")
    const [viewMode, setViewMode] = React.useState("notes")
    const [searchQuery, setSearchQuery] = React.useState("")
    const [isMobile, setIsMobile] = React.useState(
        () => window.matchMedia("(max-width: 760px)").matches
    )
    const [mobilePane, setMobilePane] = React.useState("list")

    const displayedNotes = React.useMemo(() => {
        const queryText = searchQuery.trim().toLowerCase()
        const notesForView = notes.filter(note =>
            viewMode === "trash" ? Boolean(note.deletedAt) : !note.deletedAt
        )

        return notesForView
            .filter(note => !queryText
                || note.title.toLowerCase().includes(queryText)
                || note.body.toLowerCase().includes(queryText)
            )
            .sort((a, b) => {
                if (viewMode === "notes" && a.isPinned !== b.isPinned) {
                    return Number(b.isPinned) - Number(a.isPinned)
                }

                return viewMode === "trash"
                    ? b.deletedAt - a.deletedAt
                    : b.updatedAt - a.updatedAt
            })
    }, [notes, searchQuery, viewMode])

    const currentNote =
        displayedNotes.find(note => note.id === currentNoteId)
        || displayedNotes[0]

    React.useEffect(() => {
        let isActive = true

        loadVaultSession()
            .then(savedSession => {
                if (isActive && savedSession) {
                    setSession(savedSession)
                }
            })
            .finally(() => {
                if (isActive) {
                    setIsSessionLoading(false)
                }
            })

        return () => {
            isActive = false
        }
    }, [])

    React.useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 760px)")
        const updateViewport = (event) => setIsMobile(event.matches)

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener("change", updateViewport)
        } else {
            mediaQuery.addListener(updateViewport)
        }

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener("change", updateViewport)
            } else {
                mediaQuery.removeListener(updateViewport)
            }
        }
    }, [])

    React.useEffect(() => {
        if (!session) {
            return
        }

        const userNotesCollection = collection(db, "users", session.userId, "notes")
        const unsubscribe = onSnapshot(userNotesCollection, async function (snapshot) {
            try {
                const activeDocuments = []

                for (const noteDoc of snapshot.docs) {
                    const noteData = noteDoc.data()
                    const purgeAt = noteData.purgeAt
                        || (noteData.deletedAt ? getPurgeAt(noteData.deletedAt) : null)

                    if (purgeAt && purgeAt <= Date.now()) {
                        await deleteDoc(noteDoc.ref)
                    } else {
                        activeDocuments.push(noteDoc)
                    }
                }

                const notesArr = await Promise.all(activeDocuments.map(async noteDoc => {
                    const noteData = noteDoc.data()
                    const body = await decryptText(noteData.body, session.key)
                    const title = noteData.title
                        ? await decryptText(noteData.title, session.key)
                        : getLegacyTitle(body)

                    return {
                        id: noteDoc.id,
                        title,
                        body,
                        createdAt: noteData.createdAt,
                        updatedAt: noteData.updatedAt,
                        isPinned: Boolean(noteData.isPinned),
                        deletedAt: noteData.deletedAt || null,
                        purgeAt: noteData.purgeAt || null
                    }
                }))

                setSyncError("")
                setNotes(notesArr)
            } catch {
                setSyncError("Could not decrypt notes. Check your username and master password.")
            }
        })

        return unsubscribe
    }, [session])
    
    React.useEffect(() => {
        if (!displayedNotes.length) {
            setCurrentNoteId("")
            return
        }

        if (!currentNoteId || !displayedNotes.some(note => note.id === currentNoteId)) {
            setCurrentNoteId(displayedNotes[0].id)
        }
    }, [displayedNotes, currentNoteId])
    
    React.useEffect(() => {
        if (currentNote) {
            setTempNoteTitle(currentNote.title)
            setTempNoteText(currentNote.body)
        } else {
            setTempNoteTitle("")
            setTempNoteText("")
        }
    }, [currentNote])
    
    React.useEffect(() => {
        if (
            !currentNoteId
            || !currentNote
            || currentNote.deletedAt
            || (tempNoteTitle === currentNote.title && tempNoteText === currentNote.body)
        ) {
            return
        }

        const timeoutId = setTimeout(() => {
            updateNote(tempNoteTitle, tempNoteText)
        }, 500)
        return () => clearTimeout(timeoutId)
    }, [tempNoteTitle, tempNoteText, currentNoteId, currentNote])

    async function createNewNote() {
        if (!session) {
            return
        }

        const title = "Untitled note"
        const body = ""
        const encryptedTitle = await encryptText(title, session.key)
        const encryptedBody = await encryptText(body, session.key)
        const newNote = {
            title: encryptedTitle,
            body: encryptedBody,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isPinned: false,
            deletedAt: null,
            purgeAt: null
        }
        const userNotesCollection = collection(db, "users", session.userId, "notes")
        const newNoteRef = await addDoc(userNotesCollection, newNote)
        setViewMode("notes")
        setSearchQuery("")
        setCurrentNoteId(newNoteRef.id)
        setMobilePane("editor")
    }

    async function updateNote(title, text) {
        if (!currentNoteId) {
            return
        }

        if (!session) {
            return
        }

        const encryptedTitle = await encryptText(title.trim() || "Untitled note", session.key)
        const encryptedBody = await encryptText(text, session.key)
        const docRef = doc(db, "users", session.userId, "notes", currentNoteId)
        await setDoc(
            docRef, 
            {
                title: encryptedTitle,
                body: encryptedBody,
                updatedAt: Date.now()
            },
            { merge: true }
        )
    }

    async function deleteNote(noteId) {
        if (!session) {
            return
        }

        const deletedAt = Date.now()
        const docRef = doc(db, "users", session.userId, "notes", noteId)
        await setDoc(docRef, {
            deletedAt,
            purgeAt: getPurgeAt(deletedAt),
            isPinned: false,
            updatedAt: deletedAt
        }, { merge: true })
    }

    async function restoreNote(noteId) {
        if (!session) {
            return
        }

        const docRef = doc(db, "users", session.userId, "notes", noteId)
        await setDoc(docRef, {
            deletedAt: null,
            purgeAt: null,
            updatedAt: Date.now()
        }, { merge: true })
        setViewMode("notes")
        setCurrentNoteId(noteId)
        setMobilePane("editor")
    }

    async function togglePin(noteId, isPinned) {
        if (!session) {
            return
        }

        const docRef = doc(db, "users", session.userId, "notes", noteId)
        await setDoc(docRef, {
            isPinned: !isPinned,
            updatedAt: Date.now()
        }, { merge: true })
    }

    async function submitAuth(event) {
        event.preventDefault()

        if (!username.trim() || !password) {
            setAuthError("Enter both username and master password.")
            return
        }

        setIsUnlocking(true)
        setAuthError("")

        try {
            const userId = await createUserId(username)
            const userRef = doc(db, "users", userId)
            const userSnap = await getDoc(userRef)

            if (authMode === "unlock" && !userSnap.exists()) {
                setAuthError("No account found. Create a new vault first.")
                return
            }

            if (authMode === "create" && userSnap.exists()) {
                setAuthError("This username already exists. Unlock it or choose another username.")
                return
            }

            const salt = userSnap.exists() ? userSnap.data().salt : createSalt()
            const key = await deriveKey(username, password, salt)

            if (authMode === "unlock") {
                const isValidPassword = await verifyPassword(key, userSnap.data().verifier)

                if (!isValidPassword) {
                    setAuthError("Wrong username or master password.")
                    return
                }
            }

            if (authMode === "create") {
                await setDoc(userRef, {
                    salt,
                    verifier: await createVerifier(key),
                    createdAt: Date.now()
                })
            }

            localStorage.setItem("notesUsername", username.trim())
            setPassword("")
            setNotes([])
            setCurrentNoteId("")
            setTempNoteTitle("")
            setTempNoteText("")
            setViewMode("notes")
            setSearchQuery("")
            setMobilePane("list")
            const nextSession = { username: username.trim(), userId, key }
            await saveVaultSession(nextSession)
            setSession(nextSession)
        } catch {
            setAuthError("Could not unlock notes. Try again.")
        } finally {
            setIsUnlocking(false)
        }
    }

    async function lockNotes() {
        setSession(null)
        setNotes([])
        setCurrentNoteId("")
        setTempNoteTitle("")
        setTempNoteText("")
        setPassword("")
        setSyncError("")
        setMobilePane("list")
        await clearVaultSession()
    }

    if (isSessionLoading) {
        return (
            <main className="session-loading">
                <p>Opening encrypted vault...</p>
            </main>
        )
    }

    if (!session) {
        return (
            <main className="login-screen">
                <form className="login-panel" onSubmit={submitAuth}>
                    <p className="login-kicker">Encrypted notes</p>
                    <h1>{authMode === "unlock" ? "Unlock vault" : "Create vault"}</h1>
                    <div className="auth-tabs">
                        <button
                            type="button"
                            className={authMode === "unlock" ? "active" : ""}
                            onClick={() => {
                                setAuthMode("unlock")
                                setAuthError("")
                            }}
                        >
                            Unlock
                        </button>
                        <button
                            type="button"
                            className={authMode === "create" ? "active" : ""}
                            onClick={() => {
                                setAuthMode("create")
                                setAuthError("")
                            }}
                        >
                            Create
                        </button>
                    </div>
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                    />
                    <label htmlFor="password">Master password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                    />
                    {authError && <p className="form-error">{authError}</p>}
                    <button className="unlock-btn" disabled={isUnlocking}>
                        {isUnlocking
                            ? authMode === "unlock" ? "Unlocking..." : "Creating..."
                            : authMode === "unlock" ? "Unlock vault" : "Create new vault"
                        }
                    </button>
                    <p className="login-note">
                        {authMode === "unlock"
                            ? "Use an existing username and master password."
                            : "Create as many separate vaults as you want with different usernames."
                        } If you forget the master password, notes cannot be recovered.
                    </p>
                </form>
            </main>
        )
    }

    const sidebar = (
        <Sidebar
            notes={displayedNotes}
            currentNote={currentNote}
            setCurrentNoteId={(noteId) => {
                setCurrentNoteId(noteId)
                setMobilePane("editor")
            }}
            newNote={createNewNote}
            deleteNote={deleteNote}
            restoreNote={restoreNote}
            togglePin={togglePin}
            username={session.username}
            lockNotes={lockNotes}
            viewMode={viewMode}
            setViewMode={(mode) => {
                setViewMode(mode)
                setCurrentNoteId("")
                setMobilePane("list")
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            notesCount={notes.filter(note => !note.deletedAt).length}
            trashCount={notes.filter(note => note.deletedAt).length}
        />
    )

    const content = currentNote
        ? <Editor
            tempNoteTitle={tempNoteTitle}
            setTempNoteTitle={setTempNoteTitle}
            tempNoteText={tempNoteText}
            setTempNoteText={setTempNoteText}
            isTrash={viewMode === "trash"}
            deletedAt={currentNote.deletedAt}
            purgeAt={currentNote.deletedAt
                ? currentNote.purgeAt || getPurgeAt(currentNote.deletedAt)
                : null
            }
            restoreNote={() => restoreNote(currentNote.id)}
            onBack={isMobile ? () => setMobilePane("list") : null}
        />
        : <section className="empty-pane">
            <h1>{viewMode === "trash" ? "Recycle Bin is empty" : "No notes found"}</h1>
            <p>
                {viewMode === "trash"
                    ? "Deleted notes stay here for three years."
                    : searchQuery ? "Try a different search." : "Create your first encrypted note."
                }
            </p>
            {viewMode === "notes" && !searchQuery && (
                <button className="first-note" onClick={createNewNote}>Create note</button>
            )}
        </section>

    return (
        <main className="app-shell">
            {syncError && <p className="sync-error">{syncError}</p>}
            {isMobile
                ? <div className="mobile-layout">
                    {mobilePane === "editor" && currentNote ? content : sidebar}
                </div>
                : <div className="desktop-layout">
                    {sidebar}
                    {content}
                </div>
            }
        </main>
    )
}
