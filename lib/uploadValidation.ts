const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateProductImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Formato não permitido. Envie uma imagem JPG, PNG ou WebP.");
  }
  if (file.size <= 0) throw new Error("O arquivo de imagem está vazio.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter no máximo 5 MB.");
}
