export interface IAccessory {
    module: string;
    id: string;
    zones: string[];
    config?: any;
}

export interface IConfig {
    MAC: string;
    PIN: string;
    port?: number;
    name?: string;

    pubsub: string;
    storage: string;
    cache: string;

    accessories: IAccessory[];
}