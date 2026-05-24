# Jenkins CI/CD Pipeline Setup

This repository includes a root Jenkins pipeline in `Jenkinsfile` to automate linting, security checks, testing, and Docker build validation.

## What the Pipeline Runs

1. Checkout source code.
2. Install dependencies for root and backend (`npm ci`).
3. Lint and security checks:
- ESLint (`npm run lint`)
- Prettier check (`npx --yes prettier@3.3.3 --check .`)
- npm audit for root and backend with high-severity threshold.
4. Test matrix (parallel):
- Smart contracts: `npx hardhat test`
- Backend integration tests: `npm --prefix backend run test:ci`
- Frontend unit tests: `npm run test:unit -- --ci --watchAll=false`
5. Docker build verification:
- Multi-stage production targets from root `Dockerfile`
- Development Dockerfiles for frontend and backend.
6. Post actions:
- Archive test artifacts in `artifacts/test-results`
- Emit success/failure status in Jenkins logs
- Clean workspace.

## Jenkins Requirements

Install Jenkins plugins:
- Pipeline
- Git
- Workspace Cleanup
- ANSI Color (for `ansiColor` option)

Agent requirements:
- Node.js 18+ and npm
- Docker Engine with build permissions
- Git

## Job Configuration (Recommended)

1. Create a new **Pipeline** job in Jenkins.
2. In **Pipeline definition**, choose **Pipeline script from SCM**.
3. Point SCM to this repository.
4. Set **Script Path** to `Jenkinsfile`.
5. Save and run **Build Now**.

## Notes

- Dependency caching is implemented with Jenkins `stash/unstash` for `node_modules` across stages.
- Test result JSON files are written to `artifacts/test-results` and archived after each run.
- If your Jenkins agents are Linux-only (typical with Docker), shell commands run through `sh`; Windows agents are also supported in the current pipeline.
