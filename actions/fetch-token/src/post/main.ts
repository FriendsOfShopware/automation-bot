import { getInput, getState, setFailed } from "@actions/core";

async function run() {
    const oidcToken = getState('oidc');
    const accessToken = getState('accessToken');

    const resp = await (await fetch(`https://dash.fos.gg/api/token/delete/${getInput('id')}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': oidcToken,
            'GitHub-Bot-Access-Token': accessToken,
        },
    })).json();

    if (!resp.ok) {
        setFailed(JSON.stringify(resp));
    }
}

run();
