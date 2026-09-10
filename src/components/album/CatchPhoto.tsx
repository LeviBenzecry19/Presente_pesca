"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { speciesName } from "@/data/especies";
import type { Catch } from "@/lib/db/schema";
import { useObjectUrl } from "@/lib/hooks/useObjectUrl";

/** Shared photo presentation: object URLs are released by useObjectUrl on unmount. */
export function CatchPhoto({
  item,
  className = "",
  imageClassName = "object-cover",
  loading = "lazy",
}: {
  item: Catch;
  className?: string;
  imageClassName?: string;
  loading?: "lazy" | "eager";
}) {
  const blob = item.photo instanceof Blob && item.photo.size > 0 ? item.photo : null;
  const url = useObjectUrl(blob);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-brand-soft ${className}`}>
      {url && failedUrl !== url ? (
        // Photos are local IndexedDB blobs, not remote images for the Next.js optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Captura de ${speciesName(item.speciesId, item.speciesCustom)}`}
          className={`size-full ${imageClassName}`}
          loading={loading}
          decoding="async"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center text-brand-strong">
          <span className="flex size-16 items-center justify-center rounded-full border border-brand/15 bg-surface/50">
            <Icon name="fish" className="size-9" />
          </span>
          <span className="text-xs font-medium">{blob ? "Foto indisponível" : "A história ficou. A foto vem depois."}</span>
        </div>
      )}
    </div>
  );
}
