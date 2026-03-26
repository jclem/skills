export function Login() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-bg0">
			<div className="text-center">
				<h1 className="mb-6 text-2xl font-bold text-fg0">__APP_TITLE__</h1>
				<a
					href="/auth/google"
					className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white hover:opacity-90"
				>
					Sign in with Google
				</a>
			</div>
		</div>
	);
}
