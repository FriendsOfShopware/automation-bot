import { getInput, getState } from "@actions/core";

async function run() {
    const oidcToken = getState('oidc');
    const accessToken = getState('accessToken');

    await (await fetch(`https://github-bot.fos.gg/api/token/generate/${getInput('id')}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': oidcToken,
            'GitHub-Bot-Access-Token': accessToken,
        },
    })).json();
}

run();