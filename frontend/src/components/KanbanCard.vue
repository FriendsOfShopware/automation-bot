<script setup lang="ts">
import type { KanbanItem } from '../api';

const props = defineProps<{ item: KanbanItem; repoFullName: string }>();

function timeAgo(dateStr: string): string {
	const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

const ghUrl = `https://github.com/${props.repoFullName}/${props.item.isPullRequest ? 'pull' : 'issues'}/${props.item.number}`;
</script>

<template>
	<a :href="ghUrl" target="_blank" rel="noopener" class="block rounded-md border border-gray-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow">
		<div class="flex items-start gap-2">
			<span class="mt-0.5 shrink-0" :title="item.isPullRequest ? 'Pull Request' : 'Issue'">
				<svg v-if="item.isPullRequest" class="h-4 w-4 text-indigo-500" viewBox="0 0 16 16" fill="currentColor">
					<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
				</svg>
				<svg v-else class="h-4 w-4 text-emerald-500" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
					<path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
				</svg>
			</span>
			<span class="line-clamp-3 text-sm font-medium leading-5 text-gray-900">{{ item.title }}</span>
		</div>

		<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
			<span>#{{ item.number }}</span>
			<span>{{ timeAgo(item.createdAt) }}</span>
			<img
				v-if="item.authorAvatarUrl"
				:src="item.authorAvatarUrl"
				:alt="item.authorLogin"
				class="h-4 w-4 rounded-full"
			/>
			<span>{{ item.authorLogin }}</span>
		</div>

		<div v-if="item.labels.length" class="mt-2 flex flex-wrap gap-1">
			<span
				v-for="label in item.labels"
				:key="label.name"
				class="rounded-full px-2 py-0.5 text-xs font-medium"
				:style="{ backgroundColor: '#' + label.color, color: getLuminance(label.color) > 0.5 ? '#000' : '#fff' }"
			>
				{{ label.name }}
			</span>
		</div>
	</a>
</template>

<script lang="ts">
function getLuminance(hex: string): number {
	const r = parseInt(hex.slice(0, 2), 16) / 255;
	const g = parseInt(hex.slice(2, 4), 16) / 255;
	const b = parseInt(hex.slice(4, 6), 16) / 255;
	return 0.299 * r + 0.587 * g + 0.114 * b;
}
</script>
