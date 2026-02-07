<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getCommands, getExecutions, type CommandInfo, type Execution, type Session } from '../api';
import DispatchForm from '../components/DispatchForm.vue';
import ExecutionTable from '../components/ExecutionTable.vue';

defineProps<{ session?: Session | null }>();

const commands = ref<CommandInfo[]>([]);
const executions = ref<Execution[]>([]);
const message = ref<string | null>(null);
const error = ref<string | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function loadExecutions() {
	try {
		executions.value = await getExecutions();
	} catch {
		// ignore polling errors
	}
}

onMounted(async () => {
	commands.value = await getCommands();
	await loadExecutions();
	pollTimer = setInterval(loadExecutions, 5000);
});

onUnmounted(() => {
	if (pollTimer) clearInterval(pollTimer);
});

function onDispatched(msg: string) {
	message.value = msg;
	error.value = null;
	loadExecutions();
}

function onDispatchError(err: string) {
	error.value = err;
	message.value = null;
}
</script>

<template>
	<div class="space-y-5">
		<DispatchForm
			:commands="commands"
			:message="message"
			:error="error"
			:is-authenticated="Boolean(session)"
			@dispatched="onDispatched"
			@error="onDispatchError"
		/>
		<ExecutionTable :executions="executions" />
	</div>
	<footer class="py-7 text-center text-sm text-gray-500">© 2026 FriendsOfShopware Bot. All rights reserved.</footer>
</template>
