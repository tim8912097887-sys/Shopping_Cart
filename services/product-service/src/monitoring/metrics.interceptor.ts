import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from "@nestjs/common";

import { InjectMetric } from "@willsoto/nestjs-prometheus";

import { Counter, Histogram } from "prom-client";

import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
    constructor(
        @InjectMetric("http_request_duration_seconds")
        private readonly durationHistogram: Histogram<string>,

        @InjectMetric("http_errors_total")
        private readonly errorCounter: Counter<string>,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const http = context.switchToHttp();

        const request = http.getRequest();
        const response = http.getResponse();

        const method = request.method;

        // IMPORTANT:
        // avoid request.url
        // use normalized route only
        const route = request.route?.path || "unknown";

        const endTimer = this.durationHistogram.startTimer({
            method,
            route,
        });

        return next.handle().pipe(
            tap({
                next: () => {
                    const status = response.statusCode.toString();

                    endTimer({ status });
                },

                error: (err) => {
                    const status = (
                        err.status ||
                        err.statusCode ||
                        500
                    ).toString();

                    endTimer({ status });

                    this.errorCounter.inc({
                        method,
                        route,
                        status,
                    });
                },
            }),
        );
    }
}
