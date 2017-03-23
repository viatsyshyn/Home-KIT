import * as mqtt from 'mqtt';
import {IPubSub} from "../api/pubsub";

const pubsub = new class PubSub implements IPubSub {
    private mqtt;

    init(url: string): Promise {
        return new Promise((resolve, reject) => {
            this.mqtt = mqtt
                .connect(url)
                .on('connect', () => {
                    resolve();
                });
        })
    }

    sub(topic: string, cb: (msg, topic) => void) {
        this.sub_raw(topic, (m, t) => t === topic ? cb(JSON.parse(m.toString()), t) : null);
    }

    sub_raw(topic: string, cb: (msg, topic) => void) {
        this.mqtt
            .subscribe(topic)
            .on('message', (t, m) => {
                cb(m.toString(), t);
            });
    }

    pub(topic: string, msg) {
        this.mqtt.publish(topic, JSON.stringify(msg));
    }

};

export default pubsub;