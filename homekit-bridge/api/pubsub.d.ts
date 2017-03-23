export interface IPubSub {
    init(url: string): Promise;
    sub(topic: string, cb: (msg, topic: string) => void);
    pub(topic: string, msg);
}