import { Injectable } from "@nestjs/common";
import { Histogram } from "prom-client";

@Injectable()
export class MetricsService {
    async trackDuration<T>(
        histogram: Histogram<string>,
        labels: Record<string, string>,
        fn: () => Promise<T>,
    ): Promise<T> {
        const end = histogram.startTimer(labels);

        try {
            return await fn();
        } finally {
            end();
        }
    }
}
