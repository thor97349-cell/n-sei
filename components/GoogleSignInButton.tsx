import { signInWithGoogle } from "@/app/actions";

interface GoogleSignInButtonProps {
  callbackUrl: string;
  label?: string;
  className?: string;
}

export default function GoogleSignInButton({
  callbackUrl,
  label = "Entrar com Google",
  className,
}: GoogleSignInButtonProps) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="callback_url" value={callbackUrl} />
      <button
        type="submit"
        className={
          className ??
          "inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-dark"
        }
      >
        {label}
      </button>
    </form>
  );
}
