<template>
	<div class="grid min-h-[70vh] place-items-center">
		<div class="w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
			<div class="border-b border-gray-200 px-6 py-5">
				<h2 class="text-lg font-semibold text-gray-900">Bot Dashboard</h2>
			</div>
			<div class="space-y-5 px-6 py-5 text-center">
				<p class="text-sm leading-6 text-gray-600">
					Sign in with your GitHub account to manage automation commands.
					You must be a member of the FriendsOfShopware organization.
				</p>
				<a
					href="/auth/login"
					class="inline-flex h-10 items-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
				>
					Login with GitHub
				</a>
			</div>
		</div>
	</div>
</template>
