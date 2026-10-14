# CodeMatch upgrade

## Included files

- `CodeMatchLayout.tsx` — upgraded React workspace UI and editor workflow.
- `codematch.ts` — upgraded Fastify routes for GitHub, file operations, access checks and AI chat.

## What changed

### Workspace and editor
- Search/filter for repositories and file paths.
- Repository refresh action and clearer loading/error messages.
- Prompts before switching projects/files with unsaved edits, plus a browser-close unsaved-work guard.
- Ctrl/Cmd+S to save, and Ctrl/Cmd+Shift+P to open the AI assistant.
- File line/character counts and last-save timestamp.
- Create, save/commit, and delete files from GitHub with confirmation and status feedback.
- AI review shortcuts, selection-aware context, repository metadata and a bounded file-tree context.
- AI-generated code can be applied to the open file or to a newly named file in the selected repository.

### API and AI
- CodeMatch organization/class/group access is re-checked on protected API routes, not only in the UI.
- Safer repository-relative path validation and URL encoding for GitHub operations.
- The repository's actual default branch is used for tree/file retrieval.
- More consistent GitHub error handling, bounded pagination and input validation.
- Conversation IDs are checked against the current user and CodeMatch folder to prevent cross-user conversation writes.
- AI history now uses the most recent messages; Ollama prompts include recent turns, and Anthropic uses its Messages API.
- AI system instructions emphasize that repository contents are data, not trusted instructions.

## Integration notes

These files keep the existing `/api/codematch/...` endpoint paths. Replace the matching files in the application and run the project's normal lint, typecheck, build and integration tests. In particular, test GitHub OAuth behind your production reverse proxy, restricted class/group access, repository creation, create/update/delete file commits, AI requests for each configured provider, and the conversation history endpoint.

Only the two uploaded source files were available in this workspace. A TypeScript syntax parse passed for both files; a full build could not be verified because project dependencies and the surrounding application source were not provided.
