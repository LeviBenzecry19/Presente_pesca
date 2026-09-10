/**
 * Converte uma foto da galeria num avatar quadrado pequeno.
 *
 * O resultado é uma data URL (~15–30 KB) em vez de Blob: cabe direto no `src`
 * de um <img>, não exige gerenciar object URLs e viaja como texto na
 * sincronização, sem precisar de um endpoint de upload só para isso.
 */
const AVATAR_SIZE = 256;
const QUALITY = 0.82;

export async function fileToAvatar(file: Blob, size = AVATAR_SIZE): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);

  // Recorte central: o avatar é sempre exibido redondo.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem neste navegador.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", QUALITY);
}
