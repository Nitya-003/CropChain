# Issue: Unresolved Git Merge Conflicts Breaking the Build

**Description**:
The repository's `main` branch was accidentally committed with unresolved Git merge conflict markers (e.g., `<<<<<<< HEAD`, `=======`, `>>>>>>> upstream/main`) spread across multiple critical files. Most notably, `backend/server.js` contains numerous inline conflict markers. Because these markers are invalid JavaScript syntax, the Node.js backend server will instantly crash with a `SyntaxError` upon startup. Similarly, `src/components/Header.tsx` contains conflict markers that will cause the Vite/React frontend build to fail. The Docker configuration files (`docker-compose.yml`, `.dockerignore`) and `README.md` are also corrupted.

**Impact**: 
The entire application is completely unusable out of the box. The backend fails to boot, the frontend fails to compile, and Docker builds will throw syntax/parsing errors.

**Solution**:
1. Manually resolve the merge conflicts in `backend/server.js`, `src/components/Header.tsx`, `docker-compose.yml`, `.dockerignore`, and `README.md` by carefully selecting the correct code blocks to keep.
2. Remove all Git conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`).
3. Run local builds (`npm run build`) and test the backend (`npm start`) to ensure that all syntax errors are completely resolved.
4. Commit and push the clean, conflict-free files to the main branch.

I would like to work on this under gssoc26.
