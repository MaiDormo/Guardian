import { apiUrl } from "./api";

export async function dispatchIntervention(): Promise<void> {
  await fetch(`${apiUrl()}/trigger/intervention`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}
