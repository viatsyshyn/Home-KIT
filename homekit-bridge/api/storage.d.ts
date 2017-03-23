export interface IStorage {
    init(url: string): Promise;
    insert(event: any): Promise;
}