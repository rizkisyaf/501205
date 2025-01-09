import { DateTime } from "luxon";
import Decimal from "decimal.js";

export interface Position {
    symbol: string;
    exchange: string;
    side: "long" | "short";
    size: Decimal;
    leverage: number;
    entryPrice: Decimal;
    unrealizedPnl: Decimal;
    fundingPaid: Decimal;
    openTime: DateTime;
    lastUpdateTime: DateTime;
}

export interface TradeRequest {
    symbol: string;
    exchange: string;
    side: "long" | "short";
    size: Decimal;
    leverage: number;
    limitPrice?: Decimal;
}

export interface MarketData {
    symbol: string;
    exchange: string;
    lastPrice: Decimal;
    fundingRate: Decimal;
    timestamp: number;
}

export interface ExchangeConfig {
    apiKey: string;
    apiSecret: string;
    testnet?: boolean;
    passphrase?: string;
} 