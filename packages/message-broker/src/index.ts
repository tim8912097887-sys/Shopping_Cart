import { MessageBroker } from "./broker.js";
import { KafkaProducer } from "./producer.js";
import { KafkaConsumer } from "./consumer.js";
import { BrokerConfig } from "./types.js";

export function createMessageBroker(config: BrokerConfig) {
    const broker = new MessageBroker(config);

    return {
        producer: new KafkaProducer(broker.producer()),

        consumer: (groupId: string) =>
            new KafkaConsumer(broker.consumer(groupId)),
        admin: broker.admin(),
    };
}

export type MessageBrokerType = ReturnType<typeof createMessageBroker>;

export * from "./topics.js";
export * from "./events.js";
