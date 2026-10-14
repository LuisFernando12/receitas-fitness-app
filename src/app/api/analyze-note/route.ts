import { AppError } from "@/lib/api-errors";
import { withApiLogging } from "@/lib/api-handler";
import { analyzeNoteResponseSchema } from "@/lib/contracts";
import { analyzeReceiptImage } from "@/lib/gemini";
import { validateImageFile } from "@/lib/image-validation";
import { z } from "zod";

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "size" in value &&
      "type" in value,
  );
}

export async function POST(request: Request) {
  return withApiLogging(
    request,
    {
      route: "/api/analyze-note",
      fallbackMessage: "Não foi possível analisar a nota.",
    },
    async () => {
      const formData = await request.formData();
      const imageValue = formData.get("image");
      const image = isUploadedFile(imageValue) ? imageValue : null;

      await validateImageFile(image);
      if (!image) {
        throw new AppError("IMAGE_REQUIRED", "Envie uma foto da nota.", 400, "image");
      }
      let result: ReturnType<typeof analyzeNoteResponseSchema.parse>;
      try {
        result = analyzeNoteResponseSchema.parse(
          await analyzeReceiptImage({
            bytes: await image.arrayBuffer(),
            mimeType: image.type,
          }),
        );
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new AppError("AI_INVALID_RESPONSE", "A IA retornou dados em formato inválido.", 502);
        }
        throw error;
      }

      if (result.ingredients.length === 0) {
        throw new AppError(
          "NO_USABLE_INGREDIENTS",
          "Não encontramos ingredientes utilizáveis na nota.",
          422,
        );
      }

      return Response.json(result);
    },
  );
}
