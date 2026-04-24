import StartScreen from "@/components/StartScreen";

// Force dynamic rendering so Next.js emits `Cache-Control: no-store` on the
// HTML response. Cloudways' Varnish layer respects that and skips caching —
// otherwise every deploy risks being masked by a 24 h cached placeholder.
export const dynamic = "force-dynamic";

export default function Page() {
  return <StartScreen />;
}
