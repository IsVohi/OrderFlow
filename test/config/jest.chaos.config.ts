import type { Config } from 'jest';

const config: Config = {
    displayName: 'chaos-tests',
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '../..',
    testMatch: ['<rootDir>/test/e2e/chaos/**/*.spec.ts'],
    setupFilesAfterEnv: ['<rootDir>/test/setup/chaos-setup.ts'],
    testTimeout: 600000, // 10 minutes for long-running chaos tests
    maxWorkers: 1, // Run tests sequentially to avoid conflicts
    bail: false, // Continue running tests even if one fails
    verbose: true,
    collectCoverageFrom: [
        'apps/*/src/**/*.ts',
        '!apps/*/src/**/*.spec.ts',
        '!apps/*/src/**/*.e2e-spec.ts',
    ],
    coverageDirectory: '<rootDir>/coverage/chaos',
    coverageReporters: ['text', 'lcov', 'html'],
    moduleNameMapper: {
        '^@orderflow/(.*)$': '<rootDir>/packages/$1/src',
    },
    globals: {
        'ts-jest': {
            isolatedModules: true,
        },
    },
};

export default config;
