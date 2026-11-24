// `npm run check-env`: checks the environment variables without starting the server or touching the database.
import { loadConfig } from "../config.js";

const config = loadConfig(); // exits with the list of problems if something is wrong
console.log(`[check-env] OK (${config.nodeEnv}). MongoDB database "${config.mongoDb}", app address ${config.appOrigin}.`);
