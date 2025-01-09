import { Position, TradeRequest, MarketData, ExchangeConfig } from "../types";
import { BinanceConnector } from "./BinanceConnector";
import { BybitConnector } from "./BybitConnector";
import { OKXConnector } from "./OKXConnector";
import Decimal from "decimal.js";

export interface ExchangeConnector {
    readonly exchange: string;
    
    // Market data methods
    fetchMarketData(symbol: string): Promise<MarketData>;
    fetchFundingRate(symbol: string): Promise<Decimal>;
    
    // Trading methods
    executeTrade(request: TradeRequest): Promise<Position>;
    getPosition(symbol: string): Promise<Position | null>;
    closePosition(symbol: string): Promise<boolean>;
    
    // Account methods
    getBalance(): Promise<Decimal>;
    setLeverage(symbol: string, leverage: number): Promise<boolean>;
}

export function createConnector(
    exchange: string,
    config: ExchangeConfig
): ExchangeConnector {
    switch (exchange.toLowerCase()) {
        case "binance":
            return new BinanceConnector(config);
        case "bybit":
            return new BybitConnector(config);
        case "okx":
            if (!config.passphrase) {
                throw new Error("OKX requires a passphrase in the config");
            }
            return new OKXConnector(config as ExchangeConfig & { passphrase: string });
        default:
            throw new Error(`Unsupported exchange: ${exchange}`);
    }
}

export {
    BinanceConnector,
    BybitConnector,
    OKXConnector
};

export type {
    Position,
    TradeRequest,
    MarketData,
    ExchangeConfig
}; 