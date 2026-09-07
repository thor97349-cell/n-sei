function hashToHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

interface AvatarProps {
  name: string;
  seed: string | number;
  size?: "sm" | "md";
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
};

export default function Avatar({ name, seed, size = "md" }: AvatarProps) {
  const hue = hashToHue(String(seed));
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: `hsl(${hue}, 62%, 42%)` }}
    >
      {initial}
    </span>
  );
}
