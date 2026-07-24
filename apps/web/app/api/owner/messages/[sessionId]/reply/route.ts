import { replyToOwnerMessage } from "../../../../../../owner/owner-activation-route";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const payload = await request.json();
  return replyToOwnerMessage(
    new Request(request.url, {
      body: JSON.stringify({
        ...(payload && typeof payload === "object" ? payload : {}),
        sessionId,
      }),
      headers: request.headers,
      method: "POST",
    }),
  );
}
