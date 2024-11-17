import { getInput, saveState, setFailed, setOutput } from '@actions/core';
import { info } from 'console';

const actionsToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
const actionsUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;

async function fetchWithRetry(url, options = {}, retries = 3, initialDelay = 1000) {
    let attempt = 1;
    while (retries > 0) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.warn(`Attempt ${attempt} failed. Error: ${error.message}`);
            const jitter = Math.floor(Math.random() * 5000);
            const delay = Math.min(2 ** attempt * initialDelay + jitter, 10000); // Limit max delay to 10 seconds
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            retries--;
        }
    }
    throw new Error(`Fetch failed after ${attempt} attempts.`);
}

async function run() {
    try {
        const res = await fetchWithRetry(`${actionsUrl}&audience=github-bot.fos.gg`, { headers: { 'Authorization': `Bearer ${actionsToken}` } }, 5);
        const json = await res.json();

        info('Got OIDC token');

        const data = await (await fetch(`https://github-bot.fos.gg/api/token/generate/${getInput('id', {required: true})}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': json.value,
            },
        })).json();

        setOutput('token', data.token);
        saveState('id', getInput('id', {required: true}));
        saveState('oidc', json.value);
        saveState('accessToken', data.token);
    } catch (e) {
        setFailed(e.message);
    }
}

run();
