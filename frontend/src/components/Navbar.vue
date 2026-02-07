<script setup lang="ts">
import { ref } from 'vue';
import { type Session, triggerSync } from '../api';

defineProps<{ session: Session | null }>();

const syncing = ref(false);
const mobileOpen = ref(false);

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

			<div class="hidden items-center gap-3 sm:flex">
				<button
					v-if="session"
					type="button"
					class="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
					:disabled="syncing"
					@click="sync"
				>
					{{ syncing ? 'Syncing...' : 'Sync' }}
				</button>
				<div v-if="session" class="h-9 w-9 overflow-hidden rounded-full border border-gray-200 bg-indigo-50">
					<img :src="session.avatarUrl" :alt="session.login" class="h-full w-full object-cover" />
				</div>
				<a v-if="session" href="/auth/logout" class="text-sm font-medium text-gray-500 hover:text-gray-800">Logout</a>
				<a v-else href="/auth/login" class="inline-flex h-9 items-center rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-700">Login</a>
			</div>

			<button
				type="button"
				class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-700 sm:hidden"
				aria-label="Toggle navigation"
				@click="mobileOpen = !mobileOpen"
			>
				<svg v-if="!mobileOpen" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1Zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1Zm1 4a1 1 0 100 2h12a1 1 0 100-2H4Z" clip-rule="evenodd" />
				</svg>
				<svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414Z" clip-rule="evenodd" />
				</svg>
			</button>
		</div>

		<div v-if="mobileOpen" class="border-t border-gray-200 bg-white px-4 py-3 sm:hidden">
			<nav class="space-y-1">
				<router-link to="/" class="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" @click="mobileOpen = false">Dashboard</router-link>
				<router-link to="/kanban" class="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" @click="mobileOpen = false">Kanban</router-link>
			</nav>

			<div class="mt-3 border-t border-gray-200 pt-3">
				<div v-if="session" class="space-y-2">
					<button
						type="button"
						class="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
						:disabled="syncing"
						@click="sync"
					>
						{{ syncing ? 'Syncing...' : 'Sync' }}
					</button>
					<div class="flex items-center gap-2">
						<div class="h-8 w-8 overflow-hidden rounded-full border border-gray-200 bg-indigo-50">
							<img :src="session.avatarUrl" :alt="session.login" class="h-full w-full object-cover" />
						</div>
						<span class="text-sm text-gray-700">{{ session.login }}</span>
					</div>
					<a href="/auth/logout" class="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Logout</a>
				</div>
				<a v-else href="/auth/login" class="inline-flex h-9 items-center rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-700">Login with GitHub</a>
			</div>
		</div>
	</header>
</template>
