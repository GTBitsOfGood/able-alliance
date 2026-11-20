import "dotenv/config";
import { db } from "@db";
import { materializeDueSeries } from "@/server/actions/RideSeriesAction";

async function main() {
  try {
    const result = await materializeDueSeries(new Date(), {
      throwOnError: true,
    });
    console.log(
      `[RideSeries] pass complete: ${result.seriesProcessed} series, ` +
        `${result.ridesCreated} created, ${result.ridesSkipped} skipped`,
    );
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("[RideSeries] materialize failed:", error);
  process.exitCode = 1;
});
