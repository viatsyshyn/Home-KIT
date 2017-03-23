export interface ICache {
    init(url: string): Promise;
    get(key: string): Promise;
    set(key: string, value): Promise;
}