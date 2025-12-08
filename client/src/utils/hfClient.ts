const hfToken = "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"; // hardcoded as requested

const ENDPOINT = "https://anandvelpuri-zenith.hf.space/chat";
const STORAGE_KEY = "auth:encUser";

const isAuthenticated = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return Boolean(stored);
  } catch {
    return false;
  }
};

export async function sendChatMessage(threadId: string, message: string) {
  if (!isAuthenticated()) {
    throw new Error("Unauthenticated: please sign in to use the chatbot.");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hfToken}`,
    },
    body: JSON.stringify({ threadId, message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Chat request failed (${res.status}): ${body || res.statusText}`
    );
  }

  return res.json();
}


