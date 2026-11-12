# Cricket live scoring (React + Express + Socket.IO)

## Run locally
Needs Node.js 18 or newer.

    cd server
    npm install
    Copy-Item .env.example .env
    node -p "require('crypto').randomBytes(48).toString('base64url')"

Put the generated value in `JWT_SECRET` in `.env` (production requires at least 32 characters).
    npm run users -- add owner --import-data
    npm start

In another terminal:

    cd client
    npm install
    npm run dev

Open http://localhost:5173 and log in with the account you created.

## Production
Build the client, then start the server:

    cd client
    npm install
    npm run build
    cd ../server
    npm start

Deploy the Node server behind HTTPS and keep `users.json` and all tenant data files on persistent storage. Set a strong `JWT_SECRET`; optionally set `USERS_FILE`, `DATA_FILE`, and `CLIENT_ORIGIN` in the server environment.

## Customer accounts
Accounts are invite-only; there is no public registration or payment processing. Run these commands from `server` to provision accounts. Passwords are entered without being echoed:

    npm run users -- add <username>
    npm run users -- list
    npm run users -- set-password <username>
    npm run users -- remove <username>

Restart the server after account changes. To import the existing single-user `data.json` into your first account, create it with `npm run users -- add <username> --import-data`. Create additional buyers without that option so they start with separate teams, tournaments, and match data. Removing an account disables it but retains its saved data. Resetting a password invalidates existing sessions.

Passwords are stored as salted scrypt hashes, login attempts are rate-limited, and sessions last 12 hours. Give each buyer their own credentials: people sharing an account also share its data and cannot be revoked individually. Never commit `.env` or `users.json`.

## OBS overlay
Each account has a public live-score overlay URL:

    http://YOUR-SERVER:3001/overlay?user=USERNAME

The overlay only exposes that account's current live match. In development use `http://localhost:5173/overlay?user=USERNAME`.

## Netlify client + separate backend
The Express server and Socket.IO need a host that runs Node continuously (Render, Railway, Fly.io, or a VPS).

1. Deploy `server` and set `JWT_SECRET`, `CLIENT_ORIGIN` (your Netlify site origin), and persistent `USERS_FILE` / `DATA_FILE` paths.
2. Deploy `client` to Netlify (base directory `client`, build `npm run build`, publish `dist`). Set `VITE_API_URL` in the client build environment to the backend URL.
3. Provision customer accounts on the server host using `npm run users -- add <username>`.
4. OBS Browser Source: `https://YOUR-SITE.netlify.app/overlay?user=USERNAME`
