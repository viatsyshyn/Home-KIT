import {
    MongoClient
} from 'mongodb';
import {IStorage} from "../api/storage";

const storage = new class Storage implements IStorage {
    private db;
    private events;

    init(url: string): Promise {
        return new Promise((resolve, reject) => {
            MongoClient.connect(url, (err, db) => {
                if (err)
                    return reject(err);

                this.db = db;
                this.events = db.collection('events');

                resolve();
            });
        });
    }

    insert(event: any): Promise {
        return this.events.insert(event);
    }
};

export default storage;