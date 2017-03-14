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