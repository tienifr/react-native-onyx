import {deepEqual} from 'fast-equals';
import bindAll from 'lodash/bindAll';
import type {Key, Value} from './storage/providers/types';
import utils from './utils';

type StorageMap = Record<Key, Value>;

/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
class OnyxCache {
    /** Cache of all the storage keys available in persistent storage */
    private storageKeys: Set<Key>;

    /** Unique list of keys maintained in access order (most recent at the end) */
    private recentKeys: Set<Key>;

    /** A map of cached values */
    private storageMap: StorageMap;

    /**
     * Captured pending tasks for already running storage methods
     * Using a map yields better performance on operations such a delete
     */
    private pendingPromises: Map<string, Promise<unknown>>;

    /** Maximum size of the keys store din cache */
    private maxRecentKeysSize = 0;

    constructor() {
        this.storageKeys = new Set();
        this.recentKeys = new Set();
        this.storageMap = {};
        this.pendingPromises = new Map();

        // bind all public methods to prevent problems with `this`
        bindAll(
            this,
            'getAllKeys',
            'getValue',
            'hasCacheForKey',
            'addKey',
            'set',
            'drop',
            'merge',
            'hasPendingTask',
            'getTaskPromise',
            'captureTask',
            'removeLeastRecentlyUsedKeys',
            'setRecentKeysLimit',
        );
    }

    /** Get all the storage keys */
    getAllKeys(): Key[] {
        return Array.from(this.storageKeys);
    }

    /**
     * Get a cached value from storage
     * @param [shouldReindexCache] – This is an LRU cache, and by default accessing a value will make it become last in line to be evicted. This flag can be used to skip that and just access the value directly without side-effects.
     */
    getValue(key: Key, shouldReindexCache = true): Value {
        if (shouldReindexCache) {
            this.addToAccessedKeys(key);
        }
        return this.storageMap[key];
    }

    /** Check whether cache has data for the given key */
    hasCacheForKey(key: Key): boolean {
        return this.storageMap[key] !== undefined;
    }

    /** Saves a key in the storage keys list
     * Serves to keep the result of `getAllKeys` up to date
     */
    addKey(key: Key): void {
        this.storageKeys.add(key);
    }

    /**
     * Set's a key value in cache
     * Adds the key to the storage keys list as well
     */
    set(key: Key, value: Value): Value {
        this.addKey(key);
        this.addToAccessedKeys(key);
        this.storageMap[key] = value;

        return value;
    }

    /** Forget the cached value for the given key */
    drop(key: Key): void {
        delete this.storageMap[key];
        this.storageKeys.delete(key);
        this.recentKeys.delete(key);
    }

    /**
     * Deep merge data to cache, any non existing keys will be created
     * @param data - a map of (cache) key - values
     */
    merge(data: StorageMap): void {
        if (typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('data passed to cache.merge() must be an Object of onyx key/value pairs');
        }

        this.storageMap = {...utils.fastMerge(this.storageMap, data, false)};

        const storageKeys = this.getAllKeys();
        const mergedKeys = Object.keys(data);
        this.storageKeys = new Set([...storageKeys, ...mergedKeys]);
        mergedKeys.forEach((key) => this.addToAccessedKeys(key));
    }

    /**
     * Check whether the given task is already running
     * @param taskName - unique name given for the task
     */
    hasPendingTask(taskName: string): boolean {
        return this.pendingPromises.get(taskName) !== undefined;
    }

    /**
     * Use this method to prevent concurrent calls for the same thing
     * Instead of calling the same task again use the existing promise
     * provided from this function
     * @param taskName - unique name given for the task
     */
    getTaskPromise(taskName: string): Promise<unknown> | undefined {
        return this.pendingPromises.get(taskName);
    }

    /**
     * Capture a promise for a given task so other caller can
     * hook up to the promise if it's still pending
     * @param taskName - unique name for the task
     */
    captureTask(taskName: string, promise: Promise<unknown>): Promise<unknown> {
        const returnPromise = promise.finally(() => {
            this.pendingPromises.delete(taskName);
        });

        this.pendingPromises.set(taskName, returnPromise);

        return returnPromise;
    }

    /** Adds a key to the top of the recently accessed keys */
    private addToAccessedKeys(key: Key): void {
        this.recentKeys.delete(key);
        this.recentKeys.add(key);
    }

    /** Remove keys that don't fall into the range of recently used keys */
    removeLeastRecentlyUsedKeys(): void {
        let numKeysToRemove = this.recentKeys.size - this.maxRecentKeysSize;
        if (numKeysToRemove <= 0) {
            return;
        }
        const iterator = this.recentKeys.values();
        const temp = [];
        while (numKeysToRemove > 0) {
            const value = iterator.next().value;
            temp.push(value);
            numKeysToRemove--;
        }

        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < temp.length; ++i) {
            delete this.storageMap[temp[i]];
            this.recentKeys.delete(temp[i]);
        }
    }

    /** Set the recent keys list size */
    setRecentKeysLimit(limit: number): void {
        this.maxRecentKeysSize = limit;
    }

    /** Check if the value has changed */
    hasValueChanged(key: Key, value: Value): boolean {
        return !deepEqual(this.storageMap[key], value);
    }
}

const instance = new OnyxCache();

export default instance;
