<script setup lang="ts">
import type { Execution } from '../api';

defineProps<{ executions: Execution[] }>();

function statusClass(status: string): string {
	const classes: Record<string, string> = {
		pending: 'bg-amber-100 text-amber-800',
		running: 'bg-blue-100 text-blue-800',
		completed: 'bg-emerald-100 text-emerald-800',
		failed: 'bg-red-100 text-red-700',
	};
	return `inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${classes[status] ?? 'bg-gray-100 text-gray-700'}`;
}

function parseResultUrl(result: string | null): string | null {
	if (!result) return null;
	try {
		const data = JSON.parse(result);
		return data.previewUrl || data.url || null;
	} catch {
		return null;
	}
}

function formatArgs(args: string | null): string {
	if (!args) return 'none';
	try {
		const parsed = JSON.parse(args) as Record<string, string>;
		const entries = Object.entries(parsed);
		if (!entries.length) return 'none';
		return entries.map(([k, v]) => `${k}=${v}`).join(', ');
	} catch {
		return args;
	}
}
</script>

<template>
	<section class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
		<header class="border-b border-gray-200 px-6 py-5">
			<h2 class="text-lg font-semibold text-gray-900">Execution History</h2>
		</header>

		<div v-if="!executions.length" class="px-6 py-10 text-sm text-gray-500">No executions yet.</div>
		<div v-else class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Command</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Repository</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Target</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Triggered By</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Parameters</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Result</th>
						<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Created</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					<tr v-for="e in executions" :key="e.id" class="hover:bg-gray-50/70">
						<td class="whitespace-nowrap px-4 py-3 text-sm">
							<code class="font-mono text-gray-800">{{ e.command }}</code>
						</td>
						<td class="whitespace-nowrap px-4 py-3 text-sm">
							<a :href="`https://github.com/${e.base_owner}/${e.base_repo}`" target="_blank" class="text-indigo-700 hover:underline">
								{{ e.base_owner }}/{{ e.base_repo }}
							</a>
						</td>
						<td class="whitespace-nowrap px-4 py-3 text-sm">
							<a
								v-if="e.pr_number"
								:href="`https://github.com/${e.base_owner}/${e.base_repo}/pull/${e.pr_number}`"
								target="_blank"
								class="text-indigo-700 hover:underline"
							>
								#{{ e.pr_number }}
							</a>
							<span v-else class="text-gray-500">{{ e.head_branch }}</span>
						</td>
						<td class="whitespace-nowrap px-4 py-3 text-sm">
							<span :class="statusClass(e.status)">{{ e.status }}</span>
						</td>
						<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
							<div class="flex items-center gap-2">
								<span>{{ e.triggered_by || 'unknown' }}</span>
								<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{{ e.trigger_source || 'unknown' }}</span>
							</div>
						</td>
						<td class="max-w-[24rem] px-4 py-3 text-sm text-gray-600">
							<span class="break-all">{{ formatArgs(e.args) }}</span>
						</td>
						<td class="whitespace-nowrap px-4 py-3 text-sm">
							<a v-if="parseResultUrl(e.result)" :href="parseResultUrl(e.result)!" target="_blank" class="text-indigo-700 hover:underline">
								Open
							</a>
							<span v-else class="text-gray-400">&mdash;</span>
						</td>
						<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{{ e.created_at }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</template>
