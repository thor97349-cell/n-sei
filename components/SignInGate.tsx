import GoogleSignInButton from "@/components/GoogleSignInButton";
import type { Member } from "@/lib/types";

interface SignInGateProps {
  projectName: string;
  callbackUrl: string;
  members: Member[];
}

export default function SignInGate({
  projectName,
  callbackUrl,
  members,
}: SignInGateProps) {
  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <h1 className="text-xl font-bold text-ink">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Entre com sua conta Google para participar deste projeto.
      </p>

      <div className="mt-6">
        <GoogleSignInButton callbackUrl={callbackUrl} />
      </div>

      {members.length > 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Já estão no projeto: {members.map((m) => m.name).join(", ")}
        </p>
      )}
    </div>
  );
}
