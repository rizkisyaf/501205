# Funding Rate Arbitrage Plugin

This plugin implements an AI-powered funding rate arbitrage strategy for cryptocurrency perpetual futures markets. It monitors multiple exchanges for funding rate differentials and executes trades when profitable opportunities are identified.

## Features

- Real-time monitoring of funding rates across multiple exchanges
- AI-powered market analysis and opportunity detection
- Automated trade execution with risk management
- Configurable parameters for strategy customization
- Support for multiple exchanges (Binance, Bybit, OKX)
- Notification system for important events

## Installation

```bash
pnpm install @501205/plugin-funding-arbitrage
```

## Usage

1. Import and initialize the agent:

```typescript
import { FundingArbitrageAgent } from '@501205/plugin-funding-arbitrage';
import { DEFAULT_CONFIG } from '@501205/plugin-funding-arbitrage';

// Initialize exchange connectors
const connectors = new Map();
// Add your exchange connectors here...

// Create and start the agent
const agent = new FundingArbitrageAgent(DEFAULT_CONFIG, connectors);
await agent.start();
```

2. Configure the plugin by creating a config file:

```typescript
import { PluginConfig } from '@501205/plugin-funding-arbitrage';

const config: PluginConfig = {
    symbols: ['BTC-PERP', 'ETH-PERP'],
    exchanges: ['binance', 'bybit', 'okx'],
    minFundingDiff: 0.001, // 0.1%
    minProfitThreshold: 0.002, // 0.2%
    defaultLeverage: 3,
    initialBalance: 1000,
    riskManagement: {
        maxPositionSize: 1000,
        stopLossPercentage: 2,
        takeProfitPercentage: 5,
        maxDrawdownPercentage: 10
    },
    notifications: {
        enabled: true,
        telegramBotToken: 'YOUR_BOT_TOKEN',
        telegramChatId: 'YOUR_CHAT_ID'
    }
};
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| symbols | Trading pairs to monitor | ['BTC-PERP', 'ETH-PERP'] |
| exchanges | Supported exchanges | ['binance', 'bybit', 'okx'] |
| minFundingDiff | Minimum funding rate difference | 0.001 (0.1%) |
| minProfitThreshold | Minimum profit threshold | 0.002 (0.2%) |
| defaultLeverage | Default position leverage | 3 |
| initialBalance | Initial trading balance | 1000 |

## Risk Management

The plugin includes built-in risk management features:

- Position size limits
- Stop-loss and take-profit orders
- Maximum drawdown protection
- Multi-exchange risk distribution

## Notifications

Supports multiple notification channels:
- Telegram
- Discord (webhook)

## Development

```bash
# Build the plugin
pnpm run build

# Run tests
pnpm test

# Start in development mode
pnpm run dev
```

## License

MIT 