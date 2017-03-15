import {
    MongoClient
} from 'mongodb';

let storage = null;

export function init(mongoUrl: string, callback) {
    MongoClient.connect(mongoUrl, (err, db) => {
        if (err)
            throw err;

        console.log(`Connected to ${mongoUrl}`);

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
                temperatureIn: y.message.values[0] < 0 ? null : y.message.values[0],
                temperatureOut: y.message.values[1] < 0 || y.message.values[1] > 60 ? null : y.message.values[1]
            }
        })
        .toArray();
}

export interface IDeviceOnOff {
    timestamp: number,
    active: boolean
}

export function getTemperatureOnOff(start: Date, end: Date, device: string): IDeviceOnOff[] {
    return storage
        .find({
            "state": "reported",
            "device": device,
            "message.temperature": {$gt:0},
            "timestamp": {$gt: start.getTime(), $lt: end.getTime()}
        })
        .map(function (z){
            return <ITemperatureHumidity>{
                timestamp: z.timestamp,
                active: z.message.active
            }
        })
        .toArray();
}