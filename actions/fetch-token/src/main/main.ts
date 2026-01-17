import { getInput, saveState, setFailed, setOutput } from '@actions/core';
import { info } from 'console';

const actionsToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
const actionsUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;

interface ExecutionContext {
    id: string;
    command: string;
    headOwner: string;
    headRepo: string;
    headBranch: string;
    headSha: string;
    baseOwner: string;
    baseRepo: string;
    prNumber: number | null;
    args: string[];
}

interface TokenResponse {
    token: string;
    execution: ExecutionContext | null;
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, initialDelay = 1000): Promise<Response> {
    let attempt = 1;
    while (retries > 0) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error: any) {
            console.warn(`Attempt ${attempt} failed. Error: ${error.message}`);
            const jitter = Math.floor(Math.random() * 5000);
            const delay = Math.min(2 ** attempt * initialDelay + jitter, 10000);
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
        const json = await res.json() as { value: string };

        info('Got OIDC token');

        const data: TokenResponse = await (await fetch(`https://github-bot.fos.gg/api/token/generate/${getInput('id', {required: true})}`, {
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

        // Output execution context
        if (data.execution) {
            setOutput('execution', JSON.stringify(data.execution));
            setOutput('head-owner', data.execution.headOwner);
            setOutput('head-repo', data.execution.headRepo);
            setOutput('head-branch', data.execution.headBranch);
            setOutput('head-sha', data.execution.headSha);
            setOutput('base-owner', data.execution.baseOwner);
            setOutput('base-repo', data.execution.baseRepo);
            setOutput('pr-number', String(data.execution.prNumber ?? ''));
            setOutput('args', JSON.stringify(data.execution.args));
        }
    } catch (e: any) {
        setFailed(e.message);
    }
}

run();
