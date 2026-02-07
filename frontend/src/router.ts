import { createRouter, createWebHistory } from 'vue-router';
import Login from './pages/Login.vue';
import Dashboard from './pages/Dashboard.vue';
import Kanban from './pages/Kanban.vue';

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: '/login', component: Login },
		{ path: '/', component: Dashboard },
		{ path: '/kanban', component: Kanban },
	],
});
