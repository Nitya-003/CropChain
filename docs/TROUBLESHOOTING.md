 # TROUBLESHOOTING GUIDE

This guide covers the most common problems new contributors run into when setting up CropChain and how to fix them quickly.

For full setup steps and architecture details, check the main [README](./README.md).


## 1. MetaMask and local network issues

### 1.1 Error: “MetaMask: Nonce too high”

**What you see**

- MetaMask shows `Nonce too high`, or  
- The terminal / browser console logs `eth_sendRawTransaction: nonce too high`.

This usually happens when you restart the local Hardhat node, but MetaMask still remembers older transactions and keeps using a higher nonce than the node expects.

**How to fix**

1. Open MetaMask.
2. Go to **Settings → Advanced**.
3. Click **Reset account**.  
   - This only clears local transaction history and nonce tracking. It does **not** remove your funds or private keys.
4. In your project, restart the local Hardhat node:

```bash
npx hardhat node 

```

 5. Try sending the transaction again from the app.


### 1.2 MetaMask not working with local Hardhat node

 **Symptoms**
       -  MetaMask is on some other network (e.g. Ethereum Mainnet, Mumbai, etc.).

       - Transactions don’t show up on the local node.

       - The dApp can’t read balances or contract state on localhost.

Common reasons

        - Hardhat node is not running.

        - MetaMask is not connected to the local Hardhat network.

        - The local network is not configured correctly in MetaMask.

How to fix
  1.  Start the local node:

```bash
npx hardhat node

```
 2. Add a local network in MetaMask (once):

   Network Name: Hardhat Localhost
   RPC URL: http://127.0.0.1:8545
   Chain ID: 31337
   Currency Symbol: ETH
   
3. Switch MetaMask to Hardhat Localhost.

4. Import one of the test accounts from the Hardhat node:

    - When you run npx hardhat node, Hardhat shows several accounts and private keys in the terminal.

    - In MetaMask, click your profile → Import account and paste one of those private keys.


## 2. Backend / API issues

### 2.1 Error: “Failed to fetch” in the frontend

  **What you see**

       -The UI shows a generic Failed to fetch message.

       -In DevTools → Network tab, API calls show (failed) or never get a response.

    # Common reasons

        - Backend server is not running.

        - Backend is running on a different port than the frontend expects (default is 3001).

        - Frontend is pointing to the wrong base URL.

        - CORS configuration is blocking the request.

**How to fix**

1. Make sure the backend is running:

```bash
cd backend
npm install      # only needed the first time
npm run dev
```

2. Confirm it is running on http://localhost:3001:

    - Open http://localhost:3001 in your browser.

    - If the backend exposes a health route or a basic route, check that it returns something.

3. Check the frontend API base URL:

    - In the frontend .env or config (for example VITE_API_URL), it should point to-: http://localhost:3001

4. Open the browser DevTools → Network tab:

    - Look at a failing request.

    - Confirm the Request URL is correct.

    - If you see a CORS error, make sure the backend allows your frontend origin (for example http://localhost:5173).

5. After changing any env or config values, restart both:

   - Frontend dev server.

  -  Backend dev server.

  
## 3. Smart contract / Hardhat issues

3.1 Error: “Contract not deployed” or missing CONTRACT_ADDRESS

 **What you see**

    Errors like:
           - Contract not deployed
           - CONTRACT_ADDRESS is not set
           - “invalid address” when the app tries to call the contract.

    The app can start, but all blockchain actions fail.

This usually means the contract is not deployed on the network you’re using, or the .env still has an empty or old address.


Local development (localhost)

1. Start a local Hardhat node:

```bash
npx hardhat node 
```

2. In a separate terminal, deploy the contract:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

3. Copy the contract address printed in the terminal after deployment.

4. Update the backend .env:
 
- In `backend/.env` set:
  - `CONTRACT_ADDRESS=0x...`  (paste the new address here)

5. Restart the backend:

```bash
cd backend
npm run dev
```

6. If the frontend also reads the contract address from an env variable, update the frontend .env too and restart the frontend dev server.


Mumbai testnet

   1. In backend/.env, make sure you have valid values:

      INFURA_URL=https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID
      PRIVATE_KEY=0xYOUR_PRIVATE_KEY

   2. Deploy to Mumbai:

```bash
npx hardhat run scripts/deploy.js --network mumbai
```

   3.  Copy the new address into CONTRACT_ADDRESS (and frontend env if needed).

   4. Restart backend and frontend so they both use the updated address.


 ## 4. Environment variables and configuration

 4.1 Backend crashes or exits immediately

 **What you see**

      - npm run dev in backend exits with errors about missing env variables.

      -Messages mention things like INFURA_URL, PRIVATE_KEY, MONGODB_URI, JWT_SECRET, or CONTRACT_ADDRESS.[file:1]

**How to fix**

1. Create a .env based on the example file:
```bash
cd backend
cp .env.example .env
```

2. Edit backend/.env and fill in the required values:

# Server
PORT=3001
NODE_ENV=development

# Blockchain
INFURA_URL=https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID
CONTRACT_ADDRESS=0x...       # after you deploy the contract
PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Database
MONGODB_URI=mongodb://localhost:27017/cropchain

# Security
JWT_SECRET=your_secret_key


3. Make sure MongoDB is running if you are using the local database.

4. Start the backend again:

```bash
npm run dev
``` 


## 5. Frontend setup problems

5.1 Frontend runs but the UI is blank or broken
Common reasons

    - Dependencies not installed correctly.

    - Node.js version issues or TypeScript build errors.

    - Required frontend env variables (API URL, contract address, etc.) are missing.

**How to fix**

1.  From the project root, install dependencies and start the dev server:

```bash
npm install
npm run dev
```

2. Watch the terminal output for any errors or warnings.

3. If the app uses env variables (like VITE_API_URL or contract address), make sure they are defined in the frontend .env file and restart the dev server after editing them.


## 6. Quick checklist before opening an issue

Before you open a new GitHub issue, run through this short checklist:

      - Hardhat node is running (npx hardhat node) if you are using a local blockchain.

      - Backend is running on port 3001 (cd backend && npm run dev).

      - Frontend dev server is running (npm run dev from the project root).

      - .env files exist and have sensible values (backend and frontend if used).

      - MetaMask is on the correct network (Hardhat localhost or Mumbai) and, if needed, the account has been reset.

      - The contract is deployed on the network you’re using and CONTRACT_ADDRESS is up to date.

If you still can’t solve the problem:

1. Take screenshots of:

    - The browser error.
    - The browser console.
    - The backend / Hardhat terminal.

2. Copy the relevant log lines from your terminal.

3. Open a GitHub issue and include:

    - Exact steps to reproduce.

    - Your OS, Node.js version, and which network you’re on (localhost or Mumbai).

    - What you expected to happen and what actually happened.

This information makes it much easier for maintainers and other contributors to help debug the issue quickly.
