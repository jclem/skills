import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { meQueryOptions } from "../lib/api.js";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	const { data: user } = useQuery(meQueryOptions);

	return (
		<div>
			<h1 className="text-xl font-bold text-fg0">
				Welcome{user ? `, ${user.name}` : ""}
			</h1>
			<p className="mt-2 text-fg2">Your app is ready.</p>
		</div>
	);
}
