const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface Requirement {
  id: string;
  text: string;
  kind: 'technical' | 'behavioural' | 'domain';
  priority: 'must' | 'nice';
}

export interface ExtractedRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface ResearchBundle {
  pagesUsed: string[];
  pagesSkipped: { url: string; reason: string }[];
  aboutText: string | null;
  hiringProcessText: string | null;
}

export interface MergedResult {
  source: {
    company_url: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  role: ExtractedRole;
  research: ResearchBundle;
}

export async function createKit(
  jd: string,
  companyUrl: string,
  days: number,
  token: string
): Promise<{ kitId: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/kits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jd, companyUrl, days }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.msg || "Failed to create kit");
  }

  return res.json();
}

export function subscribeToKit(
  kitId: string,
  token: string,
  handlers: {
    onStatus?: (status: "PENDING" | "RUNNING") => void;
    onResult: (result: MergedResult) => void;
    onError: (message: string) => void;
  }
): () => void {
  const url = `${API_BASE}/api/kits/${kitId}/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  es.addEventListener("status", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      handlers.onStatus?.(data.status);
    } catch {}
  });

  es.addEventListener("result", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      handlers.onResult(data);
    } catch {
      handlers.onResult(e.data);
    }
    es.close();
  });

  es.addEventListener("error", (e: any) => {
    if (e.data) {
      try {
        handlers.onError(JSON.parse(e.data).message);
      } catch {
        handlers.onError("Kit generation failed");
      }
    } else {
      handlers.onError("Connection lost");
    }
    es.close();
  });

  return () => es.close();
}
