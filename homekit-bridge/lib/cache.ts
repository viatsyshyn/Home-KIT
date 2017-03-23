import * as Redis from 'redis';
import {ICache} from "../api/cache";

const cache = new class Cache implements ICache {
    private redis;

    init(url: string): Promise {
        return new Promise((resolve, reject) => {
            this.redis = Redis
                .createClient(url)
                .on('connect', () => { resolve() });
        });
    }

    get(key: string): Promise {
        return new Promise((resolve, reject) => {
            this.redis.get(key, (err, value) => {
                err ? reject(err) : resolve(value);
            });
        });
    }

    set(key: string, value): Promise {
        return new Promise((resolve, reject) => {
            this.redis.set(key, value, (err) => {
                err ? reject(err) : resolve(value);
            });
        });
    }

};

export default cache;
