import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import type { User } from "../../shared/types.js";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	if (!res.ok) {
		throw new Error(`${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<T>;
}

export const meQueryOptions = queryOptions({
	queryKey: ["me"],
	queryFn: () => fetchJSON<User>("/api/me"),
});

export function useLogout() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => fetchJSON("/auth/logout", { method: "POST" }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["me"] });
		},
	});
}
