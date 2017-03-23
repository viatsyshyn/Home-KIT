import * as debugFactory from 'debug';
import {ILogger} from "../api/logger";

export function LoggerFactory(ns: string): ILogger {
    return <ILogger>{
        log: debugFactory(`${ns}:log`),
        info: debugFactory(`${ns}:info`),
        error: debugFactory(`${ns}:error`)
    }
}
