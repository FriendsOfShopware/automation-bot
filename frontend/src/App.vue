<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getSession, type Session } from './api';
import Navbar from './components/Navbar.vue';

const router = useRouter();
const session = ref<Session | null>(null);
const loading = ref(true);

onMounted(async () => {
	try {
		session.value = await getSession();
	} catch {
		// Not logged in
	} finally {
		loading.value = false;
	}
});

router.beforeEach((to) => {
	if (!loading.value && !session.value && to.path !== '/login') {
		return '/login';
	}
});
</script>

<template>
	<div class="min-h-screen bg-gray-100">
		<Navbar v-if="session" :session="session" />
		<main class="mx-auto w-full max-w-[2200px] px-4 py-7 sm:px-6 lg:px-8">
			<router-view v-if="!loading" :session="session" />
			<div v-else class="grid min-h-[45vh] place-items-center">
				<div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
			</div>
		</main>
	</div>
</template>
