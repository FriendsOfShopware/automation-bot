import { getInput, setFailed } from '@actions/core';
import { info } from 'console';

const actionsToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
const actionsUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;

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
		const id = getInput('id', { required: true });
		const data = getInput('data', { required: true });

		// Validate that data is valid JSON
		try {
			JSON.parse(data);
		} catch {
			throw new Error('Input "data" must be valid JSON');
		}

		// Get OIDC token
		const res = await fetchWithRetry(
			`${actionsUrl}&audience=github-bot.fos.gg`,
			{ headers: { 'Authorization': `Bearer ${actionsToken}` } },
			5
		);
		const json = await res.json() as { value: string };

		info('Got OIDC token');

		// Send report to automation bot
		const reportRes = await fetch(`https://github-bot.fos.gg/api/report/${id}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': json.value,
			},
			body: data,
		});

		if (!reportRes.ok) {
			const errorBody = await reportRes.text();
			throw new Error(`Failed to report data: ${reportRes.status} ${errorBody}`);
		}

		const result = await reportRes.json() as { ok: boolean };

		if (result.ok) {
			info('Successfully reported data to automation bot');
		} else {
			throw new Error('Report endpoint returned unsuccessful response');
		}
	} catch (e: any) {
		setFailed(e.message);
	}
}

run();
