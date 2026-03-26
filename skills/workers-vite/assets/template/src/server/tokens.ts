function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

export async function hashSecret(secret: string): Promise<string> {
	const data = new TextEncoder().encode(secret);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return toHex(new Uint8Array(hash));
}

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	const ab = fromHex(a);
	const bb = fromHex(b);
	let result = 0;
	for (let i = 0; i < ab.length; i++) {
		result |= ab[i] ^ bb[i];
	}
	return result === 0;
}

export async function generateToken(): Promise<{
	id: string;
	secret: string;
	token: string;
	secretHash: string;
}> {
	const idBytes = new Uint8Array(4);
	const secretBytes = new Uint8Array(16);
	crypto.getRandomValues(idBytes);
	crypto.getRandomValues(secretBytes);

	const id = toHex(idBytes);
	const secret = toHex(secretBytes);
	const token = `__TOKEN_PREFIX___${id}_${secret}`;
	const secretHash = await hashSecret(secret);

	return { id, secret, token, secretHash };
}

export function parseToken(
	raw: string,
): { id: string; secret: string } | null {
	const parts = raw.split("_");
	if (parts.length !== 3) return null;
	if (parts[0] !== "__TOKEN_PREFIX__") return null;
	if (parts[1].length !== 8) return null;
	if (parts[2].length !== 32) return null;
	return { id: parts[1], secret: parts[2] };
}
