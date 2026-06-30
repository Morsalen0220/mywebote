import React from "react"
import ReactMde from "react-mde"
import Showdown from "showdown"

// Removed these files from the code as needed in scrimba only
// import R from "react-mde"
// const ReactMde = R.default

function formatDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(new Date(timestamp))
}

export default function Editor({
    tempNoteTitle,
    setTempNoteTitle,
    tempNoteText,
    setTempNoteText,
    isTrash,
    deletedAt,
    purgeAt,
    restoreNote,
    onBack
}) {
    const [selectedTab, setSelectedTab] = React.useState("write")

    const converter = new Showdown.Converter({
        tables: true,
        simplifiedAutoLink: true,
        strikethrough: true,
        tasklists: true,
    })  

    if (isTrash) {
        return (
            <section className="pane editor trash-view">
                {onBack && (
                    <button className="mobile-back" onClick={onBack}>Back to notes</button>
                )}
                <div className="trash-toolbar">
                    <div>
                        <p>Deleted {formatDate(deletedAt)}</p>
                        <span>Scheduled for removal after {formatDate(purgeAt)}</span>
                    </div>
                    <button onClick={restoreNote}>Restore note</button>
                </div>
                <div className="trash-content">
                    <h1>{tempNoteTitle || "Untitled note"}</h1>
                    <pre>{tempNoteText || "Empty note"}</pre>
                </div>
            </section>
        )
    }

    return (
        <section className="pane editor">
            <div className="editor-titlebar">
                {onBack && (
                    <button className="mobile-back" onClick={onBack}>Back</button>
                )}
                <input
                    className="note-title-input"
                    value={tempNoteTitle}
                    onChange={(event) => setTempNoteTitle(event.target.value)}
                    placeholder="Note title"
                    aria-label="Note title"
                    maxLength={120}
                />
            </div>
            <ReactMde
                value={tempNoteText}
                onChange={setTempNoteText}
                selectedTab={selectedTab}
                onTabChange={setSelectedTab}
                generateMarkdownPreview={(markdown) =>
                    Promise.resolve(converter.makeHtml(markdown))
                }
                minEditorHeight={80}
                heightUnits="vh"
            />
        </section>
    )
}
