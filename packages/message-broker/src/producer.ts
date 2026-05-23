import { Producer } from "kafkajs";
import { EventMap, EventName } from "./events.js";

type PublishParams<T extends EventName> = {
    topic: T;
    payload: EventMap[T];
};

export class KafkaProducer {
    constructor(private readonly producer: Producer) {}

    async connect() {
        await this.producer.connect();
    }

    async disconnect() {
        await this.producer.disconnect();
    }

    async publish<T extends EventName>({ topic, payload }: PublishParams<T>) {
        await this.producer.send({
            topic,
            messages: [
                {
                    key: crypto.randomUUID(),
                    value: JSON.stringify(payload),
                },
            ],
        });
    }
}
