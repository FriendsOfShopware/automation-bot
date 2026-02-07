<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import vSelect from 'vue-select';
import 'vue-select/dist/vue-select.css';
import { getRepos, getPulls, getBranches, dispatch, type CommandInfo, type Repo, type Pull, type Branch } from '../api';

const props = defineProps<{
	commands: CommandInfo[];
	message?: string | null;
	error?: string | null;
	isAuthenticated?: boolean;
}>();

const emit = defineEmits<{
	dispatched: [message: string];
	error: [error: string];
}>();

const mode = ref<'pr' | 'ref'>('pr');
const selectedCommand = ref('');
const repos = ref<Repo[]>([]);
const selectedRepo = ref<Repo | null>(null);
const pulls = ref<Pull[]>([]);
const selectedPull = ref<Pull | null>(null);
const branches = ref<Branch[]>([]);
const selectedBranch = ref<Branch | null>(null);
const submitting = ref(false);
const args = ref<Record<string, string>>({});

const currentCommand = computed(() => props.commands.find((c) => c.name === selectedCommand.value));

watch(() => props.commands, (cmds) => {
	if (cmds.length && !selectedCommand.value) {
		selectedCommand.value = cmds[0].name;
	}
}, { immediate: true });

watch(currentCommand, (cmd) => {
	args.value = {};
	if (cmd?.arguments) {
		for (const arg of cmd.arguments) {
			args.value[arg.name] = arg.options[0] ?? '';
		}
	}
}, { immediate: true });

watch(selectedRepo, async (repo) => {
	pulls.value = [];
	branches.value = [];
	selectedPull.value = null;
	selectedBranch.value = null;

	if (!repo) return;

	const [owner, repoName] = repo.full_name.split('/');
	const [pullData, branchData] = await Promise.all([
		getPulls(owner, repoName),
		getBranches(owner, repoName),
	]);
	pulls.value = pullData;
	branches.value = branchData;
	if (branchData.length) {
		selectedBranch.value = branchData[0];
	}
});

async function loadRepos() {
	repos.value = await getRepos();
}

loadRepos();

async function submit() {
	if (!props.isAuthenticated) {
		emit('error', 'Please login with GitHub to dispatch commands.');
		return;
	}
	if (!selectedCommand.value || !selectedRepo.value) return;

	submitting.value = true;
	try {
		const payload: Parameters<typeof dispatch>[0] = {
			command: selectedCommand.value,
			repo: selectedRepo.value.full_name,
			mode: mode.value,
			args: Object.keys(args.value).length ? args.value : undefined,
		};

		if (mode.value === 'pr') {
			if (!selectedPull.value) {
				emit('error', 'Please select a pull request.');
				return;
			}
			payload.pr = selectedPull.value.number;
		} else {
			if (!selectedBranch.value) {
				emit('error', 'Please select a branch.');
				return;
			}
			payload.ref = selectedBranch.value.name;
		}

		const result = await dispatch(payload);
		if (result.success) {
			emit('dispatched', result.message || 'Command dispatched.');
		} else {
			emit('error', result.error || 'Failed to dispatch command.');
		}
	} catch (err: any) {
		emit('error', err.message || 'Failed to dispatch command.');
	} finally {
		submitting.value = false;
	}
}
</script>

<template>
	<section class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
		<header class="border-b border-gray-200 px-6 py-5">
			<h2 class="text-lg font-semibold text-gray-900">Dispatch Command</h2>
		</header>

		<div class="space-y-4 px-6 py-5">
			<div v-if="message" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
				{{ message }}
			</div>
			<div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
				{{ error }}
			</div>

			<div
				v-if="!isAuthenticated"
				class="rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50 px-8 py-10 text-center"
			>
				<h3 class="text-2xl font-bold text-gray-900">Login Required</h3>
				<p class="mx-auto mt-3 max-w-2xl text-base text-gray-600">
					Sign in with your GitHub account to dispatch automation commands.
					You must be a member of FriendsOfShopware to use this feature.
				</p>
				<a
					href="/auth/login"
					class="mt-6 inline-flex h-12 items-center rounded-lg bg-indigo-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700"
				>
					Login with GitHub
				</a>
			</div>

			<form v-else @submit.prevent="submit" class="space-y-4">
				<div class="space-y-1.5">
					<label for="command" class="text-sm font-medium text-gray-700">Command</label>
					<select
						id="command"
						v-model="selectedCommand"
						class="block h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
						required
					>
						<option v-for="cmd in commands" :key="cmd.name" :value="cmd.name">{{ cmd.name }}</option>
					</select>
				</div>

				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700">Repository</label>
					<v-select
						v-model="selectedRepo"
						:options="repos"
						label="full_name"
						placeholder="Search repositories..."
						:clearable="false"
					/>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium text-gray-700">Target</label>
					<div class="inline-flex rounded-md bg-gray-100 p-1">
						<button
							type="button"
							:class="[
								'rounded px-3 py-1.5 text-sm font-medium transition',
								mode === 'pr' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
							]"
							@click="mode = 'pr'"
						>
							Pull Request
						</button>
						<button
							type="button"
							:class="[
								'rounded px-3 py-1.5 text-sm font-medium transition',
								mode === 'ref' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
							]"
							@click="mode = 'ref'"
						>
							Branch / Ref
						</button>
					</div>
				</div>

				<div v-show="mode === 'pr'" class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700">Pull Request</label>
					<v-select
						v-model="selectedPull"
						:options="pulls"
						:get-option-label="(p: Pull) => `#${p.number} - ${p.title}`"
						placeholder="Select a pull request..."
						:disabled="!selectedRepo"
						:clearable="false"
					/>
				</div>

				<div v-show="mode === 'ref'" class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700">Branch</label>
					<v-select
						v-model="selectedBranch"
						:options="branches"
						label="name"
						placeholder="Select a branch..."
						:disabled="!selectedRepo"
						:clearable="false"
					/>
				</div>

				<template v-if="currentCommand?.arguments?.length">
					<div class="relative py-2">
						<div class="absolute inset-0 flex items-center" aria-hidden="true">
							<div class="w-full border-t border-gray-200" />
						</div>
						<div class="relative flex justify-center">
							<span class="bg-white px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Command Arguments</span>
						</div>
					</div>

					<div v-for="arg in currentCommand.arguments" :key="arg.name" class="space-y-1.5">
						<label :for="`arg-${arg.name}`" class="text-sm font-medium text-gray-700">{{ arg.label }}</label>
						<select
							:id="`arg-${arg.name}`"
							v-model="args[arg.name]"
							class="block h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
						>
							<option v-for="opt in arg.options" :key="opt" :value="opt">{{ opt }}</option>
						</select>
					</div>
				</template>

				<button
					type="submit"
					class="inline-flex h-10 items-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
					:disabled="submitting"
				>
					{{ submitting ? 'Dispatching...' : 'Dispatch' }}
				</button>
			</form>
		</div>
	</section>
</template>
