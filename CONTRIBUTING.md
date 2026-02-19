# Contributing to CropChain 🌾

First off, thank you for considering contributing to CropChain! It's people like you who make this tool better for farmers and consumers everywhere.



## 🛠️ Tech Stack Background
Before contributing, ensure you are familiar with:
* **Frontend:** React, TypeScript, Tailwind CSS
* **Backend:** Node.js, Express, MongoDB
* **Blockchain:** Solidity, Hardhat, Ethers.js

## 🚀 How Can I Contribute?

### 1. Reporting Bugs
* Check the [Issues Tab](https://github.com/your-username/cropchain/issues) to see if the bug is already reported.
* If not, open a new issue. Use a clear title and provide steps to reproduce the error.

### 2. Suggesting Enhancements
* We are always looking for ways to improve the "Farm to Fork" transparency.
* Open an issue with the tag `enhancement` to discuss your idea.

### 3. Pull Request Process
1. **Fork** the repository and create your branch from `main`.
2. **Install** dependencies in both root and `/backend` folders.
3. If you change Smart Contracts, ensure you run `npx hardhat test` to verify logic.
4. If you change utility functions, run `npm run test:unit` to verify logic.
4. **Commit** your changes with clear messages (e.g., `feat: add batch filtering by date`).
5. **Push** to your fork and submit a Pull Request.



## 🧪 Development Workflow

### Smart Contract Changes
If you are modifying `CropChain.sol`:
* Ensure you add relevant tests in the `test/` directory.
* Run `npx hardhat compile` to check for Solidity errors.

### Frontend/UI Changes
* We aim for "Apple-level" aesthetics. Please ensure any new components are responsive and use the Tailwind design system defined in `tailwind.config.js`.

## 📜 Style Guidelines
* **TypeScript:** Use interfaces for all data models (Batch, Actor, History).
* **Solidity:** Follow the [Official Solidity Style Guide](https://docs.soliditylang.org/en/v0.8.19/style-guide.html).
* **Git:** Use imperative mood in commit messages ("Add feature" instead of "Added feature").

## 🏅 Recognition
Contributors who have their PRs merged will be added to our **Acknowledgments** section in the README!

---
*Happy Coding, and let's make the food supply chain transparent!* 🚀
