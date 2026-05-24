import {
    handleSignupEmail,
    handleSignupVerifiedEmail,
} from "#modules/service.js";
import {
    SignupEmailMessage,
    SignupVerifiedEmailMessage,
} from "#modules/types.js";
import {
    createMessageBroker,
    MessageBrokerType,
} from "@shoppingcart/message-broker";

export class MessageBroker {
    private static broker: MessageBrokerType;
    private static consumerInstance: ReturnType<MessageBrokerType["consumer"]>;
    public static instance: MessageBroker;

    private constructor() {}

    public static getInstance(): MessageBroker {
        if (!this.broker) {
            this.broker = createMessageBroker({
                clientId: "email-service",
                brokers: ["kafka-server:9092"],
                groupId: "email-service",
            });

            this.consumerInstance = this.broker.consumer("email-service");
        }

        if (!this.instance) {
            this.instance = new MessageBroker();
        }

        return this.instance;
    }

    public consumer() {
        return MessageBroker.consumerInstance;
    }

    public async connect() {
        await this.consumer().connect();
        await MessageBroker.broker.admin.connect();
    }

    public async disconnect() {
        await this.consumer().disconnect();
        await MessageBroker.broker.admin.disconnect();
    }

    async createTopics() {
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

        const existing = await MessageBroker.broker.admin.listTopics();

        const newTopics = topics.filter((t) => !existing.includes(t.topic));

        if (!newTopics.length) return;

        await MessageBroker.broker.admin.createTopics({
            topics: newTopics,
        });

        console.log(
            "Kafka topics ensured:",
            newTopics.map((t) => t.topic),
        );
    }

    public async subscribeToTopics() {
        await this.consumer().subscribe(
            "user.created.warning",
            async (payload: SignupVerifiedEmailMessage) => {
                await handleSignupVerifiedEmail(payload);
            },
        );
        await this.consumer().subscribe(
            "user.created",
            async (payload: SignupEmailMessage) => {
                await handleSignupEmail(payload);
            },
        );
    }

    public async startConsumer() {
        await this.consumer().run();
    }
}

export const messageBroker = MessageBroker.getInstance();
