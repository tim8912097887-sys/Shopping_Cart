import { Kafka } from "kafkajs";
import { BrokerConfig } from "./types.js";

export class MessageBroker {
    readonly kafka: Kafka;

    constructor(config: BrokerConfig) {
        this.kafka = new Kafka({
            clientId: config.clientId,
            brokers: config.brokers,
            retry: {
                initialRetryTime: 300,
                retries: 10,
            },
        });
    }

    producer() {
        return this.kafka.producer();
    }

    consumer(groupId: string) {
        return this.kafka.consumer({ groupId });
    }

    admin() {
        return this.kafka.admin();
    }
}
