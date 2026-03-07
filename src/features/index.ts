/**
 * Core feature system facade for OMG.
 *
 * Mirrors OMC's feature-module pattern while exposing OMG-native modules:
 * - commands: extension command template discovery/expansion
 * - config: gemini-adapted configuration loader + model routing defaults
 * - platform: cross-platform runtime/process abstractions
 */

import * as commands from '../commands/index.js';
import * as config from '../config/index.js';
import * as platform from '../platform/index.js';

export { commands, config, platform };
