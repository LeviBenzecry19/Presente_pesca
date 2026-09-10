import { avatarSrc } from "@/data/avatares";

/**
 * Avatar redondo. Aceita tanto "preset:<id>" quanto uma data URL da galeria,
 * por isso usa <img> puro em vez de next/image.
 */
export function Avatar({
  avatar,
  name,
  size = 96,
  className = "",
}: {
  avatar: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-2xl bg-surface-2 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc(avatar)}
        alt={name ? `Avatar de ${name}` : ""}
        width={size}
        height={size}
        className="size-full object-cover"
        draggable={false}
      />
    </span>
  );
}
