import { useEffect, useState } from "react";

/** URL temporária para exibir um Blob (foto) em <img>, revogada quando o blob muda ou o componente sai. */
export function useObjectUrl(blob?: Blob | null): string | null {
  const [resource, setResource] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob || !("createObjectURL" in URL)) return;
    const url = URL.createObjectURL(blob);
    // Sincroniza um recurso externo do navegador; cada setup cria sua própria URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResource({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return resource && resource.blob === blob ? resource.url : null;
}
