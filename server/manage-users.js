import "dotenv/config";
import fs from "fs";
import path from "path";
import { stdin, stdout } from "process";
import { fileURLToPath } from "url";
import { makeAccount, normalizeUsername, readAccounts, writeAccounts } from "./accounts.js";

const usernamePattern = /^[a-z0-9._-]{3,32}$/;
const [action, rawUsername, option] = process.argv.slice(2);
const username = normalizeUsername(rawUsername);

function usage() {
  console.log("Usage:");
  console.log("  npm run users -- add <username> [--import-data]");
  console.log("  npm run users -- set-password <username>");
  console.log("  npm run users -- remove <username>");
  console.log("  npm run users -- list");
}

function readHidden(prompt) {
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error("Run this command in an interactive terminal so passwords aren't echoed.");
  return new Promise(resolve => {
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const finish = result => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      resolve(result);
    };
    const onData = chunk => {
      for (const char of chunk.toString()) {
        if (char === "\u0003") {
          finish(null);
          process.exit(130);
        } else if (char === "\r" || char === "\n") {
          finish(value);
          return;
        } else if (char === "\u0008" || char === "\u007f") {
          value = value.slice(0, -1);
        } else if (char >= " " && char !== "\u007f") {
          value += char;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function getPassword() {
  const first = await readHidden("New password (minimum 12 characters): ");
  if (!first || first.length < 12 || first.length > 128) throw new Error("Password must be between 12 and 128 characters.");
  const second = await readHidden("Repeat password: ");
  if (first !== second) throw new Error("Passwords do not match.");
  return first;
}

try {
  if (action === "list") {
    const accounts = readAccounts();
    Object.keys(accounts).sort().forEach(name => console.log(name));
  } else if (["add", "set-password", "remove"].includes(action)) {
    if (!usernamePattern.test(username)) throw new Error("Username must be 3-32 characters: letters, numbers, dot, underscore, or hyphen.");
    const accounts = readAccounts();
    if (action === "add") {
      if (accounts[username]) throw new Error("That username already exists.");
      if (option && option !== "--import-data") throw new Error("Unknown option: " + option);
      const password = await getPassword();
      accounts[username] = makeAccount(password);
      if (option === "--import-data") {
        const legacyFile = process.env.DATA_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), "data.json");
        const targetFile = legacyFile + "." + accounts[username].tenantId + ".json";
        if (fs.existsSync(legacyFile)) {
          if (fs.existsSync(targetFile)) throw new Error("The new account already has a data file; refusing to overwrite it.");
          fs.mkdirSync(path.dirname(path.resolve(targetFile)), { recursive: true });
          fs.copyFileSync(legacyFile, targetFile);
        } else {
          console.warn("No existing data file was found to import.");
        }
      }
      writeAccounts(accounts);
      console.log("Created account " + username + ". Restart the server to activate it.");
    } else if (action === "set-password") {
      if (!accounts[username]) throw new Error("No such account.");
      accounts[username] = { ...accounts[username], ...makeAccount(await getPassword()), tenantId: accounts[username].tenantId };
      writeAccounts(accounts);
      console.log("Updated password and revoked existing sessions for " + username + ". Restart the server to activate it.");
    } else {
      if (!accounts[username]) throw new Error("No such account.");
      delete accounts[username];
      writeAccounts(accounts);
      console.log("Removed account " + username + ". Its saved data was retained. Restart the server to apply.");
    }
  } else {
    usage();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
