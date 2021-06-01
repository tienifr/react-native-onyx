import React from 'react';
import {render} from '@testing-library/react-native';

import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import ViewWithText from '../components/ViewWithText';
import ViewWithCollections from '../components/ViewWithCollections';

describe('Onyx', () => {
    describe('Cache Service', () => {
        /** @type OnyxCache */
        let cache;

        // Always use a "fresh" instance
        beforeEach(() => {
            jest.resetModules();
            cache = require('../../lib/OnyxCache').default;
        });

        describe('getAllKeys', () => {
            it('Should be empty and resolve from fallback initially', async () => {
                // GIVEN empty cache and a fallback function
                const mockFallback = jest.fn().mockResolvedValue(['a', 'b', 'c']);

                // WHEN all keys are retrieved
                const result = await cache.getAllKeys(mockFallback);

                // THEN the result should be provided from the fallback
                expect(mockFallback).toHaveBeenCalledTimes(1);
                expect(result).toEqual(['a', 'b', 'c']);

                // THEN fallback result should be stored to cache and fallback not executed
                const cachedResult = await cache.getAllKeys(mockFallback);
                expect(cachedResult).toEqual(['a', 'b', 'c']);
                expect(mockFallback).toHaveBeenCalledTimes(1);
            });

            it('Should keep storage keys', async () => {
                // GIVEN cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // GIVEN a fallback function
                const mockFallback = jest.fn().mockResolvedValue(['a', 'b', 'c']);

                // THEN the keys should be stored in cache
                const allKeys = await cache.getAllKeys(mockFallback);
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);

                // AND the fallback should be executed
                expect(mockFallback).not.toHaveBeenCalled();
            });

            it('Should keep storage keys even when no values are provided', async () => {
                // GIVEN cache with some items
                cache.set('mockKey');
                cache.set('mockKey2');
                cache.set('mockKey3');

                // THEN the keys should be stored in cache
                const allKeys = await cache.getAllKeys(jest.fn());
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });

            it('Should not store duplicate keys', async () => {
                // GIVEN cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // WHEN an existing keys is later updated
                cache.set('mockKey2', 'new mock value');

                // THEN getAllKeys should not include a duplicate value
                const allKeys = await cache.getAllKeys(jest.fn());
                expect(allKeys).toEqual(['mockKey', 'mockKey2', 'mockKey3']);
            });

            it('Should execute the fallback only once for concurrent calls', async () => {
                // GIVEN empty cache and a fallback function
                const mockFallback = jest.fn().mockResolvedValue(['a', 'b', 'c']);

                // WHEN all keys are retrieved in parallel
                const promise1 = cache.getAllKeys(mockFallback);
                const promise2 = cache.getAllKeys(mockFallback);
                const promise3 = cache.getAllKeys(mockFallback);

                const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

                // THEN the fallback should be called only once
                expect(mockFallback).toHaveBeenCalledTimes(1);
                expect(result1).toEqual(['a', 'b', 'c']);
                expect(result2).toEqual(['a', 'b', 'c']);
                expect(result3).toEqual(['a', 'b', 'c']);
            });
        });

        describe('getValue', () => {
            it('Should return undefined when there is no stored value', () => {
                // GIVEN empty cache

                // WHEN a value is retrieved
                const result = cache.getValue('mockKey');

                // THEN it should be undefined
                expect(result).not.toBeDefined();
            });

            it('Should return cached value when it exists', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // WHEN a value is retrieved
                // THEN it should be the correct value
                expect(cache.getValue('mockKey')).toEqual({items: ['mockValue', 'mockValue2']});
                expect(cache.getValue('mockKey2')).toEqual('mockValue3');
            });
        });

        describe('hasCacheForKey', () => {
            it('Should return false when there is no stored value', () => {
                // GIVEN empty cache

                // WHEN a value does not exist in cache
                // THEN it should return false
                expect(cache.hasCacheForKey('mockKey')).toBe(false);
            });

            it('Should return cached value when it exists', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // WHEN a value exists in cache
                // THEN it should return true
                expect(cache.hasCacheForKey('mockKey')).toBe(true);
                expect(cache.hasCacheForKey('mockKey2')).toBe(true);
            });
        });

        describe('addKey', () => {
            it('Should store the key so that it is returned by `getAllKeys`', async () => {
                // GIVEN empty cache

                // WHEN set is called with key and value
                cache.addKey('mockKey');

                // THEN there should be no cached value
                expect(cache.hasCacheForKey('mockKey')).toBe(false);

                // THEN but a key should be available
                const allKeys = await cache.getAllKeys(jest.fn());
                expect(allKeys).toEqual(expect.arrayContaining(['mockKey']));
            });

            it('Should not make duplicate keys', async () => {
                // GIVEN empty cache

                // WHEN the same item is added multiple times
                cache.addKey('mockKey');
                cache.addKey('mockKey');
                cache.addKey('mockKey2');
                cache.addKey('mockKey');

                // THEN getAllKeys should not include a duplicate value
                const allKeys = await cache.getAllKeys(jest.fn());
                expect(allKeys).toEqual(['mockKey', 'mockKey2']);
            });
        });

        describe('set', () => {
            it('Should add data to cache when both key and value are provided', () => {
                // GIVEN empty cache

                // WHEN set is called with key and value
                cache.set('mockKey', {value: 'mockValue'});

                // THEN data should be cached
                const data = cache.getValue('mockKey');
                expect(data).toEqual({value: 'mockValue'});
            });

            it('Should overwrite existing cache items for the given key', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue'});

                // WHEN set is called for an existing key
                cache.set('mockKey2', {value: []});

                // THEN the value should be overwritten
                expect(cache.getValue('mockKey2')).toEqual({value: []});
            });
        });

        describe('remove', () => {
            it('Should remove the key from all keys', async () => {
                // GIVEN cache with some items
                cache.set('mockKey', 'mockValue');
                cache.set('mockKey2', 'mockValue');
                cache.set('mockKey3', 'mockValue');

                // WHEN an key is removed
                cache.remove('mockKey2');

                // THEN getAllKeys should not include the removed value
                const allKeys = await cache.getAllKeys(jest.fn());
                expect(allKeys).toEqual(['mockKey', 'mockKey3']);
            });

            it('Should remove the key from cache', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {items: ['mockValue', 'mockValue2']});
                cache.set('mockKey2', 'mockValue3');

                // WHEN a key is removed
                cache.remove('mockKey');

                // THEN a value should not be available in cache
                expect(cache.hasCacheForKey('mockKey')).toBe(false);
                expect(cache.getValue('mockKey')).not.toBeDefined();
            });
        });

        describe('merge', () => {
            it('Should create the value in cache when it does not exist', () => {
                // GIVEN empty cache

                // WHEN merge is called with new key value pairs
                cache.merge({
                    mockKey: {value: 'mockValue'},
                    mockKey2: {value: 'mockValue2'}
                });

                // THEN data should be created in cache
                expect(cache.getValue('mockKey')).toEqual({value: 'mockValue'});
                expect(cache.getValue('mockKey2')).toEqual({value: 'mockValue2'});
            });

            it('Should merge data to existing cache value', () => {
                // GIVEN cache with some items
                cache.set('mockKey', {value: 'mockValue'});
                cache.set('mockKey2', {other: 'otherMockValue', mock: 'mock', items: [3, 4, 5]});

                // WHEN merge is called with existing key value pairs
                cache.merge({
                    mockKey: {mockItems: []},
                    mockKey2: {items: [1, 2], other: 'overwrittenMockValue'}
                });

                // THEN the values should be merged together in cache
                expect(cache.getValue('mockKey')).toEqual({
                    value: 'mockValue',
                    mockItems: [],
                });

                expect(cache.getValue('mockKey2')).toEqual({
                    other: 'overwrittenMockValue',
                    items: [1, 2, 5],
                    mock: 'mock',
                });
            });

            it('Should merge objects correctly', () => {
                // GIVEN cache with existing object data
                cache.set('mockKey', {value: 'mockValue', anotherValue: 'overwrite me'});

                // WHEN merge is called for a key with object value
                cache.merge({
                    mockKey: {mockItems: [], anotherValue: 'overwritten'}
                });

                // THEN the values should be merged together in cache
                expect(cache.getValue('mockKey')).toEqual({
                    value: 'mockValue',
                    mockItems: [],
                    anotherValue: 'overwritten',
                });
            });

            it('Should merge arrays correctly', () => {
                // GIVEN cache with existing array data
                cache.set('mockKey', [{ID: 1}, {ID: 2}, {ID: 3}]);

                // WHEN merge is called with an array
                cache.merge({
                    mockKey: [{ID: 3}, {added: 'field'}, {}, {ID: 1000}]
                });

                // THEN the arrays should be merged as expected
                expect(cache.getValue('mockKey')).toEqual([
                    {ID: 3}, {ID: 2, added: 'field'}, {ID: 3}, {ID: 1000}
                ]);
            });

            it('Should work with primitive values', () => {
                // GIVEN cache with existing data
                cache.set('mockKey', {});

                // WHEN merge is called with bool
                cache.merge({mockKey: false});

                // THEN the object should be overwritten with a bool value
                expect(cache.getValue('mockKey')).toEqual(false);

                // WHEN merge is called with number
                cache.merge({mockKey: 0});

                // THEN the value should be overwritten
                expect(cache.getValue('mockKey')).toEqual(0);

                // WHEN merge is called with string
                cache.merge({mockKey: '123'});

                // THEN the value should be overwritten
                expect(cache.getValue('mockKey')).toEqual('123');

                // WHEN merge is called with string again
                cache.merge({mockKey: '123'});

                // THEN strings should not have been concatenated
                expect(cache.getValue('mockKey')).toEqual('123');

                // WHEN merge is called with an object
                cache.merge({mockKey: {value: 'myMockObject'}});

                // THEN the old primitive value should be overwritten with the object
                expect(cache.getValue('mockKey')).toEqual({value: 'myMockObject'});
            });

            it('Should do nothing to a key which value is `undefined`', () => {
                // GIVEN cache with existing data
                cache.set('mockKey', {ID: 5});

                // WHEN merge is called key value pair and the value is undefined
                cache.merge({mockKey: undefined});

                // THEN the key should still be in cache and the value unchanged
                expect(cache.hasCacheForKey('mockKey')).toBe(true);
                expect(cache.getValue('mockKey')).toEqual({ID: 5});
            });
        });

        describe('resolveTask', () => {
            it('Should start a new task when no pending task exists', () => {
                // GIVEN empty cache and a function returning a promise
                const task = jest.fn().mockResolvedValue({data: 'mockData'});

                // WHEN resolve task is called with this task
                cache.resolveTask('mockTask', task);

                // THEN the task should be triggered
                expect(task).toHaveBeenCalledTimes(1);
            });

            it('Should not start a task again when it is already captured and running', () => {
                // GIVEN cache that have captured a promise for a pending task
                const task = jest.fn().mockResolvedValue({data: 'mockData'});
                cache.resolveTask('mockTask', task);
                task.mockClear();

                // WHEN a function tries to run the same task
                cache.resolveTask('mockTask', task);
                cache.resolveTask('mockTask', task);
                cache.resolveTask('mockTask', task);

                // THEN the task should not have been called again
                expect(task).not.toHaveBeenCalled();
            });

            it('Should start a new task when a previous task was completed and removed', async () => {
                // GIVEN cache that have captured a promise for a pending task
                const task = jest.fn().mockResolvedValue({data: 'mockData'});
                cache.resolveTask('mockTask', task);
                task.mockClear();

                // WHEN the task is completed
                await waitForPromisesToResolve();

                // WHEN a function tries to run the same task
                cache.resolveTask('mockTask', task);

                // THEN a new task should be started
                expect(task).toHaveBeenCalledTimes(1);
            });

            it('Should resolve all tasks with the same result', () => {
                // GIVEN empty cache and a function returning a promise
                const task = jest.fn().mockResolvedValue({data: 'mockData'});

                // WHEN multiple tasks are executed at the same time
                const promise1 = cache.resolveTask('mockTask', task);
                const promise2 = cache.resolveTask('mockTask', task);
                const promise3 = cache.resolveTask('mockTask', task);

                // THEN they all should have the same result
                Promise.all([promise1, promise2, promise3])
                    .then(([result1, result2, result3]) => {
                        expect(result1).toEqual({data: 'mockData'});
                        expect(result2).toEqual({data: 'mockData'});
                        expect(result3).toEqual({data: 'mockData'});
                    });
            });
        });
    });

    describe('Onyx with Cache', () => {
        let Onyx;
        let withOnyx;

        /** @type OnyxCache */
        let cache;

        const ONYX_KEYS = {
            TEST_KEY: 'test',
            ANOTHER_TEST: 'anotherTest',
            COLLECTION: {
                MOCK_COLLECTION: 'mock_collection_',
            },
        };

        async function initOnyx() {
            const OnyxModule = require('../../index');
            Onyx = OnyxModule.default;
            withOnyx = OnyxModule.withOnyx;
            cache = require('../../lib/OnyxCache').default;

            Onyx.init({
                keys: ONYX_KEYS,
                registerStorageEventListener: jest.fn(),
            });

            // Onyx init introduces some side effects e.g. calls the getAllKeys
            // We're clearing to have a fresh mock calls history
            await waitForPromisesToResolve();
            jest.clearAllMocks();
        }

        // Always use a "fresh" (and undecorated) instance
        beforeEach(() => {
            jest.resetModules();
            return initOnyx();
        });

        it('Expect a single call to getItem when multiple components use the same key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);
            await initOnyx();

            // WHEN multiple components are rendered
            render(
                <>
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                </>
            );

            // THEN Async storage `getItem` should be called only once
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(1);
        });

        it('Expect a single call to getAllKeys when multiple components use the same key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            await initOnyx();
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);

            // WHEN multiple components are rendered
            render(
                <>
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                    <TestComponentWithOnyx />
                </>
            );

            // THEN Async storage `getItem` should be called only once
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getAllKeys).toHaveBeenCalledTimes(1);
        });

        it('Expect multiple calls to getItem when no existing component is using a key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);
            await initOnyx();

            // WHEN a component is rendered and unmounted and no longer available
            const result = render(<TestComponentWithOnyx />);
            await waitForPromisesToResolve();
            result.unmount();
            await waitForPromisesToResolve();

            // THEN When another component using the same storage key is rendered
            render(<TestComponentWithOnyx />);

            // THEN Async storage `getItem` should be called twice
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(2);
        });

        it('Expect multiple calls to getItem when multiple keys are used', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN two component
            const TestComponentWithOnyx = withOnyx({
                testObject: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithCollections);

            const AnotherTestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.ANOTHER_TEST,
                },
            })(ViewWithText);

            // GIVEN some values exist in storage
            AsyncStorageMock.setItem(ONYX_KEYS.TEST_KEY, JSON.stringify({ID: 15, data: 'mock object with ID'}));
            AsyncStorageMock.setItem(ONYX_KEYS.ANOTHER_TEST, JSON.stringify('mock text'));
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY, ONYX_KEYS.ANOTHER_TEST]);
            await initOnyx();

            // WHEN the components are rendered multiple times
            render(<TestComponentWithOnyx />);
            render(<AnotherTestComponentWithOnyx />);
            render(<TestComponentWithOnyx />);
            render(<AnotherTestComponentWithOnyx />);
            render(<AnotherTestComponentWithOnyx />);
            render(<TestComponentWithOnyx />);

            // THEN Async storage `getItem` should be called exactly two times (once for each key)
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(2);
            expect(AsyncStorageMock.getItem.mock.calls).toEqual([
                [ONYX_KEYS.TEST_KEY],
                [ONYX_KEYS.ANOTHER_TEST]
            ]);
        });

        it('Expect a single call to getItem when at least one component is still subscribed to a key', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component connected to Onyx
            const TestComponentWithOnyx = withOnyx({
                text: {
                    key: ONYX_KEYS.TEST_KEY,
                },
            })(ViewWithText);

            // GIVEN some string value for that key exists in storage
            AsyncStorageMock.getItem.mockResolvedValue('"mockValue"');
            AsyncStorageMock.getAllKeys.mockResolvedValue([ONYX_KEYS.TEST_KEY]);
            await initOnyx();

            // WHEN multiple components are rendered
            render(<TestComponentWithOnyx />);
            const result2 = render(<TestComponentWithOnyx />);
            const result3 = render(<TestComponentWithOnyx />);
            await waitForPromisesToResolve();

            // WHEN components unmount but at least one remain mounted
            result2.unmount();
            result3.unmount();
            await waitForPromisesToResolve();

            // THEN When another component using the same storage key is rendered
            render(<TestComponentWithOnyx />);

            // THEN Async storage `getItem` should be called once
            await waitForPromisesToResolve();
            expect(AsyncStorageMock.getItem).toHaveBeenCalledTimes(1);
        });

        it('Should remove collection items from cache when collection is disconnected', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN a component subscribing to a collection
            const TestComponentWithOnyx = withOnyx({
                collections: {
                    key: ONYX_KEYS.COLLECTION.MOCK_COLLECTION,
                },
            })(ViewWithCollections);

            // GIVEN some collection item values exist in storage
            const keys = [`${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}15`, `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}16`];
            AsyncStorageMock.setItem(keys[0], JSON.stringify({ID: 15}));
            AsyncStorageMock.setItem(keys[1], JSON.stringify({ID: 16}));
            AsyncStorageMock.getAllKeys.mockResolvedValue(keys);
            await initOnyx();

            // WHEN the collection using components render
            const result = render(<TestComponentWithOnyx />);
            const result2 = render(<TestComponentWithOnyx />);
            await waitForPromisesToResolve();

            // THEN the collection items should be in cache
            expect(cache.hasCacheForKey(keys[0])).toBe(true);
            expect(cache.hasCacheForKey(keys[1])).toBe(true);

            // WHEN one of the components unmounts
            result.unmount();
            await waitForPromisesToResolve();

            // THEN the collection items should still be in cache
            expect(cache.hasCacheForKey(keys[0])).toBe(true);
            expect(cache.hasCacheForKey(keys[1])).toBe(true);

            // WHEN the last component using the collection unmounts
            result2.unmount();
            await waitForPromisesToResolve();

            // THEN the collection items should be removed from cache
            expect(cache.hasCacheForKey(keys[0])).toBe(false);
            expect(cache.hasCacheForKey(keys[1])).toBe(false);
        });

        it('Should not remove item from cache when it still used in a collection', async () => {
            const AsyncStorageMock = require('@react-native-community/async-storage/jest/async-storage-mock');

            // GIVEN component that uses a collection and a component that uses a collection item
            const COLLECTION_ITEM_KEY = `${ONYX_KEYS.COLLECTION.MOCK_COLLECTION}10`;
            const TestComponentWithOnyx = withOnyx({
                collections: {
                    key: ONYX_KEYS.COLLECTION.MOCK_COLLECTION,
                },
            })(ViewWithCollections);

            const AnotherTestComponentWithOnyx = withOnyx({
                testObject: {
                    key: COLLECTION_ITEM_KEY,
                },
            })(ViewWithCollections);

            // GIVEN some values exist in storage
            AsyncStorageMock.setItem(COLLECTION_ITEM_KEY, JSON.stringify({ID: 10}));
            AsyncStorageMock.getAllKeys.mockResolvedValue([COLLECTION_ITEM_KEY]);
            await initOnyx();

            // WHEN both components render
            render(<TestComponentWithOnyx />);
            const result = render(<AnotherTestComponentWithOnyx />);
            await waitForPromisesToResolve();

            // WHEN the component using the individual item unmounts
            result.unmount();
            await waitForPromisesToResolve();

            // THEN The item should not be removed from cache as it's used in a collection
            expect(cache.hasCacheForKey(COLLECTION_ITEM_KEY)).toBe(true);
        });
    });
});
