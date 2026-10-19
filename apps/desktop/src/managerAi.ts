export interface ManagerAiAccess {
  status: "active" | "revoked";
  creditLimit: number;
  usedCredits: number;
  remainingCredits: number;
  expiresAt: string | null;
}

export interface ManagerAiResult {
  text: string;
  source: "manager" | "personal";
  creditLimit: number | null;
  usedCredits: number | null;
  remainingCredits: number | null;
}

export const bundledAiGatewayUrl = (import.meta.env.VITE_MANAGER_AI_GATEWAY_URL ?? "").trim();
