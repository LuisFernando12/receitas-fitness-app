import { describe, expect, it } from "vitest";
import { validateImageFile } from "@/lib/image-validation";

function imageFile(type: string, bytes: number[] = [0xff, 0xd8, 0xff, 0x00]) {
  return new File([new Uint8Array(bytes)], "receipt.jpg", { type });
}

describe("validação de imagem", () => {
  it("aceita JPEG com assinatura válida", async () => {
    await expect(validateImageFile(imageFile("image/jpeg"))).resolves.toBeUndefined();
  });

  it("rejeita formato não suportado", async () => {
    await expect(validateImageFile(imageFile("application/pdf"))).rejects.toMatchObject({
      code: "UNSUPPORTED_IMAGE",
      status: 415,
    });
  });

  it("rejeita MIME que não corresponde à assinatura", async () => {
    await expect(validateImageFile(imageFile("image/png"))).rejects.toMatchObject({
      code: "INVALID_IMAGE_SIGNATURE",
      status: 415,
    });
  });

  it("rejeita arquivo ausente", async () => {
    await expect(validateImageFile(null)).rejects.toMatchObject({
      code: "IMAGE_REQUIRED",
      status: 400,
    });
  });
});
