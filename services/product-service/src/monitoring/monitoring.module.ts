import { Module, Global, NestModule, MiddlewareConsumer } from "@nestjs/common";
import {
    PrometheusModule,
    makeHistogramProvider,
    makeCounterProvider,
} from "@willsoto/nestjs-prometheus";

import { categoryMetricsProviders } from "./tokens/category.metrics.js";
import { MetricsService } from "./metrics.service.js";
import { MetricsInterceptor } from "./metrics.interceptor.js";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { HttpMetricsMiddleware } from "./middleware/http-metrics.middleware.js";

console.log(
    "DEBUG: categoryMetricsProviders value is ->",
    categoryMetricsProviders,
);
@Global()
@Module({
    imports: [
        PrometheusModule.register({
            path: "/metrics",
            defaultMetrics: {
                enabled: true,
                config: {
                    prefix: "product_service_",
                },
            },
        }),
    ],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor,
        },
        MetricsService,

        // HTTP Duration
        makeHistogramProvider({
            name: "http_request_duration_seconds",
            help: "Duration of HTTP requests in seconds",
            labelNames: ["method", "route", "status"],
            buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
        }),

        // Request Counter
        makeCounterProvider({
            name: "http_requests_total",
            help: "Total HTTP requests",
            labelNames: ["method", "route", "status"],
        }),

        // Error Counter
        makeCounterProvider({
            name: "http_errors_total",
            help: "Total HTTP errors",
            labelNames: ["method", "route", "status"],
        }),

        ...categoryMetricsProviders,
    ],
    exports: [PrometheusModule, MetricsService, ...categoryMetricsProviders],
})
export class MonitoringModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(HttpMetricsMiddleware).forRoutes("*");
    }
}
