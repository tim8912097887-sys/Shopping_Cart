import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import {
    createMessageBroker,
    type MessageBrokerType,
} from "@shoppingcart/message-broker";

const kafkaPlugin: FastifyPluginAsync = fp(async (fastify) => {
    const kafka = createMessageBroker({
        clientId: "user-service",
        brokers: ["kafka-server:9092"],
    });

    await kafka.producer.connect();
    await kafka.admin.connect();

    fastify.decorate("kafka", kafka);
    fastify.decorate("producer", kafka.producer);

    fastify.log.info("Kafka connected");

    // create topics on startup
    await createTopics(kafka);

    fastify.addHook("onClose", async () => {
        await kafka.producer.disconnect();
        await kafka.admin.disconnect();
    });
});

async function createTopics(kafka: MessageBrokerType) {
    const topics = [
        {
            topic: "user.created",
            numPartitions: 3,
            replicationFactor: 1,
        },
        {
            topic: "user.created.warning",
            numPartitions: 3,
            replicationFactor: 1,
        },
    ];

    const existing = await kafka.admin.listTopics();

    const newTopics = topics.filter((t) => !existing.includes(t.topic));

    if (newTopics.length === 0) return;

    await kafka.admin.createTopics({
        topics: newTopics,
    });

    console.log(
        "Kafka topics ensured:",
        newTopics.map((t) => t.topic),
    );
}

export default kafkaPlugin;
