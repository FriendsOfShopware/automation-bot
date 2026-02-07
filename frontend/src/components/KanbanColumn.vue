<script setup lang="ts">
import type { KanbanColumn } from '../api';
import KanbanCard from './KanbanCard.vue';

defineProps<{ column: KanbanColumn }>();
</script>

<template>
	<div class="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-800">
			<span class="truncate">{{ column.repo.name }}</span>
			<span class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{{ column.items.length }}</span>
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
			<KanbanCard
				v-for="item in column.items"
				:key="item.id"
				:item="item"
				:repo-full-name="column.repo.full_name"
			/>
		</div>
	</div>
</template>
