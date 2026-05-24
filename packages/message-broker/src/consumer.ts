import { Consumer } from "kafkajs";
import { EventMap, EventName } from "./events.js";

export class KafkaConsumer {
    private handlers: Partial<
        Record<EventName, (payload: any) => Promise<void>>
    > = {};

    constructor(private readonly consumer: Consumer) {}

    async connect() {
        await this.consumer.connect();
    }

    async disconnect() {
        await this.consumer.disconnect();
    }

    async subscribe<T extends EventName>(
        topic: T,
        handler: (payload: EventMap[T]) => Promise<void>,
    ) {
        await this.consumer.subscribe({
            topic,
            fromBeginning: false,
        });

        this.handlers[topic] = handler;
    }

    async run() {
        await this.consumer.run({
            eachMessage: async ({ topic, message }) => {
                if (!message.value) return;

                const handler = this.handlers[topic as EventName];
                if (!handler) return;

                const payload = JSON.parse(message.value.toString());

                await handler(payload);
            },
        });
    }
}
