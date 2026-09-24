export type ClientPortalBrand = {
  name?: string;
  tagline?: string;
  primary?: string;
  secondary?: string;
  segment?: string;
};

export type ClientPortalProvider = {
  name: string;
  slug: string;
  brand?: ClientPortalBrand;
};

export type ClientPortalService = {
  id: string;
  name: string;
  duration: number;
  price: number;
  color: string;
  active: boolean;
};

export type ClientPortalBooking = {
  id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  notes: string;
  service?: ClientPortalService | null;
};

export type ClientPortalDashboard = {
  client: { id: string; name: string; phone: string };
  provider: ClientPortalProvider & { id: string };
  services: ClientPortalService[];
  bookings: ClientPortalBooking[];
};

export type PortalResponse = {
  provider?: ClientPortalProvider;
  session?: { token: string; expires_at: string };
  dashboard?: ClientPortalDashboard;
  service?: ClientPortalService;
  date?: string;
  slots?: string[];
  booking?: ClientPortalBooking;
  ok?: boolean;
};

export class PortalError extends Error {
  code?: string;
  status?: number;
}

export async function clientPortalCall(
  action: string,
  payload: Record<string, unknown> = {},
  token?: string,
): Promise<PortalResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) throw new PortalError("A área do cliente ainda não está configurada.");

  const response = await fetch(`${url}/functions/v1/client-portal`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new PortalError(body?.error || "Não foi possível concluir a solicitação.");
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return body as PortalResponse;
}
