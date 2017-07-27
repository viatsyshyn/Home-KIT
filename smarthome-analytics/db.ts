import {
    MongoClient
} from 'mongodb';
import {
    ILog
} from './logger';

let storage = null;
let logger = null;
let settings = null;

export function init(logger_: ILog, mongoUrl: string, callback) {
    logger = logger_;

    MongoClient.connect(mongoUrl, (err, db) => {
        if (err)
            throw err;

        logger.info(`Connected to ${mongoUrl}`);

        storage = db.collection('events');
        settings = db.collection('settings');
        callback();
    });
}
export interface ISettings {
    device: string,
    key: string,
    value: any
}

export function getSettings(key: string): ISettings[] {
    return settings
        .find({
            "key": key
        })
        .map(function(x){
            return <ISettings>{
                device: x.device,
                key: x.key,
                value: x.value
            }
        })
        .toArray();
}

export function setSettings(insertObj: ISettings) {
    return settings
        .replaceOne({
            "device": insertObj.device,
            "key": insertObj.key
        }, insertObj, {
            upsert: true
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

export interface IZoneState {
    timestamp: number,
    currentTemperature: number,
    currentHumidity: number,
    targetTemperature: number,
    targetHumidity: number,
    heaterCoolerState: number,
    humidifierDehumidifierState: number
}

function min_max(min, max, x) {
    return (x < min || x > max) ? null : x;
}

function peek() {
    return [].slice.call(arguments).filter(x => x != undefined)[0] || null;
}

export function getZoneState(start: Date, end: Date, zone: string): IZoneState[] {
    return storage
        .find({
            "device": zone,
            "timestamp": {$gt: start.getTime(), $lt: end.getTime()}
        })
        .map(function (v){
            return <IZoneState>{
                timestamp: v.timestamp,
                currentTemperature: v.state == "climate" ? v.message.currentTemperature : undefined,
                currentHumidity: v.state == "climate" ? v.message.currentHumidity : undefined,
                targetTemperature: v.state == "climate" ? v.message.targetTemperature : undefined,
                targetHumidity: v.state == "climate" ? v.message.targetHumidity : undefined,
                heaterCoolerState: v.state == "heater-cooler" ? v.message.state : undefined,
                humidifierDehumidifierState: v.state == "humidifier-dehumidifier" ? v.message.state : undefined
            }
        })
        .toArray()
        .then(data => data.reduce((a, x) => {
                var l = a[a.length - 1] || {};
                return a.concat([{
                    timestamp: x.timestamp,
                    currentTemperature:             min_max(-50, 80, peek(x.currentTemperature, l.currentTemperature)),
                    currentHumidity:                min_max(1, 100, peek(x.currentHumidity, l.currentHumidity)),
                    targetTemperature:              peek(x.targetTemperature, l.targetTemperature),
                    targetHumidity:                 peek(x.targetHumidity, l.targetHumidity),
                    heaterCoolerState:              peek(x.heaterCoolerState, l.heaterCoolerState),
                    humidifierDehumidifierState:    peek(x.humidifierDehumidifierState, l.humidifierDehumidifierState)
                }]);
            }, []));
}

export interface IAirConditioning {
    timestamp: number,
    pow: boolean,
    mode: number,
    htemp: number,
    otemp: number
}

export function getAirConditioning(start: Date, end: Date, device: string): IAirConditioning[] {
    return storage
        .find({
            "device": device,
            "timestamp": {$gt: start.getTime(), $lt: end.getTime()}
        })
        .map(function(r) {
            return <IAirConditioning>{
                timestamp: r.timestamp,
                pow: r.message.pow,
                mode: r.message.mode,
                htemp: r.message.htemp,
                otemp: r.message.otemp
            }
        })
        .toArray()
        .then(data => data.reduce((a, x) => {
            var l = a[a.length - 1] || {};
            return a.concat([{
                timestamp: x.timestamp,
                pow: peek(x.pow, l.pow),
                mode: peek(x.mode, l.mode),
                htemp: peek(x.htemp, l.htemp),
                otemp: peek(x.otemp, l.otemp)
            }]);
        }, []));
}