import * as debugFactory from 'debug';

export interface ILog {
    log(...args: any[]);
    info(...args: any[]);
    error(...args: any[]);
}

export function LoggerFactory(ns: string): ILog {
    return <ILog>{
        log: debugFactory(`${ns}:log`),
        info: debugFactory(`${ns}:info`),
        error: debugFactory(`${ns}:error`)
    }
}
