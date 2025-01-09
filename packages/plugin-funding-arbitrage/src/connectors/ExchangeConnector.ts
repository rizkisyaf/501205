import { logger } from "../utils/logger";

export interface OrderParams {
    symbol: string;
    type: "MARKET" | "LIMIT";
    side: "BUY" | "SELL";
    amount: string;
    price?: string;
    leverage: number;
}

export interface Ticker {
    symbol: string;
    last: string;
    bid: string;
    ask: string;
    volume: string;
    timestamp: number;
}

export interface FundingRate {
    rate: string;
    timestamp: number;
    nextFundingTime: number;
}

export abstract class ExchangeConnector {
    protected apiKey: string;
    protected apiSecret: string;
    protected testnet: boolean;

    constructor(config: { apiKey: string; apiSecret: string; testnet?: boolean }) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.testnet = config.testnet || false;
    }

    abstract init(): Promise<void>;
    abstract getFundingRate(symbol: string): Promise<string>;
    abstract getTicker(symbol: string): Promise<Ticker>;
    abstract createOrder(params: OrderParams): Promise<any>;
    abstract cancelOrder(symbol: string, orderId: string): Promise<any>;
    abstract getOrder(symbol: string, orderId: string): Promise<any>;
    abstract getBalance(): Promise<{ [key: string]: string }>;
    abstract setLeverage(symbol: string, leverage: number): Promise<any>;

    protected handleError(error: any, context: string): never {
        const errorMessage = error.response?.data?.msg || error.message || "Unknown error";
        logger.error(`${context} error: ${errorMessage}`);
        throw new Error(`${context} failed: ${errorMessage}`);
    }

    protected normalizeSymbol(symbol: string): string {
        return symbol.replace("-", "");
    }
} 