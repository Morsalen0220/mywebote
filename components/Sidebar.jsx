import React from "react"
import "/style.css"

function formatDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(new Date(timestamp))
}

export default function Sidebar(props) {
    return (
        <aside className="pane sidebar">
            <div className="sidebar--header">
                <div className="account-name">
                    <h2>Notes</h2>
                    <p>{props.username}</p>
                </div>
                <button
                    className="new-note"
                    onClick={props.newNote}
                    title="Create note"
                    aria-label="Create note"
                >
                    +
                </button>
            </div>

            <div className="sidebar-tabs" role="tablist" aria-label="Note folders">
                <button
                    className={props.viewMode === "notes" ? "active" : ""}
                    onClick={() => props.setViewMode("notes")}
                >
                    Notes <span>{props.notesCount}</span>
                </button>
                <button
                    className={props.viewMode === "trash" ? "active" : ""}
                    onClick={() => props.setViewMode("trash")}
                >
                    Recycle Bin <span>{props.trashCount}</span>
                </button>
            </div>

            <label className="search-box">
                <span>Search</span>
                <input
                    type="search"
                    value={props.searchQuery}
                    onChange={(event) => props.setSearchQuery(event.target.value)}
                    placeholder="Title or note text"
                />
            </label>

            <div className="note-list">
                {props.notes.map(note => (
                    <article
                        key={note.id}
                        className={`note-list-item ${
                            note.id === props.currentNote?.id ? "selected-note" : ""
                        }`}
                        onClick={() => props.setCurrentNoteId(note.id)}
                    >
                        <div className="note-list-copy">
                            <div className="note-title-row">
                                <h3>{note.title || "Untitled note"}</h3>
                                {note.isPinned && <span className="pinned-label">Pinned</span>}
                            </div>
                            <p>{note.body.trim() || "Empty note"}</p>
                            <time>
                                {props.viewMode === "trash" ? "Deleted " : "Edited "}
                                {formatDate(props.viewMode === "trash" ? note.deletedAt : note.updatedAt)}
                            </time>
                        </div>
                        <div className="note-actions">
                            {props.viewMode === "trash" ? (
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        props.restoreNote(note.id)
                                    }}
                                >
                                    Restore
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            props.togglePin(note.id, note.isPinned)
                                        }}
                                    >
                                        {note.isPinned ? "Unpin" : "Pin"}
                                    </button>
                                    <button
                                        className="danger-text"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            props.deleteNote(note.id)
                                        }}
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </article>
                ))}
                {!props.notes.length && (
                    <div className="sidebar-empty">
                        <p>
                            {props.searchQuery
                                ? "No matching notes"
                                : props.viewMode === "trash" ? "Recycle Bin is empty" : "No notes yet"
                            }
                        </p>
                        {!props.searchQuery && props.viewMode === "notes" && (
                            <button onClick={props.newNote}>Create your first note</button>
                        )}
                    </div>
                )}
            </div>

            <div className="sidebar-footer">
                <span>Encrypted vault</span>
                <button className="lock-btn" onClick={props.lockNotes}>Lock</button>
            </div>
        </aside>
    )
}
