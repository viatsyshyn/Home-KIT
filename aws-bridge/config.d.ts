export interface IDevice {
    privKey: string;
    cert: string;
    subTopic: string;
    pubTopic: string;
}

export interface IConfig {
    mqtt: string;
    root: string;
    region: string;
    devices: Map<string, IDevice>;
}