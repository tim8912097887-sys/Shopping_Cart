import { Consumer } from "kafkajs";
import { EventMap, EventName } from "./events.js";

export class KafkaConsumer {
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

        await this.consumer.run({
            eachMessage: async ({ message }) => {
                if (!message.value) return;

                const payload = JSON.parse(
                    message.value.toString(),
                ) as EventMap[T];

                await handler(payload);
            },
        });
    }
}
