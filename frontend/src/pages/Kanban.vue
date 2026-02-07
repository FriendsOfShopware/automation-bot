<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router';
import { getKanban, getKanbanRepos, type KanbanColumn, type KanbanItem, type KanbanRepoMeta, type Session } from '../api';
import KanbanColumnComp from '../components/KanbanColumn.vue';

const props = defineProps<{ session?: Session | null }>();

const STORAGE_SCOPE = 'kanban.scope.repoIds';
const STORAGE_PINS = 'kanban.scope.pinnedRepoIds';
const STORAGE_GROUP = 'kanban.groupMode';
const STORAGE_TYPE = 'kanban.typeFilter';
const STORAGE_LIMIT = 'kanban.columnLimit';
const QUERY_KEYS = {
	search: 'q',
	type: 'type',
	group: 'group',
	repos: 'repos',
	pins: 'pins',
	limit: 'limit',
} as const;
const MANAGED_QUERY_KEYS = new Set(Object.values(QUERY_KEYS));

const columns = ref<KanbanColumn[]>([]);
const repos = ref<KanbanRepoMeta[]>([]);
const loading = ref(true);
const search = ref('');
const repoSearch = ref('');
const typeFilter = ref<'all' | 'issues' | 'prs'>('all');
const groupMode = ref<'repo' | 'status'>('repo');
const selectedRepoIds = ref<number[]>([]);
const pinnedRepoIds = ref<number[]>([]);
const columnLimit = ref(8);
let pollTimer: ReturnType<typeof setInterval> | null = null;
const syncingFromQuery = ref(false);
const hasUserInteracted = ref(false);
const route = useRoute();
const router = useRouter();

function markInteracted() {
	hasUserInteracted.value = true;
}

function readNumberArray(key: string): number[] {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
	} catch {
		return [];
	}
}

function writeNumberArray(key: string, value: number[]) {
	localStorage.setItem(key, JSON.stringify(value));
}

function firstQueryValue(value: LocationQuery[string]): string {
	if (Array.isArray(value)) return value[0] ?? '';
	return value ?? '';
}

function parseQueryIntList(raw: string): number[] {
	return raw
		.split(',')
		.map((v) => Number(v.trim()))
		.filter((v) => Number.isInteger(v) && v > 0);
}

function isValidType(value: string): value is typeof typeFilter.value {
	return value === 'all' || value === 'issues' || value === 'prs';
}

function isValidGroup(value: string): value is typeof groupMode.value {
	return value === 'repo' || value === 'status';
}

function applyQueryToState(query: LocationQuery) {
	const q = firstQueryValue(query[QUERY_KEYS.search]);
	const type = firstQueryValue(query[QUERY_KEYS.type]);
	const group = firstQueryValue(query[QUERY_KEYS.group]);
	const repos = firstQueryValue(query[QUERY_KEYS.repos]);
	const pins = firstQueryValue(query[QUERY_KEYS.pins]);
	const limit = Number(firstQueryValue(query[QUERY_KEYS.limit]));

	syncingFromQuery.value = true;
	if (q) search.value = q;
	if (isValidType(type)) typeFilter.value = type;
	if (isValidGroup(group)) groupMode.value = group;
	if (repos) selectedRepoIds.value = parseQueryIntList(repos);
	if (pins) pinnedRepoIds.value = parseQueryIntList(pins);
	if (Number.isInteger(limit) && limit > 0) columnLimit.value = limit;
	syncingFromQuery.value = false;
}

function syncStateToQuery() {
	if (syncingFromQuery.value) return;
	if (!hasUserInteracted.value) return;

	const nextManaged: LocationQueryRaw = {};
	const normalizedSearch = search.value.trim();
	if (normalizedSearch) nextManaged[QUERY_KEYS.search] = normalizedSearch;
	if (typeFilter.value !== 'all') nextManaged[QUERY_KEYS.type] = typeFilter.value;
	if (groupMode.value !== 'repo') nextManaged[QUERY_KEYS.group] = groupMode.value;
	if (selectedRepoIds.value.length) nextManaged[QUERY_KEYS.repos] = selectedRepoIds.value.join(',');
	if (pinnedRepoIds.value.length) nextManaged[QUERY_KEYS.pins] = pinnedRepoIds.value.join(',');
	if (columnLimit.value !== 8) nextManaged[QUERY_KEYS.limit] = String(columnLimit.value);

	const baseQuery: LocationQueryRaw = {};
	for (const [key, value] of Object.entries(route.query)) {
		if (!MANAGED_QUERY_KEYS.has(key)) {
			baseQuery[key] = value;
		}
	}

	void router.replace({ query: { ...baseQuery, ...nextManaged } });
}

function inferLane(item: KanbanItem): 'backlog' | 'in-progress' | 'review' | 'blocked' {
	const labels = item.labels.map((l) => l.name.toLowerCase());
	const has = (needles: string[]) => needles.some((n) => labels.some((l) => l.includes(n)));

	if (has(['blocked', 'stalled', 'waiting', 'need info', 'needs info', 'on hold'])) return 'blocked';
	if (has(['review', 'qa', 'testing', 'ready for review', 'code review'])) return 'review';
	if (has(['wip', 'in progress', 'progress', 'doing'])) return 'in-progress';
	return 'backlog';
}

const repoById = computed(() => new Map(repos.value.map((r) => [r.id, r])));
const allowedRepoIds = computed(() => new Set(repos.value.map((r) => r.id)));

const selectedRepos = computed(() => {
	const set = new Set(selectedRepoIds.value);
	return repos.value.filter((r) => set.has(r.id));
});

const orderedSelectedRepos = computed(() => {
	const pinSet = new Set(pinnedRepoIds.value);
	return [...selectedRepos.value].sort((a, b) => {
		const pinDelta = Number(pinSet.has(b.id)) - Number(pinSet.has(a.id));
		if (pinDelta !== 0) return pinDelta;
		const countDelta = b.openCount - a.openCount;
		if (countDelta !== 0) return countDelta;
		const aTs = a.lastUpdatedAt ? Date.parse(a.lastUpdatedAt) : 0;
		const bTs = b.lastUpdatedAt ? Date.parse(b.lastUpdatedAt) : 0;
		if (aTs !== bTs) return bTs - aTs;
		return a.name.localeCompare(b.name);
	});
});

const filteredRepoOptions = computed(() => {
	const q = repoSearch.value.trim().toLowerCase();
	if (!q) return repos.value;
	return repos.value.filter((r) => r.full_name.toLowerCase().includes(q));
});

const visibleRepoIds = computed(() => {
	if (groupMode.value === 'repo') {
		return orderedSelectedRepos.value.slice(0, columnLimit.value).map((r) => r.id);
	}
	return selectedRepoIds.value;
});

const visibleRepoIdsKey = computed(() => visibleRepoIds.value.join(','));

const columnsByRepoId = computed(() => new Map(columns.value.map((c) => [c.repo.id, c])));

const visibleColumns = computed(() => {
	if (groupMode.value !== 'repo') return [];
	return visibleRepoIds.value
		.map((id) => columnsByRepoId.value.get(id))
		.filter((col): col is KanbanColumn => Boolean(col));
});

const repoFilteredColumns = computed(() => {
	const q = search.value.toLowerCase();
	return visibleColumns.value
		.map((col) => {
			const items = col.items.filter((item) => {
				if (typeFilter.value === 'issues' && item.isPullRequest) return false;
				if (typeFilter.value === 'prs' && !item.isPullRequest) return false;
				if (q && !item.title.toLowerCase().includes(q) && !`#${item.number}`.includes(q)) return false;
				return true;
			});
			return { ...col, items };
		})
		.filter((col) => col.items.length > 0);
});

const statusLanes = computed(() => {
	const q = search.value.toLowerCase();
	const lanes: Array<{ id: 'backlog' | 'in-progress' | 'review' | 'blocked'; title: string; items: Array<KanbanItem & { repoId: number }> }> = [
		{ id: 'backlog', title: 'Backlog', items: [] },
		{ id: 'in-progress', title: 'In Progress', items: [] },
		{ id: 'review', title: 'Review', items: [] },
		{ id: 'blocked', title: 'Blocked', items: [] },
	];

	for (const col of columns.value) {
		for (const item of col.items) {
			if (typeFilter.value === 'issues' && item.isPullRequest) continue;
			if (typeFilter.value === 'prs' && !item.isPullRequest) continue;
			if (q && !item.title.toLowerCase().includes(q) && !`#${item.number}`.includes(q)) continue;
			const lane = inferLane(item);
			const laneObj = lanes.find((l) => l.id === lane);
			laneObj?.items.push({ ...item, repoId: col.repo.id });
		}
	}

	for (const lane of lanes) {
		lane.items.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
	}

	return lanes.filter((lane) => lane.items.length > 0);
});

const canLoadMore = computed(() => groupMode.value === 'repo' && orderedSelectedRepos.value.length > visibleRepoIds.value.length);

async function loadReposMeta() {
	repos.value = await getKanbanRepos();

	const ids = new Set(repos.value.map((r) => r.id));
	selectedRepoIds.value = selectedRepoIds.value.filter((id) => ids.has(id));
	pinnedRepoIds.value = pinnedRepoIds.value.filter((id) => ids.has(id));

	if (selectedRepoIds.value.length === 0) {
		applyPreset('all');
		columnLimit.value = Math.max(columnLimit.value, repos.value.length);
	}
}

async function loadKanban() {
	if (selectedRepoIds.value.length === 0) {
		columns.value = [];
		loading.value = false;
		return;
	}
	try {
		columns.value = await getKanban(visibleRepoIds.value);
	} finally {
		loading.value = false;
	}
}

function applyPreset(preset: 'top' | 'mine' | 'all', fromUser = false) {
	if (fromUser) markInteracted();
	if (preset === 'all') {
		selectedRepoIds.value = repos.value.map((r) => r.id);
		return;
	}
	if (preset === 'mine') {
		const mine = repos.value.filter((r) => r.mineCount > 0).map((r) => r.id);
		selectedRepoIds.value = mine.length ? mine : repos.value.slice(0, 8).map((r) => r.id);
		return;
	}

	selectedRepoIds.value = [...repos.value]
		.sort((a, b) => {
			if (a.openCount !== b.openCount) return b.openCount - a.openCount;
			const aTs = a.lastUpdatedAt ? Date.parse(a.lastUpdatedAt) : 0;
			const bTs = b.lastUpdatedAt ? Date.parse(b.lastUpdatedAt) : 0;
			return bTs - aTs;
		})
		.slice(0, Math.max(columnLimit.value, 8))
		.map((r) => r.id);
}

function toggleRepoSelection(repoId: number) {
	markInteracted();
	if (selectedRepoIds.value.includes(repoId)) {
		selectedRepoIds.value = selectedRepoIds.value.filter((id) => id !== repoId);
		pinnedRepoIds.value = pinnedRepoIds.value.filter((id) => id !== repoId);
		return;
	}
	selectedRepoIds.value = [...selectedRepoIds.value, repoId];
}

function togglePin(repoId: number) {
	markInteracted();
	if (!selectedRepoIds.value.includes(repoId)) {
		selectedRepoIds.value = [...selectedRepoIds.value, repoId];
	}
	if (pinnedRepoIds.value.includes(repoId)) {
		pinnedRepoIds.value = pinnedRepoIds.value.filter((id) => id !== repoId);
		return;
	}
	pinnedRepoIds.value = [repoId, ...pinnedRepoIds.value.filter((id) => id !== repoId)];
}

function loadMore() {
	markInteracted();
	columnLimit.value += 6;
}

function setTypeFilter(next: typeof typeFilter.value) {
	markInteracted();
	typeFilter.value = next;
}

function setGroupMode(next: typeof groupMode.value) {
	markInteracted();
	groupMode.value = next;
}

onMounted(async () => {
	selectedRepoIds.value = readNumberArray(STORAGE_SCOPE);
	pinnedRepoIds.value = readNumberArray(STORAGE_PINS);
	typeFilter.value = (localStorage.getItem(STORAGE_TYPE) as typeof typeFilter.value) || 'all';
	groupMode.value = (localStorage.getItem(STORAGE_GROUP) as typeof groupMode.value) || 'repo';
	columnLimit.value = Number(localStorage.getItem(STORAGE_LIMIT) || '8') || 8;
	applyQueryToState(route.query);

	await loadReposMeta();
	await loadKanban();
	pollTimer = setInterval(loadKanban, 30000);
});

onUnmounted(() => {
	if (pollTimer) clearInterval(pollTimer);
});

watch(visibleRepoIdsKey, () => {
	if (loading.value) return;
	loadKanban();
});

watch(selectedRepoIds, (ids) => {
	const filtered = ids.filter((id) => allowedRepoIds.value.has(id));
	if (filtered.length !== ids.length) {
		selectedRepoIds.value = filtered;
		return;
	}
	writeNumberArray(STORAGE_SCOPE, filtered);
}, { deep: true });

watch(pinnedRepoIds, (ids) => {
	const selectedSet = new Set(selectedRepoIds.value);
	const filtered = ids.filter((id) => selectedSet.has(id));
	if (filtered.length !== ids.length) {
		pinnedRepoIds.value = filtered;
		return;
	}
	writeNumberArray(STORAGE_PINS, filtered);
}, { deep: true });

watch(typeFilter, (value) => {
	localStorage.setItem(STORAGE_TYPE, value);
});

watch(groupMode, (value) => {
	localStorage.setItem(STORAGE_GROUP, value);
});

watch(columnLimit, (value) => {
	localStorage.setItem(STORAGE_LIMIT, String(value));
});

watch(
	() => route.query,
	(query) => {
		applyQueryToState(query);
	},
	{ deep: true }
);

watch([search, typeFilter, groupMode, selectedRepoIds, pinnedRepoIds, columnLimit], () => {
	syncStateToQuery();
}, { deep: true });
</script>

<template>
	<div class="space-y-4">
		<div class="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
			<div class="flex flex-wrap items-center gap-3">
					<input
						v-model="search"
						@input="markInteracted"
						type="text"
						placeholder="Search issues & PRs..."
						class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-72"
					/>

					<div class="inline-flex rounded-md bg-gray-100 p-1">
						<button type="button" :class="['rounded px-3 py-1.5 text-sm font-medium', typeFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900']" @click="setTypeFilter('all')">All</button>
						<button type="button" :class="['rounded px-3 py-1.5 text-sm font-medium', typeFilter === 'issues' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900']" @click="setTypeFilter('issues')">Issues</button>
						<button type="button" :class="['rounded px-3 py-1.5 text-sm font-medium', typeFilter === 'prs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900']" @click="setTypeFilter('prs')">PRs</button>
					</div>

					<div class="inline-flex rounded-md bg-gray-100 p-1">
						<button type="button" :class="['rounded px-3 py-1.5 text-sm font-medium', groupMode === 'repo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900']" @click="setGroupMode('repo')">Group by Repo</button>
						<button type="button" :class="['rounded px-3 py-1.5 text-sm font-medium', groupMode === 'status' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900']" @click="setGroupMode('status')">Group by Status</button>
					</div>

				<details class="relative">
					<summary class="flex h-10 cursor-pointer list-none items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
						Repo Scope ({{ selectedRepoIds.length }})
					</summary>
					<div class="absolute right-0 z-20 mt-2 w-[24rem] rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
						<div class="mb-2 flex flex-wrap gap-2">
								<button type="button" class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" @click="applyPreset('mine', true)">My repos</button>
								<button type="button" class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" @click="applyPreset('top', true)">Top active</button>
								<button type="button" class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" @click="applyPreset('all', true)">All</button>
						</div>
						<input
							v-model="repoSearch"
							type="text"
							placeholder="Filter repos..."
							class="mb-2 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
						/>
						<div class="max-h-64 space-y-1 overflow-y-auto pr-1">
							<label v-for="repo in filteredRepoOptions" :key="repo.id" class="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 hover:bg-gray-50">
								<div class="flex items-center gap-2">
									<input
										type="checkbox"
										:checked="selectedRepoIds.includes(repo.id)"
										@change="toggleRepoSelection(repo.id)"
									/>
									<span class="text-sm text-gray-800">{{ repo.full_name }}</span>
								</div>
								<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{{ repo.openCount }}</span>
							</label>
						</div>
					</div>
				</details>
			</div>
		</div>

		<div v-if="loading" class="grid min-h-[52vh] place-items-center">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
		</div>

		<div v-else class="grid gap-4 lg:grid-cols-[15rem_1fr]">
			<aside class="hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:block">
				<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pinned Repos</div>
				<div class="space-y-1">
					<button
						v-for="repo in orderedSelectedRepos"
						:key="repo.id"
						type="button"
						class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
						@click="togglePin(repo.id)"
					>
						<span class="truncate pr-2 text-gray-700">{{ repo.name }}</span>
						<div class="flex items-center gap-1.5">
							<span class="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{{ repo.openCount }}</span>
							<span class="text-xs" :class="pinnedRepoIds.includes(repo.id) ? 'text-amber-500' : 'text-gray-300'">★</span>
						</div>
					</button>
				</div>
			</aside>

			<div class="min-w-0">
				<div v-if="groupMode === 'repo'" class="space-y-3">
					<div class="flex items-center justify-between text-sm text-gray-500">
						<span>Showing {{ visibleRepoIds.length }} of {{ orderedSelectedRepos.length }} repos</span>
					</div>
					<div v-if="repoFilteredColumns.length === 0" class="grid min-h-[45vh] place-items-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
						No open issues or pull requests found for the selected scope.
					</div>
					<div v-else class="flex gap-4 overflow-x-auto pb-2">
						<KanbanColumnComp v-for="col in repoFilteredColumns" :key="col.repo.id" :column="col" />
					</div>
					<div v-if="canLoadMore">
						<button type="button" class="inline-flex h-10 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50" @click="loadMore">
							Load more repos
						</button>
					</div>
				</div>

				<div v-else class="space-y-3">
					<div class="flex items-center justify-between text-sm text-gray-500">
						<span>Scope: {{ selectedRepoIds.length }} repos</span>
					</div>
					<div v-if="statusLanes.length === 0" class="grid min-h-[45vh] place-items-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
						No cards found for the selected filters.
					</div>
					<div v-else class="flex gap-4 overflow-x-auto pb-2">
						<section v-for="lane in statusLanes" :key="lane.id" class="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
							<header class="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-800">
								<span>{{ lane.title }}</span>
								<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{{ lane.items.length }}</span>
							</header>
							<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
								<a
									v-for="item in lane.items"
									:key="item.id"
									:href="`https://github.com/${repoById.get(item.repoId)?.full_name}/${item.isPullRequest ? 'pull' : 'issues'}/${item.number}`"
									target="_blank"
									rel="noopener"
									class="block rounded-md border border-gray-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow"
								>
									<p class="line-clamp-3 text-sm font-medium leading-5 text-gray-900">{{ item.title }}</p>
									<div class="mt-2 flex items-center justify-between text-xs text-gray-500">
										<span>#{{ item.number }}</span>
										<span>{{ repoById.get(item.repoId)?.name || 'repo' }}</span>
									</div>
								</a>
							</div>
						</section>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
