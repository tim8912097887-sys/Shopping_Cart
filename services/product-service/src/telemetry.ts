import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

import { PrismaInstrumentation } from "@prisma/instrumentation";

const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});

export const otelSDK = new NodeSDK({
    traceExporter,

    resource: resourceFromAttributes({
        "service.name": "product-service",

        "service.version": "1.0.0",

        deployment_environment: process.env.NODE_ENV || "development",
    }),

    instrumentations: [
        getNodeAutoInstrumentations({
            "@opentelemetry/instrumentation-fs": {
                enabled: false,
            },
        }),

        new PrismaInstrumentation(),
    ],
});
