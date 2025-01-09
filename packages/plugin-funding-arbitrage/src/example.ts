import { createConnector } from './connectors';
import { DEFAULT_CONFIG } from './config';
import { FundingArbitrageAgent } from './agent/FundingArbitrageAgent';
import { logger } from './utils/logger';
import { ExchangeConfig } from './types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    try {
        const connectors = new Map();
        for (const [exchange, config] of Object.entries(DEFAULT_CONFIG.exchanges)) {
            const connector = createConnector(exchange, {
                apiKey: config.apiKey || '',
                apiSecret: config.apiSecret || '',
                testnet: config.testnet || false,
                passphrase: config.passphrase
            } as ExchangeConfig);
            connectors.set(exchange, connector);
        }

        const agent = new FundingArbitrageAgent(DEFAULT_CONFIG, connectors);
        await agent.start();

        // Keep the process running
        process.on('SIGINT', async () => {
            logger.info('Shutting down...');
            await agent.stop();
            process.exit(0);
        });
    } catch (error) {
        logger.error('Error starting the agent:', error);
        process.exit(1);
    }
}

// Run the example
main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
}); 