function getEnvValue(key: string, defaultValue?: any) {
    const value = process.env[key];
    if (value === 'false' || value === 'true') {
        return value === 'false' ? false : value === 'true';
    }
    return value || defaultValue;
}

export function getConfig() {
    return {
        aws: {
            account: getEnvValue('CDK_DEFAULT_ACCOUNT'),
            region: getEnvValue('AWS_REGION', 'us-east-1'),
        },
        tables: {
            shipmentEventTable: getEnvValue('SHIPMENT_EVENTS_TABLE', 'shipment-events'),
        },
        environment: getEnvValue('ENVIRONMENT', 'development'),
    };
}

export type Config = ReturnType<typeof getConfig>;