/* src/components/ProfileAvatar.tsx */

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

function getInitials(text: string) {
  const clean = text.trim();
  if (!clean) return "A";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return clean.slice(0, 1).toUpperCase();
}

export default function ProfileAvatar({ name, avatarUrl, size = "md" }: Props) {
  const sizeClass =
    size === "sm"
      ? "h-9 w-9 rounded-2xl text-xs"
      : size === "lg"
        ? "h-20 w-20 rounded-[1.5rem] text-xl"
        : "h-14 w-14 rounded-2xl text-sm";

  return (
    <div
      className={[
        "grid shrink-0 place-items-center overflow-hidden bg-white font-bold text-teal-700 shadow-sm",
        sizeClass,
      ].join(" ")}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}