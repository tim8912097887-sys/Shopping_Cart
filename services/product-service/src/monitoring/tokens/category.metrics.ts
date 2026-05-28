import {
    makeCounterProvider,
    makeHistogramProvider,
} from "@willsoto/nestjs-prometheus";

export const categoryMetricsProviders = [
    makeHistogramProvider({
        name: "category_repository_operation_duration_seconds",
        help: "Duration of database operations inside Category repository",
        labelNames: ["operation"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.3],
    }),
    makeCounterProvider({
        name: "category_validation_failures_total",
        help: "Total number of category business validation rule rejections",
        labelNames: ["reason"],
    }),
];
