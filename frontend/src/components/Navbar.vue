<script setup lang="ts">
import { ref } from 'vue';
import { type Session, triggerSync } from '../api';

defineProps<{ session: Session }>();

const syncing = ref(false);

async function sync() {
	syncing.value = true;
	try {
		await triggerSync();
	} finally {
		syncing.value = false;
	}
}
</script>

<template>
	<header class="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
		<div class="mx-auto flex w-full max-w-[2200px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
			<div class="flex min-w-0 items-center gap-6">
				<router-link to="/" class="truncate text-lg font-semibold tracking-tight text-gray-900">Dashboard</router-link>
				<nav class="hidden items-center gap-1 sm:flex">
					<router-link
						to="/"
						class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
						exact-active-class="bg-gray-100 text-gray-900"
					>
						Dashboard
					</router-link>
					<router-link
						to="/kanban"
						class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
						exact-active-class="bg-gray-100 text-gray-900"
					>
						Kanban
					</router-link>
				</nav>
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					class="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
					:disabled="syncing"
					@click="sync"
				>
					{{ syncing ? 'Syncing...' : 'Sync' }}
				</button>
				<div class="h-9 w-9 overflow-hidden rounded-full border border-gray-200 bg-indigo-50">
					<img :src="session.avatarUrl" :alt="session.login" class="h-full w-full object-cover" />
				</div>
				<a href="/auth/logout" class="text-sm font-medium text-gray-500 hover:text-gray-800">Logout</a>
			</div>
		</div>
	</header>
</template>
