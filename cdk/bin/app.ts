#!/usr/bin/env node
import 'dotenv/config';
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PostNordEventTrackerStack } from '../lib/postnord-event-tracker-stack';
import {getConfig} from '../lib/config';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'development';

// Load the correct .env file
require('dotenv').config({ path: `.env.${environment}` });
const config = getConfig();

console.log(config)

new PostNordEventTrackerStack(app, 'PostNordEventTrackerStack', {
  env: {
    account: config.aws.account,
    region: config.aws.region,
  },
  description: 'PostNord Shipment Event Tracker using AWS Lambda and DynamoDB',
});

app.synth();