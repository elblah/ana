# Specification: Session persistence in jsonl

## Objective

Persist sessions on a jsonl file format.

## How it works

When an env var called SESSION_FILE is defined it must point to a valid file path.

If a file already exists, its content must be loaded to the current session (like the /load <SESSION_FILE env var value> command)

If the file does not exist then it is created

With every new message added on the message history, a line will be added in jsonl format to this SESSION_FILE
    Each line is a message history entry.

### Header Display

When SESSION_FILE is set, display "Session file: <path>" in the startup header:
- After configuration info
- Before startup time message

### Compaction

When compaction happens, this jsonl is erased and then reset to the state of message history after compaction.

## Commands

### /load

/load will be changed to load the json file based on the format... if the extension is
    .jsonl - load as jsonl format
    any other extension or even no extension loads as json as it is today

### /save
 
/save must be changed to allow saving the session as json or jsonl... default is json
    default file name to save is session.json

Depending oh the file name it will save as json or jsonl
    - if the filename is .jsonl it will be saved as jsonl
    - if it ends in anything other than .jsonl then it will be saved as json as it is today

## Tests

Testing is essential and should be made based on files

## GIT

Create a branch if it does not exist called "jsonl"
checkout and work on that branch keepin it updated at each significant step
