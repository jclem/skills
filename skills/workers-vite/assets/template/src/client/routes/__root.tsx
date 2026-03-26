import { useQuery } from "@tanstack/react-query";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Login } from "../components/login.js";
import { meQueryOptions, useLogout } from "../lib/api.js";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	const { data: user, isLoading, isError } = useQuery(meQueryOptions);
	const logout = useLogout();

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-bg0">
				<p className="text-fg2">Loading...</p>
			</div>
		);
	}

	if (isError || !user) {
		return <Login />;
	}

	return (
		<div className="min-h-screen bg-bg0">
			<header className="border-b border-bg2 bg-bg1">
				<div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
					<Link to="/" className="text-lg font-bold text-fg0">
						__APP_TITLE__
					</Link>
					<div className="flex items-center gap-3">
						{user.picture && (
							<img
								src={user.picture}
								alt=""
								className="h-7 w-7 rounded-full"
								referrerPolicy="no-referrer"
							/>
						)}
						<span className="text-sm text-fg1">{user.name}</span>
						<button
							type="button"
							onClick={() => logout.mutate()}
							className="text-sm text-fg3 hover:text-fg1"
						>
							Sign out
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
}
