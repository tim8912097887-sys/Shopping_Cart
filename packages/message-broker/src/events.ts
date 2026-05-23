export type EventMap = {
    "user.created": {
        code: string;
        email: string;
    };

    "user.created.warning": {
        email: string;
    };
};

export type EventName = keyof EventMap;

export type EventPayload<T extends EventName> = EventMap[T];
