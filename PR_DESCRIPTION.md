# Pull Request: Resolve Critical Merge Conflicts Across Codebase

## Describe your changes
This PR fixes the critical application-breaking Git merge conflict markers that were accidentally committed directly to the `main` branch. The conflicts caused `SyntaxError` crashes on the Node.js backend on startup, prevented the frontend Vite/React from building, and broke the Docker containerization logic.

**Files Fixed:**
1. `backend/server.js`: Resolved major file conflicts by standardizing to the complete upstream/main version which includes CCIP service updates, `validatedData` object mapping fixes, and global handlers.
2. `src/components/Header.tsx`: Resolved navigation UI conflicts. Integrated both the existing `Home` tab and the new `Smart Planting` tab seamlessly.
3. `docker-compose.yml`: Restored to the robust upstream version, including multi-stage targets, `ml-service` deployment configurations, and MongoDB health checks.
4. `.dockerignore`: Merged ignore lists cleanly from both sides to optimize container builds without bloating context sizes.
5. `README.md`: Resolved documentation conflicts by integrating the more comprehensive upstream Docker deployment workflow.

## Issue ticket number and link
Resolves: Issue 1 (Unresolved Git Merge Conflicts Breaking the Build)

## Checklist before requesting a review
- [x] I have performed a manual review of my code
- [x] I have tested the build and verified the backend parses correctly (no SyntaxErrors)
- [x] All conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) have been removed completely
- [x] I have confirmed the fixes do not introduce new logic errors
- [x] I would like to work on this under gssoc26
