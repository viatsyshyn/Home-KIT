import {IPubSub} from "./pubsub";
import {IStorage} from "./storage";
import {ICache} from "./cache";
import {ILogger} from "./logger";

export interface IRuntime {
    uuid;
    Accessory;
    Service;
    Characteristic;
    pubsub: IPubSub;
    storage: IStorage;
    cache: ICache;

    getLogger(ns: string): ILogger;
}
