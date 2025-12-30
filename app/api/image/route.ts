import { ImageGenerationRequest } from "@/app/free-image/types";

export async function POST(request: Request) {
  try {
    const body: ImageGenerationRequest = await request.json();
    const { mode } = body;

    // 验证 mode
    if (!mode || (mode !== "fast" && mode !== "slow")) {
      return Response.json(
        {
          success: false,
          error: "Invalid mode. Must be 'fast' or 'slow'",
        },
        { status: 400 }
      );
    }

    // 快速模式：立即返回 4 张图片
    if (mode === "fast") {
      const images = Array.from(
        { length: 4 },
        (_, i) => `https://picsum.photos/512/512?random=${Date.now()}-${i}`
      );

      return Response.json({
        success: true,
        images,
      });
    }

    // 慢速模式：使用 ReadableStream 逐个返回图片
    if (mode === "slow") {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 4; i++) {
            // 每张图片都等待 5 秒（包括第一张）
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const imageUrl = `https://picsum.photos/512/512?random=${Date.now()}-${i}`;
            const chunk = {
              index: i,
              url: imageUrl,
              timestamp: Date.now(),
            };

            // 发送 JSON 行（每行一个对象）
            const data = JSON.stringify(chunk) + "\n";
            controller.enqueue(encoder.encode(data));
          }

          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    // 不应该到达这里
    return Response.json(
      {
        success: false,
        error: "Unknown error",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Image generation API error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
