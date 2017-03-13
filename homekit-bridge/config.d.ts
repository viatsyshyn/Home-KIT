export interface IAccessory {
    module: string;
    mqttId: string;
    config?: any;
}

export interface IConfig {
    MQTT: string;
    MAC: string;
    PIN: string;
    port?: number;
    name?: string;
    storage?: string;
    cache: string;

    accessories: IAccessory[];
}