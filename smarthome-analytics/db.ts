import {
    MongoClient
} from 'mongodb';
import {
    ILog
} from './logger';

let storage = null;
let logger = null;

export function init(logger_: ILog, mongoUrl: string, callback) {
    logger = logger_;

    MongoClient.connect(mongoUrl, (err, db) => {
        if (err)
            throw err;

        logger.info(`Connected to ${mongoUrl}`);

        storage = db.collection('events');
        callback();
    });
}

export interface ITemperatureHumidity {
    timestamp: number,
    temperature: number,
    humidity: number
}

export function getTemperatureHumidity(start: Date, end: Date, device: string): ITemperatureHumidity[] {
    return storage
        .find({
            "state": "reported",
            "device": device,
            "message.temperature": {$gt:0},
            "timestamp": {$gt: start.getTime(), $lt: end.getTime()}
        })
        .map(function (x){
            return <ITemperatureHumidity>{
                timestamp: x.timestamp,
                temperature: x.message.temperature,
                humidity: x.message.humidity
            }
        })
        .toArray();
}

export interface ITemperatureInOut {
    timestamp: number,
    temperatureIn: number,
    temperatureOut: number
}

export function getTemperatureInOut(start: Date, end: Date, device: string): ITemperatureInOut[] {
    return storage
        .find({
            "state": "reported",
            "device": device,
            "message.values": {$exists:true},
            "timestamp": {$gt: start.getTime(), $lt: end.getTime()}
        })
        .map(function (y){
            return <ITemperatureInOut>{
                timestamp: y.timestamp,
                temperatureIn: y.message.values[0] < -100 ? null : y.message.values[0],
                temperatureOut: y.message.values[1] < -100 ? null : y.message.values[1]
            }
        })
        .toArray();
}

export interface IDeviceOnOff {
    timestamp: number,
    active: boolean
}

export function getDeviceOnOff(start: Date, end: Date, device: string): IDeviceOnOff[] {
    return storage
        .find({
            "state": "reported",
            "device": device,
            "message.active": {$exists: true},
            "timestamp": {$gt: start.getTime(), $lt: end.getTime()}
        })
        .map(function (z){
            return <IDeviceOnOff>{
                timestamp: z.timestamp,
                active: z.message.active
            }
        })
        .toArray();
}