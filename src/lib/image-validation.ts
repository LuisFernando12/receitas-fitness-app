import {
  MAX_IMAGE_BYTES,
  SUPPORTED_IMAGE_TYPES,
} from "@/lib/contracts";
import { AppError } from "@/lib/api-errors";

const signatures: Record<(typeof SUPPORTED_IMAGE_TYPES)[number], (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) =>
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a,
  "image/webp":
    (bytes) =>
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
};

export async function validateImageFile(file: File | null): Promise<void> {
  if (!file) {
    throw new AppError("IMAGE_REQUIRED", "Envie uma foto da nota.", 400, "image");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError(
      "IMAGE_TOO_LARGE",
      "A imagem deve ter no máximo 10 MB.",
      413,
      "image",
    );
  }

  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
    throw new AppError(
      "UNSUPPORTED_IMAGE",
      "Use uma imagem JPEG, PNG ou WEBP.",
      415,
      "image",
    );
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signatureMatches = signatures[file.type as (typeof SUPPORTED_IMAGE_TYPES)[number]]?.(bytes);

  if (!signatureMatches) {
    throw new AppError(
      "INVALID_IMAGE_SIGNATURE",
      "Não foi possível validar o conteúdo da imagem.",
      415,
      "image",
    );
  }
}
