import { Span, SpanStatusCode } from "@opentelemetry/api";

import { tracer } from "./tracer.js";

type TraceOptions = {
    name: string;
    attributes?: Record<string, string | number | boolean>;
};

export async function withTrace<T>(
    options: TraceOptions,
    callback: (span: Span) => Promise<T>,
): Promise<T> {
    return tracer.startActiveSpan(options.name, async (span) => {
        try {
            if (options.attributes) {
                span.setAttributes(options.attributes);
            }

            const result = await callback(span);

            span.setStatus({
                code: SpanStatusCode.OK,
            });

            return result;
        } catch (error: any) {
            span.recordException(error);

            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
            });

            throw error;
        } finally {
            span.end();
        }
    });
}
